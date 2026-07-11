package app.bananatape.mobile.ui

import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.input.pointer.pointerInput
import app.bananatape.mobile.editor.AnnotationStatus
import app.bananatape.mobile.editor.BoundingBox
import app.bananatape.mobile.editor.CanvasAnnotations
import app.bananatape.mobile.editor.CanvasTool
import app.bananatape.mobile.editor.CanvasViewport
import app.bananatape.mobile.editor.DrawingPath
import app.bananatape.mobile.editor.DrawingTool
import app.bananatape.mobile.editor.EditorPoint
import app.bananatape.mobile.editor.ImageGenerationStatus
import app.bananatape.mobile.editor.LineageDirection
import app.bananatape.mobile.editor.NativeCanvasState
import app.bananatape.mobile.editor.TextMemo
import app.bananatape.mobile.editor.lineageSwipeDirection
import java.io.File
import java.util.UUID
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

@Composable
fun NativeCanvasView(
    state: NativeCanvasState,
    modifier: Modifier = Modifier,
    onAnnotationsChange: (CanvasAnnotations) -> Unit = {},
    onViewportChange: (CanvasViewport) -> Unit = {},
    onLineageNavigate: (LineageDirection) -> Unit = {},
) {
    val decodedImage = remember(state.image.url) { decodeImage(state.image.url) }
    Box(
        modifier = modifier
            .shadow(28.dp, RoundedCornerShape(28.dp), ambientColor = Color.Black.copy(alpha = 0.45f), spotColor = Color.Black.copy(alpha = 0.55f))
            .clip(RoundedCornerShape(28.dp))
            .background(PrototypeColor.ImageShell)
            .border(androidx.compose.foundation.BorderStroke(1.dp, PrototypeColor.Border), RoundedCornerShape(28.dp))
            .semantics { contentDescription = "Focused image ${state.image.id}" },
        contentAlignment = Alignment.Center,
    ) {
        Canvas(
            modifier = Modifier
                .offset { IntOffset(state.viewport.pan.x.roundToInt(), state.viewport.pan.y.roundToInt()) }
                .size((state.image.size.width * state.viewport.zoom).dp, (state.image.size.height * state.viewport.zoom).dp)
                .pointerInput(state.tool, state.viewport, state.annotations) {
                    if (state.tool == CanvasTool.PAN) {
                        detectTransformGestures { _, pan, zoom, _ ->
                            onViewportChange(
                                CanvasViewport(
                                    pan = EditorPoint(state.viewport.pan.x + pan.x, state.viewport.pan.y + pan.y),
                                    zoom = (state.viewport.zoom * zoom).coerceIn(0.5, 4.0),
                                ),
                            )
                        }
                    } else if (state.tool == CanvasTool.SELECT) {
                        var totalDrag = Offset.Zero
                        detectDragGestures(
                            onDragStart = { totalDrag = Offset.Zero },
                            onDrag = { change, dragAmount -> totalDrag += dragAmount; change.consume() },
                            onDragEnd = {
                                lineageSwipeDirection(
                                    tool = state.tool,
                                    deltaX = totalDrag.x,
                                    deltaY = totalDrag.y,
                                    minimumDistance = 48.dp.toPx(),
                                )?.let(onLineageNavigate)
                            },
                        )
                    } else {
                        var start = Offset.Zero
                        var end = Offset.Zero
                        val points = mutableListOf<EditorPoint>()
                        detectDragGestures(
                            onDragStart = { position -> start = position; end = position; points += normalized(position, size.width.toFloat(), size.height.toFloat()) },
                            onDragEnd = {
                                val startPoint = normalized(start, size.width.toFloat(), size.height.toFloat())
                                val endPoint = normalized(end, size.width.toFloat(), size.height.toFloat())
                                val next = when (state.tool) {
                                    CanvasTool.PEN, CanvasTool.ARROW -> state.annotations.copy(paths = state.annotations.paths + DrawingPath(UUID.randomUUID().toString(), if (state.tool == CanvasTool.ARROW) DrawingTool.ARROW else DrawingTool.PEN, points.ifEmpty { listOf(startPoint, endPoint) }, if (state.tool == CanvasTool.ARROW) "#0d99ff" else "#ffffff", if (state.tool == CanvasTool.ARROW) 3.0 else 2.0))
                                    CanvasTool.BOX -> state.annotations.copy(boxes = state.annotations.boxes + BoundingBox(UUID.randomUUID().toString(), min(startPoint.x, endPoint.x), min(startPoint.y, endPoint.y), abs(endPoint.x - startPoint.x), abs(endPoint.y - startPoint.y), "#0d99ff", AnnotationStatus.PENDING))
                                    CanvasTool.MEMO -> state.annotations.copy(memos = state.annotations.memos + TextMemo(UUID.randomUUID().toString(), endPoint.x, endPoint.y, "Memo", "#ffe066"))
                                    CanvasTool.PAN, CanvasTool.SELECT -> state.annotations
                                }
                                onAnnotationsChange(next)
                            },
                            onDrag = { change, _ -> end = change.position; if (state.tool == CanvasTool.PEN || state.tool == CanvasTool.ARROW) points += normalized(change.position, size.width.toFloat(), size.height.toFloat()); change.consume() },
                        )
                    }
                }
                .semantics { contentDescription = "Native annotation canvas" },
        ) {
            drawRoundRect(color = PrototypeColor.ImageShell, size = size, cornerRadius = CornerRadius(28.dp.toPx()))
            if (decodedImage != null) {
                drawImage(image = decodedImage, dstSize = IntSize(size.width.roundToInt(), size.height.roundToInt()))
            }
            drawRoundRect(color = PrototypeColor.Accent.copy(alpha = 0.86f), size = size, cornerRadius = CornerRadius(28.dp.toPx()), style = Stroke(width = 2.dp.toPx()))
            state.annotations.paths.forEach { drawingPath ->
                val path = Path()
                drawingPath.points.forEachIndexed { index, point ->
                    val offset = Offset((point.x * size.width).toFloat(), (point.y * size.height).toFloat())
                    if (index == 0) path.moveTo(offset.x, offset.y) else path.lineTo(offset.x, offset.y)
                }
                drawPath(path = path, color = Color.White, style = Stroke(width = drawingPath.strokeWidth.dp.toPx()))
            }
            state.annotations.boxes.forEach { box ->
                drawRect(
                    color = PrototypeColor.Accent,
                    topLeft = Offset((box.x * size.width).toFloat(), (box.y * size.height).toFloat()),
                    size = Size((box.width * size.width).toFloat(), (box.height * size.height).toFloat()),
                    style = Stroke(width = 2.dp.toPx()),
                )
            }
            state.annotations.memos.forEach { memo ->
                drawRoundRect(
                    color = Color(0xFFFFE066),
                    topLeft = Offset((memo.x * size.width).toFloat(), (memo.y * size.height).toFloat()),
                    size = Size(88.dp.toPx(), 44.dp.toPx()),
                    cornerRadius = CornerRadius(12.dp.toPx()),
                )
            }
        }
        if (state.image.status == ImageGenerationStatus.PENDING) {
            Text(text = "Generating image...", color = PrototypeColor.TextSecondary, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
        } else if (decodedImage == null && state.image.url.startsWith("mock://pending")) {
            Text(text = "Preparing canvas...", color = PrototypeColor.TextMuted, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

private fun decodeImage(url: String) = runCatching {
    val marker = "base64,"
    val index = url.indexOf(marker)
    if (url.startsWith("data:image") && index != -1) {
        val bytes = Base64.decode(url.substring(index + marker.length), Base64.DEFAULT)
        return@runCatching BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.asImageBitmap()
    }
    val path = if (url.startsWith("file:")) Uri.parse(url).path else null
    path?.let { BitmapFactory.decodeFile(File(it).absolutePath)?.asImageBitmap() }
}.getOrNull()

private fun normalized(point: Offset, width: Float, height: Float): EditorPoint = EditorPoint(
    x = (point.x / max(width, 1f)).coerceIn(0f, 1f).toDouble(),
    y = (point.y / max(height, 1f)).coerceIn(0f, 1f).toDouble(),
)

@Preview(showBackground = true)
@Composable
private fun NativeCanvasPreview() {
    NativeCanvasView(state = NativeCanvasState(image = NativeCanvasState.FixtureImage))
}
