package app.bananatape.mobile.ui

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.net.Uri
import android.util.Base64
import app.bananatape.mobile.adapters.AdapterError
import app.bananatape.mobile.adapters.AdapterResult
import app.bananatape.mobile.adapters.ImageMimeType
import app.bananatape.mobile.adapters.ImportedImageRole
import app.bananatape.mobile.adapters.MobileProjectRecord
import app.bananatape.mobile.adapters.ProjectImageImportRequest
import app.bananatape.mobile.editor.CanvasAnnotations
import app.bananatape.mobile.editor.CanvasImage
import app.bananatape.mobile.editor.ComposerProvider
import app.bananatape.mobile.editor.ComposerReferenceSummary
import app.bananatape.mobile.editor.ComposerState
import app.bananatape.mobile.editor.EditorMode
import app.bananatape.mobile.editor.EditorPoint
import app.bananatape.mobile.editor.EditorProvider
import app.bananatape.mobile.editor.EditorSize
import app.bananatape.mobile.editor.HistoryEntry
import app.bananatape.mobile.editor.ImageGenerationStatus
import app.bananatape.mobile.editor.MobileCanvasDocument
import app.bananatape.mobile.editor.NativeHistoryBrowserState
import app.bananatape.mobile.editor.ProjectHistoryDocument
import app.bananatape.mobile.editor.ProviderImageResult
import app.bananatape.mobile.editor.ProviderPipelineState
import app.bananatape.mobile.storage.LocalProjectStorage
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.nio.file.Files
import java.time.Instant

internal data class LoadedProjectSession(
    val project: ProjectListItem,
    val composerState: ComposerState,
    val pipelineState: ProviderPipelineState,
    val historyState: NativeHistoryBrowserState,
    val annotations: CanvasAnnotations,
)

internal fun loadProjectSession(storage: LocalProjectStorage, record: MobileProjectRecord): LoadedProjectSession {
    val history = runCatching { ProjectHistoryDocument.parse(record.historyJson).entries }.getOrDefault(emptyList())
    val canvas = record.canvasJson?.let { runCatching { MobileCanvasDocument.parse(it) }.getOrNull() }
    val images = canvas?.imageOrder.orEmpty().mapNotNull { canvas?.images?.get(it) }.map { image ->
        image.copy(url = localUrl(storage, record.id, image.url))
    }.ifEmpty {
        history.mapIndexed { index, entry ->
            CanvasImage(
                id = entry.id,
                url = storage.filePath(record.id, entry.assetPath).toUri().toString(),
                assetId = entry.assetId,
                size = EditorSize(1024.0, 1024.0),
                position = EditorPoint(0.0, 0.0),
                parentId = entry.parentId,
                generationIndex = index,
                prompt = entry.prompt,
                provider = entry.provider,
                mode = entry.mode,
                createdAt = entry.timestamp,
                annotations = CanvasAnnotations.Empty,
                hasMagicLayerFields = false,
            )
        }
    }
    val settings = JSONObject(record.manifestJson).optJSONObject("settings") ?: JSONObject()
    val references = settings.optJSONArray("referenceImages").toObjectList().mapNotNull { reference ->
        val id = reference.optString("id")
        val assetPath = reference.optString("assetPath")
        if (id.isBlank() || assetPath.isBlank()) null else ComposerReferenceSummary(id, reference.optString("label", assetPath.substringAfterLast('/')), assetPath)
    }
    val focused = canvas?.focusedImageIds?.firstOrNull() ?: images.lastOrNull()?.id
    val pipeline = ProviderPipelineState(images = images, history = history, focusedImageId = focused)
    return LoadedProjectSession(
        project = ProjectListItem(record.id, record.name),
        composerState = ComposerState(selectedProvider = ComposerProvider.OPENAI, systemPrompt = settings.optString("systemPrompt"), references = references, hasSelectedImage = images.isNotEmpty()),
        pipelineState = pipeline,
        historyState = NativeHistoryBrowserState(history, focused),
        annotations = images.lastOrNull()?.annotations ?: CanvasAnnotations.Empty,
    )
}

