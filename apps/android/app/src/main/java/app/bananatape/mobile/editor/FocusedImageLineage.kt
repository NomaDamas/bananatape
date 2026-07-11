package app.bananatape.mobile.editor

data class FocusedImageLineage(
    val batchSiblings: List<CanvasImage> = emptyList(),
    val siblingIndex: Int = -1,
    val parent: CanvasImage? = null,
    val firstDirectChild: CanvasImage? = null,
) {
    val canMoveLeft: Boolean = siblingIndex > 0
    val canMoveRight: Boolean = siblingIndex >= 0 && siblingIndex < batchSiblings.lastIndex
    val canMoveUp: Boolean = parent != null
    val canMoveDown: Boolean = firstDirectChild != null
}

internal fun focusedImageLineage(images: List<CanvasImage>, focusedImageId: String?): FocusedImageLineage {
    val readyImages = images.filter { it.status == ImageGenerationStatus.READY }
    val focused = readyImages.firstOrNull { it.id == focusedImageId } ?: return FocusedImageLineage()
    val siblings = if (focused.generationBatchId == null) {
        listOf(focused)
    } else {
        readyImages.filter { it.generationBatchId == focused.generationBatchId && it.parentId == focused.parentId }
            .sortedWith(lineageOrder)
    }
    val firstChild = readyImages.filter { it.parentId == focused.id }
        .groupBy { it.generationBatchId ?: it.id }
        .values
        .mapNotNull { batch -> batch.minWithOrNull(childBatchAnchorOrder)?.let { anchor -> batch to anchor } }
        .minWithOrNull(compareBy<Pair<List<CanvasImage>, CanvasImage>> { it.second.createdAt }.thenBy { it.second.id })
        ?.first
        ?.minWithOrNull(lineageOrder)
    return FocusedImageLineage(
        batchSiblings = siblings,
        siblingIndex = siblings.indexOfFirst { it.id == focused.id },
        parent = focused.parentId?.let { parentId -> readyImages.firstOrNull { it.id == parentId } },
        firstDirectChild = firstChild,
    )
}

internal fun ProviderPipelineState.movingFocus(direction: LineageDirection): ProviderPipelineState {
    val target = when (direction) {
        LineageDirection.LEFT -> focusedLineage.batchSiblings.getOrNull(focusedLineage.siblingIndex - 1)
        LineageDirection.RIGHT -> focusedLineage.batchSiblings.getOrNull(focusedLineage.siblingIndex + 1)
        LineageDirection.UP -> focusedLineage.parent
        LineageDirection.DOWN -> focusedLineage.firstDirectChild
    }
    return target?.let { focusing(it.id) } ?: this
}

private val lineageOrder = compareBy<CanvasImage> { it.batchIndex ?: 0 }
    .thenBy { it.createdAt }
    .thenBy { it.id }

private val childBatchAnchorOrder = compareBy<CanvasImage> { it.createdAt }.thenBy { it.id }
