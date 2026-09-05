"""
src/preprocessing/imputer.py
============================
Estrategias de imputación de valores faltantes.

Regla crítica: los transformadores se ajustan SOLO sobre el Training set.
Se aplican (transform) sobre Validation y Test sin re-ajustar.

Columnas de los datasets públicos de referencia:
  - IEEE-CIS Fraud Detection (Kaggle)
  - Credit Card Fraud Detection (Kaggle)
  - PaySim (Kaggle)
  - Columnas comunes: transaction_id, user_id, amount, timestamp,
                      country, device_id, merchant_id, is_fraud
"""

from __future__ import annotations

from typing import Dict, Optional

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin


class FraudImputerTransformer(BaseEstimator, TransformerMixin):
    """
    Imputa valores faltantes respetando la semántica del dominio de fraude.

    Estrategias por columna:
    - amount   : mediana por merchant_id (o mediana global como fallback).
    - country  : categoría especial 'UNKNOWN' — el dispositivo desconocido es señal.
    - device_id: categoría especial 'UNKNOWN'.
    - merchant_id: categoría especial 'UNKNOWN'.
    - Columnas numéricas restantes: 0 (ausencia de historial = primera transacción).
    """

    # Columnas que reciben categoría especial 'UNKNOWN'
    UNKNOWN_COLS = ["country", "device_id", "merchant_id"]

    # Columnas numéricas que se imputan con 0 (velocity, behavioral)
    ZERO_IMPUTE_COLS = [
        "tx_count_5min", "tx_count_1h", "tx_count_24h",
        "amount_sum_1h", "unique_merchants_24h", "unique_countries_24h",
        "user_tx_count_30d", "days_since_last_tx",
        "user_avg_amount_30d", "user_std_amount_30d",
        "amount_z_score", "amount_ratio_to_avg",
    ]

    def __init__(self) -> None:
        self._amount_medians: Dict[str, float] = {}
        self._global_amount_median: float = 0.0

    def fit(self, X: pd.DataFrame, y=None) -> "FraudImputerTransformer":
        """
        Calcula las medianas de amount agrupadas por merchant_id sobre el Training set.
        """
        if "amount" in X.columns and "merchant_id" in X.columns:
            self._amount_medians = (
                X.groupby("merchant_id")["amount"]
                .median()
                .to_dict()
            )
            self._global_amount_median = float(X["amount"].median())
        return self

    def transform(self, X: pd.DataFrame, y=None) -> pd.DataFrame:
        """
        Aplica imputaciones. No modifica el DataFrame original.
        """
        X = X.copy()

        # -- amount: mediana por merchant_id, fallback a global --
        if "amount" in X.columns:
            missing_amount = X["amount"].isna()
            if missing_amount.any():
                def _impute_amount(row: pd.Series) -> float:
                    if pd.isna(row["amount"]):
                        return self._amount_medians.get(
                            row.get("merchant_id", None),
                            self._global_amount_median,
                        )
                    return row["amount"]

                X.loc[missing_amount, "amount"] = X[missing_amount].apply(
                    _impute_amount, axis=1
                )

        # -- Columnas categóricas: 'UNKNOWN' --
        for col in self.UNKNOWN_COLS:
            if col in X.columns:
                X[col] = X[col].fillna("UNKNOWN").astype(str)

        # -- Columnas numéricas: 0 --
        for col in self.ZERO_IMPUTE_COLS:
            if col in X.columns:
                X[col] = X[col].fillna(0.0)

        return X

    def fit_transform(self, X: pd.DataFrame, y=None, **fit_params) -> pd.DataFrame:
        return self.fit(X, y).transform(X)
