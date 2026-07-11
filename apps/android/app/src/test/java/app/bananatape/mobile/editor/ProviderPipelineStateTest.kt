package app.bananatape.mobile.editor

import app.bananatape.mobile.adapters.NetworkReachability
import app.bananatape.mobile.adapters.AdapterResult
import app.bananatape.mobile.adapters.FakeImageExport
import app.bananatape.mobile.adapters.FakePermissionGateway
import app.bananatape.mobile.adapters.FakeProjectStorage
import app.bananatape.mobile.adapters.ImageExportDestination
import app.bananatape.mobile.adapters.MobileProjectRecord
import app.bananatape.mobile.adapters.PermissionScope
import app.bananatape.mobile.adapters.PermissionDecision
import app.bananatape.mobile.adapters.FakeNetworkStatus
import app.bananatape.mobile.adapters.FakeOutboundImageShare
import app.bananatape.mobile.adapters.ImageMimeType
import app.bananatape.mobile.adapters.ImportedImageRole
import app.bananatape.mobile.adapters.ProjectImageImportRequest
import app.bananatape.mobile.adapters.ExportableImage
import app.bananatape.mobile.storage.LocalProjectStorage
import java.nio.file.Files
import java.nio.file.Path
import java.time.Duration
import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.assertNull
import org.junit.Test

class ProviderPipelineStateTest {
    @Test
    fun mockProvider_whenGenerateSucceeds_createsReadyImageAndHistory() {
        val prompt = "banana sticker on transparent background"
        val provider = MockImageProvider()
        val pending = ProviderPipelineState().startingGenerate(prompt = prompt, requestId = "generate-1", network = NetworkReachability.ONLINE)
        val request = requireNotNull(pending.requestForActivePrompt())

        val completed = pending.applying((provider.generate(request) as MockProviderResult.Success).value)

        assertEquals(listOf(ImageGenerationStatus.PENDING), pending.pendingImages.map { it.status })
        assertEquals(1, completed.readyImages.size)
        assertEquals(prompt, completed.readyImages.first().prompt)
        assertEquals(EditorProvider.MOCK, completed.readyImages.first().provider)
        assertEquals(1, completed.history.size)
        assertEquals(prompt, completed.history.first().prompt)
        assertNull(completed.history.first().parentId)
    }

    @Test
    fun mockProvider_whenEditWithAnnotationsSucceeds_createsChildWithParentHistoryId() {
        val prompt = "banana sticker on transparent background"
        val provider = MockImageProvider()
        val rootPending = ProviderPipelineState().startingGenerate(prompt = prompt, requestId = "generate-1", network = NetworkReachability.ONLINE)
        val rootReady = rootPending.applying((provider.generate(requireNotNull(rootPending.requestForActivePrompt())) as MockProviderResult.Success).value)
        val box = BoundingBox("box-edit", 0.2, 0.2, 0.4, 0.4, "#0d99ff", AnnotationStatus.PENDING)
        val annotations = CanvasAnnotations(paths = emptyList(), boxes = listOf(box), memos = emptyList())

        val editPending = rootReady.startingEdit(prompt = "make the peel brighter", annotations = annotations, requestId = "edit-1", network = NetworkReachability.ONLINE)
        val editReady = editPending.applying((provider.edit(requireNotNull(editPending.requestForActivePrompt())) as MockProviderResult.Success).value)

        assertEquals(2, editReady.readyImages.size)
        assertEquals(rootReady.readyImages.first().id, editReady.readyImages.last().parentId)
        assertEquals(2, editReady.history.size)
        assertEquals(EditorMode.EDIT, editReady.history.last().mode)
        assertEquals(rootReady.history.first().id, editReady.history.last().parentId)
    }

    @Test
    fun mockProvider_whenCanceled_removesPendingPlaceholder() {
        val pending = ProviderPipelineState().startingGenerate(prompt = "banana sticker on transparent background", requestId = "generate-1", network = NetworkReachability.ONLINE)

        val canceled = pending.canceling(requestId = "generate-1")

        assertEquals(1, pending.pendingImages.size)
        assertEquals(0, canceled.images.size)
        assertEquals(0, canceled.history.size)
        assertNull(canceled.activeRequestId)
    }

