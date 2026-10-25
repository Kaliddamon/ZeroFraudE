"""
src/inference/app.py
=====================
FastAPI application que expone el endpoint POST /predict.

Este es el punto de entrada HTTP que el Backend (Spring Boot) llama
a través del MLInferenceAdapter vía HTTP POST.

Endpoint principal:
    POST /predict
    Input:  TransactionInput (JSON body)
    Output: PredictionOutput (JSON body) o ErrorOutput (JSON body)

Endpoints auxiliares:
    GET  /health        → Estado del servicio
    GET  /model-info    → Versión del modelo y metadatos
    GET  /metrics       → Contadores en vivo: requests, risk_level, latencia p50/p95
"""

from __future__ import annotations

import statistics
import threading
import time
from collections import deque
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from src.inference.service import FraudDetectionService
from src.validation.schemas import ErrorOutput, PredictionOutput, TransactionInput


# ── Colector de métricas thread-safe ──────────────────────────────────────────

class MetricsCollector:
    """
    Colector de métricas en vivo para el servicio de inferencia.

    Thread-safe: usa threading.Lock para proteger escrituras concurrentes
    desde múltiples workers de uvicorn.

    Latencias: ventana deslizante de las últimas 1000 predicciones
    para calcular p50/p95 sin acumular memoria indefinidamente.
    """

    _LATENCY_WINDOW = 1_000  # Máximo de latencias en memoria

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._started_at: datetime = datetime.now(timezone.utc)

        # Contadores de requests
        self._total_requests: int = 0
        self._successful_requests: int = 0
        self._error_requests: int = 0          # 500 / inferencia fallida
        self._unavailable_requests: int = 0    # 503 / modelo no cargado

        # Distribución de risk_level
        self._risk_level_counts: dict[str, int] = {
            "LOW": 0,
            "MEDIUM": 0,
            "HIGH": 0,
            "CRITICAL": 0,
        }

        # Ventana deslizante de latencias (ms)
        self._latencies_ms: deque[float] = deque(maxlen=self._LATENCY_WINDOW)

    # ── Métodos de registro ────────────────────────────────────────────────

    def record_success(self, risk_level: str, latency_ms: float) -> None:
        """Registra una predicción exitosa."""
        with self._lock:
            self._total_requests += 1
            self._successful_requests += 1
            self._risk_level_counts[risk_level] = (
                self._risk_level_counts.get(risk_level, 0) + 1
            )
            self._latencies_ms.append(latency_ms)

    def record_error(self, latency_ms: float) -> None:
        """Registra un error de inferencia (500)."""
        with self._lock:
            self._total_requests += 1
            self._error_requests += 1
            self._latencies_ms.append(latency_ms)

    def record_unavailable(self) -> None:
        """Registra un rechazo por modelo no cargado (503)."""
        with self._lock:
            self._total_requests += 1
            self._unavailable_requests += 1

    # ── Snapshot de métricas ───────────────────────────────────────────────

    def snapshot(self) -> dict:
        """
        Retorna una copia consistente de todas las métricas actuales.
        Calcula percentiles p50 y p95 sobre la ventana deslizante.
        """
        with self._lock:
            latencies = list(self._latencies_ms)
            total = self._total_requests
            successful = self._successful_requests
            risk_counts = dict(self._risk_level_counts)
            started_at = self._started_at.isoformat()
            errors = self._error_requests
            unavailable = self._unavailable_requests

        # Percentiles (fuera del lock para no bloquearlo)
        latency_stats: dict = {}
        if latencies:
            sorted_lat = sorted(latencies)
            n = len(sorted_lat)
            p50_idx = max(0, int(n * 0.50) - 1)
            p95_idx = max(0, int(n * 0.95) - 1)
            latency_stats = {
                "p50_ms": round(sorted_lat[p50_idx], 3),
                "p95_ms": round(sorted_lat[p95_idx], 3),
                "min_ms": round(sorted_lat[0], 3),
                "max_ms": round(sorted_lat[-1], 3),
                "mean_ms": round(statistics.mean(latencies), 3),
                "sample_size": n,
                "window_max": self._LATENCY_WINDOW,
            }
        else:
            latency_stats = {
                "p50_ms": None,
                "p95_ms": None,
                "min_ms": None,
                "max_ms": None,
                "mean_ms": None,
                "sample_size": 0,
                "window_max": self._LATENCY_WINDOW,
            }

        # Distribución porcentual de risk_level
        risk_distribution: dict[str, dict] = {}
        for level, count in risk_counts.items():
            pct = round(count / successful * 100, 2) if successful > 0 else 0.0
            risk_distribution[level] = {"count": count, "pct": pct}

        return {
            "service": {
                "started_at": started_at,
                "uptime_seconds": round(
                    (datetime.now(timezone.utc) - self._started_at).total_seconds(), 1
                ),
            },
            "requests": {
                "total": total,
                "successful": successful,
                "errors_inference": errors,
                "errors_unavailable": unavailable,
                "success_rate_pct": (
                    round(successful / total * 100, 2) if total > 0 else None
                ),
            },
            "risk_level_distribution": risk_distribution,
            "latency": latency_stats,
        }


