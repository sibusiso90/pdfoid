import React, { useCallback, useEffect, useRef, useState } from 'react'
import { openPdf, type PDFDocumentProxy, type RenderTask } from '../lib/pdfjs'
import { AnnotationCanvas } from './AnnotationCanvas'
import { ArrowsOutLineHorizontal, CaretLeft, CaretRight, CornersOut, Minus, Plus, WarningCircle } from '@phosphor-icons/react'

export default function PDFViewer({ pdfData, onPageChange, targetPage }: { pdfData: ArrayBuffer; onPageChange?: (page: number) => void; targetPage?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const renderTaskRef = useRef<RenderTask | null>(null)
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [pageNum, setPageNum] = useState(1)
  const [scale, setScale] = useState(1.5)
  const [numPages, setNumPages] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [fitMode, setFitMode] = useState<'width' | 'page' | null>('width')
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 })
  const [pendingAutoFit, setPendingAutoFit] = useState(false)
  const e2eFallbackSize = import.meta.env?.VITE_E2E === '1'
    ? { width: 800, height: 1100 }
    : null
  const effectivePageSize = pageSize.width > 0 && pageSize.height > 0
    ? pageSize
    : e2eFallbackSize

  useEffect(() => {
    let cancelled = false
      ; (async () => {
        try {
          setError(null)
          const doc = await openPdf(pdfData)
          if (cancelled) return
          setPdf(doc)
          setNumPages(doc.numPages)
          const desiredPage = targetPage ? Math.min(Math.max(targetPage, 1), doc.numPages) : 1
          setPageNum(desiredPage)
          setScale(1)
          setPageSize({ width: 0, height: 0 })
          setFitMode('width')
          setPendingAutoFit(true)
          onPageChange?.(desiredPage)
        } catch (err) {
          console.error('PDF load failed', err)
          if (!cancelled) {
            setError('Failed to load PDF. Try another file.')
            setPdf(null)
          }
        }
      })()
    return () => { cancelled = true }
  }, [pdfData, targetPage])

  // Handle Page Rendering
  useEffect(() => {
    let isActive = true
    if (!pdf) return

      ; (async () => {
        try {
          setError(null)

          // Cancel previous render task if still running
          renderTaskRef.current?.cancel()

          // Cleanup previous page resources (textures, etc.)
          // This is critical for preventing memory leaks on long documents
          if (containerRef.current && (containerRef.current as any)._pageCleanup) {
            (containerRef.current as any)._pageCleanup();
          }

          const page = await pdf.getPage(pageNum)
          if (!isActive) return

          // Store cleanup method for next cycle
          if (containerRef.current) {
            (containerRef.current as any)._pageCleanup = () => page.cleanup();
          }

          const viewport = page.getViewport({ scale })

          // Use floor to avoid subpixel rendering artifacts that cause blurry text
          const displayWidth = Math.max(1, Math.floor(viewport.width))
          const displayHeight = Math.max(1, Math.floor(viewport.height))

          setPageSize((prev) =>
            prev.width === displayWidth && prev.height === displayHeight
              ? prev
              : { width: displayWidth, height: displayHeight }
          )

          const canvas = canvasRef.current
          if (!canvas) return

          const dpr = window.devicePixelRatio || 1

          // Internal buffer matches physical pixels (High DPI)
          const internalWidth = Math.floor(displayWidth * dpr)
          const internalHeight = Math.floor(displayHeight * dpr)

          if (canvas.width !== internalWidth) {
            canvas.width = internalWidth
          }
          if (canvas.height !== internalHeight) {
            canvas.height = internalHeight
          }

          // CSS style matches logical pixels
          canvas.style.width = `${displayWidth}px`
          canvas.style.height = `${displayHeight}px`

          const ctx = canvas.getContext('2d')
          if (!ctx) return

          // Reset transform to identity before applying scale
          ctx.setTransform(1, 0, 0, 1, 0, 0)

          // Clear with white background (PDFs are transparent by default)
          ctx.fillStyle = '#fff'
          ctx.fillRect(0, 0, internalWidth, internalHeight)

          // Scale context to match DPR
          if (dpr !== 1) {
            ctx.scale(dpr, dpr);
          }

          const renderContext = { canvas, canvasContext: ctx, viewport }
          // Note: We don't use the 'transform' property of renderContext here because
          // we scaled the ctx directly. This is often more reliable for annotations.

          const renderTask = page.render(renderContext)
          renderTaskRef.current = renderTask
          await renderTask.promise

          if (!isActive) return

          renderTaskRef.current = null
        } catch (err: any) {
          const message = String(err?.message || err)
          const normalized = message.toLowerCase()
          if (normalized.includes('canceled') || normalized.includes('cancelled') || normalized.includes('renderingcancelledexception')) {
            return
          }
          console.error('Render page failed', err)
          if (isActive) setError('Failed to render page.')
        }
      })()

    return () => {
      isActive = false
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel()
        } catch {
          // Ignore cancellation errors
        }
      }
    }
  }, [pdf, pageNum, scale, onPageChange])

  useEffect(() => {
    if (!pdf || !targetPage || !numPages) return
    const clamped = Math.min(Math.max(targetPage, 1), numPages)
    if (clamped !== pageNum) {
      setPageNum(clamped)
    }
  }, [targetPage, pdf, numPages, pageNum])

  const handleZoomOut = () => {
    setFitMode(null)
    setScale((s) => Math.max(0.25, s - 0.25))
  }

  const handleZoomIn = () => {
    setFitMode(null)
    setScale((s) => Math.min(3, s + 0.25))
  }

  const handleZoomReset = () => {
    setFitMode(null)
    setScale(1)
  }

  // Improved Fit Logic: Account for scrollbars and padding
  const fitToWidth = useCallback(async () => {
    if (!pdf || !containerRef.current) return
    try {
      const page = await pdf.getPage(pageNum)
      const viewport = page.getViewport({ scale: 1 })
      // Subtract padding (32px = 2rem) and potential scrollbar (16px) assurance
      const availableWidth = Math.max(100, containerRef.current.clientWidth - 48)
      const clamped = Math.min(3, Math.max(0.25, availableWidth / viewport.width))
      setScale((prev) => (Math.abs(prev - clamped) < 0.001 ? prev : clamped))
      setFitMode((prev) => (prev === 'width' ? prev : 'width'))
    } catch (err) {
      console.warn('Unable to fit page to width', err)
    }
  }, [pdf, pageNum])

  const fitToPage = useCallback(async () => {
    if (!pdf || !containerRef.current) return
    try {
      const page = await pdf.getPage(pageNum)
      const viewport = page.getViewport({ scale: 1 })
      const container = containerRef.current
      const availableWidth = Math.max(100, container.clientWidth - 48)
      // Leave room for the top padding and the floating pager pill
      const availableHeight = Math.max(100, container.clientHeight - 136)
      const ratio = Math.min(availableWidth / viewport.width, availableHeight / viewport.height)
      const clamped = Math.min(3, Math.max(0.25, ratio))
      setScale((prev) => (Math.abs(prev - clamped) < 0.001 ? prev : clamped))
      setFitMode((prev) => (prev === 'page' ? prev : 'page'))
    } catch (err) {
      console.warn('Unable to fit page inside container', err)
    }
  }, [pdf, pageNum])

  // Throttle auto-fit to prevent layout thrashing
  useEffect(() => {
    if (!pdf || !pendingAutoFit) return
    const timer = setTimeout(() => {
      fitToWidth().finally(() => setPendingAutoFit(false))
    }, 50);
    return () => clearTimeout(timer);
  }, [pdf, pendingAutoFit, fitToWidth])

  useEffect(() => {
    if (!pdf || !fitMode) return;
    // Re-trigger fit when pdf/pageNum changes if mode is active
    // But debounce it slightly? No, usually fine.
    if (fitMode === 'width') fitToWidth();
    else if (fitMode === 'page') fitToPage();
  }, [pdf, pageNum, fitMode]) // Removed fitToWidth/Page from deps to avoid cycles if instance changes

  // Handle dynamic resizing in fit modes with Debounce
  useEffect(() => {
    const container = containerRef.current
    if (!container || !fitMode) return

    let timeoutId: any;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (fitMode === 'width') {
          fitToWidth()
        } else if (fitMode === 'page') {
          fitToPage()
        }
      }, 100); // 100ms debounce
    })

    resizeObserver.observe(container)
    return () => {
      resizeObserver.disconnect();
      clearTimeout(timeoutId);
    }
  }, [fitMode, fitToWidth, fitToPage])

  // Keyboard shortcuts for zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case '=':
          case '+':
            e.preventDefault()
            handleZoomIn()
            break
          case '-':
            e.preventDefault()
            handleZoomOut()
            break
          case '0':
            e.preventDefault()
            handleZoomReset()
            break
        }
      }
      if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        fitToWidth()
      }
    };

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [fitToWidth, handleZoomIn, handleZoomOut, handleZoomReset])

  const disablePrev = pageNum <= 1
  const disableNext = numPages === 0 || pageNum >= numPages

  const requestPageChange = useCallback(
    (candidate: number) => {
      if (!numPages) return
      const clamped = Math.min(Math.max(candidate, 1), numPages)
      if (clamped !== pageNum) {
        setPageNum(clamped)
      }
      onPageChange?.(clamped)
    },
    [numPages, onPageChange, pageNum]
  )

  // Page input for direct navigation
  const handlePageInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value, 10)
      if (!isNaN(value) && value >= 1 && value <= numPages) {
        requestPageChange(value)
      }
    },
    [numPages, requestPageChange]
  )

  const pillButton = 'inline-flex items-center justify-center h-8 min-w-8 px-1.5 rounded-lg text-[var(--pdfoid-muted)] hover:text-[var(--pdfoid-text)] hover:bg-[var(--pdfoid-hover)] active:scale-[0.96] disabled:opacity-35 disabled:pointer-events-none transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pdfoid-ring)]'
  const pillToggle = (active: boolean) => `${pillButton} ${active ? 'bg-[var(--pdfoid-accent-soft)] text-[var(--pdfoid-accent)] hover:bg-[var(--pdfoid-accent-soft)] hover:text-[var(--pdfoid-accent)]' : ''}`

  return (
    <div className="relative flex flex-col h-full canvas-grain" role="region" aria-label="PDF Viewer">
      {/* Canvas well */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto scrollbar-thin flex items-start justify-center px-6 pt-8 pb-36 md:pb-24"
        role="document"
        aria-label={`PDF document, page ${pageNum} of ${numPages}`}
        tabIndex={0}
      >
        {error ? (
          <div className="m-auto max-w-xs text-center" role="alert" aria-live="assertive">
            <div className="w-12 h-12 rounded-xl bg-[var(--pdfoid-danger-soft)] text-[var(--pdfoid-danger)] flex items-center justify-center mx-auto mb-4" aria-hidden="true">
              <WarningCircle size={24} />
            </div>
            <p className="font-semibold text-[var(--pdfoid-text)] mb-1">This PDF could not be opened</p>
            <p className="text-sm text-[var(--pdfoid-muted)]">{error}</p>
          </div>
        ) : (
          <div style={{ position: 'relative', display: 'inline-block' }} className="animate-fade-in">
            <canvas
              ref={canvasRef}
              className="block bg-white rounded-sm shadow-[var(--pdfoid-shadow-page)]"
              aria-label={`PDF page ${pageNum} content`}
              data-testid="pdf-content-canvas"
            />
            {effectivePageSize && (
              <AnnotationCanvas
                pdfScale={scale}
                pageWidth={effectivePageSize.width}
                pageHeight={effectivePageSize.height}
                currentPage={pageNum}
              />
            )}
          </div>
        )}
      </div>

      {/* Floating pager + zoom */}
      <div
        className="absolute left-1/2 -translate-x-1/2 bottom-20 md:bottom-5 z-20 flex items-center gap-1 p-1 rounded-xl bg-[var(--pdfoid-surface)]/95 backdrop-blur-md border border-[var(--pdfoid-border)] shadow-[var(--pdfoid-shadow)] max-w-[calc(100%-32px)] overflow-x-auto scrollbar-none"
        role="toolbar"
        aria-label="PDF navigation and zoom controls"
      >
        <div className="flex items-center gap-0.5" role="group" aria-label="Page navigation">
          <button
            type="button"
            onClick={() => requestPageChange(pageNum - 1)}
            disabled={disablePrev}
            aria-label="Go to previous page"
            aria-keyshortcuts="PageUp"
            title="Previous page"
            className={pillButton}
          >
            <CaretLeft size={16} weight="bold" aria-hidden />
          </button>
          <div className="flex items-center gap-1.5 px-1 text-sm text-[var(--pdfoid-muted)] whitespace-nowrap tabular-nums">
            <label htmlFor="page-input" className="sr-only">Current page</label>
            <input
              id="page-input"
              type="number"
              min={1}
              max={numPages || 1}
              value={pageNum}
              onChange={handlePageInputChange}
              className="w-10 h-7 text-center rounded-md bg-[var(--pdfoid-surface-2)] text-[var(--pdfoid-text)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--pdfoid-ring)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              aria-label={`Current page, ${pageNum} of ${numPages}`}
            />
            <span>of {numPages > 0 ? numPages : '…'}</span>
          </div>
          <button
            type="button"
            onClick={() => requestPageChange(pageNum + 1)}
            disabled={disableNext}
            aria-label="Go to next page"
            aria-keyshortcuts="PageDown"
            title="Next page"
            className={pillButton}
          >
            <CaretRight size={16} weight="bold" aria-hidden />
          </button>
        </div>

        <span className="self-stretch w-px my-1.5 mx-1 bg-[var(--pdfoid-border)]" aria-hidden="true" />

        <div className="flex items-center gap-0.5" role="group" aria-label="Zoom controls">
          <button type="button" onClick={handleZoomOut} aria-label="Zoom out" aria-keyshortcuts="Control+-" title="Zoom out" className={pillButton}>
            <Minus size={16} weight="bold" aria-hidden />
          </button>
          <span
            className="w-12 text-center text-sm font-medium text-[var(--pdfoid-text)] tabular-nums"
            aria-live="polite"
            aria-label={`Current zoom level: ${Math.round(scale * 100)} percent`}
          >
            {Math.round(scale * 100)}%
          </span>
          <button type="button" onClick={handleZoomIn} aria-label="Zoom in" aria-keyshortcuts="Control+=" title="Zoom in" className={pillButton}>
            <Plus size={16} weight="bold" aria-hidden />
          </button>
          <span className="self-stretch w-px my-1.5 mx-1 bg-[var(--pdfoid-border)]" aria-hidden="true" />
          <button
            type="button"
            onClick={fitToWidth}
            aria-label="Fit document to width"
            aria-keyshortcuts="F"
            aria-pressed={fitMode === 'width'}
            title="Fit to width (F)"
            className={pillToggle(fitMode === 'width')}
          >
            <ArrowsOutLineHorizontal size={16} aria-hidden />
          </button>
          <button
            type="button"
            onClick={fitToPage}
            aria-label="Fit entire page in view"
            aria-pressed={fitMode === 'page'}
            title="Fit page"
            className={pillToggle(fitMode === 'page')}
          >
            <CornersOut size={16} aria-hidden />
          </button>
          <button
            type="button"
            onClick={handleZoomReset}
            aria-label="Reset zoom to 100%"
            aria-keyshortcuts="Control+0"
            title="Actual size (Ctrl+0)"
            className={`${pillButton} text-xs font-semibold px-2`}
          >
            1:1
          </button>
        </div>
      </div>
    </div>
  )
}
