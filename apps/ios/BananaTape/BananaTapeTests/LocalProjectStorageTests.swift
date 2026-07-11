import XCTest
@testable import BananaTape

final class LocalProjectStorageTests: XCTestCase {
    private let manifestJSON = """
    {
      "schemaVersion": 1,
      "id": "mobile-smoke-project",
      "name": "Mobile Smoke Project",
      "createdAt": "2026-07-03T00:00:00.000Z",
      "updatedAt": "2026-07-03T00:00:00.000Z",
      "settings": {
        "systemPrompt": "Keep the banana bright and readable.",
        "referenceImages": []
      }
    }
    """

    private let historyJSON = """
    {
      "schemaVersion": 1,
      "revision": 1,
      "entries": [
        {
          "id": "hist_mobile_smoke_1",
          "type": "generate",
          "provider": "openai",
          "prompt": "A tiny banana sticker on transparent paper.",
          "assetId": "img_mobile_smoke_1",
          "assetPath": "assets/img_mobile_smoke_1.png",
          "thumbnailPath": null,
          "parentId": null,
          "createdAt": "2026-07-03T00:00:01.000Z",
          "timestamp": 1783036801000
        }
      ]
    }
    """

    private let emptyHistoryJSON = """
    {
      "schemaVersion": 1,
      "revision": 0,
      "entries": []
    }
    """

    func testStorage_whenProjectIsCreated_readsListsRestartsAndDeletesProject() throws {
        let rootURL = try makeTemporaryRoot()
        let storage = LocalProjectStorage(rootURL: rootURL)
        let project = MobileProjectRecord(id: "mobile-smoke-project", name: "Mobile Smoke Project", manifestJSON: manifestJSON, historyJSON: emptyHistoryJSON, canvasJSON: nil)

        let created = try storage.create(project).get()
        let listedBeforeRestart = storage.list()
        let readBeforeRestart = try storage.read(id: project.id).get()
        let restartedStorage = LocalProjectStorage(rootURL: rootURL)
        let listedAfterRestart = restartedStorage.list()
        let readAfterRestart = try restartedStorage.read(id: project.id).get()
        let deletion = restartedStorage.delete(id: project.id)

        XCTAssertEqual(created, project)
        XCTAssertEqual(listedBeforeRestart, [MobileProjectSummary(id: "mobile-smoke-project", name: "Mobile Smoke Project")])
        XCTAssertEqual(readBeforeRestart.name, "Mobile Smoke Project")
        XCTAssertTrue(readAfterRestart.historyJSON.contains("\"entries\": []"))
        XCTAssertEqual(listedAfterRestart, [MobileProjectSummary(id: "mobile-smoke-project", name: "Mobile Smoke Project")])
        XCTAssertNoThrow(try deletion.get())
        XCTAssertEqual(restartedStorage.read(id: project.id).failure, .storageNotFound(project.id))
        XCTAssertFalse(FileManager.default.fileExists(atPath: rootURL.appendingPathComponent(project.id).path()))
    }

    func testStorage_whenSmokeFixtureIsCreated_preservesManifestAndHistoryBytes() throws {
        let storage = LocalProjectStorage(rootURL: try makeTemporaryRoot())
        let project = MobileProjectRecord(id: "mobile-smoke-project", name: "Mobile Smoke Project", manifestJSON: manifestJSON, historyJSON: historyJSON, canvasJSON: nil)

        _ = try storage.create(project).get()
        let read = try storage.read(id: project.id).get()

        XCTAssertEqual(read.manifestJSON, manifestJSON)
        XCTAssertEqual(read.historyJSON, historyJSON)
        XCTAssertTrue(read.historyJSON.contains("hist_mobile_smoke_1"))
    }

