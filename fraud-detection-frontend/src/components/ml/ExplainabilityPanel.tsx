import React from 'react';
import {
  Cpu,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  HelpCircle,
  Smartphone,
  Globe,
  DollarSign,
  Clock,
  Activity,
  ShoppingBag,
  ShieldAlert,
} from 'lucide-react';
import type { RiskLevel } from '@/types/api.types';

export interface FeatureContribution {
  featureName: string;
  label?: string;
  contribution: number; // Positivo: incrementa riesgo; Negativo: reduce riesgo
  description?: string;
}

export interface ExplainabilityPanelProps {
  explanations?: string[];
  contributions?: FeatureContribution[];
  userId?: string;
  transactionId?: string;
  riskLevel?: RiskLevel;
  className?: string;
}

/**
 * Mapeo de categorías comprensibles basadas en las variables reales del pipeline ML.
 */
function categorizeExplanation(text: string): {
  category: string;
  icon: React.ReactNode;
} {
  const lower = text.toLowerCase();

  if (lower.includes('amount') || lower.includes('monto') || lower.includes('average') || lower.includes('promedio') || lower.includes('$')) {
    return {
      category: 'Comportamiento del Monto',
      icon: <DollarSign className="w-3.5 h-3.5 text-cyan-400" />,
    };
  }
  if (lower.includes('device') || lower.includes('dispositivo')) {
    return {
      category: 'Uso del Dispositivo',
      icon: <Smartphone className="w-3.5 h-3.5 text-indigo-400" />,
    };
  }
  if (lower.includes('country') || lower.includes('país') || lower.includes('location') || lower.includes('ubicación')) {
    return {
      category: 'Ubicación Geográfica',
      icon: <Globe className="w-3.5 h-3.5 text-emerald-400" />,
    };
  }
  if (lower.includes('merchant') || lower.includes('comercio')) {
    return {
      category: 'Comercio y Categoría',
      icon: <ShoppingBag className="w-3.5 h-3.5 text-purple-400" />,
    };
  }
  if (lower.includes('transaction') || lower.includes('5 minutes') || lower.includes('hour') || lower.includes('frecuencia') || lower.includes('velocidad') || lower.includes('duplicate')) {
    return {
      category: 'Frecuencia Transaccional',
      icon: <Clock className="w-3.5 h-3.5 text-amber-400" />,
    };
  }
  if (lower.includes('deviat') || lower.includes('desvia') || lower.includes('behavior') || lower.includes('conducta')) {
    return {
      category: 'Desviación de Conducta',
      icon: <Activity className="w-3.5 h-3.5 text-pink-400" />,
    };
  }

  return {
    category: 'Indicador de Riesgo General',
    icon: <AlertCircle className="w-3.5 h-3.5 text-cyan-400" />,
  };
}

/**
 * Traduce nombres técnicos de features a nombres amigables para analistas.
 */
export function translateFeatureName(featureName: string): string {
  const translations: Record<string, string> = {
    amount_z_score: 'Desviación de importe vs. media',
    amount_log: 'Monto atípico de la transacción',
    amount_ratio_to_avg: 'Ratio respecto al ticket promedio',
    user_avg_amount_30d: 'Promedio histórico mensual',
    is_new_device: 'Dispositivo no reconocido',
    device_target_enc: 'Riesgo histórico del dispositivo',
    is_new_country: 'País no registrado en historial',
    unique_countries_24h: 'Múltiples países en 24h',
    is_new_merchant: 'Comercio no habitual',
    merchant_target_enc: 'Riesgo de categoría de comercio',
    tx_count_5min: 'Ráfaga de transacciones (5 min)',
    tx_count_1h: 'Frecuencia transaccional (1 hora)',
    tx_count_24h: 'Volumen transaccional (24 horas)',
    amount_sum_1h: 'Monto acumulado en 1 hora',
    is_night: 'Operación en horario nocturno atípico',
    is_weekend: 'Operación en fin de semana',
    is_duplicate_candidate: 'Patrón de transacción duplicada',
    days_since_last_tx: 'Inactividad prolongada previa',
    behavioral_deviation: 'Desviación del perfil conductual',
  };

  return translations[featureName] ?? featureName.replace(/_/g, ' ');
}

