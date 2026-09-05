"""
src/preprocessing/scaler.py
============================
Escalado de variables numéricas.

Estrategia:
- amount: log1p primero (comprime escala sin eliminar outliers),
          luego RobustScaler (basado en mediana/IQR, no se ve afectado por extremos).
- Velocity features: MinMaxScaler → [0, 1].
- Z-scores: ya normalizados por construcción (no escalar de nuevo).
- Features binarias (is_*): no escalar.

Los modelos de árboles (LightGBM, Isolation Forest) son invariantes a
transformaciones monótonas, pero el escalado mejora la convergencia del
Isolation Forest y hace comparables los scores del Risk Fusion.
"""

from __future__ import annotations

from typing import List

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.preprocessing import MinMaxScaler, RobustScaler


class FraudScalerTransformer(BaseEstimator, TransformerMixin):
    """
    Aplica escalado diferenciado según el tipo semántico de cada feature.

    Columns tratadas:
    - amount_log        : log1p(amount) + RobustScaler
    - velocity_cols     : MinMaxScaler [0, 1]
    - otras numéricas   : RobustScaler

    Columns excluidas (no escalar):
    - Binarias: is_*, is_duplicate_candidate
    - Z-scores: amount_z_score (ya están normalizados)
    - Categóricas codificadas: *_encoded, *_target_enc
    """

    VELOCITY_COLS = [
        "tx_count_5min",
        "tx_count_1h",
        "tx_count_24h",
        "amount_sum_1h",
        "unique_merchants_24h",
        "unique_countries_24h",
    ]

    # No escalar estas columnas
    PASSTHROUGH_COLS = [
        "amount_z_score",
        "amount_ratio_to_avg",
        "is_new_device",
        "is_new_country",
        "is_new_merchant",
        "is_weekend",
        "is_night",
        "is_duplicate_candidate",
        "hour_sin",
        "hour_cos",
        "country_encoded",
        "merchant_target_enc",
        "device_target_enc",
        "day_of_week",
    ]

    def __init__(self) -> None:
        self._robust_scaler = RobustScaler()
        self._minmax_scaler = MinMaxScaler()
        self._robust_cols: List[str] = []
        self._fitted = False

    def fit(self, X: pd.DataFrame, y=None) -> "FraudScalerTransformer":
        X = X.copy()

        # Aplicar log1p al monto antes de escalar
        if "amount" in X.columns:
            X["amount_log"] = np.log1p(X["amount"])

        # Columnas a escalar con RobustScaler
        skip = set(self.VELOCITY_COLS + self.PASSTHROUGH_COLS)
        self._robust_cols = [
            c for c in X.select_dtypes(include=[np.number]).columns
            if c not in skip and c != "amount" and "is_fraud" not in c
        ]

        if self._robust_cols:
            self._robust_scaler.fit(X[self._robust_cols])

        velocity_present = [c for c in self.VELOCITY_COLS if c in X.columns]
        if velocity_present:
            self._minmax_scaler.fit(X[velocity_present])

        self._velocity_present = velocity_present
        self._fitted = True
        return self

    def transform(self, X: pd.DataFrame, y=None) -> pd.DataFrame:
        X = X.copy()

        # log1p del monto
        if "amount" in X.columns:
            X["amount_log"] = np.log1p(X["amount"])
            X = X.drop(columns=["amount"])

        if self._robust_cols:
            cols_present = [c for c in self._robust_cols if c in X.columns]
            if cols_present:
                X[cols_present] = self._robust_scaler.transform(X[cols_present])

        if self._velocity_present:
            vel_present = [c for c in self._velocity_present if c in X.columns]
            if vel_present:
                X[vel_present] = self._minmax_scaler.transform(X[vel_present])

        return X

    def fit_transform(self, X: pd.DataFrame, y=None, **fit_params) -> pd.DataFrame:
        return self.fit(X, y).transform(X)
