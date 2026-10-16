import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from '@cantoo/pdf-lib'
import { toWinAnsi } from '../winAnsi'

export type StampPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'

export interface PageNumberOptions {
  /** `{n}` is the page number, `{total}` the page count. */
  format?: string
  position?: StampPosition
  startAt?: number
  fontSize?: number
  /** 0-based pages to skip (e.g. a cover); they still count towards {n}. */
  skipPages?: number[]
}

export interface WatermarkOptions {
  text: string
  opacity?: number
  rotationDeg?: number
  fontSize?: number
  color?: { r: number; g: number; b: number }
}

export interface HeaderFooterOptions {
  header?: string
  footer?: string
  fontSize?: number
}

const MARGIN = 24

const placeText = (page: PDFPage, font: PDFFont, text: string, size: number, position: StampPosition) => {
  const { width, height } = page.getSize()
  const textWidth = font.widthOfTextAtSize(text, size)
  const x = position.endsWith('left') ? MARGIN : position.endsWith('right') ? width - MARGIN - textWidth : (width - textWidth) / 2
  const y = position.startsWith('top') ? height - MARGIN - size : MARGIN
  page.drawText(text, { x, y, size, font, color: rgb(0.2, 0.2, 0.2) })
}

export async function addPageNumbers(bytes: Uint8Array, opts: PageNumberOptions = {}): Promise<Uint8Array> {
  const { format = '{n} / {total}', position = 'bottom-center', startAt = 1, fontSize = 10, skipPages = [] } = opts
  const doc = await PDFDocument.load(bytes, { updateMetadata: false })
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const pages = doc.getPages()
  const total = pages.length + startAt - 1
  pages.forEach((page, i) => {
    if (skipPages.includes(i)) return
    const label = toWinAnsi(format.replaceAll('{n}', String(i + startAt)).replaceAll('{total}', String(total)))
    placeText(page, font, label, fontSize, position)
  })
  return doc.save()
}

export async function addWatermark(bytes: Uint8Array, opts: WatermarkOptions): Promise<Uint8Array> {
  const { opacity = 0.15, rotationDeg = 45, fontSize = 64, color = { r: 0.5, g: 0.5, b: 0.5 } } = opts
  const text = toWinAnsi(opts.text.trim())
  if (!text) throw new Error('Watermark text is empty.')
  const doc = await PDFDocument.load(bytes, { updateMetadata: false })
  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  const rad = (rotationDeg * Math.PI) / 180
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize()
    // Shrink long text so it fits the page diagonal.
    const size = Math.min(fontSize, (Math.hypot(width, height) * 0.8) / Math.max(1, font.widthOfTextAtSize(text, 1)))
    const textWidth = font.widthOfTextAtSize(text, size)
    // Rotate around the page centre: offset the origin by half the text box.
    const x = width / 2 - (Math.cos(rad) * textWidth) / 2 + (Math.sin(rad) * size) / 3
    const y = height / 2 - (Math.sin(rad) * textWidth) / 2 - (Math.cos(rad) * size) / 3
    page.drawText(text, { x, y, size, font, color: rgb(color.r, color.g, color.b), opacity, rotate: degrees(rotationDeg) })
  }
  return doc.save()
}

export async function addHeaderFooter(bytes: Uint8Array, opts: HeaderFooterOptions): Promise<Uint8Array> {
  const header = toWinAnsi(opts.header?.trim() ?? '')
  const footer = toWinAnsi(opts.footer?.trim() ?? '')
  if (!header && !footer) throw new Error('Enter a header or a footer.')
  const fontSize = opts.fontSize ?? 9
  const doc = await PDFDocument.load(bytes, { updateMetadata: false })
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (const page of doc.getPages()) {
    if (header) placeText(page, font, header, fontSize, 'top-center')
    if (footer) placeText(page, font, footer, fontSize, 'bottom-left')
  }
  return doc.save()
}