    @Test
    fun requestForActivePrompt_whenReferencesProvided_preservesAssetPathsForProvider() {
        val pending = ProviderPipelineState().startingGenerate(prompt = "banana sticker", requestId = "generate-1", network = NetworkReachability.ONLINE)

        val request = requireNotNull(
            pending.requestForActivePrompt(
                references = listOf(
                    ComposerReferenceSummary("ref-1", "banana.png", "references/ref-1.png"),
                    ComposerReferenceSummary("ref-2", "label.jpg", "references/ref-2.jpg"),
                ),
            ),
        )

        assertEquals(listOf("references/ref-1.png", "references/ref-2.jpg"), request.references.map { it.assetPath })
    }

    @Test
    fun mockProvider_whenSlowStaleResponseReturns_ignoresOlderResult() {
        val provider = MockImageProvider(scenario = MockProviderScenario.SLOW_SUCCESS)
        val slowPending = ProviderPipelineState().startingGenerate(prompt = "slow banana", requestId = "slow-1", network = NetworkReachability.ONLINE)
        val slowRequest = requireNotNull(slowPending.requestForActivePrompt())
        val canceled = slowPending.canceling(requestId = "slow-1")
        val nextPending = canceled.startingGenerate(prompt = "banana sticker on transparent background", requestId = "generate-2", network = NetworkReachability.ONLINE)

        val staleApplied = nextPending.applying((provider.generate(slowRequest) as MockProviderResult.Success).value)

        assertEquals(nextPending, staleApplied)
        assertEquals(listOf("pending-generate-2"), staleApplied.pendingImages.map { it.id })
        assertEquals(0, staleApplied.history.size)
    }

    @Test
    fun mockProvider_whenProviderErrorFails_removesPendingAndKeepsHistoryClean() {
        val provider = MockImageProvider(scenario = MockProviderScenario.PROVIDER_ERROR)
        val pending = ProviderPipelineState().startingGenerate(prompt = "banana sticker on transparent background", requestId = "generate-1", network = NetworkReachability.ONLINE)
        val request = requireNotNull(pending.requestForActivePrompt())
        val failure = provider.generate(request) as MockProviderResult.Failure

        val failed = pending.failing(requestId = request.id, message = failure.message)

        assertEquals(0, failed.images.size)
        assertEquals(0, failed.history.size)
        assertEquals(MockImageProvider.ErrorMessage, failed.userErrorMessage)
    }

    @Test
    fun editFailure_whenAnotherBranchWasCreatedLater_restoresFocusedParentBranch() {
        val root = readyImage("root", null, 1.0)
        val parent = readyImage("parent", root.id, 2.0)
        val laterBranch = readyImage("later", root.id, 3.0)
        val state = ProviderPipelineState(
            images = listOf(root, parent, laterBranch),
            history = listOf(historyEntry(root), historyEntry(parent), historyEntry(laterBranch)),
            focusedImageId = parent.id,
        )

        val failed = state.startingEdit("edit parent", CanvasAnnotations.Empty, "edit-fail", NetworkReachability.ONLINE)
            .failing("edit-fail", "failed")

        assertEquals(parent.id, failed.focusedImageId)
    }

    @Test
    fun editCancel_whenAnotherBranchWasCreatedLater_restoresFocusedParentBranch() {
        val root = readyImage("root", null, 1.0)
        val parent = readyImage("parent", root.id, 2.0)
        val laterBranch = readyImage("later", root.id, 3.0)
        val state = ProviderPipelineState(
            images = listOf(root, parent, laterBranch),
            history = listOf(historyEntry(root), historyEntry(parent), historyEntry(laterBranch)),
            focusedImageId = parent.id,
        )

        val canceled = state.startingEdit("edit parent", CanvasAnnotations.Empty, "edit-cancel", NetworkReachability.ONLINE)
            .canceling("edit-cancel")

        assertEquals(parent.id, canceled.focusedImageId)
    }

