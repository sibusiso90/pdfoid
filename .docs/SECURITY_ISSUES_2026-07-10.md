# Security / integrity notes — 2026-07-10 continuation

## Findings

- Annotation export previously hard-coded `pdfId: 'current-pdf'`.
- IndexedDB annotation records were not scoped per document name.

## Patches

- Added `currentPdfId` + `setCurrentPdfId` to annotation store.
- Export JSON now uses the active document id.
- IndexedDB keys are namespaced per document id when available.

## Residual risk

- PDF.js worker may still load from CDN depending on environment config.
