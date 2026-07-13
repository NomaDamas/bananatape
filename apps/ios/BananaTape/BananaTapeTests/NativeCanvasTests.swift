import XCTest
import UIKit
@testable import BananaTape

final class NativeCanvasTests: XCTestCase {
    func testCanvasGeometry_whenContainerChanges_aspectFitsAndNormalizesAgainstRenderedSize() {
        let landscape = NativeCanvasGeometry.aspectFit(
            imageSize: EditorSize(width: 1600, height: 900),
            in: CGSize(width: 320, height: 480)
        )
        let portrait = NativeCanvasGeometry.aspectFit(
            imageSize: EditorSize(width: 900, height: 1600),
            in: CGSize(width: 320, height: 480)
        )

        XCTAssertEqual(landscape.width, 320, accuracy: 0.001)
        XCTAssertEqual(landscape.height, 180, accuracy: 0.001)
        XCTAssertEqual(portrait.width, 270, accuracy: 0.001)
        XCTAssertEqual(portrait.height, 480, accuracy: 0.001)
        XCTAssertEqual(
            NativeCanvasGeometry.normalized(CGPoint(x: 160, y: 90), in: landscape),
            EditorPoint(x: 0.5, y: 0.5)
        )
    }

    func testArrowGeometry_whenPathHasDirection_addsArrowheadAtEndpoint() {
        let points = [EditorPoint(x: 0.1, y: 0.2), EditorPoint(x: 0.8, y: 0.7)]

        let arrowhead = NativeCanvasGeometry.arrowhead(for: points, in: CGSize(width: 300, height: 200))

        XCTAssertEqual(arrowhead.count, 3)
        XCTAssertEqual(arrowhead[1].x, 240, accuracy: 0.001)
        XCTAssertEqual(arrowhead[1].y, 140, accuracy: 0.001)
        XCTAssertNotEqual(arrowhead[0], arrowhead[2])
    }

    func testDraft_whenTouchOrPencilMovesBeforeLift_isIncludedInVisiblePenPaths() {
        let draft = [EditorPoint(x: 0.1, y: 0.1), EditorPoint(x: 0.2, y: 0.25)]

        let visiblePaths = NativeCanvasGeometry.visiblePaths(
            committed: [],
            draftPoints: draft,
            draftTool: .pen
        )

        XCTAssertEqual(visiblePaths.count, 1)
        XCTAssertEqual(visiblePaths[0].tool, .pen)
        XCTAssertEqual(visiblePaths[0].points, draft)
    }

    func testMemo_whenPlacedNearEdgeAndEdited_staysBoundedFocusedAndPersistsText() {
        let memo = TextMemo(id: "memo-1", x: 0.95, y: 0.92, text: "Memo", color: "#ffe066")
        let annotations = NativeCanvasState(image: .fixtureCanvasImage).adding(memo: memo).annotations

        let origin = NativeCanvasGeometry.memoOrigin(for: memo, in: CGSize(width: 300, height: 200))
        let compactSize = NativeCanvasGeometry.memoSize(in: CGSize(width: 80, height: 40))
        let updated = NativeCanvasGeometry.updatingMemo(id: memo.id, text: "Keep this note", in: annotations)

        XCTAssertEqual(origin.x, 180, accuracy: 0.001)
        XCTAssertEqual(origin.y, 128, accuracy: 0.001)
        XCTAssertEqual(compactSize, CGSize(width: 80, height: 40))
        XCTAssertEqual(updated.memos.first?.text, "Keep this note")
        XCTAssertEqual(updated.memos.first?.x, memo.x)
        XCTAssertEqual(updated.memos.first?.y, memo.y)
        XCTAssertEqual(NativeCanvasState(image: .fixtureCanvasImage, focusedAnnotationId: memo.id, annotations: updated).focusedAnnotationId, memo.id)
    }

