import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib'
import { toWinAnsi } from '../winAnsi'

/** A recognized word, box normalized 0–1 to the page as displayed (top-left origin). */
export interface OcrWord {
  text: string
  x: number
  y: number
  w: number
  h: number
}

/**
 * Writes OCR'd words as invisible text over a scanned page so it becomes
 * searchable and copyable. Nothing visible changes.
 */
export async function addInvisibleTextLayer(bytes: Uint8Array, pageIndex: number, words: OcrWord[]): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false })
  const page = doc.getPage(pageIndex)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const { width, height } = page.getSize()
  for (const word of words) {
    const text = toWinAnsi(word.text.trim())
    if (!text) continue
    const boxW = word.w * width
    const boxH = word.h * height
    // Size the glyphs to the box so selection highlights roughly match the scan.
    const size = Math.max(1, Math.min(boxH, boxW / Math.max(0.01, font.widthOfTextAtSize(text, 1))))
    page.drawText(text, {
      x: word.x * width,
      y: height - (word.y + word.h) * height + boxH * 0.2,
      size,
      font,
      opacity: 0,
    })
  }
  return doc.save()
}
