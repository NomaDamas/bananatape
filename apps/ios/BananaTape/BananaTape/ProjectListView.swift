import PhotosUI
import Photos
import SwiftUI
import UIKit

enum EditorVersionPillLabel {
    static func text(historyState: NativeHistoryBrowserState, imageSize: EditorSize) -> String {
        let versionLabel = historyState.rows.first(where: { $0.id == historyState.selectedEntryId })?.versionLabel ?? "v1"
        return "\(versionLabel) · \(Int(imageSize.width))x\(Int(imageSize.height))"
    }
}

struct ProjectListState: Equatable {
    let projects: [MobileProjectSummary]

    static let empty = ProjectListState(projects: [])

    var isEmpty: Bool {
        projects.isEmpty
    }
}

struct MobileProjectSummary: Identifiable, Equatable {
    let id: String
    let name: String
}

private struct ProjectListDisplayItem: Identifiable, Equatable {
    let id: String
    let name: String
    let metadata: String
    let symbolName: String
}

private enum ActiveEditorSheet: String, Identifiable {
    case composer
    case history
    case actions
    case references
    case projectSettings
    case providerSettings

    var id: String { rawValue }
}

struct ProjectListView: View {
    @ObservedObject var model: ProjectPickerModel
    private let storage: LocalProjectStorage
    private let keyStore: OpenAIAPIKeyStore
    @State private var projectName = ""
    @State private var composerState = ComposerState(
        selectedProvider: .openAI,
        systemPrompt: "",
        references: []
    )
    @State private var historyState = NativeHistoryBrowserState(entries: [])
    @State private var canvasTool: CanvasTool = .pan
    @State private var pipelineState = ProviderPipelineState()
    @State private var annotationHistory = AnnotationHistoryStack()
    @State private var canvasViewport = CanvasViewport.neutral
    @State private var apiKey = ""
    @State private var isSubmitting = false
    @State private var statusMessage: String?
    @State private var selectedProjectID: String?
    @State private var activeEditorSheet: ActiveEditorSheet?
    @State private var isCreatingProject = false
    @State private var isImportingProjectImage = false
    @State private var importedProjectPhoto: PhotosPickerItem?

    init(model: ProjectPickerModel, storage: LocalProjectStorage = LocalProjectStorage(), keyStore: OpenAIAPIKeyStore = KeychainOpenAIAPIKeyStore()) {
        self.model = model
        self.storage = storage
        self.keyStore = keyStore
        _apiKey = State(initialValue: keyStore.readAPIKey() ?? "")
    }

    init(state: ProjectListState) {
        let storage = FakeProjectStorage(projects: state.projects.map {
            MobileProjectRecord(id: $0.id, name: $0.name, manifestJSON: minimalManifest(id: $0.id, name: $0.name), historyJSON: minimalHistory, canvasJSON: nil)
        })
        self.model = ProjectPickerModel(storage: storage)
        self.storage = LocalProjectStorage()
        self.keyStore = KeychainOpenAIAPIKeyStore()
    }

    var body: some View {
        NavigationStack {
            ProjectListScreen(
                projects: displayProjects,
                isEmpty: model.state.isEmpty,
                onOpenProject: openProject,
                onProjectMenu: openProjectMenu,
                onCreateProject: { isCreatingProject = true },
                onImport: { isImportingProjectImage = true }
            )
            .navigationDestination(isPresented: Binding(
                get: { selectedProjectID != nil },
                set: { isPresented in
                    if !isPresented { selectedProjectID = nil }
                }
            )) {
                let projectID = selectedProjectID ?? ""
                EditorScreen(
                    projectName: projectName(for: projectID),
                    composerState: $composerState,
                    historyState: $historyState,
                    canvasTool: $canvasTool,
                    canvasState: NativeCanvasState(image: displayedImage, tool: canvasTool, viewport: canvasViewport, annotations: annotationHistory.current),
                    apiKey: $apiKey,
                    isSubmitting: isSubmitting,
                    statusMessage: statusMessage ?? pipelineState.userErrorMessage,
                    onGenerate: { Task { await generateImage() } },
                    onShowComposer: { activeEditorSheet = .composer },
                    onShowHistory: { activeEditorSheet = .history },
                    onShowActions: { activeEditorSheet = .actions },
                    onExport: { Task { await exportImage(displayedImage, projectID: projectID) } },
                    onAnnotationsChange: { annotations in
                        annotationHistory.apply(annotations)
                        pipelineState = pipelineState.replacingFocusedAnnotations(annotations)
                        composerState.mode = .edit
                        persistProjectContext(projectID: projectID)
                    },
                    onViewportChange: { canvasViewport = $0 },
                    canUndo: annotationHistory.canUndo,
                    canRedo: annotationHistory.canRedo,
                    onUndo: {
                        annotationHistory.undo()
                        pipelineState = pipelineState.replacingFocusedAnnotations(annotationHistory.current)
                        composerState.mode = .edit
                        persistProjectContext(projectID: projectID)
                    },
                    onRedo: {
                        annotationHistory.redo()
                        pipelineState = pipelineState.replacingFocusedAnnotations(annotationHistory.current)
                        composerState.mode = .edit
                        persistProjectContext(projectID: projectID)
                    },
                    lineageAvailability: pipelineState.lineageAvailability,
                    onMoveFocus: { moveFocus($0, projectID: projectID) },
                    onDeleteHistory: { deleteHistoryEntry($0, projectID: projectID) }
                )
                .navigationBarBackButtonHidden(true)
                .toolbar(.hidden, for: .navigationBar)
                .sheet(item: $activeEditorSheet) { sheet in
                    switch sheet {
                    case .composer:
                        SheetScaffold(detents: [.large]) {
                            ComposerView(
                                state: $composerState,
                                apiKey: $apiKey,
                                isSubmitting: isSubmitting,
                                statusMessage: statusMessage ?? pipelineState.userErrorMessage,
                                onSubmit: { Task { await generateImage() } },
                                onManageReferences: {
                                    activeEditorSheet = .references
                                },
                                onAddKey: { activeEditorSheet = .providerSettings }
                            )
                        }
                    case .history:
                        SheetScaffold(detents: [.medium, .large]) {
                            HistoryBrowserView(
                                state: $historyState,
                                onExport: { entry in
                                    Task { await exportHistoryEntry(entry, projectID: projectID) }
                                },
                                onDelete: { deleteHistoryEntry($0, projectID: projectID) }
                            )
                        }
                    case .references:
                        SheetScaffold(detents: [.medium, .large]) {
                            ReferenceImagesSheet(
                                references: $composerState.references,
                                onImportReferenceData: { data, suggestedName in
                                    importReferenceData(data, suggestedName: suggestedName, projectID: projectID)
                                }
                            )
                        }
                    case .actions:
                        ActionMenuSheet(
                            referenceCount: composerState.references.count,
                            onHistory: {
                                activeEditorSheet = .history
                            },
                            onReferences: {
                                activeEditorSheet = .references
                            },
                            onProjectSettings: {
                                activeEditorSheet = .projectSettings
                            },
                            onProviderSettings: {
                                activeEditorSheet = .providerSettings
                            },
                            onDelete: {
                                model.deleteProject(id: projectID)
                                selectedProjectID = nil
                                activeEditorSheet = nil
                            }
                        )
                        .presentationDetents([.height(330)])
                        .presentationDragIndicator(.hidden)
                        .presentationBackground(TossStyle.panel)
                    case .projectSettings:
                        SheetScaffold(detents: [.medium, .large]) {
                            ProjectSettingsView(
                                projectName: projectName(for: projectID),
                                systemPrompt: $composerState.systemPrompt,
                                localPath: storage.fileURL(projectID: projectID, relativePath: "").path,
                                onSave: { name in
                                    model.renameProject(id: projectID, name: name)
                                    persistProjectContext(projectID: projectID)
                                    activeEditorSheet = nil
                                },
                                onManageReferences: { activeEditorSheet = .references }
                            )
                        }
                    case .providerSettings:
                        SheetScaffold(detents: [.medium]) {
                            ProviderSettingsView(apiKey: $apiKey, onSave: saveAPIKey, onRemove: removeAPIKey)
                        }
                    }
                }
            }
        }
        .tint(TossStyle.primaryText)
        .sheet(isPresented: $isCreatingProject, onDismiss: { projectName = "" }) {
            NewProjectSheet(
                projectName: $projectName,
                onCancel: cancelProjectCreation,
                onCreate: confirmProjectCreation
            )
            .presentationDetents([.height(292)])
            .presentationDragIndicator(.visible)
            .presentationBackground(TossStyle.panel)
        }
        .photosPicker(isPresented: $isImportingProjectImage, selection: $importedProjectPhoto, matching: .images)
        .onChange(of: importedProjectPhoto) { _, item in
            guard let item else { return }
            Task { await importProjectImage(item) }
        }
        .onChange(of: historyState.selectedEntryId) { _, entryId in
            guard let projectID = selectedProjectID, entryId != pipelineState.focusedHistoryEntryId else { return }
            focusImage(entryId, projectID: projectID)
        }
        .onChange(of: composerState.references) { _, _ in
            guard let projectID = selectedProjectID else { return }
            persistProjectContext(projectID: projectID)
        }
    }