    @Test
    fun deletingHistoryBranch_removesDescendantsAndImagesAndReconcilesFocus() {
        val otherRoot = readyImage("other", null, 0.0)
        val root = readyImage("root", null, 1.0)
        val child = readyImage("child", root.id, 2.0)
        val grandchild = readyImage("grandchild", child.id, 3.0)
        val state = ProviderPipelineState(
            images = listOf(otherRoot, root, child, grandchild),
            history = listOf(historyEntry(otherRoot), historyEntry(root), historyEntry(child), historyEntry(grandchild)),
            focusedImageId = grandchild.id,
        )

        val deleted = state.deletingHistoryBranch(root.id)

        assertEquals(listOf(otherRoot.id), deleted.images.map { it.id })
        assertEquals(listOf(otherRoot.id), deleted.history.map { it.id })
        assertEquals(otherRoot.id, deleted.focusedImageId)
    }

    @Test
    fun deletingHistoryBranch_whenActiveEditParentIsDeleted_invalidatesLateSuccessAndFailure() {
        val root = readyImage("root", null, 1.0)
        val parent = readyImage("parent", root.id, 2.0)
        val state = ProviderPipelineState(
            images = listOf(root, parent),
            history = listOf(historyEntry(root), historyEntry(parent)),
            focusedImageId = parent.id,
        )
        val pending = state.startingEdit("edit parent", CanvasAnnotations.Empty, "edit-late", NetworkReachability.ONLINE)
        val request = requireNotNull(pending.requestForActivePrompt())
        val result = (MockImageProvider().edit(request) as MockProviderResult.Success).value

        val deleted = pending.deletingHistoryBranch(parent.id)
        val lateSuccess = deleted.applying(result)
        val lateFailure = deleted.failing(request.id, "late failure")

        assertNull(deleted.activeRequestId)
        assertEquals(listOf(root.id), deleted.images.map { it.id })
        assertEquals(deleted, lateSuccess)
        assertEquals(deleted, lateFailure)
    }

    @Test
    fun deletingHistoryBranch_whenUnrelatedBranchIsDeleted_keepsActiveRequestPending() {
        val deletedRoot = readyImage("deleted-root", null, 1.0)
        val activeRoot = readyImage("active-root", null, 2.0)
        val state = ProviderPipelineState(
            images = listOf(deletedRoot, activeRoot),
            history = listOf(historyEntry(deletedRoot), historyEntry(activeRoot)),
            focusedImageId = activeRoot.id,
        )
        val pending = state.startingEdit("edit active", CanvasAnnotations.Empty, "edit-active", NetworkReachability.ONLINE)

        val deleted = pending.deletingHistoryBranch(deletedRoot.id)

        assertEquals("edit-active", deleted.activeRequestId)
        assertEquals(listOf(activeRoot.id, "pending-edit-active"), deleted.images.map { it.id })
        assertEquals("pending-edit-active", deleted.focusedImageId)
    }

    @Test
    fun deletingHistoryBranch_whenPendingImageIsDeleted_invalidatesItsActiveRequest() {
        val pending = ProviderPipelineState().startingGenerate(
            prompt = "pending generation",
            requestId = "generate-pending",
            network = NetworkReachability.ONLINE,
        )

        val deleted = pending.deletingHistoryBranch("pending-generate-pending")

        assertEquals(emptyList<CanvasImage>(), deleted.images)
        assertNull(deleted.activeRequestId)
        assertNull(deleted.focusedImageId)
    }

    @Test
    fun mockProvider_whenOffline_failsFastWithoutPendingPlaceholder() {
        val offline = ProviderPipelineState().startingGenerate(prompt = "banana sticker on transparent background", requestId = "generate-1", network = NetworkReachability.OFFLINE)

        assertEquals(0, offline.images.size)
        assertEquals(0, offline.history.size)
        assertEquals("You are offline.", offline.userErrorMessage)
    }