    func testImport_whenReferenceBananaIsSelected_copiesIntoProjectOwnedReferenceStorage() throws {
        let rootURL = try makeTemporaryRoot()
        let storage = LocalProjectStorage(rootURL: rootURL)
        let project = MobileProjectRecord(id: "mobile-smoke-project", name: "Mobile Smoke Project", manifestJSON: manifestJSON, historyJSON: emptyHistoryJSON, canvasJSON: nil)
        _ = try storage.create(project).get()
        let sourceURL = try fixtureURL("desktop-v1-project-with-references", "references/reference-banana.png")

        let imported = try storage.importProjectImage(ProjectImageImportRequest(
            projectID: project.id,
            assetID: "reference-banana",
            role: .referenceImage,
            mimeType: .png,
            originalFileName: "reference-banana.png",
            sourceURL: sourceURL
        )).get()
        let restartedStorage = LocalProjectStorage(rootURL: rootURL)
        let reloadedProject = try restartedStorage.read(id: project.id).get()

        XCTAssertEqual(imported.projectRelativePath, "references/reference-banana.png")
        XCTAssertEqual(imported.byteCount, 68)
        XCTAssertTrue(FileManager.default.fileExists(atPath: imported.fileURL.path()))
        XCTAssertEqual(try Data(contentsOf: imported.fileURL), try Data(contentsOf: sourceURL))
        XCTAssertFalse(imported.projectRelativePath.contains(sourceURL.path()))
        XCTAssertEqual(reloadedProject.id, project.id)
        XCTAssertTrue(FileManager.default.fileExists(atPath: rootURL.appendingPathComponent(project.id).appendingPathComponent(imported.projectRelativePath).path()))
    }

    func testImport_whenBaseBananaIsSelected_copiesIntoProjectOwnedAssetStorage() throws {
        let rootURL = try makeTemporaryRoot()
        let storage = LocalProjectStorage(rootURL: rootURL)
        let project = MobileProjectRecord(id: "mobile-smoke-project", name: "Mobile Smoke Project", manifestJSON: manifestJSON, historyJSON: emptyHistoryJSON, canvasJSON: nil)
        _ = try storage.create(project).get()
        let sourceURL = try fixtureURL("desktop-v1-project-with-references", "references/reference-banana.png")

        let imported = try storage.importProjectImage(ProjectImageImportRequest(
            projectID: project.id,
            assetID: "base-banana",
            role: .baseImage,
            mimeType: .png,
            originalFileName: "reference-banana.png",
            sourceURL: sourceURL
        )).get()

        XCTAssertEqual(imported.projectRelativePath, "assets/base-banana.png")
        XCTAssertTrue(FileManager.default.fileExists(atPath: rootURL.appendingPathComponent(project.id).appendingPathComponent("assets/base-banana.png").path()))
    }

    func testImport_whenGifOrHeicIsSelected_returnsUnsupportedTypeWithoutCopying() throws {
        let rootURL = try makeTemporaryRoot()
        let storage = LocalProjectStorage(rootURL: rootURL)
        let project = MobileProjectRecord(id: "mobile-smoke-project", name: "Mobile Smoke Project", manifestJSON: manifestJSON, historyJSON: emptyHistoryJSON, canvasJSON: nil)
        _ = try storage.create(project).get()
        let sourceURL = try fixtureURL("desktop-v1-project-with-references", "references/reference-banana.png")

        let gifResult = storage.importProjectImage(ProjectImageImportRequest(projectID: project.id, assetID: "bad-gif", role: .referenceImage, mimeType: .gif, originalFileName: "bad.gif", sourceURL: sourceURL))
        let heicResult = storage.importProjectImage(ProjectImageImportRequest(projectID: project.id, assetID: "bad-heic", role: .referenceImage, mimeType: .heic, originalFileName: "bad.heic", sourceURL: sourceURL))

        XCTAssertEqual(gifResult.failure, .unsupportedFileType(.gif))
        XCTAssertEqual(heicResult.failure, .unsupportedFileType(.heic))
        XCTAssertFalse(FileManager.default.fileExists(atPath: rootURL.appendingPathComponent(project.id).appendingPathComponent("references/bad-gif.png").path()))
        XCTAssertFalse(FileManager.default.fileExists(atPath: rootURL.appendingPathComponent(project.id).appendingPathComponent("references/bad-heic.png").path()))
    }

