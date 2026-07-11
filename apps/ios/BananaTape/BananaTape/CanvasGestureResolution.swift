import CoreGraphics

enum CanvasDragResolution: Equatable {
    case lineage(LineageNavigationDirection)
    case viewportPan
    case annotation
    case ignored
}

enum LineageSwipeResolver {
    static let minimumTranslation: CGFloat = 56
    static let axisDominance: CGFloat = 1.25

    static func resolve(translation: CGSize, tool: CanvasTool) -> CanvasDragResolution {
        if tool == .pan { return .viewportPan }
        guard tool == .select else { return .annotation }
        let horizontal = abs(translation.width)
        let vertical = abs(translation.height)

        if horizontal >= minimumTranslation, horizontal >= vertical * axisDominance {
            return .lineage(translation.width < 0 ? .right : .left)
        }
        if vertical >= minimumTranslation, vertical >= horizontal * axisDominance {
            return .lineage(translation.height < 0 ? .down : .up)
        }
        return .ignored
    }
}

struct CanvasGestureArbitrationState: Equatable {
    private(set) var isDragActive = false
    private(set) var isPinchActive = false
    private(set) var suppressLineageForCurrentDrag = false

    mutating func dragChanged() {
        guard !isDragActive else { return }
        isDragActive = true
        suppressLineageForCurrentDrag = isPinchActive
    }

    mutating func pinchChanged() {
        isPinchActive = true
        if isDragActive {
            suppressLineageForCurrentDrag = true
        }
    }

    mutating func pinchEnded() {
        isPinchActive = false
        if !isDragActive {
            suppressLineageForCurrentDrag = false
        }
    }

    mutating func dragEnded(translation: CGSize, tool: CanvasTool) -> CanvasDragResolution {
        let suppressLineage = suppressLineageForCurrentDrag || isPinchActive
        isDragActive = false
        suppressLineageForCurrentDrag = false
        if suppressLineage, tool == .select { return .ignored }
        return LineageSwipeResolver.resolve(translation: translation, tool: tool)
    }
}
