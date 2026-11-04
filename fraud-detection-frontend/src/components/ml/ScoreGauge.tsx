import React from 'react';
import type { RiskLevel } from '@/types/api.types';

interface ScoreGaugeProps {
  score: number; // 0–1
  riskLevel: RiskLevel;
  size?: number;
}

export function ScoreGauge({ score, riskLevel, size = 180 }: ScoreGaugeProps) {
  // Asegurar rango [0, 1]
  const clampedScore = Math.max(0, Math.min(1, Number.isFinite(score) ? score : 0));
  const percentage = Math.round(clampedScore * 100);

  // Parámetros geométricos para un semicírculo (180 grados)
  const strokeWidth = 14;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = Math.PI * radius; // Longitud del arco semicircular
  const strokeDashoffset = circumference - clampedScore * circumference;

  // Colores institucionales de ZeroFraudE
  const getColor = (level: RiskLevel): { stroke: string; text: string; bg: string } => {
    switch (level) {
      case 'CRITICAL':
        return { stroke: '#EF4444', text: 'text-red-400', bg: 'bg-red-500/10' };
      case 'HIGH':
        return { stroke: '#F59E0B', text: 'text-amber-400', bg: 'bg-amber-500/10' };
      case 'MEDIUM':
        return { stroke: '#EAB308', text: 'text-yellow-400', bg: 'bg-yellow-500/10' };
      case 'LOW':
      default:
        return { stroke: '#10B981', text: 'text-emerald-400', bg: 'bg-emerald-500/10' };
    }
  };

  const colors = getColor(riskLevel);

  // Centro y dimensiones
  const width = size;
  const height = size / 2 + strokeWidth + 10;
  const cy = size / 2;

  return (
    <div
      className="flex flex-col items-center justify-center relative select-none"
      role="meter"
      aria-label="Puntuación consolidada de riesgo"
      aria-valuenow={percentage}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${percentage}% de riesgo (${riskLevel})`}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        {/* Arco de fondo */}
        <path
          d={`M ${strokeWidth} ${cy} A ${radius} ${radius} 0 0 1 ${width - strokeWidth} ${cy}`}
          fill="none"
          stroke="#23272B"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Arco de progreso */}
        <path
          d={`M ${strokeWidth} ${cy} A ${radius} ${radius} 0 0 1 ${width - strokeWidth} ${cy}`}
          fill="none"
          stroke={colors.stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>

      {/* Valores centrados en el gauge */}
      <div className="absolute top-[40%] flex flex-col items-center justify-center text-center">
        <span className="font-mono text-3xl font-extrabold tracking-tight text-[#F3F4F6]">
          {percentage}%
        </span>
        <span className="text-[10px] font-mono uppercase tracking-wider text-[#8A929B] mt-0.5">
          Score Consolidado
        </span>
      </div>
    </div>
  );
}