internal fun importBaseProjectImage(context: Context, uri: Uri, storage: LocalProjectStorage): AdapterResult<LoadedProjectSession> {
    val mimeType = when (context.contentResolver.getType(uri)) {
        "image/png" -> ImageMimeType.PNG
        "image/jpeg", "image/jpg" -> ImageMimeType.JPEG
        else -> return AdapterResult.Failure(AdapterError.UnsupportedFileType(ImageMimeType.WEBP))
    }
    val timestamp = System.currentTimeMillis()
    val projectId = "imported-image-$timestamp"
    val name = "Imported Image"
    val record = MobileProjectRecord(projectId, name, manifest(projectId, name), MinimalHistoryJson, null)
    if (storage.create(record) is AdapterResult.Failure) return AdapterResult.Failure(AdapterError.CorruptProject(projectId))
    val extension = if (mimeType == ImageMimeType.PNG) "png" else "jpg"
    val source = Files.createTempFile(context.cacheDir.toPath(), projectId, ".$extension")
    return try {
        context.contentResolver.openInputStream(uri)?.use { Files.copy(it, source, java.nio.file.StandardCopyOption.REPLACE_EXISTING) }
            ?: return AdapterResult.Failure(AdapterError.CorruptProject(projectId))
        val assetId = "asset-$timestamp"
        val imported = storage.importProjectImage(ProjectImageImportRequest(projectId, assetId, ImportedImageRole.BASE_IMAGE, mimeType, source.fileName.toString(), source))
        val asset = when (imported) {
            is AdapterResult.Success -> imported.value
            is AdapterResult.Failure -> return imported
        }
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(asset.filePath.toString(), bounds)
        val entry = HistoryEntry("history-$timestamp", EditorMode.GENERATE, EditorProvider.MOCK, "Imported image", assetId, asset.projectRelativePath, null, Instant.now().toString(), timestamp.toDouble())
        val image = CanvasImage(entry.id, asset.filePath.toUri().toString(), assetId, EditorSize(bounds.outWidth.coerceAtLeast(1).toDouble(), bounds.outHeight.coerceAtLeast(1).toDouble()), EditorPoint(0.0, 0.0), null, 0, entry.prompt, entry.provider, entry.mode, entry.timestamp, CanvasAnnotations.Empty, false)
        val session = LoadedProjectSession(ProjectListItem(projectId, name), ComposerState(selectedProvider = ComposerProvider.OPENAI, hasSelectedImage = true), ProviderPipelineState(listOf(image), listOf(entry), image.id), NativeHistoryBrowserState(listOf(entry), entry.id), CanvasAnnotations.Empty)
        persistProjectSession(storage, projectId, session.composerState, session.pipelineState, session.historyState, session.annotations)
        AdapterResult.Success(session)
    } catch (_: Exception) {
        AdapterResult.Failure(AdapterError.CorruptProject(projectId))
    } finally {
        Files.deleteIfExists(source)
    }
}

internal fun persistProviderImage(storage: LocalProjectStorage, projectId: String, result: ProviderImageResult): ProviderImageResult? {
    val bytes = if (result.imageUrl.startsWith("data:image")) {
        Base64.decode(result.imageUrl.substringAfter("base64,"), Base64.DEFAULT)
    } else {
        val bitmap = Bitmap.createBitmap(result.size.width.toInt(), result.size.height.toInt(), Bitmap.Config.ARGB_8888)
        Canvas(bitmap).apply {
            drawColor(Color.rgb(20, 20, 20))
            drawText("BananaTape Mock", 32f, 64f, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE; textSize = 28f })
        }
        ByteArrayOutputStream().use { output -> bitmap.compress(Bitmap.CompressFormat.PNG, 100, output); output.toByteArray() }
    }
    val saved = storage.saveGeneratedImage(projectId, result.assetId, ImageMimeType.PNG, bytes)
    return (saved as? AdapterResult.Success)?.value?.let { asset -> result.copy(imageUrl = asset.filePath.toUri().toString(), assetPath = asset.projectRelativePath) }
}

