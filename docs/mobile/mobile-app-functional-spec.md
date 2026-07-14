# BananaTape Mobile App Functional Specification

## 1. Document Purpose

This document is a product and functional specification for designing a complete BananaTape mobile app prototype in Figma.

The target reader is a human product designer. The goal is to describe every feature, screen, state, and interaction that should exist in the mobile prototype, without requiring the designer to read the codebase.

The current native mobile UI is a temporary scaffold. The new prototype should redesign the mobile app from the ground up while preserving the product model and required functionality described here.

## 2. Product Summary

BananaTape Mobile is a local-first AI image generation and editing app for iOS and Android.

Users create local projects, generate images from prompts, import/reference images, annotate images, apply AI edits, browse version history, and export/share final images.

BananaTape Mobile is a native companion editor for the existing BananaTape product. It is not a cloud dashboard, not a social image feed, and not an account-based workspace product.

### Core product traits

- Local-first project storage
- Canvas-first editing workspace
- Prompt-driven AI generation and editing
- Touch-first annotation workflow
- Branch-aware image history
- Native import/export/share flows
- OpenAI provider support with user-supplied API key
- Desktop Magic Layer compatibility as read-only preservation

## 3. Product Principles

### 3.1 Canvas first

The image canvas is the center of the product. The UI should frame the canvas and keep controls compact. Users should feel that they are inside a creative editor, not a dashboard.

### 3.2 Prompt plus annotation workflow

Text prompts are important, but editing is not only text. Users should be able to mark intent directly on the image with pen strokes, boxes, arrows, and memos, then apply an edit with a prompt.

### 3.3 Local-first trust

The app stores projects privately on the device. Avoid cloud-product language, collaboration language, or account-dashboard framing.

### 3.4 Native mobile, not desktop shrink-wrap

The design should be optimized for phone screens. Use sheets, drawers, compact toolbars, and gesture-friendly controls instead of trying to copy the desktop layout exactly.

### 3.5 Clear state, minimal noise

The app must clearly communicate loading, failure, missing API key, offline state, unsupported provider state, permission denial, and desktop-only Magic Layer state. Keep messages short and direct.

## 4. Non-Goals

Do not design these features for the mobile MVP:

- Cloud sync
- Account login
- Team collaboration
- Social feed or public gallery
- In-app project dashboard beyond local project list
- Direct editing of desktop project folders
- Full project archive import/export
- Mobile SAM3 segmentation
- Mobile Magic Layer creation or editing
- Mobile Codex provider as a working production provider
- Electron/Tauri/native desktop wrapper

## 5. Visual Direction

The current temporary Toss-style light UI should be replaced.

BananaTape should feel like a compact dark creative utility.

### 5.1 Recommended mood

- Dark creative workspace
- Canvas-dominant
- Compact controls
- Technical but approachable
- Practical, not playful
- Native iOS/Android feel

### 5.2 Color guidance

Suggested palette:

- Workspace background: `#1e1e1e`
- Elevated panel background: `#252525`
- Alternate panel background: `#2c2c2c`
- Image shell background: `#141414`
- Deep utility surface: `#111111`
- Primary text: `#f5f5f5`
- Secondary text: `#b3b3b3`
- Muted text: `#808080`
- Placeholder text: `#666666`
- Default border: white at 10 percent opacity
- Primary accent blue: `#0d99ff`
- Pressed/hover blue: `#0b85df`
- Applied/success green background: `#14351f`
- Applied/success green text: `#86efac`
- Error surface: dark red
- Error border/text: red family

### 5.3 Typography guidance

- Use native system fonts.
- Preserve readable prompt entry.
- Use compact metadata text for provider, version, timestamp, and history labels.
- Truncate long project names and prompts gracefully.
- Avoid decorative typography.

### 5.4 Component guidance

