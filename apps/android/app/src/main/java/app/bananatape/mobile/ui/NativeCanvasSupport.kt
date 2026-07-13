package app.bananatape.mobile.ui

import androidx.compose.ui.input.pointer.PointerType
import app.bananatape.mobile.editor.AnnotationStatus
import app.bananatape.mobile.editor.BoundingBox
import app.bananatape.mobile.editor.CanvasAnnotations
import app.bananatape.mobile.editor.CanvasTool
import app.bananatape.mobile.editor.DrawingPath
import app.bananatape.mobile.editor.DrawingTool
import app.bananatape.mobile.editor.EditorPoint
import app.bananatape.mobile.editor.TextMemo
import kotlin.math.hypot
import kotlin.math.min

internal data class CanvasRect(
    val left: Double,
    val top: Double,
    val width: Double,
    val height: Double,
) {
    val right: Double get() = left + width
    val bottom: Double get() = top + height

    fun contains(point: EditorPoint): Boolean =
        width > 0.0 && height > 0.0 && point.x in left..right && point.y in top..bottom

    fun transformed(zoom: Double, pan: EditorPoint): CanvasRect {
        val appliedZoom = zoom.coerceAtLeast(0.0)
        val scaledWidth = width * appliedZoom
        val scaledHeight = height * appliedZoom
        return CanvasRect(
            left = left + (width - scaledWidth) / 2.0 + pan.x,
            top = top + (height - scaledHeight) / 2.0 + pan.y,
            width = scaledWidth,
            height = scaledHeight,
        )
    }
}

internal fun fitCenterDestinationRect(
    sourceWidth: Double,
    sourceHeight: Double,
    availableWidth: Double,
    availableHeight: Double,
): CanvasRect {
    if (sourceWidth <= 0.0 || sourceHeight <= 0.0 || availableWidth <= 0.0 || availableHeight <= 0.0) {
        return CanvasRect(0.0, 0.0, 0.0, 0.0)
    }
    val scale = min(availableWidth / sourceWidth, availableHeight / sourceHeight)
    val width = sourceWidth * scale
    val height = sourceHeight * scale
    return CanvasRect(
        left = (availableWidth - width) / 2.0,
        top = (availableHeight - height) / 2.0,
        width = width,
        height = height,
    )
}

internal fun normalizeCanvasPoint(point: EditorPoint, destination: CanvasRect): EditorPoint = EditorPoint(
    x = ((point.x - destination.left) / destination.width.coerceAtLeast(1.0)).coerceIn(0.0, 1.0),
    y = ((point.y - destination.top) / destination.height.coerceAtLeast(1.0)).coerceIn(0.0, 1.0),
)

internal fun denormalizeCanvasPoint(point: EditorPoint, destination: CanvasRect): EditorPoint = EditorPoint(
    x = destination.left + point.x * destination.width,
    y = destination.top + point.y * destination.height,
)

internal fun acceptsAnnotationPointer(pointerType: PointerType): Boolean =
    pointerType == PointerType.Touch ||
        pointerType == PointerType.Stylus ||
        pointerType == PointerType.Eraser ||
        pointerType == PointerType.Mouse

internal data class ArrowHeadGeometry(
    val tip: EditorPoint,
    val left: EditorPoint,
    val right: EditorPoint,
)

internal fun arrowHeadGeometry(
    start: EditorPoint,
    end: EditorPoint,
    preferredHeadLength: Double,
): ArrowHeadGeometry? {
    val deltaX = end.x - start.x
    val deltaY = end.y - start.y
    val shaftLength = hypot(deltaX, deltaY)
    if (shaftLength <= 0.0001 || preferredHeadLength <= 0.0) return null

    val headLength = min(preferredHeadLength, shaftLength * 0.6)
    val unitX = deltaX / shaftLength
    val unitY = deltaY / shaftLength
    val perpendicularX = -unitY
    val perpendicularY = unitX
    val halfWidth = headLength * 0.55
    val baseX = end.x - unitX * headLength
    val baseY = end.y - unitY * headLength
    return ArrowHeadGeometry(
        tip = end,
        left = EditorPoint(baseX - perpendicularX * halfWidth, baseY - perpendicularY * halfWidth),
        right = EditorPoint(baseX + perpendicularX * halfWidth, baseY + perpendicularY * halfWidth),
    )
}

