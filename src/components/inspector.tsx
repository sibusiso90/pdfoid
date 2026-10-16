import React, { useState } from 'react'
import { CaretDown } from '@phosphor-icons/react'

export const actionTile = 'flex items-center gap-2 h-9 px-3 rounded-lg text-sm font-medium text-[var(--pdfoid-text)] bg-[var(--pdfoid-surface-2)] hover:bg-[var(--pdfoid-pressed)] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none transition-[background-color,transform] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pdfoid-ring)]'
export const fieldClass = 'w-full h-9 px-3 rounded-lg text-sm bg-[var(--pdfoid-surface)] text-[var(--pdfoid-text)] border border-[var(--pdfoid-border-strong)] placeholder:text-[var(--pdfoid-subtle)] focus:outline-none focus:border-[var(--pdfoid-accent)] focus:ring-2 focus:ring-[var(--pdfoid-ring)] disabled:opacity-50 transition-[border-color,box-shadow] duration-200'
export const checkboxClass = 'h-4 w-4 rounded accent-[var(--pdfoid-accent)]'

/**
 * Collapsible inspector section
 */
export const InspectorSection: React.FC<{
  title: string
  meta?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}> = ({ title, meta, defaultOpen = true, children }) => {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="border-b border-[var(--pdfoid-border)] last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-4 h-11 text-left text-sm font-semibold text-[var(--pdfoid-text)] hover:bg-[var(--pdfoid-hover)] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--pdfoid-ring)]"
      >
        <span className="flex items-center gap-2">
          {title}
          {meta && <span className="text-xs font-medium text-[var(--pdfoid-muted)]">{meta}</span>}
        </span>
        <CaretDown
          size={14}
          className={`text-[var(--pdfoid-muted)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${open ? '' : '-rotate-90'}`}
          aria-hidden
        />
      </button>
      {open && <div className="px-4 pb-4 pt-1 animate-fade-in">{children}</div>}
    </section>
  )
}

export const fieldLabel = 'text-xs font-medium text-[var(--pdfoid-muted)]'
export const selectClass = `${fieldClass} appearance-none pr-8 bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 256 256'%3E%3Cpath fill='%2371717a' d='M213.66 101.66l-80 80a8 8 0 0 1-11.32 0l-80-80a8 8 0 0 1 11.32-11.32L128 164.69l74.34-74.35a8 8 0 0 1 11.32 11.32Z'/%3E%3C/svg%3E")] bg-no-repeat bg-[position:right_12px_center]`
export const primaryTile = 'flex items-center justify-center gap-2 h-9 px-3 rounded-lg text-sm font-semibold bg-[var(--pdfoid-text)] text-[var(--pdfoid-surface)] hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pdfoid-ring)]'