    private var displayedImage: CanvasImage {
        pipelineState.focusedImage ?? .emptyCanvasImage
    }

    private var displayProjects: [ProjectListDisplayItem] {
        let listed = model.state.projects.enumerated().map { index, project in
            ProjectListDisplayItem(
                id: project.id,
                name: project.name,
                metadata: metadata(for: index),
                symbolName: symbolName(for: index)
            )
        }
        return listed
    }

    private func metadata(for index: Int) -> String {
        ["5 versions · 2h ago · Local", "3 versions · Yesterday · Local", "8 versions · 3d ago · Local"][min(index, 2)]
    }

    private func symbolName(for index: Int) -> String {
        ["fish", "waterbottle", "rectangle.portrait.on.rectangle.portrait"][min(index, 2)]
    }

    private func projectName(for id: String) -> String {
        displayProjects.first { $0.id == id }?.name ?? "Untitled Project"
    }

    private func openProject(_ id: String) {
        model.openProject(id: id)
        guard let project = model.state.openedProject else {
            statusMessage = model.state.lastError?.userMessage
            return
        }
        loadProject(project)
        selectedProjectID = id
    }

    private func openProjectMenu(_ id: String) {
        selectedProjectID = id
        activeEditorSheet = .actions
    }

    private func moveFocus(_ direction: LineageNavigationDirection, projectID: String) {
        let nextState = pipelineState.replacingFocusedAnnotations(annotationHistory.current).movingFocus(direction)
        guard nextState.focusedImageId != pipelineState.focusedImageId else { return }
        pipelineState = nextState
        bindFocusedImage(projectID: projectID)
    }

    private func focusImage(_ imageID: String?, projectID: String) {
        guard let historyEntry = historyState.entries.first(where: { $0.id == imageID }),
              let image = pipelineState.images.first(where: { $0.id == historyEntry.id || $0.assetId == historyEntry.assetId })
        else { return }
        pipelineState = pipelineState.replacingFocusedAnnotations(annotationHistory.current).focusing(imageId: image.id)
        bindFocusedImage(projectID: projectID)
    }

    private func deleteHistoryEntry(_ entryID: String, projectID: String) {
        let currentState = pipelineState.replacingFocusedAnnotations(annotationHistory.current)
        let hadActiveRequest = currentState.activeRequestId != nil
        pipelineState = HistoryDeletionCoordinator.deleting(entryID: entryID, from: currentState)
        historyState = pipelineState.historyBrowserState
        isSubmitting = pipelineState.activeRequestId != nil
        if hadActiveRequest, pipelineState.activeRequestId == nil, statusMessage == "Submitting image request..." {
            statusMessage = nil
        }
        bindFocusedImage(projectID: projectID)
    }

    private func bindFocusedImage(projectID: String) {
        guard let image = pipelineState.focusedImage else {
            historyState = pipelineState.historyBrowserState
            annotationHistory = AnnotationHistoryStack()
            composerState.hasSelectedImage = false
            composerState.mode = .generate
            persistProjectContext(projectID: projectID)
            return
        }
        if let historyEntryId = pipelineState.focusedHistoryEntryId {
            historyState = historyState.selecting(entryId: historyEntryId)
        }
        annotationHistory = AnnotationHistoryStack(current: image.annotations)
        composerState.hasSelectedImage = true
        composerState.mode = .edit
        persistProjectContext(projectID: projectID)
    }

    private func createProject() {
        let name = projectName.isEmpty ? "Untitled Project" : projectName
        model.createProject(name: name)
        projectName = ""
    }

    private func cancelProjectCreation() {
        projectName = ""
        isCreatingProject = false
    }

    private func confirmProjectCreation() {
        createProject()
        isCreatingProject = false
    }

    private func loadProject(_ project: MobileProjectRecord) {
        let history = (try? ProjectHistoryDocument.parse(project.historyJSON).entries) ?? []
        var images: [CanvasImage] = []
        var focusedImageID: String?
        if let canvasJSON = project.canvasJSON, let canvas = try? MobileCanvasDocument.parse(canvasJSON) {
            images = canvas.imageOrder.compactMap { canvas.images[$0] }.map { localizedImage($0, projectID: project.id) }
            focusedImageID = canvas.focusedImageIds.first
        }
        if images.isEmpty {
            images = history.map { entry in
                CanvasImage(
                    id: entry.id,
                    url: storage.fileURL(projectID: project.id, relativePath: entry.assetPath).absoluteString,
                    assetId: entry.assetId,
                    size: EditorSize(width: 1024, height: 1024),
                    position: EditorPoint(x: 0, y: 0),
                    parentId: entry.parentId,
                    generationIndex: history.firstIndex(of: entry) ?? 0,
                    generationBatchId: entry.generationBatchId,
                    batchIndex: entry.batchIndex,
                    prompt: entry.prompt,
                    provider: entry.provider,
                    mode: entry.mode,
                    createdAt: entry.timestamp,
                    annotations: .empty,
                    hasMagicLayerFields: false,
                    status: .ready,
                    userErrorMessage: nil
                )
            }
            focusedImageID = images.last?.id
        }
        let settings = manifestSettings(project.manifestJSON)
        composerState = ComposerState(
            selectedProvider: .openAI,
            systemPrompt: settings.systemPrompt,
            references: settings.references,
            hasSelectedImage: !images.isEmpty,
            mode: .generate
        )
        pipelineState = ProviderPipelineState(images: images, history: history, focusedImageId: focusedImageID ?? images.last?.id)
        historyState = pipelineState.historyBrowserState
        annotationHistory = AnnotationHistoryStack(current: pipelineState.focusedImage?.annotations ?? .empty)
        composerState.mode = pipelineState.focusedImage == nil ? .generate : .edit
        canvasViewport = .neutral
        statusMessage = nil
    }

