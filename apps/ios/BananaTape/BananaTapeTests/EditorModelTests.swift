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

    func testLineageC001_whenFocusedImageMoves_navigatesSiblingsAndDirectChildrenDeterministically() {
        let rootA = lineageImage(id: "root-a", batchId: "roots", batchIndex: 0, timestamp: 3)
        let pendingRoot = lineageImage(id: "pending-root", batchId: "roots", batchIndex: 1, timestamp: 2, status: .pending)
        let unrelatedChild = lineageImage(id: "unrelated-child", parentId: "other-parent", batchId: "roots", batchIndex: 1, timestamp: 2)
        let rootB = lineageImage(id: "root-b", batchId: "roots", batchIndex: 2, timestamp: 1)
        let pendingChild = lineageImage(id: "pending-child", parentId: rootB.id, batchId: "pending-children", batchIndex: 0, timestamp: 2, status: .pending)
        let laterChild = lineageImage(id: "later-child", parentId: rootB.id, batchId: "later-children", batchIndex: 0, timestamp: 5)
        let firstChild = lineageImage(id: "z-first-child", parentId: rootB.id, batchId: "first-children", batchIndex: 0, timestamp: 4)
        let firstChildSecond = lineageImage(id: "a-second-child", parentId: rootB.id, batchId: "first-children", batchIndex: 1, timestamp: 4)
        let state = ProviderPipelineState(images: [pendingChild, unrelatedChild, laterChild, firstChildSecond, rootB, firstChild, pendingRoot, rootA], focusedImageId: rootA.id)

        let sibling = state.movingFocus(.right)
        let child = sibling.movingFocus(.down)
        let parent = child.movingFocus(.up)

        XCTAssertEqual(sibling.focusedImageId, rootB.id)
        XCTAssertEqual(child.focusedImageId, firstChild.id)
        XCTAssertEqual(parent.focusedImageId, rootB.id)
        XCTAssertEqual(sibling.lineageAvailability, LineageNavigationAvailability(canMoveLeft: true, canMoveRight: false, canMoveUp: false, canMoveDown: true))
        XCTAssertEqual(state.focusing(imageId: pendingRoot.id).focusedImageId, rootA.id)
        XCTAssertEqual(state.startingGenerate(prompt: "new root", requestId: "generate-next", network: .online).focusedImageId, rootA.id)
    }

    func testLineageSwipe_whenDragEnds_resolvesDominantAxisThresholdAndAnnotationConflictPolicy() {
        XCTAssertEqual(LineageSwipeResolver.resolve(translation: CGSize(width: -80, height: 12), tool: .select), .lineage(.right))
        XCTAssertEqual(LineageSwipeResolver.resolve(translation: CGSize(width: 75, height: -10), tool: .select), .lineage(.left))
        XCTAssertEqual(LineageSwipeResolver.resolve(translation: CGSize(width: 8, height: -90), tool: .select), .lineage(.down))
        XCTAssertEqual(LineageSwipeResolver.resolve(translation: CGSize(width: -6, height: 72), tool: .select), .lineage(.up))
        XCTAssertEqual(LineageSwipeResolver.resolve(translation: CGSize(width: 90, height: 0), tool: .pan), .viewportPan)
        XCTAssertEqual(LineageSwipeResolver.resolve(translation: CGSize(width: 45, height: 4), tool: .pan), .viewportPan)
        XCTAssertEqual(LineageSwipeResolver.resolve(translation: CGSize(width: 70, height: 65), tool: .select), .ignored)
        XCTAssertEqual(LineageSwipeResolver.resolve(translation: CGSize(width: -100, height: 0), tool: .pen), .annotation)
        XCTAssertEqual(LineageSwipeResolver.resolve(translation: CGSize(width: 0, height: -100), tool: .box), .annotation)
    }

    func testLineageSubmission_whenReadyGeneratedRootIsFocused_routesActualSubmissionToEditUnlessGenerationIsExplicit() throws {
        let annotations = CanvasAnnotations(paths: [DrawingPath(id: "root-mark", tool: .pen, points: [], color: "#fff", strokeWidth: 2)], boxes: [], memos: [])
        let root = lineageImage(id: "root", batchId: "root-batch", batchIndex: 0, timestamp: 1, annotations: annotations)
        let history = [lineageHistory(id: root.id, assetId: "asset-root", parentId: nil, batchId: "root-batch", batchIndex: 0, timestamp: 1)]
        let state = ProviderPipelineState(images: [root], history: history, focusedImageId: root.id)

        let editPending = state.startingSubmission(mode: .edit, prompt: "edit the focused root", annotations: annotations, requestId: "edit-root", network: .online)
        let editRequest = try XCTUnwrap(editPending.requestForActivePrompt())
        let generatePending = state.startingSubmission(mode: .generate, prompt: "make a separate root", annotations: annotations, requestId: "generate-root", network: .online)
        let generateRequest = try XCTUnwrap(generatePending.requestForActivePrompt())

        XCTAssertEqual(editRequest.mode, .edit)
        XCTAssertEqual(editRequest.parentImageId, root.id)
        XCTAssertEqual(editRequest.parentHistoryId, root.id)
        XCTAssertEqual(editRequest.annotations, annotations)
        XCTAssertEqual(generateRequest.mode, .generate)
        XCTAssertNil(generateRequest.parentImageId)
        XCTAssertNil(generateRequest.parentHistoryId)
    }

    func testLineageC002_whenMovementReachesBoundary_clampsAndLegacyImagesRemainSingletonBatches() {
        let legacyRoot = lineageImage(id: "legacy-root", timestamp: 1)
        let legacyPeer = lineageImage(id: "legacy-peer", timestamp: 2)
        let child = lineageImage(id: "child", parentId: legacyRoot.id, batchId: "child-batch", batchIndex: 0, timestamp: 3)
        let state = ProviderPipelineState(images: [legacyPeer, child, legacyRoot], focusedImageId: legacyRoot.id)

        XCTAssertEqual(state.movingFocus(.left).focusedImageId, legacyRoot.id)
        XCTAssertEqual(state.movingFocus(.right).focusedImageId, legacyRoot.id)
        XCTAssertEqual(state.movingFocus(.up).focusedImageId, legacyRoot.id)
        XCTAssertEqual(state.movingFocus(.down).movingFocus(.down).focusedImageId, child.id)
        XCTAssertEqual(state.lineageAvailability, LineageNavigationAvailability(canMoveLeft: false, canMoveRight: false, canMoveUp: false, canMoveDown: true))
    }

    func testLineageC003_whenFocusChanges_bindsImageHistoryAnnotationsAndEditParentToFocus() throws {
        let rootAnnotations = CanvasAnnotations(paths: [DrawingPath(id: "root-path", tool: .pen, points: [], color: "#fff", strokeWidth: 2)], boxes: [], memos: [])
        let childAnnotations = CanvasAnnotations(paths: [], boxes: [BoundingBox(id: "child-box", x: 0, y: 0, width: 1, height: 1, color: "#00f", status: .pending)], memos: [])
        let root = lineageImage(id: "root", batchId: "roots", batchIndex: 0, timestamp: 1, annotations: rootAnnotations)
        let child = lineageImage(id: "child", parentId: root.id, batchId: "children", batchIndex: 0, timestamp: 2, annotations: childAnnotations)
        let history = [
            lineageHistory(id: root.id, assetId: "asset-root", parentId: nil, batchId: "roots", batchIndex: 0, timestamp: 1),
            lineageHistory(id: child.id, assetId: "asset-child", parentId: root.id, batchId: "children", batchIndex: 0, timestamp: 2)
        ]
        let focused = ProviderPipelineState(images: [root, child], history: history, focusedImageId: root.id).movingFocus(.down)
        let editPending = focused.startingEdit(prompt: "focused edit", annotations: focused.focusedImage?.annotations ?? .empty, requestId: "edit-focused", network: .online)
        let request = try XCTUnwrap(editPending.requestForActivePrompt())

        XCTAssertEqual(focused.focusedImage?.id, child.id)
        XCTAssertEqual(focused.focusedImage?.annotations, childAnnotations)
        XCTAssertEqual(focused.historyBrowserState.selectedEntryId, child.id)
        XCTAssertEqual(editPending.focusedImageId, child.id)
        XCTAssertEqual(request.parentImageId, child.id)
        XCTAssertEqual(request.parentHistoryId, child.id)
        XCTAssertEqual(request.annotations, childAnnotations)
    }

    func testLineageC003_whenFocusedHistoryChildIsDeleted_reconcilesFocusBeforePersistence() {
        let rootAnnotations = CanvasAnnotations(paths: [DrawingPath(id: "root-path", tool: .pen, points: [], color: "#fff", strokeWidth: 2)], boxes: [], memos: [])
        let childAnnotations = CanvasAnnotations(paths: [], boxes: [BoundingBox(id: "child-box", x: 0, y: 0, width: 1, height: 1, color: "#00f", status: .pending)], memos: [])
        let root = lineageImage(id: "root", timestamp: 1, annotations: rootAnnotations)
        let child = lineageImage(id: "child", parentId: root.id, timestamp: 2, annotations: childAnnotations)
        let history = [
            lineageHistory(id: root.id, assetId: "asset-root", parentId: nil, batchId: nil, batchIndex: nil, timestamp: 1),
            lineageHistory(id: child.id, assetId: "asset-child", parentId: root.id, batchId: nil, batchIndex: nil, timestamp: 2)
        ]
        let state = ProviderPipelineState(images: [root, child], history: history, focusedImageId: child.id)
        let remainingHistory = state.historyBrowserState.deleting(entryId: child.id)

        let reconciled = state.reconcilingHistory(remainingHistory)

        XCTAssertEqual(reconciled.focusedImageId, root.id)
        XCTAssertEqual(reconciled.focusedImage?.annotations, rootAnnotations)
        XCTAssertEqual(reconciled.focusedImage?.mode, .generate)
        XCTAssertEqual(reconciled.historyBrowserState.selectedEntryId, root.id)
    }

    func testHistoryDeletion_whenParentIsDeleted_cascadesAllDescendantsFromPersistenceFacingState() {
        let root = lineageImage(id: "root", timestamp: 1)
        let child = lineageImage(id: "child", parentId: root.id, timestamp: 2)
        let grandchild = lineageImage(id: "grandchild", parentId: child.id, timestamp: 3)
        let survivor = lineageImage(id: "survivor", timestamp: 4)
        let history = [
            lineageHistory(id: root.id, assetId: "asset-root", parentId: nil, batchId: nil, batchIndex: nil, timestamp: 1),
            lineageHistory(id: child.id, assetId: "asset-child", parentId: root.id, batchId: nil, batchIndex: nil, timestamp: 2),
            lineageHistory(id: grandchild.id, assetId: "asset-grandchild", parentId: child.id, batchId: nil, batchIndex: nil, timestamp: 3),
            lineageHistory(id: survivor.id, assetId: "asset-survivor", parentId: nil, batchId: nil, batchIndex: nil, timestamp: 4)
        ]
        let state = ProviderPipelineState(images: [root, child, grandchild, survivor], history: history, focusedImageId: grandchild.id)

        let deleted = state.historyBrowserState.deleting(entryId: root.id)
        let reconciled = state.reconcilingHistory(deleted)
        let retainedHistoryIDs = Set(reconciled.history.map(\.id))
        let retainedImageIDs = Set(reconciled.images.map(\.id))

        XCTAssertEqual(retainedHistoryIDs, [survivor.id])
        XCTAssertEqual(retainedImageIDs, [survivor.id])
        XCTAssertTrue(reconciled.history.allSatisfy { $0.parentId == nil || retainedHistoryIDs.contains($0.parentId!) })
        XCTAssertTrue(reconciled.images.allSatisfy { $0.parentId == nil || retainedImageIDs.contains($0.parentId!) })
        XCTAssertEqual(reconciled.focusedImageId, survivor.id)
    }

    func testHistoryDeletionCoordinator_whenUsedByHistoryRoutes_reconcilesSelectedAndNonSelectedDeletion() {
        let root = lineageImage(id: "root", timestamp: 1)
        let child = lineageImage(id: "child", parentId: root.id, timestamp: 2)
        let survivor = lineageImage(id: "survivor", timestamp: 3)
        let history = [
            lineageHistory(id: root.id, assetId: "asset-root", parentId: nil, batchId: nil, batchIndex: nil, timestamp: 1),
            lineageHistory(id: child.id, assetId: "asset-child", parentId: root.id, batchId: nil, batchIndex: nil, timestamp: 2),
            lineageHistory(id: survivor.id, assetId: "asset-survivor", parentId: nil, batchId: nil, batchIndex: nil, timestamp: 3)
        ]

        let selectedDeletion = HistoryDeletionCoordinator.deleting(
            entryID: root.id,
            from: ProviderPipelineState(images: [root, child, survivor], history: history, focusedImageId: child.id)
        )
        let nonSelectedDeletion = HistoryDeletionCoordinator.deleting(
            entryID: root.id,
            from: ProviderPipelineState(images: [root, child, survivor], history: history, focusedImageId: survivor.id)
        )

        XCTAssertEqual(selectedDeletion.history.map(\.id), [survivor.id])
        XCTAssertEqual(selectedDeletion.images.map(\.id), [survivor.id])
        XCTAssertEqual(selectedDeletion.focusedImageId, survivor.id)
        XCTAssertEqual(nonSelectedDeletion.history.map(\.id), [survivor.id])
        XCTAssertEqual(nonSelectedDeletion.images.map(\.id), [survivor.id])
        XCTAssertEqual(nonSelectedDeletion.focusedImageId, survivor.id)
    }

    func testHistoryDeletion_whenUnrelatedBranchIsDeleted_preservesPendingEditAndAllowsProviderCompletion() throws {
        let fixture = pendingEditWithCascadeChildren()
        let deleted = HistoryDeletionCoordinator.deleting(entryID: "a-1", from: fixture.pendingState)
        let retainedRequest = try XCTUnwrap(deleted.requestForActivePrompt())
        let result = try MockImageProvider().edit(retainedRequest).successValue()
        var persistenceCallCount = 0
        var latestState = deleted

        let resolution = ProviderPipelineCompletionCoordinator.resolvingSuccess(
            result,
            in: &latestState,
            persistenceFailureMessage: "Persistence failed"
        ) {
            persistenceCallCount += 1
            return result
        }

        XCTAssertEqual(deleted.pendingImages.map(\.id), ["pending-late-edit"])
        XCTAssertEqual(deleted.activeRequestId, fixture.request.id)
        XCTAssertEqual(deleted.activeParentHistoryId, fixture.parentID)
        XCTAssertEqual(retainedRequest.parentImageId, fixture.parentID)
        XCTAssertEqual(retainedRequest.parentHistoryId, fixture.parentID)
        XCTAssertEqual(persistenceCallCount, 1)
        guard case .applied = resolution else {
            return XCTFail("Expected provider completion to apply")
        }
        XCTAssertEqual(latestState.history.last?.parentId, fixture.parentID)
        XCTAssertEqual(latestState.focusedImage?.status, .ready)
        XCTAssertNil(latestState.activeRequestId)
    }

    func testHistoryOrdering_whenBatchTimestampsInterleave_keepsLineageBatchesContiguous() {
        let batchAFirst = lineageHistory(id: "a-first", assetId: "asset-a-first", parentId: nil, batchId: "batch-a", batchIndex: 0, timestamp: 10)
        let batchASecond = lineageHistory(id: "a-second", assetId: "asset-a-second", parentId: nil, batchId: "batch-a", batchIndex: 1, timestamp: 40)
        let batchBFirst = lineageHistory(id: "b-first", assetId: "asset-b-first", parentId: nil, batchId: "batch-b", batchIndex: 0, timestamp: 20)
        let batchBSecond = lineageHistory(id: "b-second", assetId: "asset-b-second", parentId: nil, batchId: "batch-b", batchIndex: 1, timestamp: 30)
        let tiedAnchorZ = lineageHistory(id: "z-anchor", assetId: "asset-z-anchor", parentId: nil, batchId: "batch-z", batchIndex: 0, timestamp: 50)
        let tiedAnchorA = lineageHistory(id: "a-anchor", assetId: "asset-a-anchor", parentId: nil, batchId: "batch-later-a", batchIndex: 0, timestamp: 50)

        let state = NativeHistoryBrowserState(entries: [batchASecond, tiedAnchorZ, batchBSecond, batchBFirst, tiedAnchorA, batchAFirst])
        let expected = [batchAFirst.id, batchASecond.id, batchBFirst.id, batchBSecond.id, tiedAnchorA.id, tiedAnchorZ.id]

        XCTAssertEqual(state.entries.map(\.id), expected)
        XCTAssertEqual(state.rows.map(\.id), expected)
    }

    func testLineageSwipe_whenPinchOverlapsDrag_suppressesLineageUntilThatDragEnds() {
        var arbitration = CanvasGestureArbitrationState()
        arbitration.dragChanged()
        arbitration.pinchChanged()
        arbitration.pinchEnded()

        let simultaneousResolution = arbitration.dragEnded(translation: CGSize(width: -100, height: 0), tool: .select)
        arbitration.dragChanged()
        let nextResolution = arbitration.dragEnded(translation: CGSize(width: -100, height: 0), tool: .select)

        XCTAssertEqual(simultaneousResolution, .ignored)
        XCTAssertEqual(nextResolution, .lineage(.right))
    }

    func testLineageC003_whenPersistedFocusIsMissingOrPending_fallsBackToLastReadyImage() {
        let root = lineageImage(id: "root", timestamp: 1)
        let ready = lineageImage(id: "ready", timestamp: 2)
        let pending = lineageImage(id: "pending", timestamp: 3, status: .pending)

        XCTAssertEqual(ProviderPipelineState(images: [root, ready, pending], focusedImageId: "missing").focusedImageId, ready.id)
        XCTAssertEqual(ProviderPipelineState(images: [root, ready, pending], focusedImageId: pending.id).focusedImageId, ready.id)
    }

    func testLineageMetadata_whenIndexesAreOutOfRange_ignoresThemWithoutCrashing() throws {
        let canvasJSON = #"{"canvas":{"images":{"image":{"id":"image","url":"fixture://image.png","size":{"width":100,"height":100},"position":{"x":0,"y":0},"generationIndex":1e300,"batchIndex":1e300}},"imageOrder":["image"],"focusedImageIds":["image"]}}"#
        let historyJSON = #"{"revision":1,"entries":[{"id":"image","type":"generate","provider":"mock","assetId":"asset-image","assetPath":"assets/image.png","createdAt":"1970-01-01T00:00:00.000Z","timestamp":1,"batchIndex":1e300}]}"#

        let canvas = try MobileCanvasDocument.parse(canvasJSON)
        let history = try ProjectHistoryDocument.parse(historyJSON)

        XCTAssertEqual(canvas.images["image"]?.generationIndex, 0)
        XCTAssertNil(canvas.images["image"]?.batchIndex)
        XCTAssertNil(history.entries.first?.batchIndex)
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

    func testEditorVersionPill_whenEarlierHistoryEntryIsFocused_displaysFocusedVersionInsteadOfHistoryCount() {
        let root = lineageHistory(id: "root", assetId: "asset-root", parentId: nil, batchId: nil, batchIndex: nil, timestamp: 1)
        let child = lineageHistory(id: "child", assetId: "asset-child", parentId: root.id, batchId: nil, batchIndex: nil, timestamp: 2)
        let laterRoot = lineageHistory(id: "later-root", assetId: "asset-later-root", parentId: nil, batchId: nil, batchIndex: nil, timestamp: 3)
        let focusedChild = NativeHistoryBrowserState(entries: [root, child, laterRoot], selectedEntryId: child.id)

        let label = EditorVersionPillLabel.text(
            historyState: focusedChild,
            imageSize: EditorSize(width: 1024, height: 768)
        )

        XCTAssertEqual(label, "v2 · 1024x768")
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

    func testProviderCallback_whenCascadeDeletionPrecedesLateSuccess_usesLatestPipelineState() throws {
        let fixture = pendingEditWithCascadeChildren()
        let deleted = HistoryDeletionCoordinator.deleting(entryID: fixture.parentID, from: fixture.pendingState)
        let result = try MockImageProvider().edit(fixture.request).successValue()
        var persistenceCallCount = 0
        var latestState = deleted

        let resolution = ProviderPipelineCompletionCoordinator.resolvingSuccess(
            result,
            in: &latestState,
            persistenceFailureMessage: "Persistence failed"
        ) {
            persistenceCallCount += 1
            return result
        }

        XCTAssertEqual(resolution, .ignored)
        XCTAssertEqual(persistenceCallCount, 0)
        XCTAssertEqual(latestState, deleted)
        XCTAssertEqual(latestState.images.map(\.id), ["a-1", "a-3"])
        XCTAssertEqual(latestState.history.map(\.id), ["a-1", "a-3"])
        XCTAssertNil(latestState.activeRequestId)
    }

    func testProviderCallback_whenCascadeDeletionPrecedesLateFailure_usesLatestPipelineState() throws {
        let fixture = pendingEditWithCascadeChildren()
        let deleted = HistoryDeletionCoordinator.deleting(entryID: fixture.parentID, from: fixture.pendingState)
        var latestState = deleted

        let resolution = ProviderPipelineCompletionCoordinator.resolvingFailure(
            requestID: fixture.request.id,
            message: MockImageProvider.errorMessage,
            in: &latestState
        )

        XCTAssertEqual(resolution, .ignored)
        XCTAssertEqual(latestState, deleted)
        XCTAssertEqual(latestState.images.map(\.id), ["a-1", "a-3"])
        XCTAssertEqual(latestState.history.map(\.id), ["a-1", "a-3"])
        XCTAssertNil(latestState.userErrorMessage)
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

    private func lineageImage(id: String, parentId: String? = nil, batchId: String? = nil, batchIndex: Int? = nil, timestamp: Double, annotations: CanvasAnnotations = .empty, status: ImageGenerationStatus = .ready) -> CanvasImage {
        CanvasImage(id: id, url: "fixture://\(id).png", assetId: status == .ready ? "asset-\(id)" : nil, size: EditorSize(width: 100, height: 100), position: EditorPoint(x: 0, y: 0), parentId: parentId, generationIndex: Int(timestamp), generationBatchId: batchId, batchIndex: batchIndex, prompt: id, provider: .mock, mode: parentId == nil ? .generate : .edit, createdAt: timestamp, annotations: annotations, hasMagicLayerFields: false, status: status, userErrorMessage: nil)
    }

    private func lineageHistory(id: String, assetId: String, parentId: String?, batchId: String?, batchIndex: Int?, timestamp: Double) -> HistoryEntry {
        HistoryEntry(id: id, mode: parentId == nil ? .generate : .edit, provider: .mock, prompt: id, assetId: assetId, assetPath: "assets/\(id).png", parentId: parentId, generationBatchId: batchId, batchIndex: batchIndex, createdAt: "1970-01-01T00:00:00.000Z", timestamp: timestamp)
    }

    private func pendingEditWithCascadeChildren() -> (pendingState: ProviderPipelineState, request: ProviderRequest, parentID: String) {
        let a1 = lineageImage(id: "a-1", batchId: "batch-a", batchIndex: 0, timestamp: 1)
        let a2 = lineageImage(id: "a-2", batchId: "batch-a", batchIndex: 1, timestamp: 2)
        let a3 = lineageImage(id: "a-3", batchId: "batch-a", batchIndex: 2, timestamp: 3)
        let b1 = lineageImage(id: "b-1", parentId: a2.id, batchId: "batch-b", batchIndex: 0, timestamp: 4)
        let b2 = lineageImage(id: "b-2", parentId: a2.id, batchId: "batch-b", batchIndex: 1, timestamp: 5)
        let images = [a1, a2, a3, b1, b2]
        let history = images.map {
            lineageHistory(id: $0.id, assetId: $0.assetId!, parentId: $0.parentId, batchId: $0.generationBatchId, batchIndex: $0.batchIndex, timestamp: $0.createdAt)
        }
        let pending = ProviderPipelineState(images: images, history: history, focusedImageId: a2.id)
            .startingEdit(prompt: "late edit", annotations: .empty, requestId: "late-edit", network: .online)
        return (pending, pending.requestForActivePrompt()!, a2.id)
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
