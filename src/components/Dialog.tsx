import React, { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

interface DialogProps {
  open: boolean
  title: string
  description?: React.ReactNode
  icon?: React.ReactNode
  onClose: () => void
  children?: React.ReactNode
  /** Buttons, right-aligned at the bottom */
  footer?: React.ReactNode
  /** Element to focus on open; defaults to the first focusable control */
  initialFocusRef?: React.RefObject<HTMLElement | null>
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

/**
 * Accessible modal: labelled, closes on Escape and backdrop click, keeps Tab inside,
 * and returns focus to whatever opened it.
 */
export function Dialog({ open, title, description, icon, onClose, children, footer, initialFocusRef }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const target = initialFocusRef?.current ?? panel?.querySelector<HTMLElement>(FOCUSABLE)
    target?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panel) return
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      previouslyFocused?.focus?.()
    }
  }, [open, onClose, initialFocusRef])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className="relative w-full max-w-md rounded-2xl bg-[var(--pdfoid-surface)] border border-[var(--pdfoid-border)] shadow-[var(--pdfoid-shadow)] p-6 animate-scale-in"
      >
        <div className="flex items-start gap-3">
          {icon && (
            <div className="shrink-0 w-10 h-10 rounded-xl bg-[var(--pdfoid-surface-2)] text-[var(--pdfoid-text)] flex items-center justify-center" aria-hidden="true">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-[var(--pdfoid-text)]">{title}</h2>
            {description && <div id={descId} className="mt-1 text-sm text-[var(--pdfoid-muted)]">{description}</div>}
          </div>
        </div>
        {children && <div className="mt-5">{children}</div>}
        {footer && <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}
