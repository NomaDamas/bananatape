package app.bananatape.mobile.editor

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path as AndroidPath
import android.graphics.RectF
import java.nio.file.Files
import java.nio.file.Path
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.sin

data class NativeImageMetadata(
    val width: Int,
    val height: Int,
    val byteCount: Int,
    val mimeType: String,
)

data class NativeComposedImage(
    val filePath: Path,
    val metadata: NativeImageMetadata,
)

data class NativeExportPreview(
    val source: NativeImageMetadata,
    val annotated: NativeImageMetadata,
    val mask: NativeImageMetadata,
    val canvasSize: EditorSize,
)

data class NativeImageCompositionResult(
    val original: NativeImageMetadata,
    val annotated: NativeComposedImage,
    val mask: NativeComposedImage,
    val exportPreview: NativeExportPreview,
)

sealed class NativeImageCompositionError(val userMessage: String) {
    data object UnreadableSource : NativeImageCompositionError("This image could not be prepared for export.")
    data object RenderFailed : NativeImageCompositionError("This image could not be prepared for export.")
    data class ImageTooLarge(val maxPixels: Int, val actualPixels: Int) : NativeImageCompositionError("This image is too large to prepare on this device.")
}

data class NativeImageCompositionRequest(
    val sourcePath: Path,
    val annotations: CanvasAnnotations,
    val outputDirectory: Path,
)

sealed class NativeImageCompositionOutcome {
    data class Success(val result: NativeImageCompositionResult) : NativeImageCompositionOutcome()
    data class Failure(val error: NativeImageCompositionError) : NativeImageCompositionOutcome()
}

interface NativeImageRenderer {
    fun metadata(sourcePath: Path): NativeImageMetadata?
    fun annotatedPng(sourcePath: Path, annotations: CanvasAnnotations): ByteArray?
    fun maskPng(size: EditorSize, annotations: CanvasAnnotations): ByteArray?
}

class AndroidBitmapImageRenderer : NativeImageRenderer {
    override fun metadata(sourcePath: Path): NativeImageMetadata? {
        val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(sourcePath.toString(), options)
        if (options.outWidth <= 0 || options.outHeight <= 0) return null
        return NativeImageMetadata(options.outWidth, options.outHeight, Files.size(sourcePath).toInt(), mimeType(sourcePath))
    }

    override fun annotatedPng(sourcePath: Path, annotations: CanvasAnnotations): ByteArray? {
        val source = BitmapFactory.decodeFile(sourcePath.toString()) ?: return null
        val bitmap = source.copy(Bitmap.Config.ARGB_8888, true)
        val canvas = Canvas(bitmap)
        drawAnnotations(canvas, bitmap.width.toFloat(), bitmap.height.toFloat(), annotations, includeMemos = true, mask = false)
        return bitmap.toPngBytes()
    }

    override fun maskPng(size: EditorSize, annotations: CanvasAnnotations): ByteArray? {
        val bitmap = Bitmap.createBitmap(size.width.toInt(), size.height.toInt(), Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.WHITE)
        drawAnnotations(canvas, size.width.toFloat(), size.height.toFloat(), annotations, includeMemos = false, mask = true)
        return bitmap.toPngBytes()
    }

    private fun drawAnnotations(canvas: Canvas, width: Float, height: Float, annotations: CanvasAnnotations, includeMemos: Boolean, mask: Boolean) {
        annotations.paths.forEach { drawPath(canvas, width, height, it, mask) }
        annotations.boxes.forEach { drawBox(canvas, width, height, it, mask) }
        if (includeMemos) annotations.memos.forEach { drawMemo(canvas, width, height, it) }
    }

    private fun drawPath(canvas: Canvas, width: Float, height: Float, path: DrawingPath, mask: Boolean) {
        val first = path.points.firstOrNull() ?: return
        val androidPath = AndroidPath().apply {
            moveTo((first.x * width).toFloat(), (first.y * height).toFloat())
            path.points.drop(1).forEach { lineTo((it.x * width).toFloat(), (it.y * height).toFloat()) }
        }
        val paint = strokePaint(if (mask) Color.TRANSPARENT else parseColor(path.color), max(path.strokeWidth.toFloat(), 1f))
        if (mask) paint.xfermode = android.graphics.PorterDuffXfermode(android.graphics.PorterDuff.Mode.CLEAR)
        canvas.drawPath(androidPath, paint)
        if (path.tool == DrawingTool.ARROW && path.points.size > 1) drawArrowHead(canvas, width, height, path, paint)
    }

