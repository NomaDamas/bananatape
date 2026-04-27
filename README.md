# BananaTape

<p align="center">
  <img src="docs/images/bananatape-editor-annotated-request.jpg" alt="BananaTape editor with references, a generated poster, canvas annotations, and history" width="100%" />
</p>

<p align="center">
  <img src="docs/images/bananatape-editor-workspace-context.jpg" alt="BananaTape local-first image editing workspace showing annotation-driven editing and version history" width="100%" />
</p>

**BananaTape is a local image editor for AI image generation and editing.** Write a prompt, mark up the image, attach references, and keep the results in a project folder.

It is meant for quick iteration: generate an image, annotate what should change, run an edit, and go back to earlier versions when needed.

## What the editor gives you

- **Canvas annotations.** Draw boxes, arrows, pen marks, and sticky notes over the image before editing.
- **Project context.** Keep a system prompt and reference images attached to the project.
- **Version history.** Save each generation or edit in the sidebar and reopen earlier results.
- **Local project folders.** Store project metadata, references, and generated assets on disk.
- **CLI project management.** Create, launch, list, stop, and delete projects from the command line.

The goal is not to replace a full design tool. It is a small editor for prompt-based image work where visual notes are easier than writing a long prompt.

## Quick start

Install the CLI from npm:

```bash
npm install -g bananatape
```

Create a project and open the editor:

```bash
bananatape create "Logo Explorations"
bananatape launch logo-explorations
```

The editor opens in your browser at `127.0.0.1` on an available port. Each project runs independently, so multiple projects can be open at the same time.

Basic loop:

1. Add a system prompt if the project needs consistent context.
2. Attach reference images if needed.
3. Type a prompt and generate an image.
4. Mark up the image with boxes, arrows, pen strokes, or sticky notes.
5. Run an edit.
6. Use the history sidebar to return to earlier results.

Useful commands:

```bash
bananatape list
bananatape status
bananatape launch <project>
bananatape stop <project>
bananatape delete <project>
```

## Provider setup

BananaTape has two provider options in the editor.

### OpenAI

The OpenAI provider reads `OPENAI_API_KEY` from the environment.

```bash
export OPENAI_API_KEY="sk-..."
bananatape launch logo-explorations
```

For a persistent local setup, add the export to your shell profile, such as `~/.zshrc`, then restart the shell.

### codex

The `codex` provider uses the local Codex auth file at:

```text
~/.codex/auth.json
```

Set it up by installing and signing in to Codex CLI first. After login, launch BananaTape from the same machine:

```bash
bananatape launch logo-explorations
```

If the auth file is missing or expired, the `codex` provider will fail until Codex CLI is signed in again.

## Quick start for AI agents

When operating this repo or helping a user run BananaTape, use these steps:

```bash
# Install published CLI
npm install -g bananatape

# Optional: configure where local project folders are stored
export BANANATAPE_PROJECTS_DIR="$HOME/Documents/BananaTape Projects"

# Provider choice A: OpenAI
export OPENAI_API_KEY="<user-provided-key>"

# Provider choice B: codex
# Verify the user has signed in with Codex CLI and ~/.codex/auth.json exists.
test -f "$HOME/.codex/auth.json"

# Create and launch a project
bananatape create "Agent Smoke Test"
bananatape launch agent-smoke-test --no-open

# Inspect runtime state
bananatape status agent-smoke-test
```

Agent notes:

- Do not ask users to paste API keys into README examples, issues, or commits.
- Prefer environment variables or the user's existing shell profile for `OPENAI_API_KEY`.
- Do not modify `~/.codex/auth.json`; ask the user to sign in with Codex CLI if it is missing.
- Use `BANANATAPE_PROJECTS_DIR` for reproducible local project locations during tests.
- Use `bananatape stop <project>` when a smoke test is finished.

## What BananaTape does

- Generate a new image from a prompt.
- Edit an image by drawing directly on the canvas.
- Add sticky memo notes, arrows, and boxes to explain changes visually.
- Attach reference images from the file picker or clipboard paste.
- Keep a project history so you can jump back to a previous version.
- Persist project results, system prompts, and reference images in local folders.
- Launch and manage projects from a CLI while keeping the editor UI focused on image work.

