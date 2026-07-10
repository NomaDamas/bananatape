# BananaTape mobile contracts fixtures

This package is a test-only contract area for the native mobile port. It mirrors the current desktop project folder concepts without moving runtime web or CLI code into `packages/`.

The fixtures intentionally cover:

- `project.json` desktop manifest data and settings.
- `history.json` desktop image history entries.
- `canvas.json` V1 canvas state used by the persistence migration tests.
- Project-owned generated assets under `assets/`.
- Project-owned reference assets under `references/`.
- Desktop-authored Magic Layer fields that mobile must preserve read-only.

Mobile implementations should treat these fixtures as golden compatibility inputs. Unsupported desktop-only fields must be preserved during import, save, and project export.
