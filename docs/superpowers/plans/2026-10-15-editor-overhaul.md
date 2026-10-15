# PDFoid Editor Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Return PDFoid to a green, secure baseline (typecheck, tests, build, audit). Then upgrade the toolchain and add the core PDF-editor features it is missing.

**Architecture:** This is a Vite + React SPA. Document bytes live in `pdfEditorStore` (zustand). Every document mutation goes through `applyMutation()`, which uses pdf-lib, and pdf.js handles rendering and text extraction. The plan adds one shared pdf.js entry module, a snapshot history inside `pdfEditorStore`, and a small `src/utils/pdfOps/` module of pure `(bytes) => bytes` operations. UI panels call these operations through store actions.

**Tech Stack:** React, TypeScript, Vite, Vitest + Testing Library (jsdom), Playwright, zustand, pdf-lib (via the `@cantoo/pdf-lib` fork for encryption), pdfjs-dist, tesseract.js (lazy-loaded), Tailwind 4, Bun.

**Spec:** The conversation of 2026-10-15 ("what can we update" → "this is a pdf editor" → "create a plan and fix everything"). Its source items are the maintenance findings and the ten-item feature list.

## Global Constraints

- Every task ends with `tsc --noEmit` clean, `vitest run` green, and `vite build` green.
- Use only the newest stable, non-deprecated versions. Skip releases published less than ~7 days ago: vitest 5.0.5 and react 19.3.1 came out on 2026-10-14/15, so use the previous stable releases.
- Bun-first (ADR-0003): `bun.lock` is the only lockfile, and CI installs with Bun.
- Everything runs locally in the browser. The only network fetch allowed is tesseract language data, and only when the user explicitly starts OCR.
- Keep HEAD's new theme tokens, dark mode in `styles.css`, and per-document annotation persistence (`currentPdfId`).
- Every untrusted PDF opened with pdf.js uses `isEvalSupported: false`.

## Review Focus

1. **Encrypted PDF opened without a password.** Expected: a password prompt, and no crash or blank page. *Test owner: Task 11.*
2. **Undo after a page op, then a new op.** Expected: the redo stack clears, and undo restores the exact earlier bytes and page count. *Test owner: Task 5.*
3. **Redaction region spans text.** Expected: the exported PDF's text extraction no longer contains the redacted string. *Test owner: Task 9.*
4. **Merge a file that has annotations or forms.** Expected: the pages append in order and the page count is the sum. *Test owner: Task 6.*
5. **Split range out of bounds (e.g. "5-99" on a 6-page doc).** Expected: a clear validation error and no empty file. *Test owner: Task 6.*

---

## Phase A: Repair and security

### Task 1: Restore the CV feature lost in `9b4c8d4`

**Files:**
- Restore from `c2316e1`: `src/types/cv.ts`, `src/store/cvStore.ts`, `src/utils/cvPdfGenerator.ts`, `src/store/pdfEditorStore.ts`, `src/App.tsx`
- Keep at HEAD: `src/styles.css`, `src/store/annotationStore.ts`
- Re-apply into `src/App.tsx`: the `setCurrentPdfId` call. Fix it to use the incoming `name`, not the stale `fileName`.

- [ ] `git checkout c2316e1 -- <restore list>`
- [ ] Re-add `useAnnotationStore.getState().setCurrentPdfId?.(name || 'current-pdf')` in `handleLoadPDF`, before `loadDocument`.
- [ ] Run `npx tsc --noEmit && npx vitest run`. Expected: 0 TS errors and 51/51 tests passing.

### Task 2: Shared pdf.js module with a self-hosted worker and eval disabled

**Files:**
- Create: `src/lib/pdfjs.ts`
- Modify: `src/components/PDFViewer.tsx`, `src/store/pdfEditorStore.ts`, `src/utils/cvExtractor.ts`, `src/constants/index.ts` (drop `WORKER_URL`)
- Modify: all test files that `vi.mock('pdfjs-dist/legacy/build/pdf.js')`, so they mock `../lib/pdfjs` instead
- Test: `src/tests/pdfjsLoader.test.ts`

