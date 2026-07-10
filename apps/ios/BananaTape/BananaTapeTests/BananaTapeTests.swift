import XCTest
@testable import BananaTape

final class BananaTapeTests: XCTestCase {
    func testProjectListStateIsEmptyWhenThereAreNoProjects() {
        let state = ProjectListState.empty

        XCTAssertTrue(state.isEmpty)
        XCTAssertEqual(state.projects, [])
    }

    func testProjectListStateIsNotEmptyWhenProjectExists() {
        let state = ProjectListState(projects: [MobileProjectSummary(id: "project-1", name: "Logo Explorations")])

        XCTAssertFalse(state.isEmpty)
        XCTAssertEqual(state.projects.first?.name, "Logo Explorations")
    }
}
