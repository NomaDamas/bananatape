package app.bananatape.mobile.adapters

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.nio.file.Files
import java.time.Duration
import java.time.Instant

class GalleryShareAdaptersTest {
    @Test
    fun galleryExport_whenPermissionGranted_writesBananaTapeMediaStoreMetadata() {
        val writer = RecordingMediaStoreWriter()
        val export = MediaStoreGalleryImageExport(
            permissionGateway = FakePermissionGateway(mapOf(PermissionScope.IMAGE_EXPORT to PermissionDecision.GRANTED)),
            writer = writer,
        )
        val image = exportableImage()

        val result = export.saveToGallery(image)

        assertEquals(1, writer.insertCount)
        assertEquals("Pictures/BananaTape/", writer.relativePath)
        assertEquals("history-1.png", writer.displayName)
        assertEquals(
            AdapterResult.Success(
                GalleryExportReceipt(
                    id = "history-1",
                    relativePath = "Pictures/BananaTape/",
                    displayName = "history-1.png",
                    mimeType = ImageMimeType.PNG,
                    width = 32,
                    height = 24,
                    byteCount = 512,
                    createdAt = Instant.parse("2026-07-04T00:00:00Z"),
                ),
            ),
            result,
        )
    }

    @Test
    fun galleryExport_whenPermissionDenied_returnsRecoverableErrorAndKeepsProjectOutput() {
        val writer = RecordingMediaStoreWriter()
        val export = MediaStoreGalleryImageExport(
            permissionGateway = FakePermissionGateway(mapOf(PermissionScope.IMAGE_EXPORT to PermissionDecision.DENIED)),
            writer = writer,
        )
        val image = exportableImage()

        val result = export.saveToGallery(image)

        assertEquals(AdapterResult.Failure(AdapterError.PermissionDenied(PermissionScope.IMAGE_EXPORT)), result)
        assertEquals(0, writer.insertCount)
        assertTrue(Files.exists(image.filePath))
    }

    @Test
    fun outboundShare_whenPrepared_usesContentUriMimeAndExpiry() {
        val temp = Files.createTempDirectory("bananatape-share-test")
        val share = ContentUriOutboundImageShare(
            tempDirectory = temp,
            authority = "app.bananatape.mobile.share",
            ttl = Duration.ofMinutes(30),
        )
        val image = exportableImage()

        val result = share.prepareShare(image)

        assertEquals(
            AdapterResult.Success(
                SharedImage(
                    id = "history-1",
                    contentUri = "content://app.bananatape.mobile.share/history-1.png",
                    mimeType = ImageMimeType.PNG,
                    byteCount = 512,
                    expiresAt = Instant.parse("2026-07-04T00:30:00Z"),
                ),
            ),
            result,
        )
        assertTrue(Files.exists(temp.resolve("history-1.png")))
        assertTrue(Files.exists(image.filePath))
    }

    @Test
    fun galleryExport_whenNotExplicitlyCalled_doesNotWriteMediaStore() {
        val writer = RecordingMediaStoreWriter()
        val image = exportableImage()

        assertEquals(0, writer.insertCount)
        assertTrue(Files.exists(image.filePath))
    }

    private fun exportableImage(): ExportableImage {
        val temp = Files.createTempDirectory("bananatape-exportable")
        val file = temp.resolve("annotated.png")
        Files.write(file, ByteArray(512) { 7 })
        return ExportableImage(
            id = "history-1",
            filePath = file,
            mimeType = ImageMimeType.PNG,
            width = 32,
            height = 24,
            byteCount = 512,
            createdAt = Instant.parse("2026-07-04T00:00:00Z"),
        )
    }
}

private class RecordingMediaStoreWriter : MediaStoreImageWriter {
    var insertCount = 0
    var relativePath: String? = null
    var displayName: String? = null

    override fun insert(image: ExportableImage, relativePath: String, displayName: String): AdapterResult<GalleryExportReceipt> {
        insertCount += 1
        this.relativePath = relativePath
        this.displayName = displayName
        return AdapterResult.Success(
            GalleryExportReceipt(
                id = image.id,
                relativePath = relativePath,
                displayName = displayName,
                mimeType = image.mimeType,
                width = image.width,
                height = image.height,
                byteCount = image.byteCount,
                createdAt = image.createdAt,
            ),
        )
    }
}
