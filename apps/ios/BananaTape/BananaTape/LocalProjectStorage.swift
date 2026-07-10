import Foundation

final class LocalProjectStorage: ProjectStorage {
    static let defaultMaxImportedImageBytes = 12 * 1024 * 1024

    private let rootURL: URL
    private let fileManager: FileManager
    private let directoryNames = ["assets", "references", "thumbnails", "tmp"]
    private let maxImportedImageBytes: Int

    init(rootURL: URL? = nil, fileManager: FileManager = .default, maxImportedImageBytes: Int = LocalProjectStorage.defaultMaxImportedImageBytes) {
        self.fileManager = fileManager
        self.maxImportedImageBytes = maxImportedImageBytes
        if let rootURL {
            self.rootURL = rootURL
        } else {
            self.rootURL = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
                .appendingPathComponent("BananaTape", isDirectory: true)
                .appendingPathComponent("Projects", isDirectory: true)
        }
    }

    func create(_ project: MobileProjectRecord) -> Result<MobileProjectRecord, AdapterError> {
        guard projectIsValid(project) else {
            return .failure(.corruptProject(project.id))
        }
        do {
            let projectURL = url(for: project.id)
            try fileManager.createDirectory(at: projectURL, withIntermediateDirectories: true)
            for directoryName in directoryNames {
                try fileManager.createDirectory(at: projectURL.appendingPathComponent(directoryName, isDirectory: true), withIntermediateDirectories: true)
            }
            try project.manifestJSON.write(to: manifestURL(for: project.id), atomically: true, encoding: .utf8)
            try project.historyJSON.write(to: historyURL(for: project.id), atomically: true, encoding: .utf8)
            if let canvasJSON = project.canvasJSON {
                try canvasJSON.write(to: canvasURL(for: project.id), atomically: true, encoding: .utf8)
            }
            return .success(project)
        } catch {
            return .failure(.corruptProject(project.id))
        }
    }

    func read(id: String) -> Result<MobileProjectRecord, AdapterError> {
        let projectURL = url(for: id)
        guard fileManager.fileExists(atPath: projectURL.path) else {
            return .failure(.storageNotFound(id))
        }
        do {
            let manifestData = try Data(contentsOf: manifestURL(for: id))
            let historyData = try Data(contentsOf: historyURL(for: id))
            guard
                let summary = ProjectJSONValidation.manifestSummary(from: manifestData),
                summary.id == id,
                ProjectJSONValidation.historyIsValid(historyData),
                let manifestJSON = String(data: manifestData, encoding: .utf8),
                let historyJSON = String(data: historyData, encoding: .utf8)
            else {
                return .failure(.corruptProject(id))
            }
            let canvasJSON = try readOptionalString(at: canvasURL(for: id))
            return .success(MobileProjectRecord(id: summary.id, name: summary.name, manifestJSON: manifestJSON, historyJSON: historyJSON, canvasJSON: canvasJSON))
        } catch {
            return .failure(.corruptProject(id))
        }
    }

    func list() -> [MobileProjectSummary] {
        guard let projectURLs = try? fileManager.contentsOfDirectory(at: rootURL, includingPropertiesForKeys: [.isDirectoryKey]) else {
            return []
        }
        return projectURLs.compactMap { projectURL in
            guard directoryExists(at: projectURL) else { return nil }
            guard case .success(let project) = read(id: projectURL.lastPathComponent) else { return nil }
            return MobileProjectSummary(id: project.id, name: project.name)
        }.sorted { $0.name < $1.name }
    }

    func delete(id: String) -> Result<Void, AdapterError> {
        let projectURL = url(for: id)
        guard fileManager.fileExists(atPath: projectURL.path) else {
            return .failure(.storageNotFound(id))
        }
        do {
            try fileManager.removeItem(at: projectURL)
            return .success(())
        } catch {
            return .failure(.corruptProject(id))
        }
    }

    func importProjectImage(_ request: ProjectImageImportRequest) -> Result<ProjectImageAsset, AdapterError> {
        guard fileManager.fileExists(atPath: url(for: request.projectID).path) else {
            return .failure(.storageNotFound(request.projectID))
        }
        let fileExtension: String
        switch request.mimeType {
        case .png:
            fileExtension = "png"
        case .jpeg:
            fileExtension = "jpg"
        case .webp, .gif, .heic:
            return .failure(.unsupportedFileType(request.mimeType))
        }

        do {
            let attributes = try fileManager.attributesOfItem(atPath: request.sourceURL.path)
            let byteCount = attributes[.size] as? Int ?? 0
            guard byteCount <= maxImportedImageBytes else {
                return .failure(.oversizedImage(maxBytes: maxImportedImageBytes, actualBytes: byteCount))
            }
            let destinationDirectory = directoryName(for: request.role)
            let relativePath = "\(destinationDirectory)/\(request.assetID).\(fileExtension)"
            let destinationURL = url(for: request.projectID).appendingPathComponent(relativePath)
            if fileManager.fileExists(atPath: destinationURL.path) {
                try fileManager.removeItem(at: destinationURL)
            }
            try fileManager.copyItem(at: request.sourceURL, to: destinationURL)
            return .success(ProjectImageAsset(
                id: request.assetID,
                role: request.role,
                mimeType: request.mimeType,
                byteCount: byteCount,
                projectRelativePath: relativePath,
                fileURL: destinationURL
            ))
        } catch {
            return .failure(.corruptProject(request.projectID))
        }
    }