    private func localizedImage(_ image: CanvasImage, projectID: String) -> CanvasImage {
        let imageURL: String
        if image.url.hasPrefix("data:") || image.url.hasPrefix("mock:") || URL(string: image.url)?.isFileURL == true {
            imageURL = image.url
        } else {
            imageURL = storage.fileURL(projectID: projectID, relativePath: image.url).absoluteString
        }
        return CanvasImage(id: image.id, url: imageURL, assetId: image.assetId, size: image.size, position: image.position, parentId: image.parentId, generationIndex: image.generationIndex, generationBatchId: image.generationBatchId, batchIndex: image.batchIndex, prompt: image.prompt, provider: image.provider, mode: image.mode, createdAt: image.createdAt, annotations: image.annotations, hasMagicLayerFields: image.hasMagicLayerFields, status: image.status, userErrorMessage: image.userErrorMessage)
    }

    private func manifestSettings(_ json: String) -> (systemPrompt: String, references: [ComposerReferenceSummary]) {
        guard let data = json.data(using: .utf8),
              let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let settings = root["settings"] as? [String: Any]
        else { return ("", []) }
        let references = (settings["referenceImages"] as? [[String: Any]] ?? []).compactMap { record -> ComposerReferenceSummary? in
            guard let id = record["id"] as? String, let assetPath = record["assetPath"] as? String else { return nil }
            return ComposerReferenceSummary(id: id, label: record["label"] as? String ?? URL(fileURLWithPath: assetPath).lastPathComponent, assetPath: assetPath)
        }
        return (settings["systemPrompt"] as? String ?? "", references)
    }

    @MainActor
    private func importProjectImage(_ item: PhotosPickerItem) async {
        defer { importedProjectPhoto = nil }
        do {
            guard let data = try await item.loadTransferable(type: Data.self), let mimeType = ImageMimeType.detected(from: data), let image = UIImage(data: data) else {
                statusMessage = AdapterError.unsupportedFileType(.webp).userMessage
                return
            }
            let timestamp = Int(Date().timeIntervalSince1970 * 1000)
            let projectID = "imported-image-\(timestamp)"
            let name = "Imported Image"
            let project = MobileProjectRecord(id: projectID, name: name, manifestJSON: projectManifestJSON(id: projectID, name: name), historyJSON: minimalHistory, canvasJSON: nil)
            guard case .success = storage.create(project) else {
                statusMessage = AdapterError.corruptProject(projectID).userMessage
                return
            }
            let sourceURL = FileManager.default.temporaryDirectory.appendingPathComponent("\(projectID).\(mimeType == .png ? "png" : "jpg")")
            try data.write(to: sourceURL, options: .atomic)
            defer { try? FileManager.default.removeItem(at: sourceURL) }
            let assetID = "asset-\(timestamp)"
            guard case .success(let asset) = storage.importProjectImage(ProjectImageImportRequest(projectID: projectID, assetID: assetID, role: .baseImage, mimeType: mimeType, originalFileName: sourceURL.lastPathComponent, sourceURL: sourceURL)) else {
                statusMessage = AdapterError.corruptProject(projectID).userMessage
                return
            }
            let entry = HistoryEntry(id: "history-\(timestamp)", mode: .generate, provider: .mock, prompt: "Imported image", assetId: assetID, assetPath: asset.projectRelativePath, parentId: nil, createdAt: Date().ISO8601Format(), timestamp: Date().timeIntervalSince1970)
            let canvasImage = CanvasImage(id: entry.id, url: asset.fileURL.absoluteString, assetId: assetID, size: EditorSize(width: image.size.width * image.scale, height: image.size.height * image.scale), position: EditorPoint(x: 0, y: 0), parentId: nil, generationIndex: 0, prompt: entry.prompt, provider: .mock, mode: .generate, createdAt: entry.timestamp, annotations: .empty, hasMagicLayerFields: false, status: .ready, userErrorMessage: nil)
            pipelineState = ProviderPipelineState(images: [canvasImage], history: [entry], focusedImageId: canvasImage.id)
            historyState = pipelineState.historyBrowserState
            composerState = ComposerState(selectedProvider: .openAI, hasSelectedImage: true)
            annotationHistory = AnnotationHistoryStack()
            selectedProjectID = projectID
            persistProjectContext(projectID: projectID)
            model.refresh()
            statusMessage = "Image imported."
        } catch {
            statusMessage = AdapterError.unsupportedFileType(.webp).userMessage
        }
    }

    private func saveAPIKey() {
        let key = apiKey.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !key.isEmpty else {
            statusMessage = OpenAIImageProvider.missingKeyMessage
            return
        }
        switch keyStore.saveAPIKey(key) {
        case .success: statusMessage = "OpenAI API key saved."
        case .failure(let error): statusMessage = error.userMessage
        }
        activeEditorSheet = nil
    }

    private func removeAPIKey() {
        _ = keyStore.deleteAPIKey()
        apiKey = ""
        statusMessage = "OpenAI API key removed."
        activeEditorSheet = nil
    }

    private func importReferenceData(_ data: Data, suggestedName: String, projectID: String) -> Result<ComposerReferenceSummary, AdapterError> {
        guard let mimeType = ImageMimeType.detected(from: data) else {
            return .failure(.unsupportedFileType(.webp))
        }
        ensureProjectExists(storage: storage, projectID: projectID)
        let assetID = "reference-\(Int(Date().timeIntervalSince1970 * 1000))"
        let fileExtension = mimeType == .png ? "png" : "jpg"
        let sourceURL = FileManager.default.temporaryDirectory.appendingPathComponent("\(assetID).\(fileExtension)")
        do {
            try data.write(to: sourceURL, options: .atomic)
            defer { try? FileManager.default.removeItem(at: sourceURL) }
            switch storage.importProjectImage(ProjectImageImportRequest(
                projectID: projectID,
                assetID: assetID,
                role: .referenceImage,
                mimeType: mimeType,
                originalFileName: suggestedName,
                sourceURL: sourceURL
            )) {
            case .success(let asset):
                return .success(ComposerReferenceSummary(id: asset.id, label: asset.projectRelativePath.components(separatedBy: "/").last ?? suggestedName, assetPath: asset.projectRelativePath))
            case .failure(let error):
                return .failure(error)
            }
        } catch {
            return .failure(.corruptProject(projectID))
        }
    }

    private func ensureProjectExists(storage: LocalProjectStorage, projectID: String) {
        guard case .failure = storage.read(id: projectID) else { return }
        let projectName = projectName(for: projectID)
        _ = storage.create(MobileProjectRecord(id: projectID, name: projectName, manifestJSON: minimalManifest(id: projectID, name: projectName), historyJSON: minimalHistory, canvasJSON: nil))
    }

