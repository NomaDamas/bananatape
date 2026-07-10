package app.bananatape.mobile.editor

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.nio.file.Files
import java.nio.file.Path

class NativeImageComposerTest {
    @Test
    fun compose_whenAnnotatedFixtureExports_writesAnnotatedMaskAndPreviewMetadata() {
        val temp = Files.createTempDirectory("bananatape-native-image-composer")
        val source = temp.resolve("source.png")
        val sourceBytes = pngBytes(1, 2, 3, 4, 5, 6, 7, 8)
        val annotatedBytes = pngBytes(9, 10, 11, 12, 13)
        val maskBytes = pngBytes(14, 15, 16, 17)
        Files.write(source, sourceBytes)
        val annotations = CanvasAnnotations(
            paths = listOf(
                DrawingPath("path-1", DrawingTool.ARROW, listOf(EditorPoint(0.1, 0.1), EditorPoint(0.8, 0.7)), "#0d99ff", 2.0),
            ),
            boxes = listOf(
                BoundingBox("box-1", 0.2, 0.25, 0.45, 0.35, "#0d99ff", AnnotationStatus.PENDING),
            ),
            memos = listOf(
                TextMemo("memo-1", 0.5, 0.1, "Move label", "#fef08a"),
            ),
        )
        val renderer = NativeImageComposerFakeRenderer(
            sourceMetadata = NativeImageMetadata(width = 32, height = 24, byteCount = sourceBytes.size, mimeType = "image/png"),
            annotatedBytes = annotatedBytes,
            maskBytes = maskBytes,
        )

        val outcome = NativeImageComposer(renderer).compose(NativeImageCompositionRequest(source, annotations, temp.resolve("export")))

        val result = (outcome as NativeImageCompositionOutcome.Success).result
        assertEquals(32, result.original.width)
        assertEquals(24, result.original.height)
        assertEquals(sourceBytes.size, result.original.byteCount)
        assertEquals("image/png", result.original.mimeType)
        assertEquals(32, result.annotated.metadata.width)
        assertEquals(24, result.annotated.metadata.height)
        assertEquals(annotatedBytes.size, result.annotated.metadata.byteCount)
        assertTrue(result.annotated.metadata.byteCount > 0)
        assertEquals(32, result.mask.metadata.width)
        assertEquals(24, result.mask.metadata.height)
        assertEquals(maskBytes.size, result.mask.metadata.byteCount)
        assertTrue(result.mask.metadata.byteCount > 0)
        assertTrue(Files.exists(result.annotated.filePath))
        assertTrue(Files.exists(result.mask.filePath))
        assertEquals(result.annotated.metadata.byteCount.toLong(), Files.size(result.annotated.filePath))
        assertEquals(result.mask.metadata.byteCount.toLong(), Files.size(result.mask.filePath))
        assertEquals(EditorSize(32.0, 24.0), result.exportPreview.canvasSize)
        assertEquals(result.original, result.exportPreview.source)
        assertEquals(result.annotated.metadata.byteCount, result.exportPreview.annotated.byteCount)
        assertEquals(result.mask.metadata.byteCount, result.exportPreview.mask.byteCount)
        assertEquals(annotations, renderer.annotatedAnnotations)
        assertEquals(annotations, renderer.maskAnnotations)
        assertEquals(EditorSize(32.0, 24.0), renderer.maskSize)
    }

    @Test
    fun compose_whenSourceIsUnreadable_returnsUserSafeError() {
        val temp = Files.createTempDirectory("bananatape-native-image-composer-unreadable")
        val renderer = NativeImageComposerFakeRenderer(sourceMetadata = null, annotatedBytes = pngBytes(1), maskBytes = pngBytes(2))

        val outcome = NativeImageComposer(renderer).compose(NativeImageCompositionRequest(temp.resolve("missing.png"), CanvasAnnotations.Empty, temp.resolve("export")))

        val error = (outcome as NativeImageCompositionOutcome.Failure).error
        assertEquals(NativeImageCompositionError.UnreadableSource, error)
        assertEquals("This image could not be prepared for export.", error.userMessage)
        assertFalse(renderer.annotatedCalled)
        assertFalse(renderer.maskCalled)
    }

