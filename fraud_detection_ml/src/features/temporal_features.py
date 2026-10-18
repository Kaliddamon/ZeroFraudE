"""
src/features/temporal_features.py
===================================
Features de velocidad (velocity checks) y temporales.

REGLA ANTI-LEAKAGE CRÍTICA:
Todas las agregaciones usan la ventana [t - W, t), es decir:
- El timestamp de la transacción actual está EXCLUIDO.
- Solo se consideran transacciones ANTERIORES al momento actual.

En batch (entrenamiento): se procesa el DataFrame en orden cronológico
y se aplica un lookup histórico por usuario.

En inferencia: se consulta el historial del usuario desde el Behavioral Profiler.

Features generadas:
    tx_count_5min        : Nº transacciones del usuario en los últimos 5 min
    tx_count_1h          : Nº transacciones del usuario en la última hora
    tx_count_24h         : Nº transacciones del usuario en las últimas 24h
    amount_sum_1h        : Suma de montos del usuario en la última hora
    unique_merchants_24h : Merchants distintos del usuario en las últimas 24h
    unique_countries_24h : Países distintos del usuario en las últimas 24h
"""

from __future__ import annotations

from datetime import timedelta
from typing import Optional

import numpy as np
import pandas as pd


from bisect import bisect_left


def add_velocity_features_batch(df: pd.DataFrame) -> pd.DataFrame:
    """
    Calcula velocity features para un DataFrame completo en modo batch (entrenamiento).

    El DataFrame debe estar ordenado cronológicamente. Para cada fila, solo
    se consideran las filas anteriores del mismo usuario.

    Parameters
    ----------
    df : pd.DataFrame
        DataFrame con columnas: user_id, amount, timestamp, merchant_id, country.
        Debe estar ordenado por timestamp ASC.

    Returns
    -------
    pd.DataFrame
        DataFrame original con las velocity features añadidas.
    """
    df = df.copy().sort_values("timestamp").reset_index(drop=True)
    n = len(df)

    # Pre-reservar arrays para asignación rápida
    v_tx_count_5min = np.zeros(n, dtype=np.int32)
    v_tx_count_1h = np.zeros(n, dtype=np.int32)
    v_tx_count_24h = np.zeros(n, dtype=np.int32)
    v_amount_sum_1h = np.zeros(n, dtype=np.float32)
    v_unique_merchants_24h = np.zeros(n, dtype=np.int32)
    v_unique_countries_24h = np.zeros(n, dtype=np.int32)

    # Agrupar por usuario para eficiencia
    for user_id, user_df in df.groupby("user_id", sort=False):
        user_df = user_df.sort_values("timestamp")
        indices = user_df.index.tolist()
        timestamps = user_df["timestamp"].tolist()
        amounts = user_df["amount"].tolist()
        merchants = user_df["merchant_id"].tolist()
        countries = user_df["country"].tolist() if "country" in user_df.columns else [None] * len(indices)

        for i, idx in enumerate(indices):
            t_current = timestamps[i]

            # Ventanas (excluye la transacción actual, solo transacciones < i)
            t_5min = t_current - timedelta(minutes=5)
            t_1h = t_current - timedelta(hours=1)
            t_24h = t_current - timedelta(hours=24)

            # Búsqueda binaria O(log i) en timestamps ordenados
            j_5min = bisect_left(timestamps, t_5min, 0, i)
            j_1h = bisect_left(timestamps, t_1h, 0, i)
            j_24h = bisect_left(timestamps, t_24h, 0, i)

            v_tx_count_5min[idx] = i - j_5min
            v_tx_count_1h[idx] = i - j_1h
            v_tx_count_24h[idx] = i - j_24h

            v_amount_sum_1h[idx] = sum(amounts[j_1h:i])
            v_unique_merchants_24h[idx] = len(set(merchants[j_24h:i]))
            v_unique_countries_24h[idx] = len(set(c for c in countries[j_24h:i] if c is not None))

    df["tx_count_5min"] = v_tx_count_5min
    df["tx_count_1h"] = v_tx_count_1h
    df["tx_count_24h"] = v_tx_count_24h
    df["amount_sum_1h"] = v_amount_sum_1h
    df["unique_merchants_24h"] = v_unique_merchants_24h
    df["unique_countries_24h"] = v_unique_countries_24h

    return df


def compute_velocity_for_inference(
    user_history: pd.DataFrame,
    current_timestamp: pd.Timestamp,
    current_amount: float,
    current_merchant: str,
    current_country: Optional[str],
) -> dict:
    """
    Calcula velocity features para UNA transacción en tiempo de inferencia.

    Parameters
    ----------
    user_history : pd.DataFrame
        Historial de transacciones previas del usuario (TODAS anteriores a current_timestamp).
        Debe tener columnas: timestamp, amount, merchant_id, country.
    current_timestamp : pd.Timestamp
        Timestamp de la transacción a analizar.
    current_amount : float
        Monto de la transacción a analizar.
    current_merchant : str
        merchant_id de la transacción a analizar.
    current_country : str, optional
        country de la transacción a analizar.

    Returns
    -------
    dict
        Diccionario con todas las velocity features como valores escalares.
    """
    if user_history is None or len(user_history) == 0:
        return {
            "tx_count_5min": 0,
            "tx_count_1h": 0,
            "tx_count_24h": 0,
            "amount_sum_1h": 0.0,
            "unique_merchants_24h": 0,
            "unique_countries_24h": 0,
        }

    history = user_history.copy()
    if not pd.api.types.is_datetime64_any_dtype(history["timestamp"]):
        history["timestamp"] = pd.to_datetime(history["timestamp"], utc=True)

    t_5min = current_timestamp - timedelta(minutes=5)
    t_1h = current_timestamp - timedelta(hours=1)
    t_24h = current_timestamp - timedelta(hours=24)

    # Solo transacciones ANTERIORES al timestamp actual
    past = history[history["timestamp"] < current_timestamp]

    count_5min = int((past["timestamp"] >= t_5min).sum())
    count_1h = int((past["timestamp"] >= t_1h).sum())
    count_24h = int((past["timestamp"] >= t_24h).sum())

    mask_1h = past["timestamp"] >= t_1h
    sum_amount_1h = float(past.loc[mask_1h, "amount"].sum())

    mask_24h = past["timestamp"] >= t_24h
    unique_merch_24h = int(past.loc[mask_24h, "merchant_id"].nunique())
    unique_ctry_24h = int(past.loc[mask_24h, "country"].nunique()) if "country" in past.columns else 0

    return {
        "tx_count_5min": count_5min,
        "tx_count_1h": count_1h,
        "tx_count_24h": count_24h,
        "amount_sum_1h": sum_amount_1h,
        "unique_merchants_24h": unique_merch_24h,
        "unique_countries_24h": unique_ctry_24h,
    }
