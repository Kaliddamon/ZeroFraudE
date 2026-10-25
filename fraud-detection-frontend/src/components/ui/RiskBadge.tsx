import React from 'react';
import { ShieldCheck, AlertTriangle, AlertCircle, ShieldAlert, HelpCircle } from 'lucide-react';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

interface RiskBadgeProps {
  level: RiskLevel | string | null | undefined;
  className?: string;
}

const riskConfig: Record<string, { color: string; dotColor: string; icon: React.ElementType; label: string }> = {
  LOW: {
    color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
    dotColor: 'bg-emerald-400',
    icon: ShieldCheck,
    label: 'Riesgo Bajo',
  },
  MEDIUM: {
    color: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
    dotColor: 'bg-amber-400',
    icon: AlertTriangle,
    label: 'Riesgo Medio',
  },
  HIGH: {
    color: 'bg-orange-500/10 text-orange-400 border-orange-500/25',
    dotColor: 'bg-orange-400',
    icon: AlertCircle,
    label: 'Riesgo Alto',
  },
  CRITICAL: {
    color: 'bg-red-500/15 text-red-400 border-red-500/35 shadow-[0_0_10px_rgba(220,38,38,0.25)]',
    dotColor: 'bg-red-400 animate-pulse',
    icon: ShieldAlert,
    label: 'Riesgo Crítico',
  },
  // Fallback for null / undefined / unknown values from backend
  UNKNOWN: {
    color: 'bg-zinc-800/60 text-zinc-400 border-zinc-700/40',
    dotColor: 'bg-zinc-500',
    icon: HelpCircle,
    label: 'Sin análisis',
  },
};

export const RiskBadge: React.FC<RiskBadgeProps> = ({ level, className = '' }) => {
  // Normalise: uppercase, and fall back to UNKNOWN if the value is missing or unrecognised
  const key = level ? String(level).toUpperCase() : 'UNKNOWN';
  const config = riskConfig[key] ?? riskConfig.UNKNOWN;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium border ${config.color} ${className}`}
      role="status"
      aria-label={`Nivel de riesgo: ${config.label}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      {config.label}
    </span>
  );
};

export const RiskBadgeSkeleton: React.FC = () => {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-gray-200 text-transparent border-gray-200 animate-pulse">
      <div className="w-3.5 h-3.5 bg-gray-300 rounded-full" />
      Cargando...
    </span>
  );
};