    @MainActor
    private func exportImage(_ image: CanvasImage, projectID: String) async {
        guard image.assetId != nil, let fileURL = exportFileURL(for: image, projectID: projectID) else {
            statusMessage = "Generate or import an image before exporting."
            return
        }
        _ = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
        let data = (try? Data(contentsOf: fileURL)) ?? Data()
        let exportable = ExportableImage(id: image.assetId ?? image.id, fileURL: fileURL, mimeType: fileURL.pathExtension.lowercased() == "jpg" ? .jpeg : .png, width: Int(image.size.width), height: Int(image.size.height), byteCount: data.count, createdAt: Date())
        switch await PhotoKitGalleryImageExport().saveToGallery(exportable) {
        case .success(let receipt): statusMessage = receipt.guidance ?? "Saved to Photos."
        case .failure(let error): statusMessage = error.userMessage
        }
    }

    @MainActor
    private func exportHistoryEntry(_ entry: HistoryEntry, projectID: String) async {
        let fileURL = storage.fileURL(projectID: projectID, relativePath: entry.assetPath)
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            statusMessage = AdapterError.storageNotFound(entry.assetPath).userMessage
            return
        }
        let image = UIImage(contentsOfFile: fileURL.path)
        let canvasImage = CanvasImage(id: entry.id, url: fileURL.absoluteString, assetId: entry.assetId, size: EditorSize(width: image.map { $0.size.width * $0.scale } ?? 1024, height: image.map { $0.size.height * $0.scale } ?? 1024), position: EditorPoint(x: 0, y: 0), parentId: entry.parentId, generationIndex: 0, prompt: entry.prompt, provider: entry.provider, mode: entry.mode, createdAt: entry.timestamp, annotations: .empty, hasMagicLayerFields: false, status: .ready, userErrorMessage: nil)
        await exportImage(canvasImage, projectID: projectID)
    }

    private func exportFileURL(for image: CanvasImage, projectID: String) -> URL? {
        if let url = URL(string: image.url), url.isFileURL { return url }
        if let assetID = image.assetId, let entry = historyState.entries.first(where: { $0.assetId == assetID }) {
            return storage.fileURL(projectID: projectID, relativePath: entry.assetPath)
        }
        return nil
    }

    private func persistProjectContext(projectID: String) {
        guard case .success(let project) = storage.read(id: projectID),
              let manifestData = project.manifestJSON.data(using: .utf8),
              var manifest = try? JSONSerialization.jsonObject(with: manifestData) as? [String: Any]
        else { return }
        manifest["updatedAt"] = Date().ISO8601Format()
        manifest["settings"] = [
            "systemPrompt": composerState.systemPrompt,
            "referenceImages": composerState.references.map { ["id": $0.id, "label": $0.label, "assetPath": $0.assetPath] }
        ]
        guard let nextManifest = jsonString(manifest),
              let documents = try? EditorProjectDocumentSerializer.serialize(
                  history: historyState.entries,
                  images: pipelineState.images,
                  focusedImageID: pipelineState.focusedImageId,
                  focusedAnnotations: annotationHistory.current
              )
        else { return }
        if case .failure(let error) = storage.updateDocuments(projectID: projectID, manifestJSON: nextManifest, historyJSON: documents.historyJSON, canvasJSON: documents.canvasJSON) {
            statusMessage = error.userMessage
        }
    }

    private func jsonString(_ object: Any) -> String? {
        guard JSONSerialization.isValidJSONObject(object),
              let data = try? JSONSerialization.data(withJSONObject: object, options: [.prettyPrinted, .sortedKeys])
        else { return nil }
        return String(data: data, encoding: .utf8)
    }

    @MainActor
    private func generateImage() async {
        guard let projectID = selectedProjectID else { return }
        let provider: EditorProvider = composerState.selectedProvider == .openAI ? .openAI : .mock
        let requestId = "generate-\(Int(Date().timeIntervalSince1970 * 1000))"
        let isEdit = composerState.mode == .edit
        let pending = pipelineState.startingSubmission(mode: composerState.mode, prompt: composerState.trimmedPrompt, annotations: annotationHistory.current, requestId: requestId, network: .online, provider: provider)
        pipelineState = pending
        statusMessage = "Submitting image request..."
        var inputImageURL: URL?
        var maskImageURL: URL?
        if isEdit, let sourceURL = exportFileURL(for: displayedImage, projectID: projectID) {
            let outputDirectory = FileManager.default.temporaryDirectory.appendingPathComponent(requestId, isDirectory: true)
            if case .success(let composition) = NativeImageComposer().compose(NativeImageCompositionRequest(sourceURL: sourceURL, annotations: annotationHistory.current, outputDirectory: outputDirectory)) {
                inputImageURL = sourceURL
                maskImageURL = composition.mask.fileURL
            } else {
                applyProviderFailure(requestID: requestId, message: NativeImageCompositionError.renderFailed.userMessage)
                return
            }
        }
        guard let request = pending.requestForActivePrompt(outputSize: composerState.outputSize, references: composerState.references, inputImageURL: inputImageURL, maskImageURL: maskImageURL) else { return }
        isSubmitting = true

        switch composerState.selectedProvider {
        case .mock:
            let result = isEdit ? MockImageProvider().edit(request) : MockImageProvider().generate(request)
            switch result {
            case .success(let image):
                if applyGeneratedResult(image, projectID: projectID) {
                    statusMessage = "Mock image generated."
                }
            case .failure(let message):
                applyProviderFailure(requestID: requestId, message: message)
            }
            isSubmitting = pipelineState.activeRequestId != nil
        case .openAI:
            let imageProvider = OpenAIImageProvider(keyStore: keyStore, transport: OpenAIURLSessionTransport())
            let result = isEdit ? imageProvider.edit(request) : imageProvider.generate(request)
            switch result {
            case .success(let image):
                if applyGeneratedResult(image, projectID: projectID) {
                    statusMessage = "Image generated."
                }
            case .failure(let message):
                applyProviderFailure(requestID: requestId, message: message)
            }
            isSubmitting = pipelineState.activeRequestId != nil
        }
    }

    @discardableResult
    private func applyGeneratedResult(_ result: ProviderImageResult, projectID: String) -> Bool {
        let persistenceFailureMessage = AdapterError.corruptProject(projectID).userMessage
        switch ProviderPipelineCompletionCoordinator.resolvingSuccess(
            result,
            in: &pipelineState,
            persistenceFailureMessage: persistenceFailureMessage,
            persist: { persistImageResult(result, projectID: projectID) }
        ) {
        case .ignored:
            return false
        case .failed(let nextState):
            pipelineState = nextState
            historyState = pipelineState.historyBrowserState
            statusMessage = persistenceFailureMessage
            isSubmitting = pipelineState.activeRequestId != nil
            return false
        case .applied(let nextState):
            pipelineState = nextState
        }
        historyState = pipelineState.historyBrowserState
        composerState.hasSelectedImage = true
        composerState.mode = .edit
        annotationHistory = AnnotationHistoryStack(current: pipelineState.focusedImage?.annotations ?? .empty)
        persistProjectContext(projectID: projectID)
        return true
    }

    private func applyProviderFailure(requestID: String, message: String) {
        guard case .failed(let nextState) = ProviderPipelineCompletionCoordinator.resolvingFailure(
            requestID: requestID,
            message: message,
            in: &pipelineState
        ) else { return }
        pipelineState = nextState
        historyState = pipelineState.historyBrowserState
        statusMessage = message
        isSubmitting = pipelineState.activeRequestId != nil
    }

    private func persistImageResult(_ result: ProviderImageResult, projectID: String) -> ProviderImageResult? {
        let data: Data?
        if let range = result.imageURL.range(of: "base64,"), result.imageURL.hasPrefix("data:image") {
            data = Data(base64Encoded: String(result.imageURL[range.upperBound...]))
        } else {
            let size = CGSize(width: CGFloat(result.size.width), height: CGFloat(result.size.height))
            data = UIGraphicsImageRenderer(size: size).pngData { context in
                UIColor(TossStyle.imageShell).setFill()
                context.fill(CGRect(origin: .zero, size: size))
                let text = "BananaTape Mock"
                text.draw(at: CGPoint(x: 32, y: 32), withAttributes: [.foregroundColor: UIColor.white, .font: UIFont.systemFont(ofSize: 28, weight: .semibold)])
            }
        }
        guard let data, case .success(let asset) = storage.saveGeneratedImage(projectID: projectID, assetID: result.assetId, mimeType: .png, data: data) else { return nil }
        return ProviderImageResult(requestId: result.requestId, imageURL: asset.fileURL.absoluteString, assetId: result.assetId, assetPath: asset.projectRelativePath, size: result.size, createdAt: result.createdAt, timestamp: result.timestamp)
    }
}

