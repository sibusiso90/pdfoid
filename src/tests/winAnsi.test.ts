import { describe, it, expect } from 'vitest'
import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib'
import { toWinAnsi } from '../utils/winAnsi'

describe('toWinAnsi', () => {
  it('keeps ASCII, Latin-1 and WinAnsi extras unchanged', () => {
    const text = 'Hello café — “quoted” • €5 … ™'
    expect(toWinAnsi(text)).toBe(text)
  })

  it('maps common symbols to encodable equivalents', () => {
    expect(toWinAnsi('▸ item')).toBe('› item')
    expect(toWinAnsi('a → b')).toBe('a -> b')
    expect(toWinAnsi('✓ done')).toBe('v done')
  })

  it('replaces anything else with "?" and drops emoji presentation selectors', () => {
    expect(toWinAnsi('hi 😀 漢')).toBe('hi ? ?')
  })

  it('produces text every standard font can encode', async () => {
    const doc = await PDFDocument.create()
    const font = await doc.embedFont(StandardFonts.Helvetica)
    const page = doc.addPage()
    expect(() => page.drawText(toWinAnsi('▸ → 😀 ✓ 漢 ok'), { font, size: 12 })).not.toThrow()
  })
})
