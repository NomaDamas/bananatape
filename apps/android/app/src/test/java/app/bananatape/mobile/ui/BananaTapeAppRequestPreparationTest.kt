package app.bananatape.mobile.ui

import app.bananatape.mobile.adapters.NetworkReachability
import app.bananatape.mobile.editor.CanvasAnnotations
import app.bananatape.mobile.editor.CanvasImage
import app.bananatape.mobile.editor.EditorMode
import app.bananatape.mobile.editor.EditorPoint
import app.bananatape.mobile.editor.EditorProvider
import app.bananatape.mobile.editor.EditorSize
import app.bananatape.mobile.editor.HistoryEntry
import app.bananatape.mobile.editor.ImageGenerationStatus
import app.bananatape.mobile.editor.NativeImageCompositionError
import app.bananatape.mobile.editor.NativeImageCompositionOutcome
import app.bananatape.mobile.editor.OutputSize
import app.bananatape.mobile.editor.ProviderPipelineState
import java.nio.file.Path
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BananaTapeAppRequestPreparationTest {
    @Test
    fun prepareEditAssets_whenAssetPathCannotBeResolved_leavesPipelineWithoutPendingState() {
        val state = readyState()

        val result = prepareEditRequestAssets(
            pipelineState = state,
            annotations = CanvasAnnotations.Empty,
            outputDirectory = Path.of("tmp/edit-missing-path"),
            resolveSourcePath = { null },
            compose = { error("composition must not run without a source path") },
        )

        val failure = result as EditRequestAssetPreparation.Failure
        assertEquals("This image could not be prepared for export.", failure.message)
        assertEquals(state, failure.pipelineState)
        assertTrue(failure.pipelineState.pendingImages.isEmpty())
        assertNull(failure.pipelineState.activeRequestId)
    }

    @Test
    fun prepareEditAssets_whenSourceDecodeFails_leavesPipelineWithoutPendingState() {
        val state = readyState()

        val result = prepareEditRequestAssets(
            pipelineState = state,
            annotations = CanvasAnnotations.Empty,
            outputDirectory = Path.of("tmp/edit-decode-failure"),
            resolveSourcePath = { Path.of("assets/root.png") },
            compose = { NativeImageCompositionOutcome.Failure(NativeImageCompositionError.UnreadableSource) },
        )

        val failure = result as EditRequestAssetPreparation.Failure
        assertEquals("This image could not be prepared for export.", failure.message)
        assertEquals(state, failure.pipelineState)
        assertTrue(failure.pipelineState.pendingImages.isEmpty())
        assertNull(failure.pipelineState.activeRequestId)
    }

    @Test
    fun prepareEditAssets_whenAnnotationCompositionFails_leavesPipelineWithoutPendingState() {
        val state = readyState()

        val result = prepareEditRequestAssets(
            pipelineState = state,
            annotations = CanvasAnnotations.Empty,
            outputDirectory = Path.of("tmp/edit-render-failure"),
            resolveSourcePath = { Path.of("assets/root.png") },
            compose = { NativeImageCompositionOutcome.Failure(NativeImageCompositionError.RenderFailed) },
        )

        val failure = result as EditRequestAssetPreparation.Failure
        assertEquals("This image could not be prepared for export.", failure.message)
        assertEquals(state, failure.pipelineState)
        assertTrue(failure.pipelineState.pendingImages.isEmpty())
        assertNull(failure.pipelineState.activeRequestId)
    }

    @Test
    fun prepareProviderRequest_whenRequestCannotBeConstructed_rollsBackPendingState() {
        val root = readyImage()
        val stateWithoutHistory = ProviderPipelineState(images = listOf(root), focusedImageId = root.id)

        val result = prepareProviderRequest(
            pipelineState = stateWithoutHistory,
            prompt = "edit root",
            annotations = CanvasAnnotations.Empty,
            requestId = "edit-request-failure",
            provider = EditorProvider.MOCK,
            isEdit = true,
            outputSize = OutputSize.SQUARE,
            references = emptyList(),
            editAssets = EditRequestAssetPreparation.Ready(
                pipelineState = stateWithoutHistory,
                inputImagePath = Path.of("assets/root.png"),
                maskImagePath = Path.of("tmp/edit-request-failure/mask.png"),
            ),
        )

        val failure = result as ProviderRequestPreparation.Failure
        assertEquals("Select an image before editing.", failure.message)
        assertTrue(failure.pipelineState.pendingImages.isEmpty())
        assertNull(failure.pipelineState.activeRequestId)
        assertEquals(root.id, failure.pipelineState.focusedImageId)
    }

    private fun readyState(): ProviderPipelineState {
        val image = readyImage()
        return ProviderPipelineState(
            images = listOf(image),
            history = listOf(
                HistoryEntry(
                    id = image.id,
                    mode = image.mode,
                    provider = image.provider,
                    prompt = image.prompt,
                    assetId = requireNotNull(image.assetId),
                    assetPath = "assets/root.png",
                    parentId = null,
                    createdAt = "1970-01-01T00:00:00Z",
                    timestamp = image.createdAt,
                ),
            ),
            focusedImageId = image.id,
        )
    }

    private fun readyImage() = CanvasImage(
        id = "root",
        url = "file:///assets/root.png",
        assetId = "asset-root",
        size = EditorSize(1.0, 1.0),
        position = EditorPoint(0.0, 0.0),
        parentId = null,
        generationIndex = 0,
        prompt = "root",
        provider = EditorProvider.MOCK,
        mode = EditorMode.GENERATE,
        createdAt = 1.0,
        annotations = CanvasAnnotations.Empty,
        hasMagicLayerFields = false,
        status = ImageGenerationStatus.READY,
    )
}
