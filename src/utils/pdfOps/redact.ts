import { PDFDocument } from '@cantoo/pdf-lib'
import { closePdf, openPdf } from '../../lib/pdfjs'

/** A region to black out, normalized 0–1 to the page as displayed (top-left origin). */
export interface RedactionRegion {
  page: number // 0-based
  x: number
  y: number
  w: number
  h: number
}

/**
 * Renders one page to PNG with the given regions already painted opaque black
 * into the pixels. Returns the page's displayed size in PDF points.
 */
export type RedactingRasterizer = (
  bytes: Uint8Array,
  pageIndex: number,
  regions: RedactionRegion[],
  scale: number
) => Promise<{ png: Uint8Array; widthPt: number; heightPt: number }>

/**
 * Permanently removes everything under the regions. Each affected page is
 * replaced by a flattened image of itself, so its text, vectors, links and
 * annotations are gone — the only way to guarantee nothing survives under a
 * box. Pages without regions are untouched.
 */
export async function applyRedactions(
  bytes: Uint8Array,
  regions: RedactionRegion[],
  { scale = 2, rasterize = canvasRasterizer }: { scale?: number; rasterize?: RedactingRasterizer } = {}
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false })
  const byPage = new Map<number, RedactionRegion[]>()
  for (const r of regions) {
    if (r.w > 0 && r.h > 0) byPage.set(r.page, [...(byPage.get(r.page) ?? []), r])
  }
  for (const [pageIndex, pageRegions] of byPage) {
    if (pageIndex < 0 || pageIndex >= doc.getPageCount()) throw new RangeError(`Page ${pageIndex + 1} does not exist.`)
    const { png, widthPt, heightPt } = await rasterize(bytes, pageIndex, pageRegions, scale)
    const image = await doc.embedPng(png)
    const replacement = doc.insertPage(pageIndex, [widthPt, heightPt])
    replacement.drawImage(image, { x: 0, y: 0, width: widthPt, height: heightPt })
    doc.removePage(pageIndex + 1)
  }
  return doc.save()
}

/** Browser rasterizer: pdf.js → canvas → black boxes → PNG. */
export const canvasRasterizer: RedactingRasterizer = async (bytes, pageIndex, regions, scale) => {
  const pdf = await openPdf(bytes)
  try {
    const page = await pdf.getPage(pageIndex + 1)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas is not available for redaction.')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvas, canvasContext: ctx, viewport }).promise
    ctx.fillStyle = '#000'
    for (const r of regions) {
      // Round outwards so anti-aliased edges can't leak glyph fragments.
      const x0 = Math.floor(r.x * canvas.width)
      const y0 = Math.floor(r.y * canvas.height)
      ctx.fillRect(x0, y0, Math.ceil((r.x + r.w) * canvas.width) - x0, Math.ceil((r.y + r.h) * canvas.height) - y0)
    }
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode page image.'))), 'image/png')
    )
    return { png: new Uint8Array(await blob.arrayBuffer()), widthPt: viewport.width / scale, heightPt: viewport.height / scale }
  } finally {
    await closePdf(pdf)
  }
}
