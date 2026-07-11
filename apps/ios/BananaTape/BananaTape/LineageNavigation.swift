import Foundation

enum LineageNavigationDirection: Equatable {
    case left
    case right
    case up
    case down
}

struct LineageNavigationAvailability: Equatable {
    let canMoveLeft: Bool
    let canMoveRight: Bool
    let canMoveUp: Bool
    let canMoveDown: Bool
}

enum LineageNavigation {
    static func availability(images: [CanvasImage], focusedImageID: String?) -> LineageNavigationAvailability {
        LineageNavigationAvailability(
            canMoveLeft: target(.left, images: images, focusedImageID: focusedImageID) != nil,
            canMoveRight: target(.right, images: images, focusedImageID: focusedImageID) != nil,
            canMoveUp: target(.up, images: images, focusedImageID: focusedImageID) != nil,
            canMoveDown: target(.down, images: images, focusedImageID: focusedImageID) != nil
        )
    }

    static func target(_ direction: LineageNavigationDirection, images: [CanvasImage], focusedImageID: String?) -> CanvasImage? {
        let readyImages = images.filter { $0.status == .ready }
        guard let focusedImage = readyImages.first(where: { $0.id == focusedImageID }) else { return nil }
        switch direction {
        case .left, .right:
            let batchID = focusedImage.generationBatchId ?? focusedImage.id
            let siblings = readyImages.filter {
                ($0.generationBatchId ?? $0.id) == batchID && $0.parentId == focusedImage.parentId
            }.sorted(by: itemOrder)
            guard let index = siblings.firstIndex(where: { $0.id == focusedImage.id }) else { return nil }
            let targetIndex = direction == .left ? index - 1 : index + 1
            return siblings.indices.contains(targetIndex) ? siblings[targetIndex] : nil
        case .up:
            guard let parentID = focusedImage.parentId else { return nil }
            return readyImages.first { $0.id == parentID }
        case .down:
            return ordered(readyImages.filter { $0.parentId == focusedImage.id }).first
        }
    }

    private static func ordered(_ images: [CanvasImage]) -> [CanvasImage] {
        let batches = Dictionary(grouping: images) { $0.generationBatchId ?? $0.id }
        return batches.values
            .map { $0.sorted(by: itemOrder) }
            .sorted { lhs, rhs in
                guard let lhsAnchor = lhs.first, let rhsAnchor = rhs.first else { return lhs.count < rhs.count }
                if lhsAnchor.createdAt != rhsAnchor.createdAt { return lhsAnchor.createdAt < rhsAnchor.createdAt }
                return lhsAnchor.id < rhsAnchor.id
            }
            .flatMap { $0 }
    }

    private static func itemOrder(_ lhs: CanvasImage, _ rhs: CanvasImage) -> Bool {
        let lhsIndex = lhs.batchIndex ?? 0
        let rhsIndex = rhs.batchIndex ?? 0
        if lhsIndex != rhsIndex { return lhsIndex < rhsIndex }
        if lhs.createdAt != rhs.createdAt { return lhs.createdAt < rhs.createdAt }
        return lhs.id < rhs.id
    }
}
