import Foundation
import Photos

struct ExportableImage: Equatable {
    let id: String
    let fileURL: URL
    let mimeType: ImageMimeType
    let width: Int
    let height: Int
    let byteCount: Int
    let createdAt: Date
}

struct GalleryExportReceipt: Equatable {
    let id: String
    let albumName: String
    let savedToAlbum: Bool
    let mimeType: ImageMimeType
    let width: Int
    let height: Int
    let byteCount: Int
    let createdAt: Date
    let guidance: String?
}

struct SharedImage: Equatable {
    let id: String
    let fileURL: URL
    let mimeType: ImageMimeType
    let byteCount: Int
    let expiresAt: Date
}

enum GalleryAuthorization: Equatable {
    case authorized
    case limited
    case addOnly
    case denied
    case restricted
    case unavailable
}

protocol GalleryImageExport {
    func saveToGallery(_ image: ExportableImage) -> Result<GalleryExportReceipt, AdapterError>
}

protocol OutboundImageShare {
    func prepareShare(_ image: ExportableImage) -> Result<SharedImage, AdapterError>
}

protocol PhotosLibraryWriting {
    func currentAuthorization() -> GalleryAuthorization
    func save(_ image: ExportableImage, albumName: String) -> Result<Bool, AdapterError>
}

struct PhotoKitGalleryImageExport: GalleryImageExport {
    let albumName: String
    let library: PhotosLibraryWriting

    init(albumName: String = "BananaTape", library: PhotosLibraryWriting = PhotoKitLibraryWriter()) {
        self.albumName = albumName
        self.library = library
    }

    func saveToGallery(_ image: ExportableImage) -> Result<GalleryExportReceipt, AdapterError> {
        switch library.currentAuthorization() {
        case .authorized:
            return library.save(image, albumName: albumName).map { receipt(for: image, savedToAlbum: $0, guidance: nil) }
        case .limited, .addOnly:
            return library.save(image, albumName: albumName).map { _ in receipt(for: image, savedToAlbum: false, guidance: "Saved to Photos. Allow full Photos access to place exports in the BananaTape album.") }
        case .denied, .restricted, .unavailable:
            return .failure(.permissionDenied(.imageExport))
        }
    }

    private func receipt(for image: ExportableImage, savedToAlbum: Bool, guidance: String?) -> GalleryExportReceipt {
        GalleryExportReceipt(id: image.id, albumName: albumName, savedToAlbum: savedToAlbum, mimeType: image.mimeType, width: image.width, height: image.height, byteCount: image.byteCount, createdAt: image.createdAt, guidance: guidance)
    }
}

struct PhotoKitLibraryWriter: PhotosLibraryWriting {
    func currentAuthorization() -> GalleryAuthorization {
        let readWrite = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        if PHPhotoLibrary.authorizationStatus(for: .addOnly) == .authorized {
            return .addOnly
        }
        switch readWrite {
        case .authorized:
            return .authorized
        case .limited:
            return .limited
        case .denied:
            return .denied
        case .restricted:
            return .restricted
        case .notDetermined:
            return .denied
        @unknown default:
            return .unavailable
        }
    }

    func save(_ image: ExportableImage, albumName: String) -> Result<Bool, AdapterError> {
        do {
            var savedToAlbum = false
            try PHPhotoLibrary.shared().performChangesAndWait {
                let asset = PHAssetChangeRequest.creationRequestForAssetFromImage(atFileURL: image.fileURL)
                if let album = albumRequest(named: albumName), let placeholder = asset?.placeholderForCreatedAsset {
                    album.addAssets([placeholder] as NSArray)
                    savedToAlbum = true
                }
            }
            return .success(savedToAlbum)
        } catch {
            return .failure(.permissionDenied(.imageExport))
        }
    }