## Why BananaTape

BananaTape keeps the image workflow simple and keeps project management outside the editor UI.

| Traditional tools | BananaTape |
| --- | --- |
| Layers, masks, tool modes | Prompt, annotate, generate |
| Pixel-perfect selections | Sticky notes, arrows, boxes |
| Design vocabulary required | Plain-language instructions |
| Complex file/project UI | CLI-managed local project folders |
| Manual versioning | History sidebar |

## Local-first project model

BananaTape is designed first as a local app that runs a Next.js server on `127.0.0.1` and opens in your normal browser. It does **not** use Electron, Tauri, Photino, or a native wrapper in the current V1.

Projects are regular folders on disk. By default they are stored at:

```text
~/Documents/BananaTape Projects/
```

You can override the root directory with:

```bash
export BANANATAPE_PROJECTS_DIR="/path/to/projects"
```

Each project looks like this:

```text
my-project/
  project.json          # project metadata, system prompt, reference metadata
  history.json          # generated/edited image history
  assets/               # generated and edited images
  references/           # project-level reference images
  thumbnails/           # reserved for future thumbnails
  tmp/                  # reserved for temporary files
```

Project management is intentionally CLI-first. The editor does not include a project dashboard, project creation screen, cloud sync, or complex asset browser.

## CLI usage

### Commands

```bash
bananatape create <name> [--dir <parent>]
bananatape list
bananatape launch <project> [--port <port>] [--no-open] [--rebuild]
bananatape open <project>
bananatape status [project]
bananatape stop <project|--all>
bananatape delete <project> [--delete-files]
```

Notes:

- `launch` and `open` are aliases.
- Multiple projects can run at the same time on different ports.
- `status` shows running projects, ports, PIDs, and launch IDs.
- `delete <project>` unregisters the project but keeps files by default.
- `delete <project> --delete-files` removes the project folder from disk.

## Development server

For normal Next.js development without a project folder:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

In this mode, BananaTape still works as an editor, but project persistence is only active when launched with `BANANATAPE_ACTIVE_PROJECT_PATH` through the CLI.

## Environment variables

Common variables:

```bash
BANANATAPE_PROJECTS_DIR   # optional project root override
BANANATAPE_HOME           # optional CLI runtime/registry directory override
OPENAI_API_KEY            # required for OpenAI provider calls
```

The CLI sets these automatically for launched app instances:

```bash
BANANATAPE_ACTIVE_PROJECT_PATH
BANANATAPE_LAUNCH_ID
```

## Testing and quality checks

```bash
npm run lint
npm run typecheck
npx vitest run
npx playwright test
npm run build
```

Useful smoke test:

```bash
npm run build
node bin/bananatape.mjs create "Smoke Test"
node bin/bananatape.mjs launch smoke-test
```

Then generate or edit an image and inspect:

```bash
cat ~/Documents/"BananaTape Projects"/smoke-test/history.json
ls ~/Documents/"BananaTape Projects"/smoke-test/assets
```

## Release and npm publishing

BananaTape publishes to the public npm registry from GitHub Releases.

Release flow:

1. Make sure the release workflow exists on `main`.
2. Add an npm automation token to the GitHub repository secret named `NPM_TOKEN`.
3. Create and publish a GitHub Release with a semver tag such as `v0.2.0` or `0.2.0`.
4. The GitHub Action checks out that tag, extracts `0.2.0`, runs:

   ```bash
   npm version 0.2.0 --no-git-tag-version --allow-same-version
   npm run lint
   npm run typecheck
   npx vitest run
   npm run build
   npm publish --access public --provenance
   ```

5. The package is published as `bananatape@0.2.0`.

The workflow intentionally derives the npm version from the release tag so `package.json` does not need to be manually updated before every release.

## Current V1 non-goals

- No Electron/Tauri/native desktop wrapper.
- No in-app project dashboard or project creation UI.
- No cloud sync.
- No complex asset browser.
- No parallel multi-version generation UI yet.

## Intended users

BananaTape is for people who need to generate or edit images with prompts and quick visual notes. It is useful for small design tasks, marketing drafts, product mockups, and image iteration where a full design tool would be more setup than needed.
