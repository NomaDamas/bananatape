package app.bananatape.mobile.adapters

import java.nio.file.Path
import java.time.Instant

data class MobileProjectRecord(
    val id: String,
    val name: String,
    val manifestJson: String,
    val historyJson: String,
    val canvasJson: String?,
)

data class MobileProjectSummary(
    val id: String,
    val name: String,
)

data class ImportedImage(
    val id: String,
    val mimeType: ImageMimeType,
    val byteCount: Int,
)

data class ProjectImageImportRequest(
    val projectId: String,
    val assetId: String,
    val role: ImportedImageRole,
    val mimeType: ImageMimeType,
    val originalFileName: String,
    val sourcePath: java.nio.file.Path,
)

data class ProjectImageAsset(
    val id: String,
    val role: ImportedImageRole,
    val mimeType: ImageMimeType,
    val byteCount: Int,
    val projectRelativePath: String,
    val filePath: java.nio.file.Path,
)

enum class ImportedImageRole {
    BASE_IMAGE,
    REFERENCE_IMAGE,
}

data class ExportedImage(
    val id: String,
    val destination: ImageExportDestination,
    val byteCount: Int,
)

data class ExportableImage(
    val id: String,
    val filePath: Path,
    val mimeType: ImageMimeType,
    val width: Int,
    val height: Int,
    val byteCount: Int,
    val createdAt: Instant,
)

data class GalleryExportReceipt(
    val id: String,
    val relativePath: String,
    val displayName: String,
    val mimeType: ImageMimeType,
    val width: Int,
    val height: Int,
    val byteCount: Int,
    val createdAt: Instant,
)

data class SharedImage(
    val id: String,
    val contentUri: String,
    val mimeType: ImageMimeType,
    val byteCount: Int,
    val expiresAt: Instant,
)

enum class ImageMimeType(val value: String) {
    PNG("image/png"),
    JPEG("image/jpeg"),
    WEBP("image/webp"),
    GIF("image/gif"),
    HEIC("image/heic"),
}

sealed interface ImageExportDestination {
    data class GalleryAlbum(val name: String) : ImageExportDestination
    data object ShareSheet : ImageExportDestination
}

enum class PermissionScope {
    IMAGE_IMPORT,
    IMAGE_EXPORT,
    PROVIDER_NETWORK,
}

enum class PermissionDecision {
    GRANTED,
    DENIED,
}

enum class ProviderId(val value: String) {
    OPENAI("openai"),
    CODEX("codex"),
    MOCK("mock"),
}

enum class ProviderAvailability {
    READY,
    MISSING_KEY,
    OFFLINE,
    UNSUPPORTED,
    UNAVAILABLE,
    ;

    val userMessage: String
        get() = when (this) {
            READY -> "Provider is ready."
            MISSING_KEY -> "Add an API key before generating images."
            OFFLINE -> "You are offline."
            UNSUPPORTED,
            UNAVAILABLE,
            -> "Codex mobile provider is not available in this build"
        }
}

enum class NetworkReachability {
    ONLINE,
    OFFLINE,
}

class StaticNetworkStatus(private val reachability: NetworkReachability) : NetworkStatus {
    override fun currentReachability(): NetworkReachability = reachability
}

sealed interface AdapterError {
    data class PermissionDenied(val scope: PermissionScope) : AdapterError
    data object Offline : AdapterError
    data class MissingApiKey(val provider: ProviderId) : AdapterError
    data class OversizedImage(val maxBytes: Int, val actualBytes: Int) : AdapterError
    data class UnsupportedFileType(val mimeType: ImageMimeType) : AdapterError
    data class StorageNotFound(val projectId: String) : AdapterError
    data class CorruptProject(val projectId: String) : AdapterError

    val code: String
        get() = when (this) {
            is PermissionDenied -> "permission.denied"
            Offline -> "network.offline"
            is MissingApiKey -> "provider.missing_api_key"
            is OversizedImage -> "image.oversized"
            is UnsupportedFileType -> "image.unsupported_type"
            is StorageNotFound -> "storage.not_found"
            is CorruptProject -> "storage.corrupt_project"
        }

    val userMessage: String
        get() = when (this) {
            is PermissionDenied -> "Permission is needed to continue."
            Offline -> "You are offline."
            is MissingApiKey -> "Add an API key before generating images."
            is OversizedImage -> "This image is too large to import."
            is UnsupportedFileType -> "Use a PNG or JPEG image."
            is StorageNotFound -> "This project could not be found."
            is CorruptProject -> "This project could not be opened."
        }
}

sealed interface AdapterResult<out T> {
    data class Success<T>(val value: T) : AdapterResult<T>
    data class Failure(val error: AdapterError) : AdapterResult<Nothing>
}

interface ProjectStorage {
    fun create(project: MobileProjectRecord): AdapterResult<MobileProjectRecord>
    fun read(id: String): AdapterResult<MobileProjectRecord>
    fun list(): List<MobileProjectSummary>
    fun delete(id: String): AdapterResult<Unit>
    fun rename(id: String, name: String): AdapterResult<MobileProjectRecord>
}

interface ImageImport {
    fun importImage(id: String, mimeType: ImageMimeType, byteCount: Int): AdapterResult<ImportedImage>
}

interface ImageExport {
    fun exportImage(id: String, destination: ImageExportDestination, byteCount: Int): AdapterResult<ExportedImage>
}

interface GalleryImageExport {
    fun saveToGallery(image: ExportableImage): AdapterResult<GalleryExportReceipt>
}

interface OutboundImageShare {
    fun prepareShare(image: ExportableImage): AdapterResult<SharedImage>
}

interface PermissionGateway {
    fun decision(scope: PermissionScope): PermissionDecision
}

interface ProviderAuth {
    fun availability(provider: ProviderId): ProviderAvailability
}

interface NetworkStatus {
    fun currentReachability(): NetworkReachability
}

interface ImageMemoryPolicy {
    fun evaluate(byteCount: Int): AdapterResult<Unit>
}

sealed interface OpenAiApiKeyState {
    data object Missing : OpenAiApiKeyState
    data class Present(val maskedSuffix: String) : OpenAiApiKeyState
}

interface OpenAiApiKeyStore {
    fun apiKeyState(): OpenAiApiKeyState
    fun readApiKey(): String?
    fun saveApiKey(key: String): AdapterResult<Unit>
    fun deleteApiKey(): AdapterResult<Unit>
}

interface EncryptedKeyValueStore {
    fun readString(key: String): String?
    fun writeString(key: String, value: String)
    fun remove(key: String)
}

class EncryptedPreferencesOpenAiApiKeyStore(
    private val encryptedStore: EncryptedKeyValueStore,
) : OpenAiApiKeyStore {
    override fun apiKeyState(): OpenAiApiKeyState {
        val key = readApiKey()
        return if (key.isNullOrEmpty()) OpenAiApiKeyState.Missing else OpenAiApiKeyState.Present(maskedSuffix = key.takeLast(4))
    }

    override fun readApiKey(): String? = encryptedStore.readString(OpenAiKeyName)

    override fun saveApiKey(key: String): AdapterResult<Unit> {
        encryptedStore.writeString(OpenAiKeyName, key)
        return AdapterResult.Success(Unit)
    }

    override fun deleteApiKey(): AdapterResult<Unit> {
        encryptedStore.remove(OpenAiKeyName)
        return AdapterResult.Success(Unit)
    }

    companion object {
        const val OpenAiKeyName = "openai_api_key"
    }
}