    private fun drawBox(canvas: Canvas, width: Float, height: Float, box: BoundingBox, mask: Boolean) {
        val rect = RectF((box.x * width).toFloat(), (box.y * height).toFloat(), ((box.x + box.width) * width).toFloat(), ((box.y + box.height) * height).toFloat())
        val paint = if (mask) fillPaint(Color.TRANSPARENT) else strokePaint(parseColor(box.color), 3f)
        if (mask) paint.xfermode = android.graphics.PorterDuffXfermode(android.graphics.PorterDuff.Mode.CLEAR)
        canvas.drawRect(rect, paint)
    }

    private fun drawMemo(canvas: Canvas, width: Float, height: Float, memo: TextMemo) {
        canvas.drawRoundRect(RectF((memo.x * width).toFloat(), (memo.y * height).toFloat(), (memo.x * width).toFloat() + 96f, (memo.y * height).toFloat() + 48f), 8f, 8f, fillPaint(parseColor(memo.color)))
    }

    private fun drawArrowHead(canvas: Canvas, width: Float, height: Float, path: DrawingPath, paint: Paint) {
        val start = path.points[path.points.size - 2]
        val end = path.points.last()
        val startX = start.x * width
        val startY = start.y * height
        val endX = end.x * width
        val endY = end.y * height
        val angle = atan2(endY - startY, endX - startX)
        val length = 14.0
        val spread = Math.PI / 7.0
        canvas.drawLine(endX.toFloat(), endY.toFloat(), (endX - length * cos(angle - spread)).toFloat(), (endY - length * sin(angle - spread)).toFloat(), paint)
        canvas.drawLine(endX.toFloat(), endY.toFloat(), (endX - length * cos(angle + spread)).toFloat(), (endY - length * sin(angle + spread)).toFloat(), paint)
    }

    private fun strokePaint(color: Int, strokeWidth: Float): Paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        this.color = color
        style = Paint.Style.STROKE
        this.strokeWidth = strokeWidth
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
    }

    private fun fillPaint(color: Int): Paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        this.color = color
        style = Paint.Style.FILL
    }

    private fun Bitmap.toPngBytes(): ByteArray {
        val output = java.io.ByteArrayOutputStream()
        compress(Bitmap.CompressFormat.PNG, 100, output)
        return output.toByteArray()
    }

    private fun parseColor(value: String): Int = runCatching { Color.parseColor(value) }.getOrDefault(Color.rgb(13, 153, 255))

    private fun mimeType(path: Path): String {
        val name = path.fileName.toString().lowercase()
        return if (name.endsWith(".jpg") || name.endsWith(".jpeg")) "image/jpeg" else "image/png"
    }
}

class NativeImageComposer(
    private val renderer: NativeImageRenderer,
    private val maxPixelCount: Int = 16_777_216,
) {
    fun compose(request: NativeImageCompositionRequest): NativeImageCompositionOutcome {
        val source = renderer.metadata(request.sourcePath) ?: return NativeImageCompositionOutcome.Failure(NativeImageCompositionError.UnreadableSource)
        val pixels = source.width * source.height
        if (pixels > maxPixelCount) return NativeImageCompositionOutcome.Failure(NativeImageCompositionError.ImageTooLarge(maxPixelCount, pixels))
        val annotatedData = renderer.annotatedPng(request.sourcePath, request.annotations) ?: return NativeImageCompositionOutcome.Failure(NativeImageCompositionError.RenderFailed)
        val maskData = renderer.maskPng(EditorSize(source.width.toDouble(), source.height.toDouble()), request.annotations) ?: return NativeImageCompositionOutcome.Failure(NativeImageCompositionError.RenderFailed)
        return runCatching {
            Files.createDirectories(request.outputDirectory)
            val annotatedPath = request.outputDirectory.resolve("annotated.png")
            val maskPath = request.outputDirectory.resolve("mask.png")
            Files.write(annotatedPath, annotatedData)
            Files.write(maskPath, maskData)
            val annotated = NativeImageMetadata(source.width, source.height, annotatedData.size, "image/png")
            val mask = NativeImageMetadata(source.width, source.height, maskData.size, "image/png")
            NativeImageCompositionOutcome.Success(
                NativeImageCompositionResult(
                    original = source,
                    annotated = NativeComposedImage(annotatedPath, annotated),
                    mask = NativeComposedImage(maskPath, mask),
                    exportPreview = NativeExportPreview(source, annotated, mask, EditorSize(source.width.toDouble(), source.height.toDouble())),
                ),
            )
        }.getOrElse { NativeImageCompositionOutcome.Failure(NativeImageCompositionError.RenderFailed) }
    }
}
