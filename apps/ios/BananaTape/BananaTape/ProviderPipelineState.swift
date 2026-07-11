import Foundation

enum HistoryDeletionCoordinator {
    static func deleting(entryID: String, from state: ProviderPipelineState) -> ProviderPipelineState {
        state.reconcilingHistory(state.historyBrowserState.deleting(entryId: entryID))
    }
}

struct ProviderPipelineState: Equatable {
    enum LifecyclePhase: Equatable {
        case foreground
        case background
    }

    let images: [CanvasImage]
    let history: [HistoryEntry]
    let focusedImageId: String?
    let activeRequestId: String?
    let activeParentHistoryId: String?
    let userErrorMessage: String?
    let lifecyclePhase: LifecyclePhase

    init(images: [CanvasImage] = [], history: [HistoryEntry] = [], focusedImageId: String? = nil, activeRequestId: String? = nil, activeParentHistoryId: String? = nil, userErrorMessage: String? = nil, lifecyclePhase: LifecyclePhase = .foreground) {
        self.images = images
        self.history = history
        self.focusedImageId = images.first(where: { $0.id == focusedImageId && $0.status == .ready })?.id
            ?? images.last(where: { $0.status == .ready })?.id
        self.activeRequestId = activeRequestId
        self.activeParentHistoryId = activeParentHistoryId
        self.userErrorMessage = userErrorMessage
        self.lifecyclePhase = lifecyclePhase
    }

    var pendingImages: [CanvasImage] { images.filter { $0.status == .pending } }
    var readyImages: [CanvasImage] { images.filter { $0.status == .ready } }
    var focusedImage: CanvasImage? { images.first { $0.id == focusedImageId } }
    var focusedHistoryEntryId: String? {
        guard let focusedImage else { return nil }
        return history.last(where: { $0.id == focusedImage.id || $0.assetId == focusedImage.assetId })?.id
    }
    var historyBrowserState: NativeHistoryBrowserState { NativeHistoryBrowserState(entries: history, selectedEntryId: focusedHistoryEntryId) }
    var lineageAvailability: LineageNavigationAvailability { LineageNavigation.availability(images: images, focusedImageID: focusedImageId) }

    func movingFocus(_ direction: LineageNavigationDirection) -> ProviderPipelineState {
        guard let target = LineageNavigation.target(direction, images: images, focusedImageID: focusedImageId) else { return self }
        return focusing(imageId: target.id)
    }

    func focusing(imageId: String) -> ProviderPipelineState {
        guard images.contains(where: { $0.id == imageId && $0.status == .ready }) else { return self }
        return ProviderPipelineState(images: images, history: history, focusedImageId: imageId, activeRequestId: activeRequestId, activeParentHistoryId: activeParentHistoryId, userErrorMessage: userErrorMessage, lifecyclePhase: lifecyclePhase)
    }

    func replacingFocusedAnnotations(_ annotations: CanvasAnnotations) -> ProviderPipelineState {
        guard let focusedImageId else { return self }
        let nextImages = images.map { image in
            guard image.id == focusedImageId else { return image }
            return CanvasImage(id: image.id, url: image.url, assetId: image.assetId, size: image.size, position: image.position, parentId: image.parentId, generationIndex: image.generationIndex, generationBatchId: image.generationBatchId, batchIndex: image.batchIndex, prompt: image.prompt, provider: image.provider, mode: image.mode, createdAt: image.createdAt, annotations: annotations, hasMagicLayerFields: image.hasMagicLayerFields, status: image.status, userErrorMessage: image.userErrorMessage)
        }
        return ProviderPipelineState(images: nextImages, history: history, focusedImageId: focusedImageId, activeRequestId: activeRequestId, activeParentHistoryId: activeParentHistoryId, userErrorMessage: userErrorMessage, lifecyclePhase: lifecyclePhase)
    }

