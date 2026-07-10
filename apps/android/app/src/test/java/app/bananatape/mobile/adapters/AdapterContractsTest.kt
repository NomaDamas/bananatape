package app.bananatape.mobile.adapters

import org.junit.Assert.assertEquals
import org.junit.Test

class AdapterContractsTest {
    @Test
    fun projectStorage_whenProjectIsCreated_listsAndReadsProject() {
        val storage = FakeProjectStorage()
        val project = MobileProjectRecord(
            id = "project-1",
            name = "Logo Explorations",
            manifestJson = "{}",
            historyJson = "[]",
            canvasJson = null,
        )

        val created = storage.create(project)
        val summaries = storage.list()
        val read = storage.read("project-1")

        assertEquals(AdapterResult.Success(project), created)
        assertEquals(listOf(MobileProjectSummary(id = "project-1", name = "Logo Explorations")), summaries)
        assertEquals(AdapterResult.Success(project), read)
    }

    @Test
    fun projectStorage_whenProjectIsDeleted_removesProject() {
        val project = MobileProjectRecord(
            id = "project-1",
            name = "Logo Explorations",
            manifestJson = "{}",
            historyJson = "[]",
            canvasJson = null,
        )
        val storage = FakeProjectStorage(projects = listOf(project))

        val deletion = storage.delete("project-1")
        val read = storage.read("project-1")

        assertEquals(AdapterResult.Success(Unit), deletion)
        assertEquals(AdapterResult.Failure(AdapterError.StorageNotFound("project-1")), read)
    }

    @Test
    fun projectStorage_whenFixtureIsCorrupt_returnsCorruptProject() {
        val project = MobileProjectRecord(
            id = "corrupt-project-missing-history",
            name = "Corrupt",
            manifestJson = "{}",
            historyJson = "",
            canvasJson = null,
        )
        val storage = FakeProjectStorage(
            projects = listOf(project),
            corruptProjectIds = setOf("corrupt-project-missing-history"),
        )

        val read = storage.read("corrupt-project-missing-history")

        assertEquals(AdapterResult.Failure(AdapterError.CorruptProject("corrupt-project-missing-history")), read)
    }

    @Test
    fun permissionGateway_whenDenied_returnsDeniedDecision() {
        val gateway = FakePermissionGateway(mapOf(PermissionScope.IMAGE_EXPORT to PermissionDecision.DENIED))

        val decision = gateway.decision(PermissionScope.IMAGE_EXPORT)

        assertEquals(PermissionDecision.DENIED, decision)
    }

    @Test
    fun providerAuth_whenNetworkIsOffline_returnsOfflineAvailability() {
        val auth = FakeProviderAuth(
            availabilityByProvider = mapOf(ProviderId.OPENAI to ProviderAvailability.READY),
            networkStatus = FakeNetworkStatus(NetworkReachability.OFFLINE),
        )

        val availability = auth.availability(ProviderId.OPENAI)

        assertEquals(ProviderAvailability.OFFLINE, availability)
    }

    @Test
    fun providerAuth_whenKeyIsMissing_returnsMissingKey() {
        val auth = FakeProviderAuth(
            availabilityByProvider = mapOf(ProviderId.OPENAI to ProviderAvailability.MISSING_KEY),
            networkStatus = FakeNetworkStatus(NetworkReachability.ONLINE),
        )

        val availability = auth.availability(ProviderId.OPENAI)
        val codexAvailability = auth.availability(ProviderId.CODEX)

        assertEquals(ProviderAvailability.MISSING_KEY, availability)
        assertEquals(ProviderAvailability.UNAVAILABLE, codexAvailability)
        assertEquals("Codex mobile provider is not available in this build", codexAvailability.userMessage)
    }

    @Test
    fun imageImport_whenPngIsGrantedAndSmall_returnsImportedImage() {
        val importer = FakeImageImport(
            permissionGateway = FakePermissionGateway(mapOf(PermissionScope.IMAGE_IMPORT to PermissionDecision.GRANTED)),
            memoryPolicy = FakeImageMemoryPolicy(maxBytes = 1024),
        )

        val image = importer.importImage(id = "reference-1", mimeType = ImageMimeType.PNG, byteCount = 512)

        assertEquals(AdapterResult.Success(ImportedImage(id = "reference-1", mimeType = ImageMimeType.PNG, byteCount = 512)), image)
    }

