import { describe, it, expect, beforeEach, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { PDFDocument } from '@cantoo/pdf-lib'
import { PendingRedactionsError, usePdfEditorStore } from '../store/pdfEditorStore'
import { useAnnotationStore } from '../store/annotationStore'
import { arrowHeadWings } from '../utils/geometry'
import type { RedactingRasterizer } from '../utils/pdfOps/redact'
import type { Annotation, AnnotationType } from '../types/annotations'
import { TOOL_BY_SHORTCUT, TOOL_CATALOG } from '../constants/tools'
import { extractPageTexts, makePdf } from './utils/realPdf'

const store = () => usePdfEditorStore.getState()
const PNG_1PX = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII='),
  (c) => c.charCodeAt(0)
)

const ann = (type: AnnotationType, extra: Partial<Annotation> = {}): Annotation => ({
  id: `${type}-${Math.random()}`,
  type,
  page: 1,
  createdAt: new Date().toISOString(),
  startX: 0.1,
  startY: 0.1,
  endX: 0.6,
  endY: 0.3,
  color: '#2457d6',
  ...extra,
})

const contentLength = async (bytes: Uint8Array) => {
  const page = (await PDFDocument.load(bytes)).getPage(0)
  return page.node.normalizedEntries().Contents?.toString().length ?? 0
}

describe('flattening annotation types', () => {
  beforeEach(async () => {
    vi.stubGlobal('indexedDB', new IDBFactory())
    usePdfEditorStore.setState(usePdfEditorStore.getInitialState(), true)
    await store().loadDocument((await makePdf(['body text'])).slice().buffer as ArrayBuffer, 'doc.pdf')
  })

  it.each(['underline', 'strikethrough', 'ellipse', 'arrow'] as const)('draws %s into the page', async (type) => {
    const before = await contentLength(store().pdfData!)
    await store().flattenAnnotations([ann(type)])
    expect(await contentLength(store().pdfData!)).toBeGreaterThan(before)
    expect(await extractPageTexts(store().pdfData!)).toEqual(['body text'])
  })

  it('draws stamp text inside its box, including non-WinAnsi text', async () => {
    await store().flattenAnnotations([ann('stamp', { text: 'approved ✓' })])
    expect((await extractPageTexts(store().pdfData!))[0]).toContain('APPROVED V')
  })

  it('applies redaction marks as true redactions in the same undo step', async () => {
    const rasterize = vi.fn<RedactingRasterizer>(async () => ({ png: PNG_1PX, widthPt: 300, heightPt: 300 }))
    await store().flattenAnnotations([ann('redaction'), ann('underline')], { rasterize })
    expect(rasterize).toHaveBeenCalledTimes(1)
    expect(rasterize.mock.calls[0][2]).toEqual([{ page: 0, x: 0.1, y: 0.1, w: 0.5, h: expect.closeTo(0.2) }])
    expect(await extractPageTexts(store().pdfData!)).toEqual([''])
    store().undoDocument()
    expect(await extractPageTexts(store().pdfData!)).toEqual(['body text'])
  })
})

describe('export safety', () => {
  beforeEach(async () => {
    vi.stubGlobal('indexedDB', new IDBFactory())
    usePdfEditorStore.setState(usePdfEditorStore.getInitialState(), true)
    await store().loadDocument((await makePdf(['secret'])).slice().buffer as ArrayBuffer, 'doc.pdf')
  })

  it('refuses to export while redaction marks are unapplied', async () => {
    useAnnotationStore.setState({ annotations: [ann('redaction'), ann('underline')] })
    await expect(store().exportPdf()).rejects.toBeInstanceOf(PendingRedactionsError)
    await expect(store().exportPdf()).rejects.toThrow(/1 redaction mark is not applied/)
    useAnnotationStore.setState({ annotations: [ann('underline')] })
    await expect(store().exportPdf()).resolves.toBeInstanceOf(Blob)
  })
})

describe('arrowHeadWings', () => {
  it('places both wings behind the tip, symmetric about the shaft', () => {
    const [a, b] = arrowHeadWings({ x: 0, y: 0 }, { x: 10, y: 0 }, 4)
    expect(a[0]).toBeLessThan(10)
    expect(b[0]).toBeCloseTo(a[0])
    expect(a[1]).toBeCloseTo(-b[1])
  })
})

describe('TOOL_CATALOG', () => {
  it('has unique ids and shortcuts', () => {
    expect(new Set(TOOL_CATALOG.map((t) => t.id)).size).toBe(TOOL_CATALOG.length)
    expect(Object.keys(TOOL_BY_SHORTCUT)).toHaveLength(TOOL_CATALOG.length)
  })
})
