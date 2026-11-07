import React from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Sliders, ShieldAlert } from 'lucide-react';

interface ScatterPoint {
  id: string;
  amount: number;
  riskScore: number;
  user: string;
  country: string;
  riskLevel: string;
}

const riskLevelColors: Record<string, string> = {
  LOW: '#10B981',
  MEDIUM: '#F59E0B',
  HIGH: '#EA580C',
  CRITICAL: '#DC2626',
  UNKNOWN: '#6B7280',
};

export function FraudScatterPlot() {
  // Muestras de demostración con riskLevel provisto por el backend (simulado).
  // Cada punto incluye su nivel de riesgo autoritativo.
  const points: ScatterPoint[] = [
    { id: 'TX-9401', amount: 4850.00, riskScore: 0.94, user: 'U00042', country: 'NG', riskLevel: 'CRITICAL' },
    { id: 'TX-9402', amount: 1250.50, riskScore: 0.72, user: 'U00118', country: 'CO', riskLevel: 'HIGH' },
    { id: 'TX-9403', amount: 320.00,  riskScore: 0.48, user: 'U00203', country: 'ES', riskLevel: 'MEDIUM' },
    { id: 'TX-9404', amount: 79.99,   riskScore: 0.04, user: 'U00315', country: 'US', riskLevel: 'LOW' },
    { id: 'TX-9405', amount: 540.25,  riskScore: 0.68, user: 'U00422', country: 'DE', riskLevel: 'HIGH' },
    { id: 'TX-9406', amount: 29.50,   riskScore: 0.02, user: 'U00087', country: 'US', riskLevel: 'LOW' },
    { id: 'TX-9407', amount: 2100.00, riskScore: 0.97, user: 'U00512', country: 'RU', riskLevel: 'CRITICAL' },
    { id: 'TX-9408', amount: 155.80,  riskScore: 0.06, user: 'U00338', country: 'FR', riskLevel: 'LOW' },
    { id: 'TX-9409', amount: 3200.00, riskScore: 0.89, user: 'U00991', country: 'BR', riskLevel: 'CRITICAL' },
    { id: 'TX-9410', amount: 45.00,   riskScore: 0.01, user: 'U00124', country: 'CA', riskLevel: 'LOW' },
    { id: 'TX-9411', amount: 890.00,  riskScore: 0.62, user: 'U00877', country: 'MX', riskLevel: 'HIGH' },
    { id: 'TX-9412', amount: 195.00,  riskScore: 0.22, user: 'U00543', country: 'GB', riskLevel: 'MEDIUM' },
    { id: 'TX-9413', amount: 4200.00, riskScore: 0.96, user: 'U00219', country: 'VN', riskLevel: 'CRITICAL' },
    { id: 'TX-9414', amount: 62.40,   riskScore: 0.03, user: 'U00762', country: 'US', riskLevel: 'LOW' },
    { id: 'TX-9415', amount: 780.00,  riskScore: 0.55, user: 'U00401', country: 'AR', riskLevel: 'MEDIUM' },
    { id: 'TX-9416', amount: 2890.00, riskScore: 0.91, user: 'U00331', country: 'ID', riskLevel: 'CRITICAL' },
    { id: 'TX-9417', amount: 110.00,  riskScore: 0.05, user: 'U00902', country: 'CL', riskLevel: 'LOW' },
    { id: 'TX-9418', amount: 1640.00, riskScore: 0.78, user: 'U00155', country: 'TR', riskLevel: 'HIGH' },
  ];

  const getPointColor = (riskLevel: string) => {
    return riskLevelColors[riskLevel] ?? riskLevelColors.UNKNOWN;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as ScatterPoint;
      return (
        <div className="bg-[#141618] border border-[#2D3239] rounded-lg p-3 shadow-xl text-xs font-mono">
          <div className="flex items-center justify-between gap-4 mb-2">
            <span className="font-bold text-[#F3F4F6]">{data.id}</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                data.riskLevel === 'CRITICAL' || data.riskLevel === 'HIGH'
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-emerald-500/20 text-emerald-400'
              }`}
            >
              {data.riskLevel}
            </span>
          </div>
          <div className="text-[#9CA3AF] space-y-1">
            <div>Monto: <span className="text-[#F3F4F6] font-semibold">${data.amount.toLocaleString()} USD</span></div>
            <div>Score de Riesgo: <span className="text-[#F3F4F6] font-semibold">{data.riskScore.toFixed(2)}</span></div>
            <div>Nivel: <span className="text-[#F3F4F6]">{data.riskLevel}</span></div>
            <div>Usuario: <span className="text-[#F3F4F6]">{data.user}</span> ({data.country})</div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-[#141618] border border-[#23272B] rounded-xl p-5 flex flex-col h-full shadow-sm">
      {/* Cabecera técnica */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-[#1F2328]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-wider text-[#F3F4F6] uppercase font-mono">
              Signal Scatter: Monto vs. Score de Riesgo
            </h2>
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20"
              title="Visualización de demostración: no proviene del backend"
            >
              Datos de demostración
            </span>
          </div>
          <p className="text-xs text-[#8A929B] mt-0.5 font-mono">
            Dispersión bidimensional. Los puntos se colorean por el nivel de riesgo del backend.
          </p>
        </div>

        {/* Control de filtro por score (no es un clasificador de riesgo) */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#1B1E22] px-3 py-1.5 rounded-lg border border-[#282E35]">
            <Sliders className="w-3.5 h-3.5 text-[#8A929B]" />
            <span className="text-[11px] font-mono text-[#8A929B]">Filtro Score:</span>
          </div>
          <button
            onClick={() => {}}
            className="px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium border bg-[#1B1E22] text-[#9CA3AF] border-[#282E35] hover:text-white"
            disabled
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Disponible con datos reales</span>
          </button>
        </div>
      </div>

      {/* Gráfico Scatter */}
      <div className="w-full h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#23272B" />
            <XAxis
              type="number"
              dataKey="amount"
              name="Monto"
              unit="$"
              stroke="#606770"
              tick={{ fill: '#808893', fontSize: 11, fontFamily: 'monospace' }}
              axisLine={{ stroke: '#2A3038' }}
              tickLine={{ stroke: '#2A3038' }}
            />
            <YAxis
              type="number"
              dataKey="riskScore"
              name="Score de Riesgo"
              domain={[0, 1]}
              stroke="#606770"
              tick={{ fill: '#808893', fontSize: 11, fontFamily: 'monospace' }}
              axisLine={{ stroke: '#2A3038' }}
              tickLine={{ stroke: '#2A3038' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Scatter name="Transacciones" data={points}>
              {points.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getPointColor(entry.riskLevel)}
                  opacity={0.85}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Leyenda técnica inferior: niveles de riesgo del backend */}
      <div className="pt-3 border-t border-[#1F2328] flex flex-wrap items-center justify-between text-xs font-mono text-[#808893] gap-2">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Bajo</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>Medio</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-orange-400" />
            <span>Alto</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span>Crítico</span>
          </span>
        </div>
        <div>
          <span>Muestras activas: <strong>{points.length}</strong></span>
        </div>
      </div>
    </div>
  );
}
