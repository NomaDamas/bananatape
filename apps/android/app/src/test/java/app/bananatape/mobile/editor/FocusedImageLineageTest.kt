package app.bananatape.mobile.editor

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class FocusedImageLineageTest {
    @Test
    fun lineage_movesAcrossOrderedBatchSiblingsAndBetweenParentAndFirstChildBatch() {
        val rootFirst = image("root-a", null, "root-batch", 0, 3.0)
        val rootSecond = image("root-b", null, "root-batch", 1, 1.0)
        val childLater = image("child-b", rootSecond.id, "child-batch", 1, 2.0)
        val childFirst = image("child-a", rootSecond.id, "child-batch", 0, 4.0)
        val state = ProviderPipelineState(
            images = listOf(childLater, rootSecond, childFirst, rootFirst),
            history = listOf(
                history(rootFirst), history(rootSecond), history(childLater), history(childFirst),
            ),
            focusedImageId = rootFirst.id,
        )

        val right = state.movingFocusRight()
        val down = right.movingFocusDown()

        assertEquals(rootSecond.id, right.focusedImageId)
        assertEquals(childFirst.id, down.focusedImageId)
        assertEquals(rootSecond.id, down.movingFocusUp().focusedImageId)
        assertEquals(childLater.id, down.movingFocusRight().focusedImageId)
    }

    @Test
    fun lineage_ordersSiblingsByBatchIndexThenTimestampThenId() {
        val a = image("a", null, "batch", 0, 3.0)
        val b = image("b", null, "batch", 0, 1.0)
        val c = image("c", null, "batch", 0, 1.0)
        val state = ProviderPipelineState(images = listOf(a, c, b), focusedImageId = b.id)

        assertEquals(listOf("b", "c", "a"), state.focusedLineage.batchSiblings.map { it.id })
    }

    @Test
    fun lineageIndicatorsDescribeAvailableDirections() {
        val root = image("root", null, "root-batch", 0, 1.0)
        val sibling = image("sibling", null, "root-batch", 1, 2.0)
        val child = image("child", sibling.id, "child-batch", 0, 3.0)
        val state = ProviderPipelineState(images = listOf(root, sibling, child), focusedImageId = sibling.id)

        assertTrue(state.focusedLineage.canMoveLeft)
        assertFalse(state.focusedLineage.canMoveRight)
        assertFalse(state.focusedLineage.canMoveUp)
        assertTrue(state.focusedLineage.canMoveDown)
    }

    @Test
    fun lineageSiblingsAreReadyOnlyAndParentScoped() {
        val parent = image("parent", null, "parent-batch", 0, 1.0)
        val focused = image("focused", parent.id, "shared-batch", 0, 2.0)
        val readySibling = image("ready-sibling", parent.id, "shared-batch", 1, 3.0)
        val pendingSibling = image("pending-sibling", parent.id, "shared-batch", 2, 4.0, status = ImageGenerationStatus.PENDING)
        val otherParentSibling = image("other-parent", "different-parent", "shared-batch", 1, 5.0)
        val state = ProviderPipelineState(
            images = listOf(parent, focused, pendingSibling, otherParentSibling, readySibling),
            focusedImageId = focused.id,
        )

        assertEquals(listOf(focused.id, readySibling.id), state.focusedLineage.batchSiblings.map { it.id })
        assertEquals(readySibling.id, state.movingFocusRight().focusedImageId)
        assertEquals(readySibling.id, state.movingFocusRight().movingFocusRight().focusedImageId)
    }

    private fun image(
        id: String,
        parentId: String?,
        batchId: String?,
        batchIndex: Int?,
        timestamp: Double,
        status: ImageGenerationStatus = ImageGenerationStatus.READY,
    ) = CanvasImage(
        id = id,
        url = "file:///$id.png",
        assetId = "asset-$id",
        size = EditorSize(1024.0, 1024.0),
        position = EditorPoint(0.0, 0.0),
        parentId = parentId,
        generationIndex = timestamp.toInt(),
        prompt = "prompt-$id",
        provider = EditorProvider.MOCK,
        mode = if (parentId == null) EditorMode.GENERATE else EditorMode.EDIT,
        createdAt = timestamp,
        annotations = CanvasAnnotations.Empty,
        hasMagicLayerFields = false,
        status = status,
        generationBatchId = batchId,
        batchIndex = batchIndex,
    )

    private fun history(image: CanvasImage) = HistoryEntry(
        id = image.id,
        mode = image.mode,
        provider = image.provider,
        prompt = image.prompt,
        assetId = requireNotNull(image.assetId),
        assetPath = "assets/${image.id}.png",
        parentId = image.parentId,
        createdAt = "1970-01-01T00:00:00Z",
        timestamp = image.createdAt,
        generationBatchId = image.generationBatchId,
        batchIndex = image.batchIndex,
    )
}
