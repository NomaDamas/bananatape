# Mobile feature parity and Magic Layer compatibility

## Purpose

This document turns the mobile plan matrix into implementation rules for iOS and Android. It defines what mobile must support in the MVP, what stays desktop-only, and how project data must survive import, editing, export, and sharing without corruption.

This spec is additive. It does not replace the current web or CLI product, and it does not change the desktop Magic Layer implementation.

## Product rules that apply everywhere

- Mobile is a native companion surface for BananaTape, not a replacement for the current web and CLI workflow.
- Web Magic Layer code remains untouched. Mobile work must not remove, rewrite, or degrade the current desktop Magic Layer product behavior.
- Mobile project handling must preserve existing project semantics for prompts, references, annotations, history, and provider metadata.
- Mobile import, save, and share flows must preserve unknown JSON fields whenever the app does not actively own them.
- If mobile cannot support a desktop-only behavior, it must keep the data intact and show a clear user-facing message instead of dropping fields or rewriting them.

## Feature parity matrix and implementation rules

| Feature area | Mobile MVP status | Parity level | Implementation rules |
| --- | --- | --- | --- |
| Project create, list, open, delete | Included | Adapted | Mobile gets a minimal native project picker because phones do not have the CLI. Do not add a full dashboard, cloud browser, or account layer. |
| Prompt | Included | Parity | Support prompt entry for generate and edit flows. Preserve prompt text exactly in project storage and history items. |
| System prompt | Included | Parity | Mobile must display and edit system prompt text. Save the same field semantics used by desktop projects. |
| References | Included | Parity | Support PNG and JPEG reference import through native pickers. Preserve reference metadata ordering and copied asset relationships when saving the project. |
| Annotations | Included | Adapted | Support pen, box, arrow, and memo tools with touch-first gestures. Preserve annotation JSON structure across reopen, export, and history navigation. |
| Generation | Included | Parity through mobile provider adapter | Mobile must support image generation through the approved provider adapter path. Keep project and history fields compatible with desktop history semantics. |
| Edit | Included | Adapted | Mobile must support image edits driven by prompt plus annotations. Save edit outputs as normal history entries with parent-child links preserved. |
| Undo and redo | Included | Adapted | Support undo and redo for mobile-owned editing operations, especially annotations and history-local canvas state. Do not treat unsupported desktop-only fields as editable undo targets. |
| History | Included | Adapted | Render and browse project history, including parent-child relationships. When a history item contains unsupported desktop-only fields, preserve them and still show the history entry if its final raster can render. |
| Export | Included | Mobile-native parity | Support save to Photos or Gallery and outbound share. Exported final images must use the rendered raster visible to the user. |
| Import and share-in | Included | Adapted | Support picker import and single-image share-in for PNG and JPEG. On import, preserve existing project JSON fields that mobile does not edit. |
| OpenAI | Included | Parity baseline | OpenAI is the stable mobile provider baseline. Provider auth and request handling are covered by the mobile provider spec, not by this document. |
| Codex | Gated | Experimental only if separately proven | Codex support must remain behind a feasibility gate. Mobile must stay fully functional with OpenAI even if Codex is unavailable. |
| SAM3 and Magic Layer | Desktop-only for creation and editing | View and preserve only | No mobile SAM3 segmentation flow. No mobile Magic Layer creation. No mobile Magic Layer editing, drag, hide, or apply actions. Preserve existing Magic Layer fields on import, reopen, and export without data loss. |

## Exact Magic Layer compatibility contract

### Scope boundary

Mobile must treat Magic Layer and SAM3 as desktop-only authoring features.

- No mobile Magic Layer creation.
- No mobile SAM3 creation.
- No mobile Magic Layer editing.
- No mobile layer dragging.
- No mobile layer hide control.
- No mobile Magic Layer apply control.
- No mobile UI affordance that implies segmentation can run on device in the MVP.

Desktop keeps the current behavior:

- Desktop may segment a ready image into `magicLayers`.
- Desktop may move layer positions.
- Desktop may hide layers.
- Desktop may apply Magic Layer changes back into a new generated result.

Mobile must not interfere with those desktop features or rewrite their saved data into a simpler shape.

### Data fields that must survive

The current desktop canvas image shape includes Magic Layer-related fields such as:

- `magicLayers`
- `magicLayerBaseUrl`
- `magicLayerStatus`
- `selectedMagicLayerId`

For mobile compatibility, the rule is simple: preserve these fields even when mobile does not use them as editable state.

Implementation requirements:

- On project import, mobile must parse and retain existing Magic Layer fields from desktop-created history items.
- On project save, mobile must preserve unknown and unsupported fields for every history entry it did not intentionally rewrite.
- On project export or share packaging, mobile must preserve Magic Layer-related JSON fields in serialized project data.
- Mobile serializers must preserve field presence and field values even when the mobile UI does not surface those controls.
- If mobile updates a history item for a mobile-owned field, the write path must merge and preserve unsupported desktop-only fields instead of rebuilding the object from a narrowed mobile model.

### Rendering behavior

Mobile should prioritize the final user-visible raster.

- If the image can render from the normal history raster, show it.
- If `magicLayerBaseUrl` exists and is the correct final base raster for display, mobile may render that raster as a read-only view.
- If a desktop-authored history item still has enough raster data to display without interactive layer editing, show the rendered image normally.
- If mobile cannot reconstruct a faithful final view from the available saved raster data, show a non-destructive unsupported state with the message `Magic Layer editing is desktop-only`.

That unsupported state must:

- keep the history item visible in history
- keep the project loadable
- keep the original JSON fields intact
- avoid deleting, flattening, or clearing `magicLayers`
- avoid rewriting the entry into a mobile-only schema

### User-facing messaging rules

When mobile encounters desktop-authored Magic Layer content it cannot edit, the message must be plain and stable.

Required message:

`Magic Layer editing is desktop-only`

Usage rules:

- Show the message only when the user reaches a Magic Layer-dependent state that mobile cannot fully support.
- Do not block unrelated project actions such as browsing history, saving the project, exporting a visible raster, or sharing supported image output.
- Do not imply the data is broken or lost.
- Do not offer fake disabled controls for create, drag, hide, or apply unless the mobile design later decides that a disabled explanatory affordance is useful.

## Serialization and compatibility rules

### Import rules

- Accept desktop v1 projects that contain Magic Layer fields.
- Accept history items with Magic Layer data even when mobile cannot edit them.
- Preserve field values on first load so later desktop reopen behaves the same as before mobile touched the project.

### Save rules

- Treat mobile save paths as merge-preserving updates.
- Preserve unknown top-level and nested history fields that mobile does not own.
- Never clear `magicLayers`, `magicLayerBaseUrl`, or related fields just because the active mobile screen does not use them.

### Export and share rules

- Image export may flatten to the visible final raster when exporting a standalone PNG or JPEG.
- Project export, backup, or share packaging must preserve original Magic Layer JSON fields.
- If mobile exports only a final raster image, that does not grant permission to delete layer metadata from the project itself.

## Area-specific guardrails

### Prompt and provider flows

- Prompt, system prompt, and provider settings must keep working whether or not a project contains Magic Layer history.
- Magic Layer presence must not disable normal prompt-based generation or edit flows unless the user is trying to invoke a desktop-only layer action.

### History flows

- History rows must remain browsable even when some entries contain desktop-only layer state.
- Unsupported entries should still display thumbnail or raster content when possible.
- Reordering or pruning unsupported fields during history serialization is not allowed.

### Export and share flows

- Save to Photos or Gallery should use the best available final raster.
- If the screen shows a read-only Magic Layer-derived raster, export that visible raster when possible.
- If mobile cannot render a faithful raster, show the desktop-only message and keep project data intact rather than exporting a damaged result.

## Non-goals for the mobile MVP

- Mobile SAM3 segmentation
- Mobile Magic Layer authoring
- Mobile recreation of desktop pointer-based drag behavior
- Mobile hide and apply workflows for layer changes
- Any migration that strips Magic Layer fields out of existing desktop projects

## Acceptance reminders for downstream tasks

Later mobile implementation tasks should verify all of the following:

- prompt support exists
- reference image support exists
- annotation support exists
- generation support exists
- edit support exists
- history support exists
- export support exists
- import and share support exists
- OpenAI baseline support exists
- Codex remains gated unless separately approved
- Magic Layer stays read-compatible and desktop-only on mobile
