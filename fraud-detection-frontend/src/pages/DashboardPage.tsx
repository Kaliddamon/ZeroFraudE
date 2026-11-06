import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ShieldAlert,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  RotateCcw,
  Layers,
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/Button';
import { RiskBadge } from '@/components/ui/RiskBadge';
import { MetricCard, MetricCardSkeleton } from '@/components/ui/MetricCard';
import { RiskDonutChart } from '@/components/analytics/RiskDonutChart';
import { RiskTrendAreaChart } from '@/components/analytics/RiskTrendAreaChart';
import { apiClient } from '@/services/api/apiClient';
import type { DashboardStatistics } from '@/types/alert.types';
import type { TransactionSummary } from '@/types/transaction.types';
import { MLPipelineTelemetryBar } from '@/components/ml/MLPipelineTelemetryBar';
import { FraudScatterPlot } from '@/components/ml/FraudScatterPlot';
import { ModelScoreBar } from '@/components/ml/ModelScoreBar';
import { TransactionDetailDrawer } from '@/components/ml/TransactionDetailDrawer';

export function DashboardPage() {
  const [selectedTx, setSelectedTx] = useState<TransactionSummary | null>(null);
  const [showScatter, setShowScatter] = useState(false);

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await apiClient.get<DashboardStatistics>('/statistics/dashboard');
      return res.data;
    },
  });

  const {
    data: recentTransactions,
    isLoading: recentLoading,
  } = useQuery({
    queryKey: ['recent-transactions'],
    queryFn: async () => {
      const res = await apiClient.get<{ content: TransactionSummary[] }>('/transactions?page=0&size=6');
      return res.data.content;
    },
  });

  if (isLoading) {
    return (
      <div
        aria-label="Cargando panel de control"
        className="flex flex-col gap-6 max-w-7xl mx-auto w-full p-4"
      >
        <div className="h-10 bg-[#141618] border border-[#23272B] rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <MetricCardSkeleton key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 h-72 bg-[#141618] border border-[#23272B] rounded-xl animate-pulse" />
          <div className="h-72 bg-[#141618] border border-[#23272B] rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center p-12 text-center max-w-lg mx-auto space-y-4 font-mono"
      >
        <div className="p-3 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-base font-bold text-[#F3F4F6]">
          Error cargando métricas del dashboard
        </h2>
        <p className="text-xs text-[#8A929B]">
          No fue posible conectar con el servicio de estadísticas. Verifica que el backend esté
          disponible.
        </p>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1F2328] hover:bg-[#282E35] text-cyan-400 border border-[#30363D] text-xs font-semibold transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reintentar
        </button>
      </div>
    );
  }

  // ── Determine Economic KPI Value & Label ────────────────────────────────────
  const hasProtectedCapital = data.protectedCapital !== undefined && data.protectedCapital > 0;
  const financialTitle = hasProtectedCapital ? 'Capital Protegido' : 'Monto en Riesgo';
  const financialValue = hasProtectedCapital
    ? `$${Number(data.protectedCapital).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : data.amountAtRisk !== undefined
    ? `$${Number(data.amountAtRisk).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '$0.00';
  const financialSubtitle = hasProtectedCapital
    ? 'Fraudes confirmados y mitigados por analistas'
    : 'Capital interceptado en transacciones alto/crítico';

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
      {/* ── Franja de Telemetría del Pipeline ML ──────────────────────────────── */}
      <MLPipelineTelemetryBar />

      {/* ── Cuadrícula de KPIs Analíticos (Reutilizando MetricCard) ───────────── */}
      <section aria-labelledby="kpis-heading">
        <h2 id="kpis-heading" className="sr-only">
          Indicadores Principales de Rendimiento
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Volumen Evaluado */}
          <MetricCard
            title="Volumen Evaluado"
            value={data.analyzedTransactions.toLocaleString('en-US')}
            subtitle={
              data.totalTransactions > 0
                ? `Total registradas: ${data.totalTransactions.toLocaleString('en-US')}`
                : 'Inferencias procesadas'
            }
            icon={<TrendingUp className="w-5 h-5 text-blue-400" />}
            trend={{
              value: 100,
              isPositive: true,
              label: 'analizadas',
            }}
          />

          {/* KPI 2: Capital Protegido / Monto en Riesgo */}
          <MetricCard
            title={financialTitle}
            value={financialValue}
            subtitle={financialSubtitle}
            icon={<ShieldCheck className="w-5 h-5 text-emerald-400" />}
          />

          {/* KPI 3: Fraude Detectado */}
          <MetricCard
            title="Fraude Detectado"
            value={data.fraudDetected.toLocaleString('en-US')}
            subtitle={`Tasa observada: ${(Number(data.fraudRate || 0) * 100).toFixed(2)}%`}
            icon={<ShieldAlert className="w-5 h-5 text-red-400" />}
            trend={{
              value: Number((Number(data.fraudRate || 0) * 100).toFixed(1)),
              isPositive: false,
              label: 'tasa fraude',
            }}
          />

          {/* KPI 4: Alertas en Cola */}
          <MetricCard
            title="Alertas en Cola"
            value={data.openAlerts.toLocaleString('en-US')}
            subtitle={
              data.openAlerts === 0
                ? 'Cola de alertas al día'
                : 'Pendientes de resolución por analistas'
            }
            icon={<AlertTriangle className="w-5 h-5 text-amber-400" />}
          />
        </div>
      </section>

      {/* ── Gráficos Analíticos: Área Temporal (7D) + Donut de Riesgo ──────────── */}
      <section aria-labelledby="charts-heading">
        <h2 id="charts-heading" className="sr-only">
          Gráficos Analíticos
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Gráfico de Área Temporal de 7 Días (Kanban FE-04) */}
          <div className="lg:col-span-2">
            <RiskTrendAreaChart data={data.riskTrend} />
          </div>

          {/* Gráfico Donut: Distribución de Riesgo (Kanban FE-04) */}
          <div className="lg:col-span-1">
            <RiskDonutChart
              distribution={data.riskDistribution}
              totalTransactions={data.analyzedTransactions}
            />
          </div>
        </div>
      </section>

      {/* ── Visualización Opcional: Signal Scatter Plot ──────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#D1D5DB]">
              Dispersión de Señales ML
            </h3>
          </div>
          <button
            onClick={() => setShowScatter((prev) => !prev)}
            className="text-xs font-mono text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            {showScatter ? 'Ocultar gráfico' : 'Mostrar análisis de dispersión'}
          </button>
        </div>
        {showScatter && (
          <div className="animate-fade-in">
            <FraudScatterPlot />
          </div>
        )}
      </div>

      {/* ── Inferencia en Vivo & Mini-Tabla de Transacciones Recientes ─────────── */}
      <section aria-labelledby="recent-tx-heading">
        <div className="bg-[#141618] border border-[#23272B] rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 sm:p-5 border-b border-[#1F2328] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <h2
                id="recent-tx-heading"
                className="text-sm font-semibold font-mono uppercase tracking-wider text-[#F3F4F6]"
              >
                Stream de Inferencia en Tiempo Real
              </h2>
              <span className="text-xs font-mono text-[#8A929B] hidden sm:inline">
                (Clic en una fila para abrir detalle y explicabilidad)
              </span>
            </div>
            <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-0.5 rounded">
              Pipeline P95: 12ms
            </span>
          </div>

          <div className="overflow-x-auto">
            <table
              className="w-full text-left border-collapse"
              aria-label="Transacciones recientes evaluadas"
            >
              <thead>
                <tr className="border-b border-[#1F2328] bg-[#111315] text-[11px] font-mono uppercase tracking-wider text-[#8A929B]">
                  <th className="py-2.5 px-4">TX ID</th>
                  <th className="py-2.5 px-4">Usuario</th>
                  <th className="py-2.5 px-4">País</th>
                  <th className="py-2.5 px-4 text-right">Monto ($ USD)</th>
                  <th className="py-2.5 px-4">Score de Riesgo</th>
                  <th className="py-2.5 px-4">Severidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2328] text-xs font-mono">
                {recentLoading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#8A929B]">
                      <div className="flex items-center justify-center gap-2">
                        <LoadingSpinner size={16} />
                        <span>Cargando stream de inferencias...</span>
                      </div>
                    </td>
                  </tr>
                ) : recentTransactions && recentTransactions.length > 0 ? (
                  recentTransactions.map((tx) => {
                    const getSeverityBorder = (level: string) => {
                      switch (level) {
                        case 'CRITICAL':
                          return 'border-l-4 border-l-red-500';
                        case 'HIGH':
                          return 'border-l-4 border-l-orange-500';
                        case 'MEDIUM':
                          return 'border-l-4 border-l-amber-500';
                        default:
                          return 'border-l-4 border-l-emerald-500';
                      }
                    };

                    return (
                      <tr
                        key={tx.transactionId}
                        onClick={() => setSelectedTx(tx)}
                        className={`hover:bg-[#1A1D20] cursor-pointer transition-colors ${getSeverityBorder(tx.riskLevel)}`}
                      >
                        <td className="py-3 px-4 font-bold text-[#F3F4F6]">{tx.transactionId}</td>
                        <td className="py-3 px-4 text-[#D1D5DB]">{tx.externalUserId}</td>
                        <td className="py-3 px-4 text-[#8A929B]">{tx.country}</td>
                        <td className="py-3 px-4 text-right font-semibold text-[#F3F4F6]">
                          ${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 w-44">
                          <ModelScoreBar score={tx.riskScore} riskLevel={tx.riskLevel} />
                        </td>
                        <td className="py-3 px-4">
                          <RiskBadge level={tx.riskLevel} />
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#8A929B]">
                      No hay transacciones recientes registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Transaction Detail Drawer ────────────────────────────────────────── */}
      <TransactionDetailDrawer
        transaction={selectedTx}
        onClose={() => setSelectedTx(null)}
      />
    </div>
  );
}

export default DashboardPage;
