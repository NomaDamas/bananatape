import Foundation
import XCTest
import UIKit
@testable import BananaTape

final class BananaTapeTests: XCTestCase {
    func testProjectListStateIsEmptyWhenThereAreNoProjects() {
        let state = ProjectListState.empty

        XCTAssertTrue(state.isEmpty)
        XCTAssertEqual(state.projects, [])
    }

    func testProjectListStateIsNotEmptyWhenProjectExists() {
        let state = ProjectListState(projects: [MobileProjectSummary(id: "project-1", name: "Logo Explorations")])

        XCTAssertFalse(state.isEmpty)
        XCTAssertEqual(state.projects.first?.name, "Logo Explorations")
    }

    func testProjectActionRouting_whenSwitchingFromAToBAndChangingReferences_preservesBDocumentsAfterRestart() throws {
        let rootURL = try makeTemporaryRoot()
        let storage = LocalProjectStorage(rootURL: rootURL)
        let projectA = try makeProject(id: "project-a", entryID: "a-entry")
        let projectB = try makeProject(id: "project-b", entryID: "b-entry")
        _ = try storage.create(projectA).get()
        _ = try storage.create(projectB).get()

        let model = ProjectPickerModel(storage: storage)
        model.openProject(id: projectA.id)
        let routedProject = ProjectActionRouting.project(for: projectB.id, model: model)
        XCTAssertEqual(routedProject?.id, projectB.id)

        let routed = try XCTUnwrap(routedProject)
        let routedHistory = try ProjectHistoryDocument.parse(routed.historyJSON)
        let routedCanvas = try MobileCanvasDocument.parse(try XCTUnwrap(routed.canvasJSON))
        let changedManifest = manifestJSON(id: projectB.id, name: projectB.name, referencePath: "references/b-reference.png")
        let routedDocuments = try EditorProjectDocumentSerializer.serialize(
            history: routedHistory.entries,
            images: routedCanvas.imageOrder.compactMap { routedCanvas.images[$0] },
            focusedImageID: routedCanvas.focusedImageIds.first,
            focusedAnnotations: nil
        )
        _ = try storage.updateDocuments(
            projectID: projectB.id,
            manifestJSON: changedManifest,
            historyJSON: routedDocuments.historyJSON,
            canvasJSON: routedDocuments.canvasJSON
        ).get()

        let restarted = try LocalProjectStorage(rootURL: rootURL).read(id: projectB.id).get()
        let restartedHistory = try ProjectHistoryDocument.parse(restarted.historyJSON)
        let restartedCanvas = try MobileCanvasDocument.parse(try XCTUnwrap(restarted.canvasJSON))

        XCTAssertEqual(restartedHistory.entries.map(\.id), ["b-entry"])
        XCTAssertFalse(restarted.historyJSON.contains("a-entry"))
        XCTAssertEqual(restartedCanvas.imageOrder, ["b-entry"])
        XCTAssertEqual(restartedCanvas.focusedImageIds, ["b-entry"])
    }

