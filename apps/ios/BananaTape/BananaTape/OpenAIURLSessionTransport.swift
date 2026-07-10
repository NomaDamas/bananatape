import Foundation

final class OpenAIURLSessionTransport: OpenAIImageTransport {
    private let baseURL: URL
    private let session: URLSession

    init(baseURL: URL = URL(string: "https://api.openai.com")!, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    func send(_ request: OpenAIImageHTTPRequest) -> OpenAITransportResult {
        let url = baseURL.appendingPathComponent(request.endpointPath.trimmingCharacters(in: CharacterSet(charactersIn: "/")))
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.timeoutInterval = 180
        urlRequest.setValue(request.authorizationHeader, forHTTPHeaderField: "Authorization")
        urlRequest.setValue("application/json", forHTTPHeaderField: "Accept")
        switch request.body {
        case .json(let fields):
            urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
            urlRequest.httpBody = try? JSONSerialization.data(withJSONObject: fields, options: [])
        case .multipart(let fields, let files):
            let boundary = "BananaTape-\(UUID().uuidString)"
            urlRequest.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
            urlRequest.httpBody = multipartBody(fields: fields, files: files, boundary: boundary)
        }

        let semaphore = DispatchSemaphore(value: 0)
        var receivedData: Data?
        var receivedResponse: URLResponse?
        var receivedError: Error?

        session.dataTask(with: urlRequest) { data, response, error in
            receivedData = data
            receivedResponse = response
            receivedError = error
            semaphore.signal()
        }.resume()

        semaphore.wait()

        if let receivedError {
            return .failure(statusCode: 0, message: receivedError.localizedDescription)
        }
        let statusCode = (receivedResponse as? HTTPURLResponse)?.statusCode ?? 0
        let data = receivedData ?? Data()
        guard (200...299).contains(statusCode) else {
            return .failure(statusCode: statusCode, message: sanitizedMessage(from: data))
        }
        guard
            let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let images = object["data"] as? [[String: Any]],
            let firstImage = images.first,
            let base64PNG = firstImage["b64_json"] as? String,
            !base64PNG.isEmpty
        else {
            return .failure(statusCode: statusCode, message: "OpenAI response did not contain an image.")
        }
        let created = object["created"] as? TimeInterval ?? Date().timeIntervalSince1970
        return .success(base64PNG: base64PNG, createdAt: Date(timeIntervalSince1970: created).ISO8601Format(), timestamp: Date().timeIntervalSince1970)
    }

    private func sanitizedMessage(from data: Data) -> String {
        guard
            let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let error = object["error"] as? [String: Any],
            let message = error["message"] as? String,
            !message.isEmpty
        else {
            return "OpenAI request failed."
        }
        return message
    }

    private func multipartBody(fields: [String: String], files: [OpenAIImageHTTPFile], boundary: String) -> Data {
        var data = Data()
        let lineBreak = "\r\n"
        for key in fields.keys.sorted() {
            guard let value = fields[key] else { continue }
            data.append("--\(boundary)\(lineBreak)")
            data.append("Content-Disposition: form-data; name=\"\(key)\"\(lineBreak)\(lineBreak)")
            data.append("\(value)\(lineBreak)")
        }
        for file in files {
            guard let fileData = try? Data(contentsOf: file.fileURL) else { continue }
            data.append("--\(boundary)\(lineBreak)")
            data.append("Content-Disposition: form-data; name=\"\(file.fieldName)\"; filename=\"\(file.fileURL.lastPathComponent)\"\(lineBreak)")
            data.append("Content-Type: \(file.mimeType)\(lineBreak)\(lineBreak)")
            data.append(fileData)
            data.append(lineBreak)
        }
        data.append("--\(boundary)--\(lineBreak)")
        return data
    }
}

private extension Data {
    mutating func append(_ string: String) {
        append(Data(string.utf8))
    }
}
