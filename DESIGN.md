# BananaTape Design System

## 1. Atmosphere

### Purpose

This document is the root design system for BananaTape. It captures the current BananaTape web UI, then translates it into rules for native iOS SwiftUI and Android Compose work.

Use this file as the source of truth for native mobile implementation. It is extracted from the current repository UI, not invented as a new direction.

### Product shape

BananaTape is a local-first image editor for AI generation and editing. The product is canvas-first, prompt-driven, and history-aware.

Core product traits:

- Dark workspace, built for long visual editing sessions.
- Canvas is the main surface, chrome stays compact and secondary.
- Prompt entry sits at the bottom as the main action surface.
- References, system prompt, and design context live in a compact side panel.
- History is branch-aware, image-focused, and easy to revisit.
- Editing is annotation-first: pen, box, arrow, memo, then prompt.
- Local-first tone: project folders, persistent context, no cloud-first framing.

### Extraction source

This design system is extracted from these repository files:

- `src/components/EditorLayout.tsx`
- `src/components/Composer/BottomComposer.tsx`
- `src/components/Composer/PromptComposerProvider.tsx`
- `src/components/Sidebar/LeftPanel.tsx`
- `src/components/Sidebar/HistorySidebar.tsx`
- `src/components/Sidebar/HistorySection.tsx`
- `src/components/Sidebar/HistoryItem.tsx`
- `src/components/Canvas/CanvasImageItem.tsx`
- `src/components/Canvas/CanvasContainer.tsx`
- `src/components/Shell/TopBar.tsx`
- `src/components/Toolbar/ToolPalette.tsx`
- `src/components/Export/ExportModal.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/textarea.tsx`
- `src/app/globals.css`
- `docs/mobile/feature-parity.md`
- `docs/mobile/ADR-0001-native-mobile-boundary.md`

### Design principles

1. Canvas first

The image workspace is the center of the product. Controls should frame it, not compete with it.

2. Compact but legible

Panels and toolbars are dense, though never cramped. Information stacks cleanly, with small labels, restrained spacing, and strong contrast.

3. Dark by default

BananaTape is a dark creative workspace. Backgrounds stay charcoal to near-black, with soft borders and bright content contrast.

4. Prompt plus annotation workflow

Prompt text is important, though it is only part of the editing model. Users also mark intent directly on the image with paths, boxes, arrows, and sticky memos.

5. Local-first trust

UI copy and flows should feel grounded and practical. Avoid cloud-product language, collaboration theater, and dashboard bloat.

6. Clear state, minimal noise

The product uses a restrained accent palette. Blue means focus or primary action. Green confirms applied project context. Fuchsia is reserved for Magic Layer surfaces on desktop.

### Brand and voice

BananaTape should feel like a compact creative utility, not a social app, not a marketing dashboard, and not an enterprise admin tool.

Tone rules:

- Plain language.
- Short labels.
- Helpful empty states.
- Direct action copy.
- No decorative hype.
- No emoji as iconography.

Good examples:

- `Export`
- `History`
- `Add reference images`
- `Focus an image on the canvas to export it`
- `Magic Layer editing is desktop-only`

## 2. Color

### Color palette

BananaTape uses layered dark neutrals with one strong blue action color.

#### Core neutrals

- Workspace background: `#1e1e1e`
- Elevated panel background: `#252525`
- Elevated panel background, alternate: `#2c2c2c`
- Image shell background: `#141414`
- Deep black utility surface: `#111111` or `#000000`
- Selected tab or selected chip fill: `#3b3b3b`

#### Text colors

- Primary text: `#e6e6e6` to `#f5f5f5`
- Strong heading text: `#ffffff`
- Secondary text: `#b3b3b3`
- Muted text: `#999999`
- Tertiary text: `#808080`
- Placeholder text: `#666666`

#### Borders and dividers

- Default border: `white/10`
- Subtle separator: `white/15`
- Timeline connector: `#3b3b3b`
- Dashed empty border: `white/10` or `white/15`

#### Accent colors

- Primary accent blue: `#0d99ff`
- Primary accent blue hover: `#0b85df`
- Selected glow shadow: `rgba(13,153,255,0.18)` to `rgba(13,153,255,0.2)`
- Applied state green chip background: `#14351f`
- Applied state green text: `#86efac`
- Magic Layer desktop accent: fuchsia family, used only for desktop-authored Magic Layer surfaces
- Error red surface: `red-950/30`, `red-500/15`, `red-200`, `red-100`
- Memo note border: `yellow-500/60`

