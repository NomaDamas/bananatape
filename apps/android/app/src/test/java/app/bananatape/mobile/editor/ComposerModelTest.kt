package app.bananatape.mobile.editor

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ComposerModelTest {
    @Test
    fun prompt_whenBananaStickerEntered_enablesGenerate() {
        val state = ComposerState(promptText = "banana sticker on transparent background", mode = EditorMode.GENERATE)

        assertEquals("banana sticker on transparent background", state.trimmedPrompt)
        assertEquals("Generate", state.primaryActionLabel)
        assertTrue(state.canSubmitPrimaryAction)
    }

    @Test
    fun provider_whenMockedAndOpenAISelected_displaysExpectedLabels() {
        assertEquals("Mocked", ComposerState(selectedProvider = ComposerProvider.MOCK).providerDisplayName)
        assertEquals("OpenAI", ComposerState(selectedProvider = ComposerProvider.OPENAI).providerDisplayName)
        assertEquals(listOf("Mocked", "OpenAI"), ComposerState.AvailableProviders.map { it.displayName })
    }

    @Test
    fun outputSize_whenSquareSelected_exposes1024Label() {
        val state = ComposerState(outputSize = OutputSize.SQUARE)

        assertEquals("1024x1024", state.outputSizeLabel)
        assertTrue(ComposerState.AvailableOutputSizes.contains(OutputSize.SQUARE))
    }

    @Test
    fun primaryAction_whenEditHasPromptAndSelectedImage_enablesApplyEdit() {
        val state = ComposerState(promptText = "banana sticker on transparent background", hasSelectedImage = true, mode = EditorMode.EDIT)

        assertEquals("Apply edit", state.primaryActionLabel)
        assertTrue(state.canSubmitPrimaryAction)
    }

    @Test
    fun primaryAction_whenPromptEmptyOrEditImageMissing_disablesAction() {
        assertFalse(ComposerState(promptText = "   ", mode = EditorMode.GENERATE).canSubmitPrimaryAction)
        assertFalse(ComposerState(promptText = "banana sticker on transparent background", hasSelectedImage = false, mode = EditorMode.EDIT).canSubmitPrimaryAction)
    }

    @Test
    fun referencesAndProjectContext_whenPresent_summarizesWithoutMagicLayerControls() {
        val state = ComposerState(
            systemPrompt = "Keep a transparent background.",
            projectContext = "Sticker sheet",
            references = listOf(ComposerReferenceSummary(id = "ref-1", label = "banana.png")),
        )

        assertEquals("1 reference", state.referenceStripLabel)
        assertEquals("Keep a transparent background.", state.systemPrompt)
        assertEquals("Sticker sheet", state.projectContext)
        assertFalse(ComposerState.UnsupportedControls.any { it.contains("Magic Layer", ignoreCase = true) })
    }

    @Test
    fun composerLaunch_whenFocusedImageExists_defaultsToEditUntilNewGenerationIsExplicit() {
        val focused = CanvasImage(
            id = "focused",
            url = "file:///focused.png",
            assetId = "asset-focused",
            size = EditorSize(1.0, 1.0),
            position = EditorPoint(0.0, 0.0),
            parentId = null,
            generationIndex = 0,
            prompt = "focused prompt",
            provider = EditorProvider.MOCK,
            mode = EditorMode.GENERATE,
            createdAt = 1.0,
            annotations = CanvasAnnotations.Empty,
            hasMagicLayerFields = false,
        )
        val state = ComposerState(promptText = "edit instructions", mode = EditorMode.GENERATE)

        val opened = state.openingForFocusedImage(focused)
        val newGeneration = opened.startingNewGeneration()

        assertEquals(EditorMode.EDIT, opened.mode)
        assertEquals("edit instructions", opened.promptText)
        assertEquals("Apply edit", opened.primaryActionLabel)
        assertEquals(EditorMode.GENERATE, newGeneration.mode)
        assertEquals("Generate", newGeneration.primaryActionLabel)
    }
}
