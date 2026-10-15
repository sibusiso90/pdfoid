import React, { useCallback, useEffect, useState } from 'react'
import { FilePdf, X } from '@phosphor-icons/react'
import { usePdfEditorStore } from '../store/pdfEditorStore'
import { useUIStore } from '../store/uiStore'
import { listRecent, removeRecent, type RecentFileMeta } from '../utils/recentFiles'

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`

const formatWhen = (ts: number) => {
  const diffMin = Math.round((Date.now() - ts) / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin} min ago`
  const d = new Date(ts)
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

/**
 * Files autosaved in this browser, newest first
 */
export function RecentFiles() {
  const openRecent = usePdfEditorStore((s) => s.openRecent)
  const error = useUIStore((s) => s.error)
  const [items, setItems] = useState<RecentFileMeta[] | null>(null)
  const [opening, setOpening] = useState<string | null>(null)

  const refresh = useCallback(() => {
    listRecent()
      .then(setItems)
      .catch((err) => {
        console.warn('Could not list recent files', err)
        setItems([])
      })
  }, [])

  useEffect(refresh, [refresh])

  if (!items?.length) return null

  return (
    <section className="mt-10" aria-labelledby="recent-files-heading">
      <h3 id="recent-files-heading" className="text-sm font-semibold text-[var(--pdfoid-text)] mb-2">Recent</h3>
      <ul className="rounded-xl bg-[var(--pdfoid-surface)] border border-[var(--pdfoid-border)] divide-y divide-[var(--pdfoid-border)] overflow-hidden">
        {items.map((item) => (
          <li key={item.id} className="group relative flex items-center">
            <button
              type="button"
              onClick={async () => {
                setOpening(item.id)
                try {
                  await openRecent(item.id)
                } catch (err) {
                  error('Could not open that file', err instanceof Error ? err.message : undefined)
                  refresh()
                } finally {
                  setOpening(null)
                }
              }}
              className="flex-1 min-w-0 flex items-center gap-3 pl-3 pr-12 py-2.5 text-left hover:bg-[var(--pdfoid-hover)] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--pdfoid-ring)]"
            >
              <FilePdf size={20} className="shrink-0 text-[var(--pdfoid-muted)]" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-[var(--pdfoid-text)]">{item.name}</span>
                <span className="block text-xs text-[var(--pdfoid-muted)] tabular-nums">
                  {opening === item.id ? 'Opening…' : `${formatWhen(item.updatedAt)} · ${formatSize(item.size)}`}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={async () => {
                await removeRecent(item.id).catch(() => undefined)
                refresh()
              }}
              className="absolute right-2 inline-flex items-center justify-center w-8 h-8 rounded-md text-[var(--pdfoid-muted)] hover:text-[var(--pdfoid-text)] hover:bg-[var(--pdfoid-hover)] opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pdfoid-ring)]"
              aria-label={`Remove ${item.name} from recent files`}
              title="Remove from recent"
            >
              <X size={14} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