    func testAnnotations_whenAddingPathBoxMemo_countsAndFocusAreSerialized() {
        let pen = DrawingPath(id: "pen-1", tool: .pen, points: [EditorPoint(x: 0.1, y: 0.1), EditorPoint(x: 0.2, y: 0.3)], color: "#ffffff", strokeWidth: 2)
        let arrow = DrawingPath(id: "arrow-1", tool: .arrow, points: [EditorPoint(x: 0.2, y: 0.2), EditorPoint(x: 0.8, y: 0.7)], color: "#0d99ff", strokeWidth: 3)
        let box = BoundingBox(id: "box-1", x: 0.25, y: 0.3, width: 0.4, height: 0.25, color: "#0d99ff", status: .pending)
        let memo = TextMemo(id: "memo-1", x: 0.6, y: 0.2, text: "Tighten label", color: "#fef08a")

        let state = NativeCanvasState(image: .fixtureCanvasImage)
            .adding(path: pen)
            .adding(path: arrow)
            .adding(box: box)
            .adding(memo: memo)
            .selecting(annotationId: box.id)

        XCTAssertEqual(state.annotations.paths.map(\.id), ["pen-1", "arrow-1"])
        XCTAssertEqual(state.annotations.boxes.map(\.id), ["box-1"])
        XCTAssertEqual(state.annotations.memos.map(\.id), ["memo-1"])
        XCTAssertEqual(state.focusedAnnotationId, "box-1")
        XCTAssertEqual(state.serializedAnnotationCounts, ["paths": 2, "boxes": 1, "memos": 1])
    }

    func testViewport_whenPanAndZoomApplied_tracksNativeGestureState() {
        let state = NativeCanvasState(image: .fixtureCanvasImage)
            .panning(by: EditorPoint(x: 24, y: -12))
            .zooming(to: 1.75)

        XCTAssertEqual(state.viewport.pan, EditorPoint(x: 24, y: -12))
        XCTAssertEqual(state.viewport.zoom, 1.75)
    }

    func testHistory_whenCanvasAnnotationsUndoRedo_restoresNativeCanvasCounts() {
        let pen = DrawingPath(id: "pen-1", tool: .pen, points: [EditorPoint(x: 0, y: 0), EditorPoint(x: 1, y: 1)], color: "#ffffff", strokeWidth: 2)
        let box = BoundingBox(id: "box-1", x: 0.1, y: 0.1, width: 0.5, height: 0.5, color: "#0d99ff", status: .pending)
        var stack = AnnotationHistoryStack()

        stack.apply(NativeCanvasState(image: .fixtureCanvasImage).adding(path: pen).annotations)
        stack.apply(NativeCanvasState(image: .fixtureCanvasImage, annotations: stack.current).adding(box: box).annotations)
        stack.undo()

        XCTAssertEqual(stack.current.paths.map(\.id), ["pen-1"])
        XCTAssertEqual(stack.current.boxes.count, 0)

        stack.redo()

        XCTAssertEqual(stack.current.paths.map(\.id), ["pen-1"])
        XCTAssertEqual(stack.current.boxes.map(\.id), ["box-1"])
    }

    func testImageComposition_whenAnnotatedFixtureExports_writesAnnotatedMaskAndPreviewMetadata() throws {
        let temp = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: temp, withIntermediateDirectories: true)
        let sourceURL = temp.appendingPathComponent("source.png")
        try makeFixturePNG(width: 32, height: 24).write(to: sourceURL)
        let request = NativeImageCompositionRequest(sourceURL: sourceURL, annotations: fixtureAnnotations(), outputDirectory: temp.appendingPathComponent("export", isDirectory: true))

        let result = try NativeImageComposer().compose(request).get()

