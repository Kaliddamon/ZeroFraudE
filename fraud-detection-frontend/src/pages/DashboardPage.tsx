import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/Button';
import { RiskBadge } from '@/components/ui/Badge';
import { apiClient } from '@/services/api/apiClient';
import type { DashboardStatistics } from '@/types/alert.types';
import { formatCurrency, formatPercent } from '@/utils';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await apiClient.get<DashboardStatistics>('/statistics/dashboard');
      return res.data;
    },
  });

  if (isLoading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><LoadingSpinner size={32} /></div>;
  }
  if (error || !data) {
    return <div className="text-[var(--risk-high)] p-8">Error cargando dashboard.</div>;
  }

  return (
    <div className="flex flex-col gap-8 max-w-7xl mx-auto w-full">
      
      {/* ── Top KPIs ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        <Card className="metric-card h-full flex flex-col justify-between">
          <CardContent className="p-0">
            <div className="flex items-center justify-between mb-6">
              <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Volumen Analizado</span>
              <div className="p-2.5 rounded-xl bg-[rgba(26,86,219,0.1)] text-[var(--brand-light)]">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-4xl font-bold font-mono tracking-tight text-[var(--text-primary)]">
                {data.analyzedTransactions.toLocaleString()}
              </div>
              <p className="text-sm text-[var(--text-secondary)] mt-2">Últimas 24 horas</p>
            </div>
          </CardContent>
        </Card>

        <Card className="metric-card border-t-[3px] border-t-[var(--risk-critical)] h-full flex flex-col justify-between">
          <CardContent className="p-0">
            <div className="flex items-center justify-between mb-6">
              <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Fraude Detectado</span>
              <div className="p-2.5 rounded-xl bg-[rgba(220,38,38,0.1)] text-[var(--risk-critical)]">
                <ShieldAlert className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-4xl font-bold font-mono tracking-tight text-[var(--risk-critical)] drop-shadow-[0_0_8px_rgba(220,38,38,0.3)]">
                {data.fraudDetected.toLocaleString()}
              </div>
              <p className="text-sm text-[var(--text-secondary)] mt-2">Tasa de fraude: {formatPercent(data.fraudRate)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="metric-card h-full flex flex-col justify-between">
          <CardContent className="p-0">
            <div className="flex items-center justify-between mb-6">
              <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Score Promedio</span>
              <div className="p-2.5 rounded-xl bg-[rgba(245,158,11,0.1)] text-[var(--risk-medium)]">
                <ActivityIcon className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-4xl font-bold font-mono tracking-tight text-[var(--text-primary)]">
                {data.averageRiskScore.toFixed(2)}
              </div>
              <div className="w-full h-1.5 bg-[var(--bg-elevated)] rounded-full mt-4 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[var(--brand)] to-[var(--risk-medium)]" style={{ width: `${data.averageRiskScore * 100}%` }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="metric-card h-full flex flex-col justify-between">
          <CardContent className="p-0">
            <div className="flex items-center justify-between mb-6">
              <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Alertas Pendientes</span>
              <div className="p-2.5 rounded-xl bg-[rgba(201,162,39,0.1)] text-[var(--gold-light)]">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-4xl font-bold font-mono tracking-tight text-[var(--gold-light)] drop-shadow-[0_0_8px_rgba(201,162,39,0.3)]">
                {data.openAlerts}
              </div>
              <p className="text-sm text-[var(--text-secondary)] mt-2 text-[var(--risk-low)] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Equipo al día
              </p>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* ── Charts & Tables ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Chart */}
        <Card className="lg:col-span-2 flex flex-col">
          <CardHeader 
            title="Tendencia de Riesgo" 
            subtitle="Volumen de transacciones por nivel de severidad (7 días)" 
            className="pb-4 pt-6 px-8"
          />
          <CardContent className="flex-1 p-8 pt-0">
            <div className="h-[360px] w-full mt-6">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.riskTrend} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <defs>
                    <linearGradient id="colorHigh" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--risk-critical)" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="var(--risk-critical)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorMed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--risk-medium)" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="var(--risk-medium)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} strokeOpacity={0.5} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tickMargin={16} />
                  <YAxis axisLine={false} tickLine={false} tickMargin={16} />
                  <Tooltip />
                  <Area type="monotone" dataKey="high" stroke="var(--risk-critical)" strokeWidth={3} fillOpacity={1} fill="url(#colorHigh)" />
                  <Area type="monotone" dataKey="medium" stroke="var(--risk-medium)" strokeWidth={3} fillOpacity={1} fill="url(#colorMed)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Breakdown */}
        <Card className="flex flex-col">
          <CardHeader title="Distribución de Severidad" className="pb-4 pt-6 px-8" />
          <CardContent className="p-8 pt-2 flex flex-col gap-8">
            {(Object.entries(data.riskDistribution) as Array<[keyof typeof data.riskDistribution, number]>).map(([level, count]) => {
              const total = data.analyzedTransactions;
              const percent = (count / total) * 100;
              return (
                <div key={level} className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <RiskBadge level={level} className="px-4 py-1.5" />
                    <span className="font-mono text-lg font-medium text-[var(--text-primary)]">{count.toLocaleString()}</span>
                  </div>
                  <div className="w-full h-2.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-1000 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]"
                      style={{ 
                        width: `${percent}%`,
                        backgroundColor: `var(--risk-${level.toLowerCase()})`
                      }} 
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

function ActivityIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}
