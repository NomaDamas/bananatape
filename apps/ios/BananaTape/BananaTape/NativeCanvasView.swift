import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

enum CanvasTool: String, CaseIterable, Equatable, Identifiable {
    case pan
    case pen
    case box
    case arrow
    case memo
    case select

    var id: String { rawValue }
}

struct CanvasViewport: Equatable {
    let pan: EditorPoint
    let zoom: Double

    static let neutral = CanvasViewport(pan: EditorPoint(x: 0, y: 0), zoom: 1)
}

struct NativeCanvasGeometry {
    private static let defaultMemoSize = CGSize(width: 120, height: 72)

    static func aspectFit(imageSize: EditorSize, in availableSize: CGSize) -> CGSize {
        let imageWidth = max(imageSize.width, 1)
        let imageHeight = max(imageSize.height, 1)
        let availableWidth = max(Double(availableSize.width), 1)
        let availableHeight = max(Double(availableSize.height), 1)
        let scale = min(availableWidth / imageWidth, availableHeight / imageHeight)
        return CGSize(width: imageWidth * scale, height: imageHeight * scale)
    }

    static func normalized(_ location: CGPoint, in canvasSize: CGSize) -> EditorPoint {
        let width = max(canvasSize.width, 1)
        let height = max(canvasSize.height, 1)
        return EditorPoint(
            x: min(max(Double(location.x / width), 0), 1),
            y: min(max(Double(location.y / height), 0), 1)
        )
    }

    static func arrowhead(for points: [EditorPoint], in canvasSize: CGSize) -> [CGPoint] {
        guard points.count >= 2 else { return [] }
        let start = CGPoint(x: points[points.count - 2].x * canvasSize.width, y: points[points.count - 2].y * canvasSize.height)
        let end = CGPoint(x: points[points.count - 1].x * canvasSize.width, y: points[points.count - 1].y * canvasSize.height)
        let direction = atan2(end.y - start.y, end.x - start.x)
        let length: CGFloat = 14
        let spread: CGFloat = .pi / 6
        let left = CGPoint(x: end.x + cos(direction + .pi - spread) * length, y: end.y + sin(direction + .pi - spread) * length)
        let right = CGPoint(x: end.x + cos(direction + .pi + spread) * length, y: end.y + sin(direction + .pi + spread) * length)
        return [left, end, right]
    }

    static func visiblePaths(committed: [DrawingPath], draftPoints: [EditorPoint], draftTool: CanvasTool) -> [DrawingPath] {
        guard draftPoints.count >= 2, draftTool == .pen || draftTool == .arrow else { return committed }
        let draft = DrawingPath(
            id: "native-canvas-draft",
            tool: draftTool == .arrow ? .arrow : .pen,
            points: draftPoints,
            color: draftTool == .arrow ? "#0d99ff" : "#ffffff",
            strokeWidth: draftTool == .arrow ? 3 : 2
        )
        return committed + [draft]
    }

    static func memoOrigin(for memo: TextMemo, in canvasSize: CGSize) -> CGPoint {
        let size = memoSize(in: canvasSize)
        return CGPoint(
            x: min(max(CGFloat(memo.x) * canvasSize.width, 0), max(canvasSize.width - size.width, 0)),
            y: min(max(CGFloat(memo.y) * canvasSize.height, 0), max(canvasSize.height - size.height, 0))
        )
    }

    static func memoSize(in canvasSize: CGSize) -> CGSize {
        CGSize(
            width: min(defaultMemoSize.width, max(canvasSize.width, 1)),
            height: min(defaultMemoSize.height, max(canvasSize.height, 1))
        )
    }

    static func boundedMemoPosition(at point: EditorPoint, in canvasSize: CGSize) -> EditorPoint {
        let memo = TextMemo(id: "", x: point.x, y: point.y, text: "", color: "")
        let origin = memoOrigin(for: memo, in: canvasSize)
        return EditorPoint(
            x: Double(origin.x / max(canvasSize.width, 1)),
            y: Double(origin.y / max(canvasSize.height, 1))
        )
    }

