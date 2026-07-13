package app.bananatape.mobile.ui

import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.bananatape.mobile.editor.CanvasAnnotations
import app.bananatape.mobile.editor.CanvasTool
import app.bananatape.mobile.editor.CanvasViewport
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
import kotlin.math.hypot
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
    val density = LocalDensity.current
    val keyboardController = LocalSoftwareKeyboardController.current
    val memoFocusRequester = remember { FocusRequester() }
    var canvasSize by remember(state.image.id) { mutableStateOf(IntSize.Zero) }
    var draft by remember(state.image.id, state.tool) { mutableStateOf<AnnotationDraft?>(null) }
    var editingMemo by remember(state.image.id) { mutableStateOf<TextMemo?>(null) }

    val sourceWidth = decodedImage?.width?.toDouble()?.takeIf { it > 0.0 } ?: state.image.size.width
    val sourceHeight = decodedImage?.height?.toDouble()?.takeIf { it > 0.0 } ?: state.image.size.height
    val fittedDestination = remember(sourceWidth, sourceHeight, canvasSize) {
        fitCenterDestinationRect(
            sourceWidth = sourceWidth,
            sourceHeight = sourceHeight,
            availableWidth = canvasSize.width.toDouble(),
            availableHeight = canvasSize.height.toDouble(),
        )
    }
    val imageDestination = remember(fittedDestination, state.viewport) {
        fittedDestination.transformed(zoom = state.viewport.zoom, pan = state.viewport.pan)
    }

    LaunchedEffect(editingMemo?.id) {
        if (editingMemo != null) {
            memoFocusRequester.requestFocus()
            keyboardController?.show()
        }
    }

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
                .fillMaxSize()
                .onSizeChanged { canvasSize = it }
                .pointerInput(state.tool, state.viewport, state.annotations, imageDestination) {
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
                        awaitEachGesture {
                            val down = awaitFirstDown(requireUnconsumed = false)
                            if (!acceptsAnnotationPointer(down.type)) return@awaitEachGesture

                            val downPoint = EditorPoint(down.position.x.toDouble(), down.position.y.toDouble())
                            if (!imageDestination.contains(downPoint)) return@awaitEachGesture

                            down.consume()
                            val normalizedDown = normalizeCanvasPoint(downPoint, imageDestination)
                            var gestureDraft = beginAnnotationDraft(state.tool, normalizedDown)
                            var lastChange = down
                            var completed = false
                            var maxMovement = 0.0
                            draft = gestureDraft

                            try {
                                while (lastChange.pressed) {
                                    val event = awaitPointerEvent()
                                    val change = event.changes.firstOrNull { it.id == down.id } ?: break
                                    if (change.isConsumed) break
                                    val point = EditorPoint(change.position.x.toDouble(), change.position.y.toDouble())
                                    maxMovement = maxOf(
                                        maxMovement,
                                        hypot(point.x - downPoint.x, point.y - downPoint.y),
                                    )
                                    gestureDraft = gestureDraft?.movedTo(normalizeCanvasPoint(point, imageDestination))
                                    draft = gestureDraft
                                    change.consume()
                                    completed = !change.pressed
                                    lastChange = change
                                }

                                if (completed && state.tool == CanvasTool.MEMO && maxMovement <= viewConfiguration.touchSlop) {
                                    createMemoAtTap(
                                        annotations = state.annotations,
                                        id = UUID.randomUUID().toString(),
                                        tap = EditorPoint(lastChange.position.x.toDouble(), lastChange.position.y.toDouble()),
                                        destination = imageDestination,
                                    )?.let { creation ->
                                        editingMemo = creation.memo
                                        onAnnotationsChange(creation.annotations)
                                    }
                                } else if (completed && gestureDraft != null) {
                                    onAnnotationsChange(
                                        commitAnnotationDraft(
                                            annotations = state.annotations,
                                            draft = gestureDraft,
                                            id = UUID.randomUUID().toString(),
                                        ),
                                    )
                                }
                            } finally {
                                draft = null
                            }
                        }
                    }
                }
                .semantics { contentDescription = "Native annotation canvas" },
        ) {
            drawRoundRect(color = PrototypeColor.ImageShell, size = size, cornerRadius = CornerRadius(28.dp.toPx()))
            if (decodedImage != null && imageDestination.width > 0.0 && imageDestination.height > 0.0) {
                drawImage(
                    image = decodedImage,
                    dstOffset = IntOffset(imageDestination.left.roundToInt(), imageDestination.top.roundToInt()),
                    dstSize = IntSize(
                        imageDestination.width.roundToInt().coerceAtLeast(1),
                        imageDestination.height.roundToInt().coerceAtLeast(1),
                    ),
                )
            }
            if (imageDestination.width > 0.0 && imageDestination.height > 0.0) {
                drawRoundRect(
                    color = PrototypeColor.Accent.copy(alpha = 0.86f),
                    topLeft = Offset(imageDestination.left.toFloat(), imageDestination.top.toFloat()),
                    size = Size(imageDestination.width.toFloat(), imageDestination.height.toFloat()),
                    cornerRadius = CornerRadius(20.dp.toPx()),
                    style = Stroke(width = 2.dp.toPx()),
                )
            }
            state.annotations.paths.forEach { drawingPath ->
                drawCanvasPath(
                    points = drawingPath.points,
                    tool = drawingPath.tool,
                    color = if (drawingPath.tool == DrawingTool.ARROW) PrototypeColor.Accent else Color.White,
                    strokeWidthPx = drawingPath.strokeWidth.dp.toPx(),
                    destination = imageDestination,
                )
            }
            state.annotations.boxes.forEach { box ->
                drawRect(
                    color = PrototypeColor.Accent,
                    topLeft = Offset(
                        (imageDestination.left + box.x * imageDestination.width).toFloat(),
                        (imageDestination.top + box.y * imageDestination.height).toFloat(),
                    ),
                    size = Size(
                        (box.width * imageDestination.width).toFloat(),
                        (box.height * imageDestination.height).toFloat(),
                    ),
                    style = Stroke(width = 2.dp.toPx()),
                )
            }
            draft?.let { currentDraft ->
                if (currentDraft.tool == CanvasTool.BOX) {
                    val start = denormalizeCanvasPoint(currentDraft.start, imageDestination)
                    val end = denormalizeCanvasPoint(currentDraft.current, imageDestination)
                    drawRect(
                        color = PrototypeColor.Accent.copy(alpha = 0.82f),
                        topLeft = Offset(min(start.x, end.x).toFloat(), min(start.y, end.y).toFloat()),
                        size = Size(abs(end.x - start.x).toFloat(), abs(end.y - start.y).toFloat()),
                        style = Stroke(width = 2.dp.toPx()),
                    )
                } else {
                    drawCanvasPath(
                        points = currentDraft.visiblePathPoints,
                        tool = if (currentDraft.tool == CanvasTool.ARROW) DrawingTool.ARROW else DrawingTool.PEN,
                        color = if (currentDraft.tool == CanvasTool.ARROW) PrototypeColor.Accent else Color.White,
                        strokeWidthPx = if (currentDraft.tool == CanvasTool.ARROW) 3.dp.toPx() else 2.dp.toPx(),
                        destination = imageDestination,
                    )
                }
            }
        }

        val memoWidthPx = with(density) { 140.dp.toPx().toDouble() }
        val memoHeightPx = with(density) { 84.dp.toPx().toDouble() }
        val displayedMemos = buildList {
            state.annotations.memos.forEach { memo ->
                add(if (memo.id == editingMemo?.id) editingMemo ?: memo else memo)
            }
            editingMemo?.let { memo -> if (none { it.id == memo.id }) add(memo) }
        }
        displayedMemos.forEach { memo ->
            val overlay = memoOverlayRect(
                memo = memo,
                destination = imageDestination,
                preferredWidth = memoWidthPx,
                preferredHeight = memoHeightPx,
            )
            if (overlay.width <= 0.0 || overlay.height <= 0.0) return@forEach

            val memoModifier = Modifier
                .align(Alignment.TopStart)
                .offset { IntOffset(overlay.left.roundToInt(), overlay.top.roundToInt()) }
                .size(
                    width = with(density) { overlay.width.toFloat().toDp() },
                    height = with(density) { overlay.height.toFloat().toDp() },
                )
                .clip(RoundedCornerShape(6.dp))
                .background(Color(0xFFFFE066))
                .border(androidx.compose.foundation.BorderStroke(1.dp, Color(0x55332900)), RoundedCornerShape(6.dp))
                .padding(10.dp)
                .semantics { contentDescription = "Sticky memo ${memo.id}" }

            if (memo.id == editingMemo?.id) {
                BasicTextField(
                    value = memo.text,
                    onValueChange = { text ->
                        val updatedMemo = memo.copy(text = text)
                        editingMemo = updatedMemo
                        val annotationsWithMemo = if (state.annotations.memos.any { it.id == memo.id }) {
                            state.annotations
                        } else {
                            state.annotations.copy(memos = state.annotations.memos + memo)
                        }
                        onAnnotationsChange(updateMemoText(annotationsWithMemo, memo.id, text))
                    },
                    textStyle = TextStyle(color = Color(0xFF332900), fontSize = 14.sp),
                    modifier = memoModifier.focusRequester(memoFocusRequester),
                )
            } else {
                Text(
                    text = memo.text,
                    color = Color(0xFF332900),
                    fontSize = 14.sp,
                    maxLines = 4,
                    overflow = TextOverflow.Ellipsis,
                    modifier = memoModifier,
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

private fun DrawScope.drawCanvasPath(
    points: List<EditorPoint>,
    tool: DrawingTool,
    color: Color,
    strokeWidthPx: Float,
    destination: CanvasRect,
) {
    if (points.isEmpty() || destination.width <= 0.0 || destination.height <= 0.0) return
    val pixelPoints = points.map { denormalizeCanvasPoint(it, destination) }
    if (pixelPoints.all { it == pixelPoints.first() }) {
        drawCircle(
            color = color,
            radius = strokeWidthPx.coerceAtLeast(1f) / 2f,
            center = Offset(pixelPoints.first().x.toFloat(), pixelPoints.first().y.toFloat()),
        )
        return
    }

    val path = Path()
    pixelPoints.forEachIndexed { index, point ->
        if (index == 0) path.moveTo(point.x.toFloat(), point.y.toFloat()) else path.lineTo(point.x.toFloat(), point.y.toFloat())
    }
    drawPath(
        path = path,
        color = color,
        style = Stroke(width = strokeWidthPx, cap = StrokeCap.Round, join = StrokeJoin.Round),
    )
    if (tool == DrawingTool.ARROW && pixelPoints.size >= 2) {
        arrowHeadGeometry(
            start = pixelPoints[pixelPoints.lastIndex - 1],
            end = pixelPoints.last(),
            preferredHeadLength = maxOf(12.dp.toPx().toDouble(), strokeWidthPx * 4.0),
        )?.let { head ->
            drawLine(
                color = color,
                start = Offset(head.tip.x.toFloat(), head.tip.y.toFloat()),
                end = Offset(head.left.x.toFloat(), head.left.y.toFloat()),
                strokeWidth = strokeWidthPx,
                cap = StrokeCap.Round,
            )
            drawLine(
                color = color,
                start = Offset(head.tip.x.toFloat(), head.tip.y.toFloat()),
                end = Offset(head.right.x.toFloat(), head.right.y.toFloat()),
                strokeWidth = strokeWidthPx,
                cap = StrokeCap.Round,
            )
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

@Preview(showBackground = true)
@Composable
private fun NativeCanvasPreview() {
    NativeCanvasView(state = NativeCanvasState(image = NativeCanvasState.FixtureImage))
}