#### Mobile translation

- Keep the same dark tonal ladder on mobile.
- Use blue for primary buttons, selected states, focus rings, and important progress.
- Keep green only for applied context or confirmed persistence.
- Keep fuchsia out of mobile interactive controls for Magic Layer because Magic Layer creation and editing are desktop-only on mobile.

## 3. Typography

### Typography ruleset

Base type comes from `Pretendard` through `--font-pretendard`, with system fallbacks. Mono is reserved for numeric, shortcut, and code-like fragments.

#### Type families

- Sans: `Pretendard`, system sans stack
- Mono: `Geist Mono`

#### Type scale observed in UI

- 9px to 10px, badges, tiny metadata, applied chips
- 11px to 11.5px, panel headings, history row copy, helper labels
- 12px to 13px, compact body text
- 14px, standard action and field text
- 16px equivalent text-base, reusable input primitives

#### Typography rules

- Use uppercase sparingly for panel labels and tiny meta headings.
- Keep tracking slightly wider on tiny headings.
- Use medium or semibold weight for active state labels and primary metadata.
- Let prompts and image descriptions stay sentence case.
- Preserve truncation for long project and prompt text in tight surfaces.

#### Mobile translation

- Respect Dynamic Type on iOS and font scaling on Android.
- Do not freeze text at web pixel sizes. Preserve hierarchy, not exact pixel math.
- Tiny metadata should still scale, but it may clamp to maintain readability.
- Prompt fields and memo editing surfaces must favor readability over density.

## 4. Spacing

### Spacing ruleset

BananaTape uses a tight spacing system with repeated small increments.

Observed rhythm:

- 4px, micro gaps and chip padding
- 6px, compact button/icon padding
- 8px, default internal panel padding and compact stacks
- 10px, common control height marker through 40px components
- 12px, grouped content spacing
- 16px, section padding and branch indentation step
- 24px, larger empty-state and modal padding

Spacing rules:

- Panels stay compact.
- Repeated stacks use 6px, 8px, or 12px spacing.
- Empty states get more air than dense editing surfaces.
- Keep branch indentation in history visually readable.

### Radius

Global radius seed from CSS is `0.625rem`, about 10px.

Observed component radii:

- Small radius, 6px to 8px, chips, small buttons, small image thumbs
- Default radius, about 10px, cards, history items, list rows, input surfaces
- Large radius, 12px to 16px, composer shells, empty cards, elevated groups
- Extra large radius, about 16px to 18px, major floating composer shell
- Circular radius, pill and icon badges

Radius rules:

- Utility and list items use rounded corners, though not soft bubble shapes.
- Floating composer and modal surfaces feel slightly softer than panels.
- Image shells stay rounded enough to feel polished, though not playful.

### Borders, shadows, and elevation

BananaTape gets depth from dark layers, subtle borders, and selected-state glow.

#### Borders

- Most surfaces use `border-white/10`.
- Empty import areas use dashed borders.
- Selected states add blue borders or ring treatments.

#### Shadows

- Canvas image cards use deep drop shadows.
- Floating composer uses a strong black shadow and backdrop blur.
- Selected history items use a tight blue glow plus shadow.
- Empty-state icons sit on faint translucent neutral fills.

#### Elevation model

- Level 0: workspace background, `#1e1e1e`
- Level 1: fixed bars and side panels, `#252525` to `#2c2c2c`
- Level 2: inset groups and cards, `#1e1e1e`
- Level 3: floating composer, modals, context menu

#### Mobile translation

- Prefer tonal layering first, elevation second.
- iOS can use thin material blur only where it stays readable, especially around the bottom composer.
- Android can map elevation to low-to-medium Material shadows, but keep the visual result restrained.

### Icons

Current web iconography is Lucide.

Rules:

- Use simple line icons.
- Pair icons with short labels for destructive or meaningful actions.
- Icon-only buttons need accessible labels.
- No emoji as icon.

Native mapping:

- SwiftUI: SF Symbols or a custom line icon set with similar visual weight
- Compose: Material Symbols Outlined or a custom line icon set with similar visual weight

## 6. Motion

### Motion and feedback

Motion is short and practical.

Observed patterns:

- Hover and focus color changes
- Subtle opacity reveals for overlay actions
- Small selected glows
- Spinner for generation and Magic Layer preparation/apply
- Transition on memo resize and some panel changes

Motion rules:

- Keep motion fast, under roughly 200ms for simple state changes.
- Use opacity, scale, shadow, or blur changes, not large movement.
- Preserve immediate feedback for active tool, selected history item, and focused image.
- Treat loading as a content state, not a fullscreen interruption.

#### Haptics and native feedback

- iOS, use light impact for tool selection and primary commit, if platform conventions fit.
- Android, use subtle haptic confirmation for tool changes and successful commits where device support exists.
- Avoid novelty vibration.

## 5. Components

### Layout system

### Desktop source layout

The current web shell is a three-column editor with a fixed top bar and a floating bottom composer:

- Top bar, 40px tall
- Left context panel, 248px wide
- Main canvas region, flexible
- Right history sidebar, 288px wide on xl
- Bottom composer, fixed, inset from edges, width capped at 5xl

### Layout behavior principles

- Canvas must always be the dominant spatial surface.
- Panels are secondary and may collapse or convert on smaller devices.
- The composer should remain reachable while preserving enough canvas area to inspect the image.

### Core components and patterns

### Project picker

Desktop source does not include an in-app project dashboard. Mobile needs a minimal native project picker because phones do not have the CLI.

Mobile project picker basics:

- Simple list of local projects
- Create project
- Open project
- Delete project
- No cloud sync
- No account screen
- No workspace feed
- No heavy dashboard chrome

Visual guidance:

- Keep it quiet and utility-like.
- Reuse dark surfaces, compact rows, and concise metadata.
- Project name first, secondary file or time info second.

### Editor shell

The editor shell includes:

- Product mark and project name
- Export affordance
- Canvas-mode emphasis
- Fixed side surfaces on desktop
- Floating bottom composer as the main creation surface

Native translation:

- Keep the project title visible near the top.
- Keep export reachable, though not dominant.
- Do not recreate desktop panel toggles if the mobile structure changes.

### Canvas

Canvas behavior defines the product.

Visual characteristics:

- Dark matte background
- Large central workspace
- Strong focus ring around selected image
- Generous card shadow under placed images
- Loading and error states embedded in the image shell
- Hidden image state uses a checker-like muted treatment

Canvas interaction model:

- Pan tool
- Pen tool
- Box tool
- Arrow tool
- Sticky memo tool
- Move image tool
- Magic Layer tool on desktop only

Canvas gesture language for mobile:

- One-finger draw for annotation tools
- One-finger drag for move mode
- Two-finger pan
- Pinch to zoom
- Tap to focus image
- Long press for secondary item actions only if needed

Mobile must keep gesture conflicts low. Annotation tools should disable competing gestures when drawing starts.

### Annotation toolbar

Toolbar pattern:

- Compact row of icon buttons
- One active tool at a time
- Clear annotations action separated by a divider

Tool order from current web UI:

1. Pan
2. Pen
3. Box
4. Arrow
5. Sticky memo
6. Move image
7. Magic Layer, desktop only

Mobile translation:

- Keep tool order familiar.
- Surface the toolbar near the canvas, either as a horizontal rail or segmented bottom accessory.
- Minimum touch target is 44x44 pt on iOS and 48x48 dp on Android.
- Keep the clear action visually separated from creation tools.

Android shell placement keeps the annotation rail horizontal and aligned above the canvas so the full tool set remains reachable without covering the image.

### Prompt composer

The bottom composer is the main command surface.

Observed structure:

- Floating container over canvas
- Tool palette embedded at the top of the composer
- Output size picker
- Provider picker
- Magic Layer trigger on desktop
- Undo and redo
- Reference attachment button with count badge
- Multi-line prompt field
- Parallel generation stepper
- Primary generate or edit button
- Tiny helper row for shortcut hint and character count

Behavior rules:

- Primary button label changes between `Generate`, `Apply edit`, and `Edit · N regions`.
- Prompt can be optional for annotation-driven edits.
- Prompt should stay multi-line, though compact.
- References are visible as small removable thumbnails.

Mobile translation:

- Composer should dock at the bottom and respect the safe area.
- Keep the composer above the keyboard when editing text.
- Use a collapsed and expanded state if needed.
- Put advanced controls, such as provider and output size, behind secondary affordances if space is tight.
- Do not hide the primary action behind a second screen.
- Keep attach reference and prompt field on the first layer.

Keyboard handling:

- On iOS, anchor the composer to the safe area, then shift it with keyboard avoidance.
- On Android, keep the composer visible above IME insets.
- Never let the keyboard cover the primary action.

### References

Reference behavior in the web UI:

- Add through picker or paste
- Thumbnail grid in left panel
- Small inline thumbnails in composer
- Remove per-item or clear all

Mobile translation:

- Support native photo picker import for PNG and JPEG.
- Show references as a compact horizontal strip or grid.
- Keep remove affordances simple and direct.
- Preserve ordering.

### History

History is image-focused and branch-aware.

Observed pattern:

- Right sidebar on desktop
- Empty states for no focus, multi-focus, and no history
- Branch indentation by generation depth
- Root and edit section headers with thumbnail and prompt summary
- Timeline rows with preview, type badge, provider badge, version number, and timestamp
- Selected row gets blue border, glow, and top accent bar

Mobile translation:

- Use a compact history sheet, tab, or segmented panel.
- Default to hidden or collapsed so canvas space remains dominant.
- Preserve one-branch-at-a-time browsing.
- Keep selected state strong and obvious.
- Thumbnails remain essential.

### Provider and settings surfaces

Observed provider surfaces:

- Provider selector inside composer
- System prompt editor in left panel
- Design system file viewer in left panel

Mobile translation:

- System prompt and design context belong in a compact settings or project-context sheet.
- Provider switching can live in composer overflow or project settings.
- Preserve the distinction between editable system prompt and read-only uploaded design system content.

### Design system file surface

Desktop already treats uploaded `DESIGN.md` as a read-only project context artifact.

Rules to preserve:

- Show filename.
- Render markdown read-only.
- Allow replace.
- Allow clear.
- Do not let users directly edit the uploaded markdown in place.

### Export and share

Observed export pattern:

- Export opens a compact modal
- Exports focused images only
- Copy says annotations are excluded
- Single and multi-download flows exist

Mobile translation:

- Use platform share sheet and save-to-gallery actions.
- Export should clearly target the currently focused or visible image.
- Keep wording direct, especially if annotations are omitted from exported PNGs.

### Permission prompts

Mobile permission prompts should appear only when needed:

- Photo picker or gallery import
- Save to Photos or Gallery
- Share destination handoff, if platform requires it

Rules:

- Ask in context.
- Explain why the permission is needed in product copy before the system prompt if possible.
- Do not front-load permissions on first launch.

### Prototype mobile patterns

The confirmed native prototype adds a tighter mobile-specific component layer inside the existing BananaTape dark system. These patterns should inherit the current dark canvas principles, compact chrome, and local-first tone.

#### Prototype mobile tokens

Use these semantic additions when translating the prototype screens to native components:

- Project list background: `#1e1e1e`
- Project list card background: `#252525`
- Project list card border: `rgba(255,255,255,0.10)`
- Project list CTA bar background: `#252525`
- Project list CTA bar border: `rgba(255,255,255,0.10)`
- Project list primary CTA fill: `#0d99ff`
- Project list primary CTA pressed: `#0b85df`
- Project list primary CTA text: `#ffffff`
- Project list secondary CTA fill: `#1e1e1e` or transparent over elevated dark shell
- Project list secondary CTA border: `rgba(255,255,255,0.10)`
- Project list secondary CTA text: `#f5f5f5`
- Floating toolbar background: `#252525`
- Floating toolbar button background: `#2c2c2c`
- Floating toolbar button active fill: `#0d99ff`
- Floating toolbar icon inactive: `#b3b3b3`
- Floating toolbar icon active: `#ffffff`
- New Project dialog surface: `#252525`
- New Project dialog title: `#ffffff`
- New Project name field surface: `#1e1e1e`
- New Project name text: `#f5f5f5`
- New Project field label and placeholder: `#b3b3b3`
- New Project focused border and cursor: `#0d99ff`
- Compact composer background: `#252525`
- Compact composer border: `rgba(255,255,255,0.10)`
- Composer sheet background: `#252525`
- Composer sheet raised group background: `#2c2c2c`
- Composer sheet textarea background: `#1e1e1e`
- Composer sheet footer background: `#252525`
- History sheet background: `#252525`
- History row background: `#2c2c2c`
- History row selected border: `#0d99ff`
- History row selected glow: `rgba(13,153,255,0.18)` to `rgba(13,153,255,0.20)`
- Action menu background: `#252525`
- Action menu row background: `#252525`
- Action menu divider: `rgba(255,255,255,0.08)` to `rgba(255,255,255,0.15)`
- Destructive action text: light red on dark neutral background
- Missing-key warning panel: dark red family with light red or white text
- Root history badge: `#14351f` background with `#86efac` text
- Edit history badge: muted purple or magenta family, kept secondary to the main blue accent

