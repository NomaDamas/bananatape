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
        record("Opened Lineage QA and selected Navigate lineage.")

        assertFocus("A-1", in: app, presentButtons: ["lineageRightButton"], absentButtons: ["lineageLeftButton", "lineageUpButton", "lineageDownButton"])
        attachScreenshot("01-selection-mode-A-1", app: app)

        let canvas = app.otherElements["nativeCanvasSurface"]
        canvas.swipeRight()
        assertFocus("A-1", in: app, presentButtons: ["lineageRightButton"], absentButtons: ["lineageLeftButton", "lineageUpButton", "lineageDownButton"])
        record("Swiped outward right at A-1; focus and edge controls remained unchanged.")
        attachScreenshot("02-A-1-outward-clamped", app: app)

        canvas.swipeLeft()
        assertFocus("A-2", in: app, presentButtons: ["lineageLeftButton", "lineageRightButton", "lineageDownButton"], absentButtons: ["lineageUpButton"])
        record("Swiped left from A-1 to A-2.")
        attachScreenshot("03-A-2-branch", app: app)

        canvas.swipeLeft()
        assertFocus("A-3", in: app, presentButtons: ["lineageLeftButton"], absentButtons: ["lineageRightButton", "lineageUpButton", "lineageDownButton"])
        record("Swiped left from A-2 to A-3.")
        attachScreenshot("04-A-3-right-boundary", app: app)

        canvas.swipeLeft()
        assertFocus("A-3", in: app, presentButtons: ["lineageLeftButton"], absentButtons: ["lineageRightButton", "lineageUpButton", "lineageDownButton"])
        record("Swiped outward left at A-3; focus and edge controls remained unchanged.")
        attachScreenshot("05-A-3-outward-clamped", app: app)

        canvas.swipeRight()
        assertFocus("A-2", in: app, presentButtons: ["lineageLeftButton", "lineageRightButton", "lineageDownButton"], absentButtons: ["lineageUpButton"])
        canvas.swipeUp()
        assertFocus("B-1", in: app, presentButtons: ["lineageRightButton", "lineageUpButton"], absentButtons: ["lineageLeftButton", "lineageDownButton"])
        record("Swiped right from A-3 to A-2, then up from A-2 to B-1.")
        attachScreenshot("06-B-1-child", app: app)

        canvas.swipeLeft()
        assertFocus("B-2", in: app, presentButtons: ["lineageLeftButton", "lineageUpButton"], absentButtons: ["lineageRightButton", "lineageDownButton"])
        record("Swiped left from B-1 to B-2.")
        attachScreenshot("07-B-2-child-boundary", app: app)

        canvas.swipeLeft()
        assertFocus("B-2", in: app, presentButtons: ["lineageLeftButton", "lineageUpButton"], absentButtons: ["lineageRightButton", "lineageDownButton"])
        record("Swiped outward left at B-2; focus and edge controls remained unchanged.")
        attachScreenshot("08-B-2-outward-clamped", app: app)

        let penTool = app.buttons["Pen"]
        XCTAssertTrue(penTool.waitForExistence(timeout: 5))
        XCTAssertTrue(penTool.isHittable)
        penTool.tap()
        XCTAssertTrue(app.otherElements["focusedImage-B-2"].exists)
        record("Selected the Pen annotation tool while derived image B-2 remained focused.")
        attachScreenshot("09-B-2-annotation-pen", app: app)
        app.buttons["Navigate lineage"].tap()
        record("Returned to Navigate lineage after exercising annotation on B-2.")
        assertFocus("B-2", in: app, presentButtons: ["lineageLeftButton", "lineageUpButton"], absentButtons: ["lineageRightButton", "lineageDownButton"])

        app.buttons["historyVersionPill"].tap()
        let historyPanel = element(identifier: "historyBrowserPanel", in: app)
        XCTAssertTrue(historyPanel.waitForExistence(timeout: 5))
        XCTAssertTrue(app.otherElements["focusedImage-B-2"].exists)
        let selectedB2History = app.descendants(matching: .any).matching(
            NSPredicate(format: "label CONTAINS %@ AND label CONTAINS %@", "history item", "Lineage fixture B-2")
        ).firstMatch
        XCTAssertTrue(selectedB2History.exists)
        XCTAssertTrue(app.staticTexts["assets/qa-b-2.png"].exists)
        record("Opened history while B-2 remained focused and asserted B-2 selected.")
        attachScreenshot("09-B-2-history-selected", app: app)
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.48)).press(
            forDuration: 0.1,
            thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.96))
        )
        XCTAssertTrue(historyPanel.waitForNonExistence(timeout: 5))
        assertFocus("B-2", in: app, presentButtons: ["lineageLeftButton", "lineageUpButton"], absentButtons: ["lineageRightButton", "lineageDownButton"])

        var handledPhotosPermission = false
        addUIInterruptionMonitor(withDescription: "Photos export permission") { alert in
            for buttonLabel in ["Allow Full Access", "Allow", "Keep Add Only"] {
                let button = alert.buttons[buttonLabel]
                if button.exists {
                    button.tap()
                    handledPhotosPermission = true
                    return true
                }
            }
            return false
        }

        app.buttons["Export"].tap()
        record("Tapped the real focused Export control while B-2 was focused.")
        app.tap()
        if handledPhotosPermission {
            record("Accepted the Photos permission prompts, preferring full access for album export.")
        } else {
            record("Photos permission was already sufficient; no prompt required handling.")
        }

        assertFocus("B-2", in: app, presentButtons: ["lineageLeftButton", "lineageUpButton"], absentButtons: ["lineageRightButton", "lineageDownButton"])
        XCTAssertTrue(app.buttons["Expand composer"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["Expand composer"].isHittable)
        record("Focused export completed without blocking the editor; B-2 remained focused.")
        attachScreenshot("10-B-2-after-export", app: app)

        app.buttons["Expand composer"].tap()
        let composer = element(identifier: "nativeBottomComposer", in: app)
        XCTAssertTrue(composer.waitForExistence(timeout: 5))
        let exportSuccess = app.staticTexts.matching(
            NSPredicate(format: "label BEGINSWITH %@", "Saved to Photos")
        ).firstMatch
        XCTAssertTrue(exportSuccess.waitForExistence(timeout: 10))
        XCTAssertTrue(app.otherElements["focusedImage-B-2"].exists)
        let editFocused = app.buttons["Edit focused"]
        XCTAssertTrue(editFocused.exists)
        XCTAssertTrue(editFocused.isSelected)
        record("Observed focused export success and opened the derived-focused composer for B-2.")
        attachScreenshot("11-B-2-export-success-composer", app: app)

        let manageReferences = app.buttons["Manage"]
        XCTAssertTrue(manageReferences.waitForExistence(timeout: 5))
        XCTAssertTrue(manageReferences.isHittable)
        manageReferences.tap()
        XCTAssertTrue(element(identifier: "referenceImagesSheet", in: app).waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["referenceImagesAddButton"].exists)
        XCTAssertTrue(app.otherElements["focusedImage-B-2"].exists)
        record("Opened references from the composer while B-2 remained the focused derived image.")
        attachScreenshot("12-B-2-references", app: app)
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
