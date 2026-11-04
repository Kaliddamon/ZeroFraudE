import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient, AppError } from '@/services/api/apiClient';
import type { UserBehavior } from '@/types/alert.types';
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

// ─── Main component ───────────────────────────────────────────────────────────

export const UserProfile: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();

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
    </div>
  );
};

export default UserProfile;
