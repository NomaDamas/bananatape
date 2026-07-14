# Mobile Performance Budget

## Purpose

This budget defines the deterministic performance and memory guardrails for BananaTape mobile image import, native annotation composition, app-private save, and explicit share/export boundaries.

The budget is intentionally conservative for v1. It favors file-backed project storage and predictable rejection over trying to decode or keep very large images in long-lived app state.

## Scope

Covered paths:

- PNG/JPEG picker or share-in import into app-private project storage.
- Native annotated image and mask composition from a project-owned source image.
- Export preview metadata produced from the composed files.
- Share/gallery handoff from an already composed app-private raster.
- Oversized import and composition rejection.

Out of scope:

- Real OpenAI or Codex provider latency.
- Magic Layer/SAM3 segmentation performance.
- Full release-readiness QA reporting.
- Pixel-perfect rendering comparisons.

## Thresholds

| Gate | Threshold | User-safe failure |
| --- | --- | --- |
| Import byte guard | Accepted source files must be at or below `12 MiB` by default. Tests may inject a smaller limit to exercise rejection with fixtures. | `This image is too large to import.` with code `image.oversized` |
| Composition pixel guard | Native composition must reject sources above `16_777_216` pixels before rendering annotated or mask output. | `This image is too large to prepare on this device.` |
| Long-lived app state | Project/editor/provider state must not persist base64 image bytes or `data:image` URLs except documented transient OpenAI `b64_json` request/response conversion and desktop Magic Layer compatibility fixtures. | No state write; use file-backed project asset paths |
| Project ownership | Accepted imports must be copied into app-private project storage before edit, export, or share depends on them. | Storage/import error without changing the project record |
| Deterministic smoke runtime | Native unit/perf smoke should complete under normal unit-test timeouts without simulator/device runtime requirements. | Failing unit/build gate |
| Generated Android artifacts | `.gradle/`, `build/`, and `app/build/` output directories must not be visible as intentional repo changes. | Clean or ignored generated outputs before handoff |

## Current Fixture Baseline

`packages/mobile-contracts/fixtures/large-banana-source.jpg` is the canonical Task 27 source fixture. Its current metadata is:

- Bytes: `516`.
- Format: JPEG/JFIF.
- Dimensions: `1x1` pixel.

Because this fixture is intentionally tiny on disk and raster size, it is not a device-memory stress bitmap by itself. The native tests use it to prove file-backed import, compose, export-preview, and share plumbing without adding heavy binary assets. Oversized behavior is exercised by injected byte and pixel limits so CI remains deterministic.

## Required Smoke Coverage

Each platform should keep deterministic coverage for these behaviors:

- Importing `large-banana-source.jpg` as a base image copies it to `assets/large-banana-source.jpg` under a project-owned app-private directory.
- Native composition uses the project-owned imported file, writes `annotated.png` and `mask.png` under an operation-scoped project temp/export directory, and returns source/annotated/mask metadata.
- The composed annotated output can be passed to the existing share/export boundary without moving the project source of truth out of app-private storage.
- The import oversized guard rejects the same fixture when the test injects `128` bytes as the max import size, producing `image.oversized` and leaving no copied asset.
- The composition oversized guard rejects an image above the injected pixel limit before rendering, producing `This image is too large to prepare on this device.`

## Measurement Notes

Available local tooling for Task 27 is build/unit-test based:

- iOS runtime XCTest and screenshot/performance launch remain blocked by the inherited CoreSimulator mismatch, so iOS evidence uses `xcodebuild build-for-testing` plus source-level deterministic XCTest coverage.
- Android JVM unit tests provide deterministic import/composition/share coverage. Connected tests are not required unless the renderer or UI changes.
- Memory notes are inferred from guard behavior and file-backed storage checks. No platform heap profiler result is claimed for this task.

Future release QA can add device profiler runs against a genuinely large raster fixture, but that should be a separate artifact because it would require either a heavier binary asset or generated-device setup outside normal unit tests.
