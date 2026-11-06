import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Filter,
  RefreshCw,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  ShieldAlert,
  FileSearch,
  X,
} from 'lucide-react';

import { fetchAlerts, reviewAlert } from '@/services/api/alerts.service';
import { RiskBadge } from '@/components/ui/RiskBadge';
import { TransactionDetailDrawer } from '@/components/ml/TransactionDetailDrawer';
import type { Alert, AlertDecision } from '@/types/alert.types';
import type { AlertStatus, AlertSeverity } from '@/types/api.types';
import type { TransactionSummary } from '@/types/transaction.types';

// ─── Toast ───────────────────────────────────────────────────────────────────

interface ToastState {
  message: string;
  type: 'success' | 'error';
}

// ─── Decision badge ───────────────────────────────────────────────────────────

const DecisionBadge: React.FC<{ decision?: AlertDecision | null }> = ({ decision }) => {
  if (!decision) return null;
  const cfg =
    decision === 'FRAUD_CONFIRMED'
      ? { cls: 'bg-red-500/15 text-red-400 border-red-500/35', label: 'Fraude Confirmado' }
      : decision === 'FALSE_POSITIVE'
      ? { cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25', label: 'Falso Positivo' }
      : { cls: 'bg-amber-500/10 text-amber-400 border-amber-500/25', label: 'Requiere Seguimiento' };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-medium border ${cfg.cls}`}
      role="status"
      aria-label={`Resolución: ${cfg.label}`}
    >
      {cfg.label}
    </span>
  );
};

// ─── Severity badge ───────────────────────────────────────────────────────────

const SeverityBadge: React.FC<{ severity: AlertSeverity }> = ({ severity }) => {
  const cfg = severity === 'CRITICAL'
    ? { cls: 'bg-red-500/15 text-red-400 border-red-500/35', Icon: ShieldAlert, label: 'Crítica' }
    : { cls: 'bg-orange-500/10 text-orange-400 border-orange-500/25', Icon: AlertTriangle, label: 'Alta' };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-medium border ${cfg.cls}`}
    >
      <cfg.Icon className="w-3 h-3" aria-hidden="true" />
      {cfg.label}
    </span>
  );
};

// ─── Status badge ─────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: AlertStatus }> = ({ status }) =>
  status === 'OPEN' ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-medium border bg-sky-500/10 text-sky-400 border-sky-500/25">
      <Clock className="w-3 h-3" aria-hidden="true" />
      Abierta
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-medium border bg-emerald-500/10 text-emerald-400 border-emerald-500/25">
      <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
      Revisada
    </span>
  );

// ─── Filters ──────────────────────────────────────────────────────────────────

interface Filters {
  status: AlertStatus | '';
  severity: AlertSeverity | '';
}

// ─── Main component ───────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

