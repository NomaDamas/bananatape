# ADR-0001: Native mobile boundary

## Status

Accepted

## Date

2026-07-03

## Context

BananaTape is a local-first image editor with a CLI-first project lifecycle today. Users create, launch, list, stop, and delete projects from the `bananatape` CLI, then use the browser editor for canvas work. The current desktop product also ships as an npm package and can be wrapped in a desktop window, but the web/CLI model remains the source of truth for desktop behavior.

The mobile native port introduces iOS and Android clients. That creates a product-boundary risk: a native app could drift into becoming a replacement roadmap for the existing web and CLI workflow, or it could imply new cloud, account, dashboard, or app-store commitments that have not been approved.

This ADR sets the boundary before any mobile implementation work begins.

## Decision

Native iOS and Android clients are additive platform clients. They must not replace web/CLI, and they must not redefine BananaTape as a mobile-first product.

The current web/CLI/npm package remains the desktop and source-of-truth product surface:

- The `bananatape` CLI stays responsible for the desktop project lifecycle.
- The existing browser editor remains the main canvas editing surface for the current product.
- The published npm package and current Next.js app stay in place.

Mobile adapts the current model instead of replacing it. Because phones do not have the CLI workflow, native mobile may include a minimal project picker with only the smallest project actions needed to use BananaTape on a phone:

- create
- open
- list
- delete

That mobile project picker exists only because the CLI does not exist on phones. It is not approval for a full in-app project dashboard, cloud workspace browser, or account-driven home screen.

## Product boundary rules

### What mobile is

- Additive native clients for iOS and Android.
- A way to access BananaTape editing flows on phones with native platform UX.
- A mobile adaptation of the existing local-first project model.

### What mobile is not

- Not a replacement for the current web/CLI product.
- Not a reason to move project management away from the CLI on desktop.
- Not a promise that the browser editor, CLI lifecycle, npm package, or current Next.js app will be retired.

## Local-first model on mobile

BananaTape keeps its local-first shape. On desktop, projects are managed by CLI and stored in local project folders. On mobile, the same product intent stays intact, but the operating system changes the entry point.

Phones do not provide the same shell-based workflow, so mobile may expose a minimal native project picker and local project actions. That is an adaptation of the CLI-first model, not a rewrite of it.

Mobile project storage remains local to the device. This ADR does not approve cloud sync, shared workspaces, accounts, or remote project ownership.

## Explicit non-goals and out of scope items

The following are out of scope for this ADR unless later approved in a separate decision:

- cloud sync
- user accounts
- remote project storage
- a full project dashboard
- replacing the web/CLI product surface
- moving the existing Next.js app or changing current CLI behavior
- App Store release planning
- Play Store release planning
- store signing workflows
- store privacy labels, screenshots, and other publication assets
- release publication readiness or submission work

When these topics appear in later work, they should be treated as non-goals unless a later ADR or plan explicitly approves them.

## Consequences

### Positive

- Protects the current BananaTape desktop product from accidental scope drift.
- Lets native mobile work proceed without breaking the CLI-first desktop workflow.
- Keeps mobile requirements narrow and conservative.
- Makes it clear that the minimal mobile picker exists because CLI is unavailable on phones.

### Tradeoffs

- Mobile will not get a richer project-management experience by default.
- Some desktop assumptions must be adapted carefully rather than copied directly.
- Store release questions stay unresolved until a later approval step.

## Reversibility

This direction is intentionally reversible.

Native apps should live in additive directories such as `apps/ios/BananaTape/` and `apps/android/`. If the native port is paused or removed, those additive directories can be deleted without moving `src/`, `bin/`, the current Next.js config, or the published desktop package structure.

That rollback path is part of the boundary: mobile extends BananaTape, but it does not become the foundation that the existing product must depend on.

## Guardrail summary

- Native mobile is additive.
- Must not replace web/CLI.
- Desktop source of truth stays with the current web/CLI/npm package.
- Mobile gets only a minimal project picker because phones do not have the CLI workflow.
- Cloud sync is a non-goal in this ADR.
- Store release and publishing work are out of scope unless later approved.
