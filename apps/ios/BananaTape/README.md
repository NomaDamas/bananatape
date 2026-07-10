# BananaTape iOS scaffold

This directory contains the additive native iOS scaffold for BananaTape. It does not replace the root web editor, CLI, npm package, or desktop workflow.

## Targets

- `BananaTape`: minimal SwiftUI app target.
- `BananaTapeTests`: XCTest unit tests for scaffold state.
- `BananaTapeUITests`: XCTest UI tests for first-launch behavior.

## Current scope

The first screen is a Toss-style local project/editor surface. It supports local project creation and prompt-driven OpenAI image generation when the user enters an API key in the composer. Codex, Photos import/export, share extensions, and Magic Layer behavior remain out of scope.

## Xcode expectations

- Xcode 16 or newer is expected for the project format and SwiftUI scaffold.
- iOS deployment target: 17.0.
- Scheme: `BananaTape`.
- Default verification destination requested by the mobile port plan: `platform=iOS Simulator,name=iPhone 17`.

## Signing

The project uses automatic signing with an empty development team so simulator builds and tests can run locally without committing a team identifier. Real-device signing should be configured by the developer in local Xcode settings and not committed as part of the scaffold.

## Evidence commands

Preferred command:

```bash
xcodebuild test -project apps/ios/BananaTape/BananaTape.xcodeproj -scheme BananaTape -destination 'platform=iOS Simulator,name=iPhone 17' -resultBundlePath .omo/evidence/mobile-native-port/ios/scaffold.xcresult
```

If `iPhone 17` is unavailable, list installed simulators and record the substitution in `.omo/evidence/mobile-native-port/ios/device-matrix.md`:

```bash
xcrun simctl list devices available
xcodebuild test -project apps/ios/BananaTape/BananaTape.xcodeproj -scheme BananaTape -destination 'platform=iOS Simulator,name=<installed simulator name>' -resultBundlePath .omo/evidence/mobile-native-port/ios/scaffold.xcresult
```
