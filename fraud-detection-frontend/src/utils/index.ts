import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { RiskLevel } from '@/types/api.types';

/** Combina clases condicionales con deduplicación de Tailwind */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formatea moneda con separadores */
export function formatCurrency(
  amount: number,
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Formatea fecha ISO a display legible */
export function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('es-CO', {
    day:    '2-digit',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
    hour12: false,
    ...opts,
  }).format(new Date(iso));
}

/** Formatea un número 0-1 como porcentaje */
export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/** Formatea un score 0-1 como string con 2 decimales */
export function formatScore(value: number): string {
  return value.toFixed(2);
}

/** Formatea relativo al tiempo actual (hace N min/h) */
export function formatRelative(iso: string): string {
  const diffMs   = Date.now() - new Date(iso).getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1)  return 'hace unos segundos';
  if (diffMins < 60) return `hace ${diffMins} min`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24)  return `hace ${diffHrs} h`;
  return formatDate(iso, { day: '2-digit', month: 'short' });
}

/** Obtiene las clases CSS correspondientes al nivel de riesgo */
export function riskClass(level: RiskLevel): string {
  const map: Record<RiskLevel, string> = {
    LOW:      'risk-low',
    MEDIUM:   'risk-medium',
    HIGH:     'risk-high',
    CRITICAL: 'risk-critical',
  };
  return map[level];
}

/** Etiqueta en español para nivel de riesgo */
export function riskLabel(level: RiskLevel): string {
  const map: Record<RiskLevel, string> = {
    LOW:      'Bajo',
    MEDIUM:   'Medio',
    HIGH:     'Alto',
    CRITICAL: 'Crítico',
  };
  return map[level];
}

/** Trunca texto con ellipsis */
export function truncate(str: string, maxLen = 18): string {
  return str.length > maxLen ? `${str.slice(0, maxLen)}…` : str;
}
