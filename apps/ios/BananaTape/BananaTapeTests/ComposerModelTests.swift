import XCTest
@testable import BananaTape

final class ComposerModelTests: XCTestCase {
    func testPrompt_whenBananaStickerEntered_enablesGenerate() {
        let state = ComposerState(promptText: "banana sticker on transparent background", mode: .generate)

        XCTAssertEqual(state.trimmedPrompt, "banana sticker on transparent background")
        XCTAssertEqual(state.primaryActionLabel, "Generate")
        XCTAssertTrue(state.canSubmitPrimaryAction)
    }

    func testProvider_whenMockedAndOpenAISelected_displaysExpectedLabels() {
        var state = ComposerState(selectedProvider: .mock)
        XCTAssertEqual(state.providerDisplayName, "Mocked")

        state.selectedProvider = .openAI

        XCTAssertEqual(state.providerDisplayName, "OpenAI")
        XCTAssertEqual(ComposerState.availableProviders.map(\.displayName), ["Mocked", "OpenAI"])
    }

    func testOutputSize_whenSquareSelected_exposes1024Label() {
        let state = ComposerState(outputSize: .square)

        XCTAssertEqual(state.outputSizeLabel, "1024x1024")
        XCTAssertTrue(ComposerState.availableOutputSizes.contains(.square))
    }

    func testPrimaryAction_whenEditHasPromptAndSelectedImage_enablesApplyEdit() {
        let state = ComposerState(promptText: "banana sticker on transparent background", hasSelectedImage: true, mode: .edit)

        XCTAssertEqual(state.primaryActionLabel, "Apply edit")
        XCTAssertTrue(state.canSubmitPrimaryAction)
    }

    func testPrimaryAction_whenPromptEmptyOrEditImageMissing_disablesAction() {
        XCTAssertFalse(ComposerState(promptText: "   ", mode: .generate).canSubmitPrimaryAction)
        XCTAssertFalse(ComposerState(promptText: "banana sticker on transparent background", hasSelectedImage: false, mode: .edit).canSubmitPrimaryAction)
    }

    func testReferencesAndProjectContext_whenPresent_summarizesWithoutMagicLayerControls() {
        let state = ComposerState(
            systemPrompt: "Keep a transparent background.",
            projectContext: "Sticker sheet",
            references: [ComposerReferenceSummary(id: "ref-1", label: "banana.png")]
        )

        XCTAssertEqual(state.referenceStripLabel, "1 reference")
        XCTAssertEqual(state.systemPrompt, "Keep a transparent background.")
        XCTAssertEqual(state.projectContext, "Sticker sheet")
        XCTAssertFalse(ComposerState.unsupportedControls.contains { $0.localizedCaseInsensitiveContains("Magic Layer") })
    }

    func testOpenAIProvider_whenGenerateBuildsRequest_usesGptImage2PromptAndSizeWithoutProjectMetadata() throws {
        let transport = CapturingOpenAITransport(result: .success(base64PNG: "png", createdAt: "1970-01-01T00:00:00.000Z", timestamp: 1))
        let provider = OpenAIImageProvider(keyStore: InMemoryOpenAIAPIKeyStore(key: "test-api-key-secret"), transport: transport)
        let request = ProviderRequest(id: "generate-1", prompt: "banana sticker", provider: .openAI, mode: .generate, outputSize: .landscape, parentImageId: nil, parentHistoryId: "hist-secret", annotations: .empty, references: [])

        let result = provider.generate(request)

        guard case .success(let image) = result else { return XCTFail("expected success") }
        XCTAssertEqual(image.requestId, "generate-1")
        XCTAssertEqual(transport.lastRequest?.endpointPath, "/v1/images/generations")
        XCTAssertEqual(transport.lastRequest?.bodyFields["model"], "gpt-image-2")
        XCTAssertEqual(transport.lastRequest?.bodyFields["prompt"], "banana sticker")
        XCTAssertEqual(transport.lastRequest?.bodyFields["size"], "1536x1024")
        XCTAssertNil(transport.lastRequest?.bodyFields["parentHistoryId"])
        XCTAssertFalse(transport.lastRequest?.bodyFields.values.contains("hist-secret") ?? true)
    }

    func testOpenAIProvider_whenGenerateHasReferences_sendsReferenceAssetPaths() {
        let transport = CapturingOpenAITransport(result: .success(base64PNG: "png", createdAt: "1970-01-01T00:00:00.000Z", timestamp: 1))
        let provider = OpenAIImageProvider(keyStore: InMemoryOpenAIAPIKeyStore(key: "test-api-key-secret"), transport: transport)
        let request = ProviderRequest(
            id: "generate-refs",
            prompt: "banana sticker",
            provider: .openAI,
            mode: .generate,
            outputSize: .square,
            parentImageId: nil,
            parentHistoryId: nil,
            annotations: .empty,
            references: [
                ProviderReferenceImage(id: "ref-1", assetPath: "references/ref-1.png"),
                ProviderReferenceImage(id: "ref-2", assetPath: "references/ref-2.jpg")
            ]
        )

        _ = provider.generate(request)

        XCTAssertEqual(transport.lastRequest?.bodyFields["reference_images"], "references/ref-1.png,references/ref-2.jpg")
    }

