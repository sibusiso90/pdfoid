/**
 * ToastContainer - Renders toast notifications from the UI store
 * Accessible, animated, and responsive
 */

import React from 'react';
import { useUIStore, Toast, ToastType } from '../store/uiStore';

const toastIcons: Record<ToastType, React.ReactNode> = {
  success: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

const toastStyles: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: {
    bg: 'bg-[var(--pdfoid-surface)]',
    border: 'border-[var(--pdfoid-border)]',
    icon: 'text-[var(--pdfoid-success)]',
  },
  error: {
    bg: 'bg-[var(--pdfoid-surface)]',
    border: 'border-[var(--pdfoid-border)]',
    icon: 'text-[var(--pdfoid-danger)]',
  },
  warning: {
    bg: 'bg-[var(--pdfoid-surface)]',
    border: 'border-[var(--pdfoid-border)]',
    icon: 'text-amber-500',
  },
  info: {
    bg: 'bg-[var(--pdfoid-surface)]',
    border: 'border-[var(--pdfoid-border)]',
    icon: 'text-[var(--pdfoid-accent)]',
  },
};

interface ToastItemProps {
  toast: Toast;
  onClose: () => void;
  index: number;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onClose, index }) => {
  const styles = toastStyles[toast.type];
  
  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      style={{ animationDelay: `${index * 50}ms` }}
      className={`
        ${styles.bg} ${styles.border}
        border rounded-xl shadow-[var(--pdfoid-shadow)]
        px-3 py-2.5 max-w-sm w-full
        animate-slide-in-right
      `}
    >
      <div className="flex items-start gap-2.5">
        {/* Icon */}
        <div className={`shrink-0 mt-px ${styles.icon}`}>
          {toastIcons[toast.type]}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--pdfoid-text)]">{toast.message}</p>
          {toast.description && (
            <p className="mt-1 text-xs text-[var(--pdfoid-muted)]">{toast.description}</p>
          )}
          {toast.action && (
            <button
              onClick={() => {
                toast.action?.onClick();
                onClose();
              }}
              className="mt-1 text-sm font-semibold text-[var(--pdfoid-accent)] hover:underline underline-offset-4 focus:outline-none focus-visible:underline"
            >
              {toast.action.label}
            </button>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="shrink-0 p-1 rounded-lg text-[var(--pdfoid-subtle)] hover:text-[var(--pdfoid-text)] hover:bg-[var(--pdfoid-hover)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--pdfoid-ring)]"
          aria-label="Dismiss notification"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const toasts = useUIStore((state) => state.toasts);
  const removeToast = useUIStore((state) => state.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-16 inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-50 flex flex-col items-center gap-2 sm:w-96"
      aria-label="Notifications"
    >
      {toasts.map((toast, index) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onClose={() => removeToast(toast.id)}
          index={index}
        />
      ))}
    </div>
  );
};

export default ToastContainer;
