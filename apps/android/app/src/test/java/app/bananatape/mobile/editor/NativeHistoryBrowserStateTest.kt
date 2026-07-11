package app.bananatape.mobile.editor

import org.junit.Assert.assertEquals
import org.junit.Test

class NativeHistoryBrowserStateTest {
    @Test
    fun historyBrowser_whenChildSelectedAndDeleted_restoresRootWithExportPreview() {
        val root = HistoryEntry(
            id = "hist-root",
            mode = EditorMode.GENERATE,
            provider = EditorProvider.OPENAI,
            prompt = "Root generation",
            assetId = "asset-root",
            assetPath = "assets/root.png",
            parentId = null,
            createdAt = "1970-01-01T00:00:00.000Z",
            timestamp = 1.0,
        )
        val child = HistoryEntry(
            id = "hist-child",
            mode = EditorMode.EDIT,
            provider = EditorProvider.OPENAI,
            prompt = "Edit child",
            assetId = "asset-child",
            assetPath = "assets/child.png",
            parentId = root.id,
            createdAt = "1970-01-01T00:01:00.000Z",
            timestamp = 2.0,
        )
        val selectedChild = NativeHistoryBrowserState(entries = listOf(root, child)).selecting(child.id)

        val restored = selectedChild.deleting(child.id)

        assertEquals(listOf("Root", "Edit"), selectedChild.rows.map { it.branchLabel })
        assertEquals(child.id, selectedChild.selectedEntry?.id)
        assertEquals(listOf(root.id), restored.entries.map { it.id })
        assertEquals(root.id, restored.selectedEntry?.id)
        assertEquals("assets/root.png", restored.exportPreview?.assetPath)
        assertEquals("1 version", restored.historyCountLabel)
    }

    @Test
    fun historyBrowser_whenBatchesInterleaveByTimestamp_keepsEachBatchContiguous() {
        val entries = listOf(
            entry("batch-a-1", timestamp = 4.0, batchId = "batch-a", batchIndex = 1),
            entry("batch-b-0", timestamp = 2.0, batchId = "batch-b", batchIndex = 0),
            entry("batch-a-0", timestamp = 1.0, batchId = "batch-a", batchIndex = 0),
            entry("batch-b-1", timestamp = 3.0, batchId = "batch-b", batchIndex = 1),
        )

        val rows = NativeHistoryBrowserState(entries).rows

        assertEquals(listOf("batch-a-0", "batch-a-1", "batch-b-0", "batch-b-1"), rows.map { it.id })
    }

    @Test
    fun historyBrowser_whenBatchSiblingsHaveDescendants_keepsSiblingsContiguousBeforeDescendants() {
        val root = entry("root", timestamp = 1.0)
        val siblingA = entry("sibling-a", timestamp = 2.0, parentId = root.id, batchId = "batch-edit", batchIndex = 0)
        val siblingB = entry("sibling-b", timestamp = 3.0, parentId = root.id, batchId = "batch-edit", batchIndex = 1)
        val descendantA = entry("descendant-a", timestamp = 4.0, parentId = siblingA.id)
        val descendantB = entry("descendant-b", timestamp = 5.0, parentId = siblingB.id)

        val rows = NativeHistoryBrowserState(listOf(descendantB, siblingB, root, descendantA, siblingA)).rows

        assertEquals(listOf("root", "sibling-a", "sibling-b", "descendant-a", "descendant-b"), rows.map { it.id })
        assertEquals(listOf(0, 1, 1, 2, 2), rows.map { it.depth })
    }

    @Test
    fun historyBrowser_whenRootDeleted_cascadesDescendantsAndSelectsLastReadyBranch() {
        val otherRoot = entry("other-root", timestamp = 0.0)
        val root = entry("root", timestamp = 1.0)
        val child = entry("child", timestamp = 2.0, parentId = root.id)
        val grandchild = entry("grandchild", timestamp = 3.0, parentId = child.id)
        val state = NativeHistoryBrowserState(listOf(otherRoot, root, child, grandchild), selectedEntryId = grandchild.id)

        val deleted = state.deleting(root.id)

        assertEquals(listOf(otherRoot.id), deleted.entries.map { it.id })
        assertEquals(otherRoot.id, deleted.selectedEntryId)
    }

    private fun entry(
        id: String,
        timestamp: Double,
        parentId: String? = null,
        batchId: String? = null,
        batchIndex: Int? = null,
    ) = HistoryEntry(
        id = id,
        mode = if (parentId == null) EditorMode.GENERATE else EditorMode.EDIT,
        provider = EditorProvider.MOCK,
        prompt = id,
        assetId = "asset-$id",
        assetPath = "assets/$id.png",
        parentId = parentId,
        createdAt = "1970-01-01T00:00:00Z",
        timestamp = timestamp,
        generationBatchId = batchId,
        batchIndex = batchIndex,
    )
}