    @Test
    fun imageImport_whenPermissionDenied_returnsPermissionDenied() {
        val importer = FakeImageImport(
            permissionGateway = FakePermissionGateway(mapOf(PermissionScope.IMAGE_IMPORT to PermissionDecision.DENIED)),
            memoryPolicy = FakeImageMemoryPolicy(maxBytes = 1024),
        )

        val result = importer.importImage(id = "reference-1", mimeType = ImageMimeType.PNG, byteCount = 512)

        assertEquals(AdapterResult.Failure(AdapterError.PermissionDenied(PermissionScope.IMAGE_IMPORT)), result)
    }

    @Test
    fun imageImport_whenImageIsTooLarge_returnsOversizedImage() {
        val importer = FakeImageImport(
            permissionGateway = FakePermissionGateway(mapOf(PermissionScope.IMAGE_IMPORT to PermissionDecision.GRANTED)),
            memoryPolicy = FakeImageMemoryPolicy(maxBytes = 1024),
        )

        val result = importer.importImage(id = "reference-1", mimeType = ImageMimeType.JPEG, byteCount = 2048)

        assertEquals(AdapterResult.Failure(AdapterError.OversizedImage(maxBytes = 1024, actualBytes = 2048)), result)
    }

    @Test
    fun imageImport_whenFileTypeIsUnsupported_returnsUnsupportedFileType() {
        val importer = FakeImageImport(
            permissionGateway = FakePermissionGateway(mapOf(PermissionScope.IMAGE_IMPORT to PermissionDecision.GRANTED)),
            memoryPolicy = FakeImageMemoryPolicy(maxBytes = 1024),
        )

        val result = importer.importImage(id = "reference-1", mimeType = ImageMimeType.WEBP, byteCount = 512)

        assertEquals(AdapterResult.Failure(AdapterError.UnsupportedFileType(ImageMimeType.WEBP)), result)
    }

    @Test
    fun adapterError_whenImportTypeIsUnsupported_hasStableUserSafeMessage() {
        val error = AdapterError.UnsupportedFileType(ImageMimeType.HEIC)

        assertEquals("image.unsupported_type", error.code)
        assertEquals("Use a PNG or JPEG image.", error.userMessage)
    }

    @Test
    fun adapterError_whenImportIsOversized_hasStableUserSafeMessage() {
        val error = AdapterError.OversizedImage(maxBytes = 12, actualBytes = 13)

        assertEquals("image.oversized", error.code)
        assertEquals("This image is too large to import.", error.userMessage)
    }

    @Test
    fun imageExport_whenPermissionGranted_returnsExportedImage() {
        val exporter = FakeImageExport(FakePermissionGateway(mapOf(PermissionScope.IMAGE_EXPORT to PermissionDecision.GRANTED)))

        val image = exporter.exportImage(
            id = "history-1",
            destination = ImageExportDestination.GalleryAlbum(name = "BananaTape"),
            byteCount = 512,
        )

        assertEquals(
            AdapterResult.Success(
                ExportedImage(
                    id = "history-1",
                    destination = ImageExportDestination.GalleryAlbum(name = "BananaTape"),
                    byteCount = 512,
                ),
            ),
            image,
        )
    }

    @Test
    fun imageExport_whenPermissionDenied_returnsPermissionDenied() {
        val exporter = FakeImageExport(FakePermissionGateway(mapOf(PermissionScope.IMAGE_EXPORT to PermissionDecision.DENIED)))

        val result = exporter.exportImage(id = "history-1", destination = ImageExportDestination.ShareSheet, byteCount = 512)

        assertEquals(AdapterResult.Failure(AdapterError.PermissionDenied(PermissionScope.IMAGE_EXPORT)), result)
    }
}
