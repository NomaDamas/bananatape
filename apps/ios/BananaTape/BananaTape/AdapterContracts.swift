import Foundation
import Security

struct MobileProjectRecord: Equatable {
    let id: String
    let name: String
    let manifestJSON: String
    let historyJSON: String
    let canvasJSON: String?
}

struct ImportedImage: Equatable {
    let id: String
    let mimeType: ImageMimeType
    let byteCount: Int
}

struct ProjectImageImportRequest: Equatable {
    let projectID: String
    let assetID: String
    let role: ImportedImageRole
    let mimeType: ImageMimeType
    let originalFileName: String
    let sourceURL: URL
}

struct ProjectImageAsset: Equatable {
    let id: String
    let role: ImportedImageRole
    let mimeType: ImageMimeType
    let byteCount: Int
    let projectRelativePath: String
    let fileURL: URL
}

enum ImportedImageRole: Equatable {
    case baseImage
    case referenceImage
}

struct ExportedImage: Equatable {
    let id: String
    let destination: ImageExportDestination
    let byteCount: Int
}

enum ImageMimeType: String, Equatable {
    case png = "image/png"
    case jpeg = "image/jpeg"
    case webp = "image/webp"
    case gif = "image/gif"
    case heic = "image/heic"
}

enum ImageExportDestination: Equatable {
    case photosAlbum(name: String)
    case shareSheet
}

enum PermissionScope: Equatable {
    case imageImport
    case imageExport
    case providerNetwork
}

enum PermissionDecision: Equatable {
    case granted
    case denied
}

enum ProviderID: String, Equatable {
    case openAI = "openai"
    case codex
    case mock
}

enum ProviderAvailability: Equatable {
    case ready
    case missingKey
    case offline
    case unsupported
    case unavailable
}

extension ProviderAvailability {
    var userMessage: String {
        switch self {
        case .ready:
            return "Provider is ready."
        case .missingKey:
            return "Add an API key before generating images."
        case .offline:
            return "You are offline."
        case .unsupported, .unavailable:
            return "Codex mobile provider is not available in this build"
        }
    }
}

enum NetworkReachability: Equatable {
    case online
    case offline
}

struct StaticNetworkStatus: NetworkStatus {
    let reachability: NetworkReachability

    func currentReachability() -> NetworkReachability {
        reachability
    }
}

enum AdapterError: Error, Equatable {
    case permissionDenied(PermissionScope)
    case offline
    case missingAPIKey(ProviderID)
    case oversizedImage(maxBytes: Int, actualBytes: Int)
    case unsupportedFileType(ImageMimeType)
    case storageNotFound(String)
    case corruptProject(String)
}

extension AdapterError {
    var code: String {
        switch self {
        case .permissionDenied:
            return "permission.denied"
        case .offline:
            return "network.offline"
        case .missingAPIKey:
            return "provider.missing_api_key"
        case .oversizedImage:
            return "image.oversized"
        case .unsupportedFileType:
            return "image.unsupported_type"
        case .storageNotFound:
            return "storage.not_found"
        case .corruptProject:
            return "storage.corrupt_project"
        }
    }

    var userMessage: String {
        switch self {
        case .permissionDenied:
            return "Permission is needed to continue."
        case .offline:
            return "You are offline."
        case .missingAPIKey:
            return "Add an API key before generating images."
        case .oversizedImage:
            return "This image is too large to import."
        case .unsupportedFileType:
            return "Use a PNG or JPEG image."
        case .storageNotFound:
            return "This project could not be found."
        case .corruptProject:
            return "This project could not be opened."
        }
    }
}

protocol ProjectStorage {
    func create(_ project: MobileProjectRecord) -> Result<MobileProjectRecord, AdapterError>
    func read(id: String) -> Result<MobileProjectRecord, AdapterError>
    func list() -> [MobileProjectSummary]
    func delete(id: String) -> Result<Void, AdapterError>
    func renameProject(id: String, name: String) -> Result<MobileProjectRecord, AdapterError>
}

protocol ImageImport {
    func importImage(id: String, mimeType: ImageMimeType, byteCount: Int) -> Result<ImportedImage, AdapterError>
}

protocol ImageExport {
    func exportImage(id: String, destination: ImageExportDestination, byteCount: Int) -> Result<ExportedImage, AdapterError>
}

protocol PermissionGateway {
    func decision(for scope: PermissionScope) -> PermissionDecision
}

protocol ProviderAuth {
    func availability(for provider: ProviderID) -> ProviderAvailability
}

protocol NetworkStatus {
    func currentReachability() -> NetworkReachability
}

protocol ImageMemoryPolicy {
    func evaluate(byteCount: Int) -> Result<Void, AdapterError>
}

enum OpenAIAPIKeyState: Equatable {
    case missing
    case present(maskedSuffix: String)
}

protocol OpenAIAPIKeyStore {
    func apiKeyState() -> OpenAIAPIKeyState
    func readAPIKey() -> String?
    func saveAPIKey(_ key: String) -> Result<Void, AdapterError>
    func deleteAPIKey() -> Result<Void, AdapterError>
}

final class KeychainOpenAIAPIKeyStore: OpenAIAPIKeyStore {
    private let service = "dev.bananatape.openai"
    private let account = "openai-api-key"

    func apiKeyState() -> OpenAIAPIKeyState {
        guard let key = readAPIKey() else { return .missing }
        return .present(maskedSuffix: String(key.suffix(4)))
    }

    func readAPIKey() -> String? {
        var query = baseQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func saveAPIKey(_ key: String) -> Result<Void, AdapterError> {
        let data = Data(key.utf8)
        var query = baseQuery()
        let update = SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if update == errSecSuccess { return .success(()) }
        query[kSecValueData as String] = data
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        return SecItemAdd(query as CFDictionary, nil) == errSecSuccess ? .success(()) : .failure(.corruptProject("openai-keychain"))
    }

    func deleteAPIKey() -> Result<Void, AdapterError> {
        SecItemDelete(baseQuery() as CFDictionary)
        return .success(())
    }

    private func baseQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
    }
}
