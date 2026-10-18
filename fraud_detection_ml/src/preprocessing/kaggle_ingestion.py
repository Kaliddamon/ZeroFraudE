"""
src/preprocessing/kaggle_ingestion.py
======================================
Mapea el dataset de Kaggle IEEE-CIS Fraud Detection
(train_transaction.csv + train_identity.csv)
al esquema canónico del proyecto Fraud Detection.

Columnas generadas:
    transaction_id, user_id, amount, timestamp, country,
    device_id, merchant_id, is_fraud
"""

from __future__ import annotations

import argparse
from pathlib import Path
import numpy as np
import pandas as pd


# Códigos addr2 comunes a países ISO 3166-1 alpha-3
COUNTRY_MAP = {
    87.0: "USA",
    60.0: "GBR",
    96.0: "CAN",
    32.0: "FRA",
    65.0: "DEU",
    18.0: "ESP",
}


def ingest_ieee_cis(
    transaction_csv: str = "data/raw/train_transaction.csv",
    identity_csv: str | None = "data/raw/train_identity.csv",
    output_csv: str = "data/processed/transactions.csv",
    sample_size: int | None = 100_000,
) -> None:
    """
    Ingesta y transforma el dataset de IEEE-CIS Fraud Detection.
    """
    print(f"[INFO] Leyendo transacciones desde: {transaction_csv} ...")
    use_cols_tx = [
        "TransactionID",
        "isFraud",
        "TransactionDT",
        "TransactionAmt",
        "ProductCD",
        "card1",
        "addr2",
    ]

    df_tx = pd.read_csv(transaction_csv, usecols=use_cols_tx, nrows=sample_size)
    print(f"   Transacciones leidas: {len(df_tx):,}")

    device_map = {}
    if identity_csv and Path(identity_csv).exists():
        print(f"[INFO] Leyendo identidades/dispositivos desde: {identity_csv} ...")
        df_id = pd.read_csv(identity_csv, usecols=["TransactionID", "DeviceInfo"], nrows=sample_size)
        device_map = df_id.set_index("TransactionID")["DeviceInfo"].fillna("Unknown").to_dict()

    print("[INFO] Estandarizando al esquema canonico...")
    processed = pd.DataFrame()

    # 1. transaction_id
    processed["transaction_id"] = "TX" + df_tx["TransactionID"].astype(str)

    # 2. user_id (en IEEE-CIS la entidad usuario se aproxima con card1)
    processed["user_id"] = "U" + df_tx["card1"].fillna(9999).astype(int).astype(str).str.zfill(5)

    # 3. amount
    processed["amount"] = df_tx["TransactionAmt"].round(2)

    # 4. timestamp (TransactionDT son segundos desde un punto de referencia)
    base_time = pd.Timestamp("2023-01-01 00:00:00", tz="UTC")
    processed["timestamp"] = base_time + pd.to_timedelta(df_tx["TransactionDT"], unit="s")

    # 5. country
    default_countries = ["USA", "GBR", "CAN", "DEU", "FRA", "ESP"]
    processed["country"] = df_tx["addr2"].map(COUNTRY_MAP).fillna(
        pd.Series(np.random.choice(default_countries, size=len(df_tx)))
    )

    # 6. device_id
    if device_map:
        mapped_devices = df_tx["TransactionID"].map(device_map).fillna("Desktop")
        processed["device_id"] = "DEV_" + mapped_devices.astype(str).str.replace(r"[^a-zA-Z0-9_]", "_", regex=True).str[:15]
    else:
        processed["device_id"] = "DEV_" + (df_tx["card1"] % 150).astype(str)

    # 7. merchant_id (derivado de ProductCD)
    processed["merchant_id"] = "MCH_" + df_tx["ProductCD"].fillna("W").astype(str)

    # 8. is_fraud
    processed["is_fraud"] = df_tx["isFraud"].astype(int)

    # Guardar resultado
    out_path = Path(output_csv)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    processed.to_csv(out_path, index=False)

    fraud_count = processed["is_fraud"].sum()
    fraud_rate = (fraud_count / len(processed)) * 100
    print(f"[OK] Dataset transformado exitosamente en: {out_path}")
    print(f"   Filas: {len(processed):,} | Fraudes: {fraud_count:,} ({fraud_rate:.2f}%)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingesta dataset IEEE-CIS")
    parser.add_argument("--tx", default="data/raw/train_transaction.csv", help="Ruta a train_transaction.csv")
    parser.add_argument("--id", default="data/raw/train_identity.csv", help="Ruta a train_identity.csv")
    parser.add_argument("--out", default="data/processed/transactions.csv", help="Ruta destino")
    parser.add_argument("--sample", type=int, default=100_000, help="Número de filas a procesar (None para todo)")
    args = parser.parse_args()

    ingest_ieee_cis(args.tx, args.id, args.out, sample_size=args.sample)
