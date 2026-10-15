import React, { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { FileText } from '@phosphor-icons/react'
import { useCVStore } from '../store/cvStore'
import { usePdfEditorStore } from '../store/pdfEditorStore'
import { useUIStore } from '../store/uiStore'
import { downloadCV } from '../utils/cvPdfGenerator'
import { extractCVDataFromPdf, MIN_CV_PARSE_CONFIDENCE, type CVExtractionResult } from '../utils/cvExtractor'
import type { CVTemplate } from '../types/cv'
import { Button, Spinner } from './ui'

const cvTemplateOptions: Array<{ id: CVTemplate; label: string; hint: string }> = [
  { id: 'modern', label: 'Modern', hint: 'Left panel layout with strong accents' },
  { id: 'classic', label: 'Classic', hint: 'Centered serif header with editorial spacing' },
  { id: 'minimal', label: 'Minimal', hint: 'Monochrome single column, built for reading' },
  { id: 'creative', label: 'Creative', hint: 'Right panel design with boxed sections' },
]

/**
 * Rebuilds a detected CV into one of the bundled templates and downloads it.
 */
export function CvExportPanel() {
  const { settings, loadCVData, updateSettings } = useCVStore(
    useShallow((state) => ({
      settings: state.settings,
      loadCVData: state.loadCVData,
      updateSettings: state.updateSettings,
    }))
  )
  const { pdfBytes, isCvDocument, cvDetectionLoading, cvDetection, fileName } = usePdfEditorStore(
    useShallow((state) => ({
      pdfBytes: state.pdfData,
      isCvDocument: state.isCvDocument,
      cvDetectionLoading: state.cvDetectionLoading,
      cvDetection: state.cvDetection,
      fileName: state.fileName,
    }))
  )
  const { success, error } = useUIStore(
    useShallow((state) => ({
      success: state.success,
      error: state.error,
    }))
  )
  const [isExporting, setIsExporting] = useState(false)
  const [isParsingCv, setIsParsingCv] = useState(false)
  const [lastParseReport, setLastParseReport] = useState<Pick<
    CVExtractionResult,
    'confidence' | 'sectionsDetected' | 'missingSections' | 'warnings' | 'pagesScanned'
  > | null>(null)
  const [parseErrorMessage, setParseErrorMessage] = useState<string | null>(null)

  const handleDownloadCV = async () => {
    if (!pdfBytes) return
    try {
      setIsParsingCv(true)
      setParseErrorMessage(null)
      const parsed = await extractCVDataFromPdf(pdfBytes, fileName || 'uploaded-cv.pdf')
      setLastParseReport({
        confidence: parsed.confidence,
        sectionsDetected: parsed.sectionsDetected,
        missingSections: parsed.missingSections,
        warnings: parsed.warnings,
        pagesScanned: parsed.pagesScanned,
      })

      if (parsed.confidence < MIN_CV_PARSE_CONFIDENCE) {
        const missing = parsed.missingSections.slice(0, 3).join(', ')
        const failureMessage = missing
          ? `Unable to parse this CV confidently (score ${parsed.confidence.toFixed(2)}). Missing: ${missing}.`
          : `Unable to parse this CV confidently (score ${parsed.confidence.toFixed(2)}).`
        setParseErrorMessage(failureMessage)
        error(failureMessage)
        return
      }

      const sectionLabel = parsed.sectionsDetected.length
        ? parsed.sectionsDetected.join(', ')
        : 'none'
      const warningLine = parsed.warnings.length
        ? `\nWarnings: ${parsed.warnings.slice(0, 2).join(' | ')}`
        : ''
	      const confirmed = window.confirm(
	        `Import parsed CV data from "${fileName || 'uploaded file'}"?\n\nDetected sections: ${sectionLabel}\nConfidence: ${parsed.confidence.toFixed(2)}${warningLine}\nTemplate: ${settings.template}\n\nThis will replace current CV data.`
	      )
	      if (!confirmed) return

      loadCVData(parsed.cvData)
      setIsExporting(true)
      const fileBase = parsed.cvData.personalInfo.fullName || 'cv'
      await downloadCV(parsed.cvData, settings, `${fileBase}-CV.pdf`)
      success('CV PDF downloaded from imported CV')
    } catch (err) {
      console.error('Failed to generate CV PDF', err)
      setParseErrorMessage('Failed to parse CV data from the uploaded PDF.')
      error('Failed to parse and generate CV PDF')
    } finally {
      setIsParsingCv(false)
      setIsExporting(false)
    }
  }

  const detectedSignals = (cvDetection?.keywords || []).filter((item) => item !== 'filename').slice(0, 3)

  if (!pdfBytes) return null

  if (cvDetectionLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--pdfoid-muted)]" role="status">
        <Spinner size="sm" /> Checking whether this is a CV…
      </div>
    )
  }

  if (!isCvDocument) {
    return (
      <p className="text-sm text-[var(--pdfoid-muted)]">
        This document does not look like a CV. Open a CV to rebuild it in a new template.
      </p>
    )
  }

  const busy = isExporting || isParsingCv

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-8 h-8 rounded-lg bg-[var(--pdfoid-accent-soft)] text-[var(--pdfoid-accent)] flex items-center justify-center" aria-hidden="true">
          <FileText size={16} />
        </div>
        <p className="text-sm text-[var(--pdfoid-muted)]">
          <span className="font-medium text-[var(--pdfoid-text)]">CV detected.</span>{' '}
          {detectedSignals.length > 0 ? `Found ${detectedSignals.join(', ')}.` : 'Pick a template to rebuild it.'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="CV template">
        {cvTemplateOptions.map((option) => {
          const active = settings.template === option.id
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              aria-label={`Use ${option.label} template`}
              onClick={() => updateSettings({ template: option.id })}
              className={`h-9 rounded-lg text-sm font-medium transition-[background-color,color,box-shadow] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pdfoid-ring)] ${active
                ? 'bg-[var(--pdfoid-surface)] text-[var(--pdfoid-accent)] shadow-[0_0_0_1.5px_var(--pdfoid-accent)]'
                : 'bg-[var(--pdfoid-surface-2)] text-[var(--pdfoid-muted)] hover:text-[var(--pdfoid-text)]'
                }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
      <p className="text-xs text-[var(--pdfoid-muted)]">
        {cvTemplateOptions.find((option) => option.id === settings.template)?.hint}
      </p>

      <Button type="button" variant="secondary" className="w-full" onClick={handleDownloadCV} disabled={busy} isLoading={busy}>
        {isParsingCv ? 'Parsing CV...' : isExporting ? 'Generating...' : 'Parse & Download CV PDF'}
      </Button>

      {lastParseReport && (
        <dl className="rounded-lg bg-[var(--pdfoid-surface-2)] p-3 text-xs space-y-1">
          <div className="flex justify-between gap-2">
            <dt className="text-[var(--pdfoid-muted)]">Confidence</dt>
            <dd className="font-medium text-[var(--pdfoid-text)] tabular-nums">
              {lastParseReport.confidence.toFixed(2)} across {lastParseReport.pagesScanned} page{lastParseReport.pagesScanned === 1 ? '' : 's'}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-[var(--pdfoid-muted)]">Detected</dt>
            <dd className="text-right text-[var(--pdfoid-text)]">{lastParseReport.sectionsDetected.length ? lastParseReport.sectionsDetected.join(', ') : 'none'}</dd>
          </div>
          {lastParseReport.missingSections.length > 0 && (
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--pdfoid-muted)]">Missing</dt>
              <dd className="text-right text-[var(--pdfoid-text)]">{lastParseReport.missingSections.join(', ')}</dd>
            </div>
          )}
          {lastParseReport.warnings.length > 0 && (
            <p className="pt-1 text-[var(--pdfoid-muted)]">{lastParseReport.warnings.slice(0, 3).join(' · ')}</p>
          )}
        </dl>
      )}
      {parseErrorMessage && (
        <p className="text-sm text-[var(--pdfoid-danger)]" role="alert">{parseErrorMessage}</p>
      )}
    </div>
  )
}
