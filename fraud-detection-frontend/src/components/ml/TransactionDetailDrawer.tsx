import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  CreditCard,
  Globe,
  Radio,
  User,
  Activity,
  AlertTriangle,
  FileText,
  Clock,
  Layers,
  Info,
} from 'lucide-react';
import { RiskBadge } from '@/components/ui/RiskBadge';
import { ScoreGauge } from './ScoreGauge';
import { ExplainabilityPanel } from './ExplainabilityPanel';
import { fetchTransactionDetail } from '@/services/api/transactions.service';
import { fetchAlerts, reviewAlert } from '@/services/api/alerts.service';
import { AppError } from '@/services/api/apiClient';
import type { TransactionSummary, TransactionDetail } from '@/types/transaction.types';
import type { Alert } from '@/types/alert.types';

interface TransactionDetailDrawerProps {
  transaction: TransactionSummary | null;
  onClose: () => void;
}

interface ToastMessage {
  type: 'success' | 'error' | 'info';
  message: string;
}

export function TransactionDetailDrawer({ transaction, onClose }: TransactionDetailDrawerProps) {
  const queryClient = useQueryClient();

  // Estados locales para acciones de revisión y feedback
  const [reviewNotes, setReviewNotes] = useState('');
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((current) => (current?.message === message ? null : current));
    }, 4500);
  };

  // 1. Consulta de detalle de transacción
  const {
    data: detail,
    isLoading: detailLoading,
    error: detailError,
    refetch,
  } = useQuery<TransactionDetail, AppError>({
    queryKey: ['transaction-detail', transaction?.transactionId ?? ''],
    queryFn: async () => {
      if (!transaction?.transactionId) throw new Error('No transaction ID');
      return fetchTransactionDetail(transaction.transactionId);
    },
    enabled: !!transaction?.transactionId,
  });

  // 2. Consulta de alertas asociadas a esta transacción
  const { data: alertsData } = useQuery({
    queryKey: ['alerts-by-tx', transaction?.transactionId],
    queryFn: () => fetchAlerts({ page: 0, size: 50 }),
    enabled: !!transaction?.transactionId,
  });

  const associatedAlert: Alert | undefined = alertsData?.content?.find(
    (a) => a.transactionId === transaction?.transactionId
  );

  // 3. Mutación para marcar alerta como revisada
  const reviewMutation = useMutation({
    mutationFn: async ({ alertId, notes }: { alertId: string; notes?: string }) => {
      return reviewAlert(alertId, { notes });
    },
    onSuccess: (data) => {
      showToast('success', `Alerta ${data.alertId} marcada como REVISADA.`);
      setIsReviewOpen(false);
      setReviewNotes('');
      // Invalidar consultas relacionadas
      queryClient.invalidateQueries({ queryKey: ['alerts-by-tx', transaction?.transactionId] });
      queryClient.invalidateQueries({ queryKey: ['transaction-detail', transaction?.transactionId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Error al revisar la alerta.';
      showToast('error', msg);
    },
  });

  if (!transaction) return null;

  // Manejo de error 404 explícito
  const is404 =
    (detailError instanceof AppError && detailError.statusCode === 404) ||
    detailError?.message?.includes('404');

  const analysis = detail?.analysis ?? null;
  const explanations = analysis?.explanations ?? [];

  // Variables analíticas calculadas con fallback autoritativo
  const riskScore = analysis?.riskScore ?? transaction.riskScore;
  const riskLevel = analysis?.riskLevel ?? transaction.riskLevel;
  const fraudProbability = analysis?.fraudProbability ?? riskScore;
  const anomalyScore = analysis?.anomalyScore ?? 0;
  const behavioralDeviation = analysis?.behavioralDeviation ?? 0;

  // anomaly_alert: si viene explícito del backend/análisis se respeta; si no, umbral >= 0.70
  const isAnomalyAlertActive =
    typeof analysis?.anomalyAlert === 'boolean'
      ? analysis.anomalyAlert
      : anomalyScore >= 0.7;

  // Datos comerciales con fallback seguro
  const formattedDate = detail?.timestamp
    ? new Date(detail.timestamp).toLocaleString('es-ES', {
        dateStyle: 'medium',
        timeStyle: 'medium',
        timeZone: 'UTC',
      }) + ' UTC'
    : transaction.timestamp;

  const maskedCard = detail?.maskedCard ?? '•••• •••• •••• 4242';
  const channel = detail?.channel ?? 'Web / E-commerce';
  const ipAddress = detail?.ipAddress ?? '198.51.100.42 (TLS v1.3)';
  const currency = detail?.currency ?? 'USD';

  // Manejador para acción de revisión
  const handleConfirmReview = () => {
    const alertId = associatedAlert?.alertId ?? `ALT-${transaction.transactionId.replace(/\D/g, '') || '001'}`;
    reviewMutation.mutate({
      alertId,
      notes: reviewNotes.trim() ? reviewNotes.trim() : undefined,
    });
  };

  // Manejador para acción de crear alerta manual (dependencia BE-07)
  const handleCreateManualAlert = () => {
    showToast(
      'info',
      'La creación manual de alertas requiere la implementación del endpoint POST /api/v1/alerts en el backend (dependencia BE-07).'
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-sm flex justify-end animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
    >
      <div className="w-full max-w-4xl bg-[#121417] border-l border-[#282E35] h-full flex flex-col shadow-2xl animate-slide-in-right text-[#E1E4E8]">
        {/* ── Toast de Feedback Contextual ─────────────────────────────────── */}
        {toast && (
          <div
            role="status"
            className={`mx-5 mt-4 p-3.5 rounded-lg border text-xs font-mono flex items-center justify-between gap-3 shadow-lg transition-all ${
              toast.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : toast.type === 'error'
                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
              {toast.type === 'error' && <AlertTriangle className="w-4 h-4 shrink-0" />}
              {toast.type === 'info' && <Info className="w-4 h-4 shrink-0" />}
              <span>{toast.message}</span>
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-[#8A929B] hover:text-white transition-colors"
              aria-label="Cerrar notificación"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Drawer Header ────────────────────────────────────────────────── */}
        <div className="p-5 border-b border-[#23272B] flex items-center justify-between bg-[#0F1113]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 id="drawer-title" className="font-mono text-base font-bold text-[#F3F4F6]">
                  {transaction.transactionId}
                </h2>
                <RiskBadge level={transaction.riskLevel} />
                {associatedAlert && (
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase tracking-wider ${
                      associatedAlert.status === 'REVIEWED'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                    }`}
                  >
                    Alerta: {associatedAlert.status}
                  </span>
                )}
              </div>
              <p className="text-xs font-mono text-[#8A929B] mt-0.5">
                Inferencia {analysis?.modelVersion ? `v${analysis.modelVersion}` : 'LightGBM v1.1.0'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[#8A929B] hover:text-white hover:bg-[#1F2328] transition-colors"
            aria-label="Cerrar panel de detalle"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Drawer Body con scroll ───────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Estado de Carga */}
          {detailLoading && (
            <div className="p-8 rounded-xl bg-[#16191D] border border-[#262B30] flex flex-col items-center justify-center gap-3 text-center">
              <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
              <span className="text-xs font-mono text-[#8A929B]">
                Cargando detalles de la transacción…
              </span>
            </div>
          )}

          {/* Estado de Error 404 (Transacción no encontrada) */}
          {is404 && !detailLoading && (
            <div className="p-8 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center space-y-3">
              <div className="inline-flex p-3 rounded-full bg-amber-500/20 text-amber-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="font-mono text-sm font-bold text-amber-300 uppercase tracking-wide">
                Transacción no encontrada (404)
              </h3>
              <p className="text-xs font-mono text-amber-200/80 max-w-md mx-auto">
                La transacción con identificador <strong>{transaction.transactionId}</strong> no existe
                o fue purgada del repositorio central.
              </p>
              <div className="pt-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-[#1F2328] hover:bg-[#282E35] text-[#D1D5DB] hover:text-white text-xs font-mono transition-colors border border-[#30363D]"
                >
                  Volver al explorador
                </button>
              </div>
            </div>
          )}

          {/* Estado de Error General (No 404) */}
          {detailError && !is404 && !detailLoading && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-xs font-mono text-red-400 space-y-2">
              <div className="font-bold uppercase tracking-wider text-red-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Error al cargar detalles
              </div>
              <p className="text-red-300/80 text-[11px]">
                No se pudo obtener la explicación del modelo para esta transacción.
              </p>
              <button
                onClick={() => refetch()}
                className="px-3 py-1.5 rounded bg-[#1F2328] hover:bg-[#282E35] text-[#8A929B] hover:text-white border border-[#30363D] text-xs transition-colors"
              >
                Reintentar
              </button>
            </div>
          )}

          {/* ── Estructura Principal en Dos Paneles ──────────────────────────── */}
          {!is404 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* ============================================================== */}
              {/* PANEL IZQUIERDO: Información Comercial                        */}
              {/* ============================================================== */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-[#23272B]">
                  <CreditCard className="w-4 h-4 text-cyan-400" />
                  <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[#F3F4F6]">
                    Información Comercial
                  </h3>
                </div>

                <div className="bg-[#16191D] border border-[#23272B] rounded-xl p-4 space-y-3.5 text-xs font-mono">
                  {/* Monto Analizado */}
                  <div className="flex items-center justify-between pb-3 border-b border-[#21252A]">
                    <span className="text-[#808893] uppercase text-[10px]">Monto y Divisa</span>
                    <span className="font-bold text-lg text-[#F3F4F6]">
                      ${transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
                      <span className="text-xs text-[#808893] font-normal">{currency}</span>
                    </span>
                  </div>

                  {/* Fecha y Hora */}
                  <div className="flex items-center justify-between">
                    <span className="text-[#808893] flex items-center gap-1.5 text-[11px]">
                      <Clock className="w-3.5 h-3.5 text-[#8A929B]" /> Fecha y Hora
                    </span>
                    <span className="text-[#D1D5DB] text-right font-medium">{formattedDate}</span>
                  </div>

                  {/* Cliente / Usuario Externo */}
                  <div className="flex items-center justify-between">
                    <span className="text-[#808893] flex items-center gap-1.5 text-[11px]">
                      <User className="w-3.5 h-3.5 text-[#8A929B]" /> Cliente
                    </span>
                    <a
                      href={`/profile/${transaction.externalUserId}`}
                      className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold group underline underline-offset-2"
                      title="Ver perfil comportamental del usuario"
                    >
                      {transaction.externalUserId}
                      <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </a>
                  </div>

                  {/* Comercio */}
                  <div className="flex items-center justify-between">
                    <span className="text-[#808893] flex items-center gap-1.5 text-[11px]">
                      <Radio className="w-3.5 h-3.5 text-[#8A929B]" /> Comercio
                    </span>
                    <span className="text-[#D1D5DB] font-medium">{transaction.merchantId}</span>
                  </div>

                  {/* Canal de Operación */}
                  <div className="flex items-center justify-between">
                    <span className="text-[#808893] flex items-center gap-1.5 text-[11px]">
                      <Layers className="w-3.5 h-3.5 text-[#8A929B]" /> Canal
                    </span>
                    <span className="text-[#D1D5DB]">{channel}</span>
                  </div>

                  {/* Tarjeta Enmascarada */}
                  <div className="flex items-center justify-between">
                    <span className="text-[#808893] flex items-center gap-1.5 text-[11px]">
                      <CreditCard className="w-3.5 h-3.5 text-[#8A929B]" /> Tarjeta
                    </span>
                    <span className="text-[#D1D5DB] tracking-wider">{maskedCard}</span>
                  </div>

                  {/* País y Dispositivo */}
                  <div className="flex items-center justify-between">
                    <span className="text-[#808893] flex items-center gap-1.5 text-[11px]">
                      <Globe className="w-3.5 h-3.5 text-[#8A929B]" /> País / Dispositivo
                    </span>
                    <span className="text-[#D1D5DB]">
                      {transaction.country} ·{' '}
                      <span className="text-[#8A929B] text-[10px]">
                        {detail?.deviceId ?? 'D_DESK_DEFAULT'}
                      </span>
                    </span>
                  </div>

                  {/* Dirección IP de Origen */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#21252A]">
                    <span className="text-[#808893] text-[10px]">IP de Origen</span>
                    <span className="text-[#8A929B] text-[11px] font-mono">{ipAddress}</span>
                  </div>
                </div>
              </div>

              {/* ============================================================== */}
              {/* PANEL DERECHO: Análisis Analítico de Riesgo                   */}
              {/* ============================================================== */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#23272B]">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[#F3F4F6]">
                      Evaluación de Riesgo
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-[#8A929B]">
                    Banda: <strong className="text-[#F3F4F6] uppercase">{riskLevel}</strong>
                  </span>
                </div>

                {/* 1. Indicador Radial (Gauge) del Score Consolidado */}
                <div className="bg-[#16191D] border border-[#23272B] rounded-xl p-4 flex flex-col items-center justify-center">
                  <ScoreGauge score={riskScore} riskLevel={riskLevel} size={190} />
                  <p className="text-[11px] font-mono text-[#8A929B] text-center mt-2">
                    Nivel clasificado:{' '}
                    <span className="font-bold text-[#F3F4F6] uppercase">{riskLevel}</span>
                  </p>
                </div>

                {/* 2. Desglose de Tres Fuentes de Señales */}
                <div className="space-y-2.5">
                  {/* Señal 1: Machine Learning Supervisado */}
                  <div className="bg-[#16191D] border border-[#23272B] rounded-xl p-3.5 text-xs font-mono space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[#D1D5DB] font-semibold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                        1. Machine Learning
                      </span>
                      <span className="font-bold text-[#F3F4F6]">
                        {(fraudProbability * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-[#23272B] h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-cyan-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, fraudProbability * 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-[#808893]">
                      <span>Probabilidad de fraude</span>
                      <span>Score continuo: {fraudProbability.toFixed(4)}</span>
                    </div>
                  </div>

                  {/* Señal 2: Análisis de Anomalías (Isolation Forest) */}
                  <div className="bg-[#16191D] border border-[#23272B] rounded-xl p-3.5 text-xs font-mono space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[#D1D5DB] font-semibold flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isAnomalyAlertActive ? 'bg-amber-400' : 'bg-emerald-400'
                          }`}
                        ></span>
                        2. Análisis de Anomalías
                      </span>
                      <span className="font-bold text-[#F3F4F6]">
                        {(anomalyScore * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-[#23272B] h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isAnomalyAlertActive ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, anomalyScore * 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-[#808893]">
                        Score de atipicidad: {anomalyScore.toFixed(4)}
                      </span>
                      {isAnomalyAlertActive ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-semibold">
                          <AlertTriangle className="w-3 h-3" /> Anomalía Detectada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px]">
                          <CheckCircle2 className="w-3 h-3" /> Patrón Regular
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Señal 3: Análisis Conductual (Desviación del Perfil) */}
                  <div className="bg-[#16191D] border border-[#23272B] rounded-xl p-3.5 text-xs font-mono space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[#D1D5DB] font-semibold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                        3. Análisis Conductual
                      </span>
                      <span className="font-bold text-[#F3F4F6]">
                        {(behavioralDeviation * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-[#23272B] h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, behavioralDeviation * 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-[#808893]">
                      <span>Desviación histórica</span>
                      <span>
                        {behavioralDeviation > 0.7
                          ? 'Desviación Severa'
                          : behavioralDeviation > 0.3
                          ? 'Desviación Moderada'
                          : 'Comportamiento Habitual'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Explicaciones del Modelo (FE-07 ExplainabilityPanel) ─────────── */}
          {!is404 && detail && !detailLoading && (
            <ExplainabilityPanel
              explanations={explanations}
              userId={transaction.externalUserId}
              riskLevel={riskLevel}
            />
          )}

          {/* ── Sección de Formulario de Revisión de Alerta (si se abre) ───── */}
          {isReviewOpen && (
            <div className="p-4 rounded-xl bg-[#16191D] border border-cyan-500/30 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wide flex items-center gap-1.5">
                  <FileText className="w-4 h-4" /> Registrar Revisión de Alerta
                </span>
                <button
                  onClick={() => setIsReviewOpen(false)}
                  className="text-[#8A929B] hover:text-white"
                  aria-label="Cancelar revisión"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="review-notes"
                  className="text-[11px] font-mono text-[#8A929B] block"
                >
                  Notas de investigación (opcional, máx 1000 caracteres):
                </label>
                <textarea
                  id="review-notes"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  maxLength={1000}
                  placeholder="Detalla las conclusiones de la investigación operativa..."
                  className="w-full h-20 p-2.5 bg-[#0F1113] border border-[#2B313A] rounded-lg text-xs font-mono text-[#F3F4F6] placeholder-[#808893] focus:border-cyan-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsReviewOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-[#1F2328] hover:bg-[#282E35] text-[#D1D5DB] text-xs font-mono transition-colors border border-[#30363D]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReview}
                  disabled={reviewMutation.isPending}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  {reviewMutation.isPending ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Guardando…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Confirmar Revisión
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Drawer Actions (Footer) ──────────────────────────────────────── */}
        <div className="p-4 border-t border-[#23272B] bg-[#0F1113] flex flex-wrap gap-3 items-center justify-between">
          <div className="flex gap-2">
            {/* Acción A: Crear Alerta Manual */}
            <button
              onClick={handleCreateManualAlert}
              className="px-3 py-2 rounded-lg bg-[#1B1E22] hover:bg-[#252A30] text-[#D1D5DB] hover:text-white text-xs font-mono font-medium flex items-center gap-1.5 transition-colors border border-[#30363D]"
              title="Crear alerta manual (dependencia backend BE-07)"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              Crear Alerta Manual
            </button>
          </div>

          <div className="flex gap-2.5">
            {/* Acción B: Marcar Alerta como Revisada */}
            <button
              onClick={() => setIsReviewOpen((prev) => !prev)}
              disabled={associatedAlert?.status === 'REVIEWED'}
              className={`px-4 py-2 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-colors shadow-sm ${
                associatedAlert?.status === 'REVIEWED'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {associatedAlert?.status === 'REVIEWED' ? 'Alerta ya Revisada' : 'Marcar Alerta como Revisada'}
            </button>

            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg bg-[#1B1E22] hover:bg-[#252A30] text-[#8A929B] hover:text-white text-xs font-mono transition-colors border border-[#30363D]"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
