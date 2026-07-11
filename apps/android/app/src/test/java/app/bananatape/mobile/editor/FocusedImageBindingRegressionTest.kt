package app.bananatape.mobile.editor

import app.bananatape.mobile.adapters.NetworkReachability
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class FocusedImageBindingRegressionTest {
    @Test
    fun legacyImagesWithoutBatchMetadataRemainSingletonBatches() {
        val first = legacyImage("legacy-a", null, 1.0)
        val second = legacyImage("legacy-b", null, 2.0)
        val state = ProviderPipelineState(images = listOf(first, second), focusedImageId = first.id)

        assertEquals(listOf(first.id), state.focusedLineage.batchSiblings.map { it.id })
        assertFalse(state.focusedLineage.canMoveRight)
    }

    @Test
    fun focusedImageBindsAnnotationsHistoryEditParentAndExportEntry() {
        val first = legacyImage("first", null, 1.0, annotationId = "annotation-first")
        val second = legacyImage("second", null, 2.0, annotationId = "annotation-second")
        val history = listOf(history(first), history(second))
        val focused = ProviderPipelineState(images = listOf(first, second), history = history, focusedImageId = first.id)

        val editPending = focused.startingEdit("edit first", first.annotations, "edit-1", NetworkReachability.ONLINE)

        assertEquals(first.id, focused.focusedImage?.id)
        assertEquals("prompt-first", focused.focusedImage?.prompt)
        assertEquals(listOf("annotation-first"), focused.focusedAnnotations.boxes.map { it.id })
        assertEquals(first.id, focused.historyBrowserState.selectedEntryId)
        assertEquals(first.id, focused.focusedHistoryEntry?.id)
        assertEquals(first.id, editPending.requestForActivePrompt()?.parentImageId)
        assertEquals(first.id, editPending.requestForActivePrompt()?.parentHistoryId)
    }

    @Test
    fun focusingReadyImagePreservesProjectFieldsAndEntersEditModeEvenForRoot() {
        val reference = ComposerReferenceSummary("reference", "Reference", "references/reference.png")
        val composer = ComposerState(
            promptText = "project prompt",
            selectedProvider = ComposerProvider.OPENAI,
            outputSize = OutputSize.PORTRAIT,
            systemPrompt = "project system prompt",
            projectContext = "project context",
            references = listOf(reference),
            mode = EditorMode.EDIT,
        )

        val focused = composer.withFocusedImageSelection(legacyImage("focused", null, 1.0))

        assertEquals("project prompt", focused.promptText)
        assertEquals(ComposerProvider.OPENAI, focused.selectedProvider)
        assertEquals(OutputSize.PORTRAIT, focused.outputSize)
        assertEquals("project system prompt", focused.systemPrompt)
        assertEquals("project context", focused.projectContext)
        assertEquals(listOf(reference), focused.references)
        assertEquals(true, focused.hasSelectedImage)
        assertEquals(EditorMode.EDIT, focused.mode)
    }

    @Test
    fun explicitFocusedModeRoutesEmptyAnnotationEditsAndRootGenerations() {
        val root = legacyImage("root", null, 1.0)
        val child = legacyImage("child", root.id, 2.0)
        val history = listOf(history(root), history(child))
        val focusedChild = ProviderPipelineState(images = listOf(root, child), history = history, focusedImageId = child.id)
        val composer = ComposerState(mode = EditorMode.GENERATE).withFocusedImageSelection(focusedChild.focusedImage)

        val editMode = resolvedSubmissionMode(composer.mode, focusedChild.focusedImage)
        val pending = when (editMode) {
            EditorMode.EDIT -> focusedChild.startingEdit("empty annotation edit", CanvasAnnotations.Empty, "edit-empty", NetworkReachability.ONLINE)
            EditorMode.GENERATE -> focusedChild.startingGenerate("empty annotation edit", "edit-empty", NetworkReachability.ONLINE)
        }
        val request = pending.requestForActivePrompt()
        val result = MockImageProvider().edit(requireNotNull(request)) as MockProviderResult.Success
        val applied = pending.applying(result.value)
        val postResultComposer = composer.withFocusedImageSelection(applied.focusedImage)

        assertEquals(EditorMode.EDIT, composer.mode)
        assertEquals(EditorMode.EDIT, editMode)
        assertEquals(EditorMode.EDIT, request?.mode)
        assertEquals(child.id, request?.parentImageId)
        assertEquals(child.id, request?.parentHistoryId)
        assertEquals(CanvasAnnotations.Empty, request?.annotations)
        assertEquals(EditorMode.EDIT, applied.focusedImage?.mode)
        assertEquals(EditorMode.EDIT, postResultComposer.mode)
        assertEquals(EditorMode.GENERATE, resolvedSubmissionMode(composer.copy(mode = EditorMode.GENERATE).mode, root))
        assertEquals(EditorMode.GENERATE, resolvedSubmissionMode(EditorMode.EDIT, null))
        assertEquals(EditorMode.GENERATE, resolvedSubmissionMode(EditorMode.EDIT, child.copy(status = ImageGenerationStatus.PENDING)))
    }

    @Test
    fun jsonBatchMetadataIsAdditiveAndMissingValuesUseLegacyFallback() {
        val json = """{"schemaVersion":1,"settings":{},"canvas":{"images":{"new":{"id":"new","url":"assets/new.png","assetId":"asset-new","size":{"width":1,"height":1},"position":{"x":0,"y":0},"parentId":null,"generationIndex":0,"generationBatchId":"batch-1","batchIndex":2,"prompt":"new","provider":"mock","type":"generate","createdAt":1},"legacy":{"id":"legacy","url":"assets/legacy.png","assetId":"asset-legacy","size":{"width":1,"height":1},"position":{"x":0,"y":0},"parentId":null,"generationIndex":1,"prompt":"legacy","provider":"mock","type":"generate","createdAt":2}},"imageOrder":["new","legacy"],"focusedImageIds":["new"]}}"""

        val document = MobileCanvasDocument.parse(json)

        assertEquals("batch-1", document.images.getValue("new").generationBatchId)
        assertEquals(2, document.images.getValue("new").batchIndex)
        assertEquals(null, document.images.getValue("legacy").generationBatchId)
        assertEquals(null, document.images.getValue("legacy").batchIndex)
        assertEquals(json, document.toJsonString())
    }

    private fun legacyImage(id: String, parentId: String?, timestamp: Double, annotationId: String? = null) = CanvasImage(
        id = id,
        url = "file:///$id.png",
        assetId = "asset-$id",
        size = EditorSize(1.0, 1.0),
        position = EditorPoint(0.0, 0.0),
        parentId = parentId,
        generationIndex = timestamp.toInt(),
        prompt = "prompt-$id",
        provider = EditorProvider.MOCK,
        mode = if (parentId == null) EditorMode.GENERATE else EditorMode.EDIT,
        createdAt = timestamp,
        annotations = CanvasAnnotations(emptyList(), annotationId?.let { listOf(BoundingBox(it, 0.0, 0.0, 1.0, 1.0, "#fff", AnnotationStatus.PENDING)) }.orEmpty(), emptyList()),
        hasMagicLayerFields = false,
    )

    private fun history(image: CanvasImage) = HistoryEntry(
        image.id, image.mode, image.provider, image.prompt, requireNotNull(image.assetId), "assets/${image.id}.png",
        image.parentId, "1970-01-01T00:00:00Z", image.createdAt,
    )
}