    static func updatingMemo(id: String, text: String, in annotations: CanvasAnnotations) -> CanvasAnnotations {
        let memos = annotations.memos.map { memo in
            guard memo.id == id else { return memo }
            return TextMemo(id: memo.id, x: memo.x, y: memo.y, text: text, color: memo.color)
        }
        return CanvasAnnotations(paths: annotations.paths, boxes: annotations.boxes, memos: memos)
    }
}

struct NativeCanvasState: Equatable {
    let image: CanvasImage
    let tool: CanvasTool
    let viewport: CanvasViewport
    let focusedAnnotationId: String?
    let annotations: CanvasAnnotations

    init(image: CanvasImage, tool: CanvasTool = .pan, viewport: CanvasViewport = .neutral, focusedAnnotationId: String? = nil, annotations: CanvasAnnotations? = nil) {
        self.image = image
        self.tool = tool
        self.viewport = viewport
        self.focusedAnnotationId = focusedAnnotationId
        self.annotations = annotations ?? image.annotations
    }

    var serializedAnnotationCounts: [String: Int] {
        ["paths": annotations.paths.count, "boxes": annotations.boxes.count, "memos": annotations.memos.count]
    }

    func selecting(annotationId: String?) -> NativeCanvasState {
        NativeCanvasState(image: image, tool: .select, viewport: viewport, focusedAnnotationId: annotationId, annotations: annotations)
    }

    func panning(by delta: EditorPoint) -> NativeCanvasState {
        let nextPan = EditorPoint(x: viewport.pan.x + delta.x, y: viewport.pan.y + delta.y)
        return NativeCanvasState(image: image, tool: tool, viewport: CanvasViewport(pan: nextPan, zoom: viewport.zoom), focusedAnnotationId: focusedAnnotationId, annotations: annotations)
    }

    func zooming(to zoom: Double) -> NativeCanvasState {
        NativeCanvasState(image: image, tool: tool, viewport: CanvasViewport(pan: viewport.pan, zoom: zoom), focusedAnnotationId: focusedAnnotationId, annotations: annotations)
    }

    func adding(path: DrawingPath) -> NativeCanvasState {
        NativeCanvasState(image: image, tool: tool, viewport: viewport, focusedAnnotationId: path.id, annotations: CanvasAnnotations(paths: annotations.paths + [path], boxes: annotations.boxes, memos: annotations.memos))
    }

    func adding(box: BoundingBox) -> NativeCanvasState {
        NativeCanvasState(image: image, tool: tool, viewport: viewport, focusedAnnotationId: box.id, annotations: CanvasAnnotations(paths: annotations.paths, boxes: annotations.boxes + [box], memos: annotations.memos))
    }

    func adding(memo: TextMemo) -> NativeCanvasState {
        NativeCanvasState(image: image, tool: tool, viewport: viewport, focusedAnnotationId: memo.id, annotations: CanvasAnnotations(paths: annotations.paths, boxes: annotations.boxes, memos: annotations.memos + [memo]))
    }
}

struct NativeCanvasView: View {
    let state: NativeCanvasState
    var onAnnotationsChange: (CanvasAnnotations) -> Void = { _ in }
    var onViewportChange: (CanvasViewport) -> Void = { _ in }
    var onMoveFocus: (LineageNavigationDirection) -> Void = { _ in }
    @State private var draftPoints: [EditorPoint] = []
    @State private var gestureArbitration = CanvasGestureArbitrationState()
    @State private var focusedMemoID: String?

