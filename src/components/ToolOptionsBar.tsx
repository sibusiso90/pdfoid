import React, { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { EyeSlash, Plus, UploadSimple, X } from '@phosphor-icons/react'
import { useAnnotationStore } from '../store/annotationStore'
import { useUIStore } from '../store/uiStore'
import { SignaturePad } from './SignaturePad'
import { Annotation, STAMP_PRESETS } from '../types/annotations'
import { TOOL_CATALOG } from '../constants/tools'
import { PRESET_COLORS, ANNOTATION_DEFAULTS } from '../constants'
import { Button, Divider, Slider } from './ui'

const toolInfo = Object.fromEntries(TOOL_CATALOG.map((tool) => [tool.id, tool]))

/**
 * Contextual options for the active tool, shown as one slim row above the document.
 */
export function ToolOptionsBar() {
  const {
    selectedTool,
    selectedColor,
    selectedThickness,
    selectedOpacity,
    selectedFontSize,
    selectedStampText,
    setStampText,
    signatureDataUrl,
    selectedAnnotationId,
    setColor,
    setThickness,
    setOpacity,
    setFontSize,
    setSignatureTemplate,
    updateAnnotation,
    updateAnnotationLive,
    getAnnotationById,
  } = useAnnotationStore(
    useShallow((state) => ({
      selectedTool: state.selectedTool,
      selectedColor: state.selectedColor,
      selectedThickness: state.selectedThickness,
      selectedOpacity: state.selectedOpacity,
      selectedFontSize: state.selectedFontSize,
      selectedStampText: state.selectedStampText,
      setStampText: state.setStampText,
      signatureDataUrl: (state as any).signatureDataUrl as string | undefined,
      selectedAnnotationId: state.selectedAnnotationId,
      setColor: state.setColor,
      setThickness: state.setThickness,
      setOpacity: state.setOpacity,
      setFontSize: state.setFontSize,
      setSignatureTemplate: (state as any).setSignatureTemplate,
      updateAnnotation: state.updateAnnotation,
      updateAnnotationLive: state.updateAnnotationLive,
      getAnnotationById: state.getAnnotationById,
    }))
  )

  const { success, warning } = useUIStore(
    useShallow((state) => ({
      success: state.success,
      warning: state.warning,
    }))
  )

  const fontSizeDraftRef = React.useRef<Annotation | null>(null)
  const [signatureModalOpen, setSignatureModalOpen] = useState(false)

  const isSignatureTool = selectedTool === 'signature'
  const isRedactionTool = selectedTool === 'redaction'
  const isStampTool = selectedTool === 'stamp'
  const tool = toolInfo[selectedTool]
  const activeAnnotation = selectedAnnotationId ? getAnnotationById(selectedAnnotationId) : undefined
  const activeFontSize = activeAnnotation?.type === 'text-box' && typeof activeAnnotation.fontSize === 'number'
    ? activeAnnotation.fontSize
    : selectedFontSize
  const showFontControls = selectedTool === 'text-box' || activeAnnotation?.type === 'text-box'

  const handleFontSizeChange = (value: number) => {
    setFontSize(value)
    if (activeAnnotation?.type === 'text-box') {
      if (!fontSizeDraftRef.current) {
        fontSizeDraftRef.current = JSON.parse(JSON.stringify(activeAnnotation)) as Annotation
      }
      updateAnnotationLive(activeAnnotation.id, { fontSize: value })
    }
  }

  const commitFontSizeChange = (value: number) => {
    if (activeAnnotation?.type === 'text-box') {
      const baseline = fontSizeDraftRef.current ?? activeAnnotation
      updateAnnotation(activeAnnotation.id, { fontSize: value }, { previous: baseline })
    }
    fontSizeDraftRef.current = null
  }

  const handleSignatureUpload = async (file: File) => {
    const mime = file.type || 'image/png'
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
    if (dataUrl) {
      setSignatureTemplate(dataUrl, mime)
      success('Signature saved')
    }
  }

  const clearSignature = () => {
    setSignatureTemplate(undefined, undefined)
    warning('Signature cleared')
  }

  return (
    <div
      className="flex items-center gap-4 h-12 px-4 border-b border-[var(--pdfoid-border)] bg-[var(--pdfoid-surface)] overflow-x-auto scrollbar-none"
      role="group"
      aria-label={`${tool?.label ?? 'Tool'} options`}
    >
      <div className="hidden 2xl:flex flex-col justify-center min-w-0 shrink-0 max-w-56">
        <h2 className="text-sm font-semibold text-[var(--pdfoid-text)] leading-5">{tool?.label}</h2>
        <p className="text-xs text-[var(--pdfoid-muted)] truncate">{tool?.description}</p>
      </div>

      <Divider vertical className="hidden 2xl:block" />

      {isRedactionTool ? (
        <p className="flex items-center gap-2 text-sm text-[var(--pdfoid-muted)] whitespace-nowrap">
          <EyeSlash size={16} className="text-[var(--pdfoid-text)]" aria-hidden />
          Drag over anything you want removed. It is deleted from the PDF when you download.
        </p>
      ) : isSignatureTool ? (
        <div className="flex items-center gap-2 shrink-0">
          {signatureDataUrl ? (
            <div className="flex items-center gap-1 h-9 pl-2 pr-1 rounded-lg border border-[var(--pdfoid-border)] bg-white">
              <img src={signatureDataUrl} alt="Your saved signature" className="h-7 w-24 object-contain" />
              <button
                type="button"
                onClick={clearSignature}
                className="p-1 rounded-md text-[var(--pdfoid-muted)] hover:text-[var(--pdfoid-danger)] hover:bg-[var(--pdfoid-danger-soft)] transition-colors duration-200"
                aria-label="Clear signature"
              >
                <X size={14} aria-hidden />
              </button>
            </div>
          ) : (
            <span className="text-sm text-[var(--pdfoid-muted)] whitespace-nowrap">No signature yet</span>
          )}
          <Button type="button" variant="secondary" size="sm" onClick={() => setSignatureModalOpen(true)}>
            Create New
          </Button>
          <label className="inline-flex items-center gap-2 h-8 px-3 rounded-lg text-sm font-semibold text-[var(--pdfoid-muted)] hover:text-[var(--pdfoid-text)] hover:bg-[var(--pdfoid-hover)] cursor-pointer transition-colors duration-200 focus-within:ring-2 focus-within:ring-[var(--pdfoid-ring)]">
            <UploadSimple size={16} aria-hidden />
            Upload image
            <input
              type="file"
              accept="image/png,image/jpeg"
              className="sr-only"
              aria-label="Upload signature image"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  handleSignatureUpload(file).catch(() => warning('Could not read that image. Try a PNG or JPEG.'))
                }
                e.currentTarget.value = ''
              }}
            />
          </label>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 shrink-0" role="radiogroup" aria-label="Annotation color">
          {PRESET_COLORS.map((color) => {
            const isActive = selectedColor.toLowerCase() === color.toLowerCase()
            return (
              <button
                key={color}
                type="button"
                onClick={() => setColor(color)}
                className={`
                  relative w-6 h-6 rounded-full
                  transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:scale-110 active:scale-95
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pdfoid-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--pdfoid-surface)]
                  shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]
                  ${isActive ? 'ring-2 ring-offset-2 ring-offset-[var(--pdfoid-surface)] ring-[var(--pdfoid-text)]' : ''}
                `}
                style={{ backgroundColor: color }}
                title={color}
                aria-label={`Select color ${color}`}
                role="radio"
                aria-checked={isActive}
              />
            )
          })}
          <label
            className="w-6 h-6 rounded-full cursor-pointer flex items-center justify-center border border-dashed border-[var(--pdfoid-border-strong)] text-[var(--pdfoid-muted)] hover:text-[var(--pdfoid-text)] hover:border-[var(--pdfoid-muted)] transition-colors duration-200 focus-within:ring-2 focus-within:ring-[var(--pdfoid-ring)]"
            title="Custom color"
          >
            <input
              type="color"
              value={selectedColor}
              onChange={(e) => setColor(e.target.value)}
              className="sr-only"
              aria-label="Choose custom color"
            />
            <Plus size={12} weight="bold" aria-hidden />
          </label>
        </div>
      )}

      {isStampTool && (
        <>
          <Divider vertical />
          <div className="flex items-center gap-1 shrink-0" role="radiogroup" aria-label="Stamp text">
            {STAMP_PRESETS.map((preset) => {
              const active = selectedStampText === preset
              return (
                <button
                  key={preset}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setStampText(preset)}
                  className={`h-7 px-2 rounded-md text-xs font-semibold tracking-wide transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pdfoid-ring)] ${active
                    ? 'bg-[var(--pdfoid-text)] text-[var(--pdfoid-surface)]'
                    : 'text-[var(--pdfoid-muted)] hover:text-[var(--pdfoid-text)] hover:bg-[var(--pdfoid-hover)]'}`}
                >
                  {preset}
                </button>
              )
            })}
          </div>
        </>
      )}

      {!isSignatureTool && !isRedactionTool && !isStampTool && (
        <>
          <Divider vertical />
          <div className="shrink-0">
            <Slider
              inline
              id="stroke-slider"
              label="Stroke"
              value={selectedThickness}
              min={ANNOTATION_DEFAULTS.MIN_STROKE_WIDTH}
              max={ANNOTATION_DEFAULTS.MAX_STROKE_WIDTH}
              formatValue={(v) => `${v}px`}
              onChange={(e) => setThickness(Number(e.target.value))}
            />
          </div>
        </>
      )}

      {showFontControls && (
        <div className="shrink-0">
          <Slider
            inline
            id="font-size-slider"
            label="Text size"
            value={Math.max(ANNOTATION_DEFAULTS.MIN_FONT_SIZE, Math.min(ANNOTATION_DEFAULTS.MAX_FONT_SIZE, Math.round(activeFontSize)))}
            min={ANNOTATION_DEFAULTS.MIN_FONT_SIZE}
            max={ANNOTATION_DEFAULTS.MAX_FONT_SIZE}
            formatValue={(v) => `${v}px`}
            onChange={(e) => handleFontSizeChange(Number(e.target.value))}
            onPointerDown={() => {
              fontSizeDraftRef.current = activeAnnotation?.type === 'text-box'
                ? JSON.parse(JSON.stringify(activeAnnotation)) as Annotation
                : null
            }}
            onPointerUp={(e) => commitFontSizeChange(Number((e.target as HTMLInputElement).value))}
            onPointerCancel={() => commitFontSizeChange(activeFontSize)}
            onBlur={(e) => commitFontSizeChange(Number((e.target as HTMLInputElement).value))}
          />
        </div>
      )}

      {!isRedactionTool && (
      <div className="shrink-0">
        <Slider
          inline
          id="opacity-slider"
          label="Opacity"
          value={selectedOpacity}
          min={ANNOTATION_DEFAULTS.MIN_OPACITY}
          max={ANNOTATION_DEFAULTS.MAX_OPACITY}
          step={0.1}
          formatValue={(v) => `${Math.round(v * 100)}%`}
          onChange={(e) => setOpacity(Number(e.target.value))}
        />
      </div>
      )}

      {signatureModalOpen && (
        <SignaturePad
          onSave={(dataUrl) => {
            setSignatureTemplate(dataUrl, 'image/png')
            success('Signature saved')
            setSignatureModalOpen(false)
          }}
          onCancel={() => setSignatureModalOpen(false)}
        />
      )}
    </div>
  )
}
