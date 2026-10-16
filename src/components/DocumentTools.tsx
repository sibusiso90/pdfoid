import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  ArrowCounterClockwise,
  ArrowClockwise,
  FilePlus,
  Files,
  Lock,
  ScanSmiley,
  TextAa,
} from '@phosphor-icons/react'
import { usePdfEditorStore } from '../store/pdfEditorStore'
import { useUIStore } from '../store/uiStore'
import { OCR_LANGUAGE_NOTICE, type OcrProgress } from '../utils/ocr'
import type { FormField, FormValue } from '../utils/pdfOps/forms'
import type { StampPosition } from '../utils/pdfOps/stamping'
import { Dialog } from './Dialog'
import { Button, IconButton } from './ui'
import { actionTile, checkboxClass, fieldClass, fieldLabel, primaryTile, selectClass } from './inspector'
import { downloadBlob, useDownloadPdf } from './useDownloadPdf'

/** Runs a document operation with a busy flag, a success toast and a readable error toast. */
function useRun() {
  const { success, error } = useUIStore(useShallow((s) => ({ success: s.success, error: s.error })))
  const [busy, setBusy] = useState<string | null>(null)
  const run = useCallback(async (key: string, task: () => Promise<string | void>) => {
    setBusy(key)
    try {
      const message = await task()
      if (message) success(message)
      return true
    } catch (err) {
      console.error(`${key} failed`, err)
      error('That did not work', err instanceof Error ? err.message : 'Please try again.')
      return false
    } finally {
      setBusy(null)
    }
  }, [success, error])
  return { busy, run }
}

const readFiles = (files: FileList) => Promise.all(Array.from(files).map((f) => f.arrayBuffer()))

/**
 * Document-level undo/redo (page operations, stamping, forms). Annotations keep their own history.
 */
export function DocumentHistoryBar() {
  const { canUndo, canRedo, undo, redo, dirty } = usePdfEditorStore(
    useShallow((s) => ({
      canUndo: s.canUndoDocument,
      canRedo: s.canRedoDocument,
      undo: s.undoDocument,
      redo: s.redoDocument,
      dirty: s.dirty,
    }))
  )
  return (
    <div className="flex items-center justify-between gap-2 h-12 px-4 border-b border-[var(--pdfoid-border)] shrink-0">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-[var(--pdfoid-text)]">Document</h2>
      </div>
      <div className="flex items-center gap-0.5">
        {dirty && <span className="mr-2 text-xs text-[var(--pdfoid-muted)]">Edited</span>}
        <IconButton
          icon={<ArrowCounterClockwise size={16} />}
          label="Undo document change"
          aria-keyshortcuts="Control+Alt+Z"
          size="sm"
          onClick={undo}
          disabled={!canUndo}
        />
        <IconButton
          icon={<ArrowClockwise size={16} />}
          label="Redo document change"
          aria-keyshortcuts="Control+Alt+Shift+Z"
          size="sm"
          onClick={redo}
          disabled={!canRedo}
        />
      </div>
    </div>
  )
}

/**
 * Append other PDFs to this one, or save a page range as a new file.
 */