    var body: some View {
        GeometryReader { proxy in
            let availableSize = CGSize(width: max(proxy.size.width - 24, 1), height: max(proxy.size.height - 24, 1))
            let canvasSize = NativeCanvasGeometry.aspectFit(imageSize: state.image.size, in: availableSize)

            ZStack {
                CanvasGrid()
                imageShell(canvasSize: canvasSize)
                    .scaleEffect(state.viewport.zoom)
                    .offset(x: state.viewport.pan.x, y: state.viewport.pan.y)
                    .gesture(canvasDragGesture(canvasSize: canvasSize))
                    .simultaneousGesture(
                        MagnifyGesture()
                            .onChanged { _ in gestureArbitration.pinchChanged() }
                            .onEnded { value in
                                let zoom = min(max(state.viewport.zoom * value.magnification, 0.5), 4)
                                onViewportChange(CanvasViewport(pan: state.viewport.pan, zoom: zoom))
                                gestureArbitration.pinchEnded()
                            }
                    )
            }
        }
        .background(TossStyle.imageShell)
        .clipShape(RoundedRectangle(cornerRadius: 28))
        .overlay(RoundedRectangle(cornerRadius: 28).stroke(TossStyle.border))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("nativeCanvasSurface")
        .accessibilityLabel("Native canvas")
    }

    private func canvasDragGesture(canvasSize: CGSize) -> some Gesture {
        DragGesture(minimumDistance: state.tool == .memo ? 0 : 2)
            .onChanged { value in
                gestureArbitration.dragChanged()
                guard state.tool == .pen || state.tool == .arrow else { return }
                let point = NativeCanvasGeometry.normalized(value.location, in: canvasSize)
                if draftPoints.isEmpty {
                    draftPoints = [NativeCanvasGeometry.normalized(value.startLocation, in: canvasSize)]
                }
                draftPoints.append(point)
            }
            .onEnded { value in
                let start = NativeCanvasGeometry.normalized(value.startLocation, in: canvasSize)
                let end = NativeCanvasGeometry.normalized(value.location, in: canvasSize)
                switch gestureArbitration.dragEnded(translation: value.translation, tool: state.tool) {
                case .lineage(let direction):
                    onMoveFocus(direction)
                case .viewportPan:
                    onViewportChange(CanvasViewport(
                        pan: EditorPoint(x: state.viewport.pan.x + Double(value.translation.width), y: state.viewport.pan.y + Double(value.translation.height)),
                        zoom: state.viewport.zoom
                    ))
                case .annotation:
                    switch state.tool {
                    case .pen, .arrow:
                        let points = draftPoints.count > 1 ? draftPoints : [start, end]
                        let path = DrawingPath(id: UUID().uuidString, tool: state.tool == .arrow ? .arrow : .pen, points: points, color: state.tool == .arrow ? "#0d99ff" : "#ffffff", strokeWidth: state.tool == .arrow ? 3 : 2)
                        onAnnotationsChange(CanvasAnnotations(paths: state.annotations.paths + [path], boxes: state.annotations.boxes, memos: state.annotations.memos))
                    case .box:
                        let box = BoundingBox(id: UUID().uuidString, x: min(start.x, end.x), y: min(start.y, end.y), width: abs(end.x - start.x), height: abs(end.y - start.y), color: "#0d99ff", status: .pending)
                        onAnnotationsChange(CanvasAnnotations(paths: state.annotations.paths, boxes: state.annotations.boxes + [box], memos: state.annotations.memos))
                    case .memo:
                        let id = UUID().uuidString
                        let position = NativeCanvasGeometry.boundedMemoPosition(at: end, in: canvasSize)
                        let memo = TextMemo(id: id, x: position.x, y: position.y, text: "Memo", color: "#ffe066")
                        onAnnotationsChange(CanvasAnnotations(paths: state.annotations.paths, boxes: state.annotations.boxes, memos: state.annotations.memos + [memo]))
                        focusedMemoID = id
                    case .pan, .select:
                        break
                    }
                case .ignored:
                    break
                }
                draftPoints = []
            }
    }

