package app.bananatape.mobile.adapters

import java.nio.file.Files
import java.nio.file.Path
import java.time.Duration

class FakeProjectStorage(
    projects: List<MobileProjectRecord> = emptyList(),
    private val corruptProjectIds: Set<String> = emptySet(),
) : ProjectStorage {
    private val projectsById: MutableMap<String, MobileProjectRecord> = projects.associateBy { it.id }.toMutableMap()

    override fun create(project: MobileProjectRecord): AdapterResult<MobileProjectRecord> {
        projectsById[project.id] = project
        return AdapterResult.Success(project)
    }

    override fun read(id: String): AdapterResult<MobileProjectRecord> {
        if (corruptProjectIds.contains(id)) {
            return AdapterResult.Failure(AdapterError.CorruptProject(id))
        }
        val project = projectsById[id] ?: return AdapterResult.Failure(AdapterError.StorageNotFound(id))
        return AdapterResult.Success(project)
    }

    override fun list(): List<MobileProjectSummary> = projectsById.values
        .map { MobileProjectSummary(id = it.id, name = it.name) }
        .sortedBy { it.name }

    override fun delete(id: String): AdapterResult<Unit> {
        projectsById.remove(id) ?: return AdapterResult.Failure(AdapterError.StorageNotFound(id))
        return AdapterResult.Success(Unit)
    }

    override fun rename(id: String, name: String): AdapterResult<MobileProjectRecord> {
        val project = projectsById[id] ?: return AdapterResult.Failure(AdapterError.StorageNotFound(id))
        val updated = project.copy(name = name)
        projectsById[id] = updated
        return AdapterResult.Success(updated)
    }
}

class FakePermissionGateway(
    private val decisions: Map<PermissionScope, PermissionDecision>,
) : PermissionGateway {
    override fun decision(scope: PermissionScope): PermissionDecision = decisions[scope] ?: PermissionDecision.GRANTED
}

class FakeNetworkStatus(private val reachability: NetworkReachability) : NetworkStatus {
    override fun currentReachability(): NetworkReachability = reachability
}

class FakeProviderAuth(
    private val availabilityByProvider: Map<ProviderId, ProviderAvailability>,
    private val networkStatus: NetworkStatus,
) : ProviderAuth {
    override fun availability(provider: ProviderId): ProviderAvailability {
        if (provider == ProviderId.CODEX) {
            return ProviderAvailability.UNAVAILABLE
        }
        if (networkStatus.currentReachability() == NetworkReachability.OFFLINE) {
            return ProviderAvailability.OFFLINE
        }
        return availabilityByProvider[provider] ?: ProviderAvailability.MISSING_KEY
    }
}

class FakeImageMemoryPolicy(private val maxBytes: Int) : ImageMemoryPolicy {
    override fun evaluate(byteCount: Int): AdapterResult<Unit> {
        if (byteCount > maxBytes) {
            return AdapterResult.Failure(AdapterError.OversizedImage(maxBytes = maxBytes, actualBytes = byteCount))
        }
        return AdapterResult.Success(Unit)
    }
}

class FakeImageImport(
    private val permissionGateway: PermissionGateway,
    private val memoryPolicy: ImageMemoryPolicy,
) : ImageImport {
    override fun importImage(id: String, mimeType: ImageMimeType, byteCount: Int): AdapterResult<ImportedImage> {
        if (permissionGateway.decision(PermissionScope.IMAGE_IMPORT) == PermissionDecision.DENIED) {
            return AdapterResult.Failure(AdapterError.PermissionDenied(PermissionScope.IMAGE_IMPORT))
        }
        return when (mimeType) {
            ImageMimeType.PNG,
            ImageMimeType.JPEG,
            -> when (val memoryResult = memoryPolicy.evaluate(byteCount)) {
                is AdapterResult.Success -> AdapterResult.Success(ImportedImage(id = id, mimeType = mimeType, byteCount = byteCount))
                is AdapterResult.Failure -> memoryResult
            }
            ImageMimeType.WEBP,
            ImageMimeType.GIF,
            ImageMimeType.HEIC,
            -> AdapterResult.Failure(AdapterError.UnsupportedFileType(mimeType))
        }
    }
}

class FakeImageExport(private val permissionGateway: PermissionGateway) : ImageExport {
    override fun exportImage(id: String, destination: ImageExportDestination, byteCount: Int): AdapterResult<ExportedImage> {
        if (permissionGateway.decision(PermissionScope.IMAGE_EXPORT) == PermissionDecision.DENIED) {
            return AdapterResult.Failure(AdapterError.PermissionDenied(PermissionScope.IMAGE_EXPORT))
        }
        return AdapterResult.Success(ExportedImage(id = id, destination = destination, byteCount = byteCount))
    }
}

class FakeGalleryImageExport(
    private val permissionGateway: PermissionGateway,
    private val relativePath: String = "Pictures/BananaTape/",
) : GalleryImageExport {
    override fun saveToGallery(image: ExportableImage): AdapterResult<GalleryExportReceipt> {
        if (permissionGateway.decision(PermissionScope.IMAGE_EXPORT) == PermissionDecision.DENIED) {
            return AdapterResult.Failure(AdapterError.PermissionDenied(PermissionScope.IMAGE_EXPORT))
        }
        return AdapterResult.Success(
            GalleryExportReceipt(
                id = image.id,
                relativePath = relativePath,
                displayName = displayName(image),
                mimeType = image.mimeType,
                width = image.width,
                height = image.height,
                byteCount = image.byteCount,
                createdAt = image.createdAt,
            ),
        )
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
}

class FakeOutboundImageShare(
    private val tempDirectory: Path,
    private val ttl: Duration,
) : OutboundImageShare {
    override fun prepareShare(image: ExportableImage): AdapterResult<SharedImage> = runCatching {
        Files.createDirectories(tempDirectory)
        val sharePath = tempDirectory.resolve("${image.id}${extension(image.mimeType)}")
        Files.copy(image.filePath, sharePath, java.nio.file.StandardCopyOption.REPLACE_EXISTING)
        SharedImage(
            id = image.id,
            contentUri = "content://app.bananatape.mobile.share/${sharePath.fileName}",
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

class InMemoryEncryptedKeyValueStore(
    initialValues: Map<String, String> = emptyMap(),
) : EncryptedKeyValueStore {
    private val values = initialValues.toMutableMap()

    override fun readString(key: String): String? = values[key]

    override fun writeString(key: String, value: String) {
        values[key] = value
    }

    override fun remove(key: String) {
        values.remove(key)
    }
}

class InMemoryOpenAiApiKeyStore(key: String? = null) : OpenAiApiKeyStore {
    private val encryptedStore = InMemoryEncryptedKeyValueStore(
        key?.let { mapOf(EncryptedPreferencesOpenAiApiKeyStore.OpenAiKeyName to it) } ?: emptyMap(),
    )
    private val delegate = EncryptedPreferencesOpenAiApiKeyStore(encryptedStore)

    override fun apiKeyState(): OpenAiApiKeyState = delegate.apiKeyState()
    override fun readApiKey(): String? = delegate.readApiKey()
    override fun saveApiKey(key: String): AdapterResult<Unit> = delegate.saveApiKey(key)
    override fun deleteApiKey(): AdapterResult<Unit> = delegate.deleteApiKey()
}