**Interfaces (produces):**
```ts
export function openPdf(data: Uint8Array | ArrayBuffer, opts?: { password?: string }): Promise<PDFDocumentProxy>
export class PdfPasswordError extends Error { reason: 'needed' | 'incorrect' }
```
`openPdf` copies the bytes (pdf.js detaches the buffer it is given), passes `isEvalSupported: false`, honours `VITE_PDFJS_DISABLE_WORKER`, and maps pdf.js `PasswordException` to `PdfPasswordError`. The worker comes in through Vite's `?url` import, so it is bundled and not loaded from unpkg.

- [ ] Write the test: mock `pdfjs-dist`; `openPdf(bytes)` calls `getDocument` with `isEvalSupported: false` and with a *copy* of the bytes.
- [ ] Implement `src/lib/pdfjs.ts` and replace the 6 `(pdfjsLib as any).getDocument` call sites.
- [ ] Run tsc, vitest and build. Confirm `grep -r unpkg src` is empty.

### Task 3: Dependency upgrades and audit

- [ ] `pdfjs-dist` → 6.x. Fix API changes: `.mjs` entry, render `{ canvas, canvasContext, viewport }`, and `TextItem` types. This also removes the `as any` casts.
- [ ] `vite` → 8, `@vitejs/plugin-react` → 6, `vitest` + `@vitest/ui` → 4.1.x. Rewrite `vite.config.ts` without `@ts-ignore`/`as any`. If rolldown rejects the object-form `manualChunks`, use the function form.
- [ ] `react`/`react-dom` → 19.2.x with matching `@types`. Fix any React 19 type breaks.
- [ ] Minor bumps: tailwind, zustand, playwright, postcss, autoprefixer, jsdom, `@testing-library/*`, uuid, immer, browserslist db.
- [ ] TypeScript → 7 only if `tsc --noEmit` and the Vite/vitest toolchain work with it. Otherwise use the latest 5.x/6.x, and record the reason in the commit.
- [ ] `tsconfig.json`: `moduleResolution: "Bundler"` and remove `allowImportingTsExtensions` if unused. Include `e2e`, `vite.config.ts` and `playwright.config.ts` through `tsconfig.node.json`.
- [ ] Verify that `npm audit` (via a temporary npm lock) or `bun audit` shows 0 high/critical.
- [ ] Run tsc, vitest and build.

### Task 4: Tooling and CI consistency

- [ ] Delete `package-lock.json`. Regenerate `bun.lock` with `npx bun@latest install`, and bump `packageManager` / `.tool-versions` to that Bun version.
- [ ] `pages.yml`: switch to `oven-sh/setup-bun@v2` + `bun install --frozen-lockfile` + `bun run build`.
- [ ] Add `.github/workflows/ci.yml` (PR + push to main) that runs `bun install --frozen-lockfile`, `bunx tsc --noEmit`, `bun run test -- --run` and `bun run build`.
- [ ] Add a `"typecheck": "tsc --noEmit"` script.
- [ ] Clean up the README: one Quick Start with no hard-coded `d:\pdfoid`, and an updated feature list. Move `Screenshot 2026-02-10 111947.jpg` to `docs/assets/`.

---

## Phase B: Editor features

Shared pattern: each feature adds a pure function to `src/utils/pdfOps/<name>.ts` with signature `(bytes: Uint8Array, opts) => Promise<Uint8Array>` (or one that returns results), unit-tested against real PDFs built with pdf-lib in `src/tests/utils/pdfTestHelpers.ts`. A thin store action in `pdfEditorStore` then applies it through `applyMutation` (which records history, see Task 5), plus UI.

### Task 5: Undo and redo for document operations

