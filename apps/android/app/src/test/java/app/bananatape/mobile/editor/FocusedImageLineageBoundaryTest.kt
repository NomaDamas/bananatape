package app.bananatape.mobile.editor

import org.junit.Assert.assertEquals
import org.junit.Test

class FocusedImageLineageBoundaryTest {
    @Test
    fun lineage_clampsAtEveryUnavailableBoundary() {
        val root = image("root", null, "root-batch", 0)
        val child = image("child", root.id, "child-batch", 0)

        val rootState = ProviderPipelineState(images = listOf(root, child), focusedImageId = root.id)
        assertEquals(root.id, rootState.movingFocusLeft().focusedImageId)
        assertEquals(root.id, rootState.movingFocusRight().focusedImageId)
        assertEquals(root.id, rootState.movingFocusUp().focusedImageId)

        val childState = rootState.movingFocusDown()
        assertEquals(child.id, childState.movingFocusLeft().focusedImageId)
        assertEquals(child.id, childState.movingFocusRight().focusedImageId)
        assertEquals(child.id, childState.movingFocusDown().focusedImageId)
    }

    @Test
    fun lineage_downChoosesFirstDirectChildBatchNotDescendantOrLaterBatch() {
        val root = image("root", null, "root-batch", 0)
        val laterBatch = image("later", root.id, "z-batch", 0, timestamp = 2.0)
        val firstBatchSecond = image("first-1", root.id, "a-batch", 1, timestamp = 1.0)
        val firstBatchFirst = image("first-0", root.id, "a-batch", 0, timestamp = 3.0)
        val grandchild = image("grandchild", firstBatchFirst.id, "grandchild-batch", 0, timestamp = 0.0)
        val state = ProviderPipelineState(images = listOf(grandchild, laterBatch, firstBatchSecond, root, firstBatchFirst), focusedImageId = root.id)

        assertEquals(firstBatchFirst.id, state.movingFocusDown().focusedImageId)
    }

    @Test
    fun verticalLineageIgnoresPendingParentsAndChildren() {
        val root = image("root", null, "root-batch", 0)
        val pendingChild = image("pending-child", root.id, "pending-batch", 0, timestamp = 0.0, status = ImageGenerationStatus.PENDING)
        val readyChild = image("ready-child", root.id, "ready-batch", 0, timestamp = 1.0)
        val pendingParent = image("pending-parent", null, "parent-batch", 0, status = ImageGenerationStatus.PENDING)
        val orphanedReadyChild = image("orphan", pendingParent.id, "orphan-batch", 0)

        val rootState = ProviderPipelineState(images = listOf(root, pendingChild, readyChild), focusedImageId = root.id)
        val orphanState = ProviderPipelineState(images = listOf(pendingParent, orphanedReadyChild), focusedImageId = orphanedReadyChild.id)

        assertEquals(readyChild.id, rootState.movingFocusDown().focusedImageId)
        assertEquals(orphanedReadyChild.id, orphanState.movingFocusUp().focusedImageId)
    }

    @Test
    fun swipePolicyPreservesPanAndAnnotationGestures() {
        val annotationTools = listOf(CanvasTool.PEN, CanvasTool.BOX, CanvasTool.ARROW, CanvasTool.MEMO)

        assertEquals(null, lineageSwipeDirection(CanvasTool.PAN, deltaX = -120f, deltaY = 0f))
        annotationTools.forEach { tool ->
            assertEquals(tool.name, null, lineageSwipeDirection(tool, deltaX = -120f, deltaY = 0f))
        }
    }

    @Test
    fun swipePolicyRequiresThresholdAndClearDominantAxis() {
        assertEquals(null, lineageSwipeDirection(CanvasTool.SELECT, deltaX = -47f, deltaY = 0f))
        assertEquals(null, lineageSwipeDirection(CanvasTool.SELECT, deltaX = 100f, deltaY = 90f))
        assertEquals(LineageDirection.RIGHT, lineageSwipeDirection(CanvasTool.SELECT, deltaX = -120f, deltaY = 10f))
        assertEquals(LineageDirection.LEFT, lineageSwipeDirection(CanvasTool.SELECT, deltaX = 120f, deltaY = 10f))
        assertEquals(LineageDirection.DOWN, lineageSwipeDirection(CanvasTool.SELECT, deltaX = 10f, deltaY = -120f))
        assertEquals(LineageDirection.UP, lineageSwipeDirection(CanvasTool.SELECT, deltaX = 10f, deltaY = 120f))
    }

    private fun image(
        id: String,
        parentId: String?,
        batchId: String?,
        batchIndex: Int?,
        timestamp: Double = 1.0,
        status: ImageGenerationStatus = ImageGenerationStatus.READY,
    ) = CanvasImage(
        id, "file:///$id.png", "asset-$id", EditorSize(1.0, 1.0), EditorPoint(0.0, 0.0), parentId, 0,
        id, EditorProvider.MOCK, if (parentId == null) EditorMode.GENERATE else EditorMode.EDIT, timestamp,
        CanvasAnnotations.Empty, false, status = status, generationBatchId = batchId, batchIndex = batchIndex,
    )
}
