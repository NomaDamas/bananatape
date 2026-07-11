package app.bananatape.mobile.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class EditorOverlayLayoutTest {
    @Test
    fun phoneViewports_keepCanvasAndControlsVisibleWithoutIncoherentOverlap() {
        val viewports = listOf(
            "Pixel 7 portrait" to Viewport(width = 412, height = 915),
            "smaller phone" to Viewport(width = 360, height = 640),
        )

        viewports.forEach { (name, viewport) ->
            val geometry = editorOverlayLayout(viewport.width, viewport.height)

            assertTrue("$name canvas width must be positive", geometry.canvasBounds.width > 0.0)
            assertTrue("$name canvas height must be positive", geometry.canvasBounds.height > 0.0)
            assertWithinViewport(name, "canvas", geometry.canvasBounds, viewport)
            assertWithinViewport(name, "composer", geometry.composerBounds, viewport)
            assertWithinViewport(name, "tool rail", geometry.toolRailBounds, viewport)
            assertFalse("$name composer overlaps canvas", geometry.composerBounds.intersects(geometry.canvasBounds))
            assertFalse("$name composer overlaps tool rail", geometry.composerBounds.intersects(geometry.toolRailBounds))
        }
    }

    @Test
    fun representativePhoneViewports_keepStableOverlayBounds() {
        assertGeometry(
            actual = editorOverlayLayout(viewportWidthDp = 412, viewportHeightDp = 915),
            expectedCanvas = EditorBoundsDp(54.0, 262.628205, 358.0, 652.371795),
            expectedComposer = EditorBoundsDp(16.0, 825.0, 396.0, 899.0),
            expectedToolRail = EditorBoundsDp(12.0, 279.5, 60.0, 635.5),
        )
        assertGeometry(
            actual = editorOverlayLayout(viewportWidthDp = 360, viewportHeightDp = 640),
            expectedCanvas = EditorBoundsDp(54.0, 158.461538, 306.0, 481.538462),
            expectedComposer = EditorBoundsDp(16.0, 550.0, 344.0, 624.0),
            expectedToolRail = EditorBoundsDp(12.0, 142.0, 60.0, 498.0),
        )
    }

    private fun assertWithinViewport(name: String, region: String, bounds: EditorBoundsDp, viewport: Viewport) {
        assertTrue("$name $region starts left of viewport", bounds.left >= 0.0)
        assertTrue("$name $region starts above viewport", bounds.top >= 0.0)
        assertTrue("$name $region extends right of viewport", bounds.right <= viewport.width)
        assertTrue("$name $region extends below viewport", bounds.bottom <= viewport.height)
    }

    private fun assertGeometry(
        actual: EditorOverlayGeometry,
        expectedCanvas: EditorBoundsDp,
        expectedComposer: EditorBoundsDp,
        expectedToolRail: EditorBoundsDp,
    ) {
        assertBounds(expectedCanvas, actual.canvasBounds)
        assertBounds(expectedComposer, actual.composerBounds)
        assertBounds(expectedToolRail, actual.toolRailBounds)
    }

    private fun assertBounds(expected: EditorBoundsDp, actual: EditorBoundsDp) {
        assertEquals(expected.left, actual.left, TOLERANCE)
        assertEquals(expected.top, actual.top, TOLERANCE)
        assertEquals(expected.right, actual.right, TOLERANCE)
        assertEquals(expected.bottom, actual.bottom, TOLERANCE)
    }

    private fun EditorBoundsDp.intersects(other: EditorBoundsDp): Boolean =
        left < other.right && right > other.left && top < other.bottom && bottom > other.top

    private data class Viewport(val width: Int, val height: Int)

    private companion object {
        const val TOLERANCE = 0.000001
    }
}
