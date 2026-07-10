package app.bananatape.mobile.editor

import app.bananatape.mobile.adapters.InMemoryOpenAiApiKeyStore
import app.bananatape.mobile.adapters.NetworkReachability
import app.bananatape.mobile.adapters.StaticNetworkStatus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.nio.file.Files

class OpenAiImageProviderTest {
    @Test
    fun openAiProvider_whenGenerateBuildsRequest_usesGptImage2PromptAndSizeWithoutProjectMetadata() {
        val transport = CapturingOpenAiTransport(OpenAiTransportResult.Success(base64Png = "png", createdAt = "1970-01-01T00:00:00.000Z", timestamp = 1.0))
        val provider = OpenAiImageProvider(keyStore = InMemoryOpenAiApiKeyStore("test-api-key-secret"), transport = transport)
        val request = ProviderRequest(id = "generate-1", prompt = "banana sticker", provider = EditorProvider.OPENAI, mode = EditorMode.GENERATE, outputSize = OutputSize.LANDSCAPE, parentImageId = null, parentHistoryId = "hist-secret", annotations = CanvasAnnotations.Empty, references = emptyList())

        val result = provider.generate(request)

        assertEquals("generate-1", (result as OpenAiProviderResult.Success).value.requestId)
        assertEquals("/v1/images/generations", transport.lastRequest?.endpointPath)
        assertEquals("gpt-image-2", transport.lastRequest?.bodyFields?.get("model"))
        assertEquals("banana sticker", transport.lastRequest?.bodyFields?.get("prompt"))
        assertEquals("1536x1024", transport.lastRequest?.bodyFields?.get("size"))
        assertNull(transport.lastRequest?.bodyFields?.get("parentHistoryId"))
        assertFalse(transport.lastRequest?.bodyFields?.values?.contains("hist-secret") ?: true)
    }

    @Test
    fun openAiProvider_whenGenerateHasReferences_sendsReferenceAssetPaths() {
        val transport = CapturingOpenAiTransport(OpenAiTransportResult.Success(base64Png = "png", createdAt = "1970-01-01T00:00:00.000Z", timestamp = 1.0))
        val provider = OpenAiImageProvider(keyStore = InMemoryOpenAiApiKeyStore("test-api-key-secret"), transport = transport)
        val request = ProviderRequest(
            id = "generate-refs",
            prompt = "banana sticker",
            provider = EditorProvider.OPENAI,
            mode = EditorMode.GENERATE,
            outputSize = OutputSize.SQUARE,
            parentImageId = null,
            parentHistoryId = null,
            annotations = CanvasAnnotations.Empty,
            references = listOf(
                ProviderReferenceImage("ref-1", "references/ref-1.png"),
                ProviderReferenceImage("ref-2", "references/ref-2.jpg"),
            ),
        )

        provider.generate(request)

        assertEquals("references/ref-1.png,references/ref-2.jpg", transport.lastRequest?.bodyFields?.get("reference_images"))
    }

    @Test
    fun openAiProvider_whenEditBuildsRequest_includesImageAndMaskFiles() {
        val transport = CapturingOpenAiTransport(OpenAiTransportResult.Success(base64Png = "png", createdAt = "1970-01-01T00:00:00.000Z", timestamp = 2.0))
        val provider = OpenAiImageProvider(keyStore = InMemoryOpenAiApiKeyStore("test-api-key-secret"), transport = transport)
        val box = BoundingBox(id = "box-edit", x = 0.2, y = 0.2, width = 0.4, height = 0.4, color = "#0d99ff", status = AnnotationStatus.PENDING)
        val imagePath = Files.createTempFile("edit-source", ".png").also { Files.write(it, "image-bytes".toByteArray()) }
        val maskPath = Files.createTempFile("edit-mask", ".png").also { Files.write(it, "mask-bytes".toByteArray()) }
        val request = ProviderRequest(id = "edit-1", prompt = "make peel brighter", provider = EditorProvider.OPENAI, mode = EditorMode.EDIT, outputSize = OutputSize.SQUARE, parentImageId = "image-local", parentHistoryId = "history-local", annotations = CanvasAnnotations(paths = emptyList(), boxes = listOf(box), memos = emptyList()), references = emptyList(), inputImagePath = imagePath, maskImagePath = maskPath)

        provider.edit(request)

        assertEquals("/v1/images/edits", transport.lastRequest?.endpointPath)
        val body = transport.lastRequest?.body as? OpenAiImageHttpBody.Multipart ?: error("expected multipart")
        assertEquals("gpt-image-2", body.fields["model"])
        assertEquals("make peel brighter", body.fields["prompt"])
        assertEquals("1024x1024", body.fields["size"])
        assertEquals(listOf("image", "mask"), body.files.map { it.fieldName })
        assertEquals(listOf(imagePath, maskPath), body.files.map { it.filePath })
        assertFalse(body.fields.values.contains("history-local"))
        Files.deleteIfExists(imagePath)
        Files.deleteIfExists(maskPath)
    }

