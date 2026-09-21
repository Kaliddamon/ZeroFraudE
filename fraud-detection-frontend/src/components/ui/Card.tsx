import React from 'react';
import { cn } from '@/utils';

// ── Card ──────────────────────────────────────────────────────────────────────

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glass?: boolean;
}

export function Card({ className, glass = true, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        glass ? 'glass-card' : 'bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] shadow-[var(--shadow-card)]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ── Card Header ───────────────────────────────────────────────────────────────

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function CardHeader({ title, subtitle, action, className, ...props }: CardHeaderProps) {
  return (
    <div
      className={cn('flex items-center justify-between p-5 border-b border-[var(--border-subtle)]', className)}
      {...props}
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-title text-[var(--text-primary)] leading-none">{title}</h3>
        {subtitle && <p className="text-sm text-[var(--text-muted)]">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ── Card Content ──────────────────────────────────────────────────────────────

export function CardContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-5', className)} {...props}>
      {children}
    </div>
  );
}
