import React, { forwardRef, useId } from 'react';
import { cn } from '@/utils';

// ── Input Floating Label ──────────────────────────────────────────────────────

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label:        string;
  error?:       string;
  leftIcon?:    React.ReactNode;
  hint?:          string;
  rightElement?:  React.ReactNode;
  labelPosition?: 'floating' | 'top';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, leftIcon, hint, rightElement, className, id, placeholder, required, labelPosition = 'floating', ...props }, ref) => {
    const uid = useId();
    const inputId = id ?? uid;
    const isFloating = labelPosition === 'floating';
    const placeholderText = placeholder ?? (isFloating ? label : '');

    return (
      <div className="flex flex-col gap-1.5">
        {!isFloating && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-1"
          >
            {label}
            {required && (
              <span className="text-[var(--risk-high)]" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}

        <div className={cn('input-group', (leftIcon || rightElement) && 'relative')}>
          {leftIcon && (
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none z-10 transition-colors duration-200">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'input-field peer',
              !isFloating && 'input-static',
              leftIcon ? 'pl-10 pr-4' : 'px-4',
              rightElement && 'pr-10',
              error && 'border-[var(--risk-high)] focus:border-[var(--risk-high)] focus:shadow-none',
              className
            )}
            placeholder={placeholderText || (isFloating ? ' ' : (placeholder ?? ''))}
            required={required}
            aria-required={required}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            {...props}
          />
          {isFloating && (
            <label htmlFor={inputId} className={cn('input-label', leftIcon && 'left-10')}>
              {label}
              {required && (
                <span className="ml-0.5 text-[var(--risk-high)]" aria-hidden="true">
                  *
                </span>
              )}
            </label>
          )}

          {rightElement && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex items-center">
              {rightElement}
            </span>
          )}

          {/* Border glow bottom line */}
          <span
            className="absolute bottom-0 left-0 h-[2px] w-full origin-left scale-x-0 rounded-full bg-[var(--brand)] transition-transform duration-300 peer-focus:scale-x-100"
            aria-hidden
          />
        </div>

        {error && (
          <p
            id={`${inputId}-error`}
            role="alert"
            aria-live="assertive"
            className="flex items-center gap-1.5 text-xs text-[var(--risk-high)] font-medium animate-[slide-in-up_0.2s_ease_both]"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            {error}
          </p>
        )}

        {hint && !error && (
          <p id={`${inputId}-hint`} className="text-xs text-[var(--text-muted)]">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

// ── Select ─────────────────────────────────────────────────────────────────────

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label:    string;
  options:  Array<{ value: string; label: string }>;
  error?:   string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, error, className, id, ...props }, ref) => {
    const uid = useId();
    const selectId = id ?? uid;

    return (
      <div className="flex flex-col gap-1.5">
        <div className="input-group">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              'input-field appearance-none pr-8 cursor-pointer',
              error && 'border-[var(--risk-high)]',
              className
            )}
            aria-invalid={!!error}
            {...props}
          >
            {options.map(opt => (
              <option key={opt.value} value={opt.value} className="bg-[var(--bg-elevated)]">
                {opt.label}
              </option>
            ))}
          </select>
          <label htmlFor={selectId} className="input-label">
            {label}
          </label>
          {/* Custom caret */}
          <svg
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden
          >
            <path d="M7 10l5 5 5-5H7z"/>
          </svg>
        </div>
        {error && (
          <p className="text-xs text-[var(--risk-high)] font-medium">{error}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