export function MergeExtractSection() {
  const { mergeDocuments, extractPagesToBlob, numPages, fileName } = usePdfEditorStore(
    useShallow((s) => ({
      mergeDocuments: s.mergeDocuments,
      extractPagesToBlob: s.extractPagesToBlob,
      numPages: s.numPages,
      fileName: s.fileName,
    }))
  )
  const { busy, run } = useRun()
  const mergeInputRef = useRef<HTMLInputElement>(null)
  const [selection, setSelection] = useState('')
  const [rangeError, setRangeError] = useState<string | null>(null)

  const onMergeFiles: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const files = e.target.files
    if (!files?.length) return
    const count = files.length
    const buffers = await readFiles(files)
    e.target.value = ''
    await run('Merge', async () => {
      await mergeDocuments(buffers)
      return `Added ${count} PDF${count === 1 ? '' : 's'} to the end of this document`
    })
  }

  const onExtract = async (e: React.FormEvent) => {
    e.preventDefault()
    setRangeError(null)
    try {
      const blob = await extractPagesToBlob(selection)
      downloadBlob(blob, `${(fileName || 'document').replace(/\.pdf$/i, '')}-pages.pdf`)
    } catch (err) {
      if (err instanceof RangeError) setRangeError(err.message)
      else setRangeError(err instanceof Error ? err.message : 'Could not extract those pages.')
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <button type="button" className={`${actionTile} w-full`} onClick={() => mergeInputRef.current?.click()} disabled={busy !== null}>
          <FilePlus size={16} className="text-[var(--pdfoid-muted)]" aria-hidden />
          {busy === 'Merge' ? 'Merging…' : 'Append PDFs…'}
        </button>
        <input ref={mergeInputRef} type="file" accept="application/pdf,.pdf" multiple className="hidden" onChange={onMergeFiles} aria-label="Choose PDFs to append" />
      </div>

      <form onSubmit={onExtract} className="space-y-1.5">
        <label htmlFor="extract-pages-input" className={fieldLabel}>Save pages as a new PDF</label>
        <div className="flex gap-2">
          <input
            id="extract-pages-input"
            value={selection}
            onChange={(e) => {
              setSelection(e.target.value)
              setRangeError(null)
            }}
            placeholder={numPages > 1 ? `e.g. 1-${Math.min(3, numPages)}, ${numPages}` : 'e.g. 1'}
            className={`${fieldClass} flex-1`}
            aria-invalid={rangeError ? true : undefined}
            aria-describedby={rangeError ? 'extract-pages-error' : undefined}
          />
          <button type="submit" className={actionTile} disabled={!selection.trim()}>
            <Files size={16} className="text-[var(--pdfoid-muted)]" aria-hidden />
            Save
          </button>
        </div>
        {rangeError && <p id="extract-pages-error" className="text-sm text-[var(--pdfoid-danger)]">{rangeError}</p>}
      </form>
    </div>
  )
}

const positionOptions: Array<{ value: StampPosition; label: string }> = [
  { value: 'bottom-center', label: 'Bottom center' },
  { value: 'bottom-right', label: 'Bottom right' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'top-center', label: 'Top center' },
  { value: 'top-right', label: 'Top right' },
  { value: 'top-left', label: 'Top left' },
]

const formatOptions = [
  { value: '{n}', label: '1' },
  { value: '{n} / {total}', label: '1 / 12' },
  { value: 'Page {n} of {total}', label: 'Page 1 of 12' },
]

type StampTab = 'numbers' | 'watermark' | 'header'

/**
 * Page numbers, watermark, header and footer
 */