Spacing and shape additions for the prototype layer:

- Mobile screen inset: `16px`
- Header inset on project list: `20px`
- Project list card gap: `8px`
- Prototype sheet section gap: `16px` to `20px`
- Prototype major card radius: `16px`
- Prototype sheet and floating shell radius: `16px` to `18px`
- Canvas image shell radius on mobile editor: `28px`
- Circular action button radius: full pill

#### Prototype project list

The project list is the native mobile home surface. It should read as a dark local-project utility screen, not as a dashboard.

Structure:

- Full-screen dark project list background using `#1e1e1e`
- Top safe-area inset with a left-aligned header block
- Eyebrow label `Local Projects`
- Product title `BananaTape`
- Scrollable stack of card rows
- Privacy note above the CTA bar
- Sticky bottom CTA bar with `New Project` primary and `Import` secondary

Card row pattern:

- Use elevated dark card rows with `16px` radius, subtle white-alpha border, and `8px` vertical stack gap
- Place thumbnail left, project name and metadata center, circular more button right
- Project name is the first line and should stay semibold and readable at a glance
- Metadata follows the `{version count} versions · {time} · Local` format
- Keep the more button secondary and circular

CTA bar pattern:

- The bottom CTA bar is a floating elevated shell above the safe area, not a flat footer
- `New Project` is the dominant blue action
- `Import` is secondary, quieter, and outlined or dark-filled
- Maintain enough bottom clearance that the CTA bar never feels pressed into the device edge

#### Prototype editor

The prototype editor keeps the canvas dominant and lets controls float around it in compact dark shells.

Structure:

- Full-screen dark workspace using `#1e1e1e`
- Top bar with back, title, provider status, export, and more
- Large centered image shell over the darkest canvas field
- Left floating vertical toolbar
- Bottom compact composer
- Floating version pill above the composer

Top bar rules:

- Keep back, export, and more as circular icon buttons
- Keep the project title visible and left-centered in the text block
- Show provider status as tiny uppercase utility metadata, such as `OPENAI · NO KEY`
- If the provider is unavailable, the warning state belongs in the status text and composer sheet, not as a full-screen interruption

Floating vertical toolbar pattern:

- Dock a rounded dark floating rail near the left edge of the canvas
- Use the confirmed tool order: Pan, Select, Pen, Box, Arrow, Memo, Undo, Redo
- Active tool uses a blue filled circular button with white icon
- Inactive tools use dark raised buttons with secondary icon color
- Preserve generous hit areas even if the visible icons stay compact

Compact bottom composer pattern:

- Use a compact bottom composer shell anchored above the safe area
- Keep prompt preview or placeholder on the first line
- Show provider and output size summary on the secondary line
- Include an expand affordance and a visible `Generate` primary button on the resting state
- Keep the version pill separate from the composer so history remains one tap away

Version pill pattern:

- Use a compact dark translucent pill, such as `v5 · 1024x1024`
- Place it above the compact composer and below the image centerline
- Use utility-weight text so it reads as status, not as a headline

#### Prototype composer sheet

The composer sheet is the expanded bottom sheet for full generation setup. It should feel denser than a settings form and remain visibly tied to the editor.

Structure:

- Bottom sheet with rounded top corners and dark elevated background
- Header row with `Generate` title and close button
- Prompt textarea near the top
- Missing-key warning below the prompt when OpenAI is selected without credentials
- Provider segmented control with `OpenAI`, `Mocked`, and disabled `Codex`
- Output size selector with Square, Portrait, and Landscape options
- References summary with count and `Manage`
- System prompt or project context field
- Sticky footer `Generate` button

composer sheet details:

- The prompt field should stay large enough for multi-line drafting
- The missing-key warning should use a dark red panel, short copy, and nearby `Add key` action
- Provider options should read as compact segmented cards, with blue border or fill on the active state
- Keep `Codex` visibly disabled so mobile matches the current prototype and existing mobile guidance
- Output size options should sit in an equal-width three-up grid when space allows
- The references summary can stay compact on the main sheet, though the prototype may preview thumbnails when present
- The system prompt field should read as stable project guidance, not as a transient chat note
- Keep the sticky `Generate` button visible while the rest of the sheet scrolls

#### Prototype history sheet

The history sheet is a branch-aware bottom sheet that preserves the core BananaTape version model while staying compact enough for mobile.

Structure:

- Dark history sheet background with a short drag handle
- Header with `History`, `Branch-aware · tap to load`, and close button
- Scrollable stack of version rows
- Selected row highlighted with blue border and glow

history sheet row pattern:

- Each row contains thumbnail, version badge, branch badge, provider badge, prompt preview, relative timestamp, delete, and export
- Use green family badges for `Root`
- Use muted purple or magenta family badges for `Edit`
- Keep provider badges quieter than version and branch badges
- Keep prompt previews to one or two lines with truncation
- Preserve one-tap version loading from the row itself

Selection and action rules:

- Current version must stay visually obvious through border and glow, not only text weight
- Delete and export should remain trailing icon actions on each row
- Relative times should stay compact and secondary

#### Prototype action menu

The action menu is a bottom menu for project-level overflow actions. It should feel lighter than the full composer sheet, though it still uses the same dark layered language.

Structure:

- Dark bottom menu with drag handle
- Full-width action rows with leading line icons
- Optional trailing metadata on `Reference images`
- Internal divider before the destructive action

action menu rows:

- `History`
- `Reference images`
- `Project settings`
- `Provider settings`
- `Delete project`

Row rules:

- Make the whole row tappable
- Keep labels short and direct
- Use trailing metadata such as `2 references` only where it adds immediate context
- Separate `Delete project` from utility rows with a divider and red-accent treatment
- Do not overload this menu with tertiary actions that belong elsewhere

## States

### Empty states

BananaTape uses quiet, centered empty states with muted icon containers and short helper copy.

Patterns to preserve:

- Neutral icon in soft rounded container
- One clear line of guidance
- One supporting line
- No illustration overload

Important empty states:

- No image focused
- Multiple images focused when history wants one
- No history yet
- No references yet
- No design system uploaded
- No export target selected

### Loading states

Loading stays inside the affected surface.

Examples:

- Image shell generation spinner
- `Preparing AI…` for desktop Magic Layer setup
- Apply spinner for desktop Magic Layer apply

Rules:

- Keep layout stable during loading.
- Use short labels.
- Prefer inline spinners to blocking full-screen overlays.

### Error states

Error treatment is compact and local.

Observed pattern:

- Tinted red panel inside the image shell
- Clear failure title
- Short error text
- Retry action nearby

Rules:

- Explain what failed.
- Put retry close to the message.
- Avoid technical panic language.

## Accessibility

Accessibility is part of the product shape, not a later patch.

Rules:

- Minimum touch target, 44x44 pt on iOS, 48x48 dp on Android.
- Keep primary text contrast high against dark backgrounds.
- All icon-only controls need accessibility labels.
- Use semantic labels for tool buttons, history actions, export actions, and reference actions.
- Preserve visible focus states for keyboard-capable environments.
- Memo editing needs clear text cursor state and readable contrast.
- Support Dynamic Type and Android font scaling.
- Keep truncation for dense rows, though expose the full content in accessibility labels where useful.

Suggested accessibility labels:

- `Add reference image`
- `Remove reference image`
- `Export focused image`
- `Undo`
- `Redo`
- `Parallel generations`
- `Magic Layer editing is desktop-only`

### Mobile translation

This section defines how to adapt the current web UI to native iOS and Android.

### Safe area

- Respect top and bottom safe area insets at all times.
- Use safe-area aware layout behavior for composer docking, sheets, and edge-to-edge canvas presentation.
- The bottom composer must sit above the bottom safe area, not flush into the device edge.
- Floating bars and sheets must account for home indicator space and gesture navigation space.

### Bottom composer placement

- Keep the composer bottom-docked.
- Treat it as the main action surface, not an optional accessory.
- Allow a compact resting state if the canvas needs more room.

