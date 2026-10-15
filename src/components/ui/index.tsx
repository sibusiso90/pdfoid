/**
 * Reusable UI component library
 * Provides consistent, accessible components across the application
 */

import React, { forwardRef, ButtonHTMLAttributes, InputHTMLAttributes } from 'react';

/**
 * Button variants
 */
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'link';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-[var(--pdfoid-accent)] text-[var(--pdfoid-on-accent)] shadow-[0_1px_2px_rgba(24,24,27,0.12)] hover:bg-[var(--pdfoid-accent-hover)] active:bg-[var(--pdfoid-accent-active)]',
  secondary: 'bg-[var(--pdfoid-surface)] text-[var(--pdfoid-text)] border border-[var(--pdfoid-border-strong)] hover:bg-[var(--pdfoid-hover)] active:bg-[var(--pdfoid-pressed)]',
  danger: 'bg-transparent text-[var(--pdfoid-danger)] hover:bg-[var(--pdfoid-danger-soft)] active:bg-[var(--pdfoid-danger-soft)]',
  ghost: 'bg-transparent text-[var(--pdfoid-muted)] hover:bg-[var(--pdfoid-hover)] hover:text-[var(--pdfoid-text)] active:bg-[var(--pdfoid-pressed)]',
  link: 'bg-transparent text-[var(--pdfoid-accent)] underline-offset-4 hover:underline',
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-9 px-3 text-sm',
  lg: 'h-10 px-4 text-base',
};

const buttonBase = [
  'inline-flex items-center justify-center gap-2 font-semibold rounded-lg select-none',
  'transition-[background-color,color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]',
  'active:scale-[0.98]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pdfoid-ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--pdfoid-surface)]',
  'disabled:opacity-40 disabled:pointer-events-none',
].join(' ');

/**
 * Accessible button component with variants and loading state
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', isLoading, leftIcon, rightIcon, className = '', disabled, children, ...props }, ref) => {
    const isDisabled = disabled || isLoading;
    
    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`${buttonBase} ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`.trim()}
        {...props}
      >
        {isLoading ? (
          <Spinner size={size === 'sm' ? 'sm' : 'md'} />
        ) : leftIcon}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';

/**
 * Icon-only button with proper accessibility
 */
interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string; // Required for accessibility
  variant?: ButtonVariant;
  size?: ButtonSize;
  isActive?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, label, variant = 'ghost', size = 'md', isActive, className = '', ...props }, ref) => {
    const iconSizes: Record<ButtonSize, string> = {
      sm: 'w-8 h-8',
      md: 'w-9 h-9',
      lg: 'w-10 h-10',
    };
    
    return (
      <button
        ref={ref}
        aria-label={label}
        title={label}
        aria-pressed={isActive}
        className={`${buttonBase} px-0 ${isActive ? 'bg-[var(--pdfoid-accent-soft)] text-[var(--pdfoid-accent)]' : buttonVariants[variant]} ${iconSizes[size]} ${className}`.trim()}
        {...props}
      >
        {icon}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';

/**
 * Spinner for loading states
 */
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className = '' }) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };
  
  return (
    <svg
      className={`animate-spin ${sizes[size]} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      role="status"
      aria-label="Loading"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
};

/**
 * Range slider with accessibility
 */
interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  showValue?: boolean;
  formatValue?: (value: number) => string;
  /** Label, track and value on one row, for toolbars */
  inline?: boolean;
}

export const Slider = forwardRef<HTMLInputElement, SliderProps>(
  ({ label, value, min, max, step = 1, showValue = true, formatValue, inline = false, className = '', ...props }, ref) => {
    const displayValue = formatValue ? formatValue(value) : String(value);
    const input = (
      <input
        ref={ref}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        className={`range w-full ${className}`}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={displayValue}
        {...props}
      />
    );

    if (inline) {
      return (
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor={props.id} className="text-[var(--pdfoid-muted)] font-medium whitespace-nowrap">{label}</label>
          <div className="w-20 flex items-center">{input}</div>
          {showValue && (
            <span className="w-10 text-[var(--pdfoid-text)] font-medium tabular-nums" aria-live="polite">
              {displayValue}
            </span>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="flex justify-between items-center text-sm font-medium text-[var(--pdfoid-muted)]">
          <label htmlFor={props.id}>{label}</label>
          {showValue && (
            <span className="text-[var(--pdfoid-text)] tabular-nums" aria-live="polite">
              {displayValue}
            </span>
          )}
        </div>
        {input}
      </div>
    );
  }
);

Slider.displayName = 'Slider';

/**
 * Visual-only separator
 */
export const Divider: React.FC<{ className?: string; vertical?: boolean }> = ({ className = '', vertical = false }) =>
  vertical ? (
    <span className={`self-stretch w-px my-1.5 bg-[var(--pdfoid-border)] ${className}`} aria-hidden="true" />
  ) : (
    <hr className={`border-t border-[var(--pdfoid-border)] ${className}`} aria-hidden="true" />
  );

/**
 * Badge component for status/count indicators
 */
interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md';
}

const badgeVariants = {
  default: 'bg-[var(--pdfoid-surface-2)] text-[var(--pdfoid-muted)]',
  success: 'bg-[var(--pdfoid-surface-2)] text-[var(--pdfoid-success)]',
  warning: 'bg-[var(--pdfoid-surface-2)] text-amber-600',
  error: 'bg-[var(--pdfoid-danger-soft)] text-[var(--pdfoid-danger)]',
  info: 'bg-[var(--pdfoid-accent-soft)] text-[var(--pdfoid-accent)]',
};

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', size = 'sm' }) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';
  
  return (
    <span className={`inline-flex items-center rounded-md font-medium tabular-nums ${badgeVariants[variant]} ${sizeClasses}`}>
      {children}
    </span>
  );
};

/**
 * Toast notification component
 */
interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  onClose?: () => void;
}

const toastStyles = {
  success: 'bg-green-600',
  error: 'bg-red-600',
  info: 'bg-[var(--pdfoid-accent2)]',
  warning: 'bg-yellow-600',
};

export const Toast: React.FC<ToastProps> = ({ message, type = 'info', onClose }) => (
  <div
    role="alert"
    aria-live="assertive"
    className={`fixed bottom-4 left-1/2 -translate-x-1/2 ${toastStyles[type]} text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-3 z-50`}
  >
    <span className="text-sm font-semibold">{message}</span>
    {onClose && (
      <button
        onClick={onClose}
        className="text-xs uppercase tracking-wide bg-white/20 hover:bg-white/30 px-2 py-1 rounded"
        aria-label="Dismiss notification"
      >
        Dismiss
      </button>
    )}
  </div>
);

/**
 * Skip to main content link for keyboard navigation
 */
export const SkipLink: React.FC = () => (
  <a
    href="#main-content"
    className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-[var(--pdfoid-accent)] focus:text-[var(--pdfoid-on-accent)] focus:rounded-lg focus:outline-none"
  >
    Skip to main content
  </a>
);

/**
 * Visually hidden label for screen readers
 */
export const VisuallyHidden: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="sr-only">{children}</span>
);

/**
 * Card container component
 */
interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const cardPadding = {
  none: '',
  sm: 'p-2',
  md: 'p-4',
  lg: 'p-6',
};

export const Card: React.FC<CardProps> = ({ children, className = '', padding = 'md' }) => (
  <div className={`rounded-xl bg-[var(--pdfoid-surface)] ${cardPadding[padding]} ${className}`}>
    {children}
  </div>
);

/**
 * Empty state placeholder
 */
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center text-center px-4 py-8">
    {icon && (
      <div className="w-12 h-12 bg-[var(--pdfoid-surface-2)] rounded-xl flex items-center justify-center mb-4 text-[var(--pdfoid-muted)]">
        {icon}
      </div>
    )}
    <h3 className="text-sm font-semibold text-[var(--pdfoid-text)] mb-1">{title}</h3>
    {description && <p className="text-sm text-[var(--pdfoid-muted)] mb-4 max-w-xs">{description}</p>}
    {action}
  </div>
);

/**
 * Loading skeleton for content placeholders
 */
interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height,
  className = '',
  variant = 'rectangular',
}) => {
  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };
  
  return (
    <div
      className={`animate-pulse bg-[var(--pdfoid-surface-2)] ${variantClasses[variant]} ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
};
