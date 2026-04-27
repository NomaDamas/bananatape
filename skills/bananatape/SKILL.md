---
name: bananatape
description: Use BananaTape CLI to create, launch, inspect, and clean up local AI image editing projects from an agent.
---

# BananaTape

BananaTape is a local-first browser editor for AI image generation and editing. Use this skill when an agent needs to run BananaTape for a user, create a project, launch the editor, or perform a smoke test.

## Requirements

- Node.js 22+
- BananaTape CLI: `npm install -g bananatape` or `npx bananatape ...`
- A provider setup:
  - OpenAI: `OPENAI_API_KEY` in the environment
  - codex: Codex CLI already signed in with `~/.codex/auth.json`
- Optional project location override: `BANANATAPE_PROJECTS_DIR=/path/to/projects`

Do not print, commit, or ask the user to paste secret API keys into files. Do not edit `~/.codex/auth.json`; ask the user to sign in with Codex CLI if it is missing.

## CLI

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
- Projects are local folders; by default they live under `~/Documents/BananaTape Projects/`.
- Multiple projects can run at once on different ports.
- Use `--no-open` for agent smoke tests or headless checks.
- `delete` unregisters a project by default; `--delete-files` also removes the project folder.

## Basic agent usage

```bash
# Install if needed
npm install -g bananatape

# Optional deterministic test location
export BANANATAPE_PROJECTS_DIR="$PWD/.bananatape-projects"

# Configure one provider before launch
export OPENAI_API_KEY="<user-provided-key>"
# or verify Codex auth exists:
# test -f "$HOME/.codex/auth.json"

bananatape create "Agent Smoke Test"
bananatape launch agent-smoke-test --no-open --port 45991
bananatape status agent-smoke-test

# Optional readiness check
curl --fail --silent --show-error http://127.0.0.1:45991/api/projects/current

# Clean up when done
bananatape stop agent-smoke-test
```

For normal user-facing use, omit `--no-open` so BananaTape opens in the user's browser.
