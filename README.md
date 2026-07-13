# PDFoid — AI-centered PDF Editor (initial demo)

This is an initial scaffold and demo for PDFoid. It provides a minimal web app that lets you upload a PDF, extracts text using pdf.js, and runs a built-in summarizer (TextRank-like) and keyword extractor locally (no external AI provider required).

Quick start (Windows PowerShell):

```powershell
cd d:\pdfoid
bun install
bun run dev
```

Open the URL shown by Vite (default http://localhost:5173) and try uploading a PDF.

## Key Features

- **CV PDF Generator**: Create professional, minimalistic CVs with customizable themes (primary/secondary colors), fonts, and layout spacing. Supports sections for Summary, Experience, Education, Projects, Certifications, and Skills.
- **Local AI Processing**: Text extraction and summarization runs locally in the browser.

## Quick start (Windows PowerShell):

```powershell
cd d:\pdfoid
bun install
bun run dev
```

Open the URL shown by Vite (default http://localhost:5173).

## Notes

- This is a demo project showcasing local AI capabilities and PDF manipulation.
- Future improvements: Enhanced viewer UI, Web Worker offloading for performance.

## License

Copyright © 2026 Lehro Solutions. Licensed under the [Apache License 2.0](LICENSE). See [NOTICE](NOTICE).

## Documentation

Canonical docs hub: [`docs/.docs/index.md`](docs/.docs/index.md)

## Package manager (Bun)

This package is **Bun-first**.

```bash
bun install
bun run dev    # if defined
bun run build  # if defined
bun test       # or: bun run test
```

- Lockfile target: `bun.lock` (generate locally with `bun install`)
- `packageManager` field pins Bun via Corepack-compatible tooling ecosystems
- Node remains a compatibility runtime floor; prefer Bun for install/run/test

See docs for the package-manager decision: search for `ADR-0003` in `docs/.docs/` when present.

<!-- docs-system:start -->
## Documentation

The current public documentation is available in [`docs/index.html`](docs/index.html). Start with [`docs/current/start-here.md`](docs/current/start-here.md) for scope, current changes, workflows, architecture, security, quality, and contribution guidance.

### Latest public changes

- Cobalt design system with dark mode
- PDF-scoped annotation export
- Find and replace fidelity improvements
- Annotation, signature, and document action controls

Documentation is maintained as canonical Markdown plus generated HTML and JSON counterparts. Run `pnpm docs:build` after changing `docs/current/*.md` and `pnpm docs:check` before a public release.
<!-- docs-system:end -->
