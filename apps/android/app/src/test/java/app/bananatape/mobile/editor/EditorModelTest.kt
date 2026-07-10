package app.bananatape.mobile.editor

import java.nio.file.Path
import kotlin.io.path.Path
import kotlin.io.path.readText
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class EditorModelTest {
    @Test
    fun history_whenDesktopFixtureLoads_buildsRootChildBranchOrder() {
        val historyJson = fixtureText("desktop-v1-project-with-history", "history.json")

        val document = ProjectHistoryDocument.parse(historyJson)
        val tree = document.buildTree()

        assertEquals(2, document.entries.size)
        assertEquals(listOf("hist_desktop_generate_1"), tree.map { it.entry.id })
        assertEquals(listOf("hist_desktop_edit_1"), tree.first().children.map { it.entry.id })
        assertEquals(historyJson, document.toJsonString())
    }

    @Test
    fun annotations_whenUndoAndRedoApplied_restoresAddRemoveAndUpdateStates() {
        val pen = DrawingPath("path-1", DrawingTool.PEN, listOf(EditorPoint(0.1, 0.2)), "#ffffff", 2.0)
        val box = BoundingBox("box-1", 0.2, 0.3, 0.4, 0.5, "#00ff00", AnnotationStatus.PENDING)
        val arrow = DrawingPath("arrow-1", DrawingTool.ARROW, listOf(EditorPoint(0.0, 0.0), EditorPoint(1.0, 1.0)), "#0d99ff", 3.0)
        val memo = TextMemo("memo-1", 0.6, 0.7, "Move label", "#111111")

        val added = AnnotationHistoryStack().apply(CanvasAnnotations(paths = listOf(pen, arrow), boxes = listOf(box), memos = listOf(memo)))
        val updated = added.apply(CanvasAnnotations(paths = listOf(pen, arrow), boxes = emptyList(), memos = listOf(memo.copy(text = "Move label higher"))))
        val undone = updated.undo()

        assertEquals(listOf(box), undone.current.boxes)
        assertEquals(listOf("Move label"), undone.current.memos.map { it.text })

        val redone = undone.redo()
        assertEquals(emptyList<BoundingBox>(), redone.current.boxes)
        assertEquals(listOf("Move label higher"), redone.current.memos.map { it.text })
    }

    @Test
    fun canvas_whenMagicLayerFixtureLoads_preservesUnknownFieldsAndExposesNoEditing() {
        val canvasJson = fixtureText("desktop-project-with-magic-layer-fields", "canvas.json")

        val document = MobileCanvasDocument.parse(canvasJson)
        val image = requireNotNull(document.images["img-magic-generate-1"])

        assertTrue(image.hasMagicLayerFields)
        assertFalse(image.canEditMagicLayers)
        assertEquals("Magic Layer editing is desktop-only", CanvasImage.MagicLayerEditingMessage)
        assertEquals(listOf("path-magic-note"), image.annotations.paths.map { it.id })
        assertEquals(listOf("box-magic-region"), image.annotations.boxes.map { it.id })
        assertEquals(listOf("memo-magic-desktop-only"), image.annotations.memos.map { it.id })
        assertEquals(canvasJson, document.toJsonString())
        assertTrue(document.toJsonString().contains("\"magicLayers\""))
        assertTrue(document.toJsonString().contains("\"selectedMagicLayerId\": \"layer-banana-foreground\""))
    }

    private fun fixtureText(fixture: String, fileName: String): String {
        val userDir: String = System.getProperty("user.dir") ?: "."
        var directory: Path = Path(userDir).toAbsolutePath()
        while (directory.parent != null) {
            val candidate = directory.resolve("../packages/mobile-contracts/fixtures").normalize().resolve(fixture).resolve(fileName)
            if (candidate.toFile().exists()) return candidate.readText()
            directory = directory.parent
        }
        error("Missing fixture $fixture/$fileName")
    }
}
