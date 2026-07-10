package app.bananatape.mobile.editor

data class MobileCanvasDocument(
    val rawJson: String,
    val images: Map<String, CanvasImage>,
    val imageOrder: List<String>,
    val focusedImageIds: List<String>,
) {
    fun toJsonString(): String = rawJson

    companion object {
        fun parse(json: String): MobileCanvasDocument {
            val root = MobileJson(json).parse().obj()
            val canvas = root.getValue("canvas").obj()
            val records = canvas.getValue("images").obj()
            return MobileCanvasDocument(
                rawJson = json,
                images = records.mapValues { parseImage(it.value.obj()) },
                imageOrder = canvas["imageOrder"].strings(),
                focusedImageIds = canvas["focusedImageIds"].strings(),
            )
        }

        private fun parseImage(record: Map<String, JsonValue>): CanvasImage = CanvasImage(
            id = record.getString("id"),
            url = record.getString("url"),
            assetId = record["assetId"].string(),
            size = EditorSize(width = record.getValue("size").obj().number("width"), height = record.getValue("size").obj().number("height")),
            position = EditorPoint(x = record.getValue("position").obj().number("x"), y = record.getValue("position").obj().number("y")),
            parentId = record["parentId"].string(),
            generationIndex = record.number("generationIndex").toInt(),
            prompt = record.getString("prompt"),
            provider = provider(record.getString("provider")),
            mode = mode(record.getString("type")),
            createdAt = record.number("createdAt"),
            annotations = CanvasAnnotations(paths = record["paths"].paths(), boxes = record["boxes"].boxes(), memos = record["memos"].memos()),
            hasMagicLayerFields = listOf("magicLayers", "magicLayerBaseUrl", "magicLayerStatus", "selectedMagicLayerId").any(record::containsKey),
        )
    }
}

data class ProjectHistoryDocument(
    val rawJson: String,
    val revision: Int,
    val entries: List<HistoryEntry>,
) {
    fun toJsonString(): String = rawJson

    fun buildTree(): List<HistoryTreeNode> {
        val grouped = entries.groupBy { it.parentId }
        fun children(parentId: String?): List<HistoryTreeNode> = grouped[parentId].orEmpty()
            .sortedWith(compareBy<HistoryEntry> { it.timestamp }.thenBy { it.id })
            .map { HistoryTreeNode(entry = it, children = children(it.id)) }
        return children(null)
    }

    companion object {
        fun parse(json: String): ProjectHistoryDocument {
            val root = MobileJson(json).parse().obj()
            val entries = root.getValue("entries").array().map { parseEntry(it.obj()) }
            return ProjectHistoryDocument(rawJson = json, revision = root.number("revision").toInt(), entries = entries)
        }

        private fun parseEntry(record: Map<String, JsonValue>): HistoryEntry = HistoryEntry(
            id = record.getString("id"),
            mode = mode(record.getString("type")),
            provider = provider(record.getString("provider")),
            prompt = record.getString("prompt"),
            assetId = record.getString("assetId"),
            assetPath = record.getString("assetPath"),
            parentId = record["parentId"].string(),
            createdAt = record.getString("createdAt"),
            timestamp = record.number("timestamp"),
        )
    }
}

data class HistoryEntry(
    val id: String,
    val mode: EditorMode,
    val provider: EditorProvider,
    val prompt: String,
    val assetId: String,
    val assetPath: String,
    val parentId: String?,
    val createdAt: String,
    val timestamp: Double,
)

data class HistoryTreeNode(val entry: HistoryEntry, val children: List<HistoryTreeNode>)

private fun mode(value: String): EditorMode = EditorMode.entries.first { it.value == value }
private fun provider(value: String): EditorProvider = EditorProvider.entries.firstOrNull { it.value == value } ?: EditorProvider.OPENAI
private fun Map<String, JsonValue>.getString(key: String): String = getValue(key).stringOrNull().orEmpty()
private fun Map<String, JsonValue>.number(key: String): Double = this[key]?.numberOrZero() ?: 0.0
private fun JsonValue?.string(): String? = this?.stringOrNull()
private fun JsonValue?.strings(): List<String> = (this as? JsonValue.ArrayValue)?.values.orEmpty().mapNotNull { it.stringOrNull() }
private fun JsonValue?.paths(): List<DrawingPath> = (this as? JsonValue.ArrayValue)?.values.orEmpty().mapNotNull { path(it.obj()) }
private fun JsonValue?.boxes(): List<BoundingBox> = (this as? JsonValue.ArrayValue)?.values.orEmpty().mapNotNull { box(it.obj()) }
private fun JsonValue?.memos(): List<TextMemo> = (this as? JsonValue.ArrayValue)?.values.orEmpty().mapNotNull { memo(it.obj()) }

private fun path(record: Map<String, JsonValue>): DrawingPath? {
    val tool = DrawingTool.entries.firstOrNull { it.value == record.getString("tool") } ?: return null
    val points = (record["points"] as? JsonValue.ArrayValue)?.values.orEmpty().map { EditorPoint(x = it.obj().number("x"), y = it.obj().number("y")) }
    return DrawingPath(id = record.getString("id"), tool = tool, points = points, color = record.getString("color"), strokeWidth = record.number("strokeWidth"))
}

private fun box(record: Map<String, JsonValue>): BoundingBox? {
    val id = record.getString("id").takeIf { it.isNotBlank() } ?: return null
    val status = AnnotationStatus.entries.firstOrNull { it.value == record.getString("status") } ?: AnnotationStatus.PENDING
    return BoundingBox(id = id, x = record.number("x"), y = record.number("y"), width = record.number("width"), height = record.number("height"), color = record.getString("color"), status = status)
}

private fun memo(record: Map<String, JsonValue>): TextMemo? {
    val id = record.getString("id").takeIf { it.isNotBlank() } ?: return null
    return TextMemo(id = id, x = record.number("x"), y = record.number("y"), text = record.getString("text"), color = record.getString("color"))
}