    func testOpenAIProvider_whenEditBuildsRequest_includesImageAndMaskFiles() throws {
        let transport = CapturingOpenAITransport(result: .success(base64PNG: "png", createdAt: "1970-01-01T00:00:00.000Z", timestamp: 2))
        let provider = OpenAIImageProvider(keyStore: InMemoryOpenAIAPIKeyStore(key: "test-api-key-secret"), transport: transport)
        let box = BoundingBox(id: "box-edit", x: 0.2, y: 0.2, width: 0.4, height: 0.4, color: "#0d99ff", status: .pending)
        let imageURL = FileManager.default.temporaryDirectory.appendingPathComponent("edit-source.png")
        let maskURL = FileManager.default.temporaryDirectory.appendingPathComponent("edit-mask.png")
        try Data("image-bytes".utf8).write(to: imageURL)
        try Data("mask-bytes".utf8).write(to: maskURL)
        defer {
            try? FileManager.default.removeItem(at: imageURL)
            try? FileManager.default.removeItem(at: maskURL)
        }
        let request = ProviderRequest(id: "edit-1", prompt: "make peel brighter", provider: .openAI, mode: .edit, outputSize: .square, parentImageId: "image-local", parentHistoryId: "history-local", annotations: CanvasAnnotations(paths: [], boxes: [box], memos: []), references: [], inputImageURL: imageURL, maskImageURL: maskURL)

        _ = provider.edit(request)

        XCTAssertEqual(transport.lastRequest?.endpointPath, "/v1/images/edits")
        guard case .multipart(let fields, let files) = transport.lastRequest?.body else {
            return XCTFail("expected multipart edit request")
        }
        XCTAssertEqual(fields["model"], "gpt-image-2")
        XCTAssertEqual(fields["prompt"], "make peel brighter")
        XCTAssertEqual(fields["size"], "1024x1024")
        XCTAssertEqual(files.map(\.fieldName), ["image", "mask"])
        XCTAssertEqual(files.map(\.fileURL), [imageURL, maskURL])
        XCTAssertFalse(fields.values.contains("history-local"))
    }

    func testOpenAIProvider_whenKeyMissing_returnsSettingsPromptWithoutNetworkCall() {
        let transport = CapturingOpenAITransport(result: .success(base64PNG: "png", createdAt: "1970-01-01T00:00:00.000Z", timestamp: 1))
        let provider = OpenAIImageProvider(keyStore: InMemoryOpenAIAPIKeyStore(), transport: transport)
        let request = ProviderRequest(id: "generate-1", prompt: "banana sticker", provider: .openAI, mode: .generate, outputSize: .square, parentImageId: nil, parentHistoryId: nil, annotations: .empty, references: [])

        let result = provider.generate(request)

        XCTAssertEqual(result, .failure(OpenAIImageProvider.missingKeyMessage))
        XCTAssertNil(transport.lastRequest)
    }

    func testOpenAIProvider_whenOffline_returnsStableOfflineErrorWithoutNetworkCall() {
        let transport = CapturingOpenAITransport(result: .success(base64PNG: "png", createdAt: "1970-01-01T00:00:00.000Z", timestamp: 1))
        let provider = OpenAIImageProvider(keyStore: InMemoryOpenAIAPIKeyStore(key: "test-api-key-secret"), transport: transport, networkStatus: StaticNetworkStatus(reachability: .offline))
        let request = ProviderRequest(id: "generate-1", prompt: "banana sticker", provider: .openAI, mode: .generate, outputSize: .square, parentImageId: nil, parentHistoryId: nil, annotations: .empty, references: [])

        let result = provider.generate(request)

        XCTAssertEqual(result, .failure("You are offline."))
        XCTAssertNil(transport.lastRequest)
    }

    func testOpenAIProvider_whenInvalidKey401_returnsRedactedErrorAndLog() {
        let secret = "test-api-key-secret"
        let transport = CapturingOpenAITransport(result: .failure(statusCode: 401, message: "bad key \(secret)"))
        let provider = OpenAIImageProvider(keyStore: InMemoryOpenAIAPIKeyStore(key: secret), transport: transport)
        let request = ProviderRequest(id: "generate-1", prompt: "banana sticker", provider: .openAI, mode: .generate, outputSize: .square, parentImageId: nil, parentHistoryId: nil, annotations: .empty, references: [])

        let result = provider.generate(request)

        XCTAssertEqual(result, .failure("OpenAI request failed with HTTP 401. Check your API key in Settings."))
        XCTAssertFalse(transport.lastRequest?.redactedLogLine.contains(secret) ?? true)
        XCTAssertFalse(String(describing: result).contains(secret))
    }

    func testOpenAISmoke_whenEnvironmentKeyIsAbsent_skipsSafely() throws {
        try XCTSkipUnless(ProcessInfo.processInfo.environment["OPENAI_API_KEY"] != nil, "OPENAI_API_KEY absent; optional real smoke skipped.")
    }
}

final class CapturingOpenAITransport: OpenAIImageTransport {
    private let result: OpenAITransportResult
    private(set) var lastRequest: OpenAIImageHTTPRequest?

    init(result: OpenAITransportResult) {
        self.result = result
    }

    func send(_ request: OpenAIImageHTTPRequest) -> OpenAITransportResult {
        lastRequest = request
        return result
    }
}
