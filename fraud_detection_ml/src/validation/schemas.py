"""
src/validation/schemas.py
=========================
Schemas Pydantic para el contrato de entrada/salida del pipeline de inferencia.

Este módulo define la interfaz exacta que el Backend (Spring Boot) debe respetar
al llamar al endpoint POST /predict del ML Service.

Contrato de entrada (Backend → ML):
    snake_case, alineado con la columna "Backend ↔ ML" del TDD Backend.

Contrato de salida (ML → Backend):
    snake_case, todos los campos numéricos en [0.0, 1.0].
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


# ── Tipos compartidos ──────────────────────────────────────────────────────────

RiskLevel = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]


# ── Input Schema ───────────────────────────────────────────────────────────────

class TransactionInput(BaseModel):
    """
    Datos de entrada que el Backend envía al ML Service para análisis.

    Todos los campos son obligatorios. El Backend es responsable de
    construir este payload antes de hacer el POST /predict.
    """

    transaction_id: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Identificador único de la transacción (generado por el Backend).",
        examples=["550e8400-e29b-41d4-a716-446655440001"],
    )
    user_id: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="ID del usuario del e-commerce (externo al sistema de análisis).",
        examples=["U123"],
    )
    amount: float = Field(
        ...,
        gt=0,
        le=1_000_000,
        description="Monto de la transacción en la moneda indicada. Debe ser positivo.",
        examples=[1250.50],
    )
    timestamp: datetime = Field(
        ...,
        description="Momento de la transacción en formato ISO 8601 con timezone.",
        examples=["2023-10-27T14:32:00Z"],
    )
    country: str = Field(
        ...,
        min_length=2,
        max_length=3,
        description="Código de país ISO 3166-1 alpha-2 o alpha-3.",
        examples=["CO"],
    )
    device_id: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Identificador del dispositivo usado en la transacción.",
        examples=["D42"],
    )
    merchant_id: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Identificador del comercio donde se realizó la transacción.",
        examples=["M18"],
    )

    @field_validator("country")
    @classmethod
    def country_uppercase(cls, v: str) -> str:
        return v.upper()

    @field_validator("timestamp")
    @classmethod
    def timestamp_not_future(cls, v: datetime) -> datetime:
        # Asegurar que el timestamp tenga timezone para comparación
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        # Tolerancia de 5 minutos para latencia de red
        if (v - now).total_seconds() > 300:
            raise ValueError(
                f"Timestamp is too far in the future: {v.isoformat()}. "
                "Maximum allowed is 5 minutes ahead."
            )
        return v

    model_config = {"json_schema_extra": {"example": {
        "transaction_id": "T001",
        "user_id": "U123",
        "amount": 1250.50,
        "timestamp": "2023-10-27T14:32:00Z",
        "country": "CO",
        "device_id": "D42",
        "merchant_id": "M18",
    }}}


# ── Output Schema ──────────────────────────────────────────────────────────────

class PredictionOutput(BaseModel):
    """
    Resultado del análisis de fraude que el ML Service retorna al Backend.

    Todos los scores están en [0.0, 1.0].
    risk_level es determinístico dado risk_score y los thresholds actuales.
    """

    transaction_id: str = Field(
        ...,
        description="Echo del transaction_id recibido en el input. Permite al Backend correlacionar.",
    )
    fraud_probability: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Probabilidad de fraude predicha por LightGBM. 1.0 = certeza de fraude.",
    )
    anomaly_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Score de anomalía del Isolation Forest. 1.0 = máxima anomalía.",
    )
    behavioral_deviation: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Desviación normalizada del comportamiento habitual del usuario.",
    )
    risk_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Score compuesto ponderado (Risk Fusion). Usado para clasificar en risk_level.",
    )
    risk_level: RiskLevel = Field(
        ...,
        description="Clasificación final: LOW | MEDIUM | HIGH | CRITICAL.",
    )
    explanations: List[str] = Field(
        ...,
        min_length=1,
        max_length=5,
        description="Factores principales en lenguaje natural. Consumible directamente por el Frontend.",
        examples=[["Amount 8.3× above user average", "New device", "Unusual location"]],
    )
    model_version: str = Field(
        ...,
        description="Versión semántica del modelo que generó esta predicción. Para auditoría.",
        examples=["1.0.0"],
    )
    is_cold_start: bool = Field(
        default=False,
        description=(
            "True si el usuario tiene menos transacciones que cold_start_min_transactions. "
            "El Backend puede usar este flag para ajustar la comunicación al usuario."
        ),
    )
    anomaly_alert: bool = Field(
        default=False,
        description=(
            "True si anomaly_score supera el umbral de escalada configurado. "
            "Es una señal separada de riesgo que justifica revisión manual, "
            "independientemente de risk_level. No implica que la transacción sea fraude."
        ),
    )

    model_config = {"json_schema_extra": {"example": {
        "transaction_id": "T001",
        "fraud_probability": 0.87,
        "anomaly_score": 0.81,
        "behavioral_deviation": 0.92,
        "risk_score": 0.89,
        "risk_level": "HIGH",
        "explanations": [
            "Amount 8.3× above user average",
            "First transaction from this device",
            "Country not in user's recent history",
        ],
        "model_version": "1.0.0",
        "is_cold_start": False,
    }}}


# ── Error Schema ───────────────────────────────────────────────────────────────

class ErrorOutput(BaseModel):
    """
    Respuesta de error del ML Service.

    El ML Service nunca lanza excepciones no controladas.
    Si el input es inválido o falla la inferencia, retorna este schema.
    HTTP 422 para errores de validación, HTTP 500 para errores internos.
    """

    transaction_id: Optional[str] = Field(
        default=None,
        description="transaction_id del input si estaba disponible.",
    )
    error: str = Field(
        ...,
        description="Código de error legible por máquina.",
        examples=["VALIDATION_ERROR", "INFERENCE_ERROR", "MODEL_NOT_LOADED"],
    )
    message: str = Field(
        ...,
        description="Descripción del error en inglés.",
    )
    model_version: str = Field(
        default="unknown",
        description="Versión del modelo si estaba disponible.",
    )
