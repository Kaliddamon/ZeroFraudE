import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { AlertCircle } from 'lucide-react';

export interface RiskDonutChartProps {
  distribution?: Record<string, number>;
  totalTransactions?: number;
  isLoading?: boolean;
}

const RISK_CONFIG: Record<string, { label: string; color: string; order: number }> = {
  CRITICAL: { label: 'Riesgo Crítico', color: '#DC2626', order: 1 },
  HIGH:     { label: 'Riesgo Alto',    color: '#EA580C', order: 2 },
  MEDIUM:   { label: 'Riesgo Medio',   color: '#F59E0B', order: 3 },
  LOW:      { label: 'Riesgo Bajo',    color: '#10B981', order: 4 },
};

interface TooltipPayloadItem {
  payload: {
    name: string;
    value: number;
    percentage: number;
    color: string;
    level: string;
  };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}

const DonutTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0].payload;
  return (
    <div
      role="tooltip"
      className="bg-[#191C20] border border-[#2D333B] rounded-lg px-3 py-2 shadow-xl text-xs font-mono"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
        <span className="text-[#F3F4F6] font-semibold">{item.name}</span>
      </div>
      <div className="flex items-baseline justify-between gap-4 text-[11px] text-[#8A929B]">
        <span>Transacciones:</span>
        <span className="text-[#F3F4F6] font-bold">{item.value.toLocaleString()}</span>
      </div>
      <div className="flex items-baseline justify-between gap-4 text-[11px] text-[#8A929B]">
        <span>Porcentaje:</span>
        <span className="text-cyan-400 font-bold">{item.percentage.toFixed(1)}%</span>
      </div>
    </div>
  );
};

export const RiskDonutChart: React.FC<RiskDonutChartProps> = ({
  distribution = {},
  totalTransactions,
  isLoading = false,
}) => {
  const calculatedTotal = Object.values(distribution).reduce((acc, curr) => acc + (curr || 0), 0);
  const total = totalTransactions ?? calculatedTotal;

  if (isLoading) {
    return (
      <div
        aria-label="Cargando distribución de riesgo"
        className="bg-[#141618] border border-[#23272B] rounded-xl p-5 shadow-sm animate-pulse flex flex-col justify-between h-full min-h-[340px]"
      >
        <div className="h-4 bg-[#23272B] rounded w-1/3 mb-4" />
        <div className="w-36 h-36 rounded-full bg-[#1F2328] mx-auto border-4 border-[#23272B]" />
        <div className="space-y-2 mt-4">
          <div className="h-3 bg-[#1F2328] rounded w-full" />
          <div className="h-3 bg-[#1F2328] rounded w-5/6" />
        </div>
      </div>
    );
  }

  const rawEntries = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((level) => {
    const config = RISK_CONFIG[level];
    const value = distribution[level] || 0;
    const percentage = total > 0 ? (value / total) * 100 : 0;
    return {
      level,
      name: config.label,
      value,
      percentage,
      color: config.color,
    };
  });

  // Filter non-zero items for PieChart rendering to prevent overlapping 0deg slices
  const chartData = rawEntries.filter((item) => item.value > 0);
  const isEmpty = total === 0 || chartData.length === 0;

  return (
    <div
      role="region"
      aria-label="Gráfico de distribución de riesgo"
      className="bg-[#141618] border border-[#23272B] rounded-xl p-5 shadow-sm flex flex-col justify-between h-full"
    >
      <div className="flex items-center justify-between mb-2 pb-3 border-b border-[#1F2328]">
        <div>
          <h2 className="text-xs font-semibold tracking-wider text-[#F3F4F6] uppercase font-mono">
            Distribución de Riesgo
          </h2>
          <p className="text-[10px] font-mono text-[#8A929B] mt-0.5">
            Clasificación por severidad del modelo ML
          </p>
        </div>
        <span className="text-[11px] font-mono font-semibold text-[#C778DD] bg-[#1F2328] px-2.5 py-1 rounded-md border border-[#2D333B]">
          {total.toLocaleString()} evaluadas
        </span>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-[#8A929B] font-mono space-y-2">
          <AlertCircle className="w-8 h-8 text-[#3A4149]" />
          <p className="text-xs">Sin transacciones en el período evaluado</p>
        </div>
      ) : (
        <>
          {/* Donut Container with Center Label */}
          <div className="relative w-full h-48 my-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  isAnimationActive={true}
                  animationDuration={600}
                >
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.level}
                      fill={entry.color}
                      stroke="#141618"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip content={<DonutTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            {/* Inner Donut Center Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] font-mono text-[#8A929B] uppercase">Total</span>
              <span className="text-sm font-bold font-mono text-[#F3F4F6]">
                {total.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Interactive Structured Legend */}
          <div className="space-y-2 mt-2 pt-3 border-t border-[#1F2328]">
            {rawEntries.map((item) => (
              <div
                key={item.level}
                className="flex items-center justify-between text-xs font-mono"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-[#D1D5DB] text-[11px]">{item.name}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] text-[#8A929B]">
                    {item.percentage.toFixed(1)}%
                  </span>
                  <span className="text-[11px] font-semibold text-[#F3F4F6] min-w-[36px] text-right">
                    {item.value.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

