package app.bananatape.mobile.editor

import app.bananatape.mobile.adapters.AdapterError
import app.bananatape.mobile.adapters.NetworkReachability
import app.bananatape.mobile.adapters.NetworkStatus
import app.bananatape.mobile.adapters.OpenAiApiKeyStore
import app.bananatape.mobile.adapters.StaticNetworkStatus
import java.nio.file.Path

data class OpenAiImageHttpFile(
    val fieldName: String,
    val filePath: Path,
    val mimeType: String,
)

sealed interface OpenAiImageHttpBody {
    data class Json(val fields: Map<String, String>) : OpenAiImageHttpBody
    data class Multipart(val fields: Map<String, String>, val files: List<OpenAiImageHttpFile>) : OpenAiImageHttpBody
}

data class OpenAiImageHttpRequest(
    val requestId: String,
    val endpointPath: String,
    val authorizationHeader: String,
    val body: OpenAiImageHttpBody,
) {
    val bodyFields: Map<String, String> = when (body) {
        is OpenAiImageHttpBody.Json -> body.fields
        is OpenAiImageHttpBody.Multipart -> body.fields
    }
    val redactedLogLine: String = "OpenAI $endpointPath request_id=$requestId auth=Bearer [REDACTED]"
}

sealed interface OpenAiTransportResult {
    data class Success(val base64Png: String, val createdAt: String, val timestamp: Double) : OpenAiTransportResult
    data class Failure(val statusCode: Int, val message: String) : OpenAiTransportResult
}

interface OpenAiImageTransport {
    fun send(request: OpenAiImageHttpRequest): OpenAiTransportResult
}

sealed interface OpenAiProviderResult {
    data class Success(val value: ProviderImageResult) : OpenAiProviderResult
    data class Failure(val message: String) : OpenAiProviderResult
}

class OpenAiImageProvider(
    private val keyStore: OpenAiApiKeyStore,
    private val transport: OpenAiImageTransport,
    private val networkStatus: NetworkStatus = StaticNetworkStatus(NetworkReachability.ONLINE),
) {
    fun generate(request: ProviderRequest): OpenAiProviderResult = submit(
        request = request,
        body = OpenAiImageHttpBody.Json(buildGenerateBody(request)),
        endpointPath = "/v1/images/generations",
    )

    fun edit(request: ProviderRequest): OpenAiProviderResult {
        val inputImage = request.inputImagePath ?: return OpenAiProviderResult.Failure("Select an image before editing.")
        val files = buildList {
            add(OpenAiImageHttpFile("image", inputImage, "image/png"))
            request.maskImagePath?.let { add(OpenAiImageHttpFile("mask", it, "image/png")) }
        }
        return submit(request, OpenAiImageHttpBody.Multipart(buildGenerateBody(request), files), "/v1/images/edits")
    }

    private fun submit(
        request: ProviderRequest,
        body: OpenAiImageHttpBody,
        endpointPath: String,
    ): OpenAiProviderResult {
        if (networkStatus.currentReachability() == NetworkReachability.OFFLINE) return OpenAiProviderResult.Failure(AdapterError.Offline.userMessage)
        val apiKey = keyStore.readApiKey()
        if (apiKey.isNullOrEmpty()) return OpenAiProviderResult.Failure(MissingKeyMessage)
        val httpRequest = OpenAiImageHttpRequest(
            requestId = request.id,
            endpointPath = endpointPath,
            authorizationHeader = "Bearer $apiKey",
            body = body,
        )
        return when (val result = transport.send(httpRequest)) {
            is OpenAiTransportResult.Success -> OpenAiProviderResult.Success(
                ProviderImageResult(
                    requestId = request.id,
                    imageUrl = "data:image/png;base64,${result.base64Png}",
                    assetId = "openai-${request.id}",
                    assetPath = "assets/openai-${request.id}.png",
                    size = EditorSize(width = 1024.0, height = 1024.0),
                    createdAt = result.createdAt,
                    timestamp = result.timestamp,
                ),
            )
            is OpenAiTransportResult.Failure -> OpenAiProviderResult.Failure("OpenAI request failed with HTTP ${result.statusCode}. Check your API key in Settings.")
        }
    }

    private fun buildGenerateBody(request: ProviderRequest): Map<String, String> = mapOf(
        "model" to "gpt-image-2",
        "prompt" to request.prompt,
        "n" to "1",
        "size" to request.outputSize.value,
        "response_format" to "b64_json",
    ) + referenceBodyFields(request)

    private fun referenceBodyFields(request: ProviderRequest): Map<String, String> {
        if (request.references.isEmpty()) return emptyMap()
        return mapOf("reference_images" to request.references.joinToString(",") { it.assetPath })
    }

    companion object {
        const val MissingKeyMessage = "Add an OpenAI API key in Settings before generating images."
    }
}
