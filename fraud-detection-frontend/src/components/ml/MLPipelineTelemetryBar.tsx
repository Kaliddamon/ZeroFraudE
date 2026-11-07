import React from 'react';
import { Cpu } from 'lucide-react';

// Telemetría del pipeline ML.
//
// IMPORTANTE: Este componente NO muestra métricas simuladas. Los valores de
// rendimiento (recall, precision, PR-AUC, latencia, costos, drift, etc.) deben
// provenir del servicio ML (GET /metrics, GET /model-info). Hasta que exista
// la integración con ese servicio, se presenta un estado honesto de "no disponible".
export function MLPipelineTelemetryBar() {
  return (
    <section
      aria-label="Telemetría de Pipeline ML"
      className="w-full"
    >
      <div className="flex items-center gap-3 bg-[#141618] border border-[#23272B] rounded-xl p-4 text-xs font-mono text-[#8A929B]">
        <Cpu className="w-4 h-4 text-[#606770] shrink-0" aria-hidden="true" />
        <div className="flex flex-col gap-0.5">
          <span className="text-[#D1D5DB] font-semibold uppercase tracking-wider text-[11px]">
            Telemetría del pipeline ML
          </span>
          <span>
            No disponible: requiere integración con el servicio ML (GET /metrics, GET /model-info).
            No se muestran métricas simuladas.
          </span>
        </div>
      </div>
    </section>
  );
}