    @Test
    fun mockProvider_whenOfflineEditRequested_failsFastWithoutPendingPlaceholder() {
        val provider = MockImageProvider()
        val rootPending = ProviderPipelineState().startingGenerate(prompt = "banana sticker", requestId = "generate-1", network = NetworkReachability.ONLINE)
        val rootReady = rootPending.applying((provider.generate(requireNotNull(rootPending.requestForActivePrompt())) as MockProviderResult.Success).value)

        val offline = rootReady.startingEdit(prompt = "make the peel brighter", annotations = CanvasAnnotations.Empty, requestId = "edit-1", network = NetworkReachability.OFFLINE)

        assertEquals(1, offline.readyImages.size)
        assertEquals(0, offline.pendingImages.size)
        assertEquals(1, offline.history.size)
        assertEquals("You are offline.", offline.userErrorMessage)
    }

    @Test
    fun lifecycle_whenBackgroundDuringSlowRequest_dropsLateResultAndDoesNotQueueForegroundRetry() {
        val provider = MockImageProvider(scenario = MockProviderScenario.SLOW_SUCCESS)
        val pending = ProviderPipelineState().startingGenerate(prompt = "slow banana", requestId = "slow-1", network = NetworkReachability.ONLINE)
        val request = requireNotNull(pending.requestForActivePrompt())

        val backgrounded = pending.movingToBackground()
        val staleApplied = backgrounded.applying((provider.generate(request) as MockProviderResult.Success).value)
        val foreground = staleApplied.returningToForeground(NetworkReachability.ONLINE)

        assertEquals(AppLifecyclePhase.BACKGROUND, backgrounded.lifecyclePhase)
        assertEquals(0, backgrounded.pendingImages.size)
        assertNull(backgrounded.activeRequestId)
        assertEquals(0, staleApplied.history.size)
        assertEquals(AppLifecyclePhase.FOREGROUND, foreground.lifecyclePhase)
        assertNull(foreground.activeRequestId)
        assertEquals(0, foreground.images.size)
    }

    @Test
    fun offlineLocalProject_whenOpenedAnnotatedAndComposed_keepsStorageAndExportAvailable() {
        val project = MobileProjectRecord("offline-project", "Offline Project", minimalManifest("offline-project", "Offline Project"), MinimalHistory, null)
        val storage = FakeProjectStorage(projects = listOf(project))
        val network = FakeNetworkStatus(NetworkReachability.OFFLINE)
        val export = FakeImageExport(FakePermissionGateway(mapOf(PermissionScope.IMAGE_EXPORT to PermissionDecision.GRANTED)))
        val temp = Files.createTempDirectory("bananatape-offline-lifecycle")
        val source = temp.resolve("source.png")
        Files.write(source, pngBytes(1, 2, 3, 4))
        val box = BoundingBox("box-1", 0.1, 0.1, 0.4, 0.4, "#0d99ff", AnnotationStatus.PENDING)
        val annotations = CanvasAnnotations(paths = emptyList(), boxes = listOf(box), memos = emptyList())
        val renderer = OfflineComposerRenderer(NativeImageMetadata(width = 16, height = 12, byteCount = 4, mimeType = "image/png"), pngBytes(5, 6), pngBytes(7, 8))

        val opened = storage.read(project.id)
        val composed = NativeImageComposer(renderer).compose(NativeImageCompositionRequest(source, annotations, temp.resolve("export")))
        val result = (composed as NativeImageCompositionOutcome.Success).result
        val exported = export.exportImage("offline-export", ImageExportDestination.ShareSheet, result.annotated.metadata.byteCount)

        assertEquals(NetworkReachability.OFFLINE, network.currentReachability())
        assertEquals(AdapterResult.Success(project), opened)
        assertEquals(listOf("box-1"), renderer.annotatedAnnotations?.boxes?.map { it.id })
        assertTrue(Files.exists(result.annotated.filePath))
        assertEquals(AdapterResult.Success(app.bananatape.mobile.adapters.ExportedImage("offline-export", ImageExportDestination.ShareSheet, result.annotated.metadata.byteCount)), exported)
    }