### Keyboard avoidance

- Move or resize the composer so the prompt field and primary action remain visible.
- The image canvas may shrink while typing, though input controls must remain reachable.

### Compact history

- Replace the desktop right sidebar with a history sheet, history tab, or docked secondary panel.
- Default to one image branch at a time.
- Keep branch depth readable.

### Touch target

- All tappable controls must meet platform touch target minimums.
- Dense desktop icon buttons should gain larger invisible hit areas on mobile.

### Project picker basics

- Mobile may include only the minimal local project picker described in the mobile ADR.
- Do not expand into a full dashboard, cloud browser, or account home.

### Canvas gesture language

- Two-finger navigation should not interfere with one-finger drawing.
- Focus, zoom, and pan need clear priority rules.
- Image move mode must be explicit, not accidental.

### Accessibility labels

- Convert all icon-only actions into named accessible controls.
- Ensure history thumbnails, references, and export rows have descriptive labels.

### Dynamic Type and font scaling

- Let titles, body text, and input text scale.
- Keep tiny metadata readable, though secondary.
- If a dense surface breaks at large sizes, reflow it instead of clipping important text.

### No emoji-as-icon rule

- Use SF Symbols, Material Symbols, or another line icon set.
- Never use emoji in place of product icons.

### Native component guidance

#### SwiftUI

- Use layered `Color` surfaces with clear semantic tokens.
- Use `safeAreaInset(edge: .bottom)` or an equivalent bottom-composer pattern.
- Use `toolbar` only for truly top-level actions, not for the whole editing control set.
- Keep history, settings, and references in sheets or secondary panels when needed.

#### Compose

- Use edge-to-edge with explicit window inset handling.
- Place the composer in a bottom-aligned container that reads IME and navigation bar insets.
- Keep canvas and bottom composer in one coordinated scaffold.
- Use tonal elevation sparingly, since the source UI depends more on dark layering than on Material card stacks.

### Magic Layer rules for mobile

Magic Layer has strict mobile limits.

Mobile must not add:

- SAM3 creation flow
- Magic Layer creation controls
- Magic Layer editing controls
- Magic Layer drag controls
- Magic Layer hide controls
- Magic Layer apply controls

Mobile must do this instead:

- Preserve desktop-authored Magic Layer fields
- Render a faithful raster when possible
- Keep history items visible
- Show `Magic Layer editing is desktop-only` when the user reaches an unsupported state

Desktop-only note:

The current web UI includes Magic Layer activation, dragging, hide, and apply behavior. Those behaviors define desktop source behavior, though they do not grant permission to recreate them on mobile.

### Do and don't rules

### Do

- Keep BananaTape dark, compact, and canvas-first.
- Keep the bottom composer central.
- Preserve local-first project behavior.
- Preserve prompt, references, annotations, history, and export semantics.
- Keep copy short and practical.
- Use blue for primary action and selection.
- Use safe area aware layouts.
- Use platform-native text scaling and hit target sizing.

### Don't

- Don't add a full mobile dashboard.
- Don't add cloud sync, accounts, or remote workspaces.
- Don't turn the product into a mobile-first social surface.
- Don't replace the current desktop web and CLI source of truth.
- Don't add mobile SAM3 or Magic Layer authoring.
- Don't show fake mobile Magic Layer edit, drag, hide, or apply controls.
- Don't use emoji as icons.
- Don't brighten the workspace into a light-theme-first product.

## 7. Depth

### Depth and surface model

BananaTape uses dark surface stacking rather than loud card separation.

- Base workspace depth starts at `#1e1e1e`.
- Elevated rails and panels step up to `#252525` and `#2c2c2c`.
- Inset cards usually return to `#1e1e1e`.
- Floating surfaces, like the bottom composer and modals, add stronger shadow and blur.
- Focus and active selection use the blue accent `#0d99ff` instead of heavy color fills.

The goal is calm depth, not glossy spectacle.

### Implementation checklist for native teams

- Define semantic tokens from the palette above.
- Build a dark editor shell with canvas priority.
- Implement a safe area aware bottom composer.
- Build compact reference, history, and settings surfaces.
- Preserve the desktop project semantics described in mobile docs.
- Treat Magic Layer as desktop-authored, read-compatible content only.
- Keep accessibility labels, Dynamic Type, and touch target sizing in the first pass.