export function StampSection() {
  const { addPageNumbers, addWatermark, addHeaderFooter } = usePdfEditorStore(
    useShallow((s) => ({
      addPageNumbers: s.addPageNumbers,
      addWatermark: s.addWatermark,
      addHeaderFooter: s.addHeaderFooter,
    }))
  )
  const { busy, run } = useRun()
  const [tab, setTab] = useState<StampTab>('numbers')
  const [format, setFormat] = useState('{n} / {total}')
  const [position, setPosition] = useState<StampPosition>('bottom-center')
  const [startAt, setStartAt] = useState(1)
  const [skipCover, setSkipCover] = useState(false)
  const [watermark, setWatermark] = useState('CONFIDENTIAL')
  const [opacity, setOpacity] = useState(0.15)
  const [diagonal, setDiagonal] = useState(true)
  const [header, setHeader] = useState('')
  const [footer, setFooter] = useState('')

  const tabs: Array<{ id: StampTab; label: string }> = [
    { id: 'numbers', label: 'Page numbers' },
    { id: 'watermark', label: 'Watermark' },
    { id: 'header', label: 'Header' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[var(--pdfoid-surface-2)]" role="tablist" aria-label="Stamp type">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`h-7 rounded-md text-xs font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pdfoid-ring)] ${tab === t.id
              ? 'bg-[var(--pdfoid-surface)] text-[var(--pdfoid-text)] shadow-sm'
              : 'text-[var(--pdfoid-muted)] hover:text-[var(--pdfoid-text)]'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'numbers' && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            run('Page numbers', async () => {
              await addPageNumbers({ format, position, startAt, skipPages: skipCover ? [0] : undefined })
              return 'Page numbers added'
            })
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1.5">
              <span className={fieldLabel}>Format</span>
              <select value={format} onChange={(e) => setFormat(e.target.value)} className={selectClass}>
                {formatOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className={fieldLabel}>Start at</span>
              <input type="number" min={0} value={startAt} onChange={(e) => setStartAt(Number(e.target.value) || 1)} className={`${fieldClass} tabular-nums`} />
            </label>
          </div>
          <label className="block space-y-1.5">
            <span className={fieldLabel}>Position</span>
            <select value={position} onChange={(e) => setPosition(e.target.value as StampPosition)} className={selectClass}>
              {positionOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--pdfoid-text)] cursor-pointer">
            <input type="checkbox" checked={skipCover} onChange={(e) => setSkipCover(e.target.checked)} className={checkboxClass} />
            Skip the first page
          </label>
          <button type="submit" className={`${primaryTile} w-full`} disabled={busy !== null}>
            {busy === 'Page numbers' ? 'Adding…' : 'Add page numbers'}
          </button>
        </form>
      )}

      {tab === 'watermark' && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            run('Watermark', async () => {
              await addWatermark({ text: watermark.trim(), opacity, rotationDeg: diagonal ? 45 : 0 })
              return 'Watermark added to every page'
            })
          }}
        >
          <label className="block space-y-1.5">
            <span className={fieldLabel}>Text</span>
            <input value={watermark} onChange={(e) => setWatermark(e.target.value)} className={fieldClass} placeholder="CONFIDENTIAL" />
          </label>
          <label className="block space-y-2">
            <span className="flex justify-between text-xs font-medium text-[var(--pdfoid-muted)]">
              Opacity <span className="text-[var(--pdfoid-text)] tabular-nums">{Math.round(opacity * 100)}%</span>
            </span>
            <input type="range" min={0.05} max={0.6} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="range w-full" />
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--pdfoid-text)] cursor-pointer">
            <input type="checkbox" checked={diagonal} onChange={(e) => setDiagonal(e.target.checked)} className={checkboxClass} />
            Diagonal
          </label>
          <button type="submit" className={`${primaryTile} w-full`} disabled={busy !== null || !watermark.trim()}>
            {busy === 'Watermark' ? 'Adding…' : 'Add watermark'}
          </button>
        </form>
      )}

      {tab === 'header' && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            run('Header and footer', async () => {
              await addHeaderFooter({ header: header.trim() || undefined, footer: footer.trim() || undefined })
              return 'Header and footer added'
            })
          }}
        >
          <label className="block space-y-1.5">
            <span className={fieldLabel}>Header</span>
            <input value={header} onChange={(e) => setHeader(e.target.value)} className={fieldClass} placeholder="Project Atlas, internal" />
          </label>
          <label className="block space-y-1.5">
            <span className={fieldLabel}>Footer</span>
            <input value={footer} onChange={(e) => setFooter(e.target.value)} className={fieldClass} placeholder="Lehro Solutions · 2026" />
          </label>
          <button type="submit" className={`${primaryTile} w-full`} disabled={busy !== null || (!header.trim() && !footer.trim())}>
            {busy === 'Header and footer' ? 'Adding…' : 'Add to every page'}
          </button>
        </form>
      )}
    </div>
  )
}

/**
 * Fill the PDF's own form fields (AcroForm)
 */
