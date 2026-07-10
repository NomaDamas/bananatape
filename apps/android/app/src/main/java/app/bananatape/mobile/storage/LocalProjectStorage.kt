package app.bananatape.mobile.storage

import app.bananatape.mobile.adapters.AdapterError
import app.bananatape.mobile.adapters.AdapterResult
import app.bananatape.mobile.adapters.ImageMimeType
import app.bananatape.mobile.adapters.ImportedImageRole
import app.bananatape.mobile.adapters.MobileProjectRecord
import app.bananatape.mobile.adapters.MobileProjectSummary
import app.bananatape.mobile.adapters.ProjectStorage
import app.bananatape.mobile.adapters.ProjectImageAsset
import app.bananatape.mobile.adapters.ProjectImageImportRequest
import java.nio.file.Files
import java.nio.file.Path
import kotlin.io.path.deleteIfExists
import kotlin.io.path.createDirectories
import kotlin.io.path.exists
import kotlin.io.path.isDirectory
import kotlin.io.path.listDirectoryEntries
import kotlin.io.path.readText
import kotlin.io.path.writeText

class LocalProjectStorage(
    private val root: Path,
    private val maxImportedImageBytes: Int = DefaultMaxImportedImageBytes,
) : ProjectStorage {
    private val directoryNames = listOf("assets", "references", "thumbnails", "tmp")

    override fun create(project: MobileProjectRecord): AdapterResult<MobileProjectRecord> {
        if (!project.isValid()) return AdapterResult.Failure(AdapterError.CorruptProject(project.id))
        return runCatching {
            val projectRoot = projectRoot(project.id)
            projectRoot.createDirectories()
            directoryNames.forEach { projectRoot.resolve(it).createDirectories() }
            projectRoot.resolve("project.json").writeText(project.manifestJson)
            projectRoot.resolve("history.json").writeText(project.historyJson)
            project.canvasJson?.let { projectRoot.resolve("canvas.json").writeText(it) }
            AdapterResult.Success(project)
        }.getOrElse { AdapterResult.Failure(AdapterError.CorruptProject(project.id)) }
    }

    override fun read(id: String): AdapterResult<MobileProjectRecord> {
        val projectRoot = projectRoot(id)
        if (!projectRoot.exists()) return AdapterResult.Failure(AdapterError.StorageNotFound(id))
        return runCatching {
            val manifestJson = projectRoot.resolve("project.json").readText()
            val historyJson = projectRoot.resolve("history.json").readText()
            val summary = ProjectJsonValidation.manifestSummary(manifestJson)
            if (summary?.id != id || !ProjectJsonValidation.historyIsValid(historyJson)) {
                AdapterResult.Failure(AdapterError.CorruptProject(id))
            } else {
                val canvasPath = projectRoot.resolve("canvas.json")
                AdapterResult.Success(
                    MobileProjectRecord(
                        id = summary.id,
                        name = summary.name,
                        manifestJson = manifestJson,
                        historyJson = historyJson,
                        canvasJson = if (canvasPath.exists()) canvasPath.readText() else null,
                    ),
                )
            }
        }.getOrElse { AdapterResult.Failure(AdapterError.CorruptProject(id)) }
    }

    override fun list(): List<MobileProjectSummary> {
        if (!root.exists()) return emptyList()
        return root.listDirectoryEntries()
            .filter { it.isDirectory() }
            .mapNotNull { projectPath ->
                when (val read = read(projectPath.fileName.toString())) {
                    is AdapterResult.Success -> MobileProjectSummary(id = read.value.id, name = read.value.name)
                    is AdapterResult.Failure -> null
                }
            }
            .sortedBy { it.name }
    }

    override fun delete(id: String): AdapterResult<Unit> {
        val projectRoot = projectRoot(id)
        if (!projectRoot.exists()) return AdapterResult.Failure(AdapterError.StorageNotFound(id))
        return runCatching {
            Files.walk(projectRoot).use { paths ->
                paths.sorted(Comparator.reverseOrder()).forEach { path -> path.deleteIfExists() }
            }
            AdapterResult.Success(Unit)
        }.getOrElse { AdapterResult.Failure(AdapterError.CorruptProject(id)) }
    }

    override fun rename(id: String, name: String): AdapterResult<MobileProjectRecord> {
        val project = when (val result = read(id)) {
            is AdapterResult.Success -> result.value
            is AdapterResult.Failure -> return result
        }
        return runCatching {
            val manifest = org.json.JSONObject(project.manifestJson)
                .put("name", name)
                .put("updatedAt", java.time.Instant.now().toString())
                .toString(2)
            val updated = project.copy(name = name, manifestJson = manifest)
            when (val result = updateDocuments(id, manifest, project.historyJson, project.canvasJson)) {
                is AdapterResult.Success -> AdapterResult.Success(updated)
                is AdapterResult.Failure -> result
            }
        }.getOrElse { AdapterResult.Failure(AdapterError.CorruptProject(id)) }
    }

    fun importProjectImage(request: ProjectImageImportRequest): AdapterResult<ProjectImageAsset> {
        val projectRoot = projectRoot(request.projectId)
        if (!projectRoot.exists()) return AdapterResult.Failure(AdapterError.StorageNotFound(request.projectId))
        val fileExtension = when (request.mimeType) {
            ImageMimeType.PNG -> "png"
            ImageMimeType.JPEG -> "jpg"
            ImageMimeType.WEBP,
            ImageMimeType.GIF,
            ImageMimeType.HEIC,
            -> return AdapterResult.Failure(AdapterError.UnsupportedFileType(request.mimeType))
        }
        return runCatching {
            val byteCount = Files.size(request.sourcePath).toInt()
            if (byteCount > maxImportedImageBytes) {
                AdapterResult.Failure(AdapterError.OversizedImage(maxBytes = maxImportedImageBytes, actualBytes = byteCount))
            } else {
                val relativePath = "${directoryName(request.role)}/${request.assetId}.$fileExtension"
                val destination = projectRoot.resolve(relativePath)
                destination.deleteIfExists()
                Files.copy(request.sourcePath, destination)
                AdapterResult.Success(
                    ProjectImageAsset(
                        id = request.assetId,
                        role = request.role,
                        mimeType = request.mimeType,
                        byteCount = byteCount,
                        projectRelativePath = relativePath,
                        filePath = destination,
                    ),
                )
            }
        }.getOrElse { AdapterResult.Failure(AdapterError.CorruptProject(request.projectId)) }
    }

    fun saveGeneratedImage(projectId: String, assetId: String, mimeType: ImageMimeType, data: ByteArray): AdapterResult<ProjectImageAsset> {
        val fileExtension = when (mimeType) {
            ImageMimeType.PNG -> "png"
            ImageMimeType.JPEG -> "jpg"
            ImageMimeType.WEBP,
            ImageMimeType.GIF,
            ImageMimeType.HEIC,
            -> return AdapterResult.Failure(AdapterError.UnsupportedFileType(mimeType))
        }
        val projectRoot = projectRoot(projectId)
        if (!projectRoot.exists()) return AdapterResult.Failure(AdapterError.StorageNotFound(projectId))
        return runCatching {
            val relativePath = "assets/$assetId.$fileExtension"
            val destination = projectRoot.resolve(relativePath)
            Files.write(destination, data)
            AdapterResult.Success(ProjectImageAsset(assetId, ImportedImageRole.BASE_IMAGE, mimeType, data.size, relativePath, destination))
        }.getOrElse { AdapterResult.Failure(AdapterError.CorruptProject(projectId)) }
    }

    fun updateDocuments(projectId: String, manifestJson: String, historyJson: String, canvasJson: String?): AdapterResult<Unit> {
        val summary = ProjectJsonValidation.manifestSummary(manifestJson)
        if (summary?.id != projectId || !ProjectJsonValidation.historyIsValid(historyJson) || !projectRoot(projectId).exists()) {
            return AdapterResult.Failure(AdapterError.CorruptProject(projectId))
        }
        return runCatching {
            projectRoot(projectId).resolve("project.json").writeText(manifestJson)
            projectRoot(projectId).resolve("history.json").writeText(historyJson)
            canvasJson?.let { projectRoot(projectId).resolve("canvas.json").writeText(it) }
            AdapterResult.Success(Unit)
        }.getOrElse { AdapterResult.Failure(AdapterError.CorruptProject(projectId)) }
    }

    fun filePath(projectId: String, relativePath: String): Path = projectRoot(projectId).resolve(relativePath)

    private fun projectRoot(id: String): Path = root.resolve(id)

    private fun directoryName(role: ImportedImageRole): String = when (role) {
        ImportedImageRole.BASE_IMAGE -> "assets"
        ImportedImageRole.REFERENCE_IMAGE -> "references"
    }

    private fun MobileProjectRecord.isValid(): Boolean =
        ProjectJsonValidation.manifestSummary(manifestJson) == MobileProjectSummary(id = id, name = name) &&
            ProjectJsonValidation.historyIsValid(historyJson)
}

const val DefaultMaxImportedImageBytes: Int = 12 * 1024 * 1024

fun defaultAndroidProjectStorageRoot(filesDir: java.io.File): Path = filesDir.toPath().resolve("projects")
