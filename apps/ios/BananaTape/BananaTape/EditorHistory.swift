import Foundation

struct HistoryEntry: Equatable {
    let id: String
    let mode: EditorMode
    let provider: EditorProvider
    let prompt: String
    let assetId: String
    let assetPath: String
    let parentId: String?
    let generationBatchId: String?
    let batchIndex: Int?
    let createdAt: String
    let timestamp: Double

    init(id: String, mode: EditorMode, provider: EditorProvider, prompt: String, assetId: String, assetPath: String, parentId: String?, generationBatchId: String? = nil, batchIndex: Int? = nil, createdAt: String, timestamp: Double) {
        self.id = id
        self.mode = mode
        self.provider = provider
        self.prompt = prompt
        self.assetId = assetId
        self.assetPath = assetPath
        self.parentId = parentId
        self.generationBatchId = generationBatchId
        self.batchIndex = batchIndex
        self.createdAt = createdAt
        self.timestamp = timestamp
    }
}

struct HistoryTreeNode: Equatable {
    let entry: HistoryEntry
    let children: [HistoryTreeNode]
}

struct HistoryBrowserRow: Equatable, Identifiable {
    let id: String
    let entry: HistoryEntry
    let depth: Int
    let branchLabel: String
    let versionLabel: String
    let isSelected: Bool
}

struct ExportPreviewMetadata: Equatable {
    let entryId: String
    let title: String
    let assetPath: String
    let providerLabel: String
    let annotationsMessage: String
    let magicLayerMessage: String?
}

private enum HistoryLineageOrdering {
    static func sorted(_ entries: [HistoryEntry]) -> [HistoryEntry] {
        let batches = Dictionary(grouping: entries) { $0.generationBatchId ?? $0.id }
        return batches.values
            .map { $0.sorted(by: itemOrder) }
            .sorted(by: batchOrder)
            .flatMap { $0 }
    }

    private static func batchOrder(_ lhs: [HistoryEntry], _ rhs: [HistoryEntry]) -> Bool {
        guard let lhsAnchor = lhs.first, let rhsAnchor = rhs.first else { return lhs.count < rhs.count }
        if lhsAnchor.timestamp != rhsAnchor.timestamp { return lhsAnchor.timestamp < rhsAnchor.timestamp }
        return lhsAnchor.id < rhsAnchor.id
    }

    private static func itemOrder(_ lhs: HistoryEntry, _ rhs: HistoryEntry) -> Bool {
        let lhsIndex = lhs.batchIndex ?? 0
        let rhsIndex = rhs.batchIndex ?? 0
        if lhsIndex != rhsIndex { return lhsIndex < rhsIndex }
        if lhs.timestamp != rhs.timestamp { return lhs.timestamp < rhs.timestamp }
        return lhs.id < rhs.id
    }
}

struct NativeHistoryBrowserState: Equatable {
    let entries: [HistoryEntry]
    let selectedEntryId: String?

    init(entries: [HistoryEntry], selectedEntryId: String? = nil) {
        let sortedEntries = HistoryLineageOrdering.sorted(entries)
        self.entries = sortedEntries
        self.selectedEntryId = selectedEntryId.flatMap { selected in
            sortedEntries.contains(where: { $0.id == selected }) ? selected : nil
        } ?? sortedEntries.first?.id
    }

    var rows: [HistoryBrowserRow] {
        let roots = tree(from: entries)
        var flattened: [HistoryBrowserRow] = []
        for root in roots {
            append(node: root, depth: 0, into: &flattened)
        }
        return flattened
    }

    var selectedEntry: HistoryEntry? {
        entries.first { $0.id == selectedEntryId }
    }

    var exportPreview: ExportPreviewMetadata? {
        guard let entry = selectedEntry else { return nil }
        return ExportPreviewMetadata(
            entryId: entry.id,
            title: entry.mode == .generate ? "Root generation" : "Edit child",
            assetPath: entry.assetPath,
            providerLabel: entry.provider == .codex ? "codex" : "OpenAI",
            annotationsMessage: "Annotations are excluded from exported PNGs.",
            magicLayerMessage: nil
        )
    }

    var historyCountLabel: String {
        "\(entries.count) \(entries.count == 1 ? "version" : "versions")"
    }

    func selecting(entryId: String) -> NativeHistoryBrowserState {
        guard entries.contains(where: { $0.id == entryId }) else { return self }
        return NativeHistoryBrowserState(entries: entries, selectedEntryId: entryId)
    }

    func deleting(entryId: String) -> NativeHistoryBrowserState {
        let deleted = entries.first { $0.id == entryId }
        var deletedIds: Set<String> = [entryId]
        while true {
            let descendants = entries.filter { entry in
                entry.parentId.map(deletedIds.contains) == true && !deletedIds.contains(entry.id)
            }
            guard !descendants.isEmpty else { break }
            deletedIds.formUnion(descendants.map(\.id))
        }
        let remaining = entries.filter { !deletedIds.contains($0.id) }
        let selectionWasDeleted = selectedEntryId.map(deletedIds.contains) == true
        let nextSelected = selectionWasDeleted ? fallbackSelection(afterDeleting: deleted, remaining: remaining) : selectedEntryId
        return NativeHistoryBrowserState(entries: remaining, selectedEntryId: nextSelected)
    }

