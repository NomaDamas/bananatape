package app.bananatape.mobile.ui

import androidx.compose.ui.input.pointer.PointerType
import app.bananatape.mobile.editor.CanvasAnnotations
import app.bananatape.mobile.editor.CanvasTool
import app.bananatape.mobile.editor.EditorPoint
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NativeCanvasSupportTest {
    @Test
    fun fitCenterDestinationRect_portraitSource_fillsAvailableHeightWithoutDistortion() {
        val destination = fitCenterDestinationRect(
            sourceWidth = 600.0,
            sourceHeight = 1200.0,
            availableWidth = 1000.0,
            availableHeight = 600.0,
        )

        assertEquals(350.0, destination.left, 0.0001)
        assertEquals(0.0, destination.top, 0.0001)
        assertEquals(300.0, destination.width, 0.0001)
        assertEquals(600.0, destination.height, 0.0001)
        assertEquals(0.5, destination.width / destination.height, 0.0001)
    }

    @Test
    fun fitCenterDestinationRect_landscapeSource_fillsAvailableWidthWithoutDistortion() {
        val destination = fitCenterDestinationRect(
            sourceWidth = 1200.0,
            sourceHeight = 600.0,
            availableWidth = 600.0,
            availableHeight = 1000.0,
        )

        assertEquals(0.0, destination.left, 0.0001)
        assertEquals(350.0, destination.top, 0.0001)
        assertEquals(600.0, destination.width, 0.0001)
        assertEquals(300.0, destination.height, 0.0001)
        assertEquals(2.0, destination.width / destination.height, 0.0001)
    }

    @Test
    fun arrowHeadGeometry_nonzeroArrow_producesTwoVisibleHeadSegments() {
        val geometry = arrowHeadGeometry(
            start = EditorPoint(10.0, 20.0),
            end = EditorPoint(110.0, 20.0),
            preferredHeadLength = 24.0,
        )

        assertNotNull(geometry)
        geometry!!
        assertEquals(EditorPoint(110.0, 20.0), geometry.tip)
        assertTrue(geometry.left != geometry.tip)
        assertTrue(geometry.right != geometry.tip)
        assertTrue(geometry.left != geometry.right)
        assertTrue(geometry.left.y < geometry.tip.y)
        assertTrue(geometry.right.y > geometry.tip.y)
    }

    @Test
    fun arrowHeadGeometry_zeroLengthArrow_isSafelySkipped() {
        assertNull(
            arrowHeadGeometry(
                start = EditorPoint(42.0, 42.0),
                end = EditorPoint(42.0, 42.0),
                preferredHeadLength = 24.0,
            ),
        )
    }

    @Test
    fun annotationDraft_penMovement_isVisibleBeforeCommitAndCommitsOnePath() {
        val start = EditorPoint(0.1, 0.2)
        val movement = EditorPoint(0.35, 0.45)
        val draft = requireNotNull(beginAnnotationDraft(CanvasTool.PEN, start)).movedTo(movement)

        assertEquals(listOf(start, movement), draft.visiblePathPoints)
        assertEquals(0, CanvasAnnotations.Empty.paths.size)

        val committed = commitAnnotationDraft(CanvasAnnotations.Empty, draft, id = "pen-live")
        assertEquals(1, committed.paths.size)
        assertEquals(listOf(start, movement), committed.paths.single().points)
    }

    @Test
    fun annotationPointers_touchAndStylusAreAccepted() {
        assertTrue(acceptsAnnotationPointer(PointerType.Touch))
        assertTrue(acceptsAnnotationPointer(PointerType.Stylus))
        assertTrue(acceptsAnnotationPointer(PointerType.Mouse))
    }

    @Test
    fun memoTap_createsAtNormalizedPositionAndTextUpdatePersists() {
        val destination = CanvasRect(left = 100.0, top = 50.0, width = 400.0, height = 200.0)
        val creation = createMemoAtTap(
            annotations = CanvasAnnotations.Empty,
            id = "memo-1",
            tap = EditorPoint(300.0, 150.0),
            destination = destination,
        )

        assertNotNull(creation)
        creation!!
        assertEquals(1, creation.annotations.memos.size)
        assertEquals(0.5, creation.memo.x, 0.0001)
        assertEquals(0.5, creation.memo.y, 0.0001)

        val updated = updateMemoText(creation.annotations, creation.memo.id, "Move label higher")
        assertEquals("Move label higher", updated.memos.single().text)
    }

    @Test
    fun memoOverlayRect_edgeMemo_staysInsideDestination() {
        val destination = CanvasRect(left = 40.0, top = 20.0, width = 320.0, height = 240.0)
        val creation = requireNotNull(
            createMemoAtTap(
                annotations = CanvasAnnotations.Empty,
                id = "memo-edge",
                tap = EditorPoint(destination.right, destination.bottom),
                destination = destination,
            ),
        )

        val overlay = memoOverlayRect(
            memo = creation.memo,
            destination = destination,
            preferredWidth = 140.0,
            preferredHeight = 84.0,
        )

        assertTrue(overlay.left >= destination.left)
        assertTrue(overlay.top >= destination.top)
        assertTrue(overlay.right <= destination.right)
        assertTrue(overlay.bottom <= destination.bottom)
    }
}