export function FormsSection() {
  const { getFormFields, fillFormFields, pdfRevision } = usePdfEditorStore(
    useShallow((s) => ({
      getFormFields: s.getFormFields,
      fillFormFields: s.fillFormFields,
      pdfRevision: s.pdfRevision,
    }))
  )
  const { busy, run } = useRun()
  const [fields, setFields] = useState<FormField[] | null>(null)
  const [values, setValues] = useState<Record<string, FormValue>>({})
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setFields(null)
    setLoadError(null)
    getFormFields()
      .then((found) => {
        if (cancelled) return
        setFields(found)
        setValues(Object.fromEntries(found.map((f) => [f.name, f.value])))
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not read form fields.')
      })
    return () => { cancelled = true }
  }, [getFormFields, pdfRevision])

  if (loadError) return <p className="text-sm text-[var(--pdfoid-danger)]">{loadError}</p>
  if (!fields) return <p className="text-sm text-[var(--pdfoid-muted)]">Looking for form fields…</p>
  const editable = fields.filter((f) => f.type !== 'unsupported')
  if (!editable.length) {
    return <p className="text-sm text-[var(--pdfoid-muted)]">This PDF has no fillable form fields.</p>
  }

  const setValue = (name: string, value: FormValue) => setValues((v) => ({ ...v, [name]: value }))
  const changed = () => Object.fromEntries(editable.filter((f) => !f.readOnly).map((f) => [f.name, values[f.name]]))

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        run('Fill form', async () => {
          await fillFormFields(changed())
          return 'Form fields updated'
        })
      }}
    >
      {editable.map((field) => {
        const id = `form-field-${field.name}`
        const value = values[field.name]
        if (field.type === 'checkbox') {
          return (
            <label key={field.name} className="flex items-center gap-2 text-sm text-[var(--pdfoid-text)] cursor-pointer">
              <input id={id} type="checkbox" checked={Boolean(value)} disabled={field.readOnly} onChange={(e) => setValue(field.name, e.target.checked)} className={checkboxClass} />
              {field.name}
            </label>
          )
        }
        return (
          <div key={field.name} className="space-y-1.5">
            <label htmlFor={id} className={fieldLabel}>{field.name}</label>
            {field.type === 'text' && (field.multiline ? (
              <textarea id={id} value={String(value ?? '')} disabled={field.readOnly} onChange={(e) => setValue(field.name, e.target.value)} rows={3} className={`${fieldClass} h-auto py-2`} />
            ) : (
              <input id={id} value={String(value ?? '')} disabled={field.readOnly} onChange={(e) => setValue(field.name, e.target.value)} className={fieldClass} />
            ))}
            {(field.type === 'dropdown' || field.type === 'radio') && (
              <select
                id={id}
                value={Array.isArray(value) ? value[0] ?? '' : String(value ?? '')}
                disabled={field.readOnly}
                onChange={(e) => setValue(field.name, field.type === 'dropdown' ? [e.target.value] : e.target.value)}
                className={selectClass}
              >
                <option value="">Choose…</option>
                {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            )}
            {field.type === 'optionlist' && (
              <select
                id={id}
                multiple
                value={Array.isArray(value) ? value : []}
                disabled={field.readOnly}
                onChange={(e) => setValue(field.name, Array.from(e.target.selectedOptions).map((o) => o.value))}
                className={`${fieldClass} h-auto py-1`}
              >
                {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            )}
          </div>
        )
      })}
      <div className="flex gap-2 pt-1">
        <button type="submit" className={`${primaryTile} flex-1`} disabled={busy !== null}>
          {busy === 'Fill form' ? 'Saving…' : 'Fill form'}
        </button>
        <button
          type="button"
          className={`${actionTile} flex-1 justify-center`}
          disabled={busy !== null}
          title="Fill, then lock the fields so they can no longer be edited"
          onClick={() => run('Fill form', async () => {
            await fillFormFields(changed(), { flatten: true })
            return 'Form filled and locked'
          })}
        >
          Fill and lock
        </button>
      </div>
    </form>
  )
}

const OCR_NOTICE_KEY = 'pdfoid.ocrNoticeSeen'

/**
 * Text recognition for scanned pages, so they become searchable
 */
