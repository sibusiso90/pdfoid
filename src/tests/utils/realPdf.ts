import { decodePDFRawStream, PDFDocument, PDFHexString, PDFRawStream, PDFString, StandardFonts } from '@cantoo/pdf-lib'
import { closePdf, isTextItem, openPdf } from '../../lib/pdfjs'

/** Builds a real PDF with one page per entry, each page showing its text. */
export async function makePdf(pages: string[], size: [number, number] = [300, 300]): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (const text of pages) doc.addPage(size).drawText(text, { x: 20, y: size[1] / 2, size: 14, font })
  return doc.save()
}

/** Extracts each page's text with the real pdf.js, joined per page. */
export async function extractPageTexts(bytes: Uint8Array, password?: string): Promise<string[]> {
  const doc = await openPdf(bytes, { password })
  try {
    const texts: string[] = []
    for (let i = 1; i <= doc.numPages; i++) {
      const content = await (await doc.getPage(i)).getTextContent()
      texts.push(content.items.filter(isTextItem).map((item) => item.str).join(' ').replace(/\s+/g, ' ').trim())
    }
    return texts
  } finally {
    await closePdf(doc)
  }
}

export const pageCount = async (bytes: Uint8Array) => (await PDFDocument.load(bytes)).getPageCount()

/**
 * True if `needle` survives anywhere in the file: in any object (reachable or
 * not), inside decompressed streams, or as a literal/hex string.
 */
export async function fileContainsText(bytes: Uint8Array, needle: string): Promise<boolean> {
  const hex = Array.from(needle, (c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
  const doc = await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true })
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    let text = obj.toString()
    if (obj instanceof PDFRawStream) {
      try {
        text += new TextDecoder('latin1').decode(decodePDFRawStream(obj).decode())
      } catch {
        // Undecodable (e.g. image) streams cannot hide text operators.
      }
    }
    if (obj instanceof PDFString || obj instanceof PDFHexString) text += obj.decodeText()
    const lower = text.toLowerCase()
    if (lower.includes(needle.toLowerCase()) || lower.replace(/\s/g, '').includes(hex)) return true
  }
  return false
}
