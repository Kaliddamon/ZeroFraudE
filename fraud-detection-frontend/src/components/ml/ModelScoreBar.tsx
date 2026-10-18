import React from 'react';

interface ModelScoreBarProps {
  score: number; // 0.00 to 1.00
  threshold?: number; // default 0.0812 (from LightGBM test metrics)
  showLabel?: boolean;
  className?: string;
}

export function ModelScoreBar({
  score,
  threshold = 0.0812,
  showLabel = true,
  className = '',
}: ModelScoreBarProps) {
  const clampedScore = Math.max(0, Math.min(1, score));
  const percent = clampedScore * 100;
  const thresholdPercent = threshold * 100;

  // Color selection based on severity
  const getScoreColor = () => {
    if (clampedScore < threshold) {
      return {
        text: 'text-emerald-400',
        bar: 'bg-emerald-500',
        glow: 'rgba(16, 185, 129, 0.2)',
      };
    }
    if (clampedScore < 0.40) {
      return {
        text: 'text-amber-400',
        bar: 'bg-amber-500',
        glow: 'rgba(245, 158, 11, 0.2)',
      };
    }
    if (clampedScore < 0.70) {
      return {
        text: 'text-orange-400',
        bar: 'bg-orange-500',
        glow: 'rgba(234, 88, 12, 0.25)',
      };
    }
    return {
      text: 'text-red-400',
      bar: 'bg-red-500',
      glow: 'rgba(220, 38, 38, 0.35)',
    };
  };

  const style = getScoreColor();

  return (
    <div className={`flex flex-col gap-1 min-w-[120px] ${className}`}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-[#8A929B] text-[10px] uppercase tracking-wider">Score</span>
          <span className={`font-semibold ${style.text}`}>
            {clampedScore.toFixed(2)}
          </span>
        </div>
      )}

      {/* Progress container with threshold tick */}
      <div className="relative w-full h-1.5 bg-[#1F2328] rounded-full overflow-hidden">
        {/* Fill */}
        <div
          className={`h-full transition-all duration-300 rounded-full ${style.bar}`}
          style={{
            width: `${percent}%`,
            boxShadow: `0 0 8px ${style.glow}`,
          }}
        />

        {/* Threshold indicator line */}
        <div
          className="absolute top-0 bottom-0 w-[1.5px] bg-[#9CA3AF] opacity-80 z-10 pointer-events-none"
          style={{ left: `${thresholdPercent}%` }}
          title={`Umbral operativo θ = ${threshold.toFixed(4)}`}
        />
      </div>
    </div>
  );
}