    @Test
    fun compose_whenAnnotatedRenderFails_returnsUserSafeError() {
        val temp = Files.createTempDirectory("bananatape-native-image-composer-annotated-failure")
        val source = temp.resolve("source.png")
        Files.write(source, pngBytes(1, 2, 3))
        val renderer = NativeImageComposerFakeRenderer(
            sourceMetadata = NativeImageMetadata(width = 16, height = 16, byteCount = 3, mimeType = "image/png"),
            annotatedBytes = null,
            maskBytes = pngBytes(4, 5),
        )

        val outcome = NativeImageComposer(renderer).compose(NativeImageCompositionRequest(source, CanvasAnnotations.Empty, temp.resolve("export")))

        val error = (outcome as NativeImageCompositionOutcome.Failure).error
        assertEquals(NativeImageCompositionError.RenderFailed, error)
        assertEquals("This image could not be prepared for export.", error.userMessage)
        assertTrue(renderer.annotatedCalled)
        assertFalse(renderer.maskCalled)
    }

    @Test
    fun compose_whenMaskRenderFails_returnsUserSafeError() {
        val temp = Files.createTempDirectory("bananatape-native-image-composer-mask-failure")
        val source = temp.resolve("source.png")
        Files.write(source, pngBytes(1, 2, 3))
        val renderer = NativeImageComposerFakeRenderer(
            sourceMetadata = NativeImageMetadata(width = 16, height = 16, byteCount = 3, mimeType = "image/png"),
            annotatedBytes = pngBytes(4, 5),
            maskBytes = null,
        )

        val outcome = NativeImageComposer(renderer).compose(NativeImageCompositionRequest(source, CanvasAnnotations.Empty, temp.resolve("export")))

        val error = (outcome as NativeImageCompositionOutcome.Failure).error
        assertEquals(NativeImageCompositionError.RenderFailed, error)
        assertEquals("This image could not be prepared for export.", error.userMessage)
        assertTrue(renderer.annotatedCalled)
        assertTrue(renderer.maskCalled)
    }

    @Test
    fun compose_whenImageExceedsPixelGuard_returnsUserSafeError() {
        val temp = Files.createTempDirectory("bananatape-native-image-composer-large")
        val source = temp.resolve("source.png")
        Files.write(source, pngBytes(1, 2, 3))
        val renderer = NativeImageComposerFakeRenderer(
            sourceMetadata = NativeImageMetadata(width = 5, height = 5, byteCount = 3, mimeType = "image/png"),
            annotatedBytes = pngBytes(4, 5),
            maskBytes = pngBytes(6, 7),
        )

        val outcome = NativeImageComposer(renderer, maxPixelCount = 24).compose(NativeImageCompositionRequest(source, CanvasAnnotations.Empty, temp.resolve("export")))

        val error = (outcome as NativeImageCompositionOutcome.Failure).error as NativeImageCompositionError.ImageTooLarge
        assertEquals(24, error.maxPixels)
        assertEquals(25, error.actualPixels)
        assertEquals("This image is too large to prepare on this device.", error.userMessage)
        assertFalse(renderer.annotatedCalled)
        assertFalse(renderer.maskCalled)
    }

    private fun pngBytes(vararg tail: Int): ByteArray = byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, *tail.map { it.toByte() }.toByteArray())
}

private class NativeImageComposerFakeRenderer(
    private val sourceMetadata: NativeImageMetadata?,
    private val annotatedBytes: ByteArray?,
    private val maskBytes: ByteArray?,
) : NativeImageRenderer {
    var annotatedAnnotations: CanvasAnnotations? = null
    var maskAnnotations: CanvasAnnotations? = null
    var maskSize: EditorSize? = null
    var annotatedCalled: Boolean = false
    var maskCalled: Boolean = false

    override fun metadata(sourcePath: Path): NativeImageMetadata? = sourceMetadata

    override fun annotatedPng(sourcePath: Path, annotations: CanvasAnnotations): ByteArray? {
        annotatedCalled = true
        annotatedAnnotations = annotations
        return annotatedBytes
    }

    override fun maskPng(size: EditorSize, annotations: CanvasAnnotations): ByteArray? {
        maskCalled = true
        maskSize = size
        maskAnnotations = annotations
        return maskBytes
    }
}
