import Foundation

enum ComposerProvider: String, CaseIterable, Equatable, Identifiable {
    case mock
    case openAI = "openai"

    var id: String { rawValue }
    var displayName: String {
        switch self {
        case .mock: "Mocked"
        case .openAI: "OpenAI"
        }
    }
}

struct ComposerReferenceSummary: Equatable, Identifiable {
    let id: String
    let label: String
    let assetPath: String

    init(id: String, label: String, assetPath: String? = nil) {
        self.id = id
        self.label = label
        self.assetPath = assetPath ?? id
    }
}

struct ComposerState: Equatable {
    var promptText: String
    var selectedProvider: ComposerProvider
    var outputSize: OutputSize
    var systemPrompt: String
    var projectContext: String
    var references: [ComposerReferenceSummary]
    var hasSelectedImage: Bool
    var mode: EditorMode

    init(
        promptText: String = "",
        selectedProvider: ComposerProvider = .mock,
        outputSize: OutputSize = .square,
        systemPrompt: String = "",
        projectContext: String = "",
        references: [ComposerReferenceSummary] = [],
        hasSelectedImage: Bool = false,
        mode: EditorMode = .generate
    ) {
        self.promptText = promptText
        self.selectedProvider = selectedProvider
        self.outputSize = outputSize
        self.systemPrompt = systemPrompt
        self.projectContext = projectContext
        self.references = references
        self.hasSelectedImage = hasSelectedImage
        self.mode = mode
    }

    var trimmedPrompt: String { promptText.trimmingCharacters(in: .whitespacesAndNewlines) }
    var providerDisplayName: String { selectedProvider.displayName }
    var outputSizeLabel: String { outputSize.rawValue }
    var referenceStripLabel: String { references.isEmpty ? "No references" : "\(references.count) reference\(references.count == 1 ? "" : "s")" }
    var primaryActionLabel: String { mode == .edit ? "Apply edit" : "Generate" }
    var canSubmitPrimaryAction: Bool { mode == .edit ? hasSelectedImage && !trimmedPrompt.isEmpty : !trimmedPrompt.isEmpty }
    static let availableProviders = ComposerProvider.allCases
    static let availableOutputSizes: [OutputSize] = [.square, .portrait, .landscape]
    static let unsupportedControls: [String] = []
}

enum MockProviderScenario: Equatable {
    case success
    case slowSuccess
    case providerError
}

struct ProviderReferenceImage: Equatable {
    let id: String
    let assetPath: String
}

struct ProviderRequest: Equatable {
    let id: String
    let prompt: String
    let provider: EditorProvider
    let mode: EditorMode
    let outputSize: OutputSize
    let parentImageId: String?
    let parentHistoryId: String?
    let annotations: CanvasAnnotations
    let references: [ProviderReferenceImage]
    let inputImageURL: URL?
    let maskImageURL: URL?

    init(id: String, prompt: String, provider: EditorProvider, mode: EditorMode, outputSize: OutputSize, parentImageId: String?, parentHistoryId: String?, annotations: CanvasAnnotations, references: [ProviderReferenceImage], inputImageURL: URL? = nil, maskImageURL: URL? = nil) {
        self.id = id
        self.prompt = prompt
        self.provider = provider
        self.mode = mode
        self.outputSize = outputSize
        self.parentImageId = parentImageId
        self.parentHistoryId = parentHistoryId
        self.annotations = annotations
        self.references = references
        self.inputImageURL = inputImageURL
        self.maskImageURL = maskImageURL
    }
}

struct ProviderImageResult: Equatable {
    let requestId: String
    let imageURL: String
    let assetId: String
    let assetPath: String
    let size: EditorSize
    let createdAt: String
    let timestamp: Double
}

enum MockProviderResult: Equatable {
    case success(ProviderImageResult)
    case failure(String)
}

struct MockImageProvider: Equatable {
    static let errorMessage = "Mock provider failed. Try again."
    let scenario: MockProviderScenario

    init(scenario: MockProviderScenario = .success) {
        self.scenario = scenario
    }

    func generate(_ request: ProviderRequest) -> MockProviderResult { resolve(request) }
    func edit(_ request: ProviderRequest) -> MockProviderResult { resolve(request) }

    private func resolve(_ request: ProviderRequest) -> MockProviderResult {
        switch scenario {
        case .success, .slowSuccess:
            let suffix = stableSuffix(for: request)
            return .success(ProviderImageResult(requestId: request.id, imageURL: "mock://images/\(suffix).png", assetId: "asset-\(suffix)", assetPath: "assets/\(suffix).png", size: EditorSize(width: 1024, height: 1024), createdAt: "1970-01-01T00:00:00.000Z", timestamp: request.mode == .generate ? 1 : 2))
        case .providerError:
            return .failure(Self.errorMessage)
        }
    }

