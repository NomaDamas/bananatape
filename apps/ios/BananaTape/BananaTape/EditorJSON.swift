import Foundation

enum EditorJSONError: Error, Equatable {
    case invalidJSON
    case missingField(String)
}

struct MobileCanvasDocument: Equatable {
    let rawJSON: String
    let images: [String: CanvasImage]
    let imageOrder: [String]
    let focusedImageIds: [String]

    func toJSONString() -> String { rawJSON }

    static func parse(_ json: String) throws -> MobileCanvasDocument {
        guard let data = json.data(using: .utf8), let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw EditorJSONError.invalidJSON
        }
        guard let canvas = object["canvas"] as? [String: Any] else { throw EditorJSONError.missingField("canvas") }
        guard let records = canvas["images"] as? [String: Any] else { throw EditorJSONError.missingField("images") }
        var images: [String: CanvasImage] = [:]
        for (id, value) in records {
            guard let record = value as? [String: Any] else { continue }
            images[id] = try parseImage(record)
        }
        return MobileCanvasDocument(
            rawJSON: json,
            images: images,
            imageOrder: canvas["imageOrder"] as? [String] ?? [],
            focusedImageIds: canvas["focusedImageIds"] as? [String] ?? []
        )
    }

    private static func parseImage(_ record: [String: Any]) throws -> CanvasImage {
        guard let id = record["id"] as? String else { throw EditorJSONError.missingField("id") }
        guard let url = record["url"] as? String else { throw EditorJSONError.missingField("url") }
        guard let sizeRecord = record["size"] as? [String: Any] else { throw EditorJSONError.missingField("size") }
        guard let positionRecord = record["position"] as? [String: Any] else { throw EditorJSONError.missingField("position") }
        let annotations = CanvasAnnotations(
            paths: (record["paths"] as? [[String: Any]] ?? []).compactMap(parsePath),
            boxes: (record["boxes"] as? [[String: Any]] ?? []).compactMap(parseBox),
            memos: (record["memos"] as? [[String: Any]] ?? []).compactMap(parseMemo)
        )
        return CanvasImage(
            id: id,
            url: url,
            assetId: record["assetId"] as? String,
            size: EditorSize(width: number(sizeRecord["width"]), height: number(sizeRecord["height"])),
            position: EditorPoint(x: number(positionRecord["x"]), y: number(positionRecord["y"])),
            parentId: record["parentId"] as? String,
            generationIndex: optionalInt(record["generationIndex"]) ?? 0,
            generationBatchId: record["generationBatchId"] as? String,
            batchIndex: optionalInt(record["batchIndex"]),
            prompt: record["prompt"] as? String ?? "",
            provider: EditorProvider(rawValue: record["provider"] as? String ?? "openai") ?? .openAI,
            mode: EditorMode(rawValue: record["type"] as? String ?? "generate") ?? .generate,
            createdAt: number(record["createdAt"]),
            annotations: annotations,
            hasMagicLayerFields: record["magicLayers"] != nil || record["magicLayerBaseUrl"] != nil || record["magicLayerStatus"] != nil || record["selectedMagicLayerId"] != nil,
            status: .ready,
            userErrorMessage: nil
        )
    }

    private static func parsePath(_ record: [String: Any]) -> DrawingPath? {
        guard let id = record["id"] as? String, let toolName = record["tool"] as? String, let tool = DrawingTool(rawValue: toolName) else { return nil }
        let points = (record["points"] as? [[String: Any]] ?? []).map { EditorPoint(x: number($0["x"]), y: number($0["y"])) }
        return DrawingPath(id: id, tool: tool, points: points, color: record["color"] as? String ?? "#ffffff", strokeWidth: number(record["strokeWidth"]))
    }

    private static func parseBox(_ record: [String: Any]) -> BoundingBox? {
        guard let id = record["id"] as? String else { return nil }
        let status = AnnotationStatus(rawValue: record["status"] as? String ?? "pending") ?? .pending
        return BoundingBox(id: id, x: number(record["x"]), y: number(record["y"]), width: number(record["width"]), height: number(record["height"]), color: record["color"] as? String ?? "#ffffff", status: status)
    }

    private static func parseMemo(_ record: [String: Any]) -> TextMemo? {
        guard let id = record["id"] as? String else { return nil }
        return TextMemo(id: id, x: number(record["x"]), y: number(record["y"]), text: record["text"] as? String ?? "", color: record["color"] as? String ?? "#111111")
    }

    private static func number(_ value: Any?) -> Double {
        if let value = value as? Double { return value }
        if let value = value as? Int { return Double(value) }
        return 0
    }

    private static func optionalInt(_ value: Any?) -> Int? {
        if let value = value as? Int { return value }
        if let value = value as? Double { return Int(exactly: value) }
        return nil
    }
}
