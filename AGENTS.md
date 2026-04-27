# BananaTape agent notes

## Product
BananaTape is a local-first image editor for AI image generation/editing. Users create projects from the CLI, open the browser editor, add prompts/references, annotate images, run generations/edits, and keep history in local project folders.

## Current direction
- Keep project management CLI-first; do not add an in-app project dashboard unless explicitly requested.
- Keep the editor focused on canvas work: prompt, references, annotations, history, export.
- Prefer simple local folder persistence over cloud sync.
- V1 does not use Electron/Tauri/native wrappers; it runs a local Next.js server and opens the browser.

## Development rules
- This repo uses a newer Next.js version; read relevant docs under `node_modules/next/dist/docs/` before changing Next.js APIs or config.
- Keep changes small and reversible.
- No new dependencies unless explicitly needed.
- For behavior changes, add or update tests when practical.

## Useful commands
```bash
npm run lint
npm run typecheck
npx vitest run
npx playwright test
npm run build
```

## CLI/package notes
- CLI entry: `bin/bananatape.mjs`.
- Published package name: `bananatape`.
- npm releases are driven by GitHub Releases via `.github/workflows/npm-publish.yml`.
- The npm package includes the standalone Next build, static assets, README, and docs images.

## Provider notes
- OpenAI provider requires `OPENAI_API_KEY`.
- `codex` provider reads local auth from `~/.codex/auth.json`; do not edit or commit this file.