private struct ProjectListScreen: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    let projects: [ProjectListDisplayItem]
    let isEmpty: Bool
    let onOpenProject: (String) -> Void
    let onProjectMenu: (String) -> Void
    let onCreateProject: () -> Void
    let onImport: () -> Void

    var body: some View {
        ZStack(alignment: .bottom) {
            TossStyle.workspace.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    header

                    LazyVStack(spacing: 8) {
                        ForEach(projects) { project in
                            projectCard(project)
                        }
                    }
                    .accessibilityIdentifier("projectList")

                    if isEmpty {
                        emptyHint
                    }

                    Text("Stored privately on this device")
                        .font(.caption2.weight(.bold))
                        .tracking(1.1)
                        .foregroundStyle(TossStyle.mutedText)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 8)
                        .accessibilityIdentifier("projectPrivacyNote")

                    Spacer(minLength: 112)
                }
                .frame(maxWidth: isRegularWidth ? 520 : .infinity, alignment: .topLeading)
                .padding(.horizontal, 16)
                .padding(.top, 18)
                .frame(maxWidth: .infinity)
            }

            bottomCTA
        }
        .toolbar(.hidden, for: .navigationBar)
        .accessibilityIdentifier("projectListRoot")
    }

    private var isRegularWidth: Bool {
        horizontalSizeClass == .regular
    }

    private var header: some View {
        HStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Local Projects")
                    .font(.caption2.weight(.bold))
                    .tracking(1.2)
                    .textCase(.uppercase)
                    .foregroundStyle(TossStyle.mutedText)
                Text("BananaTape")
                    .font(.system(size: 40, weight: .regular, design: .default))
                    .tracking(-1.6)
                    .foregroundStyle(TossStyle.primaryText)
                    .accessibilityIdentifier("bananaTapeTitle")
            }
            Spacer()
            Image(systemName: "slider.horizontal.3")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(TossStyle.secondaryText)
                .frame(width: 38, height: 38)
                .background(TossStyle.panel, in: Circle())
                .overlay(Circle().stroke(TossStyle.border))
        }
        .padding(.horizontal, 4)
        .padding(.top, 10)
    }

    private func projectCard(_ project: ProjectListDisplayItem) -> some View {
        HStack(spacing: 14) {
            RoundedRectangle(cornerRadius: 14)
                .fill(TossStyle.imageShell)
                .overlay(Image(systemName: project.symbolName).font(.title3.weight(.semibold)).foregroundStyle(TossStyle.blue))
                .frame(width: 60, height: 60)

            VStack(alignment: .leading, spacing: 5) {
                Text(project.name)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(TossStyle.primaryText)
                    .lineLimit(1)
                Text(project.metadata)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(TossStyle.secondaryText)
                    .lineLimit(1)
            }

            Spacer()

            Button {
                onProjectMenu(project.id)
            } label: {
                Image(systemName: "ellipsis")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(TossStyle.secondaryText)
                    .frame(width: 32, height: 32)
                    .background(TossStyle.panelAlt, in: Circle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("projectActionButton-\(project.id)")
        }
        .padding(12)
        .background(TossStyle.panel, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(TossStyle.border))
        .contentShape(Rectangle())
        .onTapGesture { onOpenProject(project.id) }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("openProjectButton-\(project.id)")
    }

    private var emptyHint: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("No projects yet")
                .font(.headline.weight(.semibold))
                .foregroundStyle(TossStyle.primaryText)
                .accessibilityIdentifier("emptyProjectListTitle")
            Text("Create a local project stored privately on this device.")
                .font(.footnote)
                .foregroundStyle(TossStyle.secondaryText)
                .accessibilityIdentifier("emptyProjectListMessage")
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(TossStyle.panel, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(TossStyle.border))
    }

    private var bottomCTA: some View {
        HStack(spacing: 10) {
            Button("New Project") { onCreateProject() }
                .buttonStyle(TossCompactButtonStyle())
                .accessibilityIdentifier("createProjectButton")

            Button("Import") { onImport() }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(TossStyle.primaryText)
                .frame(maxWidth: .infinity)
                .frame(height: 52)
                .background(TossStyle.workspace, in: RoundedRectangle(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(TossStyle.border))
                .accessibilityIdentifier("importProjectButton")
        }
        .padding(10)
        .background(TossStyle.panel, in: RoundedRectangle(cornerRadius: 22))
        .overlay(RoundedRectangle(cornerRadius: 22).stroke(TossStyle.border))
        .padding(.horizontal, 16)
        .padding(.bottom, 12)
        .frame(maxWidth: isRegularWidth ? 520 : .infinity)
    }
}

private struct NewProjectSheet: View {
    @Binding var projectName: String
    let onCancel: () -> Void
    let onCreate: () -> Void
    @FocusState private var isNameFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Create a project")
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(TossStyle.primaryText)
                Text("Your project stays in BananaTape's local folder on this device.")
                    .font(.footnote)
                    .foregroundStyle(TossStyle.secondaryText)
                    .fixedSize(horizontal: false, vertical: true)
            }

            TextField(
                "Project name",
                text: $projectName,
                prompt: Text("Project name").foregroundStyle(TossStyle.secondaryText)
            )
                .textFieldStyle(.plain)
                .font(.body.weight(.medium))
                .foregroundStyle(TossStyle.primaryText)
                .tint(TossStyle.blue)
                .textInputAutocapitalization(.words)
                .submitLabel(.done)
                .focused($isNameFocused)
                .onSubmit(onCreate)
                .padding(.horizontal, 14)
                .frame(height: 50)
                .background(TossStyle.workspace, in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(isNameFocused ? TossStyle.blue : TossStyle.border, lineWidth: isNameFocused ? 2 : 1))

            HStack(spacing: 10) {
                Button("Cancel", role: .cancel, action: onCancel)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(TossStyle.primaryText)
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(TossStyle.panelAlt, in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(TossStyle.border))
                    .accessibilityIdentifier("cancelCreateProjectButton")

                Button("Create", action: onCreate)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(TossStyle.primaryButtonText)
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(TossStyle.blue, in: RoundedRectangle(cornerRadius: 12))
                    .accessibilityIdentifier("confirmCreateProjectButton")
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 20)
        .padding(.top, 20)
        .padding(.bottom, 16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(TossStyle.panel)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("newProjectSurface")
        .onAppear {
            DispatchQueue.main.async {
                isNameFocused = true
            }
        }
    }
}

