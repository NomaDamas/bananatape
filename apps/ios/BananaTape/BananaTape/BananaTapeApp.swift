import SwiftUI
#if DEBUG
import UIKit
#endif

@main
struct BananaTapeApp: App {
    private let storage: LocalProjectStorage
    @StateObject private var model: ProjectPickerModel

    init() {
#if DEBUG
        let arguments = ProcessInfo.processInfo.arguments
        let usesUITestStorage = arguments.contains("--reset-projects-for-ui-tests") || arguments.contains("--seed-lineage-project-for-ui-tests")
        let storage = usesUITestStorage
            ? LocalProjectStorage(rootURL: FileManager.default.temporaryDirectory.appendingPathComponent("BananaTapeUITests/Projects", isDirectory: true))
            : LocalProjectStorage()
        if arguments.contains("--reset-projects-for-ui-tests") {
            storage.list().forEach { _ = storage.delete(id: $0.id) }
        }
        if arguments.contains("--seed-lineage-project-for-ui-tests") {
            UITestLineageProjectSeeder.seed(in: storage)
        }
#else
        let storage = LocalProjectStorage()
#endif
        self.storage = storage
        _model = StateObject(wrappedValue: ProjectPickerModel(storage: storage))
    }

    var body: some Scene {
        WindowGroup {
            ProjectListView(model: model, storage: storage)
        }
    }
}

#if DEBUG
private enum UITestLineageProjectSeeder {
    static let projectID = "ui-lineage-project"

    static func seed(in storage: LocalProjectStorage) {
        let fixtures = [
            fixture(id: "A-1", parentID: nil, batchID: "batch-a", batchIndex: 0, timestamp: 1, color: .systemYellow),
            fixture(id: "A-2", parentID: nil, batchID: "batch-a", batchIndex: 1, timestamp: 2, color: .systemOrange),
            fixture(id: "A-3", parentID: nil, batchID: "batch-a", batchIndex: 2, timestamp: 3, color: .systemPink),
            fixture(id: "B-1", parentID: "A-2", batchID: "batch-b", batchIndex: 0, timestamp: 4, color: .systemTeal),
            fixture(id: "B-2", parentID: "A-2", batchID: "batch-b", batchIndex: 1, timestamp: 5, color: .systemBlue)
        ]
        let history = fixtures.map(\.history)
        let images = fixtures.map(\.image)
        guard let documents = try? EditorProjectDocumentSerializer.serialize(
            history: history,
            images: images,
            focusedImageID: "A-1",
            focusedAnnotations: .empty
        ) else { return }
        let project = MobileProjectRecord(
            id: projectID,
            name: "Lineage QA",
            manifestJSON: manifestJSON(),
            historyJSON: documents.historyJSON,
            canvasJSON: documents.canvasJSON
        )
        _ = storage.delete(id: projectID)
        guard case .success = storage.create(project) else { return }
        for fixture in fixtures {
            guard case .success = storage.saveGeneratedImage(
                projectID: projectID,
                assetID: fixture.history.assetId,
                mimeType: .png,
                data: renderedPNG(label: fixture.image.id, color: fixture.color)
            ) else {
                _ = storage.delete(id: projectID)
                return
            }
        }
    }

    private static func fixture(id: String, parentID: String?, batchID: String, batchIndex: Int, timestamp: Double, color: UIColor) -> (image: CanvasImage, history: HistoryEntry, color: UIColor) {
        let assetID = "qa-\(id.lowercased())"
        let assetPath = "assets/\(assetID).png"
        let mode: EditorMode = parentID == nil ? .generate : .edit
        let image = CanvasImage(
            id: id,
            url: assetPath,
            assetId: assetID,
            size: EditorSize(width: 512, height: 512),
            position: EditorPoint(x: 0, y: 0),
            parentId: parentID,
            generationIndex: Int(timestamp),
            generationBatchId: batchID,
            batchIndex: batchIndex,
            prompt: "Lineage fixture \(id)",
            provider: .mock,
            mode: mode,
            createdAt: timestamp,
            annotations: .empty,
            hasMagicLayerFields: false,
            status: .ready,
            userErrorMessage: nil
        )
        let history = HistoryEntry(
            id: id,
            mode: mode,
            provider: .mock,
            prompt: "Lineage fixture \(id)",
            assetId: assetID,
            assetPath: assetPath,
            parentId: parentID,
            generationBatchId: batchID,
            batchIndex: batchIndex,
            createdAt: "1970-01-01T00:00:0\(Int(timestamp)).000Z",
            timestamp: timestamp
        )
        return (image, history, color)
    }

    private static func renderedPNG(label: String, color: UIColor) -> Data {
        let size = CGSize(width: 512, height: 512)
        return UIGraphicsImageRenderer(size: size).pngData { context in
            color.setFill()
            context.fill(CGRect(origin: .zero, size: size))
            label.draw(
                at: CGPoint(x: 172, y: 216),
                withAttributes: [
                    .font: UIFont.systemFont(ofSize: 64, weight: .bold),
                    .foregroundColor: UIColor.black
                ]
            )
        }
    }

    private static func manifestJSON() -> String {
        """
        {
          "schemaVersion": 1,
          "id": "\(projectID)",
          "name": "Lineage QA",
          "createdAt": "1970-01-01T00:00:00.000Z",
          "updatedAt": "1970-01-01T00:00:00.000Z",
          "settings": {
            "systemPrompt": "",
            "referenceImages": []
          }
        }
        """
    }
}
#endif
