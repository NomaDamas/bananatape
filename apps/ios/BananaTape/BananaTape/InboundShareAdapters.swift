import Foundation

struct InboundImageCandidate: Equatable {
    let id: String
    let mimeType: ImageMimeType
    let originalFileName: String
    let sourceURL: URL
}

enum InboundShareStatus: Equatable {
    case idle
    case needsProjectSelection(InboundImageCandidate)
    case needsImportRole(project: MobileProjectRecord, candidate: InboundImageCandidate)
    case imported(ProjectImageAsset)
    case rejected(message: String)
}

enum InboundShareChoice: Equatable {
    case baseImage
    case referenceImage

    var importRole: ImportedImageRole {
        switch self {
        case .baseImage:
            return .baseImage
        case .referenceImage:
            return .referenceImage
        }
    }
}

struct InboundShareItem: Equatable {
    let mimeType: String
    let originalFileName: String
    let sourceURL: URL
}

struct InboundShareRejection: Error, Equatable {
    let message: String
}

struct InboundShareAdapter {
    static let unsupportedMessage = "Use a PNG or JPEG image."
    static let multiImageMessage = "Share one PNG or JPEG image at a time."
    static let chooseProjectMessage = "Choose or create a project before importing this image."
    static let chooseRoleMessage = "Choose whether to add this image as a base image or a reference."

    func candidate(from items: [InboundShareItem], id: String) -> Result<InboundImageCandidate, InboundShareRejection> {
        guard items.count == 1, let item = items.first else {
            return .failure(InboundShareRejection(message: Self.multiImageMessage))
        }
        guard let mimeType = ImageMimeType(rawValue: item.mimeType), mimeType == .png || mimeType == .jpeg else {
            return .failure(InboundShareRejection(message: Self.unsupportedMessage))
        }
        return .success(InboundImageCandidate(id: id, mimeType: mimeType, originalFileName: item.originalFileName, sourceURL: item.sourceURL))
    }
}

final class InboundShareModel {
    private(set) var status: InboundShareStatus = .idle
    private let storage: LocalProjectStorage
    private let adapter: InboundShareAdapter

    init(storage: LocalProjectStorage, adapter: InboundShareAdapter = InboundShareAdapter()) {
        self.storage = storage
        self.adapter = adapter
    }

    func receive(items: [InboundShareItem], activeProject: MobileProjectRecord?, candidateID: String) {
        switch adapter.candidate(from: items, id: candidateID) {
        case .success(let candidate):
            if let activeProject {
                status = .needsImportRole(project: activeProject, candidate: candidate)
            } else {
                status = .needsProjectSelection(candidate)
            }
        case .failure(let rejection):
            status = .rejected(message: rejection.message)
        }
    }

    func chooseProject(_ project: MobileProjectRecord) {
        guard case .needsProjectSelection(let candidate) = status else { return }
        status = .needsImportRole(project: project, candidate: candidate)
    }

    func importPending(as choice: InboundShareChoice) {
        guard case .needsImportRole(let project, let candidate) = status else { return }
        let result = storage.importProjectImage(ProjectImageImportRequest(
            projectID: project.id,
            assetID: candidate.id,
            role: choice.importRole,
            mimeType: candidate.mimeType,
            originalFileName: candidate.originalFileName,
            sourceURL: candidate.sourceURL
        ))
        switch result {
        case .success(let asset):
            status = .imported(asset)
        case .failure(let error):
            status = .rejected(message: error.userMessage)
        }
    }
}