    func testProjectReferenceAssetResolver_whenRelativeAssetPathExists_resolvesProjectLocalImageAfterRestart() throws {
        let rootURL = try makeTemporaryRoot()
        let projectFolderURL = rootURL.appendingPathComponent("project-b", isDirectory: true)
        let imageURL = projectFolderURL.appendingPathComponent("references/b-reference.png")
        try FileManager.default.createDirectory(at: imageURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try Data(contentsOf: fixtureURL("reference-banana.png")).write(to: imageURL)
        let reference = ComposerReferenceSummary(id: "ref-b", label: "b-reference.png", assetPath: "references/b-reference.png")

        let resolved = ProjectReferenceAssetResolver.fileURL(for: reference, projectFolderURL: projectFolderURL)

        XCTAssertEqual(resolved?.standardizedFileURL, imageURL.standardizedFileURL)
        XCTAssertTrue(resolved.map { UIImage(contentsOfFile: $0.path) != nil } == true)
    }

    func testProjectReferenceAssetResolver_whenPathEscapesProject_rejectsIt() throws {
        let projectFolderURL = try makeTemporaryRoot().appendingPathComponent("project-b", isDirectory: true)

        XCTAssertNil(ProjectReferenceAssetResolver.fileURL(
            for: ComposerReferenceSummary(id: "absolute", label: "absolute.png", assetPath: "/tmp/absolute.png"),
            projectFolderURL: projectFolderURL
        ))
        XCTAssertNil(ProjectReferenceAssetResolver.fileURL(
            for: ComposerReferenceSummary(id: "traversal", label: "traversal.png", assetPath: "../project-a/reference.png"),
            projectFolderURL: projectFolderURL
        ))
    }

    func testProjectReferenceImportRouting_whenDelayedCompletionBelongsToPreviousProject_discardsItWithoutChangingCurrentManifest() throws {
        let rootURL = try makeTemporaryRoot()
        let storage = LocalProjectStorage(rootURL: rootURL)
        let projectB = try makeProject(id: "project-b", entryID: "b-entry")
        _ = try storage.create(projectB).get()
        var importerWasCalled = false

        let routed = ProjectReferenceImportRouting.route(
            initiatingProjectID: "project-a",
            selectedProjectID: "project-b"
        ) {
            importerWasCalled = true
            return .success(ComposerReferenceSummary(id: "ref-a", label: "a.png", assetPath: "references/a.png"))
        }

        XCTAssertNil(routed)
        XCTAssertFalse(importerWasCalled)
        let restartedB = try LocalProjectStorage(rootURL: rootURL).read(id: projectB.id).get()
        let manifest = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(restartedB.manifestJSON.utf8)) as? [String: Any])
        let settings = try XCTUnwrap(manifest["settings"] as? [String: Any])
        XCTAssertEqual((settings["referenceImages"] as? [[String: Any]])?.count, 0)
    }

    private func makeTemporaryRoot() throws -> URL {
        let rootURL = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: rootURL, withIntermediateDirectories: true)
        return rootURL
    }

    private func makeProject(id: String, entryID: String) throws -> MobileProjectRecord {
        let image = CanvasImage(
            id: entryID,
            url: "assets/\(entryID).png",
            assetId: "asset-\(entryID)",
            size: EditorSize(width: 100, height: 100),
            position: EditorPoint(x: 0, y: 0),
            parentId: nil,
            generationIndex: 0,
            prompt: entryID,
            provider: .mock,
            mode: .generate,
            createdAt: 1,
            annotations: .empty,
            hasMagicLayerFields: false,
            status: .ready,
            userErrorMessage: nil
        )
        let history = HistoryEntry(
            id: entryID,
            mode: .generate,
            provider: .mock,
            prompt: entryID,
            assetId: "asset-\(entryID)",
            assetPath: "assets/\(entryID).png",
            parentId: nil,
            createdAt: "1970-01-01T00:00:00.000Z",
            timestamp: 1
        )
        let documents = try EditorProjectDocumentSerializer.serialize(history: [history], images: [image], focusedImageID: entryID, focusedAnnotations: .empty)
        return MobileProjectRecord(id: id, name: id, manifestJSON: manifestJSON(id: id, name: id, referencePath: nil), historyJSON: documents.historyJSON, canvasJSON: documents.canvasJSON)
    }

    private func manifestJSON(id: String, name: String, referencePath: String?) -> String {
        let references = referencePath.map { "[{\"id\":\"ref-b\",\"label\":\"b-reference.png\",\"assetPath\":\"\($0)\"}]" } ?? "[]"
        return """
        {"schemaVersion":1,"id":"\(id)","name":"\(name)","createdAt":"1970-01-01T00:00:00.000Z","updatedAt":"1970-01-01T00:00:00.000Z","settings":{"systemPrompt":"","referenceImages":\(references)}}
        """
    }

    private func fixtureURL(_ fileName: String) throws -> URL {
        var directory = URL(fileURLWithPath: #filePath)
        while directory.path != "/" {
            let candidate = directory.appendingPathComponent("packages/mobile-contracts/fixtures", isDirectory: true).appendingPathComponent(fileName)
            if FileManager.default.fileExists(atPath: candidate.path) {
                return candidate
            }
            directory.deleteLastPathComponent()
        }
        throw AdapterError.storageNotFound(fileName)
    }
}
