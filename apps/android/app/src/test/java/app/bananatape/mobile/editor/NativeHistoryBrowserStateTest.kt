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
}
