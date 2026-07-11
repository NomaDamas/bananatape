package app.bananatape.mobile.editor

internal data class ProviderRequestCompletionOutcome(
    val state: ProviderPipelineState,
    val accepted: Boolean,
)

internal class ProviderRequestCompletion(
    private val currentState: () -> ProviderPipelineState,
    private val updateState: (ProviderPipelineState) -> Unit,
) {
    fun succeed(
        result: ProviderImageResult,
        persist: (ProviderImageResult) -> ProviderImageResult?,
        onApplied: (ProviderPipelineState) -> Unit = {},
    ): ProviderRequestCompletionOutcome {
        val latest = currentState()
        if (!latest.accepts(result.requestId)) return ProviderRequestCompletionOutcome(latest, accepted = false)
        val persisted = persist(result)
            ?: return latest.failing(result.requestId, "This project could not be opened.")
                .also(updateState)
                .let { ProviderRequestCompletionOutcome(it, accepted = true) }
        val next = latest.applying(persisted).also(updateState).also(onApplied)
        return ProviderRequestCompletionOutcome(next, accepted = true)
    }

    fun fail(requestId: String, message: String): ProviderRequestCompletionOutcome {
        val latest = currentState()
        if (!latest.accepts(requestId)) return ProviderRequestCompletionOutcome(latest, accepted = false)
        val next = latest.failing(requestId, message).also(updateState)
        return ProviderRequestCompletionOutcome(next, accepted = true)
    }
}

private fun ProviderPipelineState.accepts(requestId: String): Boolean =
    activeRequestId == requestId && pendingImages.any { it.id == "pending-$requestId" }
