import XCTest

final class BananaTapeUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testScaffoldLaunchesToEmptyProjectList() throws {
        let app = makeApp()
        app.launch()

        XCTAssertTrue(app.staticTexts["BananaTape"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["No projects yet"].exists)
        XCTAssertTrue(app.staticTexts["Create a local project stored privately on this device."].exists)
    }

    func testFirstLaunchDoesNotShowProviderKeyPromptUntilOpenAISelected() throws {
        let app = makeApp()
        app.launch()

        XCTAssertTrue(app.staticTexts["BananaTape"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.secureTextFields["OpenAI API key"].exists)
    }

    func testReferenceImagesSheet_whenOpenedFromProjectActions_exposesManageControls() throws {
        let app = makeApp()
        app.launch()

        XCTAssertTrue(app.staticTexts["BananaTape"].waitForExistence(timeout: 5))

        app.buttons["New Project"].tap()
        let projectName = app.textFields["Project name"]
        XCTAssertTrue(projectName.waitForExistence(timeout: 5))
        projectName.tap()
        projectName.typeText("Reference Test")
        app.buttons["Create"].tap()

        let createdProject = app.descendants(matching: .any).matching(
            NSPredicate(format: "label CONTAINS %@", "Reference Test")
        ).firstMatch
        XCTAssertTrue(createdProject.waitForExistence(timeout: 5))
        createdProject.tap()
        XCTAssertTrue(app.otherElements["editorScreen"].waitForExistence(timeout: 5))

        app.buttons["Project actions"].tap()
        XCTAssertTrue(app.buttons["Reference images"].waitForExistence(timeout: 5))

        app.buttons["Reference images"].tap()

        XCTAssertTrue(app.otherElements["referenceImagesSheet"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Reference images"].exists)
        XCTAssertTrue(app.buttons["referenceImagesAddButton"].exists)
        XCTAssertTrue(app.staticTexts["0 references"].exists)
    }

    private func makeApp() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments.append("--reset-projects-for-ui-tests")
        return app
    }
}
