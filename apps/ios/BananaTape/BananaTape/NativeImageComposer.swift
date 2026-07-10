import Foundation
import UIKit

struct NativeImageMetadata: Equatable {
    let width: Int
    let height: Int
    let byteCount: Int
    let mimeType: String
}

struct NativeComposedImage: Equatable {
    let fileURL: URL
    let metadata: NativeImageMetadata
}

struct NativeExportPreview: Equatable {
    let source: NativeImageMetadata
    let annotated: NativeImageMetadata
    let mask: NativeImageMetadata
    let canvasSize: EditorSize
}

struct NativeImageCompositionResult: Equatable {
    let original: NativeImageMetadata
    let annotated: NativeComposedImage
    let mask: NativeComposedImage
    let exportPreview: NativeExportPreview
}

enum NativeImageCompositionError: Error, Equatable {
    case unreadableSource
    case imageTooLarge(maxPixels: Int, actualPixels: Int)
    case renderFailed

    var userMessage: String {
        switch self {
        case .unreadableSource, .renderFailed:
            return "This image could not be prepared for export."
        case .imageTooLarge:
            return "This image is too large to prepare on this device."
        }
    }
}

struct NativeImageCompositionRequest: Equatable {
    let sourceURL: URL
    let annotations: CanvasAnnotations
    let outputDirectory: URL
}

struct NativeImageComposer {
    let maxPixelCount: Int

    init(maxPixelCount: Int = 16_777_216) {
        self.maxPixelCount = maxPixelCount
    }

    func compose(_ request: NativeImageCompositionRequest) -> Result<NativeImageCompositionResult, NativeImageCompositionError> {
        guard let sourceData = try? Data(contentsOf: request.sourceURL),
              let image = UIImage(contentsOfFile: request.sourceURL.path) ?? UIImage(data: sourceData) else {
            return .failure(.unreadableSource)
        }
        let size = pixelSize(for: image)
        let pixels = Int(size.width * size.height)
        guard pixels <= maxPixelCount else {
            return .failure(.imageTooLarge(maxPixels: maxPixelCount, actualPixels: pixels))
        }
        guard let annotatedData = renderAnnotated(image: image, size: size, annotations: request.annotations), let maskData = renderMask(size: size, annotations: request.annotations) else {
            return .failure(.renderFailed)
        }
        return writeResult(request: request, sourceData: sourceData, size: size, annotatedData: annotatedData, maskData: maskData)
    }

    private func writeResult(request: NativeImageCompositionRequest, sourceData: Data, size: CGSize, annotatedData: Data, maskData: Data) -> Result<NativeImageCompositionResult, NativeImageCompositionError> {
        do {
            try FileManager.default.createDirectory(at: request.outputDirectory, withIntermediateDirectories: true)
            let annotatedURL = request.outputDirectory.appendingPathComponent("annotated.png")
            let maskURL = request.outputDirectory.appendingPathComponent("mask.png")
            try annotatedData.write(to: annotatedURL, options: .atomic)
            try maskData.write(to: maskURL, options: .atomic)
            let width = Int(size.width)
            let height = Int(size.height)
            let original = NativeImageMetadata(width: width, height: height, byteCount: sourceData.count, mimeType: mimeType(for: request.sourceURL))
            let annotated = NativeImageMetadata(width: width, height: height, byteCount: annotatedData.count, mimeType: "image/png")
            let mask = NativeImageMetadata(width: width, height: height, byteCount: maskData.count, mimeType: "image/png")
            return .success(NativeImageCompositionResult(original: original, annotated: NativeComposedImage(fileURL: annotatedURL, metadata: annotated), mask: NativeComposedImage(fileURL: maskURL, metadata: mask), exportPreview: NativeExportPreview(source: original, annotated: annotated, mask: mask, canvasSize: EditorSize(width: Double(width), height: Double(height)))))
        } catch {
            return .failure(.renderFailed)
        }
    }

    private func renderAnnotated(image: UIImage, size: CGSize, annotations: CanvasAnnotations) -> Data? {
        UIGraphicsImageRenderer(size: size, format: rendererFormat()).pngData { context in
            image.draw(in: CGRect(origin: .zero, size: size))
            drawAnnotations(annotations, size: size, context: context.cgContext, mode: .annotated)
        }
    }

