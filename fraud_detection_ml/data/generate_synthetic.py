"""
data/generate_synthetic.py
============================
Generador de datos sintéticos de transacciones e-commerce con fraude.

Diseñado para ser compatible con las columnas comunes entre los datasets
públicos de fraude en Kaggle:
    - IEEE-CIS Fraud Detection
    - Credit Card Fraud Detection
    - PaySim

Columnas generadas:
    transaction_id, user_id, amount, timestamp, country,
    device_id, merchant_id, is_fraud

Características del generador:
    - Fraude rate configurable (~2-5%)
    - Patrones realistas: fraude nocturno, montos altos, países inusuales
    - Distribución temporal coherente (varios meses)
    - Múltiples usuarios con perfiles diferentes
    - Transacciones en ráfaga (velocity patterns)
"""

from __future__ import annotations

import argparse
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd

# Reproducibilidad
SEED = 42


def generate_synthetic_dataset(
    n_transactions: int = 50_000,
    n_users: int = 5_000,
    fraud_rate: float = 0.035,
    start_date: str = "2023-01-01",
    end_date: str = "2023-05-31",
    seed: int = SEED,
) -> pd.DataFrame:
    """
    Genera un dataset sintético de transacciones con fraude.

    Parameters
    ----------
    n_transactions : int
        Número total de transacciones a generar.
    n_users : int
        Número de usuarios distintos.
    fraud_rate : float
        Tasa de fraude (proporción de transacciones fraudulentas).
    start_date : str
        Fecha de inicio del dataset (YYYY-MM-DD).
    end_date : str
        Fecha de fin del dataset (YYYY-MM-DD).
    seed : int
        Semilla aleatoria.

    Returns
    -------
    pd.DataFrame
        Dataset de transacciones con la columna is_fraud.
    """
    rng = np.random.RandomState(seed)
    random.seed(seed)

    start = pd.to_datetime(start_date, utc=True)
    end = pd.to_datetime(end_date, utc=True)
    total_seconds = int((end - start).total_seconds())

    # ── Pools de entidades ──────────────────────────────────────────────────
    user_ids = [f"U{i:05d}" for i in range(n_users)]
    countries = ["US", "GB", "ES", "DE", "FR", "MX", "CO", "BR", "IN", "NG",
                 "CN", "JP", "RU", "ZA", "AE", "AU", "CA", "IT", "KR", "PH"]
    # Pesos: los primeros países son más comunes (90% del tráfico)
    country_weights = np.array([
        0.25, 0.12, 0.10, 0.08, 0.07, 0.06, 0.05, 0.04, 0.04, 0.02,
        0.03, 0.02, 0.02, 0.01, 0.01, 0.02, 0.02, 0.01, 0.01, 0.02,
    ])
    country_weights = country_weights / country_weights.sum()

    merchants = [f"M{i:04d}" for i in range(500)]
    devices = [f"D{i:05d}" for i in range(n_users * 2)]  # ~2 devices per user

    # Asignar perfiles a usuarios
    user_profiles = {}
    for uid in user_ids:
        user_profiles[uid] = {
            "typical_countries": rng.choice(countries[:8], size=rng.randint(1, 3), replace=False).tolist(),
            "typical_devices": rng.choice(devices, size=rng.randint(1, 3), replace=False).tolist(),
            "typical_merchants": rng.choice(merchants, size=rng.randint(3, 15), replace=False).tolist(),
            "avg_amount": rng.lognormal(mean=3.5, sigma=1.0),  # Mediana ~$33
            "std_amount": rng.uniform(5, 50),
            "typical_hour_range": (rng.randint(7, 11), rng.randint(18, 23)),
        }

    # ── Generar transacciones ──────────────────────────────────────────────
    n_fraud = int(n_transactions * fraud_rate)
    n_legit = n_transactions - n_fraud

    records = []

    # Transacciones legítimas
    for _ in range(n_legit):
        uid = rng.choice(user_ids)
        profile = user_profiles[uid]

        ts_offset = rng.randint(0, total_seconds)
        ts = start + timedelta(seconds=int(ts_offset))

        # Hora del día dentro del rango típico del usuario
        h_start, h_end = profile["typical_hour_range"]
        hour = rng.randint(h_start, h_end + 1) % 24
        ts = ts.replace(hour=hour, minute=rng.randint(0, 59), second=rng.randint(0, 59))

        amount = max(0.50, rng.normal(profile["avg_amount"], profile["std_amount"]))
        country = rng.choice(profile["typical_countries"])
        device = rng.choice(profile["typical_devices"])
        merchant = rng.choice(profile["typical_merchants"])

        records.append({
            "user_id": uid,
            "amount": round(amount, 2),
            "timestamp": ts.isoformat(),
            "country": country,
            "device_id": device,
            "merchant_id": merchant,
            "is_fraud": 0,
        })

    # Transacciones fraudulentas (con patrones sospechosos)
    for _ in range(n_fraud):
        uid = rng.choice(user_ids)
        profile = user_profiles[uid]

        ts_offset = rng.randint(0, total_seconds)
        ts = start + timedelta(seconds=int(ts_offset))

        fraud_pattern = rng.choice(["high_amount", "unusual_time", "unusual_location",
                                     "velocity_burst", "new_device", "mixed"])

        amount = profile["avg_amount"]
        country = rng.choice(profile["typical_countries"])
        device = rng.choice(profile["typical_devices"])
        merchant = rng.choice(profile["typical_merchants"])

        if fraud_pattern in ("high_amount", "mixed"):
            # Monto 5-20x superior al promedio del usuario
            multiplier = rng.uniform(5, 20)
            amount = max(100, profile["avg_amount"] * multiplier)

        if fraud_pattern in ("unusual_time", "mixed"):
            # Madrugada (1-5 AM)
            hour = rng.randint(1, 5)
            ts = ts.replace(hour=hour)

        if fraud_pattern in ("unusual_location", "mixed"):
            # País fuera del perfil
            unusual_countries = [c for c in countries if c not in profile["typical_countries"]]
            if unusual_countries:
                country = rng.choice(unusual_countries)

        if fraud_pattern in ("new_device", "mixed"):
            # Dispositivo nunca visto
            device = f"D_NEW_{rng.randint(100000, 999999)}"

        if fraud_pattern == "velocity_burst":
            # Ráfaga: 3-6 transacciones en 5 minutos
            burst_count = rng.randint(3, 7)
            for b in range(burst_count):
                burst_ts = ts + timedelta(seconds=int(rng.uniform(10, 290)))
                burst_amount = max(50, rng.normal(profile["avg_amount"] * 3, 50))
                records.append({
                    "user_id": uid,
                    "amount": round(burst_amount, 2),
                    "timestamp": burst_ts.isoformat(),
                    "country": country,
                    "device_id": device,
                    "merchant_id": rng.choice(merchants),
                    "is_fraud": 1,
                })
            continue  # No añadir la transacción base, las burst ya se añadieron

        records.append({
            "user_id": uid,
            "amount": round(amount, 2),
            "timestamp": ts.isoformat(),
            "country": country,
            "device_id": device,
            "merchant_id": merchant,
            "is_fraud": 1,
        })

    # ── Construir DataFrame ──────────────────────────────────────────────────
    df = pd.DataFrame(records)
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    df = df.sort_values("timestamp").reset_index(drop=True)
    df["transaction_id"] = [f"TX{i:07d}" for i in range(len(df))]

    # Reordenar columnas al estándar del proyecto
    cols = ["transaction_id", "user_id", "amount", "timestamp", "country",
            "device_id", "merchant_id", "is_fraud"]
    df = df[cols]

    return df


def main():
    parser = argparse.ArgumentParser(description="Generate synthetic fraud dataset")
    parser.add_argument("--n-transactions", type=int, default=50_000)
    parser.add_argument("--n-users", type=int, default=5_000)
    parser.add_argument("--fraud-rate", type=float, default=0.035)
    parser.add_argument("--output", type=str, default=None)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    output_path = args.output
    if output_path is None:
        output_path = str(Path(__file__).resolve().parent / "raw" / "synthetic_transactions.csv")

    print(f"Generating {args.n_transactions:,} transactions with {args.fraud_rate:.1%} fraud rate...")

    df = generate_synthetic_dataset(
        n_transactions=args.n_transactions,
        n_users=args.n_users,
        fraud_rate=args.fraud_rate,
        seed=args.seed,
    )

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_path, index=False)

    print(f"Dataset saved to {output_path}")
    print(f"  Total transactions: {len(df):,}")
    print(f"  Unique users:       {df['user_id'].nunique():,}")
    print(f"  Fraud count:        {df['is_fraud'].sum():,}")
    print(f"  Fraud rate:         {df['is_fraud'].mean():.2%}")
    print(f"  Date range:         {df['timestamp'].min()} → {df['timestamp'].max()}")


if __name__ == "__main__":
    main()