- Rounded corners around 8-16px.
- Composer and sheets can be slightly softer than dense panels.
- Controls should be touch-friendly but not oversized.
- Use blue for primary actions and selected/focused state.
- Use green only for saved/applied/persisted state.
- Do not use emoji as functional iconography.

## 6. Information Architecture

Recommended app structure:

```text
Home / Projects
  └── Project Editor
        ├── Canvas
        ├── Bottom Composer
        ├── Annotation Toolbar
        ├── History Sheet
        ├── Reference Manager Sheet
        ├── Export / Share Sheet
        ├── Provider Settings
        └── Project Settings
```

### 6.1 Primary screens

1. Home / Project Picker
2. Project Editor
3. Composer Expanded Sheet
4. History Browser
5. Reference Manager
6. OpenAI Key Setup
7. Export / Share Sheet
8. Project Settings
9. Provider Settings
10. Import / Share-in Flow
11. Magic Layer Read-only State
12. Error / Empty / Offline States

## 7. Screen: Home / Project Picker

### 7.1 Purpose

Let users create, open, and delete local projects.

### 7.2 Required content

- App title: `BananaTape`
- Local project list
- Empty state
- Create project action
- Optional import-to-new-project action
- Delete project action
- Local-first reassurance

### 7.3 Empty state

Required meaning:

- No projects exist on this device.
- The user can create a local project.

Suggested copy:

- `No projects yet`
- `Create a local project stored privately on this device.`
- Primary CTA: `New Project`
- Secondary CTA: `Import Image`

### 7.4 Project card/list item

Each project item may show:

- Project name
- Last modified time
- Latest image thumbnail if available
- History count
- Local-only badge or helper text
- Open action
- More menu
- Delete action

### 7.5 Create project flow

Required fields:

- Project name

Rules:

- Empty project name becomes `Untitled Project`.
- A local project is created in app-private storage.
- After creation, recommended behavior is to open the Project Editor immediately.

### 7.6 Delete project flow

Required behavior:

- Ask for confirmation before delete.
- Deleting a project removes app-private project data.
- Deleting a project does not delete images that the user explicitly exported to Photos/Gallery.

Suggested confirmation copy:

- Title: `Delete project?`
- Body: `This removes the local BananaTape project from this device. Exported images will not be deleted.`
- Destructive action: `Delete`
- Cancel action: `Cancel`

### 7.7 Home states

Design these states:

- First launch empty state
- Project list state
- Project creation form
- Delete confirmation
- Project open failure
- Corrupt project message

## 8. Screen: Project Editor

### 8.1 Purpose

The main workspace for image generation, editing, annotation, history browsing, reference management, and export.

### 8.2 Recommended layout

- Top bar
- Main canvas
- Floating or edge annotation toolbar
- Bottom composer
- Optional quick history affordance
- Sheets for history, references, options, and export

### 8.3 Top bar

Required controls:

- Back to Projects
- Project name
- More/settings
- Export/share access

Optional indicators:

- Provider status
- Local saved status
- Offline indicator
- Current selected history version

### 8.4 Editor states

Design these states:

1. No image yet
2. Prompt ready
3. Generating image
4. Generated image ready
5. Image selected
6. Annotation mode active
7. Edit pending
8. Edit result ready
9. Provider error
10. Offline error
11. Missing API key
12. Magic Layer desktop-only state

## 9. Canvas Functional Requirements

### 9.1 Canvas purpose

The canvas displays the current working image and annotations.

### 9.2 Canvas image sources

The canvas may display:

- Empty placeholder
- Imported image
- OpenAI generated image
- Mock generated image
- Previously generated history image
- Desktop-authored raster image
- Desktop Magic Layer-derived raster if available

### 9.3 Canvas empty state

Required meaning:

- The project has no active image yet.
- The user should generate or import an image.

Suggested copy:

- `Start with a prompt`
- `Generate an image or import one to begin.`

Suggested actions:

- `Write prompt`
- `Import image`

### 9.4 Canvas loading state