    func reconcilingHistory(_ browserState: NativeHistoryBrowserState) -> ProviderPipelineState {
        let browserState = browserState.reconcilingLineage()
        let retainedImages = images.filter { image in
            browserState.entries.contains { $0.id == image.id || $0.assetId == image.assetId }
        }
        let selectedImageId = browserState.selectedEntry.flatMap { selectedEntry in
            retainedImages.first { $0.id == selectedEntry.id || $0.assetId == selectedEntry.assetId }?.id
        }
        return ProviderPipelineState(images: retainedImages, history: browserState.entries, focusedImageId: selectedImageId, userErrorMessage: userErrorMessage, lifecyclePhase: lifecyclePhase)
    }

    func startingSubmission(mode: EditorMode, prompt: String, annotations: CanvasAnnotations, requestId: String, network: NetworkReachability, provider: EditorProvider = .mock) -> ProviderPipelineState {
        switch mode {
        case .edit:
            return startingEdit(prompt: prompt, annotations: annotations, requestId: requestId, network: network, provider: provider)
        case .generate:
            return startingGenerate(prompt: prompt, requestId: requestId, network: network, provider: provider)
        }
    }

    func startingGenerate(prompt: String, requestId: String, network: NetworkReachability, provider: EditorProvider = .mock) -> ProviderPipelineState {
        guard network == .online else { return withError(AdapterError.offline.userMessage) }
        let placeholder = placeholderImage(id: pendingImageId(for: requestId), requestId: requestId, prompt: prompt, provider: provider, mode: .generate, parentId: nil, generationIndex: images.count, generationBatchId: requestId, batchIndex: 0)
        return ProviderPipelineState(images: images + [placeholder], history: history, focusedImageId: focusedImageId, activeRequestId: requestId)
    }

    func startingEdit(prompt: String, annotations: CanvasAnnotations, requestId: String, network: NetworkReachability, provider: EditorProvider = .mock) -> ProviderPipelineState {
        guard network == .online else { return withError(AdapterError.offline.userMessage) }
        guard let parentImage = focusedReadyImage, let parentHistory = history.last(where: { $0.id == parentImage.id || $0.assetId == parentImage.assetId }) else { return withError("Select an image before editing.") }
        let placeholder = placeholderImage(id: pendingImageId(for: requestId), requestId: requestId, prompt: prompt, provider: provider, mode: .edit, parentId: parentImage.id, generationIndex: images.count, generationBatchId: requestId, batchIndex: 0, annotations: annotations)
        return ProviderPipelineState(images: images + [placeholder], history: history, focusedImageId: focusedImageId, activeRequestId: requestId, activeParentHistoryId: parentHistory.id)
    }

    func applying(_ result: ProviderImageResult) -> ProviderPipelineState {
        guard activeRequestId == result.requestId, let pending = images.first(where: { $0.id == pendingImageId(for: result.requestId) && $0.status == .pending }) else { return self }
        let ready = pending.ready(result)
        let entry = HistoryEntry(id: ready.id, mode: ready.mode, provider: ready.provider, prompt: ready.prompt, assetId: result.assetId, assetPath: result.assetPath, parentId: ready.mode == .edit ? activeParentHistoryId : nil, generationBatchId: ready.generationBatchId, batchIndex: ready.batchIndex, createdAt: result.createdAt, timestamp: result.timestamp)
        return ProviderPipelineState(images: images.map { $0.id == pending.id ? ready : $0 }, history: history + [entry], focusedImageId: ready.id, lifecyclePhase: lifecyclePhase)
    }

    func failing(requestId: String, message: String) -> ProviderPipelineState {
        guard activeRequestId == requestId else { return self }
        let nextImages = images.filter { !($0.id == pendingImageId(for: requestId) && $0.status == .pending) }
        let nextFocus = nextImages.contains(where: { $0.id == focusedImageId && $0.status == .ready }) ? focusedImageId : nextImages.last(where: { $0.status == .ready })?.id
        return ProviderPipelineState(images: nextImages, history: history, focusedImageId: nextFocus, userErrorMessage: message)
    }

