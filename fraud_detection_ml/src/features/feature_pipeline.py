"""
src/features/feature_pipeline.py
=================================
Pipeline de features completo: orquesta el orden de construcción de features
y expone la lista canónica de columnas que el modelo espera.

Orden de ejecución:
    1. transaction_features   (no requieren historial)
    2. velocity_features      (requieren historial cronológico del usuario)
    3. behavioral_features    (requieren perfil del usuario — delegado al Behavioral Profiler)
    4. encoding               (calculado sobre training set)
    5. scaling                (calculado sobre training set)

La lista MODEL_FEATURES define el orden exacto de columnas que
LightGBM e Isolation Forest reciben. Cambiar esta lista sin reentrenar
el modelo romperá la inferencia.
"""

from __future__ import annotations

from typing import List, Optional

import numpy as np
import pandas as pd

from src.features.transaction_features import add_transaction_features
from src.features.temporal_features import add_velocity_features_batch


# ── Lista canónica de features para el modelo ─────────────────────────────────
# Este orden es el que se guarda en artifacts/v1.0.0/feature_config.json
# y debe usarse tanto en entrenamiento como en inferencia.

MODEL_FEATURES: List[str] = [
    # Transaccional
    "amount_log",
    "hour_sin",
    "hour_cos",
    "day_of_week",
    "is_weekend",
    "is_night",
    # Behavioral
    "user_avg_amount_30d",
    "user_std_amount_30d",
    "amount_z_score",
    "amount_ratio_to_avg",
    "is_new_device",
    "is_new_country",
    "is_new_merchant",
    "user_tx_count_30d",
    "days_since_last_tx",
    # Velocity
    "tx_count_5min",
    "tx_count_1h",
    "tx_count_24h",
    "amount_sum_1h",
    "unique_merchants_24h",
    "unique_countries_24h",
    # Otros
    "is_duplicate_candidate",
    # Encodings
    "country_encoded",
    "merchant_target_enc",
    "device_target_enc",
]


def build_feature_matrix_batch(df: pd.DataFrame) -> pd.DataFrame:
    """
    Construye la matriz de features para el entrenamiento (batch).

    Asume que el DataFrame ya tiene las behavioral features calculadas
    por el BehavioralProfiler (user_avg_amount_30d, amount_z_score, etc.)
    y los encodings calculados por FraudEncoderTransformer.

    Parameters
    ----------
    df : pd.DataFrame
        DataFrame con todas las columnas raw + behavioral + encodings.

    Returns
    -------
    pd.DataFrame
        DataFrame con solo las columnas de MODEL_FEATURES, en ese orden.
        Las columnas faltantes se rellenan con 0.
    """
    df = add_transaction_features(df)
    df = add_velocity_features_batch(df)

    # Rellenar columnas faltantes con 0 (comportamiento seguro)
    for col in MODEL_FEATURES:
        if col not in df.columns:
            df[col] = 0.0

    return df[MODEL_FEATURES]


def build_feature_vector_inference(
    transaction: dict,
    behavioral_features: dict,
    velocity_features: dict,
    encoding_features: dict,
) -> pd.DataFrame:
    """
    Construye el vector de features para UNA transacción en inferencia.

    Este método no ejecuta ningún transformador (no hay fit/transform).
    Recibe las features ya calculadas por cada submódulo y las ensambla.

    Parameters
    ----------
    transaction : dict
        Campos crudos de la transacción (amount, timestamp, etc.).
    behavioral_features : dict
        Features del BehavioralProfiler (z-score, is_new_device, etc.).
    velocity_features : dict
        Features de velocity (tx_count_5min, tx_count_1h, etc.).
    encoding_features : dict
        Encodings de categorías (country_encoded, merchant_target_enc, etc.).

    Returns
    -------
    pd.DataFrame
        DataFrame de 1 fila con las columnas de MODEL_FEATURES en orden.
    """
    import numpy as np

    # Calcular features transaccionales básicas desde el dict
    ts = pd.to_datetime(transaction["timestamp"], utc=True)
    hour = ts.hour
    dow = ts.dayofweek

    tx_features = {
        "amount_log": float(np.log1p(max(transaction["amount"], 0))),
        "hour_sin": float(np.sin(2 * np.pi * hour / 24)),
        "hour_cos": float(np.cos(2 * np.pi * hour / 24)),
        "day_of_week": float(dow),
        "is_weekend": float(dow >= 5),
        "is_night": float(hour >= 22 or hour <= 5),
        "is_duplicate_candidate": 0.0,  # En inferencia, el historial resuelve esto
    }

    # Combinar todas las fuentes
    combined = {**tx_features, **behavioral_features, **velocity_features, **encoding_features}

    # Construir DataFrame con el orden canónico
    row = {col: combined.get(col, 0.0) for col in MODEL_FEATURES}
    return pd.DataFrame([row])