private struct EditorScreen: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    let projectName: String
    @Binding var composerState: ComposerState
    @Binding var historyState: NativeHistoryBrowserState
    @Binding var canvasTool: CanvasTool
    let canvasState: NativeCanvasState
    @Binding var apiKey: String
    let isSubmitting: Bool
    let statusMessage: String?
    let onGenerate: () -> Void
    let onShowComposer: () -> Void
    let onShowHistory: () -> Void
    let onShowActions: () -> Void
    let onExport: () -> Void
    let onAnnotationsChange: (CanvasAnnotations) -> Void
    let onViewportChange: (CanvasViewport) -> Void
    let canUndo: Bool
    let canRedo: Bool
    let onUndo: () -> Void
    let onRedo: () -> Void
    let lineageAvailability: LineageNavigationAvailability
    let onMoveFocus: (LineageNavigationDirection) -> Void
    let onDeleteHistory: (String) -> Void

    var body: some View {
        ZStack {
            TossStyle.workspace.ignoresSafeArea()

            VStack(spacing: 0) {
                topBar
                annotationToolbar
                ZStack(alignment: .bottom) {
                    NativeCanvasView(state: canvasState, onAnnotationsChange: onAnnotationsChange, onViewportChange: onViewportChange, onMoveFocus: onMoveFocus)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .frame(maxWidth: isRegularWidth ? 600 : .infinity)
                        .padding(.horizontal, isRegularWidth ? 88 : 22)
                        .padding(.top, isRegularWidth ? 28 : 12)
                        .padding(.bottom, 138)

                    LineageNavigationControls(availability: lineageAvailability, onMoveFocus: onMoveFocus)

                    if isRegularWidth {
                        HStack {
                            Spacer()
                            HistoryBrowserView(state: $historyState, onExport: { _ in onExport() }, onDelete: onDeleteHistory)
                                .frame(width: 300)
                                .frame(maxHeight: 430)
                                .clipShape(RoundedRectangle(cornerRadius: 24))
                                .overlay(RoundedRectangle(cornerRadius: 24).stroke(TossStyle.border))
                                .padding(.trailing, 24)
                                .padding(.bottom, 150)
                        }
                    }

                    versionPill
                        .padding(.bottom, 112)

                    compactComposer
                        .padding(.horizontal, 16)
                        .padding(.bottom, 12)
                        .frame(maxWidth: isRegularWidth ? 560 : .infinity)
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("editorScreen")
    }

    private var isRegularWidth: Bool {
        horizontalSizeClass == .regular
    }

    private var topBar: some View {
        HStack(spacing: 10) {
            circleButton("chevron.left", label: "Back") { dismiss() }
            VStack(alignment: .leading, spacing: 3) {
                Text(projectName)
                    .font(.headline.weight(.semibold))
                    .foregroundStyle(TossStyle.primaryText)
                    .lineLimit(1)
                HStack(spacing: 5) {
                    Circle()
                        .fill(apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && composerState.selectedProvider == .openAI ? TossStyle.destructive : TossStyle.rootBadgeText)
                        .frame(width: 6, height: 6)
                    Text(providerStatus)
                        .font(.caption2.weight(.bold))
                        .tracking(0.8)
                        .foregroundStyle(TossStyle.mutedText)
                }
            }
            Spacer()
            circleButton("square.and.arrow.up", label: "Export") { onExport() }
            circleButton("ellipsis", label: "Project actions", identifier: "projectActionsButton") { onShowActions() }
        }
        .padding(.horizontal, 16)
        .padding(.top, 10)
        .padding(.bottom, 10)
        .background(TossStyle.workspace.opacity(0.94))
    }

    private var providerStatus: String {
        if composerState.selectedProvider == .openAI && apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return "OPENAI · NO KEY"
        }
        return "\(composerState.providerDisplayName.uppercased()) · READY"
    }

    private var annotationToolbar: some View {
        HStack(spacing: 4) {
            toolButton(.pan, systemName: "hand.draw")
            toolButton(.select, systemName: "cursorarrow")
            toolButton(.pen, systemName: "pencil.tip")
            toolButton(.box, systemName: "square")
            toolButton(.arrow, systemName: "arrow.up.right")
            toolButton(.memo, systemName: "note.text")
            toolbarDivider
            toolbarUtilityButton("arrow.uturn.backward", label: "Undo", isEnabled: canUndo, action: onUndo)
            toolbarUtilityButton("arrow.uturn.forward", label: "Redo", isEnabled: canRedo, action: onRedo)
        }
        .padding(8)
        .frame(maxWidth: isRegularWidth ? 420 : .infinity)
        .background(TossStyle.panel, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(TossStyle.border))
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("annotationToolbar")
    }

    private func toolButton(_ tool: CanvasTool, systemName: String) -> some View {
        Button {
            canvasTool = tool
        } label: {
            Image(systemName: systemName)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(canvasTool == tool ? TossStyle.primaryButtonText : TossStyle.secondaryText)
                .frame(width: 36, height: 36)
                .background(canvasTool == tool ? TossStyle.blue : TossStyle.panelAlt, in: Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(tool == .select ? "Navigate lineage" : tool.rawValue.capitalized)
        .accessibilityAddTraits(canvasTool == tool ? .isSelected : [])
    }

    private func toolbarUtilityButton(_ systemName: String, label: String, isEnabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(isEnabled ? TossStyle.secondaryText : TossStyle.mutedText.opacity(0.45))
                .frame(width: 36, height: 36)
                .background(TossStyle.panelAlt, in: Circle())
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
        .accessibilityLabel(label)
    }

    private var toolbarDivider: some View {
        Rectangle()
            .fill(TossStyle.separator)
            .frame(width: 1, height: 26)
            .padding(.horizontal, 1)
    }

    private var versionPill: some View {
        Button { onShowHistory() } label: {
            Text(EditorVersionPillLabel.text(historyState: historyState, imageSize: canvasState.image.size))
                .font(.caption.weight(.bold))
                .foregroundStyle(TossStyle.secondaryText)
                .padding(.horizontal, 13)
                .padding(.vertical, 8)
                .background(TossStyle.panel.opacity(0.92), in: Capsule())
                .overlay(Capsule().stroke(TossStyle.border))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("historyVersionPill")
    }

    private var compactComposer: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 4) {
                Text(composerState.trimmedPrompt.isEmpty ? "Describe an image..." : composerState.trimmedPrompt)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(composerState.trimmedPrompt.isEmpty ? TossStyle.placeholderText : TossStyle.primaryText)
                    .lineLimit(1)
                Text("\(composerState.providerDisplayName) · \(shortOutputSize)")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(TossStyle.mutedText)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
            .onTapGesture { onShowComposer() }

            Button { onShowComposer() } label: {
                Image(systemName: "arrow.up.left.and.arrow.down.right")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(TossStyle.secondaryText)
                    .frame(width: 34, height: 34)
                    .background(TossStyle.panelAlt, in: Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Expand composer")

            Button(isSubmitting ? "Submitting" : composerState.primaryActionLabel) { onGenerate() }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(TossStyle.primaryButtonText)
                .frame(width: 97, height: 40)
                .background(TossStyle.blue, in: RoundedRectangle(cornerRadius: 14))
                .disabled(!composerState.canSubmitPrimaryAction || isSubmitting)
                .accessibilityIdentifier("compactGenerateButton")
        }
        .padding(12)
        .background(TossStyle.panel, in: RoundedRectangle(cornerRadius: 22))
        .overlay(RoundedRectangle(cornerRadius: 22).stroke(TossStyle.border))
        .shadow(color: .black.opacity(0.28), radius: 22, y: 12)
        .accessibilityIdentifier("compactComposer")
    }

    private var shortOutputSize: String {
        switch composerState.outputSize {
        case .square: "Square"
        case .portrait: "Portrait"
        case .landscape: "Landscape"
        }
    }

    private func circleButton(_ systemName: String, label: String, identifier: String? = nil, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(TossStyle.primaryText)
                .frame(width: 36, height: 36)
                .background(TossStyle.panel, in: Circle())
                .overlay(Circle().stroke(TossStyle.border))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityIdentifier(identifier ?? label)
    }
}

private struct ProjectSettingsView: View {
    @State private var draftName: String
    @Binding var systemPrompt: String
    let localPath: String
    let onSave: (String) -> Void
    let onManageReferences: () -> Void

    init(projectName: String, systemPrompt: Binding<String>, localPath: String, onSave: @escaping (String) -> Void, onManageReferences: @escaping () -> Void) {
        _draftName = State(initialValue: projectName)
        _systemPrompt = systemPrompt
        self.localPath = localPath
        self.onSave = onSave
        self.onManageReferences = onManageReferences
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Project settings")
                .font(.title3.weight(.semibold))
                .foregroundStyle(TossStyle.primaryText)
            fieldLabel("Name")
            TextField("Project name", text: $draftName)
                .textFieldStyle(.plain)
                .padding(12)
                .background(TossStyle.workspace, in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(TossStyle.border))
            fieldLabel("System prompt")
            TextEditor(text: $systemPrompt)
                .scrollContentBackground(.hidden)
                .frame(minHeight: 110)
                .padding(8)
                .background(TossStyle.workspace, in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(TossStyle.border))
            Button("Manage references", action: onManageReferences)
                .buttonStyle(TossCompactButtonStyle())
            fieldLabel("Local folder")
            Text(localPath)
                .font(.caption.monospaced())
                .foregroundStyle(TossStyle.secondaryText)
                .textSelection(.enabled)
            Button("Save") { onSave(draftName) }
                .buttonStyle(TossCompactButtonStyle())
                .disabled(draftName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
        .padding(16)
    }

    private func fieldLabel(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.caption2.weight(.bold))
            .tracking(0.8)
            .foregroundStyle(TossStyle.mutedText)
    }
}

private struct ProviderSettingsView: View {
    @Binding var apiKey: String
    let onSave: () -> Void
    let onRemove: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("OpenAI provider")
                .font(.title3.weight(.semibold))
                .foregroundStyle(TossStyle.primaryText)
            SecureField("API key", text: $apiKey)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .padding(12)
                .background(TossStyle.workspace, in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(TossStyle.border))
            Text(apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "No API key saved" : "Key ends in \(apiKey.suffix(4))")
                .font(.caption.weight(.medium))
                .foregroundStyle(TossStyle.secondaryText)
            HStack(spacing: 10) {
                Button("Save key", action: onSave)
                    .buttonStyle(TossCompactButtonStyle())
                Button("Remove", role: .destructive, action: onRemove)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(TossStyle.destructive)
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
                    .background(TossStyle.workspace, in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(TossStyle.border))
            }
        }
        .padding(16)
    }
}

private struct SheetScaffold<Content: View>: View {
    let detents: Set<PresentationDetent>
    @ViewBuilder let content: Content

    var body: some View {
        VStack(spacing: 0) {
            Capsule()
                .fill(TossStyle.separator)
                .frame(width: 42, height: 5)
                .padding(.top, 10)
                .padding(.bottom, 4)
            ScrollView {
                content
            }
        }
        .background(TossStyle.panel)
        .presentationDetents(detents)
        .presentationDragIndicator(.hidden)
        .presentationBackground(TossStyle.panel)
    }
}

private struct ActionMenuSheet: View {
    let referenceCount: Int
    let onHistory: () -> Void
    let onReferences: () -> Void
    let onProjectSettings: () -> Void
    let onProviderSettings: () -> Void
    let onDelete: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            Capsule()
                .fill(TossStyle.separator)
                .frame(width: 42, height: 5)
                .padding(.top, 10)
                .padding(.bottom, 14)

            menuRow(icon: "clock.arrow.circlepath", label: "History", trailing: nil, action: onHistory)
            menuRow(icon: "photo.on.rectangle", label: "Reference images", trailing: "\(referenceCount) references", action: onReferences)
            menuRow(icon: "slider.horizontal.3", label: "Project settings", trailing: nil, action: onProjectSettings)
            menuRow(icon: "key", label: "Provider settings", trailing: nil, action: onProviderSettings)

            Rectangle()
                .fill(TossStyle.separator)
                .frame(height: 1)
                .padding(.vertical, 8)

            menuRow(icon: "trash", label: "Delete project", trailing: nil, role: .destructive, action: onDelete)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 16)
        .background(TossStyle.panel)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("projectActionMenu")
    }

    private func menuRow(icon: String, label: String, trailing: String?, role: ButtonRole? = nil, action: @escaping () -> Void) -> some View {
        Button(role: role, action: action) {
            HStack(spacing: 14) {
                Image(systemName: icon)
                    .font(.body.weight(.semibold))
                    .frame(width: 22)
                Text(label)
                    .font(.body.weight(.medium))
                Spacer()
                if let trailing {
                    Text(trailing)
                        .font(.footnote.weight(.medium))
                        .foregroundStyle(TossStyle.mutedText)
                }
            }
            .foregroundStyle(role == .destructive ? TossStyle.destructive : TossStyle.primaryText)
            .padding(.vertical, 14)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityValue(trailing ?? "")
    }
}

private struct ReferenceImagesSheet: View {
    @Binding var references: [ComposerReferenceSummary]
    let onImportReferenceData: (Data, String) -> Result<ComposerReferenceSummary, AdapterError>
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var errorMessage: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Reference images")
                .font(.title3.weight(.semibold))
                .foregroundStyle(TossStyle.primaryText)

            Text("\(references.count) reference\(references.count == 1 ? "" : "s")")
                .font(.caption.weight(.semibold))
                .foregroundStyle(TossStyle.mutedText)

            if let errorMessage {
                Text(errorMessage)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(TossStyle.destructive)
            }

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 3), spacing: 10) {
                PhotosPicker(selection: $selectedPhoto, matching: .images) {
                    AddReferenceTile()
                }
                .accessibilityIdentifier("referenceImagesAddButton")

                ForEach(references) { reference in
                    referenceTile(reference)
                }
            }
            .frame(maxWidth: .infinity)
            .onChange(of: selectedPhoto) { _, item in
                guard let item else { return }
                errorMessage = nil
                Task { await importSelectedPhoto(item) }
            }

            Spacer(minLength: 12)
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 18)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("referenceImagesSheet")
    }

    private func referenceTile(_ reference: ComposerReferenceSummary) -> some View {
        ZStack(alignment: .topTrailing) {
            RoundedRectangle(cornerRadius: 12)
                .fill(TossStyle.imageShell)
                .overlay(Image(systemName: "photo").font(.caption.weight(.bold)).foregroundStyle(TossStyle.blue))
                .aspectRatio(1, contentMode: .fit)

            Text(reference.label)
                .font(.caption2.weight(.bold))
                .foregroundStyle(TossStyle.primaryText)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 8)
                .padding(.vertical, 6)
                .background(TossStyle.panel.opacity(0.88))
                .frame(maxHeight: .infinity, alignment: .bottom)

            Button {
                errorMessage = nil
                references.removeAll { $0.id == reference.id }
            } label: {
                Image(systemName: "xmark")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(TossStyle.secondaryText)
                    .frame(width: 28, height: 28)
                    .background(TossStyle.workspace, in: Circle())
                    .overlay(Circle().stroke(TossStyle.border))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("removeReference-\(reference.id)")
            .padding(6)
        }
        .aspectRatio(1, contentMode: .fit)
        .background(TossStyle.panelAlt, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(TossStyle.border))
    }

    @MainActor
    private func importSelectedPhoto(_ item: PhotosPickerItem) async {
        defer { selectedPhoto = nil }
        do {
            guard let data = try await item.loadTransferable(type: Data.self) else {
                errorMessage = AdapterError.unsupportedFileType(.webp).userMessage
                return
            }
            switch onImportReferenceData(data, item.itemIdentifier ?? "reference.png") {
            case .success(let reference):
                references.append(reference)
            case .failure(let error):
                errorMessage = error.userMessage
            }
        } catch {
            errorMessage = AdapterError.unsupportedFileType(.webp).userMessage
        }
    }
}