    func reconcilingLineage() -> NativeHistoryBrowserState {
        var remaining = entries
        while true {
            let ids = Set(remaining.map(\.id))
            let reconciled = remaining.filter { entry in
                entry.parentId == nil || entry.parentId.map(ids.contains) == true
            }
            guard reconciled.count != remaining.count else { break }
            remaining = reconciled
        }
        return NativeHistoryBrowserState(entries: remaining, selectedEntryId: selectedEntryId)
    }

    private func fallbackSelection(afterDeleting deleted: HistoryEntry?, remaining: [HistoryEntry]) -> String? {
        if let parentId = deleted?.parentId, remaining.contains(where: { $0.id == parentId }) { return parentId }
        return remaining.first?.id
    }

    private func tree(from entries: [HistoryEntry]) -> [HistoryTreeNode] {
        let grouped = Dictionary(grouping: entries) { $0.parentId }
        func children(for parentId: String?) -> [HistoryTreeNode] {
            HistoryLineageOrdering.sorted(grouped[parentId] ?? [])
                .map { HistoryTreeNode(entry: $0, children: children(for: $0.id)) }
        }
        return children(for: nil)
    }

    private func append(node: HistoryTreeNode, depth: Int, into rows: inout [HistoryBrowserRow]) {
        rows.append(HistoryBrowserRow(
            id: node.entry.id,
            entry: node.entry,
            depth: depth,
            branchLabel: depth == 0 ? "Root" : "Edit",
            versionLabel: "v\(rows.count + 1)",
            isSelected: node.entry.id == selectedEntryId
        ))
        for child in node.children {
            append(node: child, depth: depth + 1, into: &rows)
        }
    }
}

struct ProjectHistoryDocument: Equatable {
    let rawJSON: String
    let revision: Int
    let entries: [HistoryEntry]

    func toJSONString() -> String { rawJSON }

    static func parse(_ json: String) throws -> ProjectHistoryDocument {
        guard let data = json.data(using: .utf8), let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw EditorJSONError.invalidJSON
        }
        guard let revision = object["revision"] as? Int else { throw EditorJSONError.missingField("revision") }
        let records = object["entries"] as? [[String: Any]] ?? []
        return ProjectHistoryDocument(rawJSON: json, revision: revision, entries: records.compactMap(parseEntry))
    }

    func buildTree() -> [HistoryTreeNode] {
        let grouped = Dictionary(grouping: entries) { $0.parentId }
        func sortedChildren(for parentId: String?) -> [HistoryTreeNode] {
            HistoryLineageOrdering.sorted(grouped[parentId] ?? [])
                .map { HistoryTreeNode(entry: $0, children: sortedChildren(for: $0.id)) }
        }
        return sortedChildren(for: nil)
    }

    private static func parseEntry(_ record: [String: Any]) -> HistoryEntry? {
        guard
            let id = record["id"] as? String,
            let modeName = record["type"] as? String,
            let mode = EditorMode(rawValue: modeName),
            let providerName = record["provider"] as? String,
            let assetId = record["assetId"] as? String,
            let assetPath = record["assetPath"] as? String,
            let createdAt = record["createdAt"] as? String
        else { return nil }
        return HistoryEntry(
            id: id,
            mode: mode,
            provider: EditorProvider(rawValue: providerName) ?? .openAI,
            prompt: record["prompt"] as? String ?? "",
            assetId: assetId,
            assetPath: assetPath,
            parentId: record["parentId"] as? String,
            generationBatchId: record["generationBatchId"] as? String,
            batchIndex: optionalInt(record["batchIndex"]),
            createdAt: createdAt,
            timestamp: number(record["timestamp"])
        )
    }

    private static func number(_ value: Any?) -> Double {
        if let value = value as? Double { return value }
        if let value = value as? Int { return Double(value) }
        return 0
    }

    private static func optionalInt(_ value: Any?) -> Int? {
        if let value = value as? Int { return value }
        if let value = value as? Double { return Int(exactly: value) }
        return nil
    }
}

struct AnnotationHistoryStack: Equatable {
    private(set) var current: CanvasAnnotations
    private var past: [CanvasAnnotations]
    private var future: [CanvasAnnotations]

    init(current: CanvasAnnotations = .empty) {
        self.current = current
        self.past = []
        self.future = []
    }

    var canUndo: Bool { !past.isEmpty }
    var canRedo: Bool { !future.isEmpty }

    mutating func apply(_ next: CanvasAnnotations) {
        guard next != current else { return }
        past.append(current)
        current = next
        future = []
    }

    mutating func undo() {
        guard let previous = past.popLast() else { return }
        future.append(current)
        current = previous
    }

    mutating func redo() {
        guard let next = future.popLast() else { return }
        past.append(current)
        current = next
    }
}
