import XCTest
@testable import BananaTape

final class AdapterContractsTests: XCTestCase {
    func testProjectStorage_whenProjectIsCreated_listsAndReadsProject() throws {
        let storage = FakeProjectStorage()
        let project = MobileProjectRecord(id: "project-1", name: "Logo Explorations", manifestJSON: "{}", historyJSON: "[]", canvasJSON: nil)

        let created = try storage.create(project).get()
        let summaries = storage.list()
        let read = try storage.read(id: "project-1").get()

        XCTAssertEqual(created, project)
        XCTAssertEqual(summaries, [MobileProjectSummary(id: "project-1", name: "Logo Explorations")])
        XCTAssertEqual(read, project)
    }

    func testProjectStorage_whenProjectIsDeleted_removesProject() throws {
        let project = MobileProjectRecord(id: "project-1", name: "Logo Explorations", manifestJSON: "{}", historyJSON: "[]", canvasJSON: nil)
        let storage = FakeProjectStorage(projects: [project])

        let deletion = storage.delete(id: "project-1")
        let read = storage.read(id: "project-1")

        XCTAssertNoThrow(try deletion.get())
        XCTAssertEqual(read.failure, .storageNotFound("project-1"))
    }

    func testProjectStorage_whenFixtureIsCorrupt_returnsCorruptProject() {
        let project = MobileProjectRecord(id: "corrupt-project-missing-history", name: "Corrupt", manifestJSON: "{}", historyJSON: "", canvasJSON: nil)
        let storage = FakeProjectStorage(projects: [project], corruptProjectIDs: ["corrupt-project-missing-history"])

        let read = storage.read(id: "corrupt-project-missing-history")

        XCTAssertEqual(read.failure, .corruptProject("corrupt-project-missing-history"))
    }

    func testPermissionGateway_whenDenied_returnsDeniedDecision() {
        let gateway = FakePermissionGateway(decisions: [.imageExport: .denied])

        let decision = gateway.decision(for: .imageExport)

        XCTAssertEqual(decision, .denied)
    }

    func testProviderAuth_whenNetworkIsOffline_returnsOfflineAvailability() {
        let auth = FakeProviderAuth(
            availabilityByProvider: [.openAI: .ready],
            networkStatus: FakeNetworkStatus(reachability: .offline)
        )

        let availability = auth.availability(for: .openAI)

        XCTAssertEqual(availability, .offline)
    }

    func testProviderAuth_whenKeyIsMissing_returnsMissingKey() {
        let auth = FakeProviderAuth(
            availabilityByProvider: [.openAI: .missingKey],
            networkStatus: FakeNetworkStatus(reachability: .online)
        )

        let availability = auth.availability(for: .openAI)
        let codexAvailability = auth.availability(for: .codex)

        XCTAssertEqual(availability, .missingKey)
        XCTAssertEqual(codexAvailability, .unavailable)
        XCTAssertEqual(codexAvailability.userMessage, "Codex mobile provider is not available in this build")
    }

    func testImageImport_whenPngIsGrantedAndSmall_returnsImportedImage() throws {
        let importer = FakeImageImport(
            permissionGateway: FakePermissionGateway(decisions: [.imageImport: .granted]),
            memoryPolicy: FakeImageMemoryPolicy(maxBytes: 1024)
        )

        let image = try importer.importImage(id: "reference-1", mimeType: .png, byteCount: 512).get()

        XCTAssertEqual(image, ImportedImage(id: "reference-1", mimeType: .png, byteCount: 512))
    }

    func testImageImport_whenPermissionDenied_returnsPermissionDenied() {
        let importer = FakeImageImport(
            permissionGateway: FakePermissionGateway(decisions: [.imageImport: .denied]),
            memoryPolicy: FakeImageMemoryPolicy(maxBytes: 1024)
        )

        let result = importer.importImage(id: "reference-1", mimeType: .png, byteCount: 512)

        XCTAssertEqual(result.failure, .permissionDenied(.imageImport))
    }

    func testImageImport_whenImageIsTooLarge_returnsOversizedImage() {
        let importer = FakeImageImport(
            permissionGateway: FakePermissionGateway(decisions: [.imageImport: .granted]),
            memoryPolicy: FakeImageMemoryPolicy(maxBytes: 1024)
        )

        let result = importer.importImage(id: "reference-1", mimeType: .jpeg, byteCount: 2048)

        XCTAssertEqual(result.failure, .oversizedImage(maxBytes: 1024, actualBytes: 2048))
    }

    func testImageImport_whenFileTypeIsUnsupported_returnsUnsupportedFileType() {
        let importer = FakeImageImport(
            permissionGateway: FakePermissionGateway(decisions: [.imageImport: .granted]),
            memoryPolicy: FakeImageMemoryPolicy(maxBytes: 1024)
        )

        let result = importer.importImage(id: "reference-1", mimeType: .webp, byteCount: 512)

        XCTAssertEqual(result.failure, .unsupportedFileType(.webp))
    }

    func testAdapterError_whenImportTypeIsUnsupported_hasStableUserSafeMessage() {
        let error = AdapterError.unsupportedFileType(.heic)

        XCTAssertEqual(error.code, "image.unsupported_type")
        XCTAssertEqual(error.userMessage, "Use a PNG or JPEG image.")
    }

    func testAdapterError_whenImportIsOversized_hasStableUserSafeMessage() {
        let error = AdapterError.oversizedImage(maxBytes: 12, actualBytes: 13)

        XCTAssertEqual(error.code, "image.oversized")
        XCTAssertEqual(error.userMessage, "This image is too large to import.")
    }