When generation or edit is pending:

- Show loading overlay or placeholder.
- Keep the project visible.
- Do not clear the prompt.
- Do not clear references or annotations.
- Show request status.

Suggested copy:

- `Generating image...`
- `Applying edit...`

### 9.5 Canvas error state

Errors should be visible but non-destructive.

Rules:

- Keep prompt text.
- Keep references.
- Keep annotations.
- Keep existing ready images.
- Do not replace history with failed output.

### 9.6 Canvas gestures

Design for:

- Pan
- Pinch zoom
- Double tap to fit or zoom optional
- Tap image to focus/select
- Tap annotation to select
- Drag annotation if supported

### 9.7 Canvas controls

Required controls or affordances:

- Fit to screen
- Current zoom optional
- Select/pan mode
- Annotation tool access
- Undo/redo access

## 10. Annotation Tools

### 10.1 Required tools

Design tool controls for:

- Pan
- Select
- Pen
- Box
- Arrow
- Memo
- Undo
- Redo

### 10.2 Tool behavior

Pen:

- Draw freeform strokes.
- Supports color and stroke width if advanced controls are shown.

Box:

- Draw rectangular intent area.
- Useful for localized edits.

Arrow:

- Draw directional intent.
- Useful for pointing to a change target.

Memo:

- Place short text note on image.
- Text memo should be editable.

Select:

- Select image or annotation.
- Show selected state.

Pan:

- Move around zoomed canvas without drawing.

### 10.3 Annotation data requirements

The UI should conceptually support these annotation types:

- Drawing paths with points, color, stroke width, and tool type
- Bounding boxes with x/y/width/height, color, and status
- Text memos with x/y, text, and color

### 10.4 Undo/redo

Undo/redo should cover mobile-owned editing operations, especially:

- Add annotation
- Remove annotation
- Move annotation
- Edit memo text
- Change annotation properties

Do not design undo/redo for desktop-only Magic Layer fields.

## 11. Bottom Composer

### 11.1 Purpose

The composer is the main action surface for prompt-based generation and editing.

### 11.2 Required fields

- Prompt text input
- Primary action button
- Provider selector
- Output size selector
- Reference summary
- Status/error message

### 11.3 Optional advanced fields

- System prompt
- Project context / design context
- Reference image strip
- Provider setup shortcut
- Prompt helper text

### 11.4 Composer modes

Generate mode:

- Primary action: `Generate`
- Enabled when prompt is not empty.

Edit mode:

- Primary action: `Apply edit`
- Enabled when a ready image is selected and prompt is not empty.
- Annotations may be included as edit guidance.

### 11.5 Composer collapsed state

Design a compact default state:

- One-line or short prompt preview/input
- Primary action button
- Small provider/size indicator
- Expand affordance

### 11.6 Composer expanded state

Design a sheet or expanded panel with:

- Full prompt field
- Provider selector
- Output size selector
- References
- System prompt
- Project context
- OpenAI key warning/setup if needed
- Submit button

### 11.7 Prompt states

Design states for:

- Empty prompt
- Prompt typed
- Prompt too short optional
- Submit disabled
- Submitting
- Success
- Failure
- Offline
- Missing API key

## 12. Provider Selection

### 12.1 Provider options

The mobile app recognizes these provider concepts:

1. OpenAI
2. Mocked
3. Codex unavailable/gated

### 12.2 OpenAI

OpenAI is the production baseline provider.

Capabilities:

- Generate image
- Edit image target capability
- Requires user API key
- Uses `gpt-image-2`

Provider states:

- Ready
- Missing key
- Offline
- Request failed
- Invalid key or unauthorized

### 12.3 Mocked provider

Mocked provider is for development and tests.

Capabilities:

- Generate success
- Edit success
- Provider error
- Offline simulation
- Delayed response
- Cancellation behavior

Design note:

- Mocked provider may be hidden in production UX or shown as a developer/testing option.

