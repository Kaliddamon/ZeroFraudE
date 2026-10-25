import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, TrendingUp, AlertTriangle, ShieldCheck, ArrowUpRight, Activity } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/Button';
import { RiskBadge } from '@/components/ui/RiskBadge';
import { apiClient } from '@/services/api/apiClient';
import type { DashboardStatistics } from '@/types/alert.types';
import type { TransactionSummary } from '@/types/transaction.types';
import { MLPipelineTelemetryBar } from '@/components/ml/MLPipelineTelemetryBar';
import { FraudScatterPlot } from '@/components/ml/FraudScatterPlot';
import { ModelScoreBar } from '@/components/ml/ModelScoreBar';
import { TransactionDetailDrawer } from '@/components/ml/TransactionDetailDrawer';

export function DashboardPage() {
  const [selectedTx, setSelectedTx] = useState<TransactionSummary | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await apiClient.get<DashboardStatistics>('/statistics/dashboard');
      return res.data;
    },
  });

  const { data: recentTransactions } = useQuery({
    queryKey: ['recent-transactions'],
    queryFn: async () => {
      const res = await apiClient.get<{ content: TransactionSummary[] }>('/transactions?page=0&size=6');
      return res.data.content;
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size={32} />
      </div>
    );
  }

  if (error || !data) {
    return <div className="text-red-400 p-8 font-mono">Error cargando métricas del dashboard.</div>;
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
      {/* ── Franja de Telemetría del Pipeline ML (Sustituye títulos gigantes) ──── */}
      <MLPipelineTelemetryBar />

      {/* ── Métricas Operativas & Impacto Financiero ─────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Hero Card: Capital Protegido (Propuesta B) */}
        <div className="bg-[#141618] border border-[#23272B] hover:border-[#383E46] rounded-xl p-5 flex flex-col justify-between transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-[#8A929B] uppercase tracking-wider">
              Capital Protegido
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-3xl font-bold font-mono tracking-tight text-[#F3F4F6]">
              $284,520
            </div>
            <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-400 mt-1">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>94.8% Eficiencia de Captura</span>
            </div>
          </div>
          <div className="pt-2 border-t border-[#1F2328] text-[11px] font-mono text-[#808893]">
            Exposición mitigada vs fraudes directos
          </div>
        </div>

        {/* Transacciones Evaluadas */}
        <div className="bg-[#141618] border border-[#23272B] hover:border-[#383E46] rounded-xl p-5 flex flex-col justify-between transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-[#8A929B] uppercase tracking-wider">
              Volumen Evaluado
            </span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-3xl font-bold font-mono tracking-tight text-[#F3F4F6]">
              {data.analyzedTransactions.toLocaleString()}
            </div>
            <div className="text-xs font-mono text-[#8A929B] mt-1">
              Test Set · 7,659 inferencias
            </div>
          </div>
          <div className="pt-2 border-t border-[#1F2328] text-[11px] font-mono text-[#808893]">
            Tasa base observada: <strong>5.52%</strong>
          </div>
        </div>

        {/* Fraude Detectado & Bloqueado */}
        <div className="bg-[#141618] border border-[#23272B] hover:border-red-500/30 rounded-xl p-5 flex flex-col justify-between transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-[#8A929B] uppercase tracking-wider">
              Fraude Detectado
            </span>
            <div className="p-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-3xl font-bold font-mono tracking-tight text-red-400">
              {data.fraudDetected.toLocaleString()}
            </div>
            <div className="text-xs font-mono text-red-400/80 mt-1">
              401 TP / 22 FN (94.8% Recall)
            </div>
          </div>
          <div className="pt-2 border-t border-[#1F2328] text-[11px] font-mono text-[#808893]">
            Falsos Positivos controlados: <strong>197 (2.7%)</strong>
          </div>
        </div>

        {/* Alertas Pendientes de Revisión */}
        <div className="bg-[#141618] border border-[#23272B] hover:border-amber-500/30 rounded-xl p-5 flex flex-col justify-between transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-[#8A929B] uppercase tracking-wider">
              Alertas en Cola
            </span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-3xl font-bold font-mono tracking-tight text-amber-400">
              {data.openAlerts}
            </div>
            <div className="text-xs font-mono text-emerald-400 mt-1">
              SLA Resolución: 3.8 min
            </div>
          </div>
          <div className="pt-2 border-t border-[#1F2328] text-[11px] font-mono text-[#808893]">
            Capacidad operativa: <strong>Normal</strong>
          </div>
        </div>
      </div>

      {/* ── Visualización Principal: Signal Scatter Plot + Distribución de Severidad ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Scatter Plot (Propuesta C) */}
        <div className="lg:col-span-2">
          <FraudScatterPlot />
        </div>

        {/* Distribución de Severidad */}
        <div className="bg-[#141618] border border-[#23272B] rounded-xl p-5 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#1F2328]">
              <h2 className="text-sm font-semibold tracking-wider text-[#F3F4F6] uppercase font-mono">
                Distribución de Severidad
              </h2>
              <span className="text-[10px] font-mono text-[#8A929B]">
                Total: {data.analyzedTransactions.toLocaleString()}
              </span>
            </div>

            <div className="space-y-4">
              {(Object.entries(data.riskDistribution) as Array<[keyof typeof data.riskDistribution, number]>).map(([level, count]) => {
                const total = data.analyzedTransactions;
                const percent = (count / total) * 100;
                return (
                  <div key={level} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <RiskBadge level={level} />
                      <div className="flex items-baseline gap-2 font-mono">
                        <span className="text-xs text-[#8A929B]">{percent.toFixed(1)}%</span>
                        <span className="text-sm font-semibold text-[#F3F4F6]">{count.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-[#1F2328] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${percent}%`,
                          backgroundColor:
                            level === 'CRITICAL'
                              ? '#DC2626'
                              : level === 'HIGH'
                              ? '#EA580C'
                              : level === 'MEDIUM'
                              ? '#D97706'
                              : '#16A34A',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[#1F2328] flex items-center justify-between text-xs font-mono text-[#808893]">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              Calibración Platt: Óptima
            </span>
            <span className="text-emerald-400">Brier: 0.038</span>
          </div>
        </div>
      </div>

      {/* ── Inferencia en Vivo & Transacciones Recientes ─────────────────────── */}
      <div className="bg-[#141618] border border-[#23272B] rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 sm:p-5 border-b border-[#1F2328] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-[#F3F4F6]">
              Stream de Inferencia en Tiempo Real
            </h2>
            <span className="text-xs font-mono text-[#8A929B] hidden sm:inline">
              (Clic en una fila para ver factores SHAP)
            </span>
          </div>
          <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded">
            Pipeline P95: 12ms
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1F2328] bg-[#111315] text-[11px] font-mono uppercase tracking-wider text-[#8A929B]">
                <th className="py-2.5 px-4">TX ID</th>
                <th className="py-2.5 px-4">Usuario</th>
                <th className="py-2.5 px-4">País</th>
                <th className="py-2.5 px-4">Monto ($ USD)</th>
                <th className="py-2.5 px-4">Score de Riesgo</th>
                <th className="py-2.5 px-4">Severidad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F2328] text-xs font-mono">
              {recentTransactions && recentTransactions.length > 0 ? (
                recentTransactions.map((tx) => {
                  const getSeverityBorder = (level: string) => {
                    switch (level) {
                      case 'CRITICAL': return 'border-l-4 border-l-red-500';
                      case 'HIGH': return 'border-l-4 border-l-orange-500';
                      case 'MEDIUM': return 'border-l-4 border-l-amber-500';
                      default: return 'border-l-4 border-l-emerald-500';
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
                      <td className="py-3 px-4 font-semibold text-[#F3F4F6]">
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
                    Cargando stream de inferencias...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Transaction Detail Drawer (SHAP Features) ────────────────────────── */}
      <TransactionDetailDrawer
        transaction={selectedTx}
        onClose={() => setSelectedTx(null)}
      />
    </div>
  );
}
