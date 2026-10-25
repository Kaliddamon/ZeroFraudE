"""
src/behavioral/deviation.py
============================
Cálculo de las features de desviación respecto al perfil del usuario.

Dado un UserProfile y los datos de la transacción actual, calcula:
  - user_avg_amount_30d    : media EMA del usuario
  - user_std_amount_30d    : desviación estándar EMA del usuario
  - amount_z_score         : desviación del monto en unidades de std
  - amount_ratio_to_avg    : monto / media del usuario
  - is_new_device          : 1 si el dispositivo no está en el perfil
  - is_new_country         : 1 si el país no está en el perfil
  - is_new_merchant        : 1 si el merchant no está en el perfil
  - user_tx_count_30d      : transacciones del usuario en los últimos 30 días
  - days_since_last_tx     : días desde la última transacción
  - behavioral_deviation   : score compuesto [0, 1]
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Optional

import numpy as np
import pandas as pd

from src.behavioral.profile import UserProfile


# Pesos del behavioral_deviation score (deben sumar 1.0)
_DEVIATION_WEIGHTS = {
    "is_new_device": 0.30,
    "is_new_country": 0.25,
    "amount_z_score_norm": 0.25,  # z-score normalizado a [0,1]
    "is_unusual_hour": 0.20,
}

# Epsilon para evitar división por cero
_EPS = 1e-6


def compute_behavioral_features(
    profile: UserProfile,
    amount: float,
    timestamp,
    country: str,
    device_id: str,
    merchant_id: str,
    cold_start_min_tx: int = 5,
) -> dict:
    """
    Calcula todas las features de desviación behavioral para una transacción.

    Si el perfil está en cold start (pocos datos), las features de desviación
    se establecen en valores neutros (0.0) excepto los flags binarios.

    Parameters
    ----------
    profile           : UserProfile del usuario (puede ser el global en cold start).
    amount            : Monto de la transacción actual.
    timestamp         : Timestamp de la transacción (datetime o pd.Timestamp).
    country           : País de la transacción.
    device_id         : ID del dispositivo.
    merchant_id       : ID del comercio.
    cold_start_min_tx : Umbral de transacciones para considerar cold start.

    Returns
    -------
    dict
        Diccionario con todas las behavioral features (escalares).
    """
    if isinstance(timestamp, str):
        timestamp = pd.to_datetime(timestamp, utc=True)
    elif hasattr(timestamp, "tzinfo") and timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)

    is_cold = profile.tx_count < cold_start_min_tx

    # ── Estadísticas del perfil ───────────────────────────────────────────────
    avg = profile.amount_ema if profile.tx_count > 0 else amount
    std = profile.amount_std if profile.tx_count > 0 else 0.0

    # ── Z-score del monto ─────────────────────────────────────────────────────
    if std > _EPS:
        amount_z_score = (amount - avg) / std
    else:
        amount_z_score = 0.0

    # Normalizar z-score a [0, 1] para el behavioral_deviation
    # clip a [-5, 5] primero para evitar valores extremos
    z_clipped = max(-5.0, min(5.0, amount_z_score))
    amount_z_score_norm = (z_clipped + 5.0) / 10.0  # [0, 1]

    # ── Ratio monto / media ───────────────────────────────────────────────────
    amount_ratio_to_avg = amount / (avg + _EPS)

    # ── Flags binarios ────────────────────────────────────────────────────────
    # Cuando el usuario está en cold start y se usa el perfil global,
    # no hay evidencia de que el dispositivo, país o merchant sean "nuevos":
    # el perfil global no conoce ninguno. Forzar a 0.0 para no afirmar
    # inexistencia sin evidencia.
    if is_cold:
        is_new_device = 0.0
        is_new_country = 0.0
        is_new_merchant = 0.0
    else:
        is_new_device = float(device_id not in profile.known_devices)
        is_new_country = float(country not in profile.known_countries)
        is_new_merchant = float(merchant_id not in profile.known_merchants)

    # ── Hora inusual ──────────────────────────────────────────────────────────
    hour = timestamp.hour
    is_unusual_hour = float(profile.is_unusual_hour(hour))

    # ── Días desde la última transacción ─────────────────────────────────────
    days_since_last_tx = 0.0
    if profile.last_transaction_at:
        try:
            last_ts = pd.to_datetime(profile.last_transaction_at, utc=True)
            delta = (timestamp - last_ts).total_seconds() / 86400
            days_since_last_tx = max(0.0, float(delta))
        except Exception:
            days_since_last_tx = 0.0

    # ── Conteo de transacciones en 30 días ───────────────────────────────────
    user_tx_count_30d = _count_recent_transactions(profile, timestamp, days=30)

    # ── Behavioral deviation score compuesto ─────────────────────────────────
    if is_cold:
        behavioral_deviation = 0.0
    else:
        behavioral_deviation = (
            _DEVIATION_WEIGHTS["is_new_device"] * is_new_device
            + _DEVIATION_WEIGHTS["is_new_country"] * is_new_country
            + _DEVIATION_WEIGHTS["amount_z_score_norm"] * amount_z_score_norm
            + _DEVIATION_WEIGHTS["is_unusual_hour"] * is_unusual_hour
        )
        behavioral_deviation = float(min(1.0, max(0.0, behavioral_deviation)))

    return {
        "user_avg_amount_30d": float(avg),
        "user_std_amount_30d": float(std),
        "amount_z_score": float(amount_z_score),
        "amount_ratio_to_avg": float(amount_ratio_to_avg),
        "is_new_device": float(is_new_device),
        "is_new_country": float(is_new_country),
        "is_new_merchant": float(is_new_merchant),
        "user_tx_count_30d": float(user_tx_count_30d),
        "days_since_last_tx": float(days_since_last_tx),
        "behavioral_deviation": behavioral_deviation,
    }


def _count_recent_transactions(
    profile: UserProfile,
    current_timestamp,
    days: int = 30,
) -> int:
    """Cuenta las transacciones del usuario en los últimos N días."""
    if not profile.recent_timestamps:
        return 0

    cutoff = current_timestamp - pd.Timedelta(days=days)
    count = 0
    for ts_str in profile.recent_timestamps:
        try:
            ts = pd.to_datetime(ts_str, utc=True)
            if ts >= cutoff:
                count += 1
        except Exception:
            continue
    return count