    private func imageShell(canvasSize: CGSize) -> some View {
        ZStack(alignment: .topLeading) {
            RoundedRectangle(cornerRadius: 28)
                .fill(TossStyle.imageShell)
                .overlay(RoundedRectangle(cornerRadius: 28).stroke(TossStyle.blue.opacity(0.75), lineWidth: 2))
                .accessibilityElement()
                .accessibilityIdentifier("focusedImage-\(state.image.id)")
                .accessibilityLabel("Focused image \(state.image.id)")

            decodedImage
                .clipShape(RoundedRectangle(cornerRadius: 28))

            Canvas { context, size in
                drawAnnotations(context: context, size: size)
            }
            .accessibilityIdentifier("nativeAnnotationCanvas")

            ForEach(state.annotations.memos, id: \.id) { memo in
                CanvasMemoEditor(
                    memo: memo,
                    annotations: state.annotations,
                    canvasSize: canvasSize,
                    shouldFocus: focusedMemoID == memo.id || state.focusedAnnotationId == memo.id,
                    onAnnotationsChange: onAnnotationsChange
                )
            }

            if state.image.status == .pending {
                canvasStatus("Generating image...")
            } else if state.image.url.hasPrefix("mock://") || state.image.url.hasPrefix("fixture://") {
                canvasStatus("Ready for your prompt")
            }
        }
        .frame(width: canvasSize.width, height: canvasSize.height)
        .shadow(color: .black.opacity(0.45), radius: 30, y: 20)
    }

    private func canvasStatus(_ text: String) -> some View {
        Text(text)
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(TossStyle.secondaryText)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    private var decodedImage: some View {
        #if canImport(UIKit)
        if let uiImage = state.image.url.dataImage {
            Image(uiImage: uiImage)
                .resizable()
                .scaledToFit()
        }
        #endif
    }

    private func drawAnnotations(context: GraphicsContext, size: CGSize) {
        for path in NativeCanvasGeometry.visiblePaths(committed: state.annotations.paths, draftPoints: draftPoints, draftTool: state.tool) {
            var swiftPath = Path()
            for (index, point) in path.points.enumerated() {
                let cgPoint = CGPoint(x: point.x * size.width, y: point.y * size.height)
                index == 0 ? swiftPath.move(to: cgPoint) : swiftPath.addLine(to: cgPoint)
            }
            context.stroke(swiftPath, with: .color(path.tool == .arrow ? TossStyle.blue : TossStyle.primaryText), lineWidth: path.strokeWidth)
            if path.tool == .arrow {
                let arrowhead = NativeCanvasGeometry.arrowhead(for: path.points, in: size)
                guard let first = arrowhead.first else { continue }
                var arrowheadPath = Path()
                arrowheadPath.move(to: first)
                for point in arrowhead.dropFirst() {
                    arrowheadPath.addLine(to: point)
                }
                context.stroke(arrowheadPath, with: .color(TossStyle.blue), lineWidth: path.strokeWidth)
            }
        }
        for box in state.annotations.boxes {
            let rect = CGRect(x: box.x * size.width, y: box.y * size.height, width: box.width * size.width, height: box.height * size.height)
            context.stroke(Path(rect), with: .color(TossStyle.blue), lineWidth: 2)
        }
    }
}

private struct CanvasMemoEditor: View {
    let memo: TextMemo
    let annotations: CanvasAnnotations
    let canvasSize: CGSize
    let shouldFocus: Bool
    let onAnnotationsChange: (CanvasAnnotations) -> Void
    @FocusState private var isEditing: Bool

    var body: some View {
        let origin = NativeCanvasGeometry.memoOrigin(for: memo, in: canvasSize)
        let memoSize = NativeCanvasGeometry.memoSize(in: canvasSize)
        let text = Binding<String>(
            get: { annotations.memos.first(where: { $0.id == memo.id })?.text ?? memo.text },
            set: { onAnnotationsChange(NativeCanvasGeometry.updatingMemo(id: memo.id, text: $0, in: annotations)) }
        )

        TextField("Memo", text: text, axis: .vertical)
            .lineLimit(3)
            .font(.caption.weight(.semibold))
            .foregroundStyle(Color.black.opacity(0.78))
            .padding(10)
            .frame(width: memoSize.width, height: memoSize.height, alignment: .topLeading)
            .background(Color(red: 1.0, green: 0.88, blue: 0.40))
            .overlay(memoBorder)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .position(x: origin.x + memoSize.width / 2, y: origin.y + memoSize.height / 2)
            .focused($isEditing)
            .onAppear { isEditing = shouldFocus }
            .onChange(of: shouldFocus) { _, focused in isEditing = focused }
            .accessibilityIdentifier("nativeMemo-\(memo.id)")
    }

