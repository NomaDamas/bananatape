import Foundation

struct EditorProjectDocuments: Equatable {
    let historyJSON: String
    let canvasJSON: String
}

enum EditorProjectDocumentSerializer {
    static func serialize(history: [HistoryEntry], images: [CanvasImage], focusedImageID: String?, focusedAnnotations: CanvasAnnotations?) throws -> EditorProjectDocuments {
        EditorProjectDocuments(
            historyJSON: try jsonString(historyObject(history)),
            canvasJSON: try jsonString(canvasObject(history: history, images: images, focusedImageID: focusedImageID, focusedAnnotations: focusedAnnotations))
        )
    }

    private static func historyObject(_ entries: [HistoryEntry]) -> [String: Any] {
        [
            "schemaVersion": 1,
            "revision": entries.count,
            "entries": entries.map { entry in
                [
                    "id": entry.id,
                    "type": entry.mode.rawValue,
                    "provider": entry.provider.rawValue,
                    "prompt": entry.prompt,
                    "assetId": entry.assetId,
                    "assetPath": entry.assetPath,
                    "parentId": entry.parentId ?? NSNull(),
                    "generationBatchId": entry.generationBatchId ?? NSNull(),
                    "batchIndex": entry.batchIndex ?? NSNull(),
                    "createdAt": entry.createdAt,
                    "timestamp": entry.timestamp
                ] as [String: Any]
            }
        ]
    }

    private static func canvasObject(history: [HistoryEntry], images: [CanvasImage], focusedImageID: String?, focusedAnnotations: CanvasAnnotations?) -> [String: Any] {
        let readyImages = images.filter { $0.status == .ready && $0.assetId != nil }
        let records = Dictionary(uniqueKeysWithValues: readyImages.map { image in
            let annotations = image.id == focusedImageID ? focusedAnnotations ?? image.annotations : image.annotations
            let assetPath = history.first(where: { $0.assetId == image.assetId })?.assetPath ?? image.url
            return (image.id, [
                "id": image.id,
                "url": assetPath,
                "assetId": image.assetId ?? NSNull(),
                "size": ["width": image.size.width, "height": image.size.height],
                "position": ["x": image.position.x, "y": image.position.y],
                "parentId": image.parentId ?? NSNull(),
                "generationIndex": image.generationIndex,
                "generationBatchId": image.generationBatchId ?? NSNull(),
                "batchIndex": image.batchIndex ?? NSNull(),
                "prompt": image.prompt,
                "provider": image.provider.rawValue,
                "type": image.mode.rawValue,
                "createdAt": image.createdAt,
                "paths": annotations.paths.map { ["id": $0.id, "tool": $0.tool.rawValue, "points": $0.points.map { ["x": $0.x, "y": $0.y] }, "color": $0.color, "strokeWidth": $0.strokeWidth] },
                "boxes": annotations.boxes.map { ["id": $0.id, "x": $0.x, "y": $0.y, "width": $0.width, "height": $0.height, "color": $0.color, "status": $0.status.rawValue] },
                "memos": annotations.memos.map { ["id": $0.id, "x": $0.x, "y": $0.y, "text": $0.text, "color": $0.color] }
            ] as [String: Any])
        })
        return [
            "schemaVersion": 1,
            "settings": [:],
            "canvas": [
                "images": records,
                "imageOrder": readyImages.map(\.id),
                "focusedImageIds": focusedImageID.map { [$0] } ?? []
            ]
        ]
    }

    private static func jsonString(_ object: Any) throws -> String {
        guard JSONSerialization.isValidJSONObject(object) else { throw EditorJSONError.invalidJSON }
        let data = try JSONSerialization.data(withJSONObject: object, options: [.prettyPrinted, .sortedKeys])
        guard let json = String(data: data, encoding: .utf8) else { throw EditorJSONError.invalidJSON }
        return json
    }
}
