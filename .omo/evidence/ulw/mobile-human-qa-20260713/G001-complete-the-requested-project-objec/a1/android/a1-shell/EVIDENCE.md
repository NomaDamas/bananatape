# Android Wave A1 Shell Evidence

Date: 2026-07-13
Scope: `BananaTapeApp.kt`, `MainActivityTest.kt`, `DESIGN.md`

## PIN

- Characterization/Android test compile: `apps/android/gradlew -p apps/android :app:assembleDebugAndroidTest`
- Binary observable: `BUILD SUCCESSFUL`, exit `0`.
- Artifact: `pin-instrumentation-compile.log`, `pin-instrumentation-compile.exit`
- Existing project/editor characterization tests in `MainActivityTest.kt` were preserved unchanged.

## RED

- Pre-change contract probe: `git show HEAD:.../BananaTapeApp.kt` with assertions for `PickVisualMedia`, readable dialog semantics, and horizontal toolbar layout.
- Binary observable: four expected contract failures, exit `1`.
- Artifact: `red-prechange-contract-probe.log`, `red-prechange-contract-probe.exit`
- Focused instrumentation tests compile without test-source errors: `red-focused-shell-compile.log`, `red-focused-shell-compile.exit`.
- Runtime RED/GREEN instrumentation was not executed: `adb devices -l` showed only an unauthorized USB device and no running emulator.
- Artifact: `instrumentation-device-status.log`, `instrumentation-device-status.exit`

## GREEN

- Dialog scenario: `newProjectDialog_whenOpened_exposesReadableTitleAndFocusedNameField` asserts visible title, label, placeholder, accessible input, initial focus, text entry, and created project.
- Photo Picker base scenario: `basePhotoPicker_whenSelectionReturns_importsImageIntoProjectAndEditorState` observes a selected-access picker intent, dispatches a PNG result, and verifies the copied project asset plus editor state.
- Photo Picker reference scenario: `referencePhotoPicker_whenSelectionReturns_persistsCopiedImageAndReferenceState` observes the picker intent, dispatches a PNG result, verifies the reference tile/state, manifest entry, and copied file.
- Toolbar scenario: `annotationToolbar_whenEditorLaunches_isHorizontalAboveCanvasAndKeepsEveryToolReachable` verifies horizontal bounds above the canvas and all eight tool labels.
- Contract probe: working-tree source reports `PickVisualMedia(ImageOnly)`, readable dialog tokens, and `Row` toolbar layout; exit `0`.
- Artifact: `green-postchange-contract-probe.log`, `green-postchange-contract-probe.exit`
- Required unit verification: `apps/android/gradlew -p apps/android :app:testDebugUnitTest`
- Binary observable: `BUILD SUCCESSFUL`, exit `0`.
- Artifact: `final-unit-tests.log`, `final-unit-tests.exit`
- Required instrumentation assembly: `apps/android/gradlew -p apps/android :app:assembleDebugAndroidTest`
- Binary observable: `BUILD SUCCESSFUL`, exit `0`.
- Artifact: `final-assemble-debug-android-test.log`, `final-assemble-debug-android-test.exit`
- Diff check: `git diff --check` exit `0`.
- Artifact: `tracked-diff-stat.txt`, `tracked-diff-check.exit`
