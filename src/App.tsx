import React, { useEffect, useMemo, useState, useCallback, useSyncExternalStore } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  ArrowCounterClockwise,
  ArrowClockwise,
  BracketsCurly,
  DownloadSimple,
  FilePdf,
  FloppyDisk,
  Keyboard,
  MagnifyingGlass,
  PencilSimple,
  Signature,
  SidebarSimple,
  SlidersHorizontal,
  Stack,
  WarningCircle,
  X,
} from '@phosphor-icons/react'
import PDFUploader from './components/PDFUploader'
import PDFViewer from './components/PDFViewer'
import { useAnnotationStore } from './store/annotationStore'
import { useUIStore } from './store/uiStore'
import { ToolBar } from './components/ToolBar'
import { ToolOptionsBar } from './components/ToolOptionsBar'
import { AnnotationList } from './components/AnnotationList'
import { DocumentActionsPanel, InspectorSection } from './components/DocumentActionsPanel'
import { CvExportPanel } from './components/CvExportPanel'
import { DocumentHistoryBar, FormsSection, MergeExtractSection, OcrSection, ProtectSection, StampSection } from './components/DocumentTools'
import { PageThumbnails } from './components/PageThumbnails'
import { PasswordDialog } from './components/PasswordDialog'
import { RecentFiles } from './components/RecentFiles'
import { downloadBlob, useDownloadPdf } from './components/useDownloadPdf'
import { usePdfEditorStore } from './store/pdfEditorStore'
import { TOOL_BY_SHORTCUT } from './constants/tools'
import { Button, Divider, IconButton, SkipLink, Spinner } from './components/ui'
import { useDocumentTitle } from './hooks'
import { ToastContainer } from './components/ToastContainer'
import { KeyboardShortcutsHelp } from './components/KeyboardShortcutsHelp'

// Breakpoints at which each side panel docks instead of opening as a sheet
const ANNOTATIONS_DOCK_QUERY = '(min-width: 1280px)'
const INSPECTOR_DOCK_QUERY = '(min-width: 1024px)'

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false
  )
}

/**
 * Brand mark: flat accent tile, no gradient
 */
function BrandMark() {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="w-7 h-7 rounded-lg bg-[var(--pdfoid-text)] text-[var(--pdfoid-surface)] flex items-center justify-center" aria-hidden="true">
        <FilePdf size={16} weight="bold" />
      </div>
      <h1 className="text-base font-semibold tracking-tight text-[var(--pdfoid-text)]">PDFoid</h1>
    </div>
  )
}

const capabilities = [
  { icon: PencilSimple, label: 'Highlight, draw and add notes' },
  { icon: Signature, label: 'Sign with a drawn or typed signature' },
  { icon: MagnifyingGlass, label: 'Find and replace text' },
  { icon: Stack, label: 'Add, reorder, rotate and crop pages' },
]

/**
 * First screen: one job, open a PDF
 */