        XCTAssertEqual(result.original.width, 32)
        XCTAssertEqual(result.original.height, 24)
        XCTAssertEqual(result.original.mimeType, "image/png")
        XCTAssertEqual(result.annotated.metadata.width, 32)
        XCTAssertEqual(result.annotated.metadata.height, 24)
        XCTAssertGreaterThan(result.annotated.metadata.byteCount, 0)
        XCTAssertEqual(result.mask.metadata.width, 32)
        XCTAssertEqual(result.mask.metadata.height, 24)
        XCTAssertGreaterThan(result.mask.metadata.byteCount, 0)
        XCTAssertTrue(FileManager.default.fileExists(atPath: result.annotated.fileURL.path()))
        XCTAssertTrue(FileManager.default.fileExists(atPath: result.mask.fileURL.path()))
        XCTAssertEqual(result.exportPreview.canvasSize, EditorSize(width: 32, height: 24))
        XCTAssertEqual(result.exportPreview.annotated.byteCount, result.annotated.metadata.byteCount)
    }

    func testImageComposition_whenSourceExceedsPixelGuard_returnsUserSafeError() throws {
        let temp = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: temp, withIntermediateDirectories: true)
        let sourceURL = temp.appendingPathComponent("large.png")
        try makeFixturePNG(width: 8, height: 8).write(to: sourceURL)
        let request = NativeImageCompositionRequest(sourceURL: sourceURL, annotations: fixtureAnnotations(), outputDirectory: temp.appendingPathComponent("export", isDirectory: true))

        let result = NativeImageComposer(maxPixelCount: 10).compose(request)

        guard case .failure(let error) = result else { return XCTFail("Expected large image guard") }
        XCTAssertEqual(error, .imageTooLarge(maxPixels: 10, actualPixels: 64))
        XCTAssertEqual(error.userMessage, "This image is too large to prepare on this device.")
    }

    func testOfflineLocalProject_whenOpenedAnnotatedAndComposed_keepsStorageAndExportAvailable() throws {
        let project = MobileProjectRecord(id: "offline-project", name: "Offline Project", manifestJSON: minimalManifest(id: "offline-project", name: "Offline Project"), historyJSON: minimalHistory, canvasJSON: nil)
        let storage = FakeProjectStorage(projects: [project])
        let network = FakeNetworkStatus(reachability: .offline)
        let export = FakeImageExport(permissionGateway: FakePermissionGateway(decisions: [:]))
        let temp = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: temp, withIntermediateDirectories: true)
        let sourceURL = temp.appendingPathComponent("source.png")
        try makeFixturePNG(width: 16, height: 12).write(to: sourceURL)
        let box = BoundingBox(id: "box-1", x: 0.1, y: 0.1, width: 0.4, height: 0.4, color: "#0d99ff", status: .pending)

        let opened = try storage.read(id: project.id).get()
        let canvas = NativeCanvasState(image: .fixtureCanvasImage).adding(box: box)
        let composed = try NativeImageComposer().compose(NativeImageCompositionRequest(sourceURL: sourceURL, annotations: canvas.annotations, outputDirectory: temp.appendingPathComponent("export", isDirectory: true))).get()
        let exported = try export.exportImage(id: "offline-export", destination: .shareSheet, byteCount: composed.annotated.metadata.byteCount).get()

        XCTAssertEqual(network.currentReachability(), .offline)
        XCTAssertEqual(opened.id, project.id)
        XCTAssertEqual(canvas.annotations.boxes.map(\.id), ["box-1"])
        XCTAssertTrue(FileManager.default.fileExists(atPath: composed.annotated.fileURL.path()))
        XCTAssertEqual(exported.id, "offline-export")
    }

    func testLargeFixture_whenImportedComposedAndShared_staysFileBacked() throws {
        let rootURL = try makeTemporaryRoot()
        let storage = LocalProjectStorage(rootURL: rootURL)
        let project = MobileProjectRecord(id: "large-image-project", name: "Large Image Project", manifestJSON: minimalManifest(id: "large-image-project", name: "Large Image Project"), historyJSON: minimalHistory, canvasJSON: nil)
        _ = try storage.create(project).get()
        let sourceURL = try fixtureURL("large-banana-source.jpg")
        let imported = try storage.importProjectImage(ProjectImageImportRequest(projectID: project.id, assetID: "large-banana-source", role: .baseImage, mimeType: .jpeg, originalFileName: "large-banana-source.jpg", sourceURL: sourceURL)).get()
        let outputDirectory = rootURL.appendingPathComponent(project.id).appendingPathComponent("tmp/perf-export", isDirectory: true)
        let composed = try NativeImageComposer().compose(NativeImageCompositionRequest(sourceURL: imported.fileURL, annotations: fixtureAnnotations(), outputDirectory: outputDirectory)).get()
        let share = FakeOutboundImageShare(tempDirectory: rootURL.appendingPathComponent(project.id).appendingPathComponent("tmp/share", isDirectory: true), ttlSeconds: 600)

        let shared = try share.prepareShare(ExportableImage(id: "large-export", fileURL: composed.annotated.fileURL, mimeType: .png, width: composed.annotated.metadata.width, height: composed.annotated.metadata.height, byteCount: composed.annotated.metadata.byteCount, createdAt: Date(timeIntervalSince1970: 1_700_000_000))).get()

        XCTAssertEqual(imported.projectRelativePath, "assets/large-banana-source.jpg")
        XCTAssertEqual(imported.byteCount, 635)
        XCTAssertEqual(composed.original.mimeType, "image/jpeg")
        XCTAssertEqual(composed.original.width, 1)
        XCTAssertEqual(composed.original.height, 1)
        XCTAssertTrue(FileManager.default.fileExists(atPath: composed.annotated.fileURL.path()))
        XCTAssertEqual(shared.mimeType, .png)
        XCTAssertTrue(FileManager.default.fileExists(atPath: shared.fileURL.path()))
    }

    private func fixtureAnnotations() -> CanvasAnnotations {
        CanvasAnnotations(
            paths: [DrawingPath(id: "arrow-1", tool: .arrow, points: [EditorPoint(x: 0.1, y: 0.1), EditorPoint(x: 0.85, y: 0.7)], color: "#0d99ff", strokeWidth: 2)],
            boxes: [BoundingBox(id: "box-1", x: 0.2, y: 0.25, width: 0.45, height: 0.35, color: "#0d99ff", status: .pending)],
            memos: [TextMemo(id: "memo-1", x: 0.5, y: 0.1, text: "Move label", color: "#fef08a")]
        )
    }

    private func makeFixturePNG(width: Int, height: Int) -> Data {
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        return UIGraphicsImageRenderer(size: CGSize(width: width, height: height), format: format).pngData { context in
            UIColor(red: 0.18, green: 0.14, blue: 0.08, alpha: 1).setFill()
            context.fill(CGRect(x: 0, y: 0, width: width, height: height))
            UIColor(red: 1, green: 0.84, blue: 0.24, alpha: 0.75).setFill()
            context.fill(CGRect(x: 4, y: 4, width: width - 8, height: height - 8))
        }
    }

    private func makeTemporaryRoot() throws -> URL {
        let rootURL = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: rootURL, withIntermediateDirectories: true)
        return rootURL
    }

    private func fixtureURL(_ fileName: String) throws -> URL {
        var directory = URL(fileURLWithPath: #filePath)
        while directory.path != "/" {
            let candidate = directory.appendingPathComponent("packages/mobile-contracts/fixtures", isDirectory: true).appendingPathComponent(fileName)
            if FileManager.default.fileExists(atPath: candidate.path()) {
                return candidate
            }
            directory.deleteLastPathComponent()
        }
        throw AdapterError.storageNotFound(fileName)
    }

    private var minimalHistory: String {
        """
        {"schemaVersion":1,"revision":0,"entries":[]}
        """
    }

    private func minimalManifest(id: String, name: String) -> String {
        """
        {"schemaVersion":1,"id":"\(id)","name":"\(name)","createdAt":"1970-01-01T00:00:00.000Z","updatedAt":"1970-01-01T00:00:00.000Z","settings":{"systemPrompt":"","referenceImages":[]}}
        """
    }
}
