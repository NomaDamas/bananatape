import XCTest
@testable import BananaTape

final class EditorModelTests: XCTestCase {
    func testHistory_whenDesktopFixtureLoads_buildsRootChildBranchOrder() throws {
        let historyJSON = try fixtureText("desktop-v1-project-with-history", "history.json")

        let document = try ProjectHistoryDocument.parse(historyJSON)
        let tree = document.buildTree()

        XCTAssertEqual(document.entries.count, 2)
        XCTAssertEqual(tree.map(\.entry.id), ["hist_desktop_generate_1"])
        XCTAssertEqual(tree.first?.children.map(\.entry.id), ["hist_desktop_edit_1"])
        XCTAssertEqual(document.toJSONString(), historyJSON)
    }

    func testAnnotations_whenUndoAndRedoApplied_restoresAddRemoveAndUpdateStates() {
        let pen = DrawingPath(id: "path-1", tool: .pen, points: [EditorPoint(x: 0.1, y: 0.2)], color: "#ffffff", strokeWidth: 2)
        let box = BoundingBox(id: "box-1", x: 0.2, y: 0.3, width: 0.4, height: 0.5, color: "#00ff00", status: .pending)
        let arrow = DrawingPath(id: "arrow-1", tool: .arrow, points: [EditorPoint(x: 0, y: 0), EditorPoint(x: 1, y: 1)], color: "#0d99ff", strokeWidth: 3)
        let memo = TextMemo(id: "memo-1", x: 0.6, y: 0.7, text: "Move label", color: "#111111")
        var stack = AnnotationHistoryStack()

        stack.apply(CanvasAnnotations(paths: [pen, arrow], boxes: [box], memos: [memo]))
        stack.apply(CanvasAnnotations(paths: [pen, arrow], boxes: [], memos: [TextMemo(id: memo.id, x: memo.x, y: memo.y, text: "Move label higher", color: memo.color)]))
        stack.undo()

        XCTAssertEqual(stack.current.boxes, [box])
        XCTAssertEqual(stack.current.memos.map(\.text), ["Move label"])

        stack.redo()

        XCTAssertEqual(stack.current.boxes, [])
        XCTAssertEqual(stack.current.memos.map(\.text), ["Move label higher"])
    }

    func testCanvas_whenMagicLayerFixtureLoads_preservesUnknownFieldsAndExposesNoEditing() throws {
        let canvasJSON = try fixtureText("desktop-project-with-magic-layer-fields", "canvas.json")

        let document = try MobileCanvasDocument.parse(canvasJSON)
        let image = try XCTUnwrap(document.images["img-magic-generate-1"])

        XCTAssertTrue(image.hasMagicLayerFields)
        XCTAssertFalse(image.canEditMagicLayers)
        XCTAssertEqual(CanvasImage.magicLayerEditingMessage, "Magic Layer editing is desktop-only")
        XCTAssertEqual(image.annotations.paths.map(\.id), ["path-magic-note"])
        XCTAssertEqual(image.annotations.boxes.map(\.id), ["box-magic-region"])
        XCTAssertEqual(image.annotations.memos.map(\.id), ["memo-magic-desktop-only"])
        XCTAssertEqual(document.toJSONString(), canvasJSON)
        XCTAssertTrue(document.toJSONString().contains("\"magicLayers\""))
        XCTAssertTrue(document.toJSONString().contains("\"selectedMagicLayerId\": \"layer-banana-foreground\""))
    }

    func testHistoryBrowser_whenChildSelectedAndDeleted_restoresRootWithExportPreview() {
        let root = HistoryEntry(id: "hist-root", mode: .generate, provider: .openAI, prompt: "Root generation", assetId: "asset-root", assetPath: "assets/root.png", parentId: nil, createdAt: "1970-01-01T00:00:00.000Z", timestamp: 1)
        let child = HistoryEntry(id: "hist-child", mode: .edit, provider: .openAI, prompt: "Edit child", assetId: "asset-child", assetPath: "assets/child.png", parentId: root.id, createdAt: "1970-01-01T00:01:00.000Z", timestamp: 2)
        let selectedChild = NativeHistoryBrowserState(entries: [root, child]).selecting(entryId: child.id)

        let restored = selectedChild.deleting(entryId: child.id)

        XCTAssertEqual(selectedChild.rows.map(\.branchLabel), ["Root", "Edit"])
        XCTAssertEqual(selectedChild.selectedEntry?.id, child.id)
        XCTAssertEqual(restored.entries.map(\.id), [root.id])
        XCTAssertEqual(restored.selectedEntry?.id, root.id)
        XCTAssertEqual(restored.exportPreview?.assetPath, "assets/root.png")
        XCTAssertEqual(restored.historyCountLabel, "1 version")
    }