function EmptyState({ onLoadPDF }: { onLoadPDF: (data: ArrayBuffer, name: string) => void }) {
  return (
    <div className="flex-1 overflow-y-auto canvas-grain">
      <div className="min-h-full flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-xl animate-fade-in-up">
          <h2 className="text-4xl sm:text-5xl font-semibold tracking-tight text-center bg-clip-text text-transparent bg-[linear-gradient(90deg,#000000,#666666)] dark:bg-[linear-gradient(90deg,#ffffff,#9b9b9b)] pb-1">
            Edit, sign and mark up PDFs
          </h2>
          <p className="mt-4 text-base text-center text-[var(--pdfoid-muted)] max-w-md mx-auto">
            Everything runs in your browser. Your file never leaves this device.
          </p>
          <div className="mt-10">
            <PDFUploader onLoadPDF={onLoadPDF} />
          </div>
          <ul className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {capabilities.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2.5 text-sm text-[var(--pdfoid-muted)]">
                <Icon size={18} className="shrink-0 text-[var(--pdfoid-text)]" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
          <RecentFiles />
        </div>
      </div>
    </div>
  )
}

/**
 * Clear-all with an inline two-step confirmation instead of window.confirm
 */
function ClearAllButton() {
  const clearAllAnnotations = useAnnotationStore((s) => s.clearAllAnnotations)
  const hasAnnotations = useAnnotationStore((s) => s.annotations.length > 0)
  const warning = useUIStore((s) => s.warning)
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const timer = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(timer)
  }, [armed])

  const handleClick = () => {
    if (!hasAnnotations) return
    if (!armed) {
      setArmed(true)
      return
    }
    setArmed(false)
    clearAllAnnotations()
    warning('All annotations cleared')
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Clear all annotations"
      title={armed ? 'Click again to clear every annotation' : 'Clear all annotations'}
      className={`h-8 px-2.5 rounded-lg text-sm font-semibold transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pdfoid-ring)] ${armed
        ? 'bg-[var(--pdfoid-danger)] text-white'
        : 'text-[var(--pdfoid-muted)] hover:text-[var(--pdfoid-danger)] hover:bg-[var(--pdfoid-danger-soft)]'
        }`}
    >
      {armed ? 'Confirm' : 'Clear'}
    </button>
  )
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<number>(1)

  // Use useShallow to prevent infinite re-renders from object selectors
  const {
    setStoreCurrentPage,
    selectTool,
    setIsDrawing,
    undoStore,
    redoStore,
    selectedAnnotationId,
    deleteAnnotation,
    exportAsJSON,
    saveToIndexedDB,
    loadFromIndexedDB,
  } = useAnnotationStore(
    useShallow((state) => ({
      setStoreCurrentPage: state.setCurrentPage,
      selectTool: state.selectTool,
      setIsDrawing: state.setIsDrawing,
      undoStore: state.undo,
      redoStore: state.redo,
      selectedAnnotationId: state.selectedAnnotationId,
      deleteAnnotation: state.deleteAnnotation,
      exportAsJSON: state.exportAsJSON,
      saveToIndexedDB: state.saveToIndexedDB,
      loadFromIndexedDB: state.loadFromIndexedDB,
    }))
  )

  const canUndo = useAnnotationStore((s) => s.undoStackLength > 0)
  const canRedo = useAnnotationStore((s) => s.redoStackLength > 0)

  const { info, success, error, warning, toggleShortcutsHelp, preferences, toggleSidebar, toggleRightPanel } = useUIStore(
    useShallow((s) => ({
      info: s.info,
      success: s.success,
      error: s.error,
      warning: s.warning,
      toggleShortcutsHelp: s.toggleShortcutsHelp,
      preferences: s.preferences,
      toggleSidebar: s.toggleSidebar,
      toggleRightPanel: s.toggleRightPanel,
    }))
  )

  const {
    pdfBytes,
    pdfRevision,
    fileName,
    loadDocument,
    undoDocument,
    redoDocument,
    editorError,
    clearEditorError,
    editorLoading,
  } = usePdfEditorStore(
    useShallow((s) => ({
      pdfBytes: s.pdfData,
      pdfRevision: s.pdfRevision,
      fileName: s.fileName,
      loadDocument: s.loadDocument,
      undoDocument: s.undoDocument,
      redoDocument: s.redoDocument,
      editorError: s.error,
      clearEditorError: s.clearError,
      editorLoading: s.loading,
    }))
  )

  const annotationsDocked = useMediaQuery(ANNOTATIONS_DOCK_QUERY)
  const inspectorDocked = useMediaQuery(INSPECTOR_DOCK_QUERY)
  const [sheet, setSheet] = useState<'annotations' | 'inspector' | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const { download: downloadPdf, busy: isDownloading, dialog: redactionDialog } = useDownloadPdf()
  const [leftTab, setLeftTab] = useState<'pages' | 'annotations'>(() => {
    try {
      return window.localStorage.getItem('pdfoid.leftTab') === 'pages' ? 'pages' : 'annotations'
    } catch {
      return 'annotations'
    }
  })
  const chooseLeftTab = (tab: 'pages' | 'annotations') => {
    setLeftTab(tab)
    try { window.localStorage.setItem('pdfoid.leftTab', tab) } catch { /* storage blocked */ }
  }

  const viewerData = useMemo(() => {
    if (!pdfBytes) return null
    const copy = pdfBytes.slice()
    return copy.buffer as ArrayBuffer
  }, [pdfBytes])

  const handleLoadPDF = async (data: ArrayBuffer, name: string) => {
    try {
      useAnnotationStore.getState().setCurrentPdfId(name || 'current-pdf')
      await loadDocument(data, name)
      setCurrentPage(1)
      setStoreCurrentPage(1)
    } catch (err) {
      console.error('Unable to load PDF document', err)
    }
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    setStoreCurrentPage(page)
  }

  const handleExportJson = () => {
    const json = exportAsJSON()
    downloadBlob(new Blob([json], { type: 'application/json' }), `annotations-${new Date().getTime()}.json`)
    success('Annotations exported successfully')
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await saveToIndexedDB()
      success('Annotations saved successfully')
    } catch (err) {
      console.error('Failed to save annotations', err)
      warning('Could not save annotations. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  // Desktop collapses the docked panel; smaller screens open it as a sheet
  const toggleAnnotationsPanel = useCallback(() => {
    if (annotationsDocked) toggleSidebar()
    else setSheet((s) => (s === 'annotations' ? null : 'annotations'))
  }, [annotationsDocked, toggleSidebar])

  const toggleInspectorPanel = useCallback(() => {
    if (inspectorDocked) toggleRightPanel()
    else setSheet((s) => (s === 'inspector' ? null : 'inspector'))
  }, [inspectorDocked, toggleRightPanel])

  useEffect(() => {
    loadFromIndexedDB('default').catch((err) => {
      console.error('Failed to restore annotations', err)
    })
  }, [loadFromIndexedDB])

  useDocumentTitle(fileName ? `${fileName} - PDFoid` : 'PDFoid - PDF Viewer & Editor')

  // Global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      const isCtrl = e.ctrlKey || e.metaKey

      // Document history; match the physical key, since Alt changes e.key on macOS
      if (isCtrl && e.altKey && e.code === 'KeyZ') {
        e.preventDefault()
        if (e.shiftKey) redoDocument()
        else undoDocument()
        return
      }

      if (isCtrl && key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undoStore()
        return
      }
      if ((isCtrl && key === 'z' && e.shiftKey) || (isCtrl && key === 'y')) {
        e.preventDefault()
        redoStore()
        return
      }

      // Tool shortcuts (skip when focusing input/textarea)
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return

      if (!isCtrl && !e.altKey && TOOL_BY_SHORTCUT[key]) {
        selectTool(TOOL_BY_SHORTCUT[key])
      }

      if (key === 'escape') {
        selectTool('pointer')
        setIsDrawing(false)
        setSheet(null)
      }

      if ((key === 'delete' || key === 'backspace') && selectedAnnotationId) {
        e.preventDefault()
        deleteAnnotation(selectedAnnotationId)
        info('Annotation deleted')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectTool, setIsDrawing, undoStore, redoStore, undoDocument, redoDocument, selectedAnnotationId, deleteAnnotation, info])

  const annotationsVisible = annotationsDocked ? !preferences.sidebarCollapsed : sheet === 'annotations'
  const inspectorVisible = inspectorDocked ? !preferences.rightPanelCollapsed : sheet === 'inspector'

  // A panel is either docked in the layout or floating as a bottom sheet
  const panelClass = (docked: boolean, visible: boolean, width: string, side: 'left' | 'right') => {
    if (!visible) return 'hidden'
    if (docked) {
      return `flex flex-col ${width} shrink-0 min-h-0 bg-[var(--pdfoid-surface)] ${side === 'left' ? 'border-r' : 'border-l'} border-[var(--pdfoid-border)]`
    }
    return 'fixed inset-x-0 bottom-0 z-40 flex flex-col max-h-[75dvh] rounded-t-2xl bg-[var(--pdfoid-surface)] shadow-[var(--pdfoid-shadow)] animate-slide-up safe-bottom'
  }

  const sheetHandle = (label: string) => (
    <div className="flex items-center justify-between h-12 pl-4 pr-2 border-b border-[var(--pdfoid-border)] shrink-0">
      <span className="text-sm font-semibold text-[var(--pdfoid-text)]">{label}</span>
      <IconButton icon={<X size={18} />} label={`Close ${label.toLowerCase()}`} size="sm" onClick={() => setSheet(null)} />
    </div>
  )

  return (
    <div className="h-dvh flex flex-col bg-[var(--pdfoid-bg)] font-sans relative">
      <SkipLink />

      {/* App bar */}
      <header
        className="relative z-30 flex items-center gap-2 h-14 px-3 sm:px-4 bg-[var(--pdfoid-surface)] border-b border-[var(--pdfoid-border)] shrink-0"
        role="banner"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <BrandMark />
          {fileName && (
            <>
              <span className="hidden xl:block text-[var(--pdfoid-border-strong)]" aria-hidden="true">/</span>
              <span
                className="hidden xl:block min-w-0 truncate text-sm font-medium text-[var(--pdfoid-muted)]"
                title={fileName}
                aria-label={`Currently viewing: ${fileName}`}
              >
                {fileName}
              </span>
              <PDFUploader onLoadPDF={handleLoadPDF} variant="button" />
            </>
          )}
        </div>

        {viewerData && <ToolBar />}

        {viewerData && (
          <div className="flex items-center justify-end gap-1 shrink-0 md:flex-1">
            <IconButton
              icon={<ArrowCounterClockwise size={18} />}
              label="Undo last action"
              aria-keyshortcuts="Control+Z"
              size="sm"
              onClick={undoStore}
              disabled={!canUndo}
            />
            <IconButton
              icon={<ArrowClockwise size={18} />}
              label="Redo last undone action"
              aria-keyshortcuts="Control+Shift+Z"
              size="sm"
              onClick={redoStore}
              disabled={!canRedo}
            />
            <Divider vertical className="mx-1 hidden sm:block" />
            <IconButton
              icon={<SidebarSimple size={18} />}
              label="Toggle annotations panel"
              size="sm"
              isActive={annotationsVisible}
              onClick={toggleAnnotationsPanel}
            />
            <IconButton
              icon={<SlidersHorizontal size={18} />}
              label="Toggle document panel"
              size="sm"
              isActive={inspectorVisible}
              onClick={toggleInspectorPanel}
            />
            <IconButton
              icon={<Keyboard size={18} />}
              label="Show keyboard shortcuts help"
              size="sm"
              className="max-md:hidden"
              onClick={toggleShortcutsHelp}
            />
            <Divider vertical className="mx-1 hidden sm:block" />
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSave}
              isLoading={isSaving}
              leftIcon={<FloppyDisk size={16} aria-hidden />}
              aria-label="Save annotations"
              className="max-sm:hidden"
            >
              Save
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => downloadPdf()}
              isLoading={isDownloading}
              leftIcon={<DownloadSimple size={16} weight="bold" aria-hidden />}
              aria-label="Download PDF"
            >
              <span className="hidden sm:inline">Download</span>
            </Button>
          </div>
        )}
      </header>

      {viewerData ? (
        <div className="flex-1 flex flex-row min-h-0 pb-16 md:pb-0">
          {/* Annotations panel */}
          <aside className={panelClass(annotationsDocked, annotationsVisible, 'w-72', 'left')} aria-label="Annotations">
            {!annotationsDocked && sheetHandle('Pages and annotations')}
            <div className="grid grid-cols-2 gap-1 m-3 mb-0 p-1 rounded-lg bg-[var(--pdfoid-surface-2)] shrink-0" role="tablist" aria-label="Left panel">
              {(['pages', 'annotations'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={leftTab === tab}
                  onClick={() => chooseLeftTab(tab)}
                  className={`h-7 rounded-md text-xs font-semibold capitalize transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pdfoid-ring)] ${leftTab === tab
                    ? 'bg-[var(--pdfoid-surface)] text-[var(--pdfoid-text)] shadow-sm'
                    : 'text-[var(--pdfoid-muted)] hover:text-[var(--pdfoid-text)]'}`}
                >
                  {tab}
                </button>
              ))}
            </div>
            {leftTab === 'pages' ? (
              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
                <PageThumbnails
                  currentPage={currentPage}
                  onSelectPage={(page) => {
                    handlePageChange(page)
                    if (!annotationsDocked) setSheet(null)
                  }}
                />
              </div>
            ) : (
            <div className="flex-1 min-h-0">
              <AnnotationList
                currentPage={currentPage}
                headerActions={
                  <>
                    <IconButton
                      icon={<BracketsCurly size={16} />}
                      label="Export annotations as JSON"
                      size="sm"
                      onClick={handleExportJson}
                    />
                    <ClearAllButton />
                  </>
                }
              />
            </div>
            )}
          </aside>

          {/* Document */}
          <main id="main-content" className="flex-1 min-w-0 flex flex-col" role="main">
            <ToolOptionsBar />
            <div className="flex-1 min-h-0">
              <PDFViewer key={pdfRevision} pdfData={viewerData} onPageChange={handlePageChange} targetPage={currentPage} />
            </div>
          </main>

          {/* Inspector */}
          <aside className={panelClass(inspectorDocked, inspectorVisible, 'w-80', 'right')} aria-label="Document tools">
            {!inspectorDocked && sheetHandle('Document')}
            <DocumentHistoryBar />
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-thin">
              <DocumentActionsPanel currentPage={currentPage} onForcePageChange={handlePageChange} />
              <div className="border-t border-[var(--pdfoid-border)]">
                <InspectorSection title="Merge and extract" defaultOpen={false}>
                  <MergeExtractSection />
                </InspectorSection>
                <InspectorSection title="Page numbers and watermark" defaultOpen={false}>
                  <StampSection />
                </InspectorSection>
                <InspectorSection title="Form fields" defaultOpen={false}>
                  <FormsSection />
                </InspectorSection>
                <InspectorSection title="Text recognition" defaultOpen={false}>
                  <OcrSection currentPage={currentPage} />
                </InspectorSection>
                <InspectorSection title="Password protect" defaultOpen={false}>
                  <ProtectSection />
                </InspectorSection>
                <InspectorSection title="CV export">
                  <CvExportPanel />
                </InspectorSection>
              </div>
            </div>
          </aside>

          {sheet && (
            <div
              className="fixed inset-0 z-30 bg-black/40 animate-fade-in"
              onClick={() => setSheet(null)}
              aria-hidden="true"
            />
          )}
        </div>
      ) : (
        <main id="main-content" className="flex-1 flex flex-col min-h-0" role="main">
          <EmptyState onLoadPDF={handleLoadPDF} />
        </main>
      )}

      {editorError && (
        <div
          className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 max-w-[calc(100%-32px)] pl-3 pr-1.5 py-1.5 rounded-xl bg-[var(--pdfoid-surface)] border border-[var(--pdfoid-border)] shadow-[var(--pdfoid-shadow)] animate-fade-in-up"
          role="alert"
          aria-live="assertive"
        >
          <WarningCircle size={18} className="shrink-0 text-[var(--pdfoid-danger)]" aria-hidden />
          <span className="text-sm font-medium text-[var(--pdfoid-text)]">{editorError}</span>
          <Button variant="ghost" size="sm" onClick={clearEditorError} aria-label="Dismiss error">
            Dismiss
          </Button>
        </div>
      )}
      {editorLoading && (
        <div
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 h-9 px-3 rounded-full bg-[var(--pdfoid-surface)] border border-[var(--pdfoid-border)] shadow-[var(--pdfoid-shadow)] text-sm font-medium text-[var(--pdfoid-text)] animate-fade-in"
          role="status"
          aria-live="polite"
        >
          <Spinner size="sm" className="text-[var(--pdfoid-accent)]" />
          Processing PDF...
        </div>
      )}

      <PasswordDialog />
      {redactionDialog}
      <ToastContainer />
      <KeyboardShortcutsHelp />
    </div>
  )
}
