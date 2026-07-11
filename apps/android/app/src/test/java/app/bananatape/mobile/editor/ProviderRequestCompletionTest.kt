package app.bananatape.mobile.editor

import app.bananatape.mobile.adapters.NetworkReachability
import org.junit.Assert.assertEquals
import org.junit.Test

class ProviderRequestCompletionTest {
    @Test
    fun completion_whenStateChangesAfterSubmission_appliesAgainstLatestStateAndSkipsPersistence() {
        val root = image("root", null)
        val child = image("child", root.id)
        var latest = ProviderPipelineState(
            images = listOf(root, child),
            history = listOf(history(root), history(child)),
            focusedImageId = child.id,
        ).startingEdit("late edit", CanvasAnnotations.Empty, "late-request", NetworkReachability.ONLINE)
        val request = requireNotNull(latest.requestForActivePrompt())
        val result = (MockImageProvider().edit(request) as MockProviderResult.Success).value
        var persistedCount = 0
        val completion = ProviderRequestCompletion(currentState = { latest }, updateState = { latest = it })

        latest = latest.deletingHistoryBranch(child.id)
        val success = completion.succeed(
            result = result,
            persist = {
                persistedCount += 1
                it
            },
        )
        val failure = completion.fail(request.id, "late failure")

        assertEquals(0, persistedCount)
        assertEquals(false, success.accepted)
        assertEquals(false, failure.accepted)
        assertEquals(listOf(root.id), latest.images.map { it.id })
        assertEquals(null, latest.userErrorMessage)
    }

    private fun image(id: String, parentId: String?) = CanvasImage(
        id, "file:///$id.png", "asset-$id", EditorSize(1.0, 1.0), EditorPoint(0.0, 0.0), parentId,
        0, id, EditorProvider.MOCK, if (parentId == null) EditorMode.GENERATE else EditorMode.EDIT, 1.0,
        CanvasAnnotations.Empty, false,
    )

    private fun history(image: CanvasImage) = HistoryEntry(
        image.id, image.mode, image.provider, image.prompt, requireNotNull(image.assetId), "assets/${image.id}.png",
        image.parentId, "1970-01-01T00:00:00Z", image.createdAt,
    )
}