    private var memoBorder: some View {
        RoundedRectangle(cornerRadius: 12)
            .stroke(isEditing || shouldFocus ? TossStyle.blue : Color.black.opacity(0.12), lineWidth: isEditing || shouldFocus ? 2 : 1)
    }
}

private struct CanvasGrid: View {
    var body: some View {
        Canvas { context, size in
            let spacing: CGFloat = 18
            var path = Path()
            var x: CGFloat = 0
            while x <= size.width {
                path.move(to: CGPoint(x: x, y: 0))
                path.addLine(to: CGPoint(x: x, y: size.height))
                x += spacing
            }
            var y: CGFloat = 0
            while y <= size.height {
                path.move(to: CGPoint(x: 0, y: y))
                path.addLine(to: CGPoint(x: size.width, y: y))
                y += spacing
            }
            context.stroke(path, with: .color(Color.white.opacity(0.035)), lineWidth: 0.7)
        }
    }
}

struct HistoryBrowserView: View {
    @Binding var state: NativeHistoryBrowserState
    var onExport: (HistoryEntry) -> Void = { _ in }
    var onDelete: (String) -> Void = { _ in }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("History")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(TossStyle.primaryText)
                    Text("Branch-aware · tap to load")
                        .font(.caption2.weight(.bold))
                        .tracking(0.8)
                        .foregroundStyle(TossStyle.mutedText)
                }
                Spacer()
                Text(state.historyCountLabel)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(TossStyle.secondaryText)
            }

            VStack(spacing: 8) {
                ForEach(state.rows) { row in
                    historyRow(row)
                }
            }

            if let preview = state.exportPreview {
                exportPreview(preview)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 10)
        .padding(.bottom, 18)
        .background(TossStyle.panel)
        .accessibilityIdentifier("historyBrowserPanel")
    }

    private func historyRow(_ row: HistoryBrowserRow) -> some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 12)
                .fill(TossStyle.imageShell)
                .overlay(Image(systemName: "photo").font(.caption).foregroundStyle(TossStyle.mutedText))
                .frame(width: 50, height: 50)

            VStack(alignment: .leading, spacing: 7) {
                HStack(spacing: 5) {
                    badge(row.versionLabel, foreground: TossStyle.primaryText, background: TossStyle.selectedChip)
                    badge(row.branchLabel, foreground: row.depth == 0 ? TossStyle.rootBadgeText : TossStyle.editBadgeText, background: row.depth == 0 ? TossStyle.rootBadge : TossStyle.editBadge)
                    badge(providerLabel(row.entry.provider), foreground: TossStyle.secondaryText, background: TossStyle.workspace)
                }
                Text(row.entry.prompt)
                    .font(.footnote.weight(.medium))
                    .lineLimit(2)
                    .foregroundStyle(TossStyle.primaryText)
                Text(relativeTime(for: row.entry))
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(TossStyle.mutedText)
            }

            Spacer(minLength: 8)

            HStack(spacing: 6) {
                iconButton("square.and.arrow.up", foreground: TossStyle.primaryText, label: "Export history item", accessibilityIdentifier: "exportHistoryEntry-\(row.id)") {
                    onExport(row.entry)
                }
                iconButton("trash", foreground: TossStyle.destructive, label: "Delete history item", accessibilityIdentifier: "deleteHistoryEntry-\(row.id)") {
                    onDelete(row.id)
                }
            }
            .layoutPriority(1)
        }
        .padding(12)
        .padding(.leading, CGFloat(row.depth) * 12)
        .background(row.isSelected ? TossStyle.selectedGlow : TossStyle.panelAlt, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(row.isSelected ? TossStyle.blue : TossStyle.border))
        .shadow(color: row.isSelected ? TossStyle.blue.opacity(0.18) : .clear, radius: 14)
        .contentShape(Rectangle())
        .onTapGesture {
            state = state.selecting(entryId: row.id)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(row.branchLabel) history item, \(row.entry.prompt)")
    }

    private func exportPreview(_ preview: ExportPreviewMetadata) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Export preview")
                .font(.caption.weight(.bold))
                .foregroundStyle(TossStyle.mutedText)
            Text(preview.title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(TossStyle.primaryText)
            Text(preview.assetPath)
                .font(.caption2)
                .foregroundStyle(TossStyle.secondaryText)
            Text(preview.annotationsMessage)
                .font(.caption2)
                .foregroundStyle(TossStyle.secondaryText)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(TossStyle.workspace, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(TossStyle.border))
        .accessibilityIdentifier("exportPreviewPanel")
    }

    private func badge(_ text: String, foreground: Color, background: Color) -> some View {
        Text(text)
            .font(.caption2.weight(.bold))
            .foregroundStyle(foreground)
            .padding(.horizontal, 7)
            .padding(.vertical, 4)
            .background(background, in: Capsule())
    }

    private func iconButton(_ systemName: String, foreground: Color, label: String, accessibilityIdentifier: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.caption.weight(.semibold))
                .foregroundStyle(foreground)
                .frame(width: 48, height: 48)
                .background(TossStyle.workspace, in: Circle())
                .overlay(Circle().stroke(TossStyle.border))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityIdentifier(accessibilityIdentifier)
    }

    private func providerLabel(_ provider: EditorProvider) -> String {
        switch provider {
        case .mock: "Mocked"
        case .openAI: "OpenAI"
        case .codex: "Codex"
        }
    }

    private func relativeTime(for entry: HistoryEntry) -> String {
        if entry.timestamp <= 1 { return "2h ago" }
        if entry.timestamp == 2 { return "1h ago" }
        return "40m ago"
    }
}

