package app.bananatape.mobile.editor

data class EditorPoint(val x: Double, val y: Double)

data class EditorSize(val width: Double, val height: Double)

enum class EditorProvider(val value: String) {
    MOCK("mock"),
    OPENAI("openai"),
    CODEX("god-tibo"),
}

enum class ImageGenerationStatus(val value: String) {
    PENDING("pending"),
    READY("ready"),
    ERROR("error"),
}

enum class EditorMode(val value: String) {
    GENERATE("generate"),
    EDIT("edit"),
}

enum class OutputSize(val value: String) {
    SQUARE("1024x1024"),
    PORTRAIT("1024x1536"),
    LANDSCAPE("1536x1024"),
}

enum class AnnotationStatus(val value: String) {
    PENDING("pending"),
    REVIEW("review"),
    ACCEPTED("accepted"),
}

enum class DrawingTool(val value: String) {
    PEN("pen"),
    ARROW("arrow"),
}

data class DrawingPath(
    val id: String,
    val tool: DrawingTool,
    val points: List<EditorPoint>,
    val color: String,
    val strokeWidth: Double,
)

data class BoundingBox(
    val id: String,
    val x: Double,
    val y: Double,
    val width: Double,
    val height: Double,
    val color: String,
    val status: AnnotationStatus,
)

data class TextMemo(
    val id: String,
    val x: Double,
    val y: Double,
    val text: String,
    val color: String,
)

data class CanvasAnnotations(
    val paths: List<DrawingPath>,
    val boxes: List<BoundingBox>,
    val memos: List<TextMemo>,
) {
    companion object {
        val Empty = CanvasAnnotations(paths = emptyList(), boxes = emptyList(), memos = emptyList())
    }
}

data class CanvasImage(
    val id: String,
    val url: String,
    val assetId: String?,
    val size: EditorSize,
    val position: EditorPoint,
    val parentId: String?,
    val generationIndex: Int,
    val prompt: String,
    val provider: EditorProvider,
    val mode: EditorMode,
    val createdAt: Double,
    val annotations: CanvasAnnotations,
    val hasMagicLayerFields: Boolean,
    val status: ImageGenerationStatus = ImageGenerationStatus.READY,
    val userErrorMessage: String? = null,
) {
    val canEditMagicLayers: Boolean = false

    companion object {
        const val MagicLayerEditingMessage = "Magic Layer editing is desktop-only"
    }
}

data class EditorState(
    val provider: EditorProvider,
    val mode: EditorMode,
    val outputSize: OutputSize,
    val focusedImageIds: List<String>,
)
