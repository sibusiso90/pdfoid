import { describe, it, expect } from 'vitest'
import { PDFDocument } from '@cantoo/pdf-lib'
import { addHeaderFooter, addPageNumbers, addWatermark } from '../utils/pdfOps/stamping'
import { decryptPdf, encryptPdf } from '../utils/pdfOps/encrypt'
import { openPdf, PdfPasswordError } from '../lib/pdfjs'
import { extractPageTexts, makePdf } from './utils/realPdf'

describe('stamping', () => {
  it('numbers every page with the total', async () => {
    const out = await addPageNumbers(await makePdf(['a', 'b', 'c']))
    const texts = await extractPageTexts(out)
    expect(texts[0]).toContain('1 / 3')
    expect(texts[2]).toContain('3 / 3')
  })

  it('honours format, startAt and skipped cover pages', async () => {
    const out = await addPageNumbers(await makePdf(['cover', 'b', 'c']), { format: 'Page {n}', startAt: 0, skipPages: [0] })
    const texts = await extractPageTexts(out)
    expect(texts[0]).not.toContain('Page')
    expect(texts[1]).toContain('Page 1')
    expect(texts[2]).toContain('Page 2')
  })

  it('adds a watermark to every page, including non-WinAnsi text', async () => {
    const out = await addWatermark(await makePdf(['a', 'b']), { text: 'DRAFT → v2' })
    for (const text of await extractPageTexts(out)) expect(text).toContain('DRAFT -> v2')
  })

  it('adds header and footer, and rejects both empty', async () => {
    const out = await addHeaderFooter(await makePdf(['body']), { header: 'ACME Ltd', footer: 'Confidential' })
    const [text] = await extractPageTexts(out)
    expect(text).toContain('ACME Ltd')
    expect(text).toContain('Confidential')
    await expect(addHeaderFooter(await makePdf(['x']), { header: ' ' })).rejects.toThrow(/header or a footer/)
  })
})

describe('encryption', () => {
  it('round-trips: needs a password, rejects a wrong one, opens with the right one', async () => {
    const locked = await encryptPdf(await makePdf(['secret page', 'two']), { userPassword: 'hunter2' })

    await expect(openPdf(locked)).rejects.toMatchObject({ name: 'PdfPasswordError', reason: 'needed' })
    await expect(openPdf(locked, { password: 'nope' })).rejects.toBeInstanceOf(PdfPasswordError)
    await expect(openPdf(locked, { password: 'nope' })).rejects.toMatchObject({ reason: 'incorrect' })
    expect(await extractPageTexts(locked, 'hunter2')).toEqual(['secret page', 'two'])
  })

  it('decrypts to an unencrypted, editable copy', async () => {
    const locked = await encryptPdf(await makePdf(['hello']), { userPassword: 'pw' })
    const open = await decryptPdf(locked, 'pw')
    expect(await extractPageTexts(open)).toEqual(['hello'])
    // pdf-lib must accept it as a plain document (no lingering /Encrypt).
    expect((await PDFDocument.load(open)).isEncrypted).toBe(false)
    await expect(decryptPdf(locked, 'wrong')).rejects.toThrow()
  })
})