    private func stableSuffix(for request: ProviderRequest) -> String {
        let normalizedPrompt = request.prompt.lowercased().split { !$0.isLetter && !$0.isNumber }.prefix(6).joined(separator: "-")
        let mode = request.mode == .generate ? "generate" : "edit"
        return "mock-\(mode)-\(normalizedPrompt.isEmpty ? "annotation" : normalizedPrompt)"
    }
}

struct OpenAIImageHTTPFile: Equatable {
    let fieldName: String
    let fileURL: URL
    let mimeType: String
}

enum OpenAIImageHTTPBody: Equatable {
    case json([String: String])
    case multipart(fields: [String: String], files: [OpenAIImageHTTPFile])
}

struct OpenAIImageHTTPRequest: Equatable {
    let requestId: String
    let endpointPath: String
    let authorizationHeader: String
    let body: OpenAIImageHTTPBody

    var bodyFields: [String: String] {
        switch body {
        case .json(let fields), .multipart(let fields, _): fields
        }
    }

    var redactedLogLine: String { "OpenAI \(endpointPath) request_id=\(requestId) auth=Bearer [REDACTED]" }
}

enum OpenAITransportResult: Equatable {
    case success(base64PNG: String, createdAt: String, timestamp: Double)
    case failure(statusCode: Int, message: String)
}

protocol OpenAIImageTransport {
    func send(_ request: OpenAIImageHTTPRequest) -> OpenAITransportResult
}

enum OpenAIProviderResult: Equatable {
    case success(ProviderImageResult)
    case failure(String)
}

struct OpenAIImageProvider {
    static let missingKeyMessage = "Add an OpenAI API key in Settings before generating images."
    private let keyStore: OpenAIAPIKeyStore
    private let transport: OpenAIImageTransport
    private let networkStatus: NetworkStatus

    init(keyStore: OpenAIAPIKeyStore, transport: OpenAIImageTransport, networkStatus: NetworkStatus = StaticNetworkStatus(reachability: .online)) {
        self.keyStore = keyStore
        self.transport = transport
        self.networkStatus = networkStatus
    }

    func generate(_ request: ProviderRequest) -> OpenAIProviderResult {
        submit(request, body: .json(buildGenerateBody(for: request)), endpointPath: "/v1/images/generations")
    }

    func edit(_ request: ProviderRequest) -> OpenAIProviderResult {
        guard let inputImageURL = request.inputImageURL else {
            return .failure("Select an image before editing.")
        }
        var files = [OpenAIImageHTTPFile(fieldName: "image", fileURL: inputImageURL, mimeType: "image/png")]
        if let maskImageURL = request.maskImageURL {
            files.append(OpenAIImageHTTPFile(fieldName: "mask", fileURL: maskImageURL, mimeType: "image/png"))
        }
        return submit(request, body: .multipart(fields: buildGenerateBody(for: request), files: files), endpointPath: "/v1/images/edits")
    }

    private func submit(_ request: ProviderRequest, body: OpenAIImageHTTPBody, endpointPath: String) -> OpenAIProviderResult {
        guard networkStatus.currentReachability() == .online else { return .failure(AdapterError.offline.userMessage) }
        guard let key = keyStore.readAPIKey(), !key.isEmpty else { return .failure(Self.missingKeyMessage) }
        let httpRequest = OpenAIImageHTTPRequest(requestId: request.id, endpointPath: endpointPath, authorizationHeader: "Bearer \(key)", body: body)
        switch transport.send(httpRequest) {
        case .success(let base64PNG, let createdAt, let timestamp):
            return .success(ProviderImageResult(requestId: request.id, imageURL: "data:image/png;base64,\(base64PNG)", assetId: "openai-\(request.id)", assetPath: "assets/openai-\(request.id).png", size: EditorSize(width: 1024, height: 1024), createdAt: createdAt, timestamp: timestamp))
        case .failure(let statusCode, _):
            return .failure("OpenAI request failed with HTTP \(statusCode). Check your API key in Settings.")
        }
    }

    private func buildGenerateBody(for request: ProviderRequest) -> [String: String] {
        var body = [
            "model": "gpt-image-2",
            "prompt": request.prompt,
            "n": "1",
            "size": request.outputSize.rawValue,
            "response_format": "b64_json"
        ]
        if !request.references.isEmpty {
            body["reference_images"] = request.references.map(\.assetPath).joined(separator: ",")
        }
        return body
    }

}
