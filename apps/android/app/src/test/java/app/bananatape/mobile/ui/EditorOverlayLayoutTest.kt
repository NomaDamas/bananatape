package app.bananatape.mobile.ui

import org.junit.Assert.assertTrue
import org.junit.Test

class EditorOverlayLayoutTest {
    @Test
    fun expandedHistory_whenVisible_reservesPanelAndMarginFromRightLineageIndicator() {
        val layout = editorOverlayLayout(isExpandedWidth = true)

        assertTrue(layout.lineageEndPaddingDp >= layout.historyWidthDp + layout.historyEndPaddingDp + layout.overlayGapDp)
    }
}
