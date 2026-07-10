package app.bananatape.mobile.editor

import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.DataOutputStream
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant

class AndroidOpenAiImageTransport(
    private val baseUrl: String = "https://api.openai.com",
) : OpenAiImageTransport {
    override fun send(request: OpenAiImageHttpRequest): OpenAiTransportResult = runCatching {
        val connection = (URL("$baseUrl${request.endpointPath}").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 30_000
            readTimeout = 180_000
            doOutput = true
            setRequestProperty("Authorization", request.authorizationHeader)
            setRequestProperty("Accept", "application/json")
        }

        when (val body = request.body) {
            is OpenAiImageHttpBody.Json -> {
                connection.setRequestProperty("Content-Type", "application/json")
                OutputStreamWriter(connection.outputStream, Charsets.UTF_8).use { writer -> writer.write(JSONObject(body.fields).toString()) }
            }
            is OpenAiImageHttpBody.Multipart -> writeMultipart(connection, body)
        }

        val statusCode = connection.responseCode
        val body = (if (statusCode in 200..299) connection.inputStream else connection.errorStream)
            ?.bufferedReader(Charsets.UTF_8)
            ?.use(BufferedReader::readText)
            .orEmpty()

        if (statusCode !in 200..299) {
            return@runCatching OpenAiTransportResult.Failure(statusCode, sanitizedMessage(body))
        }

        val root = JSONObject(body)
        val image = root.optJSONArray("data")?.firstObject()
        val base64 = image?.optString("b64_json").orEmpty()
        if (base64.isBlank()) {
            OpenAiTransportResult.Failure(statusCode, "OpenAI response did not contain an image.")
        } else {
            val createdAt = root.optLong("created", Instant.now().epochSecond).let { Instant.ofEpochSecond(it).toString() }
            OpenAiTransportResult.Success(base64Png = base64, createdAt = createdAt, timestamp = System.currentTimeMillis().toDouble())
        }
    }.getOrElse { error ->
        OpenAiTransportResult.Failure(0, error.message ?: "OpenAI request failed.")
    }

    private fun JSONArray.firstObject(): JSONObject? = if (length() == 0) null else optJSONObject(0)

    private fun writeMultipart(connection: HttpURLConnection, body: OpenAiImageHttpBody.Multipart) {
        val boundary = "BananaTape-${System.nanoTime()}"
        connection.setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
        DataOutputStream(connection.outputStream).use { output ->
            body.fields.toSortedMap().forEach { (key, value) ->
                output.writeBytes("--$boundary\r\n")
                output.writeBytes("Content-Disposition: form-data; name=\"$key\"\r\n\r\n")
                output.write(value.toByteArray(Charsets.UTF_8))
                output.writeBytes("\r\n")
            }
            body.files.forEach { file ->
                output.writeBytes("--$boundary\r\n")
                output.writeBytes("Content-Disposition: form-data; name=\"${file.fieldName}\"; filename=\"${file.filePath.fileName}\"\r\n")
                output.writeBytes("Content-Type: ${file.mimeType}\r\n\r\n")
                java.nio.file.Files.newInputStream(file.filePath).use { it.copyTo(output) }
                output.writeBytes("\r\n")
            }
            output.writeBytes("--$boundary--\r\n")
        }
    }

    private fun sanitizedMessage(body: String): String {
        val message = runCatching { JSONObject(body).optJSONObject("error")?.optString("message") }.getOrNull()
        return message?.takeIf { it.isNotBlank() } ?: "OpenAI request failed."
    }
}
