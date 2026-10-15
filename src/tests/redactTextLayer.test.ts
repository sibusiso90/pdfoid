import { describe, it, expect, vi } from 'vitest'
import { PDFDocument } from '@cantoo/pdf-lib'
import { applyRedactions, type RedactingRasterizer } from '../utils/pdfOps/redact'
import { addInvisibleTextLayer } from '../utils/pdfOps/textLayer'
import { extractPageTexts, makePdf } from './utils/realPdf'

// 1×1 white PNG — stands in for the canvas render, which jsdom cannot do.
const PNG_1PX = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII='),
  (c) => c.charCodeAt(0)
)
const fakeRasterizer = (): RedactingRasterizer & ReturnType<typeof vi.fn> =>
  vi.fn(async () => ({ png: PNG_1PX, widthPt: 300, heightPt: 300 })) as never

describe('applyRedactions', () => {
  it('removes all text from redacted pages and leaves other pages intact', async () => {
    const src = await makePdf(['public intro', 'SECRET account 1234', 'public outro'])
    const rasterize = fakeRasterizer()
    const out = await applyRedactions(src, [{ page: 1, x: 0, y: 0.4, w: 1, h: 0.2 }], { rasterize })

    expect(await extractPageTexts(out)).toEqual(['public intro', '', 'public outro'])
    expect(new TextDecoder('latin1').decode(out)).not.toContain('SECRET')
    expect(rasterize).toHaveBeenCalledTimes(1)
    expect(rasterize.mock.calls[0][1]).toBe(1)
    expect(rasterize.mock.calls[0][2]).toEqual([{ page: 1, x: 0, y: 0.4, w: 1, h: 0.2 }])
  })

  it('keeps page order and size, rasterizing each page once for several regions', async () => {
    const src = await makePdf(['a', 'b'])
    const rasterize = fakeRasterizer()
    const out = await applyRedactions(
      src,
      [{ page: 0, x: 0, y: 0, w: 0.5, h: 0.5 }, { page: 0, x: 0.5, y: 0.5, w: 0.1, h: 0.1 }, { page: 1, x: 0, y: 0, w: 0, h: 0.2 }],
      { rasterize }
    )
    const doc = await PDFDocument.load(out)
    expect(doc.getPageCount()).toBe(2)
    expect(doc.getPage(0).getSize()).toEqual({ width: 300, height: 300 })
    expect(rasterize).toHaveBeenCalledTimes(1) // the zero-width region on page 2 is ignored
    expect((await extractPageTexts(out))[1]).toBe('b')
  })

  it('rejects regions on pages that do not exist', async () => {
    await expect(applyRedactions(await makePdf(['a']), [{ page: 3, x: 0, y: 0, w: 1, h: 1 }], { rasterize: fakeRasterizer() }))
      .rejects.toThrow(/Page 4 does not exist/)
  })
})

describe('addInvisibleTextLayer', () => {
  it('makes words extractable without changing the visible page', async () => {
    const blank = await makePdf([''])
    const out = await addInvisibleTextLayer(blank, 0, [
      { text: 'Invoice', x: 0.1, y: 0.1, w: 0.3, h: 0.05 },
      { text: 'Total→R500', x: 0.1, y: 0.2, w: 0.4, h: 0.05 },
      { text: '  ', x: 0, y: 0, w: 0.1, h: 0.1 },
    ])
    const [text] = await extractPageTexts(out)
    expect(text).toContain('Invoice')
    expect(text).toContain('Total->R500')
  })
})
