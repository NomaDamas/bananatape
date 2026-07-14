## Mobile storage and gallery behavior

### Purpose

This document defines how BananaTape stores mobile projects, imports user-selected images, and exports final images to the device photo library or gallery.

The goal is to keep the mobile port local-first without implying that phones directly edit desktop BananaTape project folders under `~/Documents`.

### Product boundary

- Mobile storage is local to the device and app-private by default.
- Mobile does not directly open or live-edit desktop project folders such as `~/Documents/BananaTape Projects/`.
- Desktop keeps its current folder contract. Mobile adapts the same project concepts inside native app-owned storage.
- Cloud sync, shared workspaces, and remote project ownership remain out of scope.

### Storage model

Mobile projects use app-private storage as the source of truth.

Each mobile project should keep the same conceptual parts as desktop:

- project manifest data
- history data
- generated and edited assets
- copied reference assets
- temporary working files

The native implementation may choose platform-specific directories, but the ownership rule is fixed:

- metadata and project JSON live in app-private storage
- generated assets live in app-private storage
- imported reference assets are copied into app-private project storage immediately
- temporary working files live in app-private temporary storage

This mirrors the current desktop split between `project.json`, `history.json`, `assets/`, `references/`, and `tmp/`, while keeping mobile file ownership inside the app sandbox.

### Imported asset ownership

When the user imports an image through a picker or system share sheet, BananaTape must copy the selected asset into project-owned storage right away.

Rules:

- Do not keep the project dependent on a temporary picker URI, bookmark, or share extension handle.
- Do not treat the external library item as the canonical project file.
- Save a copied project-owned file in app-private storage before the edit session depends on it.
- Preserve project metadata that links the copied asset to the project record.

This applies to:

- creating a project from an imported image
- adding reference images from the in-app picker
- accepting a single image through share-in
- reopening a project after the original external asset has moved, been deleted, or become unavailable

### Import scope for v1

V1 mobile import support is intentionally narrow.

Supported inbound image MIME types:

- `image/png`
- `image/jpeg`

V1 rules:

- A new project created from import accepts one source image at a time.
- Share-in accepts one source image at a time.
- The in-app reference picker may import one or multiple reference images in a single action.
- Every accepted reference is copied into app-private project storage.
- Unsupported inbound types should fail with a plain user-facing message instead of silent conversion.

Desktop supports broader reference formats today. Mobile v1 does not inherit that broader format list automatically.

### Max source image policy

Mobile v1 uses a simple source image policy.

- One project source image at a time for project creation or share-in.
- One active base image at a time for an edit request.
- One or more reference images may be attached through the in-app reference picker.

This keeps the mobile flow aligned with the current project model, where one history item points to one primary raster asset while reference images remain a separate ordered list.

### Offline behavior

BananaTape mobile stays usable offline for storage flows.

- Users can browse existing local projects offline.
- Users can open local history and local references offline.
- Users can import supported images from picker or share-in offline.
- Users can export already-rendered local images offline.
- Provider-backed generate and edit requests fail cleanly when the device is offline.

Offline behavior must not:

- delete local project data
- clear imported reference assets
- clear provider settings
- claim the project is missing just because the network is unavailable

### iOS Photos behavior

iOS has two distinct flows, import and export.

Import:

- Use the system Photos picker for user-selected imports.
- Picker-based import does not require broad photo library read permission for the normal case.
- BananaTape only receives the assets the user explicitly selects.
- After selection, BananaTape copies each supported asset into app-private project storage.

Export:

- Explicit user export to Photos should use PhotoKit-managed save behavior.
- BananaTape should create or find a custom album named `BananaTape` for final explicit exports.
- If the album already exists, reuse it.
- If the album does not exist and permission allows album writes, create it, then add the exported image.

Permission states to handle:

