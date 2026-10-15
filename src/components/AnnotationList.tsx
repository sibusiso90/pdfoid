/**
 * AnnotationList - Modern sidebar showing all annotations for current page
 * Features: filtering, selection, deletion, and smooth animations
 */

import React, { useMemo, useState, useCallback } from 'react';
import { useAnnotationStore } from '../store/annotationStore';
import { Annotation, AnnotationType } from '../types/annotations';
import { TOOL_CATALOG } from '../constants/tools';
import {
  ArrowUpRight,
  Circle,
  EyeSlash,
  Stamp,
  TextStrikethrough,
  TextUnderline,
  Funnel,
  Highlighter,
  NoteBlank,
  PencilSimple,
  Signature,
  Square,
  TextT,
  Trash,
} from '@phosphor-icons/react';

interface AnnotationListProps {
  currentPage: number;
  /** Extra controls rendered at the right of the header (export, clear all) */
  headerActions?: React.ReactNode;
}

const iconProps = { size: 16, 'aria-hidden': true } as const;

const AnnotationIcons: Record<string, React.ReactNode> = {
  highlight: <Highlighter {...iconProps} />,
  pen: <PencilSimple {...iconProps} />,
  rectangle: <Square {...iconProps} />,
  'sticky-note': <NoteBlank {...iconProps} />,
  'text-box': <TextT {...iconProps} />,
  signature: <Signature {...iconProps} />,
  underline: <TextUnderline {...iconProps} />,
  strikethrough: <TextStrikethrough {...iconProps} />,
  ellipse: <Circle {...iconProps} />,
  arrow: <ArrowUpRight {...iconProps} />,
  stamp: <Stamp {...iconProps} />,
  redaction: <EyeSlash {...iconProps} />,
};

type FilterType = 'all' | AnnotationType;

