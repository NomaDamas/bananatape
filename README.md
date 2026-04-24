# BananaTape

**BananaTape is natural-language Photoshop for AI image models** — a vibe design canvas where you describe what you want, mark up the image with sticky notes, arrows, boxes, and references, then let the model patch it into shape.

The name is the product thesis: part banana-on-the-wall art joke, part duct-tape utility. It is for people who do not want to learn layers, masks, bezier curves, or design systems before they can fix an image.

## What it does

- Generate a new image from a prompt.
- Edit an existing image by annotating directly on the canvas.
- Add sticky memo notes that become part of the annotated screenshot sent to the model.
- Draw arrows and bounding boxes to point at exactly what should change.
- Attach reference images from the file picker or by copy/paste.
- Keep generation history so you can jump back to the version that worked.

## Why BananaTape

Traditional design tools assume you know how to design. BananaTape assumes you know how to point, scribble, and explain the vibe in plain language.

| Traditional tools | BananaTape |
| --- | --- |
| Layers, masks, tools, panels | Prompt, annotate, generate |
| Pixel-perfect selections | Sticky notes, arrows, boxes |
| Design vocabulary required | Natural language is enough |
| File/version management | History sidebar |

## Providers

BananaTape currently supports:

- OpenAI image generation/editing
- `god-tibo-imagen` via the private Codex backend path used by this project

The provider layer is intentionally kept separate so future image models can be added without changing the canvas workflow.

## Getting Started

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Scripts

```bash
npm run lint      # ESLint
npm run build     # Production build
npx tsc --noEmit  # TypeScript check
npx vitest run    # Unit tests
npx playwright test tests/e2e/editor.spec.ts # Editor e2e tests
```

## Product positioning

> Photoshop, but with words, annotations, references, and duct tape.

BananaTape is built for non-designers, founders, PMs, and developers who need visuals but think in words and rough marks instead of layers and masks.