    func testImport_whenFixtureExceedsBytePolicy_returnsOversizedWithoutCopying() throws {
        let rootURL = try makeTemporaryRoot()
        let storage = LocalProjectStorage(rootURL: rootURL, maxImportedImageBytes: 128)
        let project = MobileProjectRecord(id: "mobile-smoke-project", name: "Mobile Smoke Project", manifestJSON: manifestJSON, historyJSON: emptyHistoryJSON, canvasJSON: nil)
        _ = try storage.create(project).get()
        let sourceURL = try fixtureURL(nil, "large-banana-source.jpg")

        let result = storage.importProjectImage(ProjectImageImportRequest(
            projectID: project.id,
            assetID: "large-banana-source",
            role: .referenceImage,
            mimeType: .jpeg,
            originalFileName: "large-banana-source.jpg",
            sourceURL: sourceURL
        ))

        XCTAssertEqual(result.failure, .oversizedImage(maxBytes: 128, actualBytes: 635))
        XCTAssertFalse(FileManager.default.fileExists(atPath: rootURL.appendingPathComponent(project.id).appendingPathComponent("references/large-banana-source.jpg").path()))
    }

    func testStorage_whenHistoryIsMissing_returnsCorruptProjectWithoutCrashing() throws {
        let rootURL = try makeTemporaryRoot()
        let projectURL = rootURL.appendingPathComponent("corrupt-project-missing-history", isDirectory: true)
        try FileManager.default.createDirectory(at: projectURL, withIntermediateDirectories: true)
        try manifestJSON.write(to: projectURL.appendingPathComponent("project.json"), atomically: true, encoding: .utf8)
        let storage = LocalProjectStorage(rootURL: rootURL)

        let read = storage.read(id: "corrupt-project-missing-history")

        XCTAssertEqual(read.failure, .corruptProject("corrupt-project-missing-history"))
        XCTAssertEqual(storage.list(), [])
    }

    func testStorage_whenJsonIsInvalid_returnsCorruptProjectWithoutCrashing() throws {
        let rootURL = try makeTemporaryRoot()
        let projectURL = rootURL.appendingPathComponent("broken-json", isDirectory: true)
        try FileManager.default.createDirectory(at: projectURL, withIntermediateDirectories: true)
        try "{ invalid".write(to: projectURL.appendingPathComponent("project.json"), atomically: true, encoding: .utf8)
        try emptyHistoryJSON.write(to: projectURL.appendingPathComponent("history.json"), atomically: true, encoding: .utf8)
        let storage = LocalProjectStorage(rootURL: rootURL)

        let read = storage.read(id: "broken-json")

        XCTAssertEqual(read.failure, .corruptProject("broken-json"))
    }

    func testStorage_whenGeneratedImageAndDocumentsAreSaved_survivesRestart() throws {
        let rootURL = try makeTemporaryRoot()
        let storage = LocalProjectStorage(rootURL: rootURL)
        let project = MobileProjectRecord(id: "mobile-smoke-project", name: "Mobile Smoke Project", manifestJSON: manifestJSON, historyJSON: emptyHistoryJSON, canvasJSON: nil)
        _ = try storage.create(project).get()
        let imageData = try Data(contentsOf: fixtureURL(nil, "reference-banana.png"))
        let updatedHistory = historyJSON
        let updatedCanvas = #"{"schemaVersion":1,"settings":{},"canvas":{"images":{},"imageOrder":[],"focusedImageIds":[]}}"#

        let asset = try storage.saveGeneratedImage(projectID: project.id, assetID: "generated-banana", mimeType: .png, data: imageData).get()
        _ = try storage.updateDocuments(projectID: project.id, manifestJSON: manifestJSON, historyJSON: updatedHistory, canvasJSON: updatedCanvas).get()
        let restarted = try LocalProjectStorage(rootURL: rootURL).read(id: project.id).get()

        XCTAssertEqual(asset.projectRelativePath, "assets/generated-banana.png")
        XCTAssertEqual(try Data(contentsOf: asset.fileURL), imageData)
        XCTAssertEqual(restarted.historyJSON, updatedHistory)
        XCTAssertEqual(restarted.canvasJSON, updatedCanvas)
    }

