import React, { forwardRef, useRef } from 'react';
import { cn } from '@/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize    = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  ButtonVariant;
  size?:     ButtonSize;
  loading?:  boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size    = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      children,
      className,
      disabled,
      onClick,
      ...props
    },
    ref
  ) => {
    const btnRef = useRef<HTMLButtonElement | null>(null);

    // Ripple effect handler
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      const btn    = (ref as React.RefObject<HTMLButtonElement>)?.current ?? btnRef.current;
      if (!btn) return;

      // Create ripple element
      const ripple = document.createElement('span');
      const rect   = btn.getBoundingClientRect();
      const size   = Math.max(rect.width, rect.height) * 2;
      ripple.style.cssText = `
        position: absolute;
        border-radius: 50%;
        background: rgba(255,255,255,0.18);
        pointer-events: none;
        width: ${size}px;
        height: ${size}px;
        left: ${e.clientX - rect.left - size / 2}px;
        top: ${e.clientY - rect.top - size / 2}px;
        animation: ripple-burst 0.55s cubic-bezier(0.16,1,0.3,1) forwards;
      `;
      btn.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove());

      onClick?.(e);
    };

    const variantClass: Record<ButtonVariant, string> = {
      primary:   'btn-primary',
      secondary: 'btn-secondary',
      ghost:     'btn-ghost',
      danger:    'btn-danger',
    };

    const sizeClass: Record<ButtonSize, string> = {
      sm:   'btn-sm',
      md:   '',
      lg:   'btn-lg',
      icon: 'btn-icon',
    };

    return (
      <button
        ref={(node) => {
          btnRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node;
        }}
        className={cn('btn btn-ripple', variantClass[variant], sizeClass[size], className)}
        disabled={disabled || loading}
        onClick={handleClick}
        {...props}
      >
        {loading ? (
          <LoadingSpinner size={size === 'sm' ? 14 : 16} />
        ) : leftIcon}
        {children && <span>{children}</span>}
        {!loading && rightIcon}

        <style>{`
          @keyframes ripple-burst {
            to { transform: scale(1); opacity: 0; }
          }
        `}</style>
      </button>
    );
  }
);

Button.displayName = 'Button';

// ── Loading Spinner ───────────────────────────────────────────────────────────

export function LoadingSpinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cn('animate-spin', className)}
      aria-label="Cargando"
    >
      <circle
        className="opacity-20"
        cx="12" cy="12" r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-80"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