- `authorized`: full export flow allowed
- `limited`: import from the picker still works, but album creation and album fetch behavior may be constrained, so the app should fall back to saving the export without assuming album management is available
- `denied`: picker import still works through the system picker, but explicit Photos export that requires library write access must show a permission message and stop cleanly
- `restricted`: treat like denied for user-facing behavior
- `notDetermined`: request permission only when the user explicitly starts a Photos export that needs it

If the app can save with add-only permission but cannot reliably create or fetch the `BananaTape` album, save the explicit export and tell the user that album placement was unavailable on this device permission state.

### Android gallery behavior

Android also has separate import and export flows.

Import:

- Use the Android Photo Picker for normal image selection.
- Picker import should not depend on broad gallery read permission.
- BananaTape should copy each accepted `image/png` or `image/jpeg` selection into app-private project storage immediately.

Export:

- Explicit user export should write a new image through MediaStore.
- Exported images should use the relative path `Pictures/BananaTape/`.
- The MediaStore entry is for explicit export only. It is not the app's working project store.

Permission states to handle:

- granted: export proceeds normally when the platform version or device behavior requires a permission gate for the chosen write flow
- denied: picker import can still work, but gallery export must fail cleanly with a permission message if the device blocks the chosen write path
- limited or selected-photos style access: picker import works for user-selected assets, but BananaTape must not assume broad read access to unrelated gallery items

The mobile project remains app-private even when final exported images are also written to MediaStore.

### Save, share, and export behavior

BananaTape mobile should separate project persistence from user-visible export.

Project persistence means:

- saving manifest and history metadata to app-private storage
- saving generated and edited assets to app-private storage
- saving imported references to app-private storage

User-visible export means:

- saving a final rendered image to Photos on iOS
- saving a final rendered image to MediaStore on Android
- sharing a final rendered image through the system share sheet

Rules:

- Export and share operate on a final rendered raster the user can see.
- Export does not move the project's source of truth out of app-private storage.
- Share does not replace the project-owned local copy.
- Project deletion should only affect app-private project data, not explicit exports already saved to Photos or MediaStore.

### Backup stance

Mobile backup stance is conservative.

- Projects are local-first and app-private.
- Automatic cloud backup behavior is not a product feature promise.
- The mobile spec does not rely on iCloud Drive, Google Drive, or any vendor backup surface for normal project access.
- If the OS backs up app-private data under its own platform rules, that is incidental platform behavior, not a BananaTape sync feature.
- Provider secrets are excluded from project files and must never travel with project exports or backups.

User-facing product copy should not promise cross-device restore, cloud recovery, or shared-library recovery unless a later spec approves it.

### Project archive import and export boundary

Project archive import and export are future work.

V1 does not define a user-facing archive format for:

- full project zip export
- full project import from files
- round-trip desktop-to-mobile archive handoff

Boundary rule:

- Mobile storage code should keep room for a future project archive feature.
- V1 should not imply that project folders are directly user-browsable or directly editable outside the app.
- V1 should not claim that a mobile app edits desktop `~/Documents/BananaTape Projects/` folders in place.

When archive work is approved later, it must preserve project JSON, history, reference metadata, generated assets, and unsupported desktop-only fields.

### Compatibility with current desktop persistence

The current desktop project model stores:

- manifest data with project name, id, timestamps, and settings
- history entries with provider, prompt, asset id, asset path, and parent linkage
- copied reference image metadata with asset id, path, name, mime type, and created time
- project-relative asset paths under `assets/` and `references/`

Mobile must preserve those semantics even though the physical storage location changes.

That means:

- app-private mobile storage still owns copied asset files
- project-relative relationships still matter inside the mobile project store
- imported references still behave like copied project assets, not pointers into the system gallery
- unsupported desktop-only metadata must be preserved according to the existing mobile compatibility docs

### Non-goals for v1

- direct editing of desktop `~/Documents/BananaTape Projects/` folders from mobile
- generic file-manager exposure of live project internals
- full project archive import or export
- cloud sync
- account-linked storage
- background reconciliation against external gallery assets
- automatic import of every image from the user's library