    func testMockProvider_whenGenerateSucceeds_createsReadyImageAndHistory() throws {
        let prompt = "banana sticker on transparent background"
        let provider = MockImageProvider()
        let pending = ProviderPipelineState().startingGenerate(prompt: prompt, requestId: "generate-1", network: .online)
        let request = try XCTUnwrap(pending.requestForActivePrompt())

        let completed = pending.applying(try provider.generate(request).successValue())

        XCTAssertEqual(pending.pendingImages.map(\.status), [.pending])
        XCTAssertEqual(completed.readyImages.count, 1)
        XCTAssertEqual(completed.readyImages.first?.prompt, prompt)
        XCTAssertEqual(completed.readyImages.first?.provider, .mock)
        XCTAssertEqual(completed.history.count, 1)
        XCTAssertEqual(completed.history.first?.prompt, prompt)
        XCTAssertEqual(completed.history.first?.parentId, nil)
    }

    func testMockProvider_whenEditWithAnnotationsSucceeds_createsChildWithParentHistoryId() throws {
        let prompt = "banana sticker on transparent background"
        let provider = MockImageProvider()
        let rootPending = ProviderPipelineState().startingGenerate(prompt: prompt, requestId: "generate-1", network: .online)
        let rootReady = rootPending.applying(try provider.generate(try XCTUnwrap(rootPending.requestForActivePrompt())).successValue())
        let box = BoundingBox(id: "box-edit", x: 0.2, y: 0.2, width: 0.4, height: 0.4, color: "#0d99ff", status: .pending)
        let annotations = CanvasAnnotations(paths: [], boxes: [box], memos: [])

        let editPending = rootReady.startingEdit(prompt: "make the peel brighter", annotations: annotations, requestId: "edit-1", network: .online)
        let editReady = editPending.applying(try provider.edit(try XCTUnwrap(editPending.requestForActivePrompt())).successValue())

        XCTAssertEqual(editReady.readyImages.count, 2)
        XCTAssertEqual(editReady.readyImages.last?.parentId, rootReady.readyImages.first?.id)
        XCTAssertEqual(editReady.history.count, 2)
        XCTAssertEqual(editReady.history.last?.mode, .edit)
        XCTAssertEqual(editReady.history.last?.parentId, rootReady.history.first?.id)
    }

    func testMockProvider_whenCanceled_removesPendingPlaceholder() {
        let pending = ProviderPipelineState().startingGenerate(prompt: "banana sticker on transparent background", requestId: "generate-1", network: .online)

        let canceled = pending.canceling(requestId: "generate-1")

        XCTAssertEqual(pending.pendingImages.count, 1)
        XCTAssertEqual(canceled.images.count, 0)
        XCTAssertEqual(canceled.history.count, 0)
        XCTAssertNil(canceled.activeRequestId)
    }

    func testRequestForActivePrompt_whenReferencesProvided_preservesAssetPathsForProvider() throws {
        let pending = ProviderPipelineState().startingGenerate(prompt: "banana sticker", requestId: "generate-1", network: .online)

        let request = try XCTUnwrap(pending.requestForActivePrompt(references: [
            ComposerReferenceSummary(id: "ref-1", label: "banana.png", assetPath: "references/ref-1.png"),
            ComposerReferenceSummary(id: "ref-2", label: "label.jpg", assetPath: "references/ref-2.jpg")
        ]))

        XCTAssertEqual(request.references.map(\.assetPath), ["references/ref-1.png", "references/ref-2.jpg"])
    }

    func testMockProvider_whenSlowStaleResponseReturns_ignoresOlderResult() throws {
        let provider = MockImageProvider(scenario: .slowSuccess)
        let slowPending = ProviderPipelineState().startingGenerate(prompt: "slow banana", requestId: "slow-1", network: .online)
        let slowRequest = try XCTUnwrap(slowPending.requestForActivePrompt())
        let canceled = slowPending.canceling(requestId: "slow-1")
        let nextPending = canceled.startingGenerate(prompt: "banana sticker on transparent background", requestId: "generate-2", network: .online)

        let staleApplied = nextPending.applying(try provider.generate(slowRequest).successValue())

        XCTAssertEqual(staleApplied, nextPending)
        XCTAssertEqual(staleApplied.pendingImages.map(\.id), ["pending-generate-2"])
        XCTAssertEqual(staleApplied.history.count, 0)
    }

