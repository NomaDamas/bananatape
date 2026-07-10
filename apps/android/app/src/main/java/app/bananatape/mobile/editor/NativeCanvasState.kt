package app.bananatape.mobile.editor

enum class CanvasTool(val value: String) {
    PAN("pan"),
    PEN("pen"),
    BOX("box"),
    ARROW("arrow"),
    MEMO("memo"),
    SELECT("select"),
}

data class CanvasViewport(
    val pan: EditorPoint = EditorPoint(0.0, 0.0),
    val zoom: Double = 1.0,
)

data class NativeCanvasState(
    val image: CanvasImage,
    val tool: CanvasTool = CanvasTool.PAN,
    val viewport: CanvasViewport = CanvasViewport(),
    val focusedAnnotationId: String? = null,
    val annotations: CanvasAnnotations = image.annotations,
) {
    val serializedAnnotationCounts: Map<String, Int> = mapOf(
        "paths" to annotations.paths.size,
        "boxes" to annotations.boxes.size,
        "memos" to annotations.memos.size,
    )

    fun selecting(annotationId: String?): NativeCanvasState = copy(tool = CanvasTool.SELECT, focusedAnnotationId = annotationId)

    fun panningBy(delta: EditorPoint): NativeCanvasState = copy(
        viewport = viewport.copy(pan = EditorPoint(viewport.pan.x + delta.x, viewport.pan.y + delta.y)),
    )

    fun zoomingTo(zoom: Double): NativeCanvasState = copy(viewport = viewport.copy(zoom = zoom))

    fun adding(path: DrawingPath): NativeCanvasState = copy(
        focusedAnnotationId = path.id,
        annotations = annotations.copy(paths = annotations.paths + path),
    )

    fun adding(box: BoundingBox): NativeCanvasState = copy(
        focusedAnnotationId = box.id,
        annotations = annotations.copy(boxes = annotations.boxes + box),
    )

    fun adding(memo: TextMemo): NativeCanvasState = copy(
        focusedAnnotationId = memo.id,
        annotations = annotations.copy(memos = annotations.memos + memo),
    )

    companion object {
        val EmptyImage = CanvasImage(
            id = "empty-canvas",
            url = "",
            assetId = null,
            size = EditorSize(width = 320.0, height = 320.0),
            position = EditorPoint(x = 0.0, y = 0.0),
            parentId = null,
            generationIndex = 0,
            prompt = "",
            provider = EditorProvider.MOCK,
            mode = EditorMode.GENERATE,
            createdAt = 0.0,
            annotations = CanvasAnnotations.Empty,
            hasMagicLayerFields = false,
        )

        val FixtureImage = CanvasImage(
            id = "fixture-image",
            url = "fixture://banana.png",
            assetId = "asset-fixture",
            size = EditorSize(width = 320.0, height = 240.0),
            position = EditorPoint(x = 0.0, y = 0.0),
            parentId = null,
            generationIndex = 0,
            prompt = "Fixture banana image",
            provider = EditorProvider.OPENAI,
            mode = EditorMode.GENERATE,
            createdAt = 0.0,
            annotations = CanvasAnnotations.Empty,
            hasMagicLayerFields = false,
        )
    }
}