export function ExplainabilityPanel({
  explanations = [],
  contributions,
  userId,
  transactionId,
  riskLevel: _riskLevel,
  className = '',
}: ExplainabilityPanelProps) {
  const hasExplanations = explanations.length > 0;
  const hasContributions = Array.isArray(contributions) && contributions.length > 0;

  // Cálculo de impacto relativo si existen contribuciones numéricas legítimas:
  // I_i = (|c_i| / sum(|c_j|)) * 100
  const normalizedContributions = React.useMemo(() => {
    if (!hasContributions) return [];

    const totalAbs = contributions.reduce((acc, curr) => acc + Math.abs(curr.contribution), 0);

    return contributions
      .map((item) => {
        const absVal = Math.abs(item.contribution);
        const relativeImpact = totalAbs > 0 ? (absVal / totalAbs) * 100 : 0;
        return {
          ...item,
          relativeImpact,
          isRiskIncreasing: item.contribution > 0,
          isRiskReducing: item.contribution < 0,
        };
      })
      .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  }, [contributions, hasContributions]);

  return (
    <div className={`space-y-4 text-xs font-mono text-[#E1E4E8] ${className}`}>
      {/* ── Encabezado del Panel ────────────────────────────────────────── */}
      <div className="flex items-center justify-between pb-2 border-b border-[#23272B]">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-cyan-400" />
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[#F3F4F6]">
            Explicación del modelo
          </h3>
        </div>
        <span className="text-[10px] text-[#808893]">
          Interpretabilidad SHAP & Factores de Riesgo
        </span>
      </div>

      {/* ── Enlace al Behavioral Profile del Usuario ────────────────────── */}
      <div className="bg-[#16191D] border border-[#23272B] rounded-xl p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="text-[11px] text-[#D1D5DB]">
            {userId ? (
              <>
                Perfil conductual de <span className="font-bold text-[#F3F4F6]">{userId}</span>
              </>
            ) : (
              'Perfil conductual del cliente'
            )}
          </span>
        </div>

        {userId ? (
          <a
            href={transactionId ? `/profile/${userId}?txId=${transactionId}` : `/profile/${userId}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1F2328] hover:bg-[#282E35] text-cyan-400 hover:text-cyan-300 border border-[#30363D] text-[11px] font-medium transition-colors"
            title={`Ver perfil conductual de ${userId}`}
          >
            <span>Consultar Perfil</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        ) : (
          <span className="text-[10px] text-[#808893]">Sin ID de usuario disponible</span>
        )}
      </div>

      {/* ── Caso A: Si existen Contribuciones Numéricas (Barras de Impacto) ─ */}
      {hasContributions && normalizedContributions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[11px] text-[#8A929B]">
            <span>Factor analizado</span>
            <span>Impacto relativo (I_i)</span>
          </div>

          <div className="space-y-2.5 bg-[#16191D] border border-[#23272B] rounded-xl p-4">
            {normalizedContributions.map((item, idx) => {
              const friendlyLabel = item.label || translateFeatureName(item.featureName);

              return (
                <div key={idx} className="space-y-1.5 pb-2.5 border-b border-[#21252A] last:border-0 last:pb-0">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      {item.isRiskIncreasing ? (
                        <TrendingUp className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      ) : item.isRiskReducing ? (
                        <TrendingDown className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <HelpCircle className="w-3.5 h-3.5 text-[#808893] shrink-0" />
                      )}
                      <span className="text-[#D1D5DB] font-medium">{friendlyLabel}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          item.isRiskIncreasing
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : item.isRiskReducing
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                        }`}
                      >
                        {item.isRiskIncreasing ? '+' : item.isRiskReducing ? '-' : ''}
                        {item.relativeImpact.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Barra de Impacto Relativo */}
                  <div className="w-full bg-[#23272B] h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        item.isRiskIncreasing
                          ? 'bg-red-500'
                          : item.isRiskReducing
                          ? 'bg-emerald-500'
                          : 'bg-gray-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, item.relativeImpact))}%` }}
                    />
                  </div>

                  {item.description && (
                    <p className="text-[10px] text-[#808893]">{item.description}</p>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-[10px] font-mono text-[#808893] text-right">
            * El porcentaje representa la participación relativa en la evaluación (|c_i| / Σ|c_j|), no puntos de probabilidad directa.
          </p>
        </div>
      )}

      {/* ── Caso B: Explicaciones en Lenguaje Natural (Contrato Estándar) ── */}
      {hasExplanations ? (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-[11px] text-[#8A929B]">
            <span>Factores determinantes emitidos por el modelo</span>
            <span className="text-[10px] text-[#808893]">Lenguaje natural</span>
          </div>

          <div className="bg-[#16191D] border border-[#23272B] rounded-xl p-4 space-y-3">
            {explanations.map((explanation, i) => {
              const meta = categorizeExplanation(explanation);

              return (
                <div
                  key={i}
                  className="p-3 rounded-lg bg-[#111315] border border-[#21252A] flex items-start gap-3 transition-colors hover:border-[#2C323B]"
                >
                  <div className="p-1.5 rounded-md bg-[#1C2025] shrink-0 mt-0.5">
                    {meta.icon}
                  </div>

                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-[#8A929B]">
                        {meta.category}
                      </span>
                      <span className="text-[10px] font-mono text-cyan-400">
                        Factor {i + 1}
                      </span>
                    </div>
                    <p className="text-xs text-[#E1E4E8] font-medium leading-relaxed">
                      {explanation}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="p-5 rounded-xl bg-[#16191D] border border-[#262B30] text-center text-xs font-mono text-[#8A929B] space-y-1">
          <ShieldAlert className="w-5 h-5 text-[#808893] mx-auto mb-1" />
          <p className="text-[#D1D5DB] font-medium">
            El modelo no proporcionó explicaciones para esta transacción.
          </p>
          <p className="text-[10px] text-[#808893]">
            Transacciones con score dentro de parámetros tolerables pueden no registrar anomalías individuales.
          </p>
        </div>
      )}

      {/* ── Nota de Transparencia de Contrato cuando no hay pesos numéricos ─ */}
      {!hasContributions && hasExplanations && (
        <div className="p-3 rounded-lg bg-[#14171A] border border-[#23272B] text-[10px] text-[#8A929B] flex items-start gap-2 leading-relaxed">
          <HelpCircle className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
          <p>
            <strong className="text-[#D1D5DB]">Nota de Transparencia XAI:</strong> El modelo ML entrega factores de decisión consolidados en lenguaje natural para analistas. El desglose porcentual exacto por variable (TreeSHAP) se habilitará una vez que el contrato backend exponga las magnitudes escalares de atribución individual (Dependencia ML/Backend).
          </p>
        </div>
      )}
    </div>
  );
}
