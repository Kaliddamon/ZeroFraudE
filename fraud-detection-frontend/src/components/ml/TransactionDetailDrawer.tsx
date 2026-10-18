import React from 'react';
import { X, ShieldAlert, Cpu, CheckCircle2, Ban } from 'lucide-react';
import { RiskBadge } from '@/components/ui/RiskBadge';
import { ModelScoreBar } from './ModelScoreBar';
import type { TransactionSummary } from '@/types/transaction.types';

interface TransactionDetailDrawerProps {
  transaction: TransactionSummary | null;
  onClose: () => void;
}

export function TransactionDetailDrawer({ transaction, onClose }: TransactionDetailDrawerProps) {
  if (!transaction) return null;

  // Mock SHAP-style feature attribution breakdown
  const featureWeights = [
    { feature: 'amount_ratio_to_user_avg', value: '32.3x', weight: '+0.42', positive: true },
    { feature: 'device_is_new_flag', value: 'True (D_NEW_823461)', weight: '+0.28', positive: true },
    { feature: 'geo_distance_from_last_tx', value: '8,420 km (NG)', weight: '+0.19', positive: true },
    { feature: 'tx_velocity_last_1h', value: '7 tx / hour', weight: '+0.12', positive: true },
    { feature: 'merchant_category_risk', value: 'Digital Goods (M0172)', weight: '+0.08', positive: true },
    { feature: 'account_tenure_days', value: '412 days', weight: '-0.15', positive: false },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end animate-fade-in">
      <div className="w-full max-w-md bg-[#141618] border-l border-[#282E35] h-full flex flex-col shadow-2xl animate-slide-in-right">
        {/* Drawer Header */}
        <div className="p-5 border-b border-[#23272B] flex items-center justify-between bg-[#111315]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-mono text-sm font-bold text-[#F3F4F6]">
                  {transaction.transactionId}
                </h3>
                <RiskBadge level={transaction.riskLevel} />
              </div>
              <p className="text-[11px] font-mono text-[#8A929B] mt-0.5">
                Inferencia LightGBM v1.1.0
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8A929B] hover:text-white hover:bg-[#1F2328] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#1A1D20] border border-[#262B30] rounded-lg p-3">
              <span className="text-[10px] font-mono uppercase text-[#808893]">Monto Analizado</span>
              <div className="font-mono text-lg font-bold text-[#F3F4F6] mt-0.5">
                ${transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div className="bg-[#1A1D20] border border-[#262B30] rounded-lg p-3">
              <span className="text-[10px] font-mono uppercase text-[#808893]">Score de Fraude</span>
              <div className="mt-1">
                <ModelScoreBar score={transaction.riskScore} threshold={0.0812} showLabel={true} />
              </div>
            </div>

            <div className="bg-[#1A1D20] border border-[#262B30] rounded-lg p-3">
              <span className="text-[10px] font-mono uppercase text-[#808893]">Usuario Externo</span>
              <div className="font-mono text-sm font-semibold text-[#D1D5DB] mt-0.5">
                {transaction.externalUserId}
              </div>
            </div>

            <div className="bg-[#1A1D20] border border-[#262B30] rounded-lg p-3">
              <span className="text-[10px] font-mono uppercase text-[#808893]">País / Origen</span>
              <div className="font-mono text-sm font-semibold text-[#D1D5DB] mt-0.5">
                {transaction.country}
              </div>
            </div>
          </div>

          {/* Model Explainability / SHAP Features */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold text-[#F3F4F6] flex items-center gap-1.5 uppercase tracking-wider">
                <Cpu className="w-4 h-4 text-cyan-400" />
                SHAP Feature Attribution (Top 6)
              </span>
              <span className="text-[10px] font-mono text-[#8A929B]">
                Impacto en Score
              </span>
            </div>

            <div className="space-y-2 bg-[#171A1D] border border-[#262B30] rounded-xl p-3">
              {featureWeights.map((f, i) => (
                <div key={i} className="flex items-center justify-between text-xs font-mono py-1.5 border-b border-[#21252A] last:border-0">
                  <div className="flex flex-col truncate pr-2">
                    <span className="text-[#D1D5DB] font-medium truncate">{f.feature}</span>
                    <span className="text-[11px] text-[#808893]">{f.value}</span>
                  </div>
                  <div className={`font-bold px-1.5 py-0.5 rounded text-[11px] font-mono ${
                    f.positive
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  }`}>
                    {f.weight}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Decision Recommendation */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-mono text-amber-300 space-y-1">
            <div className="font-bold uppercase tracking-wider text-amber-400">
              Recomendación Automática del Modelo
            </div>
            <p className="text-amber-200/80 text-[11px]">
              El score ({transaction.riskScore.toFixed(2)}) supera ampliamente el umbral operativo óptimo (θ = 0.0812). Se aconseja bloqueo cautelar y solicitud de 3D-Secure.
            </p>
          </div>
        </div>

        {/* Drawer Actions */}
        <div className="p-4 border-t border-[#23272B] bg-[#111315] flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
          >
            <Ban className="w-3.5 h-3.5" />
            Confirmar Bloqueo
          </button>
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-lg bg-[#1F2328] hover:bg-[#282E35] text-[#D1D5DB] hover:text-white text-xs font-mono font-medium flex items-center justify-center gap-1.5 transition-colors border border-[#30363D]"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Falso Positivo
          </button>
        </div>
      </div>
    </div>
  );
}
