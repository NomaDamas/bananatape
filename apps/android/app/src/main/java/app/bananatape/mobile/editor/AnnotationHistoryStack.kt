package app.bananatape.mobile.editor

data class AnnotationHistoryStack(
    val current: CanvasAnnotations = CanvasAnnotations.Empty,
    private val past: List<CanvasAnnotations> = emptyList(),
    private val future: List<CanvasAnnotations> = emptyList(),
) {
    val canUndo: Boolean = past.isNotEmpty()
    val canRedo: Boolean = future.isNotEmpty()

    fun apply(next: CanvasAnnotations): AnnotationHistoryStack =
        if (next == current) this else AnnotationHistoryStack(current = next, past = past + current, future = emptyList())

    fun undo(): AnnotationHistoryStack {
        val previous = past.lastOrNull() ?: return this
        return AnnotationHistoryStack(current = previous, past = past.dropLast(1), future = future + current)
    }

    fun redo(): AnnotationHistoryStack {
        val next = future.lastOrNull() ?: return this
        return AnnotationHistoryStack(current = next, past = past + current, future = future.dropLast(1))
    }
}
