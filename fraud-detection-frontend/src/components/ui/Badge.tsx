import React from 'react';
import { cn, riskClass, riskLabel } from '@/utils';
import type { RiskLevel } from '@/types/api.types';

// ── Badge ─────────────────────────────────────────────────────────────────────

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'outline' | 'gold' | 'brand';
}

export function Badge({ variant = 'default', className, children, ...props }: BadgeProps) {
  const variantClass = {
    default: 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border-[var(--border-subtle)]',
    outline: 'bg-transparent border-[var(--border-default)] text-[var(--text-muted)]',
    gold:    'bg-[rgba(201,162,39,0.15)] text-[var(--gold-light)] border-[rgba(201,162,39,0.3)] shadow-[var(--glow-gold)]',
    brand:   'bg-[rgba(26,86,219,0.15)] text-[var(--brand-light)] border-[var(--border-brand)] shadow-[var(--glow-brand)]',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center px-2.5 py-0.5 rounded-[var(--radius-pill)] border text-xs font-semibold uppercase tracking-widest',
        variantClass[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

// ── Risk Badge ────────────────────────────────────────────────────────────────

export interface RiskBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  level: RiskLevel;
  showDot?: boolean;
}

export function RiskBadge({ level, showDot = true, className, ...props }: RiskBadgeProps) {
  return (
    <span
      className={cn('risk-badge', riskClass(level), className)}
      {...props}
    >
      {showDot && <span className="dot" aria-hidden="true" />}
      {riskLabel(level)}
    </span>
  );
}
