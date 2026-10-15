import React, { useCallback, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  ArrowUpRight,
  Circle,
  Cursor,
  Eraser,
  EyeSlash,
  Highlighter,
  NoteBlank,
  PencilSimple,
  Signature,
  Square,
  Stamp,
  TextStrikethrough,
  TextT,
  TextUnderline,
} from '@phosphor-icons/react';
import { useAnnotationStore } from '../store/annotationStore';
import { ToolType } from '../types/annotations';
import { TOOL_CATALOG } from '../constants/tools';

const iconProps = { size: 20, weight: 'regular' as const, 'aria-hidden': true };

const toolIcons: Record<ToolType, React.ReactNode> = {
  pointer: <Cursor {...iconProps} />,
  highlight: <Highlighter {...iconProps} />,
  underline: <TextUnderline {...iconProps} />,
  strikethrough: <TextStrikethrough {...iconProps} />,
  pen: <PencilSimple {...iconProps} />,
  rectangle: <Square {...iconProps} />,
  ellipse: <Circle {...iconProps} />,
  arrow: <ArrowUpRight {...iconProps} />,
  'text-box': <TextT {...iconProps} />,
  'sticky-note': <NoteBlank {...iconProps} />,
  stamp: <Stamp {...iconProps} />,
  signature: <Signature {...iconProps} />,
  redaction: <EyeSlash {...iconProps} />,
  eraser: <Eraser {...iconProps} />,
};

// Group order in the strip; eraser sits with select tools in the catalog but reads best last
const tools = [
  ...TOOL_CATALOG.filter((t) => t.id !== 'eraser'),
  ...TOOL_CATALOG.filter((t) => t.id === 'eraser'),
];

/**
 * Annotation tool strip.
 * Sits in the app bar on desktop and docks to the bottom edge on small screens.
 */
export function ToolBar() {
  const { selectedTool, selectTool } = useAnnotationStore(
    useShallow((state) => ({
      selectedTool: state.selectedTool,
      selectTool: state.selectTool,
    }))
  );

  const toolbarRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const currentIndex = tools.findIndex((t) => t.id === selectedTool);
    let newIndex = currentIndex;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      newIndex = (currentIndex + 1) % tools.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      newIndex = (currentIndex - 1 + tools.length) % tools.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      newIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      newIndex = tools.length - 1;
    }

    if (newIndex !== currentIndex) {
      selectTool(tools[newIndex].id);
      const buttons = toolbarRef.current?.querySelectorAll('button[data-tool]');
      (buttons?.[newIndex] as HTMLButtonElement)?.focus();
    }
  }, [selectedTool, selectTool]);

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label="Annotation tools"
      aria-orientation="horizontal"
      onKeyDown={handleKeyDown}
      className="
        fixed inset-x-0 bottom-0 z-30 safe-bottom
        border-t border-[var(--pdfoid-border)] bg-[var(--pdfoid-surface)]
        md:static md:z-auto md:border-0 md:bg-transparent
      "
    >
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none px-2 py-1.5 md:p-1 md:rounded-xl md:bg-[var(--pdfoid-surface-2)]">
        {tools.map((tool, index) => {
          const isSelected = selectedTool === tool.id;
          const shortcut = tool.shortcut.toUpperCase();
          const startsGroup = index > 0 && tools[index - 1].group !== tool.group;
          return (
            <React.Fragment key={tool.id}>
            {startsGroup && <span className="shrink-0 self-stretch w-px my-1.5 mx-0.5 bg-[var(--pdfoid-border-strong)]" aria-hidden="true" />}
            <button
              type="button"
              data-tool={tool.id}
              onClick={() => selectTool(tool.id)}
              className={`
                group relative shrink-0 flex flex-col md:flex-row items-center justify-center gap-0.5
                h-11 w-11 md:flex-none md:h-8 md:w-9 md:min-w-0 rounded-lg
                text-xs font-medium
                transition-[background-color,color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]
                active:scale-[0.96]
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pdfoid-ring)]
                ${isSelected
                  ? 'bg-[var(--pdfoid-surface)] text-[var(--pdfoid-accent)] shadow-[0_1px_2px_rgba(24,24,27,0.10),0_0_0_1px_var(--pdfoid-border)]'
                  : 'text-[var(--pdfoid-muted)] hover:text-[var(--pdfoid-text)] hover:bg-[var(--pdfoid-hover)]'}
              `}
              title={`${tool.label} (${shortcut})`}
              aria-label={`${tool.label} tool. Press ${shortcut} for shortcut. ${tool.description}`}
              aria-pressed={isSelected}
              aria-keyshortcuts={shortcut}
              tabIndex={isSelected ? 0 : -1}
            >
              {toolIcons[tool.id]}
              
              {/* Desktop tooltip */}
              <span
                className="
                  pointer-events-none absolute top-full mt-2 left-1/2 -translate-x-1/2 z-40 hidden md:flex
                  items-center gap-2 whitespace-nowrap rounded-md bg-[var(--pdfoid-text)] px-2 py-1
                  text-xs font-medium text-[var(--pdfoid-surface)]
                  opacity-0 translate-y-[-2px] transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]
                  group-hover:opacity-100 group-hover:translate-y-0 group-hover:delay-300
                "
                aria-hidden="true"
              >
                {tool.label}
                <kbd className="font-sans text-[var(--pdfoid-subtle)]">{shortcut}</kbd>
              </span>
            </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
