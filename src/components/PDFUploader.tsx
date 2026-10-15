import React, { useState, useCallback, useRef, useEffect } from 'react'
import { FILE_CONSTRAINTS } from '../constants'
import { FilePdf, FolderOpen, WarningCircle } from '@phosphor-icons/react'
import { Spinner } from './ui'
import { useUIStore } from '../store/uiStore'

export type PDFUploaderProps = {
  onLoadPDF: (data: ArrayBuffer, fileName: string) => void
  /** `hero` is the full drop zone for the empty state; `button` is a compact "Open" control */
  variant?: 'hero' | 'button'
}

type UploadState = 'idle' | 'loading' | 'success' | 'error'

export default function PDFUploader({
  onLoadPDF,
  variant = 'hero',
}: PDFUploaderProps) {
  const [state, setState] = useState<UploadState>('idle')
  const [progress, setProgress] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLLabelElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const validateFile = useCallback((file: File): string | null => {
    if (!(FILE_CONSTRAINTS.ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
      return 'That file is not a PDF. Choose a file ending in .pdf.'
    }
    const maxSizeBytes = FILE_CONSTRAINTS.MAX_FILE_SIZE_MB * 1024 * 1024
    if (file.size > maxSizeBytes) {
      return `That file is larger than ${FILE_CONSTRAINTS.MAX_FILE_SIZE_MB}MB. Choose a smaller PDF.`
    }
    return null
  }, [])

  const processFile = useCallback(async (file: File) => {
    const validationError = validateFile(file)
    if (validationError) {
      setState('error')
      setErrorMessage(validationError)
      return
    }

    setState('loading')
    setProgress(0)
    setErrorMessage(null)

    try {
      const originalBuffer = await file.arrayBuffer()
      // Clone buffer to avoid accidental detachment and to keep a stable copy for the editor.
      const bufferForViewer = originalBuffer.slice(0)

      onLoadPDF(bufferForViewer, file.name)
      setProgress(100)
      setState('success')
      
      // Auto-dismiss success state
      setTimeout(() => setState('idle'), 1000)
    } catch (err) {
      console.error('Failed to load PDF', err)
      setState('error')
      const message = err instanceof Error ? err.message : 'Unknown error occurred'
      setErrorMessage(`We could not open this PDF: ${message}`)
    } finally {
      setTimeout(() => setProgress(0), 500)
    }
  }, [validateFile, onLoadPDF])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      processFile(file)
    }
    // Reset input to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [processFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    
    const file = e.dataTransfer.files?.[0]
    if (file) {
      processFile(file)
    }
  }, [processFile])

  const isLoading = state === 'loading'
  const showErrorToast = useUIStore((s) => s.error)

  // The compact button has no room for inline errors, so surface them as a toast
  useEffect(() => {
    if (variant === 'button' && state === 'error' && errorMessage) {
      showErrorToast(errorMessage)
    }
  }, [variant, state, errorMessage, showErrorToast])

  const fileInput = (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleFileChange}
        disabled={isLoading}
        className="sr-only"
        aria-label="Upload PDF file"
        aria-describedby="file-upload-description"
      />
      <span id="file-upload-description" className="sr-only">
        Upload a PDF file to view, annotate, and edit. Maximum file size is {FILE_CONSTRAINTS.MAX_FILE_SIZE_MB}MB.
      </span>
    </>
  )

  if (variant === 'button') {
    return (
      <label
        className="inline-flex items-center gap-2 h-8 px-2.5 rounded-lg text-sm font-semibold text-[var(--pdfoid-muted)] hover:text-[var(--pdfoid-text)] hover:bg-[var(--pdfoid-hover)] cursor-pointer transition-colors duration-200 focus-within:ring-2 focus-within:ring-[var(--pdfoid-ring)]"
        title={errorMessage ?? 'Open another PDF'}
      >
        {isLoading ? <Spinner size="sm" /> : <FolderOpen size={18} aria-hidden />}
        <span className="hidden xl:inline">Open</span>
        {fileInput}
      </label>
    )
  }

  return (
    <div className="w-full space-y-3">
      <label
        ref={dropZoneRef}
        className={`
          group relative flex flex-col items-center justify-center w-full px-6 py-16
          rounded-2xl border border-dashed cursor-pointer
          transition-[background-color,border-color,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
          focus-within:ring-2 focus-within:ring-[var(--pdfoid-ring)] focus-within:ring-offset-2 focus-within:ring-offset-[var(--pdfoid-bg)]
          ${isDragOver
            ? 'border-[var(--pdfoid-accent)] bg-[var(--pdfoid-accent-soft)] scale-[1.01]'
            : 'border-[var(--pdfoid-border-strong)] bg-[var(--pdfoid-surface)] hover:border-[var(--pdfoid-muted)]'
          }
          ${isLoading ? 'cursor-wait' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div
          className={`
            w-14 h-14 rounded-2xl flex items-center justify-center mb-5
            bg-[var(--pdfoid-surface-2)] text-[var(--pdfoid-accent)]
            transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
            ${isDragOver ? '-translate-y-1' : 'group-hover:-translate-y-0.5'}
          `}
          aria-hidden="true"
        >
          {isLoading ? <Spinner size="lg" /> : <FilePdf size={28} />}
        </div>
        <p className="text-base font-semibold text-[var(--pdfoid-text)]">
          {isLoading ? 'Processing PDF...' : isDragOver ? 'Release to open' : 'Drop a PDF here'}
        </p>
        {!isLoading && (
          <p className="mt-1 text-sm text-[var(--pdfoid-muted)]">
            or <span className="font-semibold text-[var(--pdfoid-accent)] group-hover:underline underline-offset-4">browse your files</span>
          </p>
        )}
        <p className="mt-4 text-xs text-[var(--pdfoid-subtle)]">
          PDF up to {FILE_CONSTRAINTS.MAX_FILE_SIZE_MB}MB
        </p>
        {fileInput}
      </label>

      {isLoading && (
        <div className="h-1 w-full rounded-full bg-[var(--pdfoid-surface-2)] overflow-hidden" role="status" aria-live="polite">
          <div
            className="h-full rounded-full bg-[var(--pdfoid-accent)] transition-[width] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
            style={{ width: `${Math.max(progress, 8)}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="PDF processing progress"
          />
        </div>
      )}

      {state === 'error' && errorMessage && (
        <div
          className="flex items-start gap-2 rounded-xl px-3 py-2 text-sm bg-[var(--pdfoid-danger-soft)] text-[var(--pdfoid-danger)]"
          role="alert"
          aria-live="assertive"
        >
          <WarningCircle size={18} className="shrink-0 mt-px" aria-hidden />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  )
}