**Files:** `src/store/pdfEditorStore.ts`, `src/components/DocumentActionsPanel.tsx`, `src/tests/docHistory.test.ts`

**Interfaces (produces):** `undoDocument(): void`, `redoDocument(): void`, `canUndoDocument: boolean`, `canRedoDocument: boolean`. History holds up to `MAX_DOC_HISTORY = 20` byte snapshots. `loadDocument` resets it.

- [ ] Write the test: rotate, then delete page, then undo → page count is restored; undo → rotation is restored; a new op after undo clears redo.
- [ ] Push the pre-mutation bytes inside `applyMutation`. Implement undo/redo, and add buttons with disabled states to the Document Actions panel.

### Task 6: Merge and split

**Files:** `src/utils/pdfOps/mergeSplit.ts`, `src/tests/mergeSplit.test.ts`, `src/components/DocumentActionsPanel.tsx`

**Interfaces:** `mergePdfs(base: Uint8Array, others: Uint8Array[]): Promise<Uint8Array>`, `parsePageRanges(input: string, pageCount: number): number[]` (throws `RangeError` with a message), `extractPages(bytes, indices: number[]): Promise<Uint8Array>`

- [ ] Tests cover: merge page count = sum and order preserved; `"1-3,5"` → `[0,1,2,4]`; `"5-99"` on 6 pages throws; extract produces the right count.
- [ ] UI: an "Append PDF(s)…" file picker (multiple) that merges into the current doc, plus an "Extract pages" range input that downloads a new file.

### Task 7: Page thumbnails sidebar

**Files:** `src/components/PageThumbnails.tsx`, `src/App.tsx`, `src/tests/pageThumbnails.test.tsx`

- [ ] A left-side panel lists each page at low scale (lazy-rendered with IntersectionObserver). Click navigates. HTML5 drag-and-drop calls `reorderPages`. Per-thumbnail actions: rotate left/right and delete.
- [ ] Test (pdf.js mocked): renders N items; clicking item 3 sets page 3; a drop event calls `reorderPages({fromIndex, toIndex})`.

### Task 8: More annotation types

**Files:** `src/types/annotations.ts`, `src/components/VerticalToolbar.tsx`, `src/components/AnnotationCanvas.tsx`, `src/components/ToolSettingsPanel.tsx`, the flatten code in `pdfEditorStore.ts`, `src/tests/annotationStore.test.ts`, `src/tests/flattenTypes.test.ts`

- [ ] Add the types `underline | strikethrough | arrow | ellipse` and wire up the existing `stamp` (preset text: APPROVED / DRAFT / CONFIDENTIAL / custom).
- [ ] For each: canvas draw/preview, a toolbar button with a keyboard shortcut, and flattening into the PDF with pdf-lib (`drawLine`, `drawEllipse`, `drawRectangle` + `drawText` for stamp).
- [ ] Test: flattening each new type succeeds and changes the page content stream.

### Task 9: True redaction

**Files:** `src/utils/pdfOps/redact.ts`, `src/types/annotations.ts` (`redaction` type + tool), `src/tests/redact.test.ts`

**Interface:** `applyRedactions(bytes, regions: {page:number; x:number; y:number; w:number; h:number}[] /* normalized 0-1 */, renderScale = 2): Promise<Uint8Array>`

- [ ] Approach: for each page with regions, render it with pdf.js to a canvas, paint opaque black boxes, and replace the page with the PNG image (same size). The page loses its text/vector content, which is the only way to guarantee removal. The UI warns about this.
- [ ] Test (node canvas is unavailable, so inject the renderer): the output page has no text operators. Extracting text from the redacted page returns an empty string, and other pages are untouched.

### Task 10: Form filling

**Files:** `src/utils/pdfOps/forms.ts`, `src/components/FormFieldsPanel.tsx`, `src/tests/forms.test.ts`

