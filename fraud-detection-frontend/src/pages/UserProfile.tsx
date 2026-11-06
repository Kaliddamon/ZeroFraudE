import React, { useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient, AppError } from '@/services/api/apiClient';
import { fetchTransactionDetail, fetchUserTransactions } from '@/services/api/transactions.service';
import type { UserBehavior } from '@/types/alert.types';
import type { TransactionSummary } from '@/types/transaction.types';
import { RiskBadge } from '@/components/ui/RiskBadge';
import { TransactionDetailDrawer } from '@/components/ml/TransactionDetailDrawer';
import {
  User,
  Clock,
  Globe,
  Monitor,
  ShoppingBag,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Activity,
  Snowflake,
  ChevronLeft,
  ChevronRight,
  Info,
  DollarSign,
  Smartphone,
  MapPin,
  Timer,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Eye,
} from 'lucide-react';

// ─── Service call ─────────────────────────────────────────────────────────────

const fetchUserBehavior = async (userId: string): Promise<UserBehavior> => {
  const { data } = await apiClient.get<UserBehavior>(`/users/${userId}/behavior`);
  return data;
};

// ─── MetricTile ──────────────────────────────────────────────────────────────

interface MetricTileProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  iconColor?: string;
}

const MetricTile: React.FC<MetricTileProps> = ({
  icon: Icon,
  label,
  value,
  sub,
  iconColor = 'text-[#C778DD]',
}) => (
  <div className="border border-[#282E35] bg-[#141618] rounded-xl p-4 space-y-2">
    <div className="flex items-center gap-2">
      <Icon className={`w-4 h-4 ${iconColor}`} aria-hidden="true" />
      <span className="text-xs font-mono text-[#8A929B]">{label}</span>
    </div>
    <p className="text-lg font-mono font-bold text-[#F3F4F6]">{value}</p>
    {sub && <p className="text-xs font-mono text-[#8A929B]">{sub}</p>}
  </div>
);

// ─── ChipList ────────────────────────────────────────────────────────────────

const ChipList: React.FC<{ items: string[]; emptyLabel?: string }> = ({
  items,
  emptyLabel = '—',
}) =>
  items.length === 0 ? (
    <span className="text-xs font-mono text-[#8A929B]">{emptyLabel}</span>
  ) : (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="px-2 py-0.5 rounded-full border border-[#282E35] bg-[#1A1E23] text-xs font-mono text-[#D0D5DD]"
        >
          {item}
        </span>
      ))}
    </div>
  );

// ─── Cold Start indicator ────────────────────────────────────────────────────

const COLD_START_THRESHOLD = 5;

const ColdStartBanner: React.FC = () => (
  <div
    role="note"
    aria-label="Perfil de arranque en frío"
    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-sky-500/30 bg-sky-500/5"
  >
    <Snowflake className="w-5 h-5 text-sky-400 shrink-0" />
    <div>
      <p className="text-sm font-mono font-semibold text-sky-300">Perfil Cold Start</p>
      <p className="text-xs font-mono text-[#8A929B]">
        Este usuario tiene pocas transacciones registradas. El modelo opera con menor contexto
        histórico y las predicciones pueden ser menos precisas.
      </p>
    </div>
  </div>
);

// ─── Risk Summary panel ───────────────────────────────────────────────────────

interface RiskSummaryPanelProps {
  summary: UserBehavior['riskSummary'];
}

const RiskSummaryPanel: React.FC<RiskSummaryPanelProps> = ({ summary }) => (
  <div className="border border-[#282E35] bg-[#141618] rounded-xl p-4 space-y-3">
    <h3 className="text-xs font-mono font-semibold text-[#8A929B] uppercase tracking-widest">
      Resumen de Riesgo
    </h3>
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="flex items-center gap-1.5 text-orange-400">
          <AlertTriangle className="w-3.5 h-3.5" /> Alto riesgo
        </span>
        <span className="text-[#F3F4F6] font-semibold">{summary.totalHighRisk}</span>
      </div>
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="flex items-center gap-1.5 text-amber-400">
          <TrendingUp className="w-3.5 h-3.5" /> Riesgo medio
        </span>
        <span className="text-[#F3F4F6] font-semibold">{summary.totalMediumRisk}</span>
      </div>
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="flex items-center gap-1.5 text-red-400">
          <CheckCircle2 className="w-3.5 h-3.5" /> Fraude confirmado
        </span>
        <span
          className={`font-semibold ${summary.fraudConfirmed > 0 ? 'text-red-400' : 'text-emerald-400'}`}
        >
          {summary.fraudConfirmed}
        </span>
      </div>
    </div>
  </div>
);

