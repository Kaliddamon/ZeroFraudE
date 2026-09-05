"""
src/features/transaction_features.py
=====================================
Features derivadas directamente de los campos de la transacción.

Estas features NO requieren historial del usuario (no hay riesgo de data leakage).
Son las primeras en calcularse en el pipeline.

Features generadas:
    amount_log         : log1p(amount) — compresión de escala
    hour_sin / hour_cos: codificación cíclica de la hora del día
    day_of_week        : 0=Lunes … 6=Domingo
    is_weekend         : 1 si sábado o domingo
    is_night           : 1 si hora ∈ [22, 23] ∪ [0, 5]
    is_duplicate_candidate: 1 si misma (user_id, amount, merchant_id) en < 60 seg
"""

from __future__ import annotations

import numpy as np
import pandas as pd


def add_transaction_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Añade features transaccionales al DataFrame.

    Asume que el DataFrame ya tiene:
    - amount (float, positivo)
    - timestamp (datetime con timezone o naive, en UTC)
    - user_id, merchant_id (str)

    No modifica el DataFrame original.
    """
    df = df.copy()

    # -- Garantizar que timestamp sea datetime --
    if not pd.api.types.is_datetime64_any_dtype(df["timestamp"]):
        df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)

    # -- Log del monto --
    df["amount_log"] = np.log1p(df["amount"].clip(lower=0))

    # -- Descomposición temporal --
    ts = df["timestamp"]
    df["hour_of_day"] = ts.dt.hour
    df["day_of_week"] = ts.dt.dayofweek     # 0=Monday
    df["day_of_month"] = ts.dt.day
    df["month"] = ts.dt.month

    # -- Codificación cíclica de hora --
    df["hour_sin"] = np.sin(2 * np.pi * df["hour_of_day"] / 24)
    df["hour_cos"] = np.cos(2 * np.pi * df["hour_of_day"] / 24)

    # -- Flags binarios --
    df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)
    df["is_night"] = (
        (df["hour_of_day"] >= 22) | (df["hour_of_day"] <= 5)
    ).astype(int)

    # -- Detección de transacciones duplicadas candidatas --
    # Misma (user_id, amount, merchant_id) dentro de una ventana de 60 segundos
    df = df.sort_values("timestamp")
    df["_prev_timestamp"] = df.groupby(
        ["user_id", "merchant_id", "amount"]
    )["timestamp"].shift(1)

    df["is_duplicate_candidate"] = (
        (df["timestamp"] - df["_prev_timestamp"]).dt.total_seconds().abs() < 60
    ).fillna(False).astype(int)

    df = df.drop(columns=["_prev_timestamp"])

    return df
