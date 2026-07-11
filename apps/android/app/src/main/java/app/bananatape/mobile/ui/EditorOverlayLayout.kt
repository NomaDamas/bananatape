package app.bananatape.mobile.ui

internal data class EditorOverlayLayout(
    val historyWidthDp: Int,
    val historyEndPaddingDp: Int,
    val overlayGapDp: Int,
    val lineageStartPaddingDp: Int,
    val lineageEndPaddingDp: Int,
)

internal data class EditorBoundsDp(
    val left: Double,
    val top: Double,
    val right: Double,
    val bottom: Double,
) {
    val width: Double = right - left
    val height: Double = bottom - top
}

internal data class EditorOverlayGeometry(
    val canvasBounds: EditorBoundsDp,
    val composerBounds: EditorBoundsDp,
    val toolRailBounds: EditorBoundsDp,
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

internal fun editorOverlayLayout(viewportWidthDp: Int, viewportHeightDp: Int): EditorOverlayGeometry {
    val contentWidth = minOf(viewportWidthDp.toDouble(), 720.0)
    val contentLeft = (viewportWidthDp - contentWidth) / 2.0
    val canvasWidth = contentWidth - 108.0
    val canvasHeight = canvasWidth / 0.78
    val canvasTop = (viewportHeightDp - canvasHeight) / 2.0
    val composerHeight = 74.0
    val toolRailHeight = (8 * 40) + (7 * 4) + (2 * 4)

    return EditorOverlayGeometry(
        canvasBounds = EditorBoundsDp(
            left = contentLeft + 54.0,
            top = canvasTop,
            right = contentLeft + 54.0 + canvasWidth,
            bottom = canvasTop + canvasHeight,
        ),
        composerBounds = EditorBoundsDp(
            left = contentLeft + 16.0,
            top = viewportHeightDp - 16.0 - composerHeight,
            right = contentLeft + contentWidth - 16.0,
            bottom = viewportHeightDp - 16.0,
        ),
        toolRailBounds = EditorBoundsDp(
            left = contentLeft + 12.0,
            top = (viewportHeightDp - toolRailHeight) / 2.0,
            right = contentLeft + 60.0,
            bottom = (viewportHeightDp + toolRailHeight) / 2.0,
        ),
    )
}