private struct AddReferenceTile: View {
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 14)
                .fill(TossStyle.panelAlt)
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(TossStyle.border))
            Image(systemName: "plus")
                .font(.headline.weight(.semibold))
                .foregroundStyle(TossStyle.secondaryText)
        }
        .aspectRatio(1, contentMode: .fit)
        .accessibilityLabel("Add reference")
    }
}

private extension ImageMimeType {
    static func detected(from data: Data) -> ImageMimeType? {
        if data.starts(with: [0x89, 0x50, 0x4E, 0x47]) { return .png }
        if data.starts(with: [0xFF, 0xD8]) { return .jpeg }
        return nil
    }
}

#Preview {
    ProjectListView(state: .empty)
}

private func minimalManifest(id: String, name: String) -> String {
    """
    {
      "schemaVersion": 1,
      "id": "\(id)",
      "name": "\(name)",
      "createdAt": "1970-01-01T00:00:00.000Z",
      "updatedAt": "1970-01-01T00:00:00.000Z"
    }
    """
}

private func projectManifestJSON(id: String, name: String) -> String {
    let timestamp = Date().ISO8601Format()
    let manifest: [String: Any] = [
        "schemaVersion": 1,
        "id": id,
        "name": name,
        "createdAt": timestamp,
        "updatedAt": timestamp,
        "settings": ["systemPrompt": "", "referenceImages": []]
    ]
    guard let data = try? JSONSerialization.data(withJSONObject: manifest, options: [.prettyPrinted, .sortedKeys]) else {
        return minimalManifest(id: id, name: name)
    }
    return String(data: data, encoding: .utf8) ?? minimalManifest(id: id, name: name)
}