    private func albumRequest(named albumName: String) -> PHAssetCollectionChangeRequest? {
        let collections = PHAssetCollection.fetchAssetCollections(with: .album, subtype: .albumRegular, options: nil)
        var found: PHAssetCollection?
        collections.enumerateObjects { collection, _, stop in
            if collection.localizedTitle == albumName {
                found = collection
                stop.pointee = true
            }
        }
        if let found {
            return PHAssetCollectionChangeRequest(for: found)
        }
        return PHAssetCollectionChangeRequest.creationRequestForAssetCollection(withTitle: albumName)
    }
}

struct TemporaryOutboundImageShare: OutboundImageShare {
    let tempDirectory: URL
    let ttlSeconds: TimeInterval

    init(tempDirectory: URL = FileManager.default.temporaryDirectory.appendingPathComponent("BananaTapeShare", isDirectory: true), ttlSeconds: TimeInterval = 3600) {
        self.tempDirectory = tempDirectory
        self.ttlSeconds = ttlSeconds
    }

    func prepareShare(_ image: ExportableImage) -> Result<SharedImage, AdapterError> {
        do {
            try FileManager.default.createDirectory(at: tempDirectory, withIntermediateDirectories: true)
            let sharedURL = tempDirectory.appendingPathComponent("\(image.id)\(fileExtension(for: image.mimeType))")
            if FileManager.default.fileExists(atPath: sharedURL.path) {
                try FileManager.default.removeItem(at: sharedURL)
            }
            try FileManager.default.copyItem(at: image.fileURL, to: sharedURL)
            return .success(SharedImage(id: image.id, fileURL: sharedURL, mimeType: image.mimeType, byteCount: image.byteCount, expiresAt: image.createdAt.addingTimeInterval(ttlSeconds)))
        } catch {
            return .failure(.corruptProject(image.id))
        }
    }

    private func fileExtension(for mimeType: ImageMimeType) -> String {
        switch mimeType {
        case .png:
            return ".png"
        case .jpeg:
            return ".jpg"
        case .webp, .gif, .heic:
            return ".img"
        }
    }
}

struct FakeGalleryImageExport: GalleryImageExport {
    let authorization: GalleryAuthorization
    let albumName: String

    func saveToGallery(_ image: ExportableImage) -> Result<GalleryExportReceipt, AdapterError> {
        switch authorization {
        case .authorized:
            return .success(receipt(for: image, savedToAlbum: true, guidance: nil))
        case .limited, .addOnly:
            return .success(receipt(for: image, savedToAlbum: false, guidance: "Saved to Photos. Allow full Photos access to place exports in the BananaTape album."))
        case .denied, .restricted, .unavailable:
            return .failure(.permissionDenied(.imageExport))
        }
    }

    private func receipt(for image: ExportableImage, savedToAlbum: Bool, guidance: String?) -> GalleryExportReceipt {
        GalleryExportReceipt(id: image.id, albumName: albumName, savedToAlbum: savedToAlbum, mimeType: image.mimeType, width: image.width, height: image.height, byteCount: image.byteCount, createdAt: image.createdAt, guidance: guidance)
    }
}

struct FakeOutboundImageShare: OutboundImageShare {
    let tempDirectory: URL
    let ttlSeconds: TimeInterval

    func prepareShare(_ image: ExportableImage) -> Result<SharedImage, AdapterError> {
        do {
            try FileManager.default.createDirectory(at: tempDirectory, withIntermediateDirectories: true)
            let sharedURL = tempDirectory.appendingPathComponent("\(image.id)\(fileExtension(for: image.mimeType))")
            try FileManager.default.copyItem(at: image.fileURL, to: sharedURL)
            return .success(SharedImage(id: image.id, fileURL: sharedURL, mimeType: image.mimeType, byteCount: image.byteCount, expiresAt: image.createdAt.addingTimeInterval(ttlSeconds)))
        } catch {
            return .failure(.corruptProject(image.id))
        }
    }

    private func fileExtension(for mimeType: ImageMimeType) -> String {
        switch mimeType {
        case .png:
            return ".png"
        case .jpeg:
            return ".jpg"
        case .webp, .gif, .heic:
            return ".img"
        }
    }
}