    func testImageExport_whenPermissionGranted_returnsExportedImage() throws {
        let exporter = FakeImageExport(permissionGateway: FakePermissionGateway(decisions: [.imageExport: .granted]))

        let image = try exporter.exportImage(id: "history-1", destination: .photosAlbum(name: "BananaTape"), byteCount: 512).get()

        XCTAssertEqual(image, ExportedImage(id: "history-1", destination: .photosAlbum(name: "BananaTape"), byteCount: 512))
    }

    func testImageExport_whenPermissionDenied_returnsPermissionDenied() {
        let exporter = FakeImageExport(permissionGateway: FakePermissionGateway(decisions: [.imageExport: .denied]))

        let result = exporter.exportImage(id: "history-1", destination: .shareSheet, byteCount: 512)

        XCTAssertEqual(result.failure, .permissionDenied(.imageExport))
    }

    func testGalleryExport_whenAuthorized_recordsBananaTapeAlbumAndImageMetadata() throws {
        let exporter = FakeGalleryImageExport(authorization: .authorized, albumName: "BananaTape")
        let image = exportableImage()

        let receipt = try exporter.saveToGallery(image).get()

        XCTAssertEqual(receipt.id, "history-1")
        XCTAssertEqual(receipt.albumName, "BananaTape")
        XCTAssertTrue(receipt.savedToAlbum)
        XCTAssertEqual(receipt.mimeType, .png)
        XCTAssertEqual(receipt.width, 32)
        XCTAssertEqual(receipt.height, 24)
        XCTAssertEqual(receipt.byteCount, 512)
        XCTAssertEqual(receipt.createdAt, Date(timeIntervalSince1970: 1_700_000_000))
        XCTAssertNil(receipt.guidance)
    }

    func testGalleryExport_whenLimited_savesWithoutAlbumAndReturnsRecoverableGuidance() throws {
        let exporter = FakeGalleryImageExport(authorization: .limited, albumName: "BananaTape")

        let receipt = try exporter.saveToGallery(exportableImage()).get()

        XCTAssertFalse(receipt.savedToAlbum)
        XCTAssertEqual(receipt.guidance, "Saved to Photos. Allow full Photos access to place exports in the BananaTape album.")
    }

    func testGalleryExport_whenPermissionDenied_returnsRecoverableError() {
        let exporter = FakeGalleryImageExport(authorization: .denied, albumName: "BananaTape")

        let result = exporter.saveToGallery(exportableImage())

        XCTAssertEqual(result.failure, .permissionDenied(.imageExport))
        XCTAssertTrue(FileManager.default.fileExists(atPath: exportableImage().fileURL.path()))
    }

    func testOutboundShare_whenPrepared_copiesContentSafeTemporaryFileWithMimeAndExpiry() throws {
        let temp = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        let share = FakeOutboundImageShare(tempDirectory: temp, ttlSeconds: 600)
        let image = exportableImage()

        let shared = try share.prepareShare(image).get()

        XCTAssertEqual(shared.id, "history-1")
        XCTAssertEqual(shared.mimeType, .png)
        XCTAssertEqual(shared.byteCount, 512)
        XCTAssertEqual(shared.expiresAt, Date(timeIntervalSince1970: 1_700_000_600))
        XCTAssertEqual(shared.fileURL.deletingLastPathComponent(), temp)
        XCTAssertEqual(shared.fileURL.pathExtension, "png")
        XCTAssertTrue(FileManager.default.fileExists(atPath: shared.fileURL.path()))
        XCTAssertTrue(FileManager.default.fileExists(atPath: image.fileURL.path()))
    }

    func testPhotoKitExport_whenOnlyExplicitlySaved_touchesPhotosWriterOnce() throws {
        let writer = CountingPhotosWriter(authorization: .authorized)
        let exporter = PhotoKitGalleryImageExport(library: writer)
        let image = exportableImage()

        XCTAssertEqual(writer.saveCount, 0)
        let receipt = try exporter.saveToGallery(image).get()

        XCTAssertEqual(writer.saveCount, 1)
        XCTAssertEqual(writer.lastAlbumName, "BananaTape")
        XCTAssertTrue(receipt.savedToAlbum)
        XCTAssertTrue(FileManager.default.fileExists(atPath: image.fileURL.path()))
    }

    private func exportableImage() -> ExportableImage {
        let source = FileManager.default.temporaryDirectory.appendingPathComponent("bananatape-export-source.png")
        try? Data(repeating: 7, count: 512).write(to: source)
        return ExportableImage(id: "history-1", fileURL: source, mimeType: .png, width: 32, height: 24, byteCount: 512, createdAt: Date(timeIntervalSince1970: 1_700_000_000))
    }
}

private final class CountingPhotosWriter: PhotosLibraryWriting {
    private let authorization: GalleryAuthorization
    private(set) var saveCount = 0
    private(set) var lastAlbumName: String?

    init(authorization: GalleryAuthorization) {
        self.authorization = authorization
    }

    func currentAuthorization() -> GalleryAuthorization {
        authorization
    }

    func save(_ image: ExportableImage, albumName: String) -> Result<Bool, AdapterError> {
        saveCount += 1
        lastAlbumName = albumName
        return .success(true)
    }
}

private extension Result where Failure == AdapterError {
    var failure: AdapterError? {
        switch self {
        case .success:
            return nil
        case .failure(let error):
            return error
        }
    }
}
