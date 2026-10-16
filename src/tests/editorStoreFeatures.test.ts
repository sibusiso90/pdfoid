import { describe, it, expect, beforeEach, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { PDFDocument } from '@cantoo/pdf-lib'
import { usePdfEditorStore, MAX_DOC_HISTORY } from '../store/pdfEditorStore'
import { encryptPdf } from '../utils/pdfOps/encrypt'
import { listRecent } from '../utils/recentFiles'
import { extractPageTexts, makePdf } from './utils/realPdf'

const store = () => usePdfEditorStore.getState()
const asBuffer = (bytes: Uint8Array) => bytes.slice().buffer as ArrayBuffer
const texts = () => extractPageTexts(store().pdfData!)

const reset = () => {
  vi.stubGlobal('indexedDB', new IDBFactory())
  usePdfEditorStore.setState(usePdfEditorStore.getInitialState(), true)
}

const load = async (pages: string[], name = 'doc.pdf') => {
  await store().loadDocument(asBuffer(await makePdf(pages)), name)
}

describe('pdfEditorStore — document history', () => {
  beforeEach(reset)

  it('undoes and redoes page operations with exact bytes and page count', async () => {
    await load(['one', 'two', 'three'])
    const original = store().pdfData
    expect(store().canUndoDocument).toBe(false)

    await store().deletePage(1)
    expect(store().numPages).toBe(2)
    await store().rotatePage({ pageIndex: 0, direction: 'right' })
    expect(store().canUndoDocument).toBe(true)

    store().undoDocument() // rotation
    store().undoDocument() // delete
    expect(store().numPages).toBe(3)
    expect(store().pdfData).toBe(original)
    expect(store().canUndoDocument).toBe(false)
    expect(store().canRedoDocument).toBe(true)

    store().redoDocument()
    expect(store().numPages).toBe(2)
    expect(await texts()).toEqual(['one', 'three'])
  })

  it('clears redo after a new change', async () => {
    await load(['a', 'b'])
    await store().deletePage(0)
    store().undoDocument()
    expect(store().canRedoDocument).toBe(true)
    await store().addBlankPage()
    expect(store().canRedoDocument).toBe(false)
    expect(store().numPages).toBe(3)
  })

  it(`keeps at most ${MAX_DOC_HISTORY} undo steps`, async () => {
    await load(['a'])
    for (let i = 0; i < MAX_DOC_HISTORY + 3; i++) await store().addBlankPage()
    expect(store().docPast).toHaveLength(MAX_DOC_HISTORY)
  })

  it('resets history when a new document is loaded', async () => {
    await load(['a'])
    await store().addBlankPage()
    await load(['b'], 'other.pdf')
    expect(store().canUndoDocument).toBe(false)
    expect(store().docPast).toEqual([])
  })
})

describe('pdfEditorStore — password-protected files', () => {
  beforeEach(reset)

  it('asks for a password, reports a wrong one, and opens with the right one', async () => {
    const locked = await encryptPdf(await makePdf(['classified']), { userPassword: 'pw' })
    await store().loadDocument(asBuffer(locked), 'locked.pdf')
    expect(store().passwordRequest).toEqual({ fileName: 'locked.pdf', reason: 'needed' })
    expect(store().pdfData).toBeNull()

    await store().submitPassword('wrong')
    expect(store().passwordRequest?.reason).toBe('incorrect')

    await store().submitPassword('pw')
    expect(store().passwordRequest).toBeNull()
    expect(store().fileName).toBe('locked.pdf')
    expect(await texts()).toEqual(['classified'])
  })

  it('opens permission-only encrypted files without prompting', async () => {
    // Empty user password + owner password: opens anywhere, only permissions are restricted.
    const doc = await PDFDocument.load(await makePdf(['open me']))
    doc.encrypt({ userPassword: '', ownerPassword: 'owner' })
    await store().loadDocument(asBuffer(await doc.save()), 'restricted.pdf')
    expect(store().passwordRequest).toBeNull()
    expect(await texts()).toEqual(['open me'])
    expect((await PDFDocument.load(store().pdfData!)).isEncrypted).toBe(false)
  })

  it('cancelling clears the prompt', async () => {
    const locked = await encryptPdf(await makePdf(['x']), { userPassword: 'pw' })
    await store().loadDocument(asBuffer(locked), 'locked.pdf')
    store().cancelPasswordRequest()
    expect(store().passwordRequest).toBeNull()
  })

  it('exports with a password when asked', async () => {
    await load(['secret'])
    const blob = await store().exportPdf({ password: 'pw' })
    const bytes = new Uint8Array(await blob.arrayBuffer())
    expect(await extractPageTexts(bytes, 'pw')).toEqual(['secret'])
    await expect(extractPageTexts(bytes)).rejects.toMatchObject({ reason: 'needed' })
  })
})

describe('pdfEditorStore — feature actions', () => {
  beforeEach(reset)

  it('merges files into the open document (undoable)', async () => {
    await load(['A'])
    await store().mergeDocuments([asBuffer(await makePdf(['B', 'C']))])
    expect(await texts()).toEqual(['A', 'B', 'C'])
    store().undoDocument()
    expect(store().numPages).toBe(1)
  })

  it('extracts a page range without changing the open document', async () => {
    await load(['p1', 'p2', 'p3'])
    const blob = await store().extractPagesToBlob('2-3')
    expect(await extractPageTexts(new Uint8Array(await blob.arrayBuffer()))).toEqual(['p2', 'p3'])
    expect(store().numPages).toBe(3)
    await expect(store().extractPagesToBlob('9')).rejects.toThrow(/only 3 pages/)
  })

  it('stamps page numbers and a watermark', async () => {
    await load(['a', 'b'])
    await store().addPageNumbers()
    await store().addWatermark({ text: 'DRAFT' })
    const [first] = await texts()
    expect(first).toContain('1 / 2')
    expect(first).toContain('DRAFT')
  })

  it('redacts through the store', async () => {
    await load(['keep', 'remove me'])
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII='), (c) => c.charCodeAt(0))
    await store().redact([{ page: 1, x: 0, y: 0, w: 1, h: 1 }], { rasterize: async () => ({ png, widthPt: 300, heightPt: 300 }) })
    expect(await texts()).toEqual(['keep', ''])
  })

  it('autosaves to recent files after loading and after edits', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      await load(['a'], 'autosaved.pdf')
      await store().addBlankPage()
      await vi.runAllTimersAsync()
    } finally {
      vi.useRealTimers()
    }
    await vi.waitFor(async () => {
      const recent = await listRecent()
      expect(recent[0]).toMatchObject({ id: store().recentId, name: 'autosaved.pdf' })
    })
  })

  it('reopens a recent file under the same id', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      await load(['first'], 'first.pdf')
      await vi.runAllTimersAsync()
    } finally {
      vi.useRealTimers()
    }
    const id = store().recentId!
    await vi.waitFor(async () => expect((await listRecent()).map((r) => r.id)).toContain(id))
    await load(['second'], 'second.pdf')
    await store().openRecent(id)
    expect(store().recentId).toBe(id)
    expect(store().fileName).toBe('first.pdf')
    expect(await texts()).toEqual(['first'])
  })
})
