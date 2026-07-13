# PDFoid Architecture

  ## Intent
  Browser PDF viewer/editor with annotations, find/replace overlays, and local persistence.

  ## Runtime shape
  - Domain: **Document editing**
  - Primary stack: React, TypeScript, Vite, Zustand, PDF.js
  - Key entrypoints:
- `src/App.tsx`
- `src/store/annotationStore.ts`
- `src/store/pdfEditorStore.ts`

  ## Boundaries
  - Validate inputs at trust boundaries.
  - Keep authorization explicit near data access.
  - Prefer recoverable errors over silent failure.
  - Keep side effects isolated and observable.

  ## Related
  - [Design System](./design-system.md)
  - [Security](./security.md)
  - [ADR-0001](./adr-0001-docs-system.md)
  - [Roadmap](./roadmap.md)