# ── Estado global del servicio ─────────────────────────────────────────────────

_service: Optional[FraudDetectionService] = None
_metrics = MetricsCollector()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Carga los artefactos al iniciar el servicio."""
    global _service
    try:
        _service = FraudDetectionService.load(version="3.0.0")
        print("[App] Service loaded successfully.")
    except Exception as e:
        print(f"[App] WARNING: Could not load model artifacts: {e}")
        print("[App] Service will start but /predict will return 503.")
        _service = None
    yield
    print("[App] Shutting down.")


# ── Aplicación FastAPI ─────────────────────────────────────────────────────────

app = FastAPI(
    title="Fraud Detection ML Service",
    description=(
        "Componente de Machine Learning para detección adaptativa de fraude "
        "en transacciones de e-commerce. Recibe una transacción y retorna "
        "fraud_probability, anomaly_score, behavioral_deviation, risk_score, "
        "risk_level y explicaciones en lenguaje natural."
    ),
    version="1.1.0",
    lifespan=lifespan,
)

# CORS: permitir que el Backend se comunique desde cualquier origen en desarrollo
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Endpoints ──────────────────────────────────────────────────────────────────

@app.post(
    "/predict",
    response_model=PredictionOutput,
    responses={
        422: {"model": ErrorOutput, "description": "Input inválido."},
        500: {"model": ErrorOutput, "description": "Error interno de inferencia."},
        503: {"model": ErrorOutput, "description": "Modelo no cargado."},
    },
    summary="Analizar una transacción de e-commerce",
    description=(
        "Recibe los datos de una transacción y retorna el análisis de riesgo "
        "completo: fraud_probability, anomaly_score, behavioral_deviation, "
        "risk_score, risk_level y explicaciones."
    ),
)
async def predict(transaction: TransactionInput) -> PredictionOutput:
    """
    Endpoint principal consumido por el Backend (Spring Boot).

    El Backend llama a este endpoint desde MLInferenceAdapter con:
        POST http://ml-service:8000/predict
        Content-Type: application/json
        Body: TransactionInput

    Y espera recibir:
        200: PredictionOutput
        422: ErrorOutput (input inválido)
        500: ErrorOutput (error de inferencia)
        503: ErrorOutput (modelo no disponible)
    """
    if _service is None or not _service.is_ready:
        _metrics.record_unavailable()
        raise HTTPException(
            status_code=503,
            detail=ErrorOutput(
                transaction_id=transaction.transaction_id,
                error="MODEL_NOT_LOADED",
                message="ML model artifacts are not loaded. The service is starting up or misconfigured.",
                model_version="unknown",
            ).model_dump(),
        )

    t0 = time.perf_counter()
    try:
        result = _service.predict(transaction)
        latency_ms = (time.perf_counter() - t0) * 1000
        _metrics.record_success(risk_level=result.risk_level, latency_ms=latency_ms)
        return result
    except Exception as e:
        latency_ms = (time.perf_counter() - t0) * 1000
        _metrics.record_error(latency_ms=latency_ms)
        raise HTTPException(
            status_code=500,
            detail=ErrorOutput(
                transaction_id=transaction.transaction_id,
                error="INFERENCE_ERROR",
                message=f"Inference failed: {str(e)}",
                model_version=_service.model_version,
            ).model_dump(),
        )


@app.get("/health", summary="Health check")
async def health():
    """
    Estado del servicio. Retorna 200 si el servicio está activo.
    El Backend puede usar este endpoint para verificar disponibilidad.
    """
    return {
        "status": "healthy" if _service and _service.is_ready else "degraded",
        "model_loaded": _service is not None and _service.is_ready,
    }


@app.get("/model-info", summary="Información del modelo")
async def model_info():
    """
    Metadatos del modelo cargado. Útil para auditoría y debugging.
    """
    if _service is None:
        return {"model_version": "not_loaded", "status": "unavailable"}

    return {
        "model_version": _service.model_version,
        "status": "ready" if _service.is_ready else "not_ready",
    }


@app.get("/metrics", summary="Métricas en vivo del servicio")
async def metrics():
    """
    Expone contadores operacionales en tiempo real sin dependencias externas.

    Retorna:
    - **service**: uptime y timestamp de inicio.
    - **requests**: total, exitosos, errores de inferencia, rechazos por modelo no disponible
      y tasa de éxito porcentual.
    - **risk_level_distribution**: conteo y porcentaje de cada nivel de riesgo
      (LOW / MEDIUM / HIGH / CRITICAL) sobre las predicciones exitosas.
    - **latency**: estadísticas sobre las últimas 1000 predicciones (exitosas + errores):
      p50, p95, mínimo, máximo y media en milisegundos.

    Nota: los percentiles se calculan sobre una ventana deslizante de 1000 muestras.
    """
    return _metrics.snapshot()


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "src.inference.app:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info",
    )