    func saveGeneratedImage(projectID: String, assetID: String, mimeType: ImageMimeType, data: Data) -> Result<ProjectImageAsset, AdapterError> {
        guard mimeType == .png || mimeType == .jpeg else {
            return .failure(.unsupportedFileType(mimeType))
        }
        let fileExtension = mimeType == .png ? "png" : "jpg"
        let destinationURL = url(for: projectID).appendingPathComponent("assets/\(assetID).\(fileExtension)")
        guard fileManager.fileExists(atPath: url(for: projectID).path) else {
            return .failure(.storageNotFound(projectID))
        }
        do {
            try data.write(to: destinationURL, options: .atomic)
            return .success(ProjectImageAsset(
                id: assetID,
                role: .baseImage,
                mimeType: mimeType,
                byteCount: data.count,
                projectRelativePath: "assets/\(assetID).\(fileExtension)",
                fileURL: destinationURL
            ))
        } catch {
            return .failure(.corruptProject(projectID))
        }
    }

    func updateDocuments(projectID: String, manifestJSON: String, historyJSON: String, canvasJSON: String?) -> Result<Void, AdapterError> {
        let updated = MobileProjectRecord(id: projectID, name: ProjectJSONValidation.manifestSummary(from: Data(manifestJSON.utf8))?.name ?? "", manifestJSON: manifestJSON, historyJSON: historyJSON, canvasJSON: canvasJSON)
        guard projectIsValid(updated), fileManager.fileExists(atPath: url(for: projectID).path) else {
            return .failure(.corruptProject(projectID))
        }
        do {
            try manifestJSON.write(to: manifestURL(for: projectID), atomically: true, encoding: .utf8)
            try historyJSON.write(to: historyURL(for: projectID), atomically: true, encoding: .utf8)
            if let canvasJSON {
                try canvasJSON.write(to: canvasURL(for: projectID), atomically: true, encoding: .utf8)
            }
            return .success(())
        } catch {
            return .failure(.corruptProject(projectID))
        }
    }

    func renameProject(id: String, name: String) -> Result<MobileProjectRecord, AdapterError> {
        guard case .success(let project) = read(id: id),
              let data = project.manifestJSON.data(using: .utf8),
              var manifest = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else {
            return .failure(.storageNotFound(id))
        }
        manifest["name"] = name
        manifest["updatedAt"] = ISO8601DateFormatter().string(from: Date())
        guard let updatedData = try? JSONSerialization.data(withJSONObject: manifest, options: [.prettyPrinted, .sortedKeys]),
              let updatedManifest = String(data: updatedData, encoding: .utf8)
        else {
            return .failure(.corruptProject(id))
        }
        let updated = MobileProjectRecord(id: id, name: name, manifestJSON: updatedManifest, historyJSON: project.historyJSON, canvasJSON: project.canvasJSON)
        return updateDocuments(projectID: id, manifestJSON: updatedManifest, historyJSON: project.historyJSON, canvasJSON: project.canvasJSON).map { updated }
    }

    func fileURL(projectID: String, relativePath: String) -> URL {
        url(for: projectID).appendingPathComponent(relativePath)
    }

    private func url(for id: String) -> URL {
        rootURL.appendingPathComponent(id, isDirectory: true)
    }

    private func manifestURL(for id: String) -> URL {
        url(for: id).appendingPathComponent("project.json")
    }

    private func historyURL(for id: String) -> URL {
        url(for: id).appendingPathComponent("history.json")
    }

    private func canvasURL(for id: String) -> URL {
        url(for: id).appendingPathComponent("canvas.json")
    }

    private func projectIsValid(_ project: MobileProjectRecord) -> Bool {
        guard let manifestData = project.manifestJSON.data(using: .utf8), let historyData = project.historyJSON.data(using: .utf8) else {
            return false
        }
        return ProjectJSONValidation.manifestSummary(from: manifestData) == MobileProjectSummary(id: project.id, name: project.name)
            && ProjectJSONValidation.historyIsValid(historyData)
    }

    private func readOptionalString(at url: URL) throws -> String? {
        guard fileManager.fileExists(atPath: url.path) else { return nil }
        return try String(contentsOf: url, encoding: .utf8)
    }

    private func directoryExists(at url: URL) -> Bool {
        var isDirectory: ObjCBool = false
        return fileManager.fileExists(atPath: url.path, isDirectory: &isDirectory) && isDirectory.boolValue
    }

    private func directoryName(for role: ImportedImageRole) -> String {
        switch role {
        case .baseImage:
            return "assets"
        case .referenceImage:
            return "references"
        }
    }
}
