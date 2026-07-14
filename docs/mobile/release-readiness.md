# Mobile Release Readiness

## Status

BananaTape mobile has a native iOS and Android implementation with deterministic local QA evidence for the native-mobile-port plan through Task 28. This document is a release-readiness report for engineering handoff only. It does not claim App Store readiness, Play Store readiness, code-signing readiness, privacy-label readiness, store asset readiness, beta distribution readiness, or production launch approval.

The final QA command is:

```bash
node scripts/qa-mobile-native-port.mjs
```

Every run writes:

```text
.omo/evidence/mobile-native-port/final/summary.json
```

The runner executes all non-blocked checks it can run on the current machine and records environment blockers separately from code failures.

## Supported mobile features

The native mobile MVP currently covers these local-first behaviors through platform code, tests, and evidence:

| Area | Status | Evidence |
| --- | --- | --- |
| Native app shells | iOS SwiftUI and Android Kotlin/Jetpack Compose apps exist under `apps/ios/BananaTape/` and `apps/android/`. | Task 10, Task 11 |
| Local project picker | Native create, list, open, and delete use app-private storage instead of the desktop CLI. | Task 13 |
| Project schema compatibility | Mobile storage preserves desktop-shaped project/history JSON and unknown fields where mobile does not own them. | Task 13, Task 14 |
| Prompt composer | Prompt, system prompt, project context, provider display, output size, generate/edit enablement, and reference summaries are modeled and surfaced natively. | Task 15 |
| Native canvas and annotations | Pen, arrow, box, sticky memo, select/focus, pan, zoom, undo, redo, and serialized annotation counts are covered by native model/UI tests. | Task 16 |
| Reference/base image import | PNG/JPEG imports are copied into app-private project-owned `assets/` or `references/` storage immediately. | Task 17 |
| History and export preview | Native history browsing preserves branch semantics, selected-entry restore, delete fallback, and export preview metadata. | Task 18 |
| Mock provider | Deterministic mocked generate/edit, cancel, offline, provider error, and stale response handling are implemented for normal QA. | Task 19 |
| OpenAI BYOK baseline | OpenAI `gpt-image-2` generate/edit request shape, missing-key UX, invalid-key mapping, redacted logs, and secure-storage boundaries are covered. | Task 20 |
| Native composition | Annotated output and mask output are file-backed and guarded by a pixel limit before rendering. | Task 21 |
| Offline/lifecycle | Existing projects, annotation edits, import, composition, save/export remain local; provider requests fail fast offline and do not queue hidden retries. | Task 22 |
| Gallery save and outbound share | Explicit export saves to iOS Photos album `BananaTape` where permission allows, Android MediaStore `Pictures/BananaTape/`, and separate share outputs. | Task 23 |
| Inbound share/open-with | Android PNG/JPEG intent discovery and shared image state are covered; iOS model paths exist but runtime share launch is blocked by simulator environment. | Task 24 |
| Accessibility/localization evidence | Android connected semantics include mixed Korean/English labels; iOS accessibility labels/identifiers are source/build verified. | Task 26 |
| Performance budget | Import byte guard, composition pixel guard, file-backed state, and generated Android artifact guard are documented and tested. | Task 27 |

## Unsupported or deferred features

### Magic Layer and SAM3

Mobile does not support Magic Layer authoring, SAM3 segmentation, Magic Layer creation, layer dragging, layer hiding, or Magic Layer apply controls. Mobile preserves desktop-authored Magic Layer fields and uses the stable unsupported message:

```text
Magic Layer editing is desktop-only
```

This is intentional. Desktop Magic Layer remains the authoring surface.

### Codex provider

The mobile Codex subscription provider verdict is `FAIL`. Native mobile currently supports Mocked and OpenAI provider paths only. Codex availability checks return:

```text
Codex mobile provider is not available in this build
```

OpenAI BYOK remains the supported production baseline. Codex should only be reopened if OpenAI publishes a native-mobile-suitable contract for subscription image generation with official auth, stable endpoint/API semantics, secure storage guidance, revocation, policy posture, store-review posture, and deterministic tests.

### Store release work

The current evidence is not a store submission checklist. It does not include signing identities, provisioning profiles, bundle metadata review, privacy nutrition labels, screenshots for store listings, store review notes, crash reporting, analytics consent, TestFlight/Play internal track setup, or legal/policy sign-off.

## Device and environment matrix

| Platform | Gate | Current status |
| --- | --- | --- |
| Web/CLI | `npm run lint`, `npm run typecheck`, `npx vitest run`, `node scripts/qa-mobile-port-web-regression.mjs` | Final runner executes these from repo root and records command logs. |
| Mobile contracts | `npx vitest run packages/mobile-contracts` | Final runner executes this fixture/contract gate. |
| iOS compile | `xcodebuild build-for-testing -project apps/ios/BananaTape/BananaTape.xcodeproj -scheme BananaTape -destination 'generic/platform=iOS Simulator'` | Expected compile gate; prior Tasks 20-27 recorded passing build-for-testing. |
| iOS runtime simulator | `xcodebuild test` or simulator launch | Blocked on this machine by CoreSimulator mismatch: installed `1051.54.0`, Xcode expects `1051.55.0`; administrator repair is required. |
| Android unit | `apps/android/gradlew -p apps/android testDebugUnitTest` | Prior Tasks 20-27 recorded passing unit tests; final runner executes this gate. |
| Android connected | `apps/android/gradlew -p apps/android connectedDebugAndroidTest` | Previously passed on `Pixel_7_API_36(AVD) - 16`; final runner executes it when a booted device/emulator is available and records an environment blocker if not. |
| Android generated artifacts | `git status --short --untracked-files=all -- apps/android` filtered for `.gradle/`, `build/`, `app/build/` | Final runner fails this check if generated Android output directories are visible as repo changes. |

## Final QA runner categories

`scripts/qa-mobile-native-port.mjs` records checks in these categories:

- `web-cli`: root web, CLI, lint, typecheck, Vitest, and web regression coverage.
- `mobile-contracts`: shared fixture/contract validation.
- `ios`: iOS build-for-testing and simulator availability probe.
- `android`: Android unit and connected tests.
- `evidence`: Task 20-27 evidence presence, Codex fail-closed evidence, Magic Layer desktop-only evidence, and Android generated artifact guard.
- `docs`: required mobile specification and budget documents.

Each command result includes the check name, command, status, exit code, duration, stdout/stderr excerpts, evidence log paths, and blocker details when applicable.

## Current blockers and limitations

- iOS runtime XCTest, screenshots, manual share/Photos runs, and runtime performance profiling remain blocked on this machine until CoreSimulator is repaired from `1051.54.0` to the `1051.55.0` build expected by Xcode.
- Android connected tests require a booted online emulator or device. The inherited passing matrix is `Pixel_7_API_36(AVD) - 16`; if no device is available, the final runner records `android-connected-device-unavailable` as an environment blocker.
- `packages/mobile-contracts/fixtures/large-banana-source.jpg` is a deterministic `516` byte, `1x1` JPEG. It proves file-backed plumbing and injected guard behavior, not real heap pressure.
- No production real-provider OpenAI call is required for normal QA. Real OpenAI remains optional and credential-gated; no paid provider call is part of the final runner.
