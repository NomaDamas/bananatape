import Foundation

struct EditorPoint: Equatable {
    let x: Double
    let y: Double
}

struct EditorSize: Equatable {
    let width: Double
    let height: Double
}

enum EditorProvider: String, Equatable {
    case mock
    case openAI = "openai"
    case codex = "god-tibo"
}

enum ImageGenerationStatus: String, Equatable {
    case pending
    case ready
    case error
}

enum EditorMode: String, Equatable {
    case generate
    case edit
}

enum OutputSize: String, Equatable {
    case square = "1024x1024"
    case portrait = "1024x1536"
    case landscape = "1536x1024"
}

enum AnnotationStatus: String, Equatable {
    case pending
    case review
    case accepted
}

enum DrawingTool: String, Equatable {
    case pen
    case arrow
}

struct DrawingPath: Equatable {
    let id: String
    let tool: DrawingTool
    let points: [EditorPoint]
    let color: String
    let strokeWidth: Double
}

struct BoundingBox: Equatable {
    let id: String
    let x: Double
    let y: Double
    let width: Double
    let height: Double
    let color: String
    let status: AnnotationStatus
}

struct TextMemo: Equatable {
    let id: String
    let x: Double
    let y: Double
    let text: String
    let color: String
}

struct CanvasAnnotations: Equatable {
    let paths: [DrawingPath]
    let boxes: [BoundingBox]
    let memos: [TextMemo]

    static let empty = CanvasAnnotations(paths: [], boxes: [], memos: [])
}

struct CanvasImage: Equatable {
    let id: String
    let url: String
    let assetId: String?
    let size: EditorSize
    let position: EditorPoint
    let parentId: String?
    let generationIndex: Int
    let generationBatchId: String?
    let batchIndex: Int?
    let prompt: String
    let provider: EditorProvider
    let mode: EditorMode
    let createdAt: Double
    let annotations: CanvasAnnotations
    let hasMagicLayerFields: Bool
    let status: ImageGenerationStatus
    let userErrorMessage: String?

    init(id: String, url: String, assetId: String?, size: EditorSize, position: EditorPoint, parentId: String?, generationIndex: Int, generationBatchId: String? = nil, batchIndex: Int? = nil, prompt: String, provider: EditorProvider, mode: EditorMode, createdAt: Double, annotations: CanvasAnnotations, hasMagicLayerFields: Bool, status: ImageGenerationStatus, userErrorMessage: String?) {
        self.id = id
        self.url = url
        self.assetId = assetId
        self.size = size
        self.position = position
        self.parentId = parentId
        self.generationIndex = generationIndex
        self.generationBatchId = generationBatchId
        self.batchIndex = batchIndex
        self.prompt = prompt
        self.provider = provider
        self.mode = mode
        self.createdAt = createdAt
        self.annotations = annotations
        self.hasMagicLayerFields = hasMagicLayerFields
        self.status = status
        self.userErrorMessage = userErrorMessage
    }

    var canEditMagicLayers: Bool { false }
    static let magicLayerEditingMessage = "Magic Layer editing is desktop-only"
}

struct EditorState: Equatable {
    let provider: EditorProvider
    let mode: EditorMode
    let outputSize: OutputSize
    let focusedImageIds: [String]
}
