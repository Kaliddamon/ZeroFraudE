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
"""

from __future__ import annotations

import traceback
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from src.inference.service import FraudDetectionService
from src.validation.schemas import ErrorOutput, PredictionOutput, TransactionInput

# ── Estado global del servicio ─────────────────────────────────────────────────

_service: Optional[FraudDetectionService] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Carga los artefactos al iniciar el servicio."""
    global _service
    try:
        _service = FraudDetectionService.load(version="1.0.0")
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
    version="1.0.0",
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
        raise HTTPException(
            status_code=503,
            detail=ErrorOutput(
                transaction_id=transaction.transaction_id,
                error="MODEL_NOT_LOADED",
                message="ML model artifacts are not loaded. The service is starting up or misconfigured.",
                model_version="unknown",
            ).model_dump(),
        )

    try:
        result = _service.predict(transaction)
        return result
    except Exception as e:
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
