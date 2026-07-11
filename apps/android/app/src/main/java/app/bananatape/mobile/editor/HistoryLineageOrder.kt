package app.bananatape.mobile.editor

internal data class HistoryLineageItem(
    val entry: HistoryEntry,
    val depth: Int,
)

internal fun historyLineageDisplayOrder(entries: List<HistoryEntry>): List<HistoryLineageItem> {
    val childrenByParent = entries.groupBy { it.parentId }
    val ordered = mutableListOf<HistoryLineageItem>()

    fun appendChildren(parentId: String?, depth: Int) {
        childrenByParent[parentId].orEmpty()
            .groupedByGenerationBatch()
            .forEach { batch ->
                batch.forEach { entry -> ordered += HistoryLineageItem(entry, depth) }
                batch.forEach { entry -> appendChildren(entry.id, depth + 1) }
            }
    }

    appendChildren(parentId = null, depth = 0)
    return ordered
}

internal fun List<HistoryEntry>.orderedByGenerationBatch(): List<HistoryEntry> =
    groupedByGenerationBatch().flatten()

private fun List<HistoryEntry>.groupedByGenerationBatch(): List<List<HistoryEntry>> =
    groupBy { entry -> entry.generationBatchId ?: "legacy:${entry.id}" }
        .values
        .map { batch -> batch.sortedWith(historyBatchItemOrder) }
        .sortedWith(compareBy<List<HistoryEntry>> { it.first().timestamp }.thenBy { it.first().id })

private val historyBatchItemOrder = compareBy<HistoryEntry> { it.batchIndex ?: 0 }
    .thenBy { it.timestamp }
    .thenBy { it.id }
