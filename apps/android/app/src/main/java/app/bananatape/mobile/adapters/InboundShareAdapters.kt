package app.bananatape.mobile.adapters

import android.content.Intent
import android.net.Uri
import java.nio.file.Path

data class InboundShareItem(
    val mimeType: String,
    val originalFileName: String,
    val sourcePath: Path,
)

data class InboundImageCandidate(
    val id: String,
    val mimeType: ImageMimeType,
    val originalFileName: String,
    val sourcePath: Path,
)

sealed interface InboundShareStatus {
    data object Idle : InboundShareStatus
    data class NeedsProjectSelection(val candidate: InboundImageCandidate) : InboundShareStatus
    data class NeedsImportRole(val project: MobileProjectRecord, val candidate: InboundImageCandidate) : InboundShareStatus
    data class Imported(val asset: ProjectImageAsset) : InboundShareStatus
    data class Rejected(val message: String) : InboundShareStatus
}

enum class InboundShareChoice(val importRole: ImportedImageRole) {
    BASE_IMAGE(ImportedImageRole.BASE_IMAGE),
    REFERENCE_IMAGE(ImportedImageRole.REFERENCE_IMAGE),
}

class InboundShareAdapter {
    fun candidate(items: List<InboundShareItem>, id: String): Result<InboundImageCandidate> {
        if (items.size != 1) return Result.failure(InboundShareRejected(MultiImageMessage))
        val item = items.single()
        val mimeType = when (item.mimeType) {
            ImageMimeType.PNG.value -> ImageMimeType.PNG
            ImageMimeType.JPEG.value -> ImageMimeType.JPEG
            else -> return Result.failure(InboundShareRejected(UnsupportedMessage))
        }
        return Result.success(InboundImageCandidate(id = id, mimeType = mimeType, originalFileName = item.originalFileName, sourcePath = item.sourcePath))
    }

    companion object {
        const val UnsupportedMessage = "Use a PNG or JPEG image."
        const val MultiImageMessage = "Share one PNG or JPEG image at a time."
        const val ChooseProjectMessage = "Choose or create a project before importing this image."
        const val ChooseRoleMessage = "Choose whether to add this image as a base image or a reference."
    }
}

class InboundShareRejected(val userMessage: String) : IllegalArgumentException(userMessage)

class InboundShareModel(
    private val importer: (ProjectImageImportRequest) -> AdapterResult<ProjectImageAsset>,
    private val adapter: InboundShareAdapter = InboundShareAdapter(),
) {
    var status: InboundShareStatus = InboundShareStatus.Idle
        private set

    fun receive(items: List<InboundShareItem>, activeProject: MobileProjectRecord?, candidateId: String) {
        status = adapter.candidate(items, candidateId).fold(
            onSuccess = { candidate ->
                if (activeProject == null) {
                    InboundShareStatus.NeedsProjectSelection(candidate)
                } else {
                    InboundShareStatus.NeedsImportRole(project = activeProject, candidate = candidate)
                }
            },
            onFailure = { error -> InboundShareStatus.Rejected(message = (error as InboundShareRejected).userMessage) },
        )
    }

    fun chooseProject(project: MobileProjectRecord) {
        val current = status
        if (current is InboundShareStatus.NeedsProjectSelection) {
            status = InboundShareStatus.NeedsImportRole(project = project, candidate = current.candidate)
        }
    }

    fun importPending(choice: InboundShareChoice) {
        val current = status
        if (current !is InboundShareStatus.NeedsImportRole) return
        status = when (val result = importer(ProjectImageImportRequest(current.project.id, current.candidate.id, choice.importRole, current.candidate.mimeType, current.candidate.originalFileName, current.candidate.sourcePath))) {
            is AdapterResult.Success -> InboundShareStatus.Imported(result.value)
            is AdapterResult.Failure -> InboundShareStatus.Rejected(result.error.userMessage)
        }
    }
}

class AndroidInboundIntentAdapter {
    fun deferredMessage(intent: Intent): String? {
        return when (intent.action) {
            Intent.ACTION_SEND_MULTIPLE -> InboundShareAdapter.MultiImageMessage
            Intent.ACTION_SEND, Intent.ACTION_VIEW -> null
            else -> InboundShareAdapter.UnsupportedMessage
        }
    }

    fun singleContentUri(intent: Intent): Uri? {
        if (intent.action == Intent.ACTION_SEND_MULTIPLE) return null
        return intent.getParcelableExtra(Intent.EXTRA_STREAM) ?: intent.data
    }
}
