import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Calendar, AlertCircle } from 'lucide-react';

export interface TrendEntry {
  date: string;
  high: number;
  medium: number;
  low: number;
}

export interface RiskTrendAreaChartProps {
  data?: TrendEntry[];
  isLoading?: boolean;
}

interface AreaTooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    name: string;
    value: number;
    color: string;
  }>;
  label?: string;
}

const CustomAreaTooltip: React.FC<AreaTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  const lowVal = payload.find((p) => p.dataKey === 'low')?.value ?? 0;
  const suspiciousVal = payload.find((p) => p.dataKey === 'suspicious')?.value ?? 0;
  const dayTotal = lowVal + suspiciousVal;

  let formattedDate = label;
  try {
    if (label) {
      const [y, m, d] = label.split('-').map(Number);
      if (y && m && d) {
        const dateObj = new Date(Date.UTC(y, m - 1, d));
        formattedDate = dateObj.toLocaleDateString('es-CO', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          timeZone: 'UTC',
        });
      }
    }
  } catch {
    formattedDate = label;
  }

  return (
    <div
      role="tooltip"
      className="bg-[#191C20] border border-[#2D333B] rounded-lg p-3 shadow-xl text-xs font-mono space-y-1.5"
    >
      <div className="flex items-center gap-1.5 pb-1 border-b border-[#2D333B] text-[#F3F4F6] font-semibold">
        <Calendar className="w-3.5 h-3.5 text-cyan-400" />
        <span>{formattedDate}</span>
      </div>

      <div className="flex items-center justify-between gap-6 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-[#8A929B]">Legítimas:</span>
        </div>
        <span className="text-[#F3F4F6] font-bold">{lowVal.toLocaleString()}</span>
      </div>

      <div className="flex items-center justify-between gap-6 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-400" />
          <span className="text-[#8A929B]">Sospechosas / Fraude:</span>
        </div>
        <span className="text-red-400 font-bold">{suspiciousVal.toLocaleString()}</span>
      </div>

      <div className="pt-1 border-t border-[#2D333B] flex items-center justify-between gap-6 text-[10px] text-[#808893]">
        <span>Total día:</span>
        <span className="text-[#F3F4F6] font-semibold">{dayTotal.toLocaleString()}</span>
      </div>
    </div>
  );
};

export const RiskTrendAreaChart: React.FC<RiskTrendAreaChartProps> = ({
  data = [],
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div
        aria-label="Cargando gráfico temporal de 7 días"
        className="bg-[#141618] border border-[#23272B] rounded-xl p-5 shadow-sm animate-pulse flex flex-col justify-between h-full min-h-[340px]"
      >
        <div className="h-4 bg-[#23272B] rounded w-1/3 mb-4" />
        <div className="w-full h-56 bg-[#1F2328] rounded-lg" />
      </div>
    );
  }

  // Pre-process points: combine high + medium into "suspicious" for clean binary domain contrast
  const formattedData = data.map((d) => ({
    ...d,
    suspicious: (d.high || 0) + (d.medium || 0),
  }));

  const isEmpty = formattedData.length === 0;

  const formatXAxis = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const monthNum = parseInt(parts[1], 10);
        const dayNum = parseInt(parts[2], 10);
        const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        return `${dayNum} ${months[monthNum - 1] || ''}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  return (
    <div
      role="region"
      aria-label="Gráfico de tendencia temporal de 7 días"
      className="bg-[#141618] border border-[#23272B] rounded-xl p-5 shadow-sm flex flex-col justify-between h-full"
    >
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#1F2328]">
        <div>
          <h2 className="text-sm font-semibold tracking-wider text-[#F3F4F6] uppercase font-mono">
            Evolución Transaccional (7 Días)
          </h2>
          <p className="text-xs font-mono text-[#8A929B] mt-0.5">
            Volumen de transacciones legítimas vs. sospechosas/fraude
          </p>
        </div>
        <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1 rounded">
          Ventana 7D
        </span>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-[#8A929B] font-mono space-y-2">
          <AlertCircle className="w-8 h-8 text-[#3A4149]" />
          <p className="text-xs">No hay datos de tendencia temporal para este período</p>
        </div>
      ) : (
        <div className="w-full h-64 sm:h-72 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={formattedData}
              margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorLegit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorSuspicious" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF4444" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#23272B" vertical={false} />

              <XAxis
                dataKey="date"
                tickFormatter={formatXAxis}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#8A929B', fontSize: 11, fontFamily: 'monospace' }}
              />

              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#8A929B', fontSize: 11, fontFamily: 'monospace' }}
                allowDecimals={false}
              />

              <Tooltip content={<CustomAreaTooltip />} />

              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: '12px', fontSize: '11px', fontFamily: 'monospace' }}
                formatter={(value: string) => (
                  <span className="text-[#D1D5DB] text-xs font-mono ml-1">{value}</span>
                )}
              />

              <Area
                type="monotone"
                dataKey="low"
                name="Legítimas"
                stroke="#10B981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorLegit)"
              />

              <Area
                type="monotone"
                dataKey="suspicious"
                name="Sospechosas / Fraude"
                stroke="#EF4444"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorSuspicious)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