    func testMockProvider_whenProviderErrorFails_removesPendingAndKeepsHistoryClean() throws {
        let provider = MockImageProvider(scenario: .providerError)
        let pending = ProviderPipelineState().startingGenerate(prompt: "banana sticker on transparent background", requestId: "generate-1", network: .online)
        let request = try XCTUnwrap(pending.requestForActivePrompt())

        let failed = pending.failing(requestId: request.id, message: try provider.generate(request).failureMessage())

        XCTAssertEqual(failed.images.count, 0)
        XCTAssertEqual(failed.history.count, 0)
        XCTAssertEqual(failed.userErrorMessage, MockImageProvider.errorMessage)
    }

    func testMockProvider_whenOffline_failsFastWithoutPendingPlaceholder() {
        let offline = ProviderPipelineState().startingGenerate(prompt: "banana sticker on transparent background", requestId: "generate-1", network: .offline)

        XCTAssertEqual(offline.images.count, 0)
        XCTAssertEqual(offline.history.count, 0)
        XCTAssertEqual(offline.userErrorMessage, "You are offline.")
    }

    func testMockProvider_whenOfflineEditRequested_failsFastWithoutPendingPlaceholder() throws {
        let provider = MockImageProvider()
        let rootPending = ProviderPipelineState().startingGenerate(prompt: "banana sticker", requestId: "generate-1", network: .online)
        let rootReady = rootPending.applying(try provider.generate(try XCTUnwrap(rootPending.requestForActivePrompt())).successValue())

        let offline = rootReady.startingEdit(prompt: "make the peel brighter", annotations: .empty, requestId: "edit-1", network: .offline)

        XCTAssertEqual(offline.readyImages.count, 1)
        XCTAssertEqual(offline.pendingImages.count, 0)
        XCTAssertEqual(offline.history.count, 1)
        XCTAssertEqual(offline.userErrorMessage, "You are offline.")
    }

    func testLifecycle_whenBackgroundDuringSlowRequest_dropsLateResultAndDoesNotQueueForegroundRetry() throws {
        let provider = MockImageProvider(scenario: .slowSuccess)
        let pending = ProviderPipelineState().startingGenerate(prompt: "slow banana", requestId: "slow-1", network: .online)
        let request = try XCTUnwrap(pending.requestForActivePrompt())

        let backgrounded = pending.movingToBackground()
        let staleApplied = backgrounded.applying(try provider.generate(request).successValue())
        let foreground = staleApplied.returningToForeground(network: .online)

        XCTAssertEqual(backgrounded.lifecyclePhase, .background)
        XCTAssertEqual(backgrounded.pendingImages.count, 0)
        XCTAssertNil(backgrounded.activeRequestId)
        XCTAssertEqual(staleApplied.history.count, 0)
        XCTAssertEqual(foreground.lifecyclePhase, .foreground)
        XCTAssertNil(foreground.activeRequestId)
        XCTAssertEqual(foreground.images.count, 0)
    }

    private func fixtureText(_ fixture: String, _ fileName: String) throws -> String {
        var directory = URL(fileURLWithPath: #filePath)
        while directory.path != "/" {
            let candidate = directory
                .appendingPathComponent("packages/mobile-contracts/fixtures", isDirectory: true)
                .appendingPathComponent(fixture, isDirectory: true)
                .appendingPathComponent(fileName)
            if FileManager.default.fileExists(atPath: candidate.path()) {
                return try String(contentsOf: candidate, encoding: .utf8)
            }
            directory.deleteLastPathComponent()
        }
        throw EditorJSONError.missingField(fileName)
    }

}

private extension MockProviderResult {
    func successValue() throws -> ProviderImageResult {
        switch self {
        case .success(let value):
            return value
        case .failure:
            throw EditorJSONError.missingField("expected failure")
        }
    }

    func failureMessage() throws -> String {
        switch self {
        case .success:
            throw EditorJSONError.missingField("expected failure")
        case .failure(let message):
            return message
        }
    }
}
