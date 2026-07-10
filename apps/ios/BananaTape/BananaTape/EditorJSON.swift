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
            generationIndex: Int(number(record["generationIndex"])),
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
        self.focusedImageId = focusedImageId
        self.activeRequestId = activeRequestId
        self.activeParentHistoryId = activeParentHistoryId
        self.userErrorMessage = userErrorMessage
        self.lifecyclePhase = lifecyclePhase
    }

    var pendingImages: [CanvasImage] { images.filter { $0.status == .pending } }
    var readyImages: [CanvasImage] { images.filter { $0.status == .ready } }
    var historyBrowserState: NativeHistoryBrowserState { NativeHistoryBrowserState(entries: history, selectedEntryId: history.last?.id) }

    func startingGenerate(prompt: String, requestId: String, network: NetworkReachability, provider: EditorProvider = .mock) -> ProviderPipelineState {
        guard network == .online else { return withError(AdapterError.offline.userMessage) }
        let placeholder = placeholderImage(id: pendingImageId(for: requestId), requestId: requestId, prompt: prompt, provider: provider, mode: .generate, parentId: nil, generationIndex: images.count)
        return ProviderPipelineState(images: images + [placeholder], history: history, focusedImageId: placeholder.id, activeRequestId: requestId)
    }

    func startingEdit(prompt: String, annotations: CanvasAnnotations, requestId: String, network: NetworkReachability, provider: EditorProvider = .mock) -> ProviderPipelineState {
        guard network == .online else { return withError(AdapterError.offline.userMessage) }
        guard let parentImage = focusedReadyImage, let parentHistory = history.last(where: { $0.id == parentImage.id || $0.assetId == parentImage.assetId }) else { return withError("Select an image before editing.") }
        let placeholder = placeholderImage(id: pendingImageId(for: requestId), requestId: requestId, prompt: prompt, provider: provider, mode: .edit, parentId: parentImage.id, generationIndex: images.count, annotations: annotations)
        return ProviderPipelineState(images: images + [placeholder], history: history, focusedImageId: placeholder.id, activeRequestId: requestId, activeParentHistoryId: parentHistory.id)
    }

    func applying(_ result: ProviderImageResult) -> ProviderPipelineState {
        guard activeRequestId == result.requestId, let pending = images.first(where: { $0.id == pendingImageId(for: result.requestId) && $0.status == .pending }) else { return self }
        let ready = pending.ready(result)
        let entry = HistoryEntry(id: ready.id, mode: ready.mode, provider: ready.provider, prompt: ready.prompt, assetId: result.assetId, assetPath: result.assetPath, parentId: ready.mode == .edit ? activeParentHistoryId : nil, createdAt: result.createdAt, timestamp: result.timestamp)
        return ProviderPipelineState(images: images.map { $0.id == pending.id ? ready : $0 }, history: history + [entry], focusedImageId: ready.id, lifecyclePhase: lifecyclePhase)
    }

    func failing(requestId: String, message: String) -> ProviderPipelineState {
        guard activeRequestId == requestId else { return self }
        let nextImages = images.filter { !($0.id == pendingImageId(for: requestId) && $0.status == .pending) }
        return ProviderPipelineState(images: nextImages, history: history, focusedImageId: nextImages.last(where: { $0.status == .ready })?.id, userErrorMessage: message)
    }

    func canceling(requestId: String) -> ProviderPipelineState {
        guard activeRequestId == requestId else { return self }
        let nextImages = images.filter { !($0.id == pendingImageId(for: requestId) && $0.status == .pending) }
        return ProviderPipelineState(images: nextImages, history: history, focusedImageId: nextImages.last(where: { $0.status == .ready })?.id, lifecyclePhase: lifecyclePhase)
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
    private func placeholderImage(id: String, requestId: String, prompt: String, provider: EditorProvider, mode: EditorMode, parentId: String?, generationIndex: Int, annotations: CanvasAnnotations = .empty) -> CanvasImage {
        CanvasImage(id: id, url: "mock://pending/\(requestId)", assetId: nil, size: EditorSize(width: 1024, height: 1024), position: EditorPoint(x: 0, y: 0), parentId: parentId, generationIndex: generationIndex, prompt: prompt, provider: provider, mode: mode, createdAt: Double(generationIndex), annotations: annotations, hasMagicLayerFields: false, status: .pending, userErrorMessage: nil)
    }
}

private extension CanvasImage {
    func ready(_ result: ProviderImageResult) -> CanvasImage {
        CanvasImage(id: id, url: result.imageURL, assetId: result.assetId, size: result.size, position: position, parentId: parentId, generationIndex: generationIndex, prompt: prompt, provider: provider, mode: mode, createdAt: createdAt, annotations: annotations, hasMagicLayerFields: false, status: .ready, userErrorMessage: nil)
    }
}
