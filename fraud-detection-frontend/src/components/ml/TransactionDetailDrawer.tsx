import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, ShieldAlert, Cpu, CheckCircle2, Ban, RefreshCw } from 'lucide-react';
import { RiskBadge } from '@/components/ui/RiskBadge';
import { ModelScoreBar } from './ModelScoreBar';
import { fetchTransactionDetail } from '@/services/api/transactions.service';
import type { TransactionSummary } from '@/types/transaction.types';
import type { TransactionDetail } from '@/types/transaction.types';

interface TransactionDetailDrawerProps {
  transaction: TransactionSummary | null;
  onClose: () => void;
}

export function TransactionDetailDrawer({ transaction, onClose }: TransactionDetailDrawerProps) {
  const { data: detail, isLoading: detailLoading, error: detailError, refetch } = useQuery<TransactionDetail>({
    queryKey: ['transaction-detail', transaction?.transactionId ?? ''],
    queryFn: async () => {
      if (!transaction?.transactionId) throw new Error('No transaction ID');
      return fetchTransactionDetail(transaction.transactionId);
    },
    enabled: !!transaction?.transactionId,
  });

  if (!transaction) return null;

  const analysis = detail?.analysis ?? null;
  const explanations = analysis?.explanations ?? [];

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
              <span className="text-[10px] font-mono uppercase text-[#808893]">Score de Riesgo</span>
              <div className="mt-1">
                <ModelScoreBar score={transaction.riskScore} riskLevel={transaction.riskLevel} showLabel={true} />
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

          {/* Loading state */}
          {detailLoading && (
            <div className="p-3.5 rounded-xl bg-[#1A1D20] border border-[#262B30] flex flex-col items-center gap-2">
              <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" />
              <span className="text-xs font-mono text-[#8A929B]">Cargando detalles de la transacción…</span>
            </div>
          )}

          {/* Error state */}
          {detailError && !detailLoading && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs font-mono text-red-400 space-y-1">
              <div className="font-bold uppercase tracking-wider text-red-400">
                Error al cargar detalles
              </div>
              <p className="text-red-300/80 text-[11px]">
                No se pudo obtener la explicación del modelo para esta transacción.
              </p>
              <button
                onClick={() => refetch()}
                className="px-3 py-1 rounded bg-[#1F2328] hover:bg-[#282E35] text-[#8A929B] border border-[#30363D] text-xs"
              >
                Reintentar
              </button>
            </div>
          )}

          {/* Explanations section (only when detail is available and not loading) */}
          {detail && !detailLoading && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-[#F3F4F6] flex items-center gap-1.5 uppercase tracking-wider">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  Explicación del modelo
                </span>
              </div>

              {explanations.length === 0 ? (
                <div className="p-3.5 rounded-xl bg-[#1A1D20] border border-[#262B30] text-xs font-mono text-[#8A929B]">
                  <p className="text-[#808893]">El modelo no proporcionó explicaciones para esta transacción.</p>
                </div>
              ) : (
                <div className="bg-[#171A1D] border border-[#262B30] rounded-xl p-3 space-y-2">
                  {explanations.map((explanation, i) => (
                    <div key={i} className="flex items-start justify-between text-xs font-mono py-1.5 border-b border-[#21252A] last:border-0">
                      <div className="flex flex-col truncate pr-2">
                        <span className="text-[#D1D5DB] font-medium truncate">Factor {i + 1}</span>
                        <span className="text-[11px] text-[#808893]">{explanation}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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
