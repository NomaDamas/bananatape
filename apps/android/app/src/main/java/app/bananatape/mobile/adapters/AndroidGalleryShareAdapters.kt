package app.bananatape.mobile.adapters

import android.content.ContentResolver
import android.content.ContentValues
import android.content.Context
import android.os.Build
import android.provider.MediaStore
import androidx.core.content.FileProvider
import java.nio.file.Files
import java.nio.file.Path
import java.time.Duration

interface MediaStoreImageWriter {
    fun insert(image: ExportableImage, relativePath: String, displayName: String): AdapterResult<GalleryExportReceipt>
}

class AndroidMediaStoreImageWriter(
    private val resolver: ContentResolver,
) : MediaStoreImageWriter {
    override fun insert(image: ExportableImage, relativePath: String, displayName: String): AdapterResult<GalleryExportReceipt> {
        return try {
            val values = ContentValues().apply {
                put(MediaStore.Images.Media.DISPLAY_NAME, displayName)
                put(MediaStore.Images.Media.MIME_TYPE, image.mimeType.value)
                put(MediaStore.Images.Media.WIDTH, image.width)
                put(MediaStore.Images.Media.HEIGHT, image.height)
                put(MediaStore.Images.Media.DATE_ADDED, image.createdAt.epochSecond)
                put(MediaStore.Images.Media.DATE_TAKEN, image.createdAt.toEpochMilli())
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    put(MediaStore.Images.Media.RELATIVE_PATH, relativePath)
                    put(MediaStore.Images.Media.IS_PENDING, 1)
                }
            }
            val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values) ?: return AdapterResult.Failure(AdapterError.PermissionDenied(PermissionScope.IMAGE_EXPORT))
            resolver.openOutputStream(uri)?.use { output -> Files.newInputStream(image.filePath).use { input -> input.copyTo(output) } }
                ?: return AdapterResult.Failure(AdapterError.PermissionDenied(PermissionScope.IMAGE_EXPORT))
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                resolver.update(uri, ContentValues().apply { put(MediaStore.Images.Media.IS_PENDING, 0) }, null, null)
            }
            AdapterResult.Success(
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
        } catch (_: SecurityException) {
            AdapterResult.Failure(AdapterError.PermissionDenied(PermissionScope.IMAGE_EXPORT))
        } catch (_: java.io.IOException) {
            AdapterResult.Failure(AdapterError.PermissionDenied(PermissionScope.IMAGE_EXPORT))
        }
    }
}

class MediaStoreGalleryImageExport(
    private val permissionGateway: PermissionGateway,
    private val writer: MediaStoreImageWriter,
    private val relativePath: String = RelativePath,
) : GalleryImageExport {
    override fun saveToGallery(image: ExportableImage): AdapterResult<GalleryExportReceipt> {
        if (permissionGateway.decision(PermissionScope.IMAGE_EXPORT) == PermissionDecision.DENIED) {
            return AdapterResult.Failure(AdapterError.PermissionDenied(PermissionScope.IMAGE_EXPORT))
        }
        return writer.insert(image, relativePath, displayName(image))
    }

    private fun displayName(image: ExportableImage): String = "${image.id}${extension(image.mimeType)}"

    private fun extension(mimeType: ImageMimeType): String = when (mimeType) {
        ImageMimeType.PNG -> ".png"
        ImageMimeType.JPEG -> ".jpg"
        ImageMimeType.WEBP,
        ImageMimeType.GIF,
        ImageMimeType.HEIC,
        -> ".img"
    }

    companion object {
        const val RelativePath = "Pictures/BananaTape/"
    }
}

class ContentUriOutboundImageShare(
    private val tempDirectory: Path,
    private val authority: String,
    private val ttl: Duration = Duration.ofHours(1),
) : OutboundImageShare {
    override fun prepareShare(image: ExportableImage): AdapterResult<SharedImage> = runCatching {
        Files.createDirectories(tempDirectory)
        val sharePath = tempDirectory.resolve("${image.id}${extension(image.mimeType)}")
        Files.copy(image.filePath, sharePath, java.nio.file.StandardCopyOption.REPLACE_EXISTING)
        SharedImage(
            id = image.id,
            contentUri = "content://$authority/${sharePath.fileName}",
            mimeType = image.mimeType,
            byteCount = image.byteCount,
            expiresAt = image.createdAt.plus(ttl),
        )
    }.fold(
        onSuccess = { AdapterResult.Success(it) },
        onFailure = { AdapterResult.Failure(AdapterError.StorageNotFound(image.filePath.toString())) },
    )

    private fun extension(mimeType: ImageMimeType): String = when (mimeType) {
        ImageMimeType.PNG -> ".png"
        ImageMimeType.JPEG -> ".jpg"
        ImageMimeType.WEBP,
        ImageMimeType.GIF,
        ImageMimeType.HEIC,
        -> ".img"
    }
}

class AndroidFileProviderOutboundImageShare(
    private val context: Context,
    private val tempDirectory: Path,
    private val authority: String,
    private val ttl: Duration = Duration.ofHours(1),
) : OutboundImageShare {
    override fun prepareShare(image: ExportableImage): AdapterResult<SharedImage> = runCatching {
        Files.createDirectories(tempDirectory)
        val sharePath = tempDirectory.resolve("${image.id}${extension(image.mimeType)}")
        Files.copy(image.filePath, sharePath, java.nio.file.StandardCopyOption.REPLACE_EXISTING)
        val uri = FileProvider.getUriForFile(context, authority, sharePath.toFile())
        SharedImage(
            id = image.id,
            contentUri = uri.toString(),
            mimeType = image.mimeType,
            byteCount = image.byteCount,
            expiresAt = image.createdAt.plus(ttl),
        )
    }.fold(
        onSuccess = { AdapterResult.Success(it) },
        onFailure = { AdapterResult.Failure(AdapterError.CorruptProject(image.id)) },
    )

    private fun extension(mimeType: ImageMimeType): String = when (mimeType) {
        ImageMimeType.PNG -> ".png"
        ImageMimeType.JPEG -> ".jpg"
        ImageMimeType.WEBP,
        ImageMimeType.GIF,
        ImageMimeType.HEIC,
        -> ".img"
    }
}
