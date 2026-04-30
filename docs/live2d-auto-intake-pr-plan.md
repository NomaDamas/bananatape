# Live2D Auto-Intake PR Plan

## Conclusion

BananaTape currently stops after image generation: the generated Live2D part sheet appears on the canvas, but the project does not automatically advance into Live2D intake. This PR should add the missing orchestration layer: after a Live2D-oriented generation completes, BananaTape should run a deterministic local auto-intake pass that detects the boxed part-sheet layout, proposes labeled part crops, writes the Live2D handoff manifest, and surfaces the result for review.

This PR must not claim full Cubism rigging, `.moc3` generation, or perfect semantic segmentation. It should deliver a reviewable MVP that turns a generated grid-style reference sheet into a concrete `live2d/manifest.json` draft with candidate boxes.

## Non-goals

- No Cubism Editor automation.
- No `.moc3`, `.model3.json`, physics, mesh, deformer, expression, or motion export.
- No hard dependency on cloud VLM/OCR APIs.
- No promise that arbitrary character images can be segmented.
- No destructive modification of generated assets.

## Exact PR scope

Implement a deterministic Live2D auto-intake MVP inside BananaTape:

1. Add a local Live2D auto-intake module that accepts an image size and, for the current generated sheet layout, proposes normalized bbox annotations for the right-side part grid.
2. Use a stable numbered part taxonomy mapping for the 26-box prompt/reference-sheet format.
3. Add an API route that runs auto-intake for the current project and selected history asset, persists `live2d/manifest.json`, and updates project Live2D settings to select that asset.
4. Hook generation completion so when Live2D mode is enabled, BananaTape automatically calls the auto-intake route after saving a generated image.
5. Add concise UI/status copy so the user sees that Live2D intake candidates were created and need review, rather than thinking a finished Live2D model was created.
6. Add focused unit tests for the detector/mapping and route-level behavior.

## Architecture

### Existing surfaces to preserve

- `src/lib/live2d/contract.ts` owns Live2D prompt preset, manifest types, and manifest builders.
- `src/app/api/projects/live2d/manifest/route.ts` already writes the manual Live2D handoff manifest.
- `src/lib/projects/metadata-store.ts` persists project settings/history.
- The editor store/provider path already saves generation history entries.

### New surfaces

Suggested files:

```text
src/lib/live2d/auto-intake.ts
src/app/api/projects/live2d/auto-intake/route.ts
tests/unit/live2d-auto-intake.test.ts
```

`auto-intake.ts` should expose pure functions such as:

```ts
export const LIVE2D_REFERENCE_SHEET_PARTS = [...]
export function proposeReferenceSheetGridAnnotations(options: {
  imageWidth: number
  imageHeight: number
}): Live2DAnnotation[]
```

For MVP, use the known layout contract from the prompt:

- left side: assembled preview
- right side: 26 boxed parts
- boxes sorted row-major
- labels/numbers map to stable part names

The function should generate normalized bounding boxes that cover the expected right-side grid cells. Keep it deterministic and testable. If image dimensions are missing or invalid, return a clear failure instead of guessing.

### API route

`POST /api/projects/live2d/auto-intake`

Payload:

```json
{
  "historyEntryId": "optional selected generation id",
  "imageWidth": 1536,
  "imageHeight": 1024
}
```

Behavior:

1. Resolve the current project.
2. Select the requested history entry or latest image generation entry.
3. Generate candidate annotations via `proposeReferenceSheetGridAnnotations`.
4. Build a `Live2DManifest` with selected asset + annotations.
5. Write `live2d/manifest.json` through the existing manifest persistence path or equivalent project store API.
6. Update project settings: `live2d.enabled = true`, `selectedHistoryEntryId = selected entry id`.
7. Return JSON summary: selected id, annotation count, detected parts, reviewRequired true.

### Generation hook

After successful generation saves a history entry and updates the canvas, if Live2D mode/settings are enabled or the active/system prompt includes the Live2D reference-sheet preset, call the auto-intake endpoint.

Do not block image display on auto-intake failure. Surface a warning/toast/status if auto-intake fails.

### UI/status

Use blunt copy:

- Success: `Live2D intake draft created: 26 candidate part boxes. Review labels before export.`
- Failure: `Image generated, but Live2D auto-intake failed. You can annotate boxes manually.`

## Acceptance criteria

- A generated Live2D reference sheet no longer leaves the user at a dead end; BananaTape creates a `live2d/manifest.json` draft automatically.
- Candidate annotations use the repo's Live2D taxonomy names, not only generic labels.
- The route returns `reviewRequired: true` and never claims finished rigging.
- Existing manual manifest route still works.
- Unit tests cover:
  - 26 deterministic bbox proposals for a 1536x1024 style sheet.
  - row-major numbered part mapping.
  - route or store behavior that persists selected asset + annotations.
- Verification commands pass:
  - `npx vitest run tests/unit/live2d-auto-intake.test.ts tests/unit/projects.test.ts`
  - `npm run typecheck`

## Risks

- The detector is layout-contract-based, not a general image segmentation model. This is intentional for MVP.
- If generated sheets do not follow the prompt's strict grid layout, candidates may need manual correction.
- Real production quality still needs later stages: actual box edge detection, OCR/VLM label confidence, background removal, part crop export, and Cubism rigging.

## OMX implementation prompt

Use this prompt exactly:

```text
Task: bananatape-live2d-auto-intake-20260430.

You are implementing a focused GitHub PR in /tmp/bananatape-live2d-auto-intake. First read docs/live2d-auto-intake-pr-plan.md and follow it exactly.

Goal: add the missing BananaTape Live2D post-generation auto-intake orchestration. After a Live2D part-sheet generation, BananaTape should automatically draft the Live2D handoff by proposing part bbox annotations for the known grid-style reference sheet and persisting live2d/manifest.json. Do not implement Cubism rigging, .moc3 generation, or a general segmentation model.

Required implementation:
1. Add a pure Live2D auto-intake module with the 26-part reference-sheet taxonomy and deterministic normalized bbox proposals for the strict grid layout.
2. Add POST /api/projects/live2d/auto-intake to select the latest/requested generated history entry, create annotations, persist live2d/manifest.json, and set project live2d settings.
3. Hook successful generation completion so Live2D mode or Live2D prompt preset triggers auto-intake without blocking image display.
4. Add clear review-required status copy; never claim finished Live2D/Cubism model creation.
5. Add focused unit tests for detector/mapping and persistence behavior.

Verification:
- npx vitest run tests/unit/live2d-auto-intake.test.ts tests/unit/projects.test.ts
- npm run typecheck
- git diff --stat origin/main...HEAD

Commit all changes on the current branch with a clear lore-style commit message. Do not push main.
```
