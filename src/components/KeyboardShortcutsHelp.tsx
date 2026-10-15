/**
 * KeyboardShortcutsHelp - Modal showing all available keyboard shortcuts
 * Accessible and organized by category
 */

import React, { useEffect, useRef } from 'react';
import { TOOL_CATALOG } from '../constants/tools';
import { useUIStore } from '../store/uiStore';

interface ShortcutItem {
  keys: string[];
  description: string;
}

interface ShortcutCategory {
  title: string;
  shortcuts: ShortcutItem[];
}

const shortcutCategories: ShortcutCategory[] = [
  {
    title: 'Tools',
    shortcuts: [
      ...TOOL_CATALOG.map((tool) => ({ keys: [tool.shortcut.toUpperCase()], description: `${tool.label} tool` })),
    ],
  },
  {
    title: 'Actions',
    shortcuts: [
      { keys: ['Ctrl', 'Z'], description: 'Undo' },
      { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo' },
      { keys: ['Ctrl', 'Y'], description: 'Redo (alternate)' },
      { keys: ['Ctrl', 'Alt', 'Z'], description: 'Undo page or document change' },
      { keys: ['Ctrl', 'Alt', 'Shift', 'Z'], description: 'Redo page or document change' },
      { keys: ['Delete'], description: 'Delete selected annotation' },
      { keys: ['Backspace'], description: 'Delete selected annotation' },
      { keys: ['Escape'], description: 'Cancel / Deselect' },
    ],
  },
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['↑', '↓'], description: 'Navigate tools' },
      { keys: ['Tab'], description: 'Focus next element' },
      { keys: ['Shift', 'Tab'], description: 'Focus previous element' },
      { keys: ['?'], description: 'Show keyboard shortcuts' },
    ],
  },
];

const KeyboardKey: React.FC<{ children: string }> = ({ children }) => (
  <kbd className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 bg-[var(--pdfoid-surface-2)] border border-[var(--pdfoid-border-strong)] rounded-md text-xs font-sans font-medium tabular-nums text-[var(--pdfoid-text)] ">
    {children}
  </kbd>
);

export const KeyboardShortcutsHelp: React.FC = () => {
  const showShortcutsHelp = useUIStore((state) => state.showShortcutsHelp);
  const toggleShortcutsHelp = useUIStore((state) => state.toggleShortcutsHelp);
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showShortcutsHelp) {
        toggleShortcutsHelp();
      }
      // Open with '?' key (when not in input)
      if (e.key === '?' && !showShortcutsHelp) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
          e.preventDefault();
          toggleShortcutsHelp();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showShortcutsHelp, toggleShortcutsHelp]);

  // Focus trap and initial focus
  useEffect(() => {
    if (showShortcutsHelp && modalRef.current) {
      const closeButton = modalRef.current.querySelector('button');
      closeButton?.focus();
    }
  }, [showShortcutsHelp]);

  if (!showShortcutsHelp) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 animate-fade-in z-50 animate-fade-in-up"
        onClick={toggleShortcutsHelp}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg max-h-[85vh] bg-[var(--pdfoid-surface)] rounded-2xl shadow-[var(--pdfoid-shadow)] border border-[var(--pdfoid-border)] animate-scale-in overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--pdfoid-border)] ">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--pdfoid-accent-soft)] flex items-center justify-center">
              <svg className="w-5 h-5 text-[var(--pdfoid-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <h2 id="shortcuts-title" className="text-lg font-semibold text-[var(--pdfoid-text)]">
                Keyboard Shortcuts
              </h2>
              <p className="text-xs text-[var(--pdfoid-muted)]">Speed up your workflow</p>
            </div>
          </div>
          <button
            onClick={toggleShortcutsHelp}
            className="p-2 rounded-lg text-[var(--pdfoid-subtle)] hover:text-[var(--pdfoid-text)] hover:bg-[var(--pdfoid-hover)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--pdfoid-ring)]"
            aria-label="Close keyboard shortcuts"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto max-h-[60vh] space-y-6">
          {shortcutCategories.map((category) => (
            <div key={category.title}>
              <h3 className="text-xs font-semibold text-[var(--pdfoid-muted)] mb-2">
                {category.title}
              </h3>
              <div className="space-y-2">
                {category.shortcuts.map((shortcut, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-[var(--pdfoid-hover)] transition-colors"
                  >
                    <span className="text-sm text-[var(--pdfoid-text)]">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIdx) => (
                        <React.Fragment key={keyIdx}>
                          <KeyboardKey>{key}</KeyboardKey>
                          {keyIdx < shortcut.keys.length - 1 && (
                            <span className="text-[var(--pdfoid-subtle)] text-xs">+</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[var(--pdfoid-border)] bg-[var(--pdfoid-surface-2)] text-center">
          <p className="text-xs text-[var(--pdfoid-muted)]">
            Press <KeyboardKey>?</KeyboardKey> anytime to show this help
          </p>
        </div>
      </div>
    </>
  );
};

export default KeyboardShortcutsHelp;