    func canceling(requestId: String) -> ProviderPipelineState {
        guard activeRequestId == requestId else { return self }
        let nextImages = images.filter { !($0.id == pendingImageId(for: requestId) && $0.status == .pending) }
        let nextFocus = nextImages.contains(where: { $0.id == focusedImageId && $0.status == .ready }) ? focusedImageId : nextImages.last(where: { $0.status == .ready })?.id
        return ProviderPipelineState(images: nextImages, history: history, focusedImageId: nextFocus, lifecyclePhase: lifecyclePhase)
    }

    func movingToBackground() -> ProviderPipelineState {
        guard let activeRequestId else {
            return ProviderPipelineState(images: images, history: history, focusedImageId: focusedImageId, userErrorMessage: userErrorMessage, lifecyclePhase: .background)
        }
        let canceled = canceling(requestId: activeRequestId)
        return ProviderPipelineState(images: canceled.images, history: canceled.history, focusedImageId: canceled.focusedImageId, userErrorMessage: canceled.userErrorMessage, lifecyclePhase: .background)
    }

    func returningToForeground(network: NetworkReachability) -> ProviderPipelineState {
        ProviderPipelineState(images: images, history: history, focusedImageId: focusedImageId, userErrorMessage: network == .offline ? AdapterError.offline.userMessage : userErrorMessage, lifecyclePhase: .foreground)
    }

    func requestForActivePrompt(outputSize: OutputSize = .square, references: [ComposerReferenceSummary] = [], inputImageURL: URL? = nil, maskImageURL: URL? = nil) -> ProviderRequest? {
        guard let activeRequestId, let pending = images.first(where: { $0.id == pendingImageId(for: activeRequestId) }) else { return nil }
        return ProviderRequest(
            id: activeRequestId,
            prompt: pending.prompt,
            provider: pending.provider,
            mode: pending.mode,
            outputSize: outputSize,
            parentImageId: pending.parentId,
            parentHistoryId: activeParentHistoryId,
            annotations: pending.annotations,
            references: references.map { ProviderReferenceImage(id: $0.id, assetPath: $0.assetPath) },
            inputImageURL: inputImageURL,
            maskImageURL: maskImageURL
        )
    }

    private var focusedReadyImage: CanvasImage? {
        guard let focusedImageId else { return nil }
        return images.first { $0.id == focusedImageId && $0.status == .ready }
    }

    private func pendingImageId(for requestId: String) -> String { "pending-\(requestId)" }
    private func withError(_ message: String) -> ProviderPipelineState { ProviderPipelineState(images: images, history: history, focusedImageId: focusedImageId, activeRequestId: activeRequestId, activeParentHistoryId: activeParentHistoryId, userErrorMessage: message, lifecyclePhase: lifecyclePhase) }
    private func placeholderImage(id: String, requestId: String, prompt: String, provider: EditorProvider, mode: EditorMode, parentId: String?, generationIndex: Int, generationBatchId: String?, batchIndex: Int?, annotations: CanvasAnnotations = .empty) -> CanvasImage {
        CanvasImage(id: id, url: "mock://pending/\(requestId)", assetId: nil, size: EditorSize(width: 1024, height: 1024), position: EditorPoint(x: 0, y: 0), parentId: parentId, generationIndex: generationIndex, generationBatchId: generationBatchId, batchIndex: batchIndex, prompt: prompt, provider: provider, mode: mode, createdAt: Double(generationIndex), annotations: annotations, hasMagicLayerFields: false, status: .pending, userErrorMessage: nil)
    }
}

private extension CanvasImage {
    func ready(_ result: ProviderImageResult) -> CanvasImage {
        CanvasImage(id: id, url: result.imageURL, assetId: result.assetId, size: result.size, position: position, parentId: parentId, generationIndex: generationIndex, generationBatchId: generationBatchId, batchIndex: batchIndex, prompt: prompt, provider: provider, mode: mode, createdAt: createdAt, annotations: annotations, hasMagicLayerFields: false, status: .ready, userErrorMessage: nil)
    }
}