// ─── Comparison Row ───────────────────────────────────────────────────────────

type ComparisonState = 'match' | 'deviation' | 'unknown';

interface ComparisonRowProps {
  icon: React.ElementType;
  label: string;
  currentValue: string;
  baselineLabel: string;
  state: ComparisonState;
  iconColor?: string;
}

const ComparisonRow: React.FC<ComparisonRowProps> = ({
  icon: Icon,
  label,
  currentValue,
  baselineLabel,
  state,
  iconColor = 'text-[#8A929B]',
}) => {
  const stateConfig: Record<ComparisonState, { badge: string; icon: React.ElementType; label: string }> = {
    match:     { badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25', icon: CheckCircle,  label: 'Habitual'  },
    deviation: { badge: 'bg-orange-500/10 text-orange-400 border-orange-500/25',    icon: AlertCircle,  label: 'Desviación' },
    unknown:   { badge: 'bg-zinc-800/60 text-zinc-400 border-zinc-700/40',           icon: HelpCircle,   label: 'Sin datos'  },
  };
  const cfg = stateConfig[state];
  const StateIcon = cfg.icon;

  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-[#1E2328] last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        <Icon className={`w-3.5 h-3.5 shrink-0 ${iconColor}`} aria-hidden />
        <div className="min-w-0">
          <p className="text-xs font-mono text-[#8A929B]">{label}</p>
          <p className="text-xs font-mono font-semibold text-[#F3F4F6] truncate">{currentValue}</p>
          <p className="text-[10px] font-mono text-[#5A6270] truncate">{baselineLabel}</p>
        </div>
      </div>
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border shrink-0 ${cfg.badge}`}
        aria-label={cfg.label}
      >
        <StateIcon className="w-3 h-3" />
        {cfg.label}
      </span>
    </div>
  );
};

// ─── TransactionComparisonPanel ───────────────────────────────────────────────

interface TransactionComparisonPanelProps {
  txId: string;
  behavior: UserBehavior;
  isColdStart: boolean;
}

const TransactionComparisonPanel: React.FC<TransactionComparisonPanelProps> = ({
  txId,
  behavior,
  isColdStart,
}) => {
  const {
    data: tx,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['transactionDetail', txId],
    queryFn: () => fetchTransactionDetail(txId),
    enabled: !!txId,
  });

  if (isLoading) {
    return (
      <div
        role="region"
        aria-label="Cargando comparación de transacción"
        className="border border-[#282E35] bg-[#141618] rounded-xl p-4 space-y-3 animate-pulse"
      >
        <div className="h-4 w-48 rounded bg-[#282E35]" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-10 rounded bg-[#1A1E23]" />
        ))}
      </div>
    );
  }

  if (isError || !tx) {
    return (
      <div
        role="alert"
        className="border border-red-500/20 bg-red-500/5 rounded-xl p-4 flex items-center gap-2 text-xs font-mono text-red-400"
      >
        <AlertCircle className="w-4 h-4 shrink-0" />
        No se pudo cargar el detalle de la transacción {txId}.
      </div>
    );
  }

  // ── Cold start: not enough statistical context ──
  if (isColdStart) {
    return (
      <div
        role="region"
        aria-label="Comparación — Cold Start"
        className="border border-sky-500/20 bg-sky-500/5 rounded-xl p-4 space-y-3"
      >
        <div className="flex items-center gap-2">
          <Snowflake className="w-4 h-4 text-sky-400 shrink-0" />
          <h3 className="text-xs font-mono font-semibold text-sky-300 uppercase tracking-widest">
            Comparación con perfil histórico
          </h3>
        </div>
        <p className="text-xs font-mono text-[#8A929B]">
          El perfil tiene{' '}
          <span className="text-sky-300 font-semibold">{behavior.transactionCount}</span>{' '}
          transacciones registradas. Con menos de {COLD_START_THRESHOLD} transacciones, las líneas base
          estadísticas son insuficientes para una comparación concluyente. Los indicadores mostrados
          tienen una fiabilidad reducida.
        </p>
        <ColdStartComparisonRows tx={tx} behavior={behavior} />
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Comparación con perfil histórico"
      className="border border-[#282E35] bg-[#141618] rounded-xl p-4 space-y-1"
    >
      <h3 className="text-xs font-mono font-semibold text-[#8A929B] uppercase tracking-widest mb-3">
        Comparación — TX vs. Perfil histórico
      </h3>
      <p className="text-[10px] font-mono text-[#5A6270] mb-3">
        Transacción:{' '}
        <span className="text-[#C778DD]">{txId}</span>
      </p>
      <ColdStartComparisonRows tx={tx} behavior={behavior} />
    </div>
  );
};

/** Shared comparison rows — used both in cold start and normal mode */
const ColdStartComparisonRows: React.FC<{
  tx: import('@/types/transaction.types').TransactionDetail;
  behavior: UserBehavior;
}> = ({ tx, behavior }) => {
  // Amount ratio
  const amountRatio = behavior.averageAmount > 0 ? tx.amount / behavior.averageAmount : null;
  const amountState: ComparisonState =
    amountRatio === null ? 'unknown' : amountRatio <= 2 ? 'match' : 'deviation';
  const amountLabel =
    amountRatio !== null
      ? `Base: $${behavior.averageAmount.toLocaleString('es-CO', { minimumFractionDigits: 2 })} promedio`
      : 'Sin datos de promedio';
  const amountCurrent =
    amountRatio !== null
      ? `$${tx.amount.toLocaleString('es-CO', { minimumFractionDigits: 2 })} (${amountRatio.toFixed(1)}× promedio)`
      : `$${tx.amount.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`;

  // Country
  const countryMatch = behavior.typicalCountries.includes(tx.country);
  const countryState: ComparisonState = behavior.typicalCountries.length === 0 ? 'unknown' : countryMatch ? 'match' : 'deviation';
  const countryBase =
    behavior.typicalCountries.length > 0
      ? `Habituales: ${behavior.typicalCountries.join(', ')}`
      : 'Sin países registrados';

  // Device
  const deviceMatch = behavior.knownDevices.includes(tx.deviceId);
  const deviceState: ComparisonState = behavior.knownDevices.length === 0 ? 'unknown' : deviceMatch ? 'match' : 'deviation';
  const deviceBase =
    behavior.knownDevices.length > 0
      ? `Conocidos: ${behavior.knownDevices.slice(0, 2).join(', ')}${behavior.knownDevices.length > 2 ? ' …' : ''}`
      : 'Sin dispositivos registrados';

  // Merchant
  const merchantMatch = behavior.topMerchants.includes(tx.merchantId);
  const merchantState: ComparisonState = behavior.topMerchants.length === 0 ? 'unknown' : merchantMatch ? 'match' : 'deviation';
  const merchantBase =
    behavior.topMerchants.length > 0
      ? `Top: ${behavior.topMerchants.slice(0, 3).join(', ')}`
      : 'Sin datos de comercios';

  // Hour: typicalHourRange format "HH:MM–HH:MM" or "HH:MM-HH:MM"
  const txHour = new Date(tx.timestamp).getUTCHours();
  let hourState: ComparisonState = 'unknown';
  const rangeMatch = behavior.typicalHourRange.match(/(\d{1,2}):(\d{2})[–-](\d{1,2}):(\d{2})/);
  if (rangeMatch) {
    const startH = parseInt(rangeMatch[1]);
    const endH   = parseInt(rangeMatch[3]);
    hourState = txHour >= startH && txHour < endH ? 'match' : 'deviation';
  }
  const hourCurrent = `${String(txHour).padStart(2, '0')}:${String(new Date(tx.timestamp).getUTCMinutes()).padStart(2, '0')} UTC`;
  const hourBase = `Horario típico: ${behavior.typicalHourRange}`;

  return (
    <div>
      <ComparisonRow
        icon={DollarSign}
        label="Monto"
        currentValue={amountCurrent}
        baselineLabel={amountLabel}
        state={amountState}
        iconColor="text-emerald-400"
      />
      <ComparisonRow
        icon={MapPin}
        label="País"
        currentValue={tx.country}
        baselineLabel={countryBase}
        state={countryState}
        iconColor="text-sky-400"
      />
      <ComparisonRow
        icon={Smartphone}
        label="Dispositivo"
        currentValue={tx.deviceId}
        baselineLabel={deviceBase}
        state={deviceState}
        iconColor="text-indigo-400"
      />
      <ComparisonRow
        icon={ShoppingBag}
        label="Comercio"
        currentValue={tx.merchantId}
        baselineLabel={merchantBase}
        state={merchantState}
        iconColor="text-[#C778DD]"
      />
      <ComparisonRow
        icon={Timer}
        label="Hora"
        currentValue={hourCurrent}
        baselineLabel={hourBase}
        state={hourState}
        iconColor="text-amber-400"
      />
    </div>
  );
};

// ─── NoTxContextCard ─────────────────────────────────────────────────────────

const NoTxContextCard: React.FC = () => (
  <div
    role="region"
    aria-label="Sin transacción seleccionada para comparación"
    className="border border-[#282E35] bg-[#141618] rounded-xl p-5 flex items-start gap-3"
  >
    <Info className="w-5 h-5 text-[#5A6270] shrink-0 mt-0.5" />
    <div className="space-y-1">
      <p className="text-sm font-mono font-semibold text-[#8A929B]">
        Sin transacción seleccionada
      </p>
      <p className="text-xs font-mono text-[#5A6270]">
        Para comparar una transacción con este perfil, ábrela desde el{' '}
        <span className="text-[#C778DD]">Explorador de Transacciones</span> o desde el{' '}
        <span className="text-[#C778DD]">Centro de Alertas</span> y selecciona{' '}
        "Consultar Perfil" en el panel de explicabilidad.
      </p>
    </div>
  </div>
);

// ─── UserTransactionHistory ───────────────────────────────────────────────────

const PAGE_SIZE = 5;

interface UserTransactionHistoryProps {
  userId: string;
  onSelectTransaction: (tx: TransactionSummary) => void;
}

const UserTransactionHistory: React.FC<UserTransactionHistoryProps> = ({
  userId,
  onSelectTransaction,
}) => {
  const [page, setPage] = useState(0);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['userTransactions', userId, page],
    queryFn: () => fetchUserTransactions(userId, { page, size: PAGE_SIZE }),
    enabled: !!userId,
    placeholderData: (prev) => prev,
  });

  if (isLoading && !data) {
    return (
      <div
        aria-label="Cargando historial de transacciones"
        className="border border-[#282E35] bg-[#141618] rounded-xl p-4 space-y-3 animate-pulse"
      >
        <div className="h-4 w-48 rounded bg-[#282E35]" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 rounded bg-[#1A1E23]" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="border border-red-500/20 bg-red-500/5 rounded-xl p-4 flex items-center gap-2 text-xs font-mono text-red-400"
      >
        <AlertTriangle className="w-4 h-4 shrink-0" />
        Error al cargar el historial de transacciones.
      </div>
    );
  }

  const transactions = data?.content ?? [];
  const totalPages   = data?.totalPages ?? 0;
  const totalElements = data?.totalElements ?? 0;

  return (
    <div className="border border-[#282E35] bg-[#141618] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#282E35]">
        <h3 className="text-xs font-mono font-semibold text-[#8A929B] uppercase tracking-widest">
          Historial de Transacciones
        </h3>
        {totalElements > 0 && (
          <span className="text-[10px] font-mono text-[#5A6270]">
            {totalElements} transacción{totalElements !== 1 ? 'es' : ''}
          </span>
        )}
      </div>

      {/* Empty */}
      {transactions.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
          <Activity className="w-8 h-8 text-[#3A4149]" />
          <p className="text-xs font-mono text-[#8A929B]">No hay transacciones registradas</p>
        </div>
      )}

      {/* Table */}
      {transactions.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono" aria-label="Historial de transacciones del usuario">
            <thead>
              <tr className="border-b border-[#282E35] text-[#5A6270] text-[10px] uppercase tracking-wider">
                <th className="px-4 py-2 text-left">ID</th>
                <th className="px-4 py-2 text-left">Fecha / Hora</th>
                <th className="px-4 py-2 text-right">Monto</th>
                <th className="px-4 py-2 text-left">Comercio</th>
                <th className="px-4 py-2 text-left">País</th>
                <th className="px-4 py-2 text-left">Riesgo</th>
                <th className="px-4 py-2 text-center">Acción</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr
                  key={tx.transactionId}
                  className="border-b border-[#1E2328] last:border-0 hover:bg-[#1A1E23] transition-colors"
                >
                  <td className="px-4 py-2.5 text-[#C778DD]">{tx.transactionId}</td>
                  <td className="px-4 py-2.5 text-[#8A929B] whitespace-nowrap">
                    {new Date(tx.timestamp).toLocaleString('es-CO', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-2.5 text-right text-[#F3F4F6] font-semibold whitespace-nowrap">
                    ${tx.amount.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2.5 text-[#D0D5DD]">{tx.merchantId}</td>
                  <td className="px-4 py-2.5 text-[#D0D5DD]">{tx.country}</td>
                  <td className="px-4 py-2.5">
                    <RiskBadge level={tx.riskLevel} />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button
                      onClick={() => onSelectTransaction(tx)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#1F2328] hover:bg-[#282E35] text-cyan-400 hover:text-cyan-300 border border-[#30363D] text-[10px] transition-colors"
                      aria-label={`Ver detalle de ${tx.transactionId}`}
                    >
                      <Eye className="w-3 h-3" />
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#282E35]">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#1F2328] hover:bg-[#282E35] disabled:opacity-40 disabled:cursor-not-allowed text-[#D0D5DD] border border-[#30363D] text-xs transition-colors"
            aria-label="Página anterior"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Anterior
          </button>
          <span className="text-[10px] font-mono text-[#5A6270]">
            Página {page + 1} de {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#1F2328] hover:bg-[#282E35] disabled:opacity-40 disabled:cursor-not-allowed text-[#D0D5DD] border border-[#30363D] text-xs transition-colors"
            aria-label="Página siguiente"
          >
            Siguiente <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export const UserProfile: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const [searchParams] = useSearchParams();
  const txId = searchParams.get('txId') ?? undefined;

  const [selectedTx, setSelectedTx] = useState<import('@/types/transaction.types').TransactionSummary | null>(null);

  const {
    data: behavior,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['userBehavior', userId],
    queryFn: () => fetchUserBehavior(userId!),
    enabled: !!userId,
  });

  // ── Missing userId (route rendered without param) ─────────────────────────
  if (!userId) {
    return (
      <div className="p-8 text-center space-y-4">
        <User className="w-12 h-12 text-[#3A4149] mx-auto" />
        <p className="text-sm font-mono text-[#8A929B]">
          No se especificó un ID de usuario. Accede al perfil desde el panel de una transacción.
        </p>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-5" aria-label="Cargando perfil de usuario">
        <div className="h-10 w-48 rounded-xl bg-[#141618] border border-[#282E35] animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-[#141618] border border-[#282E35] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (isError) {
    const is404 =
      (error instanceof AppError && error.statusCode === 404) ||
      (error as { statusCode?: number })?.statusCode === 404 ||
      (error as { status?: number })?.status === 404;
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-4">
        <Link
          to="/transactions"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-[#8A929B] hover:text-[#F3F4F6] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Volver a transacciones
        </Link>
        <div
          role="alert"
          className="flex items-center gap-3 p-4 rounded-xl border border-red-500/30 bg-red-500/5 text-sm font-mono text-red-400"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {is404
            ? `No se encontró un perfil para el usuario "${userId}".`
            : 'Error al cargar el perfil conductual. Verifica la conexión con el backend.'}
        </div>
      </div>
    );
  }

  if (!behavior) return null;

  const isColdStart = behavior.transactionCount < COLD_START_THRESHOLD;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* ── Back link ── */}
      <Link
        to="/transactions"
        className="inline-flex items-center gap-1.5 text-xs font-mono text-[#8A929B] hover:text-[#F3F4F6] transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Volver a transacciones
      </Link>

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-lg bg-[#282E35] border border-[#3A4149]">
          <User className="w-5 h-5 text-[#C778DD]" />
        </div>
        <div>
          <h1 className="text-lg font-mono font-bold text-[#F3F4F6]">
            Perfil de Comportamiento
          </h1>
          <p className="text-xs font-mono text-[#8A929B]">
            Usuario:{' '}
            <span className="text-[#C778DD]">{behavior.externalUserId}</span>
          </p>
        </div>
      </div>

      {/* ── Cold start banner ── */}
      {isColdStart && <ColdStartBanner />}

      {/* ── Key metrics ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricTile
          icon={Activity}
          label="Total transacciones"
          value={behavior.transactionCount}
          sub="historial conocido"
        />
        <MetricTile
          icon={TrendingUp}
          label="Monto promedio"
          value={`$${behavior.averageAmount.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`}
          sub="por transacción"
          iconColor="text-emerald-400"
        />
        <MetricTile
          icon={Clock}
          label="Horario típico"
          value={behavior.typicalHourRange}
          sub="rango habitual"
          iconColor="text-amber-400"
        />
        <MetricTile
          icon={Activity}
          label="Última actividad"
          value={new Date(behavior.lastActivityAt).toLocaleDateString('es-CO', {
            day: '2-digit', month: 'short', year: 'numeric',
          })}
          iconColor="text-sky-400"
        />
      </div>

      {/* ── Detail panels ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Geographic / device */}
        <div className="border border-[#282E35] bg-[#141618] rounded-xl p-4 space-y-4">
          <h3 className="text-xs font-mono font-semibold text-[#8A929B] uppercase tracking-widest">
            Geografía y Dispositivos
          </h3>
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Globe className="w-3.5 h-3.5 text-sky-400" />
                <span className="text-xs font-mono text-[#8A929B]">Países habituales</span>
              </div>
              <ChipList items={behavior.typicalCountries} emptyLabel="Sin países registrados" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Monitor className="w-3.5 h-3.5 text-sky-400" />
                <span className="text-xs font-mono text-[#8A929B]">Dispositivos conocidos</span>
              </div>
              <ChipList items={behavior.knownDevices} emptyLabel="Sin dispositivos registrados" />
            </div>
          </div>
        </div>

        {/* Merchants */}
        <div className="border border-[#282E35] bg-[#141618] rounded-xl p-4 space-y-4">
          <h3 className="text-xs font-mono font-semibold text-[#8A929B] uppercase tracking-widest">
            Comercios Frecuentes
          </h3>
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <ShoppingBag className="w-3.5 h-3.5 text-[#C778DD]" />
              <span className="text-xs font-mono text-[#8A929B]">Top comercios</span>
            </div>
            <ChipList items={behavior.topMerchants} emptyLabel="Sin datos de comercios" />
          </div>
        </div>
      </div>

      {/* ── Risk summary ── */}
      <RiskSummaryPanel summary={behavior.riskSummary} />

      {/* ── Comparison Panel ── */}
      <section aria-labelledby="comparison-heading">
        <h2
          id="comparison-heading"
          className="text-xs font-mono font-semibold text-[#8A929B] uppercase tracking-widest mb-3"
        >
          Análisis Comparativo
        </h2>
        {txId ? (
          <TransactionComparisonPanel
            txId={txId}
            behavior={behavior}
            isColdStart={isColdStart}
          />
        ) : (
          <NoTxContextCard />
        )}
      </section>

      {/* ── Transaction History ── */}
      <section aria-labelledby="history-heading">
        <h2
          id="history-heading"
          className="text-xs font-mono font-semibold text-[#8A929B] uppercase tracking-widest mb-3"
        >
          Historial Cronológico
        </h2>
        <UserTransactionHistory
          userId={userId}
          onSelectTransaction={setSelectedTx}
        />
      </section>

      {/* ── TransactionDetailDrawer ── */}
      <TransactionDetailDrawer
        transaction={selectedTx}
        onClose={() => setSelectedTx(null)}
      />
    </div>
  );
};

export default UserProfile;