    @Test
    fun largeFixture_whenImportedComposedAndShared_staysFileBacked() {
        val root = Files.createTempDirectory("bananatape-large-fixture")
        val storage = LocalProjectStorage(root)
        val project = MobileProjectRecord("large-image-project", "Large Image Project", minimalManifest("large-image-project", "Large Image Project"), MinimalHistory, null)
        storage.create(project)
        val source = fixturePath("large-banana-source.jpg")
        val imported = storage.importProjectImage(
            ProjectImageImportRequest(
                projectId = project.id,
                assetId = "large-banana-source",
                role = ImportedImageRole.BASE_IMAGE,
                mimeType = ImageMimeType.JPEG,
                originalFileName = "large-banana-source.jpg",
                sourcePath = source,
            ),
        )
        val asset = (imported as AdapterResult.Success).value
        val renderer = OfflineComposerRenderer(NativeImageMetadata(width = 1, height = 1, byteCount = asset.byteCount, mimeType = "image/jpeg"), pngBytes(5, 6), pngBytes(7, 8))
        val composed = NativeImageComposer(renderer).compose(NativeImageCompositionRequest(asset.filePath, CanvasAnnotations.Empty, root.resolve(project.id).resolve("tmp/perf-export")))
        val result = (composed as NativeImageCompositionOutcome.Success).result
        val share = FakeOutboundImageShare(root.resolve(project.id).resolve("tmp/share"), Duration.ofMinutes(10))
        val shared = share.prepareShare(ExportableImage("large-export", result.annotated.filePath, ImageMimeType.PNG, result.annotated.metadata.width, result.annotated.metadata.height, result.annotated.metadata.byteCount, Instant.parse("2026-07-04T00:00:00Z")))

        assertEquals("assets/large-banana-source.jpg", asset.projectRelativePath)
        assertEquals(635, asset.byteCount)
        assertEquals("image/jpeg", result.original.mimeType)
        assertTrue(Files.exists(result.annotated.filePath))
        assertTrue(Files.exists(root.resolve(project.id).resolve("tmp/share/large-export.png")))
        assertEquals("content://app.bananatape.mobile.share/large-export.png", (shared as AdapterResult.Success).value.contentUri)
    }

    private fun pngBytes(vararg tail: Int): ByteArray = byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, *tail.map { it.toByte() }.toByteArray())

    private fun readyImage(id: String, parentId: String?, timestamp: Double) = CanvasImage(
        id, "file:///$id.png", "asset-$id", EditorSize(1.0, 1.0), EditorPoint(0.0, 0.0), parentId,
        timestamp.toInt(), id, EditorProvider.MOCK, if (parentId == null) EditorMode.GENERATE else EditorMode.EDIT,
        timestamp, CanvasAnnotations.Empty, false,
    )

    private fun historyEntry(image: CanvasImage) = HistoryEntry(
        image.id, image.mode, image.provider, image.prompt, requireNotNull(image.assetId), "assets/${image.id}.png",
        image.parentId, "1970-01-01T00:00:00Z", image.createdAt,
    )

    private fun minimalManifest(id: String, name: String): String = """{"schemaVersion":1,"id":"$id","name":"$name","createdAt":"1970-01-01T00:00:00.000Z","updatedAt":"1970-01-01T00:00:00.000Z","settings":{"systemPrompt":"","referenceImages":[]}}"""

    private fun fixturePath(fileName: String): Path {
        val userDir: String = System.getProperty("user.dir") ?: "."
        var directory = Path.of(userDir).toAbsolutePath()
        while (directory.parent != null) {
            val candidate = directory.resolve("../packages/mobile-contracts/fixtures").normalize().resolve(fileName)
            if (candidate.toFile().exists()) return candidate
            directory = directory.parent
        }
        error("Missing fixture $fileName")
    }

    private companion object {
        const val MinimalHistory = """{"schemaVersion":1,"revision":0,"entries":[]}"""
    }
}

private class OfflineComposerRenderer(
    private val sourceMetadata: NativeImageMetadata,
    private val annotatedBytes: ByteArray,
    private val maskBytes: ByteArray,
) : NativeImageRenderer {
    var annotatedAnnotations: CanvasAnnotations? = null

    override fun metadata(sourcePath: java.nio.file.Path): NativeImageMetadata = sourceMetadata

    override fun annotatedPng(sourcePath: java.nio.file.Path, annotations: CanvasAnnotations): ByteArray {
        annotatedAnnotations = annotations
        return annotatedBytes
    }

    override fun maskPng(size: EditorSize, annotations: CanvasAnnotations): ByteArray = maskBytes
}
