/**
 * Single entry point for pdf.js. Every component and store opens documents
 * through `openPdf` so worker setup and password handling live in one place.
 */
import { getDocument, GlobalWorkerOptions, PasswordException, PasswordResponses } from 'pdfjs-dist'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import type { RenderTask, TextItem, TextMarkedContent } from 'pdfjs-dist/types/src/display/api'
// Bundled by Vite so the worker is served from our own origin (no CDN).
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// Test setup may already point this at the on-disk worker for Node.
if (!GlobalWorkerOptions.workerSrc) GlobalWorkerOptions.workerSrc = workerUrl

// Runtime data (fonts, cmaps, decoders) served by the `pdfoid:pdfjs-assets` Vite
// plugin. Tests override the base with a file path, since Node reads from disk.
const assetBase: string =
  (globalThis as { __PDFJS_ASSET_BASE__?: string }).__PDFJS_ASSET_BASE__ ?? `${import.meta.env.BASE_URL}pdfjs/`
const assetUrls = {
  standardFontDataUrl: `${assetBase}standard_fonts/`,
  cMapUrl: `${assetBase}cmaps/`,
  wasmUrl: `${assetBase}wasm/`,
  iccUrl: `${assetBase}iccs/`,
}

export type { PDFDocumentProxy, PDFPageProxy, RenderTask, TextItem }

export class PdfPasswordError extends Error {
  constructor(public readonly reason: 'needed' | 'incorrect') {
    super(reason === 'needed' ? 'This PDF is password protected.' : 'Incorrect password.')
    this.name = 'PdfPasswordError'
  }
}

export async function openPdf(
  data: Uint8Array | ArrayBuffer,
  opts: { password?: string } = {}
): Promise<PDFDocumentProxy> {
  // pdf.js transfers (detaches) the buffer it receives, so always hand it a copy.
  const copy = data instanceof Uint8Array ? data.slice() : new Uint8Array(data.slice(0))
  try {
    return await getDocument({ data: copy, password: opts.password, ...assetUrls }).promise
  } catch (err) {
    if (err instanceof PasswordException) {
      throw new PdfPasswordError(
        err.code === PasswordResponses.INCORRECT_PASSWORD ? 'incorrect' : 'needed'
      )
    }
    throw err
  }
}

/** Releases the document and its worker-side resources. */
export const closePdf = (doc: PDFDocumentProxy): Promise<void> => doc.loadingTask.destroy()

export const isTextItem = (item: TextItem | TextMarkedContent): item is TextItem =>
  typeof (item as TextItem).str === 'string'
