import { describe, it, expect } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { closePdf, isTextItem, openPdf } from '../lib/pdfjs'

const makePdf = async (pages: string[]) => {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (const text of pages) doc.addPage([300, 300]).drawText(text, { x: 20, y: 150, size: 14, font })
  return doc.save()
}

describe('openPdf (real pdf.js)', () => {
  it('opens a document without detaching the caller’s buffer', async () => {
    const bytes = await makePdf(['first page', 'second page'])
    const doc = await openPdf(bytes)
    expect(doc.numPages).toBe(2)
    expect(bytes.byteLength).toBeGreaterThan(0)

    const page = await doc.getPage(2)
    const content = await page.getTextContent()
    expect(content.items.filter(isTextItem).map((i) => i.str).join('')).toContain('second page')
    await closePdf(doc)
  })

  it('accepts an ArrayBuffer', async () => {
    const bytes = await makePdf(['x'])
    const doc = await openPdf(bytes.buffer.slice(0) as ArrayBuffer)
    expect(doc.numPages).toBe(1)
    await closePdf(doc)
  })
})