### 12.4 Codex provider

Codex is not a production mobile provider in this release.

It may appear as disabled/unavailable if product wants discoverability.

Required copy:

- `Codex is not available on mobile in this build.`
- `BananaTape mobile supports OpenAI with your own API key.`

Do not design a flow asking users to find or paste desktop Codex auth files.

## 13. OpenAI API Key Setup

### 13.1 Purpose

Let users add, replace, and remove their OpenAI API key.

### 13.2 Entry points

OpenAI key setup can be reached from:

- Composer when OpenAI is selected and no key exists
- Provider Settings
- Error state after missing key
- Error state after authentication failure

### 13.3 Required states

1. No key configured
2. Key entry form
3. Key saved/masked state
4. Replace key
5. Remove key confirmation
6. Invalid key/request failure

### 13.4 Security requirements

The design must not show the full key after save.

Show only:

- `Not configured`
- `Configured`
- Optional masked suffix, e.g. `•••• 1234`

Storage requirements for implementation:

- iOS: Keychain
- Android: EncryptedSharedPreferences backed by Android Keystore

The API key must never be stored in:

- Project JSON
- History JSON
- Canvas JSON
- Logs
- Screenshots
- Exported/shared project data

### 13.5 Suggested copy

No key:

- `Add your OpenAI API key to generate images.`

Security helper:

- `Your key is stored on this device and is not saved in project files.`

Invalid/failure:

- `OpenAI request failed. Check your API key.`

## 14. Image Generation Flow

### 14.1 Generate flow

1. User enters prompt.
2. User chooses provider.
3. User chooses output size.
4. User optionally adds references/system prompt/context.
5. User taps `Generate`.
6. App creates pending canvas image.
7. Provider request starts.
8. Result image appears on canvas.
9. History entry is created.
10. Project is saved.

### 14.2 Output sizes

Supported sizes:

- `1024x1024`
- `1024x1536`
- `1536x1024`

Design labels may be:

- Square
- Portrait
- Landscape

But include dimensions somewhere in the UI.

### 14.3 Success state

On success:

- Show generated image on canvas.
- Show success message briefly.
- Add history item.
- Enable export/share.

Suggested copy:

- `Image generated.`

### 14.4 Failure state

On failure:

- Remove pending placeholder or mark as failed.
- Keep previous ready image if one exists.
- Preserve prompt and options.
- Show stable error copy.

Suggested errors:

- `Add an API key before generating images.`
- `You are offline.`
- `OpenAI request failed. Check your API key.`

## 15. Image Edit Flow

### 15.1 Edit flow

1. User selects an existing ready image.
2. User chooses annotation tool.
3. User marks edit intent with pen/box/arrow/memo.
4. User enters prompt.
5. User taps `Apply edit`.
6. App prepares annotated image and mask.
7. Provider edit request starts.
8. Edited image appears as a new result.
9. History entry is created as child of parent image.
10. Project is saved.

### 15.2 Edit requirements

The design should include:

- Selected parent image state
- Annotation overlay
- Apply edit action
- Parent-child history relationship
- Edit pending state
- Edit success state
- Edit failure state

### 15.3 Native image preparation

The app needs to prepare:

- Annotated raster image
- Mask image
- Source metadata

Potential errors:

- Source unreadable
- Image too large
- Render failed

Suggested messages:

- `This image could not be prepared for export.`
- `This image is too large to prepare on this device.`

## 16. Reference Image Management

### 16.1 Purpose

Reference images provide visual context for generation or editing.

### 16.2 Required features

- Add reference images
- Show reference thumbnail strip
- Remove references
- Show reference count
- Preserve reference order
- Copy references into project-owned storage

### 16.3 Supported formats

Supported:

- PNG
- JPEG

Unsupported:

- WEBP
- GIF
- HEIC

Unsupported message:

- `Use a PNG or JPEG image.`

