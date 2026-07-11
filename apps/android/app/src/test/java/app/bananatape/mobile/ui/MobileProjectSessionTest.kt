package app.bananatape.mobile.ui

import app.bananatape.mobile.adapters.AdapterResult
import app.bananatape.mobile.adapters.MobileProjectRecord
import app.bananatape.mobile.editor.AnnotationStatus
import app.bananatape.mobile.editor.BoundingBox
import app.bananatape.mobile.editor.CanvasAnnotations
import app.bananatape.mobile.editor.CanvasImage
import app.bananatape.mobile.editor.ComposerState
import app.bananatape.mobile.editor.EditorMode
import app.bananatape.mobile.editor.EditorPoint
import app.bananatape.mobile.editor.EditorProvider
import app.bananatape.mobile.editor.EditorSize
import app.bananatape.mobile.editor.HistoryEntry
import app.bananatape.mobile.editor.ProviderPipelineState
import app.bananatape.mobile.editor.TextMemo
import app.bananatape.mobile.storage.LocalProjectStorage
import java.nio.file.Files
import org.junit.Assert.assertEquals
import org.junit.Test

class MobileProjectSessionTest {
    @Test
    fun restoredFocusedImageId_whenPersistedFocusIsStale_fallsBackToLastReadyImage() {
        val images = listOf(image("root"), image("child", parentId = "root"))

        val restored = restoredFocusedImageId(images, listOf("pending-stale"))

        assertEquals("child", restored)
    }

    @Test
    fun persistedFocusedImageIds_whenFocusChanges_roundTripsTheNavigatedFocus() {
        val images = listOf(image("root"), image("child", parentId = "root"))
        val focusedRoot = ProviderPipelineState(images = images, focusedImageId = "root")

        val persisted = persistedFocusedImageIds(focusedRoot)
        val restored = restoredFocusedImageId(images, persisted)

        assertEquals(listOf("root"), persisted)
        assertEquals("root", restored)
    }

    @Test
    fun recoveredImageFromHistory_preservesBatchMetadata() {
        val entry = history("child", parentId = "root", batchId = "batch-child", batchIndex = 1)

        val recovered = recoveredImageFromHistory(entry, index = 2, url = "file:///child.png")

        assertEquals("batch-child", recovered.generationBatchId)
        assertEquals(1, recovered.batchIndex)
    }

    @Test
    fun projectSession_whenCascadeDeletionIsPersisted_reconcilesStateAcrossReload() {
        val rootDirectory = Files.createTempDirectory("bananatape-session-round-trip")
        try {
            val storage = LocalProjectStorage(rootDirectory)
            val project = MobileProjectRecord(
                id = "round-trip-project",
                name = "Round Trip Project",
                manifestJson = manifest("round-trip-project", "Round Trip Project"),
                historyJson = MinimalHistoryJson,
                canvasJson = null,
            )
            assertEquals(AdapterResult.Success(project), storage.create(project))
            val retainedRoot = image("retained-root", batchId = "batch-root", batchIndex = 0)
            val deletedRoot = image("deleted-root", batchId = "batch-deleted", batchIndex = 0)
            val deletedChild = image("deleted-child", parentId = deletedRoot.id, batchId = "batch-child", batchIndex = 1)
            val deleted = ProviderPipelineState(
                images = listOf(retainedRoot, deletedRoot, deletedChild),
                history = listOf(
                    history(retainedRoot.id, null, "batch-root", 0),
                    history(deletedRoot.id, null, "batch-deleted", 0),
                    history(deletedChild.id, deletedRoot.id, "batch-child", 1),
                ),
                focusedImageId = deletedChild.id,
            ).deletingHistoryBranch(deletedRoot.id)
            val focusedAnnotations = CanvasAnnotations(
                paths = emptyList(),
                boxes = listOf(BoundingBox("focus-box", 0.1, 0.2, 0.3, 0.4, "#ffcc00", AnnotationStatus.REVIEW)),
                memos = listOf(TextMemo("focus-memo", 0.5, 0.6, "Keep this annotation", "#ffffff")),
            )

            persistProjectSession(storage, project.id, ComposerState(), deleted, deleted.historyBrowserState, focusedAnnotations)
            val restarted = LocalProjectStorage(rootDirectory)
            val record = (restarted.read(project.id) as AdapterResult.Success).value
            val reloaded = loadProjectSession(restarted, record)

            assertEquals(retainedRoot.id, reloaded.pipelineState.focusedImageId)
            assertEquals(listOf(retainedRoot.id), reloaded.pipelineState.images.map { it.id })
            assertEquals(listOf(retainedRoot.id), reloaded.pipelineState.history.map { it.id })
            assertEquals("batch-root", reloaded.pipelineState.focusedImage?.generationBatchId)
            assertEquals(0, reloaded.pipelineState.focusedImage?.batchIndex)
            assertEquals("batch-root", reloaded.pipelineState.history.single().generationBatchId)
            assertEquals(0, reloaded.pipelineState.history.single().batchIndex)
            assertEquals(focusedAnnotations, reloaded.pipelineState.focusedImage?.annotations)
            assertEquals(focusedAnnotations, reloaded.annotations)
        } finally {
            rootDirectory.toFile().deleteRecursively()
        }
    }

    private fun image(id: String, parentId: String? = null, batchId: String? = null, batchIndex: Int? = null) = CanvasImage(
        id, "file:///$id.png", "asset-$id", EditorSize(1.0, 1.0), EditorPoint(0.0, 0.0), parentId,
        0, id, EditorProvider.MOCK, if (parentId == null) EditorMode.GENERATE else EditorMode.EDIT, 1.0,
        CanvasAnnotations.Empty, false, generationBatchId = batchId, batchIndex = batchIndex,
    )

    private fun history(id: String, parentId: String?, batchId: String, batchIndex: Int) = HistoryEntry(
        id, if (parentId == null) EditorMode.GENERATE else EditorMode.EDIT, EditorProvider.MOCK, id,
        "asset-$id", "assets/$id.png", parentId, "1970-01-01T00:00:00Z", 1.0, batchId, batchIndex,
    )

}
