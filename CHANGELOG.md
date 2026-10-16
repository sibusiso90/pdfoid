# Changelog

## [Unreleased] - editor overhaul
### Fixed
- CV export restored after it was accidentally reverted; per-document annotation
  storage now keys on the file being opened.
- Arrow bullets, find & replace, and flattening no longer crash on characters
  outside WinAnsi (emoji, arrows, CJK).
- Stamp annotations are drawn inside their box.
### Security
- pdf.js 3.11 → 6.4 (CVE-2024-4367: malicious PDFs could run JavaScript).
- pdf.js worker, fonts, cmaps and decoders are self-hosted (no CDN).
- Export refuses to run while redaction marks are unapplied.
### Added
- Undo/redo for document operations (20 steps).
- Merge PDFs, extract page ranges.
- Page numbers, watermark, header/footer.
- Form filling (text, checkbox, dropdown, list, radio) with optional flattening.
- True redaction (redaction tool + `redact()`).
- Open password-protected PDFs; password-protect on export.
- Recent files with autosave.
- OCR for scanned pages (adds a searchable text layer).
- Annotation types: underline, strikethrough, ellipse, arrow, stamp presets, redaction.
### Changed
- Vite 8, React 19.3, TypeScript 7, Vitest 4.1, Tailwind 4.3 via @tailwindcss/vite.
- pdf-lib replaced by the maintained @cantoo/pdf-lib fork (encryption support).
- Bun is the only package manager; CI runs audit, typecheck, tests, build and e2e.

## [2026-07-10] - production / open-source readiness
- User how-to guides rebuilt and HTML regenerated via docs builder
- Removed build-docs generation script from shipped tree
- Community/security files and install guidance hardened for first-run success
