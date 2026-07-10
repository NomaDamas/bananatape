import XCTest
@testable import BananaTape

final class InboundShareAdaptersTests: XCTestCase {
    func testInboundShare_whenActiveProjectChoosesReference_copiesIntoProjectReferenceStorage() throws {
        let rootURL = try makeTemporaryRoot()
        let storage = LocalProjectStorage(rootURL: rootURL)
        let project = try createProject(in: storage)
        let sourceURL = try fixtureURL("desktop-v1-project-with-references", "references/reference-banana.png")
        let model = InboundShareModel(storage: storage)

        model.receive(items: [InboundShareItem(mimeType: "image/png", originalFileName: "reference-banana.png", sourceURL: sourceURL)], activeProject: project, candidateID: "inbound-reference")
        model.importPending(as: .referenceImage)

        guard case .imported(let asset) = model.status else { return XCTFail("Expected imported reference") }
        XCTAssertEqual(asset.role, .referenceImage)
        XCTAssertEqual(asset.projectRelativePath, "references/inbound-reference.png")
        XCTAssertEqual(try Data(contentsOf: asset.fileURL), try Data(contentsOf: sourceURL))
    }

    func testInboundShare_whenActiveProjectChoosesBase_copiesIntoProjectAssetStorage() throws {
        let rootURL = try makeTemporaryRoot()
        let storage = LocalProjectStorage(rootURL: rootURL)
        let project = try createProject(in: storage)
        let sourceURL = try fixtureURL("desktop-v1-project-with-references", "references/reference-banana.png")
        let model = InboundShareModel(storage: storage)

        model.receive(items: [InboundShareItem(mimeType: "image/jpeg", originalFileName: "base.jpg", sourceURL: sourceURL)], activeProject: project, candidateID: "inbound-base")
        model.importPending(as: .baseImage)

        guard case .imported(let asset) = model.status else { return XCTFail("Expected imported base image") }
        XCTAssertEqual(asset.role, .baseImage)
        XCTAssertEqual(asset.projectRelativePath, "assets/inbound-base.jpg")
        XCTAssertEqual(try Data(contentsOf: asset.fileURL), try Data(contentsOf: sourceURL))
    }

    func testInboundShare_whenNoProjectIsOpen_requiresProjectBeforeCopying() throws {
        let rootURL = try makeTemporaryRoot()
        let storage = LocalProjectStorage(rootURL: rootURL)
        let project = try createProject(in: storage)
        let sourceURL = try fixtureURL("desktop-v1-project-with-references", "references/reference-banana.png")
        let model = InboundShareModel(storage: storage)

        model.receive(items: [InboundShareItem(mimeType: "image/png", originalFileName: "reference-banana.png", sourceURL: sourceURL)], activeProject: nil, candidateID: "pending-reference")

        guard case .needsProjectSelection(let candidate) = model.status else { return XCTFail("Expected project selection") }
        XCTAssertEqual(candidate.id, "pending-reference")
        XCTAssertFalse(FileManager.default.fileExists(atPath: rootURL.appendingPathComponent(project.id).appendingPathComponent("references/pending-reference.png").path()))

        model.chooseProject(project)
        model.importPending(as: .referenceImage)

        guard case .imported(let asset) = model.status else { return XCTFail("Expected imported pending image") }
        XCTAssertEqual(asset.projectRelativePath, "references/pending-reference.png")
    }

    func testInboundShare_whenUnsupportedMimeOrMultipleItems_rejectsWithStableMessages() throws {
        let storage = LocalProjectStorage(rootURL: try makeTemporaryRoot())
        let sourceURL = try fixtureURL("desktop-v1-project-with-references", "references/reference-banana.png")
        let model = InboundShareModel(storage: storage)

        model.receive(items: [InboundShareItem(mimeType: "application/pdf", originalFileName: "brief.pdf", sourceURL: sourceURL)], activeProject: nil, candidateID: "pdf")
        XCTAssertEqual(model.status, .rejected(message: InboundShareAdapter.unsupportedMessage))

        model.receive(items: [
            InboundShareItem(mimeType: "image/png", originalFileName: "one.png", sourceURL: sourceURL),
            InboundShareItem(mimeType: "image/png", originalFileName: "two.png", sourceURL: sourceURL),
        ], activeProject: nil, candidateID: "many")
        XCTAssertEqual(model.status, .rejected(message: InboundShareAdapter.multiImageMessage))
    }

    private func createProject(in storage: LocalProjectStorage) throws -> MobileProjectRecord {
        let project = MobileProjectRecord(id: "mobile-smoke-project", name: "Mobile Smoke Project", manifestJSON: manifestJSON, historyJSON: emptyHistoryJSON, canvasJSON: nil)
        return try storage.create(project).get()
    }

    private var manifestJSON: String {
        """
        {
          "schemaVersion": 1,
          "id": "mobile-smoke-project",
          "name": "Mobile Smoke Project",
          "createdAt": "2026-07-03T00:00:00.000Z",
          "updatedAt": "2026-07-03T00:00:00.000Z",
          "settings": { "systemPrompt": "", "referenceImages": [] }
        }
        """
    }

    private var emptyHistoryJSON: String {
        """
        { "schemaVersion": 1, "revision": 0, "entries": [] }
        """
    }

    private func makeTemporaryRoot() throws -> URL {
        let rootURL = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: rootURL, withIntermediateDirectories: true)
        return rootURL
    }

    private func fixtureURL(_ fixture: String, _ fileName: String) throws -> URL {
        var directory = URL(fileURLWithPath: #filePath)
        while directory.path != "/" {
            let candidate = directory.appendingPathComponent("packages/mobile-contracts/fixtures", isDirectory: true).appendingPathComponent(fixture, isDirectory: true).appendingPathComponent(fileName)
            if FileManager.default.fileExists(atPath: candidate.path()) { return candidate }
            directory.deleteLastPathComponent()
        }
        throw AdapterError.storageNotFound(fileName)
    }
}
