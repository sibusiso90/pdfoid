import React, { useCallback, useState } from 'react'
import { EyeSlash } from '@phosphor-icons/react'
import { PendingRedactionsError, usePdfEditorStore } from '../store/pdfEditorStore'
import { useAnnotationStore } from '../store/annotationStore'
import { useUIStore } from '../store/uiStore'
import { Dialog } from './Dialog'
import { Button } from './ui'

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const editedName = () => `${usePdfEditorStore.getState().fileName || 'document'}-edited.pdf`

/**
 * Downloads the edited PDF. When redaction marks are still pending, explains why and
 * offers to apply them (flatten) before downloading, rather than failing silently.
 */
export function useDownloadPdf() {
  const exportPdf = usePdfEditorStore((s) => s.exportPdf)
  const flattenAnnotations = usePdfEditorStore((s) => s.flattenAnnotations)
  const error = useUIStore((s) => s.error)
  const success = useUIStore((s) => s.success)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<{ count: number; password?: string } | null>(null)

  const download = useCallback(async (opts: { password?: string } = {}) => {
    setBusy(true)
    try {
      const blob = await exportPdf(opts)
      downloadBlob(blob, editedName())
      if (opts.password) success('Downloaded a password-protected PDF')
    } catch (err) {
      if (err instanceof PendingRedactionsError) {
        setPending({ count: err.count, password: opts.password })
      } else {
        console.error('Export PDF failed', err)
        error('Could not export the PDF', err instanceof Error ? err.message : 'Please try again.')
      }
    } finally {
      setBusy(false)
    }
  }, [exportPdf, error, success])

  const applyAndDownload = useCallback(async () => {
    if (!pending) return
    const { password } = pending
    setPending(null)
    setBusy(true)
    try {
      const { annotations, clearAllAnnotations } = useAnnotationStore.getState()
      await flattenAnnotations(annotations)
      clearAllAnnotations()
      downloadBlob(await exportPdf({ password }), editedName())
      success('Redactions applied and PDF downloaded')
    } catch (err) {
      console.error('Apply redactions failed', err)
      error('Could not apply redactions', err instanceof Error ? err.message : 'Please try again.')
    } finally {
      setBusy(false)
    }
  }, [pending, flattenAnnotations, exportPdf, error, success])

  const dialog = (
    <Dialog
      open={pending !== null}
      onClose={() => setPending(null)}
      icon={<EyeSlash size={20} />}
      title={`Apply ${pending?.count ?? 0} redaction${pending?.count === 1 ? '' : 's'} first`}
      description="Redacted areas are only removed from the file once they are applied. Applying also flattens your other annotations into the pages, so they can no longer be edited."
      footer={
        <>
          <Button variant="secondary" onClick={() => setPending(null)}>Keep editing</Button>
          <Button variant="primary" onClick={applyAndDownload}>Apply and download</Button>
        </>
      }
    />
  )

  return { download, busy, dialog }
}
