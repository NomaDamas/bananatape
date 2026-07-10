package app.bananatape.mobile.editor

data class ComposerReferenceSummary(val id: String, val label: String, val assetPath: String = id)

enum class ComposerProvider(val value: String, val displayName: String) {
    MOCK("mock", "Mocked"),
    OPENAI("openai", "OpenAI"),
}

data class ComposerState(
    val promptText: String = "",
    val selectedProvider: ComposerProvider = ComposerProvider.MOCK,
    val outputSize: OutputSize = OutputSize.SQUARE,
    val systemPrompt: String = "",
    val projectContext: String = "",
    val references: List<ComposerReferenceSummary> = emptyList(),
    val hasSelectedImage: Boolean = false,
    val mode: EditorMode = EditorMode.GENERATE,
) {
    val trimmedPrompt: String = promptText.trim()
    val providerDisplayName: String = selectedProvider.displayName
    val outputSizeLabel: String = outputSize.value
    val referenceStripLabel: String = if (references.isEmpty()) "No references" else "${references.size} reference${if (references.size == 1) "" else "s"}"
    val primaryActionLabel: String = if (mode == EditorMode.EDIT) "Apply edit" else "Generate"
    val canSubmitPrimaryAction: Boolean = when (mode) {
        EditorMode.GENERATE -> trimmedPrompt.isNotEmpty()
        EditorMode.EDIT -> hasSelectedImage && trimmedPrompt.isNotEmpty()
    }

    companion object {
        val AvailableProviders = listOf(ComposerProvider.MOCK, ComposerProvider.OPENAI)
        val AvailableOutputSizes = listOf(OutputSize.SQUARE, OutputSize.PORTRAIT, OutputSize.LANDSCAPE)
        val UnsupportedControls = emptyList<String>()
    }
}
