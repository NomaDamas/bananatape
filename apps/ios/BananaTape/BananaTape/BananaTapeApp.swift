import SwiftUI

@main
struct BananaTapeApp: App {
    private let storage: LocalProjectStorage
    @StateObject private var model: ProjectPickerModel

    init() {
        let storage = LocalProjectStorage()
#if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--reset-projects-for-ui-tests") {
            storage.list().forEach { _ = storage.delete(id: $0.id) }
        }
#endif
        self.storage = storage
        _model = StateObject(wrappedValue: ProjectPickerModel(storage: storage))
    }

    var body: some Scene {
        WindowGroup {
            ProjectListView(model: model, storage: storage)
        }
    }
}