private let minimalHistory = """
{
  "schemaVersion": 1,
  "revision": 0,
  "entries": []
}
"""

extension NativeHistoryBrowserState {
    static let fixtureRootWithEditChild = NativeHistoryBrowserState(entries: [
        HistoryEntry(
            id: "hist-root-generation",
            mode: .generate,
            provider: .openAI,
            prompt: "Root banana sticker on dark canvas",
            assetId: "asset-root",
            assetPath: "assets/root-banana.png",
            parentId: nil,
            generationBatchId: nil,
            batchIndex: nil,
            createdAt: "1970-01-01T00:00:00.000Z",
            timestamp: 1
        ),
        HistoryEntry(
            id: "hist-edit-child",
            mode: .edit,
            provider: .openAI,
            prompt: "Edit child with brighter tape edge",
            assetId: "asset-child",
            assetPath: "assets/edit-child.png",
            parentId: "hist-root-generation",
            generationBatchId: nil,
            batchIndex: nil,
            createdAt: "1970-01-01T00:01:00.000Z",
            timestamp: 2
        )
    ])

    static let prototypeKoiHistory = NativeHistoryBrowserState(entries: [
        HistoryEntry(id: "hist-koi-1", mode: .generate, provider: .openAI, prompt: "koi fish, neon, dark water", assetId: "asset-koi-1", assetPath: "assets/koi-1.png", parentId: nil, createdAt: "1970-01-01T00:00:00.000Z", timestamp: 1),
        HistoryEntry(id: "hist-koi-2", mode: .generate, provider: .openAI, prompt: "koi school, bioluminescent", assetId: "asset-koi-2", assetPath: "assets/koi-2.png", parentId: nil, createdAt: "1970-01-01T00:01:00.000Z", timestamp: 2),
        HistoryEntry(id: "hist-koi-3", mode: .edit, provider: .openAI, prompt: "add ripples around the fins", assetId: "asset-koi-3", assetPath: "assets/koi-3.png", parentId: "hist-koi-2", createdAt: "1970-01-01T00:02:00.000Z", timestamp: 3),
        HistoryEntry(id: "hist-koi-4", mode: .edit, provider: .openAI, prompt: "warmer glow, higher contrast", assetId: "asset-koi-4", assetPath: "assets/koi-4.png", parentId: "hist-koi-3", createdAt: "1970-01-01T00:03:00.000Z", timestamp: 4),
        HistoryEntry(id: "hist-koi-5", mode: .generate, provider: .mock, prompt: "single koi, minimal negative space", assetId: "asset-koi-5", assetPath: "assets/koi-5.png", parentId: nil, createdAt: "1970-01-01T00:04:00.000Z", timestamp: 5)
    ], selectedEntryId: "hist-koi-5")
}