export const AlertCenter: React.FC = () => {
  const qc = useQueryClient();

  // Filters & pagination
  const [filters, setFilters] = useState<Filters>({ status: '', severity: '' });
  const [page, setPage] = useState(0);

  // Selected transaction for drawer
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionSummary | null>(null);

  // Toast
  const [toast, setToast] = useState<ToastState | null>(null);
  const showToast = useCallback((message: string, type: ToastState['type']) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Fetch alerts list
  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['alerts', filters, page],
    queryFn: () =>
      fetchAlerts({
        page,
        size: PAGE_SIZE,
        ...(filters.status ? { status: filters.status as AlertStatus } : {}),
        ...(filters.severity ? { severity: filters.severity as AlertSeverity } : {}),
      }),
    placeholderData: (prev) => prev,
  });

  // Review mutation — used for quick-review from the table (not the drawer)
  const reviewMutation = useMutation({
    mutationFn: ({ id, decision, notes }: { id: string; decision: AlertDecision; notes?: string }) =>
      reviewAlert(id, { decision, notes }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['alerts'] });
      showToast('Alerta marcada como REVISADA.', 'success');
    },
    onError: () => {
      showToast('No se pudo completar la revisión. Intente nuevamente.', 'error');
    },
  });

  // Derived
  const alerts: Alert[] = data?.content ?? [];
  const totalPages = data?.totalPages ?? 1;
  const totalElements = data?.totalElements ?? 0;

  // Open drawer from alert
  const handleOpenDrawer = (alert: Alert) => {
    setSelectedTransaction({
      transactionId: alert.transactionId,
      externalUserId: '',
      amount: 0,
      timestamp: alert.createdAt,
      country: '—',
      merchantId: '—',
      riskLevel: alert.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
      riskScore: alert.riskScore,
    });
  };

  // When drawer closes → clear selection
  const handleDrawerClose = useCallback(() => {
    setSelectedTransaction(null);
    // Refresh list in case a review happened inside the drawer
    void qc.invalidateQueries({ queryKey: ['alerts'] });
  }, [qc]);

  // Filter change resets to page 0
  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#282E35] border border-[#3A4149]">
            <Bell className="w-5 h-5 text-[#C778DD]" />
          </div>
          <div>
            <h1 className="text-lg font-mono font-bold text-[#F3F4F6]">Centro de Alertas</h1>
            <p className="text-xs font-mono text-[#8A929B]">
              Gestión y revisión operativa de alertas de fraude
            </p>
          </div>
        </div>
        <button
          onClick={() => void refetch()}
          disabled={isFetching}
          aria-label="Actualizar lista de alertas"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#282E35] bg-[#141618] text-xs font-mono text-[#8A929B] hover:text-[#F3F4F6] hover:border-[#3A4149] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs font-mono text-[#8A929B]">
          <Filter className="w-3.5 h-3.5" />
          Filtros:
        </div>

        <select
          value={filters.status}
          onChange={(e) => handleFilterChange('status', e.target.value)}
          aria-label="Filtrar por estado"
          className="px-3 py-1.5 rounded-lg border border-[#282E35] bg-[#141618] text-xs font-mono text-[#F3F4F6] focus:outline-none focus:border-[#C778DD] transition-colors"
        >
          <option value="">Todos los estados</option>
          <option value="OPEN">Abiertas</option>
          <option value="REVIEWED">Revisadas</option>
        </select>

        <select
          value={filters.severity}
          onChange={(e) => handleFilterChange('severity', e.target.value)}
          aria-label="Filtrar por severidad"
          className="px-3 py-1.5 rounded-lg border border-[#282E35] bg-[#141618] text-xs font-mono text-[#F3F4F6] focus:outline-none focus:border-[#C778DD] transition-colors"
        >
          <option value="">Todas las severidades</option>
          <option value="CRITICAL">Crítica</option>
          <option value="HIGH">Alta</option>
        </select>

        {(filters.status || filters.severity) && (
          <button
            onClick={() => { setFilters({ status: '', severity: '' }); setPage(0); }}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-[#282E35] bg-[#141618] text-xs font-mono text-[#8A929B] hover:text-red-400 hover:border-red-500/40 transition-colors"
          >
            <X className="w-3 h-3" />
            Limpiar
          </button>
        )}

        {!isLoading && (
          <span className="ml-auto text-xs font-mono text-[#8A929B]">
            {totalElements} {totalElements === 1 ? 'alerta' : 'alertas'}
          </span>
        )}
      </div>

      {/* ── Error state ── */}
      {isError && (
        <div
          role="alert"
          className="flex items-center gap-3 p-4 rounded-xl border border-red-500/30 bg-red-500/5 text-sm font-mono text-red-400"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Error al cargar las alertas. Verifica la conexión con el backend.
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {isLoading && (
        <div
          aria-label="Cargando alertas"
          className="space-y-2"
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-14 rounded-xl bg-[#141618] border border-[#282E35] animate-pulse"
            />
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {!isLoading && !isError && alerts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
          <FileSearch className="w-12 h-12 text-[#3A4149]" />
          <p className="text-sm font-mono text-[#8A929B]">No se encontraron alertas con los filtros seleccionados.</p>
        </div>
      )}

      {/* ── Table ── */}
      {!isLoading && !isError && alerts.length > 0 && (
        <div className="border border-[#282E35] rounded-xl overflow-hidden">
          <table className="w-full text-xs font-mono" aria-label="Lista de alertas">
            <thead>
              <tr className="border-b border-[#282E35] bg-[#141618]">
                <th className="text-left px-4 py-3 text-[#8A929B] font-medium">ID Alerta</th>
                <th className="text-left px-4 py-3 text-[#8A929B] font-medium">Severidad</th>
                <th className="text-left px-4 py-3 text-[#8A929B] font-medium">Descripción</th>
                <th className="text-left px-4 py-3 text-[#8A929B] font-medium">Riesgo</th>
                <th className="text-left px-4 py-3 text-[#8A929B] font-medium">Estado</th>
                <th className="text-left px-4 py-3 text-[#8A929B] font-medium">Resolución</th>
                <th className="text-left px-4 py-3 text-[#8A929B] font-medium">Fecha</th>
                <th className="text-left px-4 py-3 text-[#8A929B] font-medium">Acción</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert, idx) => (
                <tr
                  key={alert.alertId}
                  className={`border-b border-[#1E2328] hover:bg-[#1A1E23] transition-colors ${idx % 2 === 0 ? 'bg-[#0F1114]' : 'bg-[#141618]'}`}
                >
                  <td className="px-4 py-3 text-[#C778DD]">{alert.alertId}</td>
                  <td className="px-4 py-3">
                    <SeverityBadge severity={alert.severity} />
                  </td>
                  <td className="px-4 py-3 text-[#D0D5DD] max-w-xs truncate" title={alert.description}>
                    {alert.description}
                  </td>
                  <td className="px-4 py-3">
                    <RiskBadge level={alert.riskScore >= 0.5 ? 'CRITICAL' : alert.riskScore >= 0.25 ? 'HIGH' : alert.riskScore >= 0.05 ? 'MEDIUM' : 'LOW'} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={alert.status} />
                  </td>
                  <td className="px-4 py-3">
                    {alert.decision ? (
                      <DecisionBadge decision={alert.decision} />
                    ) : alert.status === 'REVIEWED' ? (
                      <span className="text-[#8A929B] text-xs font-mono">Revisada</span>
                    ) : (
                      <span className="text-sky-400/70 text-xs font-mono">Pendiente</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#8A929B]">
                    {new Date(alert.createdAt).toLocaleString('es-CO', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleOpenDrawer(alert)}
                      aria-label={`Ver detalle de alerta ${alert.alertId}`}
                      className="px-2.5 py-1 rounded-md border border-[#282E35] bg-[#1E2328] text-[#8A929B] hover:text-[#F3F4F6] hover:border-[#3A4149] transition-colors text-xs"
                    >
                      Ver detalle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#282E35] bg-[#141618]">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                aria-label="Página anterior"
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#282E35] text-xs font-mono text-[#8A929B] hover:text-[#F3F4F6] disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Anterior
              </button>
              <span className="text-xs font-mono text-[#8A929B]">
                Página {page + 1} de {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                aria-label="Página siguiente"
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#282E35] text-xs font-mono text-[#8A929B] hover:text-[#F3F4F6] disabled:opacity-40 transition-colors"
              >
                Siguiente
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-mono shadow-xl transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-900/80 border-emerald-500/40 text-emerald-300'
              : 'bg-red-900/80 border-red-500/40 text-red-300'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertTriangle className="w-4 h-4" />
          )}
          {toast.message}
        </div>
      )}

      {/* ── Transaction Detail Drawer ── */}
      {selectedTransaction && (
        <TransactionDetailDrawer
          transaction={selectedTransaction}
          onClose={handleDrawerClose}
        />
      )}

      {/* Suppress unused reviewMutation warning — available for future quick-action buttons */}
      {reviewMutation.isPending && null}
    </div>
  );
};

export default AlertCenter;