    @Test
    fun openAiProvider_whenKeyMissing_returnsSettingsPromptWithoutNetworkCall() {
        val transport = CapturingOpenAiTransport(OpenAiTransportResult.Success(base64Png = "png", createdAt = "1970-01-01T00:00:00.000Z", timestamp = 1.0))
        val provider = OpenAiImageProvider(keyStore = InMemoryOpenAiApiKeyStore(), transport = transport)
        val request = ProviderRequest(id = "generate-1", prompt = "banana sticker", provider = EditorProvider.OPENAI, mode = EditorMode.GENERATE, outputSize = OutputSize.SQUARE, parentImageId = null, parentHistoryId = null, annotations = CanvasAnnotations.Empty, references = emptyList())

        val result = provider.generate(request)

        assertEquals(OpenAiProviderResult.Failure(OpenAiImageProvider.MissingKeyMessage), result)
        assertNull(transport.lastRequest)
    }

    @Test
    fun openAiProvider_whenOffline_returnsStableOfflineErrorWithoutNetworkCall() {
        val transport = CapturingOpenAiTransport(OpenAiTransportResult.Success(base64Png = "png", createdAt = "1970-01-01T00:00:00.000Z", timestamp = 1.0))
        val provider = OpenAiImageProvider(keyStore = InMemoryOpenAiApiKeyStore("test-api-key-secret"), transport = transport, networkStatus = StaticNetworkStatus(NetworkReachability.OFFLINE))
        val request = ProviderRequest(id = "generate-1", prompt = "banana sticker", provider = EditorProvider.OPENAI, mode = EditorMode.GENERATE, outputSize = OutputSize.SQUARE, parentImageId = null, parentHistoryId = null, annotations = CanvasAnnotations.Empty, references = emptyList())

        val result = provider.generate(request)

        assertEquals(OpenAiProviderResult.Failure("You are offline."), result)
        assertNull(transport.lastRequest)
    }

    @Test
    fun openAiProvider_whenInvalidKey401_returnsRedactedErrorAndLog() {
        val secret = "test-api-key-secret"
        val transport = CapturingOpenAiTransport(OpenAiTransportResult.Failure(statusCode = 401, message = "bad key $secret"))
        val provider = OpenAiImageProvider(keyStore = InMemoryOpenAiApiKeyStore(secret), transport = transport)
        val request = ProviderRequest(id = "generate-1", prompt = "banana sticker", provider = EditorProvider.OPENAI, mode = EditorMode.GENERATE, outputSize = OutputSize.SQUARE, parentImageId = null, parentHistoryId = null, annotations = CanvasAnnotations.Empty, references = emptyList())

        val result = provider.generate(request)

        assertEquals(OpenAiProviderResult.Failure("OpenAI request failed with HTTP 401. Check your API key in Settings."), result)
        assertFalse(transport.lastRequest?.redactedLogLine?.contains(secret) ?: true)
        assertFalse(result.toString().contains(secret))
    }

    @Test
    fun openAiSmoke_whenEnvironmentKeyIsAbsent_skipsSafely() {
        assumeTrue("OPENAI_API_KEY absent; optional real smoke skipped.", System.getenv("OPENAI_API_KEY") != null)
    }
}

private class CapturingOpenAiTransport(
    private val result: OpenAiTransportResult,
) : OpenAiImageTransport {
    var lastRequest: OpenAiImageHttpRequest? = null
        private set

    override fun send(request: OpenAiImageHttpRequest): OpenAiTransportResult {
        lastRequest = request
        return result
    }
}