internal fun persistProjectSession(storage: LocalProjectStorage, projectId: String, composer: ComposerState, pipeline: ProviderPipelineState, historyState: NativeHistoryBrowserState, annotations: CanvasAnnotations) {
    val project = (storage.read(projectId) as? AdapterResult.Success)?.value ?: return
    val manifest = JSONObject(project.manifestJson).apply {
        put("updatedAt", Instant.now().toString())
        put("settings", JSONObject().put("systemPrompt", composer.systemPrompt).put("referenceImages", JSONArray(composer.references.map { JSONObject().put("id", it.id).put("label", it.label).put("assetPath", it.assetPath) })))
    }
    val history = JSONObject().put("schemaVersion", 1).put("revision", historyState.entries.size).put("entries", JSONArray(historyState.entries.map(::historyJson)))
    val ready = pipeline.images.filter { it.status == ImageGenerationStatus.READY && it.assetId != null }
    val records = JSONObject()
    ready.forEach { image -> records.put(image.id, imageJson(image, historyState, if (image.id == ready.lastOrNull()?.id) annotations else image.annotations)) }
    val canvas = JSONObject().put("schemaVersion", 1).put("settings", JSONObject()).put("canvas", JSONObject().put("images", records).put("imageOrder", JSONArray(ready.map { it.id })).put("focusedImageIds", JSONArray(listOfNotNull(pipeline.focusedImageId))))
    storage.updateDocuments(projectId, manifest.toString(2), history.toString(2), canvas.toString(2))
}

private fun historyJson(entry: HistoryEntry): JSONObject = JSONObject()
    .put("id", entry.id).put("type", entry.mode.value).put("provider", entry.provider.value).put("prompt", entry.prompt)
    .put("assetId", entry.assetId).put("assetPath", entry.assetPath).put("parentId", entry.parentId ?: JSONObject.NULL)
    .put("createdAt", entry.createdAt).put("timestamp", entry.timestamp)

private fun imageJson(image: CanvasImage, history: NativeHistoryBrowserState, annotations: CanvasAnnotations): JSONObject = JSONObject()
    .put("id", image.id).put("url", history.entries.firstOrNull { it.assetId == image.assetId }?.assetPath ?: image.url).put("assetId", image.assetId)
    .put("size", JSONObject().put("width", image.size.width).put("height", image.size.height)).put("position", JSONObject().put("x", image.position.x).put("y", image.position.y))
    .put("parentId", image.parentId ?: JSONObject.NULL).put("generationIndex", image.generationIndex).put("prompt", image.prompt).put("provider", image.provider.value).put("type", image.mode.value).put("createdAt", image.createdAt)
    .put("paths", JSONArray(annotations.paths.map { path -> JSONObject().put("id", path.id).put("tool", path.tool.value).put("points", JSONArray(path.points.map { JSONObject().put("x", it.x).put("y", it.y) })).put("color", path.color).put("strokeWidth", path.strokeWidth) }))
    .put("boxes", JSONArray(annotations.boxes.map { JSONObject().put("id", it.id).put("x", it.x).put("y", it.y).put("width", it.width).put("height", it.height).put("color", it.color).put("status", it.status.value) }))
    .put("memos", JSONArray(annotations.memos.map { JSONObject().put("id", it.id).put("x", it.x).put("y", it.y).put("text", it.text).put("color", it.color) }))

private fun localUrl(storage: LocalProjectStorage, projectId: String, url: String): String = if (url.startsWith("data:") || url.startsWith("file:")) url else storage.filePath(projectId, url).toUri().toString()

private fun manifest(id: String, name: String): String = JSONObject().put("schemaVersion", 1).put("id", id).put("name", name).put("createdAt", Instant.now().toString()).put("updatedAt", Instant.now().toString()).put("settings", JSONObject().put("systemPrompt", "").put("referenceImages", JSONArray())).toString(2)

private fun JSONArray?.toObjectList(): List<JSONObject> = if (this == null) emptyList() else (0 until length()).mapNotNull(::optJSONObject)

private const val MinimalHistoryJson = """{"schemaVersion":1,"revision":0,"entries":[]}"""
