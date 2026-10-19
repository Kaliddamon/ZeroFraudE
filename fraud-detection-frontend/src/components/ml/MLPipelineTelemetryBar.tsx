import React from 'react';
import { Cpu, Target, Activity, ShieldCheck } from 'lucide-react';

interface MetricTelemetryItem {
  icon: React.ElementType;
  badge: string;
  badgeVariant: 'success' | 'warning' | 'info' | 'purple';
  title: string;
  primaryValue: string;
  secondaryValue?: string;
  metaLeft: string;
  metaRight: string;
  sparklineColor?: string;
}

export function MLPipelineTelemetryBar() {
  const telemetryData: MetricTelemetryItem[] = [
    {
      icon: Cpu,
      badge: 'PROD ACTIVE',
      badgeVariant: 'success',
      title: 'Active Engine & Dataset',
      primaryValue: 'LightGBM',
      secondaryValue: 'v1.1.0',
      metaLeft: '7,659 test samples',
      metaRight: 'Base Fraud: 5.52%',
    },
    {
      icon: Target,
      badge: 'TEST SET METRIC',
      badgeVariant: 'warning',
      title: 'Umbral de Evaluación (Test)',
      primaryValue: 'θ = 0.0812',
      metaLeft: 'Recall: 94.8% (401/423)',
      metaRight: 'Precision: 67.1%',
    },
    {
      icon: Activity,
      badge: 'HIGH FIDELITY',
      badgeVariant: 'info',
      title: 'Discriminative Power',
      primaryValue: 'PR-AUC 0.947',
      secondaryValue: 'ROC 0.989',
      metaLeft: 'Latency P95: 12ms',
      metaRight: 'Feature Drift: 0.02',
    },
    {
      icon: ShieldCheck,
      badge: 'FINANCIAL IMPACT',
      badgeVariant: 'purple',
      title: 'Cost Matrix Exposure',
      primaryValue: '$4,285',
      secondaryValue: 'total cost',
      metaLeft: 'FN cost: $150 · FP: $5',
      metaRight: 'Protected: $284.5K',
    },
  ];

  const getBadgeStyle = (variant: MetricTelemetryItem['badgeVariant']) => {
    switch (variant) {
      case 'success':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'warning':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'info':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case 'purple':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    }
  };

  return (
    <section aria-label="Telemetría de Pipeline ML" className="w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {telemetryData.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className="group relative bg-[#141618] hover:bg-[#181B1E] border border-[#23272B] hover:border-[#383E46] rounded-xl p-4 transition-all duration-200 shadow-sm flex flex-col justify-between"
            >
              {/* Header de la tarjeta */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-medium tracking-wider text-[#8A929B] uppercase truncate">
                  {item.title}
                </span>
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border uppercase tracking-wider ${getBadgeStyle(
                    item.badgeVariant
                  )}`}
                >
                  {item.badgeVariant === 'success' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse" />
                  )}
                  {item.badge}
                </span>
              </div>

              {/* Contenido principal */}
              <div className="flex items-baseline gap-2 my-1">
                <div className="p-1.5 rounded-lg bg-[#1B1E22] border border-[#282E35] text-[#D1D5DB] group-hover:text-white transition-colors">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex items-baseline gap-2 truncate">
                  <span className="font-mono text-xl font-bold tracking-tight text-[#F3F4F6]">
                    {item.primaryValue}
                  </span>
                  {item.secondaryValue && (
                    <span className="font-mono text-xs text-[#9CA3AF]">
                      {item.secondaryValue}
                    </span>
                  )}
                </div>
              </div>

              {/* Metadata inferior estilo Swiss / Data telemetry */}
              <div className="pt-2 mt-2 border-t border-[#1F2328] flex items-center justify-between text-[11px] font-mono text-[#808893]">
                <span className="truncate">{item.metaLeft}</span>
                <span className="text-[#A0A8B2] font-semibold truncate ml-2">
                  {item.metaRight}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
