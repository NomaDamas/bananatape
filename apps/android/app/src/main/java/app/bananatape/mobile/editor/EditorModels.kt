package app.bananatape.mobile.editor

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

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

enum class LineageDirection {
    LEFT,
    RIGHT,
    UP,
    DOWN,
}

fun lineageSwipeDirection(
    tool: CanvasTool,
    deltaX: Float,
    deltaY: Float,
    minimumDistance: Float = 48f,
    axisDominanceRatio: Float = 1.25f,
): LineageDirection? {
    if (tool != CanvasTool.SELECT) return null
    val horizontalDistance = abs(deltaX)
    val verticalDistance = abs(deltaY)
    val dominantDistance = max(horizontalDistance, verticalDistance)
    val secondaryDistance = min(horizontalDistance, verticalDistance)
    if (dominantDistance < minimumDistance || dominantDistance < secondaryDistance * axisDominanceRatio) return null
    return if (horizontalDistance > verticalDistance) {
        if (deltaX < 0f) LineageDirection.RIGHT else LineageDirection.LEFT
    } else {
        if (deltaY < 0f) LineageDirection.DOWN else LineageDirection.UP
    }
}

fun ComposerState.withFocusedImageSelection(image: CanvasImage?): ComposerState =
    copy(
        hasSelectedImage = image?.status == ImageGenerationStatus.READY,
        mode = if (image?.status == ImageGenerationStatus.READY) EditorMode.EDIT else EditorMode.GENERATE,
    )

fun ComposerState.openingForFocusedImage(image: CanvasImage?): ComposerState =
    withFocusedImageSelection(image)

fun ComposerState.startingNewGeneration(): ComposerState =
    copy(mode = EditorMode.GENERATE)

fun resolvedSubmissionMode(composerMode: EditorMode, focusedImage: CanvasImage?): EditorMode =
    if (focusedImage?.status == ImageGenerationStatus.READY) composerMode else EditorMode.GENERATE

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
    val generationBatchId: String? = null,
    val batchIndex: Int? = null,
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