    func testLineagePersistence_whenDocumentsAreSavedAndReloaded_preservesFocusCascadeDeletionAndBatchMetadata() throws {
        let rootURL = try makeTemporaryRoot()
        let storage = LocalProjectStorage(rootURL: rootURL)
        let project = MobileProjectRecord(id: "mobile-smoke-project", name: "Mobile Smoke Project", manifestJSON: manifestJSON, historyJSON: emptyHistoryJSON, canvasJSON: nil)
        _ = try storage.create(project).get()
        let doomedRoot = lineageImage(id: "doomed-root", timestamp: 1)
        let doomedChild = lineageImage(id: "doomed-child", parentId: doomedRoot.id, timestamp: 2)
        let doomedGrandchild = lineageImage(id: "doomed-grandchild", parentId: doomedChild.id, timestamp: 3)
        let annotations = CanvasAnnotations(
            paths: [DrawingPath(id: "focused-path", tool: .pen, points: [EditorPoint(x: 0.1, y: 0.2), EditorPoint(x: 0.8, y: 0.9)], color: "#ffffff", strokeWidth: 2)],
            boxes: [BoundingBox(id: "focused-box", x: 0.2, y: 0.3, width: 0.4, height: 0.5, color: "#0d99ff", status: .pending)],
            memos: [TextMemo(id: "focused-memo", x: 0.6, y: 0.7, text: "Keep this annotation", color: "#ffe066")]
        )
        let survivorA = lineageImage(id: "survivor-a", batchId: "survivor-batch", batchIndex: 0, timestamp: 4)
        let survivorB = lineageImage(id: "survivor-b", batchId: "survivor-batch", batchIndex: 1, timestamp: 5, annotations: annotations)
        let history = [
            lineageHistory(for: doomedRoot),
            lineageHistory(for: doomedChild),
            lineageHistory(for: doomedGrandchild),
            lineageHistory(for: survivorA),
            lineageHistory(for: survivorB)
        ]
        let initial = ProviderPipelineState(images: [doomedRoot, doomedChild, doomedGrandchild, survivorA, survivorB], history: history, focusedImageId: survivorB.id)
        let afterDeletion = HistoryDeletionCoordinator.deleting(entryID: doomedRoot.id, from: initial)

        let documents = try EditorProjectDocumentSerializer.serialize(
            history: afterDeletion.history,
            images: afterDeletion.images,
            focusedImageID: afterDeletion.focusedImageId,
            focusedAnnotations: afterDeletion.focusedImage?.annotations
        )
        _ = try storage.updateDocuments(projectID: project.id, manifestJSON: manifestJSON, historyJSON: documents.historyJSON, canvasJSON: documents.canvasJSON).get()
        let reloaded = try LocalProjectStorage(rootURL: rootURL).read(id: project.id).get()
        let reloadedHistory = try ProjectHistoryDocument.parse(reloaded.historyJSON)
        let reloadedCanvas = try MobileCanvasDocument.parse(try XCTUnwrap(reloaded.canvasJSON))

        XCTAssertEqual(reloadedHistory.entries.map(\.id), [survivorA.id, survivorB.id])
        XCTAssertEqual(reloadedCanvas.imageOrder, [survivorA.id, survivorB.id])
        XCTAssertEqual(reloadedCanvas.focusedImageIds, [survivorB.id])
        XCTAssertEqual(reloadedHistory.entries.map(\.generationBatchId), ["survivor-batch", "survivor-batch"])
        XCTAssertEqual(reloadedHistory.entries.map(\.batchIndex), [0, 1])
        XCTAssertEqual(reloadedCanvas.images[survivorB.id]?.generationBatchId, "survivor-batch")
        XCTAssertEqual(reloadedCanvas.images[survivorB.id]?.batchIndex, 1)
        XCTAssertEqual(reloadedCanvas.images[survivorB.id]?.annotations, annotations)
        XCTAssertFalse(reloaded.historyJSON.contains(doomedRoot.id))
        XCTAssertFalse(reloaded.historyJSON.contains(doomedChild.id))
        XCTAssertFalse(reloaded.historyJSON.contains(doomedGrandchild.id))
        XCTAssertFalse(try XCTUnwrap(reloaded.canvasJSON).contains(doomedRoot.id))
        XCTAssertFalse(try XCTUnwrap(reloaded.canvasJSON).contains(doomedChild.id))
        XCTAssertFalse(try XCTUnwrap(reloaded.canvasJSON).contains(doomedGrandchild.id))
    }

