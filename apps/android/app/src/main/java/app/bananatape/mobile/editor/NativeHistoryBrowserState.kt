package app.bananatape.mobile.editor

data class HistoryBrowserRow(
    val entry: HistoryEntry,
    val depth: Int,
    val branchLabel: String,
    val versionLabel: String,
    val isSelected: Boolean,
) {
    val id: String = entry.id
}

data class ExportPreviewMetadata(
    val entryId: String,
    val title: String,
    val assetPath: String,
    val providerLabel: String,
    val annotationsMessage: String,
    val magicLayerMessage: String?,
)

data class NativeHistoryBrowserState(
    val entries: List<HistoryEntry>,
    val selectedEntryId: String? = entries.firstOrNull()?.id,
) {
    val rows: List<HistoryBrowserRow> = buildRows()
    val selectedEntry: HistoryEntry? = entries.firstOrNull { it.id == selectedEntryId }
    val historyCountLabel: String = "${entries.size} ${if (entries.size == 1) "version" else "versions"}"
    val exportPreview: ExportPreviewMetadata? = selectedEntry?.let { entry ->
        ExportPreviewMetadata(
            entryId = entry.id,
            title = if (entry.mode == EditorMode.GENERATE) "Root generation" else "Edit child",
            assetPath = entry.assetPath,
            providerLabel = if (entry.provider == EditorProvider.CODEX) "codex" else "OpenAI",
            annotationsMessage = "Annotations are excluded from exported PNGs.",
            magicLayerMessage = null,
        )
    }

    fun selecting(entryId: String): NativeHistoryBrowserState =
        if (entries.any { it.id == entryId }) copy(selectedEntryId = entryId) else this

    fun deleting(entryId: String): NativeHistoryBrowserState {
        val deleted = entries.firstOrNull { it.id == entryId }
        val remaining = entries.filterNot { it.id == entryId }
        val nextSelected = if (selectedEntryId == entryId) fallbackSelection(deleted, remaining) else selectedEntryId
        return NativeHistoryBrowserState(entries = remaining, selectedEntryId = nextSelected)
    }

    private fun fallbackSelection(deleted: HistoryEntry?, remaining: List<HistoryEntry>): String? =
        deleted?.parentId?.takeIf { parentId -> remaining.any { it.id == parentId } } ?: remaining.firstOrNull()?.id

    private fun buildRows(): List<HistoryBrowserRow> {
        val rows = mutableListOf<HistoryBrowserRow>()
        fun append(node: HistoryTreeNode, depth: Int) {
            rows += HistoryBrowserRow(
                entry = node.entry,
                depth = depth,
                branchLabel = if (depth == 0) "Root" else "Edit",
                versionLabel = "v${rows.size + 1}",
                isSelected = node.entry.id == selectedEntryId,
            )
            node.children.forEach { append(it, depth + 1) }
        }
        buildTree().forEach { append(it, 0) }
        return rows
    }

    private fun buildTree(): List<HistoryTreeNode> {
        val grouped = entries.groupBy { it.parentId }
        fun children(parentId: String?): List<HistoryTreeNode> = grouped[parentId].orEmpty()
            .sortedWith(compareBy<HistoryEntry> { it.timestamp }.thenBy { it.id })
            .map { HistoryTreeNode(entry = it, children = children(it.id)) }
        return children(null)
    }

    companion object {
        val FixtureRootWithEditChild = NativeHistoryBrowserState(
            entries = listOf(
                HistoryEntry(
                    id = "hist-root-generation",
                    mode = EditorMode.GENERATE,
                    provider = EditorProvider.OPENAI,
                    prompt = "Root banana sticker on dark canvas",
                    assetId = "asset-root",
                    assetPath = "assets/root-banana.png",
                    parentId = null,
                    createdAt = "1970-01-01T00:00:00.000Z",
                    timestamp = 1.0,
                ),
                HistoryEntry(
                    id = "hist-edit-child",
                    mode = EditorMode.EDIT,
                    provider = EditorProvider.OPENAI,
                    prompt = "Edit child with brighter tape edge",
                    assetId = "asset-child",
                    assetPath = "assets/edit-child.png",
                    parentId = "hist-root-generation",
                    createdAt = "1970-01-01T00:01:00.000Z",
                    timestamp = 2.0,
                ),
            ),
        )
    }
}
