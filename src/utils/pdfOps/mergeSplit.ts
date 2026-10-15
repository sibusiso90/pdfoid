import { PDFDocument } from '@cantoo/pdf-lib'

/** Appends all pages of `others` (in order) to `base`. */
export async function mergePdfs(base: Uint8Array, others: Uint8Array[]): Promise<Uint8Array> {
  const target = await PDFDocument.load(base, { updateMetadata: false })
  for (const bytes of others) {
    const source = await PDFDocument.load(bytes, { updateMetadata: false })
    const pages = await target.copyPages(source, source.getPageIndices())
    for (const page of pages) target.addPage(page)
  }
  return target.save()
}

/**
 * Parses a human page selection such as "1-3, 5, 8-" into sorted 0-based
 * indices. Throws a RangeError whose message is safe to show to the user.
 */
export function parsePageRanges(input: string, pageCount: number): number[] {
  const parts = input.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) throw new RangeError('Enter pages to extract, e.g. "1-3, 5".')

  const pages = new Set<number>()
  const toPage = (raw: string, fallback: number) => {
    if (raw === '') return fallback
    if (!/^\d+$/.test(raw)) throw new RangeError(`"${raw}" is not a page number.`)
    const n = Number(raw)
    if (n < 1 || n > pageCount) {
      throw new RangeError(`Page ${n} is out of range — this document has only ${pageCount} pages.`)
    }
    return n
  }

  for (const part of parts) {
    const [startRaw, endRaw, extra] = part.split('-').map((s) => s.trim())
    if (extra !== undefined) throw new RangeError(`"${part}" is not a page range.`)
    const start = toPage(startRaw, 1)
    const end = endRaw === undefined ? start : toPage(endRaw, pageCount)
    if (end < start) throw new RangeError(`"${part}" runs backwards.`)
    for (let n = start; n <= end; n++) pages.add(n - 1)
  }
  return [...pages].sort((a, b) => a - b)
}

/** Returns a new PDF containing only `indices` (0-based), in document order. */
export async function extractPages(bytes: Uint8Array, indices: number[]): Promise<Uint8Array> {
  if (indices.length === 0) throw new RangeError('Select at least one page.')
  const source = await PDFDocument.load(bytes, { updateMetadata: false })
  const target = await PDFDocument.create()
  const sorted = [...new Set(indices)].sort((a, b) => a - b)
  for (const page of await target.copyPages(source, sorted)) target.addPage(page)
  return target.save()
}