    private func renderMask(size: CGSize, annotations: CanvasAnnotations) -> Data? {
        UIGraphicsImageRenderer(size: size, format: rendererFormat()).pngData { context in
            UIColor.white.setFill()
            context.fill(CGRect(origin: .zero, size: size))
            context.cgContext.setBlendMode(.clear)
            drawAnnotations(annotations, size: size, context: context.cgContext, mode: .mask)
            context.cgContext.setBlendMode(.normal)
        }
    }

    private enum RenderMode {
        case annotated
        case mask
    }

    private func drawAnnotations(_ annotations: CanvasAnnotations, size: CGSize, context: CGContext, mode: RenderMode) {
        annotations.paths.forEach { draw($0, size: size, context: context) }
        annotations.boxes.forEach { draw($0, size: size, context: context, mode: mode) }
        if mode == .annotated { annotations.memos.forEach { draw($0, size: size) } }
    }

    private func draw(_ path: DrawingPath, size: CGSize, context: CGContext) {
        guard let first = path.points.first else { return }
        let cgPath = CGMutablePath()
        cgPath.move(to: canvasPoint(first, size: size))
        path.points.dropFirst().forEach { cgPath.addLine(to: canvasPoint($0, size: size)) }
        context.setStrokeColor(UIColor(hex: path.color).cgColor)
        context.setLineWidth(max(path.strokeWidth, 1))
        context.setLineCap(.round)
        context.setLineJoin(.round)
        context.addPath(cgPath)
        context.strokePath()
        if path.tool == .arrow, let last = path.points.last, path.points.count > 1 {
            drawArrowHead(from: path.points[path.points.count - 2], to: last, size: size, color: UIColor(hex: path.color), context: context)
        }
    }

    private func draw(_ box: BoundingBox, size: CGSize, context: CGContext, mode: RenderMode) {
        let rect = CGRect(x: box.x * size.width, y: box.y * size.height, width: box.width * size.width, height: box.height * size.height)
        if mode == .mask {
            context.fill(rect)
        } else {
            context.setStrokeColor(UIColor(hex: box.color).cgColor)
            context.setLineWidth(3)
            context.stroke(rect)
        }
    }

    private func draw(_ memo: TextMemo, size: CGSize) {
        UIColor(hex: memo.color).setFill()
        UIBezierPath(roundedRect: CGRect(x: memo.x * size.width, y: memo.y * size.height, width: 96, height: 48), cornerRadius: 8).fill()
    }

    private func drawArrowHead(from start: EditorPoint, to end: EditorPoint, size: CGSize, color: UIColor, context: CGContext) {
        let startPoint = canvasPoint(start, size: size)
        let endPoint = canvasPoint(end, size: size)
        let angle = atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x)
        let length = CGFloat(14)
        let spread = CGFloat.pi / 7
        let head = CGMutablePath()
        head.move(to: endPoint)
        head.addLine(to: CGPoint(x: endPoint.x - length * cos(angle - spread), y: endPoint.y - length * sin(angle - spread)))
        head.move(to: endPoint)
        head.addLine(to: CGPoint(x: endPoint.x - length * cos(angle + spread), y: endPoint.y - length * sin(angle + spread)))
        context.setStrokeColor(color.cgColor)
        context.setLineWidth(3)
        context.addPath(head)
        context.strokePath()
    }

    private func pixelSize(for image: UIImage) -> CGSize {
        if let cgImage = image.cgImage {
            return CGSize(width: cgImage.width, height: cgImage.height)
        }
        return CGSize(width: image.size.width * image.scale, height: image.size.height * image.scale)
    }

    private func canvasPoint(_ point: EditorPoint, size: CGSize) -> CGPoint {
        CGPoint(x: point.x * size.width, y: point.y * size.height)
    }

    private func rendererFormat() -> UIGraphicsImageRendererFormat {
        let format = UIGraphicsImageRendererFormat.default()
        format.opaque = false
        format.scale = 1
        return format
    }

    private func mimeType(for url: URL) -> String {
        let ext = url.pathExtension.lowercased()
        return ext == "jpg" || ext == "jpeg" ? "image/jpeg" : "image/png"
    }
}

private extension UIColor {
    convenience init(hex: String) {
        let trimmed = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        let value = UInt32(trimmed, radix: 16) ?? 0x0D99FF
        self.init(red: CGFloat((value >> 16) & 0xFF) / 255, green: CGFloat((value >> 8) & 0xFF) / 255, blue: CGFloat(value & 0xFF) / 255, alpha: 1)
    }
}
