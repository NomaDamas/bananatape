package app.bananatape.mobile.editor

import org.junit.Assert.assertEquals
import org.junit.Test

class NativeCanvasStateTest {
    @Test
    fun annotations_whenAddingPathBoxMemo_countsAndFocusAreSerialized() {
        val pen = DrawingPath("pen-1", DrawingTool.PEN, listOf(EditorPoint(0.1, 0.1), EditorPoint(0.2, 0.3)), "#ffffff", 2.0)
        val arrow = DrawingPath("arrow-1", DrawingTool.ARROW, listOf(EditorPoint(0.2, 0.2), EditorPoint(0.8, 0.7)), "#0d99ff", 3.0)
        val box = BoundingBox("box-1", 0.25, 0.3, 0.4, 0.25, "#0d99ff", AnnotationStatus.PENDING)
        val memo = TextMemo("memo-1", 0.6, 0.2, "Tighten label", "#fef08a")

        val state = NativeCanvasState(image = NativeCanvasState.FixtureImage)
            .adding(pen)
            .adding(arrow)
            .adding(box)
            .adding(memo)
            .selecting(box.id)

        assertEquals(listOf("pen-1", "arrow-1"), state.annotations.paths.map { it.id })
        assertEquals(listOf("box-1"), state.annotations.boxes.map { it.id })
        assertEquals(listOf("memo-1"), state.annotations.memos.map { it.id })
        assertEquals("box-1", state.focusedAnnotationId)
        assertEquals(mapOf("paths" to 2, "boxes" to 1, "memos" to 1), state.serializedAnnotationCounts)
    }

    @Test
    fun viewport_whenPanAndZoomApplied_tracksNativeGestureState() {
        val state = NativeCanvasState(image = NativeCanvasState.FixtureImage)
            .panningBy(EditorPoint(24.0, -12.0))
            .zoomingTo(1.75)

        assertEquals(EditorPoint(24.0, -12.0), state.viewport.pan)
        assertEquals(1.75, state.viewport.zoom, 0.0)
    }

    @Test
    fun history_whenCanvasAnnotationsUndoRedo_restoresNativeCanvasCounts() {
        val pen = DrawingPath("pen-1", DrawingTool.PEN, listOf(EditorPoint(0.0, 0.0), EditorPoint(1.0, 1.0)), "#ffffff", 2.0)
        val box = BoundingBox("box-1", 0.1, 0.1, 0.5, 0.5, "#0d99ff", AnnotationStatus.PENDING)
        val added = AnnotationHistoryStack().apply(NativeCanvasState(image = NativeCanvasState.FixtureImage).adding(pen).annotations)
        val updated = added.apply(NativeCanvasState(image = NativeCanvasState.FixtureImage, annotations = added.current).adding(box).annotations)
        val undone = updated.undo()

        assertEquals(listOf("pen-1"), undone.current.paths.map { it.id })
        assertEquals(0, undone.current.boxes.size)

        val redone = undone.redo()
        assertEquals(listOf("pen-1"), redone.current.paths.map { it.id })
        assertEquals(listOf("box-1"), redone.current.boxes.map { it.id })
    }
}