export function OcrSection({ currentPage }: { currentPage: number }) {
  const ocrPage = usePdfEditorStore((s) => s.ocrPage)
  const { success, error } = useUIStore(useShallow((s) => ({ success: s.success, error: s.error })))
  const [progress, setProgress] = useState<OcrProgress | null>(null)
  const [noticeOpen, setNoticeOpen] = useState(false)

  const start = async () => {
    setProgress({ status: 'Starting', progress: 0 })
    try {
      const words = await ocrPage(currentPage - 1, setProgress)
      success(
        words ? `Found ${words} word${words === 1 ? '' : 's'} on page ${currentPage}` : `No text found on page ${currentPage}`,
        words ? 'You can now search and select that text.' : undefined
      )
    } catch (err) {
      console.error('OCR failed', err)
      error('Text recognition failed', err instanceof Error ? err.message : 'Please try again.')
    } finally {
      setProgress(null)
    }
  }

  const onRun = () => {
    let seen = false
    try { seen = window.localStorage.getItem(OCR_NOTICE_KEY) === '1' } catch { /* storage blocked */ }
    if (seen) start()
    else setNoticeOpen(true)
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--pdfoid-muted)]">For scanned pages. Adds an invisible text layer so you can search and copy the text.</p>
      {progress ? (
        <div className="space-y-2" role="status" aria-live="polite">
          <div className="flex justify-between text-xs text-[var(--pdfoid-muted)]">
            <span className="first-letter:uppercase">{progress.status}</span>
            <span className="tabular-nums">{Math.round(progress.progress * 100)}%</span>
          </div>
          <div className="h-1 rounded-full bg-[var(--pdfoid-surface-2)] overflow-hidden">
            <div className="h-full rounded-full bg-[var(--pdfoid-accent)] transition-[width] duration-300" style={{ width: `${Math.max(4, progress.progress * 100)}%` }} />
          </div>
        </div>
      ) : (
        <button type="button" className={`${actionTile} w-full`} onClick={onRun}>
          <TextAa size={16} className="text-[var(--pdfoid-muted)]" aria-hidden />
          Recognize text on page {currentPage}
        </button>
      )}
      <Dialog
        open={noticeOpen}
        onClose={() => setNoticeOpen(false)}
        icon={<ScanSmiley size={20} />}
        title="Download the text recognition model?"
        description={`${OCR_LANGUAGE_NOTICE} It is cached, so later runs start immediately. Your PDF still stays on this device.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setNoticeOpen(false)}>Not now</Button>
            <Button
              variant="primary"
              onClick={() => {
                try { window.localStorage.setItem(OCR_NOTICE_KEY, '1') } catch { /* storage blocked */ }
                setNoticeOpen(false)
                start()
              }}
            >
              Download and recognize
            </Button>
          </>
        }
      />
    </div>
  )
}

/**
 * Download a copy that needs a password to open
 */
export function ProtectSection() {
  const { download, busy, dialog } = useDownloadPdf()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const mismatch = confirm.length > 0 && confirm !== password

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!password || mismatch) return
        download({ password })
      }}
    >
      <label className="block space-y-1.5">
        <span className={fieldLabel}>Password</span>
        <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={fieldClass} />
      </label>
      <label className="block space-y-1.5">
        <span className={fieldLabel}>Confirm password</span>
        <input
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={fieldClass}
          aria-invalid={mismatch || undefined}
          aria-describedby={mismatch ? 'protect-mismatch' : undefined}
        />
      </label>
      {mismatch && <p id="protect-mismatch" className="text-sm text-[var(--pdfoid-danger)]">The passwords do not match.</p>}
      <button type="submit" className={`${actionTile} w-full`} disabled={busy || !password || confirm !== password}>
        <Lock size={16} className="text-[var(--pdfoid-muted)]" aria-hidden />
        {busy ? 'Preparing…' : 'Download protected PDF'}
      </button>
      {dialog}
    </form>
  )
}
