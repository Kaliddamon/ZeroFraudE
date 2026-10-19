import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchTransactions } from '../services/api/transactions.service';
import { RiskBadge } from '../components/ui/RiskBadge';
import { Search, ChevronLeft, ChevronRight, AlertTriangle, Filter, SlidersHorizontal } from 'lucide-react';
import type { RiskLevel } from '../types/api.types';
import type { TransactionFilters, TransactionSummary } from '../types/transaction.types';
import { format } from 'date-fns';
import { ModelScoreBar } from '@/components/ml/ModelScoreBar';
import { TransactionDetailDrawer } from '@/components/ml/TransactionDetailDrawer';

export default function TransactionExplorer() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchParams.get('externalUserId') || '');
  const [selectedTx, setSelectedTx] = useState<TransactionSummary | null>(null);

  // Parse filters from URL
  const filters: TransactionFilters = {
    page: parseInt(searchParams.get('page') || '0', 10),
    size: parseInt(searchParams.get('size') || '20', 10),
    externalUserId: searchParams.get('externalUserId') || undefined,
    riskLevel: (searchParams.get('riskLevel') as RiskLevel) || undefined,
    sort: 'timestamp,desc',
  };

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      updateFilter('externalUserId', searchInput || null);
      updateFilter('page', '0'); // reset page on search
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => fetchTransactions(filters),
  });

  const updateFilter = (key: string, value: string | null) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams);
  };

  const handlePageChange = (newPage: number) => {
    updateFilter('page', newPage.toString());
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const getSeverityBorder = (level: string) => {
    switch (level) {
      case 'CRITICAL': return 'border-l-4 border-l-red-500';
      case 'HIGH': return 'border-l-4 border-l-orange-500';
      case 'MEDIUM': return 'border-l-4 border-l-amber-500';
      default: return 'border-l-4 border-l-emerald-500';
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* ── Sub-header técnico (Sustituye títulos gigantes) ──────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#1F2328]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-semibold tracking-wider text-[#F3F4F6] uppercase">
            Registro de Ingestión y Decisiones de Riesgo
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            LightGBM v1.1.0
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-[#8A929B]">
          <span>Total evaluadas: </span>
          <strong className="text-[#F3F4F6]">{data?.totalElements ?? '...'}</strong>
        </div>
      </div>

      {/* ── Barra de Filtros Estilo Swiss ───────────────────────────────────── */}
      <div className="bg-[#141618] p-3.5 rounded-xl border border-[#23272B] shadow-sm flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A929B] w-4 h-4" />
          <input
            type="text"
            placeholder="Filtrar por ID de Usuario externo..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 border border-[#282E35] rounded-lg bg-[#1B1E22] text-[#F3F4F6] text-xs font-mono focus:border-[#383E46] outline-none transition-all placeholder:text-[#606770]"
          />
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 bg-[#1B1E22] border border-[#282E35] rounded-lg px-2.5 py-1.5">
            <Filter className="w-3.5 h-3.5 text-[#8A929B]" />
            <select
              className="bg-transparent text-xs font-mono text-[#F3F4F6] outline-none cursor-pointer"
              value={filters.riskLevel || ''}
              onChange={(e) => {
                updateFilter('riskLevel', e.target.value || null);
                updateFilter('page', '0');
              }}
            >
              <option value="" className="bg-[#141618]">Todos los Riesgos</option>
              <option value="CRITICAL" className="bg-[#141618]">Crítico</option>
              <option value="HIGH" className="bg-[#141618]">Alto</option>
              <option value="MEDIUM" className="bg-[#141618]">Medio</option>
              <option value="LOW" className="bg-[#141618]">Bajo</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-[#1B1E22] border border-[#282E35] rounded-lg px-2.5 py-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#8A929B]" />
            <select
              className="bg-transparent text-xs font-mono text-[#F3F4F6] outline-none cursor-pointer"
              value={filters.size || 20}
              onChange={(e) => {
                updateFilter('size', e.target.value);
                updateFilter('page', '0');
              }}
            >
              <option value="10" className="bg-[#141618]">10 / pág</option>
              <option value="20" className="bg-[#141618]">20 / pág</option>
              <option value="50" className="bg-[#141618]">50 / pág</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Error State ─────────────────────────────────────────────────────── */}
      {isError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 flex flex-col items-center gap-3 text-center">
          <AlertTriangle className="w-8 h-8 text-red-400" />
          <p className="text-red-400 font-semibold text-sm font-mono">Error al cargar las transacciones</p>
          <p className="text-[#8A929B] text-xs font-mono max-w-md">
            {(error as any)?.message ?? 'Error desconocido. Revisa la conexión con el servidor.'}
          </p>
        </div>
      )}

      {/* ── Tabla Principal ─────────────────────────────────────────────────── */}
      {!isError && (
        <div className="bg-[#141618] border border-[#23272B] rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1F2328] bg-[#111315] text-[11px] font-mono uppercase tracking-wider text-[#8A929B]">
                  <th className="py-3 px-4">Transacción</th>
                  <th className="py-3 px-4">Fecha / Hora</th>
                  <th className="py-3 px-4">Usuario / País</th>
                  <th className="py-3 px-4">Monto</th>
                  <th className="py-3 px-4">Score de Riesgo</th>
                  <th className="py-3 px-4">Evaluación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2328] text-xs font-mono">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-[#8A929B]">
                      Cargando transacciones...
                    </td>
                  </tr>
                ) : data?.content.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-[#8A929B]">
                      No se encontraron transacciones con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  data?.content.map((tx) => (
                    <tr
                      key={tx.transactionId}
                      onClick={() => setSelectedTx(tx)}
                      className={`hover:bg-[#1A1D20] cursor-pointer transition-colors ${getSeverityBorder(tx.riskLevel)}`}
                    >
                      <td className="py-3 px-4 font-bold text-[#F3F4F6]">
                        {tx.transactionId}
                      </td>
                      <td className="py-3 px-4 text-[#8A929B]">
                        {format(new Date(tx.timestamp), 'dd MMM yyyy, HH:mm')}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#D1D5DB]">{tx.externalUserId}</div>
                        <div className="text-[10px] text-[#606770]">{tx.country}</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-[#F3F4F6]">
                        {formatCurrency(tx.amount)}
                      </td>
                      <td className="py-3 px-4 w-44">
                        <ModelScoreBar score={tx.riskScore} riskLevel={tx.riskLevel} />
                      </td>
                      <td className="py-3 px-4">
                        <RiskBadge level={tx.riskLevel} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {!isLoading && data && (
            <div className="px-5 py-3 border-t border-[#1F2328] flex items-center justify-between bg-[#111315] text-xs font-mono text-[#8A929B]">
              <span>
                Mostrando <strong className="text-[#F3F4F6]">{data.page * data.size + 1}</strong> - <strong className="text-[#F3F4F6]">{Math.min((data.page + 1) * data.size, data.totalElements)}</strong> de <strong className="text-[#F3F4F6]">{data.totalElements}</strong>
              </span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => handlePageChange(data.page - 1)}
                  disabled={data.page === 0}
                  className="p-1.5 rounded-lg border border-[#282E35] bg-[#141618] text-[#8A929B] hover:text-white hover:bg-[#1B1E22] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handlePageChange(data.page + 1)}
                  disabled={data.page >= data.totalPages - 1}
                  className="p-1.5 rounded-lg border border-[#282E35] bg-[#141618] text-[#8A929B] hover:text-white hover:bg-[#1B1E22] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Drawer con explicabilidad SHAP al hacer clic */}
      <TransactionDetailDrawer
        transaction={selectedTx}
        onClose={() => setSelectedTx(null)}
      />
    </div>
  );
}