    func testPickerModel_whenCreateOpenAndDelete_updatesLocalProjectState() throws {
        let model = ProjectPickerModel(storage: LocalProjectStorage(rootURL: try makeTemporaryRoot()), now: { Date(timeIntervalSince1970: 0) })

        model.createProject(name: "Mobile Smoke Project")
        model.openProject(id: "mobile-smoke-project")
        model.deleteProject(id: "mobile-smoke-project")

        XCTAssertEqual(model.state.projects, [])
        XCTAssertEqual(model.state.openedProject?.id, "mobile-smoke-project")
        XCTAssertNil(model.state.lastError)
    }

    func testPickerModel_whenProjectNameContainsJsonSpecialCharacters_createsReadableProject() throws {
        let rootURL = try makeTemporaryRoot()
        let storage = LocalProjectStorage(rootURL: rootURL)
        let model = ProjectPickerModel(storage: storage, now: { Date(timeIntervalSince1970: 0) })
        let projectName = "Quote \" Banana \\ Project\nLine"

        model.createProject(name: projectName)
        model.openProject(id: "quote-banana-project-line")
        let restartedProject = try LocalProjectStorage(rootURL: rootURL).read(id: "quote-banana-project-line").get()

        XCTAssertNil(model.state.lastError)
        XCTAssertEqual(model.state.openedProject?.name, projectName)
        XCTAssertEqual(restartedProject.name, projectName)
        XCTAssertEqual(model.state.projects, [ProjectListItem(id: "quote-banana-project-line", name: projectName)])
    }

    private func makeTemporaryRoot() throws -> URL {
        let rootURL = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: rootURL, withIntermediateDirectories: true)
        return rootURL
    }

    private func lineageImage(id: String, parentId: String? = nil, batchId: String? = nil, batchIndex: Int? = nil, timestamp: Double, annotations: CanvasAnnotations = .empty) -> CanvasImage {
        CanvasImage(id: id, url: "fixture://\(id).png", assetId: "asset-\(id)", size: EditorSize(width: 100, height: 100), position: EditorPoint(x: 0, y: 0), parentId: parentId, generationIndex: Int(timestamp), generationBatchId: batchId, batchIndex: batchIndex, prompt: id, provider: .mock, mode: parentId == nil ? .generate : .edit, createdAt: timestamp, annotations: annotations, hasMagicLayerFields: false, status: .ready, userErrorMessage: nil)
    }

    private func lineageHistory(for image: CanvasImage) -> HistoryEntry {
        HistoryEntry(id: image.id, mode: image.mode, provider: image.provider, prompt: image.prompt, assetId: image.assetId ?? "", assetPath: "assets/\(image.id).png", parentId: image.parentId, generationBatchId: image.generationBatchId, batchIndex: image.batchIndex, createdAt: "1970-01-01T00:00:00.000Z", timestamp: image.createdAt)
    }

    private func fixtureURL(_ fixture: String?, _ fileName: String) throws -> URL {
        var directory = URL(fileURLWithPath: #filePath)
        while directory.path != "/" {
            var candidate = directory.appendingPathComponent("packages/mobile-contracts/fixtures", isDirectory: true)
            if let fixture {
                candidate = candidate.appendingPathComponent(fixture, isDirectory: true)
            }
            candidate = candidate.appendingPathComponent(fileName)
            if FileManager.default.fileExists(atPath: candidate.path()) {
                return candidate
            }
            directory.deleteLastPathComponent()
        }
        throw AdapterError.storageNotFound(fileName)
    }
}

private extension Result where Failure == AdapterError {
    var failure: AdapterError? {
        switch self {
        case .success:
            return nil
        case .failure(let error):
            return error
        }
    }
}
