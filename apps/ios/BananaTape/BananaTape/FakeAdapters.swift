import Foundation

final class FakeProjectStorage: ProjectStorage {
    private var projects: [String: MobileProjectRecord]
    private let corruptProjectIDs: Set<String>

    init(projects: [MobileProjectRecord] = [], corruptProjectIDs: Set<String> = []) {
        self.projects = Dictionary(uniqueKeysWithValues: projects.map { ($0.id, $0) })
        self.corruptProjectIDs = corruptProjectIDs
    }

    func create(_ project: MobileProjectRecord) -> Result<MobileProjectRecord, AdapterError> {
        projects[project.id] = project
        return .success(project)
    }

    func read(id: String) -> Result<MobileProjectRecord, AdapterError> {
        if corruptProjectIDs.contains(id) {
            return .failure(.corruptProject(id))
        }
        guard let project = projects[id] else {
            return .failure(.storageNotFound(id))
        }
        return .success(project)
    }

    func list() -> [MobileProjectSummary] {
        projects.values
            .map { MobileProjectSummary(id: $0.id, name: $0.name) }
            .sorted { $0.name < $1.name }
    }

    func delete(id: String) -> Result<Void, AdapterError> {
        guard projects.removeValue(forKey: id) != nil else {
            return .failure(.storageNotFound(id))
        }
        return .success(())
    }

    func renameProject(id: String, name: String) -> Result<MobileProjectRecord, AdapterError> {
        guard let project = projects[id] else { return .failure(.storageNotFound(id)) }
        let updated = MobileProjectRecord(id: id, name: name, manifestJSON: project.manifestJSON.replacingOccurrences(of: "\"name\": \"\(project.name)\"", with: "\"name\": \"\(name)\""), historyJSON: project.historyJSON, canvasJSON: project.canvasJSON)
        projects[id] = updated
        return .success(updated)
    }
}

struct FakePermissionGateway: PermissionGateway {
    let decisions: [PermissionScope: PermissionDecision]

    func decision(for scope: PermissionScope) -> PermissionDecision {
        decisions[scope, default: .granted]
    }
}

struct FakeNetworkStatus: NetworkStatus {
    let reachability: NetworkReachability

    func currentReachability() -> NetworkReachability {
        reachability
    }
}

struct FakeProviderAuth: ProviderAuth {
    let availabilityByProvider: [ProviderID: ProviderAvailability]
    let networkStatus: NetworkStatus

    func availability(for provider: ProviderID) -> ProviderAvailability {
        if provider == .codex {
            return .unavailable
        }
        if networkStatus.currentReachability() == .offline {
            return .offline
        }
        return availabilityByProvider[provider, default: .missingKey]
    }
}

struct FakeImageMemoryPolicy: ImageMemoryPolicy {
    let maxBytes: Int

    func evaluate(byteCount: Int) -> Result<Void, AdapterError> {
        if byteCount > maxBytes {
            return .failure(.oversizedImage(maxBytes: maxBytes, actualBytes: byteCount))
        }
        return .success(())
    }
}

struct FakeImageImport: ImageImport {
    let permissionGateway: PermissionGateway
    let memoryPolicy: ImageMemoryPolicy

    func importImage(id: String, mimeType: ImageMimeType, byteCount: Int) -> Result<ImportedImage, AdapterError> {
        if permissionGateway.decision(for: .imageImport) == .denied {
            return .failure(.permissionDenied(.imageImport))
        }
        switch mimeType {
        case .png, .jpeg:
            return memoryPolicy.evaluate(byteCount: byteCount).map { ImportedImage(id: id, mimeType: mimeType, byteCount: byteCount) }
        case .webp, .gif, .heic:
            return .failure(.unsupportedFileType(mimeType))
        }
    }
}

struct FakeImageExport: ImageExport {
    let permissionGateway: PermissionGateway

    func exportImage(id: String, destination: ImageExportDestination, byteCount: Int) -> Result<ExportedImage, AdapterError> {
        if permissionGateway.decision(for: .imageExport) == .denied {
            return .failure(.permissionDenied(.imageExport))
        }
        return .success(ExportedImage(id: id, destination: destination, byteCount: byteCount))
    }
}

final class InMemoryOpenAIAPIKeyStore: OpenAIAPIKeyStore {
    private var key: String?

    init(key: String? = nil) {
        self.key = key
    }

    func apiKeyState() -> OpenAIAPIKeyState {
        guard let key, !key.isEmpty else { return .missing }
        return .present(maskedSuffix: String(key.suffix(4)))
    }

    func readAPIKey() -> String? { key }

    func saveAPIKey(_ key: String) -> Result<Void, AdapterError> {
        self.key = key
        return .success(())
    }

    func deleteAPIKey() -> Result<Void, AdapterError> {
        key = nil
        return .success(())
    }
}
