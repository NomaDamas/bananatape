# Mobile monorepo layout guardrail

## Status

Accepted for the native mobile port guardrail work on 2026-07-03.

## Decision

BananaTape will use an additive monorepo shape for native mobile work without moving the current web app. The root package remains the published `bananatape` npm package and stays responsible for the existing Next.js web editor, CLI, standalone build, and npm release metadata.

No npm `workspaces` field is added yet. There are no child JavaScript packages under `apps/` or `packages/` today, so workspace metadata would not discover anything useful and would create package-manager behavior before the native scaffolds or shared contracts package exist. The package manager remains npm because `package-lock.json` and the npm publish workflow already define that contract.

Future tasks may add npm workspaces only when a real npm package exists, such as `packages/mobile-contracts/package.json`. If that happens, the root `package.json` must keep the package name `bananatape`, the current version source, `bin.bananatape`, and the existing `files` entries that publish `bin/`, `src/`, `public/`, Next config, build outputs, docs images, and skills.

## Directory ownership

```text
./
  package.json                         # published bananatape web/CLI npm package
  package-lock.json                    # npm lockfile; npm remains the package manager
  bin/                                 # current CLI entrypoint and runtime launch behavior
  src/                                 # current Next.js web editor and local-first app logic
  public/                              # current web/static assets
  next.config.ts                       # current standalone Next build config
  docs/mobile/                         # mobile decisions, guardrails, and specs
  apps/ios/BananaTape/                 # future additive SwiftUI iOS app
  apps/android/                        # future additive Kotlin/Jetpack Compose Android app
  packages/mobile-contracts/           # future shared schemas, fixtures, and contract tests
```

### Root web and CLI package

The repository root remains the desktop source of truth. It owns the existing browser editor, CLI project lifecycle, npm package metadata, Next.js standalone build, and release workflow. Mobile work must not move `src/`, `bin/`, `public/`, `.github/workflows/npm-publish.yml`, or `next.config.ts` as part of the native port.

The root package keeps publishing as `bananatape`. Native app directories are not part of the npm package by default, and they should not be added to `files` unless a later release decision explicitly needs a mobile artifact in the npm tarball.

### `apps/ios/BananaTape/`

This future directory owns the native iOS app. It should contain SwiftUI app source, iOS tests, Xcode project or package files, iOS assets, and iOS-specific README/evidence commands. It must treat the root web/CLI package as a preserved sibling, not as code to be moved into an app workspace.

### `apps/android/`

This future directory owns the native Android app. It should contain the Gradle project, Kotlin/Jetpack Compose app source, Android unit/instrumented tests, Android assets, and Android-specific README/evidence commands. It must not replace the root npm scripts or require a new JavaScript package manager.

### `packages/mobile-contracts/`

This future directory owns shared mobile contract material only: JSON schemas, golden fixtures, compatibility notes, fixture images, and tests that validate project data semantics across desktop and native mobile. It should not become a dumping ground for web runtime code during the first mobile wave.

If `packages/mobile-contracts/` later becomes an npm package, add workspace metadata in the smallest npm-compatible form and update `package-lock.json` with npm. Do not introduce Turbo, pnpm, or Yarn for that change unless a separate document explains why npm cannot cover the need.

## Tooling guardrail

- Keep npm as the package manager.
- Do not add Turbo, pnpm, Yarn, or a task runner just to name directories.
- Do not add dependencies for the guardrail itself.
- Add npm workspaces only when there is an actual child npm package to install, test, or publish.
- Keep native build tools local to their native app directories when those scaffolds are created.

## Rollback

The native mobile port remains reversible. If the port is paused or removed before shipping, delete the additive native directories and contracts package:

```text
apps/ios/BananaTape/
apps/android/
packages/mobile-contracts/
```

Rollback must not require moving `src/`, `bin/`, `public/`, `.github/workflows/npm-publish.yml`, or `next.config.ts`, and it must not require changing the root `bananatape` npm package identity. If workspace metadata is added in a later task, rollback includes removing only that additive workspace metadata and regenerating `package-lock.json` with npm.
