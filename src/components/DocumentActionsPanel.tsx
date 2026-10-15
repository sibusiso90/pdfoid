import React, { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  ArrowLineDown,
  ArrowLineUp,
  ArrowsClockwise,
  ArrowsCounterClockwise,
  CaretLeft,
  Crop,
  ImageSquare,
  MagnifyingGlass,
  Plus,
  Stack,
  Trash,
} from '@phosphor-icons/react'
import { usePdfEditorStore, TextMatch } from '../store/pdfEditorStore'
import { useAnnotationStore } from '../store/annotationStore'
import { useUIStore } from '../store/uiStore'
import { CropModal } from './CropModal'
import { InspectorSection, actionTile, checkboxClass, fieldClass } from './inspector'

export { InspectorSection }

interface DocumentActionsPanelProps {
  currentPage: number
  onForcePageChange: (page: number) => void
}

const clampPage = (page: number, total: number) => {
  if (total <= 0) return 1
  return Math.max(1, Math.min(total, page))
}

export const DocumentActionsPanel: React.FC<DocumentActionsPanelProps> = ({ currentPage, onForcePageChange }) => {
  const {
    numPages,
    loading,
    addBlankPage,
    deletePage,
    reorderPages,
    rotatePage,
    cropPage,
    insertImage,
    replaceText,
    findTextMatches,
    replaceMatch,
    flattenAnnotations,
        setCurrentMatchHighlight,
    defaultFlashTtlMs,
    autoClearHighlightMs,
    setDefaultFlashTtlMs,
    setAutoClearHighlightMs,
  } = usePdfEditorStore(
    useShallow((state) => ({
      numPages: state.numPages,
      loading: state.loading,
      addBlankPage: state.addBlankPage,
      deletePage: state.deletePage,
      reorderPages: state.reorderPages,
      rotatePage: state.rotatePage,
      cropPage: state.cropPage,
      insertImage: state.insertImage,
      replaceText: state.replaceText,
      findTextMatches: state.findTextMatches,
      replaceMatch: state.replaceMatch,
      flattenAnnotations: state.flattenAnnotations,
      setCurrentMatchHighlight: state.setCurrentMatchHighlight,
      defaultFlashTtlMs: state.defaultFlashTtlMs,
      autoClearHighlightMs: state.autoClearHighlightMs,
      setDefaultFlashTtlMs: state.setDefaultFlashTtlMs,
      setAutoClearHighlightMs: state.setAutoClearHighlightMs,
    }))
  )

  const { annotations, clearAllAnnotations } = useAnnotationStore(
    useShallow((state) => ({
      annotations: state.annotations,
      clearAllAnnotations: state.clearAllAnnotations,
    }))
  )

  const [findText, setFindText] = useState('')
  const [replaceValue, setReplaceValue] = useState('')
  const [replaceStatus, setReplaceStatus] = useState<string | null>(null)
  const [matchCase, setMatchCase] = useState<boolean>(() => {
    try {
      const raw = window.localStorage.getItem('pdfoid.matchCase')
      return raw === '1'
    } catch {
      return false
    }
  })
  const [matchWholeWord, setMatchWholeWord] = useState<boolean>(() => {
    try {
      const raw = window.localStorage.getItem('pdfoid.wholeWord')
      return raw == null ? true : raw === '1'
    } catch {
      return true
    }
  })
  const [matches, setMatches] = useState<TextMatch[]>([])
  const [activeIndex, setActiveIndex] = useState<number>(-1)
  const [keepHighlightAfterAll, setKeepHighlightAfterAll] = useState<boolean>(() => {
    try {
      const raw = window.localStorage.getItem('pdfoid.keepHighlightAfterAll')
      return raw == null ? true : raw === '1'
    } catch {
      return true
    }
  })
  const imageInputRef = useRef<HTMLInputElement | null>(null)

  const { error: toastError, info: toastInfo } = useUIStore(
    useShallow((state) => ({ error: state.error, info: state.info }))
  )
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Disarm the delete confirmation after a short window
  useEffect(() => {
    if (!confirmDelete) return
    const timer = setTimeout(() => setConfirmDelete(false), 4000)
    return () => clearTimeout(timer)
  }, [confirmDelete])

  const hasDocument = numPages > 0
  const disableButtons = loading || !hasDocument

  const runSafely = async (label: string, task: () => Promise<void>) => {
    try {
      await task()
    } catch (err) {
      console.error(label, err)
      toastError(`${label} failed`, err instanceof Error ? err.message : 'Please try again.')
    }
  }

  const syncPage = (page: number) => {
    const total = usePdfEditorStore.getState().numPages
    const safePage = clampPage(page, total)
    if (safePage !== currentPage) {
      onForcePageChange(safePage)
    }
  }

  const handleAddPage = async (position: 'before' | 'after') => {
    if (!hasDocument) return
    const insertionIndex = position === 'before' ? Math.max(0, currentPage - 1) : currentPage
    await runSafely('Add page', async () => {
      await addBlankPage({ position: insertionIndex })
      syncPage(insertionIndex + 1)
    })
  }

  const handleDeletePage = async () => {
    if (!hasDocument || numPages <= 1) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setConfirmDelete(false)
    await runSafely('Delete page', async () => {
      await deletePage(currentPage - 1)
      const { numPages: updated } = usePdfEditorStore.getState()
      syncPage(Math.min(currentPage, updated))
    })
  }

  const handleMovePage = async (direction: 'up' | 'down') => {
    if (!hasDocument) return
    if (direction === 'up' && currentPage === 1) return
    if (direction === 'down' && currentPage === numPages) return

    const fromIndex = currentPage - 1
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1
    await runSafely('Reorder pages', async () => {
      await reorderPages({ fromIndex, toIndex })
      syncPage(toIndex + 1)
    })
  }

  const [cropModalOpen, setCropModalOpen] = useState(false);

  const handleRotate = async (direction: 'left' | 'right') => {
    if (!hasDocument) return
    await runSafely('Rotate page', async () => {
      await rotatePage({ pageIndex: currentPage - 1, direction })
    })
  }

  const handleCrop = () => {
    if (!hasDocument) return;
    setCropModalOpen(true);
  }

  const handleCropConfirm = async (margins: { left: number; top: number; right: number; bottom: number }) => {
    setCropModalOpen(false);

    const toRatio = (value: number) => value / 100
    const left = toRatio(margins.left)
    const top = toRatio(margins.top)
    const right = toRatio(margins.right)
    const bottom = toRatio(margins.bottom)

    if ([left, top, right, bottom].some((v) => v < 0 || v >= 1)) {
      toastError('Crop values must be between 0 and 100 percent.')
      return
    }

    const width = 1 - left - right
    const height = 1 - top - bottom
    if (width <= 0 || height <= 0) {
      toastError('Those margins remove the whole page. Use smaller values.')
      return
    }

    await runSafely('Crop page', async () => {
      await cropPage({
        pageIndex: currentPage - 1,
        box: { x: left, y: top, width, height, normalized: true },
      })
    })
  }

  const handleInsertImage = () => {
    if (!hasDocument) return
    imageInputRef.current?.click()
  }

  const onImageSelected: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const buffer = await file.arrayBuffer()
      await runSafely('Insert image', async () => {
        await insertImage({
          pageIndex: currentPage - 1,
          imageData: buffer,
          box: { width: 0.4, x: 0.3, y: 0.3, normalized: true },
        })
      })
    } catch (err) {
      console.error('Read image file failed', err)
      toastError('Could not read that image. Try a PNG or JPEG.')
    } finally {
      event.target.value = ''
    }
  }

  const handleFlattenAnnotations = async () => {
    if (!annotations.length) {
      toastInfo('There are no annotations to flatten.')
      return
    }
    await runSafely('Flatten annotations', async () => {
      await flattenAnnotations(annotations)
      clearAllAnnotations()
    })
  }

  const handleFind = async () => {
    if (!findText.trim()) {
      setReplaceStatus('Enter text to find')
      setMatches([])
      setActiveIndex(-1)
      setCurrentMatchHighlight(null)
      return
    }
    setReplaceStatus('Finding…')
    try {
      const found = await findTextMatches({ search: findText, caseSensitive: matchCase, wholeWord: matchWholeWord })
      setMatches(found)
      if (found.length) {
        setActiveIndex(0)
        onForcePageChange(found[0].pageIndex + 1)
        setCurrentMatchHighlight(found[0])
        setReplaceStatus(`Found ${found.length} match${found.length === 1 ? '' : 'es'}.`)
      } else {
        setActiveIndex(-1)
        setCurrentMatchHighlight(null)
        setReplaceStatus('No matches found.')
      }
    } catch (err: any) {
      console.error('Find failed', err)
      setReplaceStatus(err?.message || 'Find failed.')
    }
  }

  const gotoMatch = (dir: 'prev' | 'next') => {
    if (!matches.length) return
    const delta = dir === 'next' ? 1 : -1
    const next = (activeIndex + delta + matches.length) % matches.length
    setActiveIndex(next)
    const m = matches[next]
    onForcePageChange(m.pageIndex + 1)
    setCurrentMatchHighlight(m)
  }

  const handleReplaceOne = async () => {
    if (!replaceValue && replaceValue !== '') {
      setReplaceStatus('Enter replacement text')
      return
    }
    if (activeIndex < 0 || activeIndex >= matches.length) {
      setReplaceStatus('No active match to replace')
      return
    }
    const target = matches[activeIndex]
    try {
      const { replaced, reason } = await replaceMatch(target.id, replaceValue)
      if (replaced) {
        // Refresh matches and keep reasonable position
        const found = await findTextMatches({ search: findText, caseSensitive: matchCase, wholeWord: matchWholeWord })
        setMatches(found)
        if (found.length) {
          const nextIndex = Math.min(activeIndex, found.length - 1)
          setActiveIndex(nextIndex)
          onForcePageChange(found[nextIndex].pageIndex + 1)
          setCurrentMatchHighlight(found[nextIndex])
          setReplaceStatus('Replaced 1 occurrence.')
        } else {
          setActiveIndex(-1)
          setCurrentMatchHighlight(null)
          setReplaceStatus('Replaced 1 occurrence. No more matches.')
        }
      } else {
        const msg = reason === 'TEXT_TOO_WIDE'
          ? 'Skipped: Replacement text is too wide to fit safely.'
          : 'Skipped: Match not found in current render or unsafe.'
        setReplaceStatus(msg)
      }
    } catch (err: any) {
      console.error('Replace one failed', err)
      setReplaceStatus(err?.message || 'Replace failed.')
    }
  }

  const handleReplaceOneAndNext = async () => {
    if (activeIndex < 0 || activeIndex >= matches.length) {
      setReplaceStatus('No active match to replace')
      return
    }
    const target = matches[activeIndex]
    try {
      const { replaced } = await replaceMatch(target.id, replaceValue)
      // After replace, refresh and advance to the next match
      const found = await findTextMatches({ search: findText, caseSensitive: matchCase, wholeWord: matchWholeWord })
      setMatches(found)
      if (!found.length) {
        setActiveIndex(-1)
        setCurrentMatchHighlight(null)
        setReplaceStatus(replaced ? 'Replaced and reached end.' : 'Nothing to replace.')
        return
      }
      const next = Math.min(activeIndex, found.length - 1)
      setActiveIndex(next)
      onForcePageChange(found[next].pageIndex + 1)
      setCurrentMatchHighlight(found[next])
      setReplaceStatus(replaced ? 'Replaced and moved to next.' : 'Skipped current, moved to next.')
    } catch (err: any) {
      console.error('Replace and next failed', err)
      setReplaceStatus(err?.message || 'Replace failed.')
    }
  }

  const handleFindReplace: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault()
    if (!findText.trim()) {
      setReplaceStatus('Enter text to find')
      return
    }
    setReplaceStatus('Running find & replace…')
    try {
      let result = await replaceText({
        search: findText,
        replace: replaceValue,
        caseSensitive: matchCase,
        wholeWord: matchWholeWord,
      })
      // Fallback: if whole-word was on and nothing changed, retry without whole-word constraint
      if (!result.replacements && matchWholeWord) {
        result = await replaceText({
          search: findText,
          replace: replaceValue,
          caseSensitive: matchCase,
          wholeWord: false,
        })
      }
      if (!result.replacements && result.skipped) {
        setReplaceStatus(`Skipped ${result.skipped} match${result.skipped === 1 ? '' : 'es'} that were unsafe to replace.`)
      } else if (result.replacements) {
        const base = `Replaced ${result.replacements} occurrence${result.replacements === 1 ? '' : 's'}.`
        setReplaceStatus(result.skipped ? `${base} Skipped ${result.skipped}.` : base)
        // Post-Replace All behavior: keep or clear highlight
        if (keepHighlightAfterAll) {
          const found = await findTextMatches({ search: findText, caseSensitive: matchCase, wholeWord: matchWholeWord })
          setMatches(found)
          if (found.length) {
            setActiveIndex(0)
            onForcePageChange(found[0].pageIndex + 1)
            setCurrentMatchHighlight(found[0])
          } else {
            setActiveIndex(-1)
            setCurrentMatchHighlight(null)
          }
        } else {
          setCurrentMatchHighlight(null)
        }
      } else {
        setReplaceStatus('No matches found.')
      }
    } catch (err: any) {
      console.error('Find & replace failed', err)
      setReplaceStatus(err?.message || 'Find & replace failed.')
    }
  }

  return (
    <div className="w-full">
      <InspectorSection title="Page" meta={hasDocument ? `${currentPage} of ${numPages}` : undefined}>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => handleAddPage('before')} disabled={disableButtons} className={actionTile}>
            <Plus size={16} className="text-[var(--pdfoid-muted)]" aria-hidden />Add Before
          </button>
          <button onClick={() => handleAddPage('after')} disabled={disableButtons} className={actionTile}>
            <Plus size={16} className="text-[var(--pdfoid-muted)]" aria-hidden />Add After
          </button>
          <button onClick={() => handleMovePage('up')} disabled={disableButtons || currentPage === 1} className={actionTile}>
            <ArrowLineUp size={16} className="text-[var(--pdfoid-muted)]" aria-hidden />Move Up
          </button>
          <button onClick={() => handleMovePage('down')} disabled={disableButtons || currentPage === numPages} className={actionTile}>
            <ArrowLineDown size={16} className="text-[var(--pdfoid-muted)]" aria-hidden />Move Down
          </button>
          <button onClick={() => handleRotate('left')} disabled={disableButtons} className={actionTile}>
            <ArrowsCounterClockwise size={16} className="text-[var(--pdfoid-muted)]" aria-hidden />Rotate Left
          </button>
          <button onClick={() => handleRotate('right')} disabled={disableButtons} className={actionTile}>
            <ArrowsClockwise size={16} className="text-[var(--pdfoid-muted)]" aria-hidden />Rotate Right
          </button>
          <button onClick={handleCrop} disabled={disableButtons} className={actionTile}>
            <Crop size={16} className="text-[var(--pdfoid-muted)]" aria-hidden />Crop…
          </button>
          <button onClick={handleInsertImage} disabled={disableButtons} className={actionTile}>
            <ImageSquare size={16} className="text-[var(--pdfoid-muted)]" aria-hidden />Insert Image…
          </button>
          <button
            onClick={handleFlattenAnnotations}
            disabled={disableButtons || annotations.length === 0}
            className={`${actionTile} col-span-2`}
            title="Burn annotations into the PDF so they can no longer be edited"
          >
            <Stack size={16} className="text-[var(--pdfoid-muted)]" aria-hidden />Flatten Annotations
          </button>
          <button
            onClick={handleDeletePage}
            disabled={disableButtons || numPages <= 1}
            className={`col-span-2 flex items-center justify-center gap-2 h-9 px-3 rounded-lg text-sm font-semibold transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pdfoid-ring)] ${confirmDelete
              ? 'bg-[var(--pdfoid-danger)] text-white'
              : 'text-[var(--pdfoid-danger)] hover:bg-[var(--pdfoid-danger-soft)]'}`}
            aria-live="polite"
          >
            <Trash size={16} aria-hidden />
            {confirmDelete ? `Confirm delete page ${currentPage}` : 'Delete Page'}
          </button>
        </div>
      </InspectorSection>

      <InspectorSection title="Find and replace">
        <form onSubmit={handleFindReplace} className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="find-text-input" className="text-xs font-medium text-[var(--pdfoid-muted)]">Find</label>
            <div className="relative">
              <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--pdfoid-subtle)] pointer-events-none" aria-hidden />
              <input
                id="find-text-input"
                value={findText}
                onChange={(e) => {
                  setFindText(e.target.value)
                  setReplaceStatus(null)
                  setCurrentMatchHighlight(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleFind()
                  }
                }}
                disabled={disableButtons}
                className={`${fieldClass} pl-9`}
                placeholder="Text to find"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="replace-text-input" className="text-xs font-medium text-[var(--pdfoid-muted)]">Replace</label>
            <input
              id="replace-text-input"
              value={replaceValue}
              onChange={(e) => {
                setReplaceValue(e.target.value)
                setReplaceStatus(null)
              }}
              disabled={disableButtons}
              className={fieldClass}
              placeholder="Replacement text"
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--pdfoid-text)]">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={matchCase}
                onChange={(event) => {
                  const next = event.target.checked
                  setMatchCase(next)
                  try { window.localStorage.setItem('pdfoid.matchCase', next ? '1' : '0') } catch { }
                  setReplaceStatus(null)
                }}
                disabled={disableButtons}
                className={checkboxClass}
              />
              <span>Match case</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={matchWholeWord}
                onChange={(event) => {
                  const next = event.target.checked
                  setMatchWholeWord(next)
                  try { window.localStorage.setItem('pdfoid.wholeWord', next ? '1' : '0') } catch { }
                  setReplaceStatus(null)
                }}
                disabled={disableButtons}
                className={checkboxClass}
              />
              <span>Whole word</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button aria-label="Execute search" type="button" onClick={handleFind} disabled={disableButtons} className={`${actionTile} flex-1 justify-center`}>Find</button>
            <button
              aria-label="Execute replace all"
              type="submit"
              disabled={disableButtons}
              className="flex-1 h-9 px-3 rounded-lg text-sm font-semibold bg-[var(--pdfoid-text)] text-[var(--pdfoid-surface)] hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pdfoid-ring)]"
            >
              Replace All
            </button>
          </div>

          {/* Match navigation */}
          <div className="flex items-center gap-1 h-9 pl-3 pr-1 rounded-lg bg-[var(--pdfoid-surface-2)]">
            <span className="flex-1 min-w-0 truncate text-sm text-[var(--pdfoid-muted)] tabular-nums">
              {matches.length ? `${activeIndex + 1} / ${matches.length} on page ${matches[activeIndex]?.pageIndex + 1}` : 'No matches yet'}
            </span>
            <button type="button" onClick={() => gotoMatch('prev')} disabled={disableButtons || matches.length === 0} aria-label="Prev" className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[var(--pdfoid-muted)] hover:text-[var(--pdfoid-text)] hover:bg-[var(--pdfoid-surface)] disabled:opacity-35 disabled:pointer-events-none transition-colors duration-200">
              <CaretLeft size={14} weight="bold" aria-hidden />
            </button>
            <button type="button" onClick={() => gotoMatch('next')} disabled={disableButtons || matches.length === 0} className="inline-flex items-center justify-center h-7 px-2 rounded-md text-sm font-medium text-[var(--pdfoid-muted)] hover:text-[var(--pdfoid-text)] hover:bg-[var(--pdfoid-surface)] disabled:opacity-35 disabled:pointer-events-none transition-colors duration-200">
              Next
            </button>
          </div>

          <div className="flex gap-2">
            <button aria-label="Replace current match" type="button" onClick={handleReplaceOne} disabled={disableButtons || activeIndex < 0} className={`${actionTile} flex-1 justify-center`}>Replace</button>
            <button aria-label="Replace current match and find next" type="button" onClick={handleReplaceOneAndNext} disabled={disableButtons || activeIndex < 0} className={`${actionTile} flex-1 justify-center`}>
              Replace + Next
            </button>
          </div>
          {replaceStatus && <p className="text-sm text-[var(--pdfoid-muted)]" role="status">{replaceStatus}</p>}

          <label className="flex items-center gap-2 text-sm text-[var(--pdfoid-muted)] cursor-pointer">
            <input
              type="checkbox"
              checked={keepHighlightAfterAll}
              onChange={(e) => {
                const next = e.target.checked
                setKeepHighlightAfterAll(next)
                try { window.localStorage.setItem('pdfoid.keepHighlightAfterAll', next ? '1' : '0') } catch { }
              }}
              disabled={disableButtons}
              className={checkboxClass}
            />
            <span>Keep highlight after Replace All</span>
          </label>
        </form>
      </InspectorSection>

      <InspectorSection title="Highlight timing" defaultOpen={false}>
        <div className="space-y-3 text-sm text-[var(--pdfoid-text)]">
          <label className="flex items-center justify-between gap-3">
            <span>Flash duration (ms)</span>
            <input
              type="number"
              min={100}
              step={50}
              value={defaultFlashTtlMs}
              onChange={(e) => {
                const n = Number(e.target.value)
                setDefaultFlashTtlMs(Number.isFinite(n) ? n : 900)
              }}
              className={`${fieldClass} w-24 tabular-nums`}
            />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span>Auto clear highlight (ms, 0 is never)</span>
            <input
              type="number"
              min={0}
              step={250}
              value={autoClearHighlightMs}
              onChange={(e) => {
                const n = Number(e.target.value)
                setAutoClearHighlightMs(Number.isFinite(n) ? n : 0)
              }}
              className={`${fieldClass} w-24 tabular-nums`}
            />
          </label>
        </div>
      </InspectorSection>

      <input ref={imageInputRef} type="file" accept="image/png,image/jpeg" onChange={onImageSelected} className="hidden" />
      {cropModalOpen && (
        <CropModal
          onConfirm={handleCropConfirm}
          onCancel={() => setCropModalOpen(false)}
        />
      )}
    </div>
  )
}
