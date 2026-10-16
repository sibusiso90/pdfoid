import React, { useEffect, useRef, useState } from 'react'
import { usePdfEditorStore } from '../store/pdfEditorStore'
import { closePdf, openPdf, type PDFDocumentProxy } from '../lib/pdfjs'

const THUMB_WIDTH = 104

function Thumbnail({ doc, pageIndex, active, onSelect }: {
  doc: PDFDocumentProxy
  pageIndex: number
  active: boolean
  onSelect: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLButtonElement>(null)
  const [visible, setVisible] = useState(false)
  const [aspect, setAspect] = useState(1.294)

  // Render only once the thumbnail scrolls near the viewport
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true)
        io.disconnect()
      }
    }, { rootMargin: '200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    let task: { cancel: () => void; promise: Promise<void> } | null = null
    ;(async () => {
      try {
        const page = await doc.getPage(pageIndex + 1)
        if (cancelled) return
        const base = page.getViewport({ scale: 1 })
        const dpr = window.devicePixelRatio || 1
        const viewport = page.getViewport({ scale: (THUMB_WIDTH / base.width) * dpr })
        setAspect(base.height / base.width)
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (!canvas || !ctx) return
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        task = page.render({ canvas, canvasContext: ctx, viewport })
        await task.promise
      } catch (err) {
        const msg = String((err as Error)?.message || err).toLowerCase()
        if (!msg.includes('cancel')) console.warn('Thumbnail render failed', err)
      }
    })()
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [doc, pageIndex, visible])

  useEffect(() => {
    if (active) wrapRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [active])

  return (
    <button
      ref={wrapRef}
      type="button"
      onClick={onSelect}
      aria-label={`Go to page ${pageIndex + 1}`}
      aria-current={active ? 'page' : undefined}
      className="group flex flex-col items-center gap-1.5 w-full py-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pdfoid-ring)]"
    >
      <span
        className={`block bg-white rounded-sm overflow-hidden transition-shadow duration-200 ${active
          ? 'shadow-[0_0_0_2px_var(--pdfoid-accent)]'
          : 'shadow-[0_0_0_1px_var(--pdfoid-border-strong)] group-hover:shadow-[0_0_0_2px_var(--pdfoid-border-strong)]'}`}
        style={{ width: THUMB_WIDTH, height: Math.round(THUMB_WIDTH * aspect) }}
      >
        <canvas ref={canvasRef} className="block w-full h-full" aria-hidden="true" />
      </span>
      <span className={`text-xs tabular-nums ${active ? 'font-semibold text-[var(--pdfoid-accent)]' : 'text-[var(--pdfoid-muted)]'}`}>
        {pageIndex + 1}
      </span>
    </button>
  )
}

/**
 * Page thumbnails for the current document. Re-renders whenever the document changes.
 */
export function PageThumbnails({ currentPage, onSelectPage }: { currentPage: number; onSelectPage: (page: number) => void }) {
  const pdfData = usePdfEditorStore((s) => s.pdfData)
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)

  useEffect(() => {
    if (!pdfData) return
    let cancelled = false
    let opened: PDFDocumentProxy | null = null
    openPdf(pdfData)
      .then((d) => {
        if (cancelled) {
          void closePdf(d)
          return
        }
        opened = d
        setDoc(d)
      })
      .catch((err) => console.warn('Thumbnails could not open the document', err))
    return () => {
      cancelled = true
      if (opened) void closePdf(opened)
    }
  }, [pdfData])

  if (!doc) {
    return (
      <div className="flex flex-col items-center gap-4 py-4" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-sm bg-[var(--pdfoid-surface-2)] animate-pulse" style={{ width: THUMB_WIDTH, height: Math.round(THUMB_WIDTH * 1.294) }} />
        ))}
      </div>
    )
  }

  return (
    <nav aria-label="Pages" className="grid grid-cols-2 gap-x-2 px-3 py-2">
      {Array.from({ length: doc.numPages }, (_, i) => (
        <Thumbnail key={`${i}`} doc={doc} pageIndex={i} active={currentPage === i + 1} onSelect={() => onSelectPage(i + 1)} />
      ))}
    </nav>
  )
}
