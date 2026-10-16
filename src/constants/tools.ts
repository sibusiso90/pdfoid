import type { ToolType } from '../types/annotations'

export interface ToolInfo {
  id: ToolType
  label: string
  /** Single key that selects the tool (lower case). */
  shortcut: string
  description: string
  group: 'select' | 'markup' | 'draw' | 'insert' | 'protect'
}

/**
 * Every annotation tool, for toolbars and the keyboard-shortcut handler.
 * Shortcuts are unique; keep them in sync with KeyboardShortcutsHelp.
 */
export const TOOL_CATALOG: readonly ToolInfo[] = [
  { id: 'pointer', label: 'Select', shortcut: 'v', description: 'Select and move annotations', group: 'select' },
  { id: 'highlight', label: 'Highlight', shortcut: 'h', description: 'Highlight an area', group: 'markup' },
  { id: 'underline', label: 'Underline', shortcut: 'u', description: 'Underline text', group: 'markup' },
  { id: 'strikethrough', label: 'Strikethrough', shortcut: 'k', description: 'Strike through text', group: 'markup' },
  { id: 'pen', label: 'Pen', shortcut: 'd', description: 'Draw freehand', group: 'draw' },
  { id: 'rectangle', label: 'Rectangle', shortcut: 'r', description: 'Draw a rectangle', group: 'draw' },
  { id: 'ellipse', label: 'Ellipse', shortcut: 'o', description: 'Draw an ellipse or circle', group: 'draw' },
  { id: 'arrow', label: 'Arrow', shortcut: 'a', description: 'Draw an arrow', group: 'draw' },
  { id: 'text-box', label: 'Text', shortcut: 't', description: 'Add text', group: 'insert' },
  { id: 'sticky-note', label: 'Note', shortcut: 'n', description: 'Add a sticky note', group: 'insert' },
  { id: 'stamp', label: 'Stamp', shortcut: 'p', description: 'Stamp APPROVED, DRAFT, …', group: 'insert' },
  { id: 'signature', label: 'Sign', shortcut: 's', description: 'Place your signature', group: 'insert' },
  { id: 'redaction', label: 'Redact', shortcut: 'x', description: 'Permanently remove content on export', group: 'protect' },
  { id: 'eraser', label: 'Eraser', shortcut: 'e', description: 'Erase annotations', group: 'select' },
]

export const TOOL_BY_SHORTCUT: Readonly<Record<string, ToolType>> = Object.fromEntries(
  TOOL_CATALOG.map((tool) => [tool.shortcut, tool.id])
)