internal data class AnnotationDraft(
    val tool: CanvasTool,
    val start: EditorPoint,
    val current: EditorPoint,
    private val sampledPoints: List<EditorPoint>,
) {
    val visiblePathPoints: List<EditorPoint>
        get() = when (tool) {
            CanvasTool.PEN -> sampledPoints
            CanvasTool.ARROW -> listOf(start, current)
            else -> emptyList()
        }

    fun movedTo(point: EditorPoint): AnnotationDraft = when (tool) {
        CanvasTool.PEN -> copy(
            current = point,
            sampledPoints = if (point == current) sampledPoints else sampledPoints + point,
        )
        CanvasTool.ARROW, CanvasTool.BOX -> copy(current = point)
        else -> this
    }
}

internal fun beginAnnotationDraft(tool: CanvasTool, start: EditorPoint): AnnotationDraft? = when (tool) {
    CanvasTool.PEN, CanvasTool.ARROW, CanvasTool.BOX -> AnnotationDraft(
        tool = tool,
        start = start,
        current = start,
        sampledPoints = listOf(start),
    )
    else -> null
}

internal fun commitAnnotationDraft(
    annotations: CanvasAnnotations,
    draft: AnnotationDraft,
    id: String,
): CanvasAnnotations = when (draft.tool) {
    CanvasTool.PEN, CanvasTool.ARROW -> {
        val points = draft.visiblePathPoints.let { if (it.size == 1) it + it.first() else it }
        annotations.copy(
            paths = annotations.paths + DrawingPath(
                id = id,
                tool = if (draft.tool == CanvasTool.ARROW) DrawingTool.ARROW else DrawingTool.PEN,
                points = points,
                color = if (draft.tool == CanvasTool.ARROW) "#0d99ff" else "#ffffff",
                strokeWidth = if (draft.tool == CanvasTool.ARROW) 3.0 else 2.0,
            ),
        )
    }
    CanvasTool.BOX -> annotations.copy(
        boxes = annotations.boxes + BoundingBox(
            id = id,
            x = minOf(draft.start.x, draft.current.x),
            y = minOf(draft.start.y, draft.current.y),
            width = kotlin.math.abs(draft.current.x - draft.start.x),
            height = kotlin.math.abs(draft.current.y - draft.start.y),
            color = "#0d99ff",
            status = AnnotationStatus.PENDING,
        ),
    )
    else -> annotations
}

internal data class MemoCreation(
    val annotations: CanvasAnnotations,
    val memo: TextMemo,
)

internal fun createMemoAtTap(
    annotations: CanvasAnnotations,
    id: String,
    tap: EditorPoint,
    destination: CanvasRect,
): MemoCreation? {
    if (!destination.contains(tap)) return null
    val position = normalizeCanvasPoint(tap, destination)
    val memo = TextMemo(id = id, x = position.x, y = position.y, text = "", color = "#ffe066")
    return MemoCreation(annotations = annotations.copy(memos = annotations.memos + memo), memo = memo)
}

internal fun updateMemoText(
    annotations: CanvasAnnotations,
    memoId: String,
    text: String,
): CanvasAnnotations = annotations.copy(
    memos = annotations.memos.map { memo -> if (memo.id == memoId) memo.copy(text = text) else memo },
)

internal fun memoOverlayRect(
    memo: TextMemo,
    destination: CanvasRect,
    preferredWidth: Double,
    preferredHeight: Double,
): CanvasRect {
    val width = min(preferredWidth.coerceAtLeast(0.0), destination.width.coerceAtLeast(0.0))
    val height = min(preferredHeight.coerceAtLeast(0.0), destination.height.coerceAtLeast(0.0))
    val desiredLeft = destination.left + memo.x.coerceIn(0.0, 1.0) * destination.width
    val desiredTop = destination.top + memo.y.coerceIn(0.0, 1.0) * destination.height
    return CanvasRect(
        left = desiredLeft.coerceIn(destination.left, (destination.right - width).coerceAtLeast(destination.left)),
        top = desiredTop.coerceIn(destination.top, (destination.bottom - height).coerceAtLeast(destination.top)),
        width = width,
        height = height,
    )
}
