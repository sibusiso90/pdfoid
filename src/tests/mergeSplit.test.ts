import { describe, it, expect } from 'vitest'
import { extractPages, mergePdfs, parsePageRanges } from '../utils/pdfOps/mergeSplit'
import { extractPageTexts, makePdf } from './utils/realPdf'

describe('parsePageRanges', () => {
  it('parses single pages and ranges into sorted, de-duplicated 0-based indices', () => {
    expect(parsePageRanges('1-3, 5', 6)).toEqual([0, 1, 2, 4])
    expect(parsePageRanges('4,2,2-3', 6)).toEqual([1, 2, 3])
  })

  it('supports open-ended ranges', () => {
    expect(parsePageRanges('5-', 6)).toEqual([4, 5])
    expect(parsePageRanges('-2', 6)).toEqual([0, 1])
  })

  it('rejects out-of-range, reversed, empty and malformed input', () => {
    expect(() => parsePageRanges('5-99', 6)).toThrow(/only 6 pages/)
    expect(() => parsePageRanges('0', 6)).toThrow(RangeError)
    expect(() => parsePageRanges('4-2', 6)).toThrow(/backwards/)
    expect(() => parsePageRanges('', 6)).toThrow(/Enter/)
    expect(() => parsePageRanges('abc', 6)).toThrow(/not a page/)
  })
})

describe('mergePdfs', () => {
  it('appends every page of each file in order', async () => {
    const base = await makePdf(['A1', 'A2'])
    const second = await makePdf(['B1'])
    const third = await makePdf(['C1', 'C2', 'C3'])
    const merged = await mergePdfs(base, [second, third])
    expect(await extractPageTexts(merged)).toEqual(['A1', 'A2', 'B1', 'C1', 'C2', 'C3'])
  })
})

describe('extractPages', () => {
  it('produces a new file with only the selected pages in document order', async () => {
    const src = await makePdf(['p1', 'p2', 'p3', 'p4'])
    const out = await extractPages(src, [3, 1])
    expect(await extractPageTexts(out)).toEqual(['p2', 'p4'])
  })

  it('refuses an empty selection', async () => {
    const src = await makePdf(['p1'])
    await expect(extractPages(src, [])).rejects.toThrow(/at least one page/)
  })
})
