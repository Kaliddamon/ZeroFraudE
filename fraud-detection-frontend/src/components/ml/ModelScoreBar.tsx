import React from 'react';
import type { RiskLevel } from '@/types/api.types';

interface ModelScoreBarProps {
  score: number; // 0.00 to 1.00
  riskLevel?: RiskLevel;
  label?: string;
  showLabel?: boolean;
  className?: string;
}

// Colores derivados exclusivamente del nivel de riesgo autoritativo del backend.
// No se infieren a partir del score mediante umbrales locales.
const riskLevelStyles: Record<RiskLevel | 'UNKNOWN', { text: string; bar: string }> = {
  LOW: { text: 'text-emerald-400', bar: 'bg-emerald-500' },
  MEDIUM: { text: 'text-amber-400', bar: 'bg-amber-500' },
  HIGH: { text: 'text-orange-400', bar: 'bg-orange-500' },
  CRITICAL: { text: 'text-red-400', bar: 'bg-red-500' },
  UNKNOWN: { text: 'text-zinc-400', bar: 'bg-zinc-500' },
};

export function ModelScoreBar({
  score,
  riskLevel,
  label = 'Score de Riesgo',
  showLabel = true,
  className = '',
}: ModelScoreBarProps) {
  const clampedScore = Math.max(0, Math.min(1, score));
  const percent = clampedScore * 100;

  // El color se obtiene del nivel de riesgo devuelto por el backend,
  // nunca de bandas numéricas calculadas en el frontend.
  const style = riskLevel ? riskLevelStyles[riskLevel] : riskLevelStyles.UNKNOWN;

  return (
    <div className={`flex flex-col gap-1 min-w-[120px] ${className}`}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-[#8A929B] text-[10px] uppercase tracking-wider">
            {label}
          </span>
          <span className={`font-semibold ${style.text}`}>
            {clampedScore.toFixed(2)}
          </span>
        </div>
      )}

      {/* Progress bar coloreada por nivel de riesgo, no por umbral numérico local */}
      <div className="relative w-full h-1.5 bg-[#1F2328] rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 rounded-full ${style.bar}`}
          style={{
            width: `${percent}%`,
          }}
        />
      </div>
    </div>
  );
}
