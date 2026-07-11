package app.bananatape.mobile.editor

import app.bananatape.mobile.adapters.AdapterError
import app.bananatape.mobile.adapters.NetworkReachability
import java.nio.file.Path

enum class MockProviderScenario {
    SUCCESS,
    SLOW_SUCCESS,
    PROVIDER_ERROR,
}

enum class AppLifecyclePhase {
    FOREGROUND,
    BACKGROUND,
}

data class ProviderReferenceImage(
    val id: String,
    val assetPath: String,
)

data class ProviderRequest(
    val id: String,
    val prompt: String,
    val provider: EditorProvider,
    val mode: EditorMode,
    val outputSize: OutputSize,
    val parentImageId: String?,
    val parentHistoryId: String?,
    val annotations: CanvasAnnotations,
    val references: List<ProviderReferenceImage>,
    val inputImagePath: Path? = null,
    val maskImagePath: Path? = null,
)

data class ProviderImageResult(
    val requestId: String,
    val imageUrl: String,
    val assetId: String,
    val assetPath: String,
    val size: EditorSize,
    val createdAt: String,
    val timestamp: Double,
)

sealed interface MockProviderResult {
    data class Success(val value: ProviderImageResult) : MockProviderResult
    data class Failure(val message: String) : MockProviderResult
}

data class MockImageProvider(
    val scenario: MockProviderScenario = MockProviderScenario.SUCCESS,
) {
    fun generate(request: ProviderRequest): MockProviderResult = resolve(request)
    fun edit(request: ProviderRequest): MockProviderResult = resolve(request)

    private fun resolve(request: ProviderRequest): MockProviderResult = when (scenario) {
        MockProviderScenario.SUCCESS,
        MockProviderScenario.SLOW_SUCCESS,
        -> {
            val suffix = stableSuffix(request)
            MockProviderResult.Success(
                ProviderImageResult(
                    requestId = request.id,
                    imageUrl = "mock://images/$suffix.png",
                    assetId = "asset-$suffix",
                    assetPath = "assets/$suffix.png",
                    size = EditorSize(width = 1024.0, height = 1024.0),
                    createdAt = "1970-01-01T00:00:00.000Z",
                    timestamp = if (request.mode == EditorMode.GENERATE) 1.0 else 2.0,
                ),
            )
        }
        MockProviderScenario.PROVIDER_ERROR -> MockProviderResult.Failure(ErrorMessage)
    }

    private fun stableSuffix(request: ProviderRequest): String {
        val normalizedPrompt = request.prompt
            .lowercase()
            .split(Regex("[^a-z0-9]+"))
            .filter { it.isNotBlank() }
            .take(6)
            .joinToString("-")
            .ifBlank { "annotation" }
        val mode = if (request.mode == EditorMode.GENERATE) "generate" else "edit"
        return "mock-$mode-$normalizedPrompt"
    }

    companion object {
        const val ErrorMessage = "Mock provider failed. Try again."
    }
}

