package app.bananatape.mobile.storage

import app.bananatape.mobile.adapters.AdapterError
import app.bananatape.mobile.adapters.AdapterResult
import app.bananatape.mobile.adapters.ImageMimeType
import app.bananatape.mobile.adapters.ImportedImageRole
import app.bananatape.mobile.adapters.MobileProjectRecord
import app.bananatape.mobile.adapters.MobileProjectSummary
import app.bananatape.mobile.adapters.ProjectImageImportRequest
import java.nio.file.Files
import kotlin.io.path.createDirectory
import kotlin.io.path.exists
import kotlin.io.path.readBytes
import kotlin.io.path.readText
import kotlin.io.path.writeText
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LocalProjectStorageTest {
    private val manifestJson = """
        {
          "schemaVersion": 1,
          "id": "mobile-smoke-project",
          "name": "Mobile Smoke Project",
          "createdAt": "2026-07-03T00:00:00.000Z",
          "updatedAt": "2026-07-03T00:00:00.000Z",
          "settings": {
            "systemPrompt": "Keep the banana bright and readable.",
            "referenceImages": []
          }
        }
    """.trimIndent()

    private val historyJson = """
        {
          "schemaVersion": 1,
          "revision": 1,
          "entries": [
            {
              "id": "hist_mobile_smoke_1",
              "type": "generate",
              "provider": "openai",
              "prompt": "A tiny banana sticker on transparent paper.",
              "assetId": "img_mobile_smoke_1",
              "assetPath": "assets/img_mobile_smoke_1.png",
              "thumbnailPath": null,
              "parentId": null,
              "createdAt": "2026-07-03T00:00:01.000Z",
              "timestamp": 1783036801000
            }
          ]
        }
    """.trimIndent()

    private val emptyHistoryJson = """
        {
          "schemaVersion": 1,
          "revision": 0,
          "entries": []
        }
    """.trimIndent()

    @Test
    fun storage_whenProjectIsCreated_readsListsRestartsAndDeletesProject() {
        val root = Files.createTempDirectory("bananatape-storage")
        val storage = LocalProjectStorage(root)
        val project = MobileProjectRecord("mobile-smoke-project", "Mobile Smoke Project", manifestJson, emptyHistoryJson, null)

        val created = storage.create(project)
        val listedBeforeRestart = storage.list()
        val readBeforeRestart = storage.read(project.id)
        val restartedStorage = LocalProjectStorage(root)
        val listedAfterRestart = restartedStorage.list()
        val readAfterRestart = restartedStorage.read(project.id)
        val deletion = restartedStorage.delete(project.id)

        assertEquals(AdapterResult.Success(project), created)
        assertEquals(listOf(MobileProjectSummary("mobile-smoke-project", "Mobile Smoke Project")), listedBeforeRestart)
        assertEquals(AdapterResult.Success(project), readBeforeRestart)
        assertTrue((readAfterRestart as AdapterResult.Success).value.historyJson.contains("\"entries\": []"))
        assertEquals(listOf(MobileProjectSummary("mobile-smoke-project", "Mobile Smoke Project")), listedAfterRestart)
        assertEquals(AdapterResult.Success(Unit), deletion)
        assertEquals(AdapterResult.Failure(AdapterError.StorageNotFound(project.id)), restartedStorage.read(project.id))
        assertFalse(root.resolve(project.id).exists())
    }

    @Test
    fun storage_whenSmokeFixtureIsCreated_preservesManifestAndHistoryBytes() {
        val storage = LocalProjectStorage(Files.createTempDirectory("bananatape-storage"))
        val project = MobileProjectRecord("mobile-smoke-project", "Mobile Smoke Project", manifestJson, historyJson, null)

        storage.create(project)
        val read = storage.read(project.id)

        assertEquals(AdapterResult.Success(project), read)
        assertTrue((read as AdapterResult.Success).value.historyJson.contains("hist_mobile_smoke_1"))
    }

    @Test
    fun import_whenReferenceBananaIsSelected_copiesIntoProjectOwnedReferenceStorage() {
        val root = Files.createTempDirectory("bananatape-storage")
        val storage = LocalProjectStorage(root)
        val project = MobileProjectRecord("mobile-smoke-project", "Mobile Smoke Project", manifestJson, emptyHistoryJson, null)
        storage.create(project)
        val source = fixturePath("desktop-v1-project-with-references", "references/reference-banana.png")

        val imported = storage.importProjectImage(
            ProjectImageImportRequest(
                projectId = project.id,
                assetId = "reference-banana",
                role = ImportedImageRole.REFERENCE_IMAGE,
                mimeType = ImageMimeType.PNG,
                originalFileName = "reference-banana.png",
                sourcePath = source,
            ),
        )
        val restartedStorage = LocalProjectStorage(root)
        val reloadedProject = restartedStorage.read(project.id)

        val asset = (imported as AdapterResult.Success).value
        assertEquals("references/reference-banana.png", asset.projectRelativePath)
        assertEquals(68, asset.byteCount)
        assertTrue(asset.filePath.exists())
        assertTrue(asset.filePath.readBytes().contentEquals(source.readBytes()))
        assertFalse(asset.projectRelativePath.contains(source.toString()))
        assertEquals(AdapterResult.Success(project), reloadedProject)
        assertTrue(root.resolve(project.id).resolve(asset.projectRelativePath).exists())
    }

    @Test
    fun import_whenBaseBananaIsSelected_copiesIntoProjectOwnedAssetStorage() {
        val root = Files.createTempDirectory("bananatape-storage")
        val storage = LocalProjectStorage(root)
        val project = MobileProjectRecord("mobile-smoke-project", "Mobile Smoke Project", manifestJson, emptyHistoryJson, null)
        storage.create(project)
        val source = fixturePath("desktop-v1-project-with-references", "references/reference-banana.png")

        val imported = storage.importProjectImage(
            ProjectImageImportRequest(
                projectId = project.id,
                assetId = "base-banana",
                role = ImportedImageRole.BASE_IMAGE,
                mimeType = ImageMimeType.PNG,
                originalFileName = "reference-banana.png",
                sourcePath = source,
            ),
        )

        assertEquals("assets/base-banana.png", (imported as AdapterResult.Success).value.projectRelativePath)
        assertTrue(root.resolve(project.id).resolve("assets/base-banana.png").exists())
    }

    @Test
    fun import_whenGifOrHeicIsSelected_returnsUnsupportedTypeWithoutCopying() {
        val root = Files.createTempDirectory("bananatape-storage")
        val storage = LocalProjectStorage(root)
        val project = MobileProjectRecord("mobile-smoke-project", "Mobile Smoke Project", manifestJson, emptyHistoryJson, null)
        storage.create(project)
        val source = fixturePath("desktop-v1-project-with-references", "references/reference-banana.png")

        val gifResult = storage.importProjectImage(ProjectImageImportRequest(project.id, "bad-gif", ImportedImageRole.REFERENCE_IMAGE, ImageMimeType.GIF, "bad.gif", source))
        val heicResult = storage.importProjectImage(ProjectImageImportRequest(project.id, "bad-heic", ImportedImageRole.REFERENCE_IMAGE, ImageMimeType.HEIC, "bad.heic", source))

        assertEquals(AdapterResult.Failure(AdapterError.UnsupportedFileType(ImageMimeType.GIF)), gifResult)
        assertEquals(AdapterResult.Failure(AdapterError.UnsupportedFileType(ImageMimeType.HEIC)), heicResult)
        assertFalse(root.resolve(project.id).resolve("references/bad-gif.png").exists())
        assertFalse(root.resolve(project.id).resolve("references/bad-heic.png").exists())
    }

    @Test
    fun import_whenFixtureExceedsBytePolicy_returnsOversizedWithoutCopying() {
        val root = Files.createTempDirectory("bananatape-storage")
        val storage = LocalProjectStorage(root, maxImportedImageBytes = 128)
        val project = MobileProjectRecord("mobile-smoke-project", "Mobile Smoke Project", manifestJson, emptyHistoryJson, null)
        storage.create(project)
        val source = fixturePath(null, "large-banana-source.jpg")

        val result = storage.importProjectImage(
            ProjectImageImportRequest(
                projectId = project.id,
                assetId = "large-banana-source",
                role = ImportedImageRole.REFERENCE_IMAGE,
                mimeType = ImageMimeType.JPEG,
                originalFileName = "large-banana-source.jpg",
                sourcePath = source,
            ),
        )

        assertEquals(AdapterResult.Failure(AdapterError.OversizedImage(maxBytes = 128, actualBytes = 635)), result)
        assertFalse(root.resolve(project.id).resolve("references/large-banana-source.jpg").exists())
    }

    @Test
    fun storage_whenHistoryIsMissing_returnsCorruptProjectWithoutCrashing() {
        val root = Files.createTempDirectory("bananatape-storage")
        val projectRoot = root.resolve("corrupt-project-missing-history")
        projectRoot.createDirectory()
        projectRoot.resolve("project.json").writeText(manifestJson)
        val storage = LocalProjectStorage(root)

        val read = storage.read("corrupt-project-missing-history")

        assertEquals(AdapterResult.Failure(AdapterError.CorruptProject("corrupt-project-missing-history")), read)
        assertEquals(emptyList<MobileProjectSummary>(), storage.list())
    }

    @Test
    fun storage_whenJsonIsInvalid_returnsCorruptProjectWithoutCrashing() {
        val root = Files.createTempDirectory("bananatape-storage")
        val projectRoot = root.resolve("broken-json")
        projectRoot.createDirectory()
        projectRoot.resolve("project.json").writeText("{ invalid")
        projectRoot.resolve("history.json").writeText(emptyHistoryJson)
        val storage = LocalProjectStorage(root)

        val read = storage.read("broken-json")

        assertEquals(AdapterResult.Failure(AdapterError.CorruptProject("broken-json")), read)
    }

    @Test
    fun storage_whenGeneratedImageAndDocumentsAreSaved_survivesRestart() {
        val root = Files.createTempDirectory("bananatape-storage")
        val storage = LocalProjectStorage(root)
        val project = MobileProjectRecord("mobile-smoke-project", "Mobile Smoke Project", manifestJson, emptyHistoryJson, null)
        storage.create(project)
        val imageData = fixturePath(null, "reference-banana.png").readBytes()
        val updatedCanvas = """{"schemaVersion":1,"settings":{},"canvas":{"images":{},"imageOrder":[],"focusedImageIds":[]}}"""

        val asset = storage.saveGeneratedImage(project.id, "generated-banana", ImageMimeType.PNG, imageData)
        val update = storage.updateDocuments(project.id, manifestJson, historyJson, updatedCanvas)
        val restarted = LocalProjectStorage(root).read(project.id)

        val savedAsset = (asset as AdapterResult.Success).value
        assertEquals("assets/generated-banana.png", savedAsset.projectRelativePath)
        assertTrue(savedAsset.filePath.readBytes().contentEquals(imageData))
        assertEquals(AdapterResult.Success(Unit), update)
        assertEquals(historyJson, (restarted as AdapterResult.Success).value.historyJson)
        assertEquals(updatedCanvas, restarted.value.canvasJson)
    }

    @Test
    fun storage_whenProjectIsCreated_createsFutureSafeDirectories() {
        val root = Files.createTempDirectory("bananatape-storage")
        val storage = LocalProjectStorage(root)
        val project = MobileProjectRecord("mobile-smoke-project", "Mobile Smoke Project", manifestJson, emptyHistoryJson, null)

        storage.create(project)

        assertEquals(manifestJson, root.resolve(project.id).resolve("project.json").readText())
        assertTrue(root.resolve(project.id).resolve("assets").exists())
        assertTrue(root.resolve(project.id).resolve("references").exists())
        assertTrue(root.resolve(project.id).resolve("thumbnails").exists())
        assertTrue(root.resolve(project.id).resolve("tmp").exists())
    }

    private fun fixturePath(fixture: String?, fileName: String): java.nio.file.Path {
        val userDir: String = System.getProperty("user.dir") ?: "."
        var directory = java.nio.file.Path.of(userDir).toAbsolutePath()
        while (directory.parent != null) {
            var candidate = directory.resolve("../packages/mobile-contracts/fixtures").normalize()
            if (fixture != null) candidate = candidate.resolve(fixture)
            candidate = candidate.resolve(fileName)
            if (candidate.toFile().exists()) return candidate
            directory = directory.parent
        }
        error("Missing fixture $fileName")
    }
}
