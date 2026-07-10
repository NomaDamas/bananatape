import Foundation

struct ProjectListItem: Identifiable, Equatable {
    let id: String
    let name: String
}

struct ProjectPickerState: Equatable {
    var projects: [ProjectListItem]
    var openedProject: MobileProjectRecord?
    var lastError: AdapterError?

    static let empty = ProjectPickerState(projects: [], openedProject: nil, lastError: nil)

    var isEmpty: Bool {
        projects.isEmpty
    }
}

final class ProjectPickerModel: ObservableObject {
    @Published private(set) var state: ProjectPickerState
    private let storage: ProjectStorage
    private let now: () -> Date

    init(storage: ProjectStorage = LocalProjectStorage(), now: @escaping () -> Date = Date.init) {
        self.storage = storage
        self.now = now
        state = ProjectPickerState.empty
        refresh()
    }

    func refresh() {
        state.projects = storage.list().map { ProjectListItem(id: $0.id, name: $0.name) }
    }

    func createProject(name: String) {
        let cleanName = sanitizedName(name)
        let id = slug(for: cleanName)
        let timestamp = isoString(from: now())
        let project = MobileProjectRecord(
            id: id,
            name: cleanName,
            manifestJSON: manifestJSON(id: id, name: cleanName, timestamp: timestamp) ?? "",
            historyJSON: emptyHistoryJSON,
            canvasJSON: nil
        )
        apply(storage.create(project))
        refresh()
    }

    func openProject(id: String) {
        apply(storage.read(id: id))
    }

    func deleteProject(id: String) {
        switch storage.delete(id: id) {
        case .success:
            state.lastError = nil
            refresh()
        case .failure(let error):
            state.lastError = error
        }
    }

    func renameProject(id: String, name: String) {
        apply(storage.renameProject(id: id, name: sanitizedName(name)))
        refresh()
    }

    private func apply(_ result: Result<MobileProjectRecord, AdapterError>) {
        switch result {
        case .success(let project):
            state.openedProject = project
            state.lastError = nil
        case .failure(let error):
            state.lastError = error
        }
    }

    private func sanitizedName(_ name: String) -> String {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "Untitled Project" : trimmed
    }

    private func slug(for name: String) -> String {
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-"))
        let lowercased = name.lowercased().replacingOccurrences(of: " ", with: "-")
        let scalars = lowercased.unicodeScalars.map { allowed.contains($0) ? Character($0) : "-" }
        let collapsed = String(scalars).split(separator: "-").joined(separator: "-")
        return collapsed.isEmpty ? "untitled-project" : collapsed
    }

    private func isoString(from date: Date) -> String {
        ISO8601DateFormatter.bananaTape.string(from: date)
    }

    private func manifestJSON(id: String, name: String, timestamp: String) -> String? {
        let manifest: [String: Any] = [
            "schemaVersion": 1,
            "id": id,
            "name": name,
            "createdAt": timestamp,
            "updatedAt": timestamp,
            "settings": [
                "systemPrompt": "",
                "referenceImages": [],
            ],
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: manifest, options: [.prettyPrinted, .sortedKeys]) else {
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    private var emptyHistoryJSON: String {
        """
        {
          "schemaVersion": 1,
          "revision": 0,
          "entries": []
        }
        """
    }
}

private extension ISO8601DateFormatter {
    static let bananaTape: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}