**Interfaces:** `readFormFields(bytes): Promise<FormField[]>` where `FormField = { name; type: 'text'|'checkbox'|'dropdown'|'radio'|'optionlist'; value; options?: string[]; readOnly: boolean }`; `fillForm(bytes, values: Record<string, string|boolean|string[]>, { flatten?: boolean }): Promise<Uint8Array>`

- [ ] Test with a pdf-lib-built AcroForm: read → fill → read back shows the values. Flatten removes the fields.
- [ ] The panel appears only when the doc has fields.

### Task 11: Password-protected PDFs

**Files:** `src/lib/pdfjs.ts` (Task 2 types), `src/store/pdfEditorStore.ts`, `src/components/PasswordPrompt.tsx`, `src/utils/pdfOps/encrypt.ts`, `src/tests/encryption.test.ts`

- [ ] Swap `pdf-lib` → `@cantoo/pdf-lib` (API-compatible fork, supports decrypt/encrypt). Run the full suite.
- [ ] `loadDocument(bytes, name, password?)`: on `PdfPasswordError` set `passwordRequest: { fileName, reason }`, and the prompt re-calls with the password. Decrypt once with `PDFDocument.load(bytes, { password })` and keep the decrypted bytes as the working copy.
- [ ] Export option: "Protect with password", using `pdfDoc.encrypt({ userPassword, ownerPassword })`.
- [ ] Test: encrypt → load without a password throws `needed`; a wrong password throws `incorrect`; the right password loads with the correct page count.

### Task 12: Page numbers, watermark, header and footer

**Files:** `src/utils/pdfOps/stamping.ts`, `src/components/DocumentActionsPanel.tsx`, `src/tests/stamping.test.ts`

**Interfaces:** `addPageNumbers(bytes, { format: string /* "{n} / {total}" */, position: 'bottom-center'|'bottom-right'|'top-right'; startAt?: number; fontSize?: number })`, `addWatermark(bytes, { text, opacity, rotationDeg, fontSize })`, `addHeaderFooter(bytes, { header?: string; footer?: string })`

- [ ] Test: text extraction of the output contains "1 / 3" … "3 / 3" and the watermark text.

### Task 13: Recent files and autosave

**Files:** `src/utils/recentFiles.ts` (IndexedDB, same DB as annotations with a new store, DB version bump with upgrade), `src/components/PDFUploader.tsx`, `src/store/pdfEditorStore.ts`, `src/tests/recentFiles.test.ts` (uses `fake-indexeddb`)

**Interfaces:** `saveRecent({ id, name, bytes, updatedAt })`, `listRecent(): Promise<RecentMeta[]>` (newest first, max 8, and evicts beyond that), `loadRecent(id)`, `removeRecent(id)`

- [ ] Autosave the working bytes after each mutation (debounced 1s). The uploader card shows "Recent" with open/remove buttons.
- [ ] Test: saving 9 entries keeps 8 and the oldest is evicted; the order is newest first.

### Task 14: OCR for scanned pages

**Files:** `src/utils/ocr.ts` (dynamic `import('tesseract.js')`), `src/utils/pdfOps/textLayer.ts`, a UI button in Document Actions, `src/tests/textLayer.test.ts`

**Interface:** `addInvisibleTextLayer(bytes, pageIndex, words: {text; x0; y0; x1; y1}[] /* px at render scale */, renderScale)`

- [ ] "Make page searchable (OCR)": render the page, have tesseract recognize the words, then write invisible text (`opacity: 0`) at each word box so find/replace and copy work.
- [ ] Test the text-layer writer without tesseract: after the layer is added, pdf.js text extraction contains the words.
- [ ] Tesseract stays out of the main bundle (a dynamic chunk). The UI says the language data downloads on first use.

### Task 15: Final verification

- [ ] tsc, vitest, build and `bun audit` are all clean. Run the Playwright e2e suite.
- [ ] Update `.docs/known-limitations.md` (OCR, redaction rasterizes) and `CHANGELOG.md`.
