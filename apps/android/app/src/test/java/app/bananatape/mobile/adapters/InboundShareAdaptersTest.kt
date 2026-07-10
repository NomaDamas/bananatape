package app.bananatape.mobile.adapters

import app.bananatape.mobile.storage.LocalProjectStorage
import java.nio.file.Files
import kotlin.io.path.exists
import kotlin.io.path.readBytes
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class InboundShareAdaptersTest {
    @Test
    fun inboundShare_whenActiveProjectChoosesReference_copiesIntoProjectReferenceStorage() {
        val root = Files.createTempDirectory("bananatape-inbound")
        val storage = LocalProjectStorage(root)
        val project = createProject(storage)
        val source = fixturePath("desktop-v1-project-with-references", "references/reference-banana.png")
        val model = InboundShareModel(storage::importProjectImage)

        model.receive(listOf(InboundShareItem("image/png", "reference-banana.png", source)), activeProject = project, candidateId = "inbound-reference")
        model.importPending(InboundShareChoice.REFERENCE_IMAGE)

        val asset = (model.status as InboundShareStatus.Imported).asset
        assertEquals(ImportedImageRole.REFERENCE_IMAGE, asset.role)
        assertEquals("references/inbound-reference.png", asset.projectRelativePath)
        assertTrue(asset.filePath.readBytes().contentEquals(source.readBytes()))
    }

    @Test
    fun inboundShare_whenActiveProjectChoosesBase_copiesIntoProjectAssetStorage() {
        val root = Files.createTempDirectory("bananatape-inbound")
        val storage = LocalProjectStorage(root)
        val project = createProject(storage)
        val source = fixturePath("desktop-v1-project-with-references", "references/reference-banana.png")
        val model = InboundShareModel(storage::importProjectImage)

        model.receive(listOf(InboundShareItem("image/jpeg", "base.jpg", source)), activeProject = project, candidateId = "inbound-base")
        model.importPending(InboundShareChoice.BASE_IMAGE)

        val asset = (model.status as InboundShareStatus.Imported).asset
        assertEquals(ImportedImageRole.BASE_IMAGE, asset.role)
        assertEquals("assets/inbound-base.jpg", asset.projectRelativePath)
        assertTrue(asset.filePath.readBytes().contentEquals(source.readBytes()))
    }

    @Test
    fun inboundShare_whenNoProjectIsOpen_requiresProjectBeforeCopying() {
        val root = Files.createTempDirectory("bananatape-inbound")
        val storage = LocalProjectStorage(root)
        val project = createProject(storage)
        val source = fixturePath("desktop-v1-project-with-references", "references/reference-banana.png")
        val model = InboundShareModel(storage::importProjectImage)

        model.receive(listOf(InboundShareItem("image/png", "reference-banana.png", source)), activeProject = null, candidateId = "pending-reference")

        assertEquals("pending-reference", (model.status as InboundShareStatus.NeedsProjectSelection).candidate.id)
        assertFalse(root.resolve(project.id).resolve("references/pending-reference.png").exists())

        model.chooseProject(project)
        model.importPending(InboundShareChoice.REFERENCE_IMAGE)

        assertEquals("references/pending-reference.png", (model.status as InboundShareStatus.Imported).asset.projectRelativePath)
    }

    @Test
    fun inboundShare_whenUnsupportedMimeOrMultipleItems_rejectsWithStableMessages() {
        val storage = LocalProjectStorage(Files.createTempDirectory("bananatape-inbound"))
        val source = fixturePath("desktop-v1-project-with-references", "references/reference-banana.png")
        val model = InboundShareModel(storage::importProjectImage)

        model.receive(listOf(InboundShareItem("application/pdf", "brief.pdf", source)), activeProject = null, candidateId = "pdf")
        assertEquals(InboundShareStatus.Rejected(InboundShareAdapter.UnsupportedMessage), model.status)

        model.receive(listOf(InboundShareItem("image/png", "one.png", source), InboundShareItem("image/png", "two.png", source)), activeProject = null, candidateId = "many")
        assertEquals(InboundShareStatus.Rejected(InboundShareAdapter.MultiImageMessage), model.status)
    }

    private fun createProject(storage: LocalProjectStorage): MobileProjectRecord {
        val project = MobileProjectRecord("mobile-smoke-project", "Mobile Smoke Project", manifestJson, emptyHistoryJson, null)
        return (storage.create(project) as AdapterResult.Success).value
    }

    private val manifestJson = """
        {
          "schemaVersion": 1,
          "id": "mobile-smoke-project",
          "name": "Mobile Smoke Project",
          "createdAt": "2026-07-03T00:00:00.000Z",
          "updatedAt": "2026-07-03T00:00:00.000Z",
          "settings": { "systemPrompt": "", "referenceImages": [] }
        }
    """.trimIndent()

    private val emptyHistoryJson = """{ "schemaVersion": 1, "revision": 0, "entries": [] }"""

    private fun fixturePath(fixture: String, fileName: String): java.nio.file.Path {
        val userDir: String = System.getProperty("user.dir") ?: "."
        var directory = java.nio.file.Path.of(userDir).toAbsolutePath()
        while (directory.parent != null) {
            val candidate = directory.resolve("../packages/mobile-contracts/fixtures").normalize().resolve(fixture).resolve(fileName)
            if (candidate.toFile().exists()) return candidate
            directory = directory.parent
        }
        error("Missing fixture $fileName")
    }
}
