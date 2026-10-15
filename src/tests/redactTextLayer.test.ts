import { describe, it, expect, vi } from 'vitest'
import { PDFDict, PDFDocument, PDFName, PDFString } from '@cantoo/pdf-lib'
import { applyRedactions, type RedactingRasterizer } from '../utils/pdfOps/redact'
import { addInvisibleTextLayer } from '../utils/pdfOps/textLayer'
import { extractPageTexts, fileContainsText, makePdf } from './utils/realPdf'
import { readFormFields } from '../utils/pdfOps/forms'

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
    expect(await fileContainsText(src, 'SECRET')).toBe(true) // the check itself works
    expect(await fileContainsText(out, 'SECRET')).toBe(false)
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

  it('removes form values, comments and tagged text on the redacted page, keeping other pages intact', async () => {
    const doc = await PDFDocument.create()
    const [p1, p2] = [doc.addPage([300, 300]), doc.addPage([300, 300])]
    const form = doc.getForm()
    const secretField = form.createTextField('ssn')
    secretField.setText('SECRETVALUE')
    secretField.addToPage(p2, { x: 20, y: 200, width: 150, height: 20 })
    const keptField = form.createTextField('name')
    keptField.setText('Thandi')
    keptField.addToPage(p1, { x: 20, y: 200, width: 150, height: 20 })
    // A comment annotation and tagged-PDF ActualText that repeat the secret.
    const note = doc.context.register(doc.context.obj({ Type: 'Annot', Subtype: 'Text', Rect: [0, 0, 20, 20], Contents: PDFString.of('SECRETNOTE') }))
    p2.node.addAnnot(note)
    doc.catalog.set(PDFName.of('StructTreeRoot'), doc.context.obj({ Type: 'StructTreeRoot', K: doc.context.obj({ S: 'P', ActualText: PDFString.of('SECRETTAG') }) }))
    const p2Ref = p2.ref.toString()
    const src = await doc.save()

    const out = await applyRedactions(src, [{ page: 1, x: 0, y: 0, w: 1, h: 1 }], { rasterize: fakeRasterizer() })

    for (const secret of ['SECRETVALUE', 'SECRETNOTE', 'SECRETTAG']) {
      expect(await fileContainsText(src, secret)).toBe(true)
      expect(await fileContainsText(out, secret)).toBe(false)
    }
    expect((await readFormFields(out)).map((f) => [f.name, f.value])).toEqual([['name', 'Thandi']])
    // Same page object, so bookmarks/links that target it still resolve.
    const redactedPage = (await PDFDocument.load(out)).getPage(1)
    expect(redactedPage.ref.toString()).toBe(p2Ref)
    // The raster image is actually wired into the page (not left in dropped resources).
    const xobjects = redactedPage.node.Resources()?.lookup(PDFName.of('XObject'), PDFDict)
    expect(xobjects?.keys()).toHaveLength(1)
  })

  it('returns the input unchanged when there is nothing to redact', async () => {
    const src = await makePdf(['a'])
    expect(await applyRedactions(src, [{ page: 0, x: 0, y: 0, w: 0, h: 0 }], { rasterize: fakeRasterizer() })).toBe(src)
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