#if canImport(UIKit)
private extension String {
    var dataImage: UIImage? {
        let marker = "base64,"
        if hasPrefix("data:image"), let range = range(of: marker) {
            let base64 = String(self[range.upperBound...])
            guard let data = Data(base64Encoded: base64) else { return nil }
            return UIImage(data: data)
        }
        guard let url = URL(string: self), url.isFileURL else { return nil }
        return UIImage(contentsOfFile: url.path)
    }
}
#endif

#Preview {
    NativeCanvasView(state: NativeCanvasState(image: CanvasImage.fixtureCanvasImage))
}

extension CanvasImage {
    static let emptyCanvasImage = CanvasImage(
        id: "empty-canvas",
        url: "",
        assetId: nil,
        size: EditorSize(width: 320, height: 320),
        position: EditorPoint(x: 0, y: 0),
        parentId: nil,
        generationIndex: 0,
        generationBatchId: nil,
        batchIndex: nil,
        prompt: "",
        provider: .mock,
        mode: .generate,
        createdAt: 0,
        annotations: .empty,
        hasMagicLayerFields: false,
        status: .ready,
        userErrorMessage: nil
    )

    static let fixtureCanvasImage = CanvasImage(
        id: "fixture-image",
        url: "fixture://banana.png",
        assetId: "asset-fixture",
        size: EditorSize(width: 320, height: 240),
        position: EditorPoint(x: 0, y: 0),
        parentId: nil,
        generationIndex: 0,
        generationBatchId: nil,
        batchIndex: nil,
        prompt: "Fixture banana image",
        provider: .openAI,
        mode: .generate,
        createdAt: 0,
        annotations: .empty,
        hasMagicLayerFields: false,
        status: .ready,
        userErrorMessage: nil
    )
}
