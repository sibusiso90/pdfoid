import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRef, PDFStream, type PDFObject, type PDFPage } from '@cantoo/pdf-lib'
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

/** Page keys that can carry the old page's content or text. */
const PAGE_KEYS_TO_DROP = ['Annots', 'Thumb', 'PieceInfo', 'Metadata', 'StructParents', 'B', 'AA', 'CropBox', 'BleedBox', 'TrimBox', 'ArtBox', 'Group', 'VP', 'SeparationInfo']

/**
 * Permanently removes everything under the regions. Each affected page is
 * replaced by a flattened image of itself, so its text, vectors, links,
 * annotations and form fields are gone — the only way to guarantee nothing
 * survives under a box. Objects no longer referenced anywhere are then
 * dropped from the file, so the old content cannot be recovered from it.
 * Pages without regions are untouched.
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
  if (byPage.size === 0) return bytes

  const pages = doc.getPages()
  const redactedPages: PDFPage[] = []
  for (const [pageIndex, pageRegions] of byPage) {
    if (pageIndex < 0 || pageIndex >= pages.length) throw new RangeError(`Page ${pageIndex + 1} does not exist.`)
    const page = pages[pageIndex]
    const { png, widthPt, heightPt } = await rasterize(bytes, pageIndex, pageRegions, scale)
    removeFieldsOnPage(doc, page)
    resetPage(doc, page, widthPt, heightPt)
    page.drawImage(await doc.embedPng(png), { x: 0, y: 0, width: widthPt, height: heightPt })
    redactedPages.push(page)
  }

  // Tagged-PDF structure (alt text, ActualText) can repeat the page's words.
  doc.catalog.delete(PDFName.of('StructTreeRoot'))
  doc.catalog.delete(PDFName.of('MarkInfo'))

  dropUnreachableObjects(doc)
  return doc.save({ useObjectStreams: false })
}

/** Keeps the page object (so bookmarks and links to it stay valid) but empties it. */
function resetPage(doc: PDFDocument, page: PDFPage, widthPt: number, heightPt: number) {
  const { node } = page
  for (const key of PAGE_KEYS_TO_DROP) node.delete(PDFName.of(key))
  node.delete(PDFName.of('Contents'))
  // Own (not inherited) resources, box and rotation: the raster is the page as displayed.
  // pdf-lib may have cached a normalized view of the page, so keep its sub-dictionaries present.
  node.set(PDFName.of('Resources'), doc.context.obj({ Font: {}, XObject: {}, ExtGState: {} }))
  node.set(PDFName.of('MediaBox'), doc.context.obj([0, 0, widthPt, heightPt]))
  node.set(PDFName.of('Rotate'), doc.context.obj(0))
}

/** Removes form fields with a widget on `page`: their values would survive in the AcroForm. */
function removeFieldsOnPage(doc: PDFDocument, page: PDFPage) {
  if (!doc.catalog.getAcroForm()) return
  const annots = page.node.Annots()
  const onPage = new Set(annots ? annots.asArray().map(String) : [])
  const form = doc.getForm()
  for (const field of form.getFields()) {
    const widgets = field.acroField.getWidgets()
    const isOnPage = widgets.some((w) => w.P() === page.ref || onPage.has(String(doc.context.getObjectRef(w.dict))))
    if (isOnPage) form.removeField(field)
  }
}

/** Deletes every indirect object not reachable from the trailer (Root, Info). */
function dropUnreachableObjects(doc: PDFDocument) {
  const { context } = doc
  const reachable = new Set<string>()
  const stack: PDFObject[] = [context.trailerInfo.Root, context.trailerInfo.Info].filter(Boolean) as PDFObject[]
  while (stack.length) {
    const obj = stack.pop()!
    if (obj instanceof PDFRef) {
      const key = obj.toString()
      if (reachable.has(key)) continue
      reachable.add(key)
      const target = context.lookup(obj)
      if (target) stack.push(target)
    } else if (obj instanceof PDFDict) {
      for (const [, value] of obj.entries()) stack.push(value)
    } else if (obj instanceof PDFArray) {
      stack.push(...obj.asArray())
    } else if (obj instanceof PDFStream) {
      stack.push(obj.dict)
    }
  }
  for (const [ref] of context.enumerateIndirectObjects()) {
    if (!reachable.has(ref.toString())) context.delete(ref)
  }
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
