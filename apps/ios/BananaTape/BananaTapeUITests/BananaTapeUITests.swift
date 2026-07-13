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

    func testProjectCardMore_hasMinimumHitFrame() throws {
        let app = makeApp(seedLineageProject: true)
        app.launch()

        let more = app.buttons["projectActionButton-ui-lineage-project"]
        assertMinimumHitFrame(more, named: "Project card More", in: app)
        attachAccessibilityHierarchy("01-project-card-more-accessibility", app: app)
        attachScreenshot("01-project-card-more-frame", app: app)
    }

    func testHistoryRowActions_haveMinimumHitFrames() throws {
        let app = makeApp(seedLineageProject: true)
        app.launch()

        app.buttons["openProjectButton-ui-lineage-project"].tap()
        XCTAssertTrue(app.buttons["historyVersionPill"].waitForExistence(timeout: 5))
        app.buttons["historyVersionPill"].tap()
        XCTAssertTrue(element(identifier: "historyBrowserPanel", in: app).waitForExistence(timeout: 5))

        let export = app.buttons["exportHistoryEntry-B-2"]
        let delete = app.buttons["deleteHistoryEntry-B-2"]
        assertMinimumHitFrame(export, named: "History export", in: app)
        assertMinimumHitFrame(delete, named: "History delete", in: app)
        attachAccessibilityHierarchy("02-history-actions-accessibility", app: app)
        attachScreenshot("02-history-actions-frames", app: app)
    }

    func testReferenceRemove_hasMinimumHitFrame() throws {
        let app = makeApp(seedLineageProject: true)
        app.launch()

        app.buttons["openProjectButton-ui-lineage-project"].tap()
        XCTAssertTrue(app.buttons["Project actions"].waitForExistence(timeout: 5))
        app.buttons["Project actions"].tap()
        app.buttons["Reference images"].tap()
        XCTAssertTrue(element(identifier: "referenceImagesSheet", in: app).waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["1 reference"].exists)

        let remove = app.buttons["removeReference-qa-reference"]
        assertMinimumHitFrame(remove, named: "Reference remove", in: app)
        attachAccessibilityHierarchy("03-reference-remove-accessibility", app: app)
        attachScreenshot("03-reference-remove-frame", app: app)
    }

    func testNewProjectSurface_focusesNameFieldAndPreservesCancelAndCreate() throws {
        let app = makeApp()
        app.launch()

        XCTAssertTrue(app.buttons["New Project"].waitForExistence(timeout: 5))
        app.buttons["New Project"].tap()

        let surface = element(identifier: "newProjectSurface", in: app)
        let projectName = app.textFields["Project name"]
        XCTAssertTrue(surface.waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Create a project"].exists)
        XCTAssertTrue(projectName.exists)
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["cancelCreateProjectButton"].isHittable)
        XCTAssertTrue(app.buttons["confirmCreateProjectButton"].isHittable)

        projectName.typeText("Cancelled Project")
        app.buttons["cancelCreateProjectButton"].tap()
        XCTAssertTrue(surface.waitForNonExistence(timeout: 5))

        app.buttons["New Project"].tap()
        XCTAssertTrue(surface.waitForExistence(timeout: 5))
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
        projectName.typeText("Mobile Surface")
        app.buttons["confirmCreateProjectButton"].tap()

        let createdProject = app.buttons["openProjectButton-mobile-surface"]
        XCTAssertTrue(createdProject.waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["Import"].exists)
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

    func testEditorAnnotationToolbar_staysAboveCanvasWithoutBlockingLineageOrActions() throws {
        let app = makeApp(seedLineageProject: true)
        app.launch()

        let project = app.buttons["openProjectButton-ui-lineage-project"]
        XCTAssertTrue(project.waitForExistence(timeout: 5))
        project.tap()

        let toolbar = element(identifier: "annotationToolbar", in: app)
        let canvas = app.otherElements["nativeCanvasSurface"]
        XCTAssertTrue(toolbar.waitForExistence(timeout: 5))
        XCTAssertTrue(canvas.waitForExistence(timeout: 5))
        XCTAssertLessThanOrEqual(toolbar.frame.maxY, canvas.frame.minY + 1)

        for label in ["Pan", "Navigate lineage", "Pen", "Box", "Arrow", "Memo"] {
            XCTAssertTrue(app.buttons[label].exists, "Expected \(label) in the annotation toolbar")
            XCTAssertTrue(app.buttons[label].isHittable, "Expected \(label) to be hittable")
            assertMinimumHitFrame(app.buttons[label], named: label, in: app)
        }
        toolbar.swipeLeft()
        assertMinimumHitFrame(app.buttons["Undo"], named: "Undo", in: app)
        assertMinimumHitFrame(app.buttons["Redo"], named: "Redo", in: app)
        assertMinimumHitFrame(app.buttons["Back"], named: "Back", in: app)
        assertMinimumHitFrame(app.buttons["Export"], named: "Export", in: app)
        assertMinimumHitFrame(app.buttons["Project actions"], named: "Project actions", in: app)
        assertMinimumHitFrame(app.buttons["historyVersionPill"], named: "History version", in: app)
        assertMinimumHitFrame(app.buttons["Expand composer"], named: "Expand composer", in: app)

        let primaryAction: XCUIElement
        if app.buttons["Apply edit"].waitForExistence(timeout: 5) {
            primaryAction = app.buttons["Apply edit"]
        } else {
            primaryAction = app.buttons["Generate"]
        }
        XCTAssertTrue(primaryAction.waitForExistence(timeout: 5))
        XCTAssertTrue(["Apply edit", "Generate"].contains(primaryAction.label), "Unexpected primary action label: \(primaryAction.label)")
        assertMinimumHitFrame(primaryAction, named: "Apply edit/Generate", in: app)
        XCTAssertFalse(app.buttons["Expand composer"].frame.intersects(primaryAction.frame))

        app.buttons["Navigate lineage"].tap()
        let lineageRight = app.buttons["lineageRightButton"]
        XCTAssertTrue(lineageRight.waitForExistence(timeout: 5))
        assertMinimumHitFrame(lineageRight, named: "lineageRightButton", in: app)
        XCTAssertFalse(toolbar.frame.intersects(lineageRight.frame))
    }

    func testMobileCanvasSurface_supportsArrowPenMemoAndKeepsEditorActionsHittable() throws {
        let app = makeApp(seedLineageProject: true)
        app.launch()

        let project = app.buttons["openProjectButton-ui-lineage-project"]
        XCTAssertTrue(project.waitForExistence(timeout: 5))
        project.tap()

        let toolbar = element(identifier: "annotationToolbar", in: app)
        let canvas = app.otherElements["nativeCanvasSurface"]
        let focusedCanvas = app.otherElements["focusedImage-A-1"]
        XCTAssertTrue(toolbar.waitForExistence(timeout: 5))
        XCTAssertTrue(canvas.waitForExistence(timeout: 5))
        XCTAssertTrue(focusedCanvas.waitForExistence(timeout: 5))
        XCTAssertLessThanOrEqual(toolbar.frame.maxY, canvas.frame.minY + 1)

        app.buttons["Arrow"].tap()
        focusedCanvas.coordinate(withNormalizedOffset: CGVector(dx: 0.22, dy: 0.30)).press(
            forDuration: 0.1,
            thenDragTo: focusedCanvas.coordinate(withNormalizedOffset: CGVector(dx: 0.78, dy: 0.68))
        )
        XCTAssertTrue(canvas.exists)
        XCTAssertTrue(focusedCanvas.exists)
        attachScreenshot("01-arrow-canvas-remains", app: app)

        app.buttons["Pen"].tap()
        captureScreenshotDuringPenHold(
            app: app,
            source: focusedCanvas.coordinate(withNormalizedOffset: CGVector(dx: 0.28, dy: 0.70)),
            destination: focusedCanvas.coordinate(withNormalizedOffset: CGVector(dx: 0.72, dy: 0.34))
        )
        XCTAssertTrue(canvas.exists)
        attachScreenshot("02-pen-post-commit", app: app)

        XCTAssertTrue(app.buttons["historyVersionPill"].isHittable)
        XCTAssertTrue(app.buttons["Expand composer"].isHittable)
        XCTAssertTrue(app.buttons["Export"].isHittable)

        app.buttons["Memo"].tap()
        focusedCanvas.coordinate(withNormalizedOffset: CGVector(dx: 0.86, dy: 0.18)).tap()
        let memoField = app.textFields.matching(
            NSPredicate(format: "identifier BEGINSWITH %@", "nativeMemo-")
        ).firstMatch
        XCTAssertTrue(memoField.waitForExistence(timeout: 5))
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
        XCTAssertTrue(focusedCanvas.exists)
        memoField.typeText(" edge note")
        let hierarchy = XCTAttachment(string: app.debugDescription)
        hierarchy.name = "04-memo-accessibility-hierarchy.txt"
        hierarchy.lifetime = .keepAlways
        add(hierarchy)
        attachScreenshot("03-memo-near-edge-with-keyboard", app: app)
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
            assertMinimumHitFrame(button, named: identifier, in: app, file: file, line: line)
        }
        for identifier in absentButtons {
            XCTAssertFalse(app.buttons[identifier].exists, "Expected no \(identifier) at \(imageID)", file: file, line: line)
        }
    }

    private func assertMinimumHitFrame(_ element: XCUIElement, named name: String, in app: XCUIApplication, file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertTrue(element.waitForExistence(timeout: 5), "Expected \(name) to exist", file: file, line: line)
        XCTAssertGreaterThanOrEqual(element.frame.width, 44, "Expected \(name) width >= 44pt, got \(element.frame.width)", file: file, line: line)
        XCTAssertGreaterThanOrEqual(element.frame.height, 44, "Expected \(name) height >= 44pt, got \(element.frame.height)", file: file, line: line)
        XCTAssertTrue(app.windows.firstMatch.frame.contains(element.frame), "Expected \(name) to be fully inside the iPhone window", file: file, line: line)
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

    private func attachAccessibilityHierarchy(_ name: String, app: XCUIApplication) {
        let attachment = XCTAttachment(string: app.debugDescription)
        attachment.name = "\(name).txt"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private func captureScreenshotDuringPenHold(app: XCUIApplication, source: XCUICoordinate, destination: XCUICoordinate) {
        let screenshotExpectation = expectation(description: "Capture Pen screenshot while contact is held")
        let lock = NSLock()
        var capturedScreenshot: XCUIScreenshot?
        var capturedAt: Date?
        let gestureStartedAt = Date()

        DispatchQueue.global(qos: .userInitiated).async {
            Thread.sleep(forTimeInterval: 2.5)
            let screenshot = app.screenshot()
            lock.lock()
            capturedScreenshot = screenshot
            capturedAt = Date()
            lock.unlock()
            screenshotExpectation.fulfill()
        }

        source.press(forDuration: 0.1, thenDragTo: destination, withVelocity: .slow, thenHoldForDuration: 5)
        let gestureReturnedAt = Date()
        wait(for: [screenshotExpectation], timeout: 10)

        lock.lock()
        let screenshot = capturedScreenshot
        let captureDate = capturedAt
        lock.unlock()

        XCTAssertNotNil(screenshot)
        if let screenshot {
            let attachment = XCTAttachment(screenshot: screenshot)
            attachment.name = "02-pen-in-contact-before-pointer-up"
            attachment.lifetime = .keepAlways
            add(attachment)
        }

        let timing = """
        Pen gesture started: \(gestureStartedAt)
        In-contact screenshot captured: \(captureDate.map(String.init(describing:)) ?? "missing")
        Gesture method returned: \(gestureReturnedAt)
        Capture offset from gesture start: \(captureDate.map { $0.timeIntervalSince(gestureStartedAt) } ?? -1) seconds
        Capture occurred before pointer-up: \(captureDate.map { $0 < gestureReturnedAt } ?? false)
        Gesture used thenHoldForDuration: 5 seconds
        """
        let timingAttachment = XCTAttachment(string: timing)
        timingAttachment.name = "02-pen-in-contact-timing.txt"
        timingAttachment.lifetime = .keepAlways
        add(timingAttachment)
    }

    private func attachActionLog() {
        let data = Data(actionLog.joined(separator: "\n").utf8)
        let attachment = XCTAttachment(data: data, uniformTypeIdentifier: "public.plain-text")
        attachment.name = "seeded-lineage-action-log.txt"
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