### 16.4 Import behavior

When a reference is imported:

- Validate MIME type.
- Validate size limit.
- Copy into app-private project storage.
- Do not depend on temporary picker URI.

### 16.5 Reference UI states

Design:

- No references
- References attached
- Adding references
- Unsupported file error
- Oversized file error
- Remove reference confirmation optional

Suggested labels:

- `No references`
- `1 reference`
- `3 references`
- `Add reference images`

## 17. Import and Share-in

### 17.1 In-app import

Users can import images through native pickers.

Use cases:

- Create project from image
- Add base image to project
- Add reference images

### 17.2 Share-in

Users can share an image from another app into BananaTape.

Rules:

- Accept one source image at a time for share-in.
- Accept PNG/JPEG only.
- Copy into app-private storage immediately.
- Let user create a new project or add to current project if applicable.

### 17.3 Size limit

Default maximum imported image size:

- 12 MB

Oversized message:

- `This image is too large to import.`

## 18. History Browser

### 18.1 Purpose

History lets users browse generated and edited versions.

### 18.2 History entry data

Each entry contains:

- ID
- Mode: generate or edit
- Provider
- Prompt
- Asset ID
- Asset path
- Parent ID if edited from another image
- Created timestamp
- Version ordering timestamp

### 18.3 History behavior

Required behavior:

- Show generated root images.
- Show edit children nested under parents.
- Select a history item to display it on canvas.
- Show selected state.
- Delete a history item.
- Preserve parent-child relationships.
- Fallback selection after delete.

### 18.4 History UI

Design options:

- Bottom sheet
- Slide-over drawer
- Dedicated full-screen browser

Required visual information:

- Thumbnail
- Version label, e.g. `v1`, `v2`
- Branch label, e.g. `Root`, `Edit`
- Provider badge
- Prompt preview
- Time or date
- Selected indicator
- Delete/more action
- Export selected action

### 18.5 Empty history

Suggested copy:

- `No generations yet`
- `Generated and edited images will appear here.`

## 19. Export and Share

### 19.1 Purpose

Let users save or share the final rendered image they can see.

### 19.2 Project persistence vs export

Project persistence means saving app-private project data:

- Project manifest
- History metadata
- Generated assets
- Edited assets
- References
- Canvas state

User-visible export means:

- Save final image to Photos on iOS
- Save final image to Gallery/MediaStore on Android
- Share final image through system share sheet

Export/share must not replace or move the project source of truth.

### 19.3 Export actions

Design actions:

- `Save to Photos` on iOS
- `Save to Gallery` on Android
- `Share Image`
- Optional `Copy Image`

### 19.4 Export target

Export operates on:

- Current selected canvas image
- Current selected history item
- Final rendered raster visible to the user

### 19.5 iOS Photos behavior

Required behavior:

- Save explicit exports to Photos.
- Use or create a `BananaTape` album when permissions allow.
- If album placement is unavailable, save to Photos and explain limitation.

Permission states:

- Authorized
- Limited
- Add-only
- Denied
- Restricted
- Unavailable

Suggested limited/add-only copy:

- `Saved to Photos. Allow full Photos access to place exports in the BananaTape album.`

### 19.6 Android Gallery behavior

Required behavior:

- Save explicit exports through MediaStore.
- Use relative path `Pictures/BananaTape/`.
- Handle permission denial cleanly.

### 19.7 Share behavior

Required behavior:

- Prepare temporary share file.
- Open native share sheet.
- Do not remove project-owned local copy.

## 20. Project Settings

### 20.1 Purpose

Let users manage project-level information and local data.

### 20.2 Required settings

- Rename project
- View local storage status
- Edit system prompt
- Manage references
- Delete project

### 20.3 Optional settings

- Clear temporary files
- Project metadata details
- Export project archive placeholder for future, but not an active MVP feature

### 20.4 System prompt

The system prompt is part of project settings/context.

Requirements:

- Display and edit system prompt text.
- Preserve it in project semantics.
- Make it available to generation/edit flow if used.

## 21. Provider Settings

### 21.1 Required sections

OpenAI:

- Status: configured/not configured
- Add key
- Replace key
- Remove key
- Optional test connection

Codex:

- Disabled/unavailable state
- Explanation text

Mock:

- Developer/testing option only, if shown

### 21.2 Provider availability states

Design provider rows for:

- Ready
- Missing key
- Offline
- Unsupported
- Unavailable

## 22. Magic Layer Compatibility

### 22.1 Product rule

Magic Layer and SAM3 are desktop-only authoring features.

Mobile must preserve desktop Magic Layer data but must not offer mobile Magic Layer creation or editing.

### 22.2 Mobile must not support

Do not design active controls for:

- Magic Layer creation
- SAM3 segmentation
- Magic Layer editing
- Layer dragging
- Layer hiding
- Magic Layer apply

### 22.3 Mobile must support

Mobile should:

- Preserve Magic Layer metadata.
- Keep history entries visible.
- Render final raster when possible.
- Show a clear desktop-only message when editing is unavailable.

Required message:

```text
Magic Layer editing is desktop-only
```

### 22.4 Fields to preserve conceptually

Desktop project data may contain:

- `magicLayers`
- `magicLayerBaseUrl`
- `magicLayerStatus`
- `selectedMagicLayerId`

Mobile save paths must not delete or flatten these fields.

## 23. Offline Behavior

### 23.1 Offline-supported actions

Users should be able to do these offline:

- Browse local projects
- Open local projects
- View local history
- View local references
- Import supported local images
- Export already-rendered images
- Share already-rendered images
- Edit local metadata

### 23.2 Offline-blocked actions

These require network:

- OpenAI image generation
- OpenAI image editing

### 23.3 Offline rules

Offline state must not:

- Delete local data
- Clear provider settings
- Clear imported references
- Claim a project is missing
- Clear prompt drafts

Suggested copy:

- `You are offline.`

## 24. Error and Status Copy

Use short, stable messages.

### 24.1 Common errors

- Offline: `You are offline.`
- Missing API key: `Add an API key before generating images.`
- OpenAI failure: `OpenAI request failed. Check your API key.`
- Permission denied: `Permission is needed to continue.`
- Unsupported image type: `Use a PNG or JPEG image.`
- Oversized image: `This image is too large to import.`
- Project not found: `This project could not be found.`
- Corrupt project: `This project could not be opened.`
- Export failed: `This image could not be exported.`
- Image preparation failed: `This image could not be prepared for export.`
- Image too large for composition: `This image is too large to prepare on this device.`
- Magic Layer unsupported: `Magic Layer editing is desktop-only.`
- Codex unavailable: `Codex is not available on mobile in this build.`

### 24.2 Loading statuses

Design loading states for:

- Launching app
- Loading projects
- Creating project
- Opening project
- Importing image
- Adding references
- Generating image
- Applying edit
- Saving project
- Exporting image
- Preparing share

### 24.3 Success statuses

Design success feedback for:

- Project created
- Image generated
- Edit applied
- Reference added
- Image exported
- Share prepared
- API key saved
- API key removed

## 25. Permissions

### 25.1 Network

Required for OpenAI provider calls.

### 25.2 Photos/Gallery import

Use platform-native picker flows. Normal picker import should not imply broad gallery read access.

### 25.3 Photos/Gallery export

Request or handle export permissions only when user explicitly exports.

### 25.4 Permission UX

Do not ask for permissions at first launch unless required. Ask in context when the user starts an action that needs permission.

## 26. Data Model Summary for Design Context

### 26.1 Project

A project contains:

- ID
- Name
- Created time
- Updated time
- Settings
- History
- Canvas state
- Assets
- References
- Temporary files

### 26.2 Project storage shape

Conceptual project directory:

```text
project/
  project.json
  history.json
  canvas.json
  assets/
  references/
  thumbnails/
  tmp/
```

### 26.3 Canvas image

A canvas image contains:

- ID
- URL or local asset path
- Asset ID
- Size
- Position
- Parent ID
- Generation index
- Prompt
- Provider
- Mode
- Created time
- Annotations
- Status
- Error message if any

### 26.4 History item

A history item contains:

- ID
- Generate/edit mode
- Provider
- Prompt
- Asset ID
- Asset path
- Parent ID
- Created time
- Timestamp

## 27. Prototype Deliverables Required

The Figma prototype should include at minimum these screens and states.

### 27.1 Home / Projects

- Empty first launch
- Project list with multiple projects
- Create project form
- Delete project confirmation
- Project open error

### 27.2 Editor main

- No image state
- Ready image state
- Generating state
- Edit/annotation state
- Error state
- Offline state
- Magic Layer read-only state

### 27.3 Composer

- Collapsed composer
- Expanded composer
- Empty prompt
- Prompt entered
- Provider selector
- Output size selector
- Missing API key state
- Generate loading state
- Generate success state
- Generate failure state

### 27.4 OpenAI setup

- No key configured
- Add key form
- Key saved/masked
- Replace key
- Remove key confirmation
- Request failure

### 27.5 Annotation toolbar

- Pan/select
- Pen
- Box
- Arrow
- Memo
- Undo/redo
- Active tool state
- Selected annotation state

### 27.6 Reference manager

- Empty references
- Reference thumbnails
- Add references
- Remove reference
- Unsupported file error
- Oversized file error

### 27.7 History browser

- Empty history
- Root generation item
- Edit child item
- Nested branch display
- Selected version
- Delete item
- Export selected version

### 27.8 Export/share

- Export sheet
- Save to Photos/Gallery
- Share image
- Permission denied
- Export success
- Export failure

### 27.9 Settings

- Project settings
- Provider settings
- OpenAI key management
- Codex unavailable explanation
- Delete project

## 28. Recommended Mobile Interaction Model

### 28.1 Default editor state

The editor should open with:

- Canvas as primary area
- Compact top bar
- Bottom composer visible
- Annotation/history secondary

### 28.2 Composer expansion

The bottom composer should expand into a sheet for advanced controls.

Collapsed:

- Prompt preview/input
- Generate button
- Small provider/size indicator

Expanded:

- Larger prompt field
- Provider
- Size
- References
- System prompt
- Project context
- API key setup warning

### 28.3 History access

Use a bottom sheet, drawer, or full-screen browser. It must not permanently displace the canvas.

### 28.4 Annotation access

Use a floating toolbar or compact rail. The active tool should be obvious.

### 28.5 Export access

Export should be contextual to the selected visible image/history item.

## 29. Implementation Reality Notes

Current mobile implementation already has some foundations:

- Android native scaffold
- iOS native scaffold
- Local project create/list/open/delete model
- Local project storage
- Project/history/canvas JSON validation
- Mock provider
- OpenAI generation transport
- Provider pipeline state
- Canvas image display
- Base64 generated image rendering
- History browser state
- Annotation data models
- Native image composition models
- Gallery export adapters
- Share adapters
- Inbound share/import adapter concepts

Current implementation still needs product-grade UX for:

- Real editor navigation after project open
- Generated asset persistence into project storage
- History JSON persistence after generation/edit
- Secure API key storage
- Production annotation drawing UI
- Real OpenAI edit multipart image/mask flow
- Reference picker UI
- Export/share UI
- Polished mobile visual system

Design should target the complete intended app, not the temporary scaffold.

## 30. One-Sentence Design Target

Design BananaTape Mobile as a dark, canvas-first, local AI image editor where users create a local project, generate or import an image, annotate it, apply prompt-based edits, browse branch-aware history, and export/share final results without cloud or account assumptions.