data class ProviderPipelineState(
    val images: List<CanvasImage> = emptyList(),
    val history: List<HistoryEntry> = emptyList(),
    val focusedImageId: String? = null,
    val activeRequestId: String? = null,
    val activeParentHistoryId: String? = null,
    val activePreviousFocusedImageId: String? = null,
    val userErrorMessage: String? = null,
    val lifecyclePhase: AppLifecyclePhase = AppLifecyclePhase.FOREGROUND,
) {
    val pendingImages: List<CanvasImage> = images.filter { it.status == ImageGenerationStatus.PENDING }
    val readyImages: List<CanvasImage> = images.filter { it.status == ImageGenerationStatus.READY }
    val focusedImage: CanvasImage? = images.firstOrNull { it.id == focusedImageId }
    val focusedAnnotations: CanvasAnnotations = focusedImage?.annotations ?: CanvasAnnotations.Empty
    val focusedHistoryEntry: HistoryEntry? = focusedImage?.let { image -> history.firstOrNull { it.id == image.id || it.assetId == image.assetId } }
    val historyBrowserState: NativeHistoryBrowserState = NativeHistoryBrowserState(entries = history, selectedEntryId = focusedHistoryEntry?.id)
    val focusedLineage: FocusedImageLineage = focusedImageLineage(images, focusedImageId)

    fun startingGenerate(
        prompt: String,
        requestId: String,
        network: NetworkReachability,
        provider: EditorProvider = EditorProvider.MOCK,
    ): ProviderPipelineState {
        if (network == NetworkReachability.OFFLINE) return withError(AdapterError.Offline.userMessage)
        val placeholder = placeholderImage(
            id = pendingImageId(requestId),
            requestId = requestId,
            prompt = prompt,
            provider = provider,
            mode = EditorMode.GENERATE,
            parentId = null,
            generationIndex = images.size,
            generationBatchId = requestId,
            batchIndex = 0,
        )
        return copy(
            images = images + placeholder,
            focusedImageId = this.focusedImageId,
            activeRequestId = requestId,
            activeParentHistoryId = null,
            activePreviousFocusedImageId = focusedReadyImage()?.id,
            userErrorMessage = null,
        )
    }

    fun startingEdit(
        prompt: String,
        annotations: CanvasAnnotations,
        requestId: String,
        network: NetworkReachability,
        provider: EditorProvider = EditorProvider.MOCK,
    ): ProviderPipelineState {
        if (network == NetworkReachability.OFFLINE) return withError(AdapterError.Offline.userMessage)
        val parentImage = focusedReadyImage() ?: return withError("Select an image before editing.")
        val parentHistory = history.lastOrNull { it.id == parentImage.id || it.assetId == parentImage.assetId } ?: return withError("Select an image before editing.")
        val placeholder = placeholderImage(
            id = pendingImageId(requestId),
            requestId = requestId,
            prompt = prompt,
            provider = provider,
            mode = EditorMode.EDIT,
            parentId = parentImage.id,
            generationIndex = images.size,
            annotations = annotations,
            generationBatchId = requestId,
            batchIndex = 0,
        )
        return copy(
            images = images + placeholder,
            focusedImageId = this.focusedImageId,
            activeRequestId = requestId,
            activeParentHistoryId = parentHistory.id,
            activePreviousFocusedImageId = parentImage.id,
            userErrorMessage = null,
        )
    }

    fun applying(result: ProviderImageResult): ProviderPipelineState {
        if (activeRequestId != result.requestId) return this
        val pending = images.firstOrNull { it.id == pendingImageId(result.requestId) && it.status == ImageGenerationStatus.PENDING } ?: return this
        val ready = pending.copy(
            url = result.imageUrl,
            assetId = result.assetId,
            size = result.size,
            status = ImageGenerationStatus.READY,
            userErrorMessage = null,
        )
        val nextHistory = history + HistoryEntry(
            id = ready.id,
            mode = ready.mode,
            provider = ready.provider,
            prompt = ready.prompt,
            assetId = result.assetId,
            assetPath = result.assetPath,
            parentId = if (ready.mode == EditorMode.EDIT) activeParentHistoryId else null,
            createdAt = result.createdAt,
            timestamp = result.timestamp,
            generationBatchId = ready.generationBatchId,
            batchIndex = ready.batchIndex,
        )
        return copy(
            images = images.map { if (it.id == pending.id) ready else it },
            history = nextHistory,
            focusedImageId = ready.id,
            activeRequestId = null,
            activeParentHistoryId = null,
            activePreviousFocusedImageId = null,
            userErrorMessage = null,
        )
    }

    fun failing(requestId: String, message: String): ProviderPipelineState {
        if (activeRequestId != requestId) return this
        val nextImages = images.filterNot { it.id == pendingImageId(requestId) && it.status == ImageGenerationStatus.PENDING }
        return copy(images = nextImages, focusedImageId = restoredFocus(nextImages), activeRequestId = null, activeParentHistoryId = null, activePreviousFocusedImageId = null, userErrorMessage = message)
    }

    fun canceling(requestId: String): ProviderPipelineState {
        if (activeRequestId != requestId) return this
        val nextImages = images.filterNot { it.id == pendingImageId(requestId) && it.status == ImageGenerationStatus.PENDING }
        return copy(images = nextImages, focusedImageId = restoredFocus(nextImages), activeRequestId = null, activeParentHistoryId = null, activePreviousFocusedImageId = null, userErrorMessage = null)
    }

    fun movingToBackground(): ProviderPipelineState {
        val requestId = activeRequestId ?: return copy(lifecyclePhase = AppLifecyclePhase.BACKGROUND)
        return canceling(requestId).copy(lifecyclePhase = AppLifecyclePhase.BACKGROUND)
    }

    fun returningToForeground(network: NetworkReachability): ProviderPipelineState = copy(
        lifecyclePhase = AppLifecyclePhase.FOREGROUND,
        userErrorMessage = if (network == NetworkReachability.OFFLINE) AdapterError.Offline.userMessage else userErrorMessage,
    )

    fun focusing(imageId: String): ProviderPipelineState =
        if (readyImages.any { it.id == imageId }) copy(focusedImageId = imageId) else this

    fun updatingFocusedAnnotations(annotations: CanvasAnnotations): ProviderPipelineState {
        val focused = focusedImageId ?: return this
        return copy(images = images.map { image -> if (image.id == focused) image.copy(annotations = annotations) else image })
    }

    fun deletingHistoryBranch(entryId: String): ProviderPipelineState {
        val nextHistoryState = NativeHistoryBrowserState(history, focusedHistoryEntry?.id).deleting(entryId)
        val remainingIds = nextHistoryState.entries.mapTo(mutableSetOf()) { it.id }
        val remainingAssetIds = nextHistoryState.entries.mapTo(mutableSetOf()) { it.assetId }
        val deletedHistoryIds = history.mapTo(mutableSetOf()) { it.id }.apply { removeAll(remainingIds) }
        val activePendingId = activeRequestId?.let(::pendingImageId)
        val activePending = activePendingId?.let { pendingId -> images.firstOrNull { it.id == pendingId } }
        val activeRequestDeleted = activePendingId == entryId ||
            activeParentHistoryId in deletedHistoryIds ||
            activePending?.parentId in deletedHistoryIds
        val nextImages = images.filter { image ->
            when {
                image.status == ImageGenerationStatus.PENDING -> !activeRequestDeleted || image.id != activePendingId
                else -> image.id in remainingIds || image.assetId in remainingAssetIds
            }
        }
        val selectedImageId = nextHistoryState.selectedEntry?.let { selected ->
            nextImages.firstOrNull { image -> image.id == selected.id || image.assetId == selected.assetId }?.id
        }
        val nextFocus = focusedImageId?.takeIf { focused -> nextImages.any { it.id == focused } }
            ?: selectedImageId
            ?: nextImages.lastOrNull { it.status == ImageGenerationStatus.READY }?.id
        return copy(
            images = nextImages,
            history = nextHistoryState.entries,
            focusedImageId = nextFocus,
            activeRequestId = activeRequestId.takeUnless { activeRequestDeleted },
            activeParentHistoryId = activeParentHistoryId.takeUnless { activeRequestDeleted },
            activePreviousFocusedImageId = activePreviousFocusedImageId.takeUnless { activeRequestDeleted },
        )
    }

    fun movingFocusLeft(): ProviderPipelineState = movingFocus(LineageDirection.LEFT)

    fun movingFocusRight(): ProviderPipelineState = movingFocus(LineageDirection.RIGHT)

    fun movingFocusUp(): ProviderPipelineState = movingFocus(LineageDirection.UP)

    fun movingFocusDown(): ProviderPipelineState = movingFocus(LineageDirection.DOWN)

    fun requestForActivePrompt(
        outputSize: OutputSize = OutputSize.SQUARE,
        references: List<ComposerReferenceSummary> = emptyList(),
        inputImagePath: Path? = null,
        maskImagePath: Path? = null,
    ): ProviderRequest? {
        val requestId = activeRequestId ?: return null
        val pending = images.firstOrNull { it.id == pendingImageId(requestId) } ?: return null
        return ProviderRequest(
            id = requestId,
            prompt = pending.prompt,
            provider = pending.provider,
            mode = pending.mode,
            outputSize = outputSize,
            parentImageId = pending.parentId,
            parentHistoryId = activeParentHistoryId,
            annotations = pending.annotations,
            references = references.map { ProviderReferenceImage(id = it.id, assetPath = it.assetPath) },
            inputImagePath = inputImagePath,
            maskImagePath = maskImagePath,
        )
    }

    private fun focusedReadyImage(): CanvasImage? {
        val focused = focusedImageId ?: return null
        return images.firstOrNull { it.id == focused && it.status == ImageGenerationStatus.READY }
    }

    private fun restoredFocus(nextImages: List<CanvasImage>): String? =
        activePreviousFocusedImageId?.takeIf { previous -> nextImages.any { it.id == previous && it.status == ImageGenerationStatus.READY } }
            ?: nextImages.lastOrNull { it.status == ImageGenerationStatus.READY }?.id

    private fun pendingImageId(requestId: String): String = "pending-$requestId"

    private fun withError(message: String): ProviderPipelineState = copy(userErrorMessage = message)

    private fun placeholderImage(
        id: String,
        requestId: String,
        prompt: String,
        provider: EditorProvider,
        mode: EditorMode,
        parentId: String?,
        generationIndex: Int,
        annotations: CanvasAnnotations = CanvasAnnotations.Empty,
        generationBatchId: String?,
        batchIndex: Int?,
    ): CanvasImage = CanvasImage(
        id = id,
        url = "mock://pending/$requestId",
        assetId = null,
        size = EditorSize(width = 1024.0, height = 1024.0),
        position = EditorPoint(x = 0.0, y = 0.0),
        parentId = parentId,
        generationIndex = generationIndex,
        prompt = prompt,
        provider = provider,
        mode = mode,
        createdAt = generationIndex.toDouble(),
        annotations = annotations,
        hasMagicLayerFields = false,
        status = ImageGenerationStatus.PENDING,
        userErrorMessage = null,
        generationBatchId = generationBatchId,
        batchIndex = batchIndex,
    )

}
