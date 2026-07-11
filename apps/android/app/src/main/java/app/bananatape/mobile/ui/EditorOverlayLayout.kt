package app.bananatape.mobile.ui

internal data class EditorOverlayLayout(
    val historyWidthDp: Int,
    val historyEndPaddingDp: Int,
    val overlayGapDp: Int,
    val lineageStartPaddingDp: Int,
    val lineageEndPaddingDp: Int,
)

internal fun editorOverlayLayout(isExpandedWidth: Boolean): EditorOverlayLayout {
    val historyWidth = if (isExpandedWidth) 280 else 0
    val historyEndPadding = if (isExpandedWidth) 16 else 0
    val overlayGap = if (isExpandedWidth) 8 else 0
    return EditorOverlayLayout(
        historyWidthDp = historyWidth,
        historyEndPaddingDp = historyEndPadding,
        overlayGapDp = overlayGap,
        lineageStartPaddingDp = 8,
        lineageEndPaddingDp = if (isExpandedWidth) historyWidth + historyEndPadding + overlayGap else 8,
    )
}
