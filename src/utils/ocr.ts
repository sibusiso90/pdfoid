/**
 * OCR for scanned pages. tesseract.js is imported lazily so it stays out of
 * the main bundle; its worker and engine are self-hosted (see vite.config.ts).
 * Only the language model is downloaded, on first use, from the tessdata CDN.
 */
import { closePdf, openPdf } from '../lib/pdfjs'
import type { OcrWord } from './pdfOps/textLayer'

export const OCR_LANGUAGE_NOTICE = 'The first OCR run downloads the English language model (about 4 MB).'

export interface OcrProgress {
  status: string
  progress: number // 0–1
}

/** Renders a page at `scale` and returns the recognized words in normalized coordinates. */
export async function recognizePage(
  bytes: Uint8Array,
  pageIndex: number,
  { lang = 'eng', scale = 2, onProgress }: { lang?: string; scale?: number; onProgress?: (p: OcrProgress) => void } = {}
): Promise<OcrWord[]> {
  const canvas = await renderPageToCanvas(bytes, pageIndex, scale)
  const { createWorker } = await import('tesseract.js')
  const base = import.meta.env.BASE_URL
  const worker = await createWorker(lang, undefined, {
    workerPath: `${base}tesseract/worker.min.js`,
    corePath: `${base}tesseract/core`,
    workerBlobURL: false,
    logger: (m) => onProgress?.({ status: m.status, progress: m.progress }),
  })
  try {
    const { data } = await worker.recognize(canvas, {}, { blocks: true })
    const words = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)))
    return words
      .filter((w) => w.text.trim() && w.confidence > 30)
      .map((w) => ({
        text: w.text,
        x: w.bbox.x0 / canvas.width,
        y: w.bbox.y0 / canvas.height,
        w: (w.bbox.x1 - w.bbox.x0) / canvas.width,
        h: (w.bbox.y1 - w.bbox.y0) / canvas.height,
      }))
  } finally {
    await worker.terminate()
  }
}

async function renderPageToCanvas(bytes: Uint8Array, pageIndex: number, scale: number): Promise<HTMLCanvasElement> {
  const pdf = await openPdf(bytes)
  try {
    const page = await pdf.getPage(pageIndex + 1)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas is not available for OCR.')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvas, canvasContext: ctx, viewport }).promise
    return canvas
  } finally {
    await closePdf(pdf)
  }
}