export const AnnotationList: React.FC<AnnotationListProps> = ({ currentPage, headerActions }) => {
  const annotations = useAnnotationStore((s) => s.annotations);
  const deleteAnnotation = useAnnotationStore((s) => s.deleteAnnotation);
  const setSelectedAnnotation = useAnnotationStore((s) => (s as any).setSelectedAnnotation);
  const selectedAnnotationId = useAnnotationStore((s) => s.selectedAnnotationId);
  const selectTool = useAnnotationStore((s) => s.selectTool);

  const [filter, setFilter] = useState<FilterType>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);

  // Auto-scroll to selected annotation
  React.useEffect(() => {
    if (selectedAnnotationId) {
      const el = document.getElementById(`annotation-item-${selectedAnnotationId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedAnnotationId]);

  // Reset visibility when filter/page changes
  React.useEffect(() => {
    setVisibleCount(20);
  }, [currentPage, filter]);

  const pageAnnotations = useMemo(
    () => annotations.filter((ann) => ann.page === currentPage),
    [annotations, currentPage]
  );

  const filteredAnnotations = useMemo(() => {
    if (filter === 'all') return pageAnnotations;
    return pageAnnotations.filter((ann) => ann.type === filter);
  }, [pageAnnotations, filter]);

  const annotationCounts = useMemo(() => {
    const counts: Record<string, number> = { all: pageAnnotations.length };
    pageAnnotations.forEach((ann) => {
      counts[ann.type] = (counts[ann.type] || 0) + 1;
    });
    return counts;
  }, [pageAnnotations]);

  const getAnnotationIcon = (type: string): React.ReactNode => {
    return AnnotationIcons[type] || AnnotationIcons.pen;
  };

  const getAnnotationLabel = useCallback((ann: Annotation): string => {
    switch (ann.type) {
      case 'sticky-note':
        return ann.text?.substring(0, 30) || 'Sticky Note';
      case 'text-box':
        return ann.text?.substring(0, 30) || 'Text Box';
      case 'signature':
        return 'Signature';
      case 'highlight':
        return 'Highlight';
      case 'pen':
        return 'Drawing';
      case 'rectangle':
        return 'Rectangle';
      default:
        return TOOL_CATALOG.find((tool) => tool.id === ann.type)?.label ?? 'Annotation';
    }
  }, []);

  const getTypeLabel = (type: FilterType): string => {
    const labels: Record<FilterType, string> = {
      all: 'All',
      highlight: 'Highlights',
      pen: 'Drawings',
      rectangle: 'Rectangles',
      'sticky-note': 'Notes',
      'text-box': 'Text Boxes',
      stamp: 'Stamps',
      signature: 'Signatures',
      underline: 'Underlines',
      strikethrough: 'Strikethroughs',
      ellipse: 'Ellipses',
      arrow: 'Arrows',
      redaction: 'Redactions',
    };
    return labels[type] || type;
  };

  const handleDelete = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeletingId(id);
    // Animate out, then delete
    setTimeout(() => {
      deleteAnnotation(id);
      setDeletingId(null);
    }, 200);
  }, [deleteAnnotation]);

  const handleSelect = useCallback((id: string) => {
    setSelectedAnnotation(id);
    selectTool('pointer');
  }, [setSelectedAnnotation, selectTool]);

  const formatTime = (date: number | Date): string => {
    const d = new Date(date);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();

    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const filterOptions: FilterType[] = ['all', 'highlight', 'underline', 'strikethrough', 'pen', 'rectangle', 'ellipse', 'arrow', 'sticky-note', 'text-box', 'stamp', 'signature', 'redaction'];
  const isEmpty = pageAnnotations.length === 0;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 h-12 px-4 border-b border-[var(--pdfoid-border)] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-sm font-semibold text-[var(--pdfoid-text)]">Annotations</h2>
          <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-md text-xs font-medium tabular-nums bg-[var(--pdfoid-surface-2)] text-[var(--pdfoid-muted)]">
            {filteredAnnotations.length}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          {!isEmpty && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pdfoid-ring)] ${showFilters || filter !== 'all'
                ? 'bg-[var(--pdfoid-accent-soft)] text-[var(--pdfoid-accent)]'
                : 'text-[var(--pdfoid-muted)] hover:text-[var(--pdfoid-text)] hover:bg-[var(--pdfoid-hover)]'
                }`}
              title="Filter annotations"
              aria-expanded={showFilters}
              aria-label="Toggle annotation filters"
            >
              <Funnel size={16} aria-hidden />
            </button>
          )}
          {headerActions}
        </div>
      </div>

      {/* Filter chips */}
      {showFilters && !isEmpty && (
        <div className="flex flex-wrap gap-1.5 px-4 py-3 border-b border-[var(--pdfoid-border)] animate-fade-in">
          {filterOptions.map((type) => {
            const count = annotationCounts[type] || 0;
            if (type !== 'all' && count === 0) return null;
            const active = filter === type;
            return (
              <button
                key={type}
                onClick={() => setFilter(type)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md transition-colors duration-200 ${active
                  ? 'bg-[var(--pdfoid-text)] text-[var(--pdfoid-surface)]'
                  : 'bg-[var(--pdfoid-surface-2)] text-[var(--pdfoid-muted)] hover:text-[var(--pdfoid-text)]'
                  }`}
              >
                {getTypeLabel(type)}
                <span className="tabular-nums opacity-60">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center flex-1 px-6 py-10 text-center animate-fade-in-up">
          <div className="w-10 h-10 mb-3 rounded-xl bg-[var(--pdfoid-surface-2)] text-[var(--pdfoid-muted)] flex items-center justify-center" aria-hidden="true">
            <PencilSimple size={20} />
          </div>
          <h3 className="text-sm font-semibold text-[var(--pdfoid-text)] mb-1">No annotations yet</h3>
          <p className="text-sm text-[var(--pdfoid-muted)] max-w-[200px]">
            Pick a tool above and mark up page {currentPage}.
          </p>
        </div>
      ) : (
        <div
          className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-2 space-y-0.5"
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
              setVisibleCount(prev => {
                if (prev >= filteredAnnotations.length) return prev;
                return Math.min(prev + 20, filteredAnnotations.length + 20);
              });
            }
          }}
        >
          {filteredAnnotations.length === 0 ? (
            <div className="text-center py-8 text-[var(--pdfoid-muted)] text-sm">
              No {getTypeLabel(filter).toLowerCase()} on this page
            </div>
          ) : (
            filteredAnnotations.slice(0, visibleCount).map((ann, index) => {
              const isSelected = selectedAnnotationId === ann.id;
              const color = ann.color || '#6366f1';
              return (
                <div
                  key={ann.id}
                  id={`annotation-item-${ann.id}`}
                  onClick={() => handleSelect(ann.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleSelect(ann.id)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-current={isSelected || undefined}
                  style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
                  className={`
                    group relative w-full flex items-center gap-3 pl-2 pr-10 py-2 rounded-lg cursor-pointer
                    transition-[background-color,opacity,transform] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]
                    animate-fade-in-up
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pdfoid-ring)]
                    ${deletingId === ann.id ? 'opacity-0 translate-x-2' : ''}
                    ${isSelected ? 'bg-[var(--pdfoid-accent-soft)]' : 'hover:bg-[var(--pdfoid-hover)]'}
                  `}
                >
                  <div
                    className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${color}1f`, color }}
                  >
                    {getAnnotationIcon(ann.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--pdfoid-text)] truncate leading-5">
                      {getAnnotationLabel(ann)}
                    </p>
                    <p className="text-xs text-[var(--pdfoid-muted)] truncate">
                      {ann.text && ann.type !== 'sticky-note' && ann.type !== 'text-box' ? `${ann.text} · ` : ''}
                      {formatTime(new Date(ann.createdAt))}
                    </p>
                  </div>

                  <button
                    onClick={(e) => handleDelete(e, ann.id)}
                    className="
                      absolute right-1.5 top-1/2 -translate-y-1/2
                      inline-flex items-center justify-center w-7 h-7 rounded-md
                      text-[var(--pdfoid-muted)] hover:text-[var(--pdfoid-danger)] hover:bg-[var(--pdfoid-danger-soft)]
                      opacity-0 group-hover:opacity-100 focus:opacity-100
                      transition-[opacity,color,background-color] duration-200
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pdfoid-ring)]
                    "
                    title="Delete annotation"
                    aria-label={`Delete ${getAnnotationLabel(ann)}`}
                  >
                    <Trash size={14} aria-hidden />
                  </button>
                </div>
              );
            })
          )}
          {visibleCount < filteredAnnotations.length && (
            <div className="text-center py-2 text-xs text-[var(--pdfoid-muted)]">
              Loading more…
            </div>
          )}
        </div>
      )}
    </div>
  );
};
