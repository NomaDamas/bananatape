import XCTest

final class BananaTapeUITests: XCTestCase {
    private var actionLog: [String] = []

    override func setUpWithError() throws {
        continueAfterFailure = false
        actionLog = []
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

    func testSeededLineageNavigation_swipesAcrossBoundariesAndReachesEditorActions() throws {
        let app = makeApp(seedLineageProject: true)
        app.launch()

        let project = app.buttons["openProjectButton-ui-lineage-project"]
        XCTAssertTrue(project.waitForExistence(timeout: 5))
        project.tap()
        XCTAssertTrue(app.otherElements["editorScreen"].waitForExistence(timeout: 5))
        app.buttons["Navigate lineage"].tap()
        record("Opened Lineage QA and selected Navigate lineage")

        assertFocus("A-1", in: app, presentButtons: ["lineageRightButton"], absentButtons: ["lineageLeftButton", "lineageUpButton", "lineageDownButton"])
        attachScreenshot("01-A-1-left-boundary", app: app)

        let canvas = app.otherElements["nativeCanvasSurface"]
        canvas.swipeLeft()
        assertFocus("A-2", in: app, presentButtons: ["lineageLeftButton", "lineageRightButton", "lineageDownButton"], absentButtons: ["lineageUpButton"])
        record("Swipe left moved focus A-1 to A-2")
        attachScreenshot("02-A-2-branch", app: app)

        canvas.swipeLeft()
        assertFocus("A-3", in: app, presentButtons: ["lineageLeftButton"], absentButtons: ["lineageRightButton", "lineageUpButton", "lineageDownButton"])
        record("Swipe left moved focus A-2 to A-3 right boundary")
        attachScreenshot("03-A-3-right-boundary", app: app)

        canvas.swipeRight()
        assertFocus("A-2", in: app, presentButtons: ["lineageLeftButton", "lineageRightButton", "lineageDownButton"], absentButtons: ["lineageUpButton"])
        canvas.swipeUp()
        assertFocus("B-1", in: app, presentButtons: ["lineageRightButton", "lineageUpButton"], absentButtons: ["lineageLeftButton", "lineageDownButton"])
        record("Swipe up moved focus down the lineage from A-2 to B-1")
        attachScreenshot("04-B-1-child", app: app)

        canvas.swipeLeft()
        assertFocus("B-2", in: app, presentButtons: ["lineageLeftButton", "lineageUpButton"], absentButtons: ["lineageRightButton", "lineageDownButton"])
        record("Swipe left moved focus B-1 to B-2 sibling boundary")
        attachScreenshot("05-B-2-child-boundary", app: app)

        canvas.swipeDown()
        assertFocus("A-2", in: app, presentButtons: ["lineageLeftButton", "lineageRightButton", "lineageDownButton"], absentButtons: ["lineageUpButton"])
        record("Swipe down moved focus up the lineage from B-2 to A-2")

        app.buttons["historyVersionPill"].tap()
        let historyPanel = element(identifier: "historyBrowserPanel", in: app)
        XCTAssertTrue(historyPanel.waitForExistence(timeout: 5))
        record("Opened history from the version action")
        attachScreenshot("06-history", app: app)
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.48)).press(
            forDuration: 0.1,
            thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.96))
        )
        XCTAssertTrue(historyPanel.waitForNonExistence(timeout: 5))

        app.buttons["Expand composer"].tap()
        let composer = element(identifier: "nativeBottomComposer", in: app)
        XCTAssertTrue(composer.waitForExistence(timeout: 5))
        record("Opened the full composer")
        attachScreenshot("07-composer", app: app)

        let manageReferences = app.buttons["Manage"]
        XCTAssertTrue(manageReferences.waitForExistence(timeout: 5))
        XCTAssertTrue(manageReferences.isHittable)
        manageReferences.tap()
        XCTAssertTrue(element(identifier: "referenceImagesSheet", in: app).waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["referenceImagesAddButton"].exists)
        record("Opened reference images from the composer and reached Add reference")
        attachScreenshot("08-references", app: app)
        attachActionLog()
    }

    private func makeApp(seedLineageProject: Bool = false) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments.append("--reset-projects-for-ui-tests")
        if seedLineageProject {
            app.launchArguments.append("--seed-lineage-project-for-ui-tests")
        }
        return app
    }

    private func assertFocus(_ imageID: String, in app: XCUIApplication, presentButtons: [String], absentButtons: [String], file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertTrue(app.otherElements["focusedImage-\(imageID)"].waitForExistence(timeout: 5), file: file, line: line)
        for identifier in presentButtons {
            let button = app.buttons[identifier]
            XCTAssertTrue(button.exists, "Expected \(identifier) at \(imageID)", file: file, line: line)
            XCTAssertTrue(button.isHittable, "Expected hittable \(identifier) at \(imageID)", file: file, line: line)
        }
        for identifier in absentButtons {
            XCTAssertFalse(app.buttons[identifier].exists, "Expected no \(identifier) at \(imageID)", file: file, line: line)
        }
    }

    private func element(identifier: String, in app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: identifier).firstMatch
    }

    private func record(_ action: String) {
        actionLog.append(action)
    }

    private func attachScreenshot(_ name: String, app: XCUIApplication) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private func attachActionLog() {
        let data = Data(actionLog.joined(separator: "\n").utf8)
        let attachment = XCTAttachment(data: data, uniformTypeIdentifier: "public.plain-text")
        attachment.name = "seeded-lineage-action-log.txt"
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
