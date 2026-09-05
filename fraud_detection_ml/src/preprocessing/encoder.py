"""
src/preprocessing/encoder.py
=============================
Codificación de variables categóricas.

Estrategias:
- Baja cardinalidad (day_of_week, payment_method): OrdinalEncoding.
- Media cardinalidad (country, ~200 valores): OrdinalEncoding.
  LightGBM las trata nativamente como categóricas con su índice ordinal.
- Alta cardinalidad (merchant_id, device_id, miles de valores):
  Target Encoding con smoothing para evitar overfitting.
  CRÍTICO: se calcula solo sobre el Training set para evitar data leakage.

Fórmula de Target Encoding con smoothing:
  encoded = (n * category_mean + m * global_mean) / (n + m)
  donde:
    n = número de ocurrencias de la categoría en training
    m = parámetro de smoothing (por defecto 10)

Si una categoría no vista en training aparece en inferencia,
se le asigna la media global (fallback seguro).
"""

from __future__ import annotations

from typing import Dict, List, Optional

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.preprocessing import OrdinalEncoder


class TargetEncoderWithSmoothing(BaseEstimator, TransformerMixin):
    """
    Target encoding con smoothing para columnas de alta cardinalidad.

    El encoding se calcula únicamente sobre el Training set (fit).
    Durante transform, las categorías desconocidas reciben el global_mean.
    """

    def __init__(self, cols: List[str], smoothing: float = 10.0) -> None:
        self.cols = cols
        self.smoothing = smoothing
        self._encodings: Dict[str, Dict[str, float]] = {}
        self._global_means: Dict[str, float] = {}

    def fit(self, X: pd.DataFrame, y: pd.Series) -> "TargetEncoderWithSmoothing":
        """
        Calcula el encoding de cada categoría usando la media del target.

        Parameters
        ----------
        X : pd.DataFrame
            DataFrame de training con las columnas categóricas.
        y : pd.Series
            Target binario (is_fraud) del training set.
        """
        global_mean = float(y.mean())

        for col in self.cols:
            if col not in X.columns:
                continue
            self._global_means[col] = global_mean

            # Estadísticas por categoría
            stats = (
                pd.DataFrame({"cat": X[col].astype(str), "target": y.values})
                .groupby("cat")["target"]
                .agg(["count", "mean"])
            )

            # Smoothing formula
            n = stats["count"]
            cat_mean = stats["mean"]
            smoothed = (n * cat_mean + self.smoothing * global_mean) / (n + self.smoothing)

            self._encodings[col] = smoothed.to_dict()

        return self

    def transform(self, X: pd.DataFrame, y=None) -> pd.DataFrame:
        X = X.copy()
        for col in self.cols:
            if col not in X.columns:
                continue
            global_mean = self._global_means.get(col, 0.0)
            encoded_col = f"{col}_target_enc"
            X[encoded_col] = (
                X[col].astype(str)
                .map(self._encodings.get(col, {}))
                .fillna(global_mean)
            )
        return X


class FraudEncoderTransformer(BaseEstimator, TransformerMixin):
    """
    Codificador compuesto que aplica:
    1. OrdinalEncoding para columnas de media cardinalidad (country).
    2. Target Encoding para columnas de alta cardinalidad (merchant_id, device_id).
    """

    ORDINAL_COLS = ["country"]
    HIGH_CARDINALITY_COLS = ["merchant_id", "device_id"]

    def __init__(self, smoothing: float = 10.0) -> None:
        self.smoothing = smoothing
        self._ordinal_encoder = OrdinalEncoder(
            handle_unknown="use_encoded_value",
            unknown_value=-1,  # Categorías no vistas → -1
            dtype=np.float64,
        )
        self._target_encoder = TargetEncoderWithSmoothing(
            cols=self.HIGH_CARDINALITY_COLS,
            smoothing=smoothing,
        )
        self._ordinal_cols_present: List[str] = []

    def fit(self, X: pd.DataFrame, y: pd.Series) -> "FraudEncoderTransformer":
        # OrdinalEncoder
        self._ordinal_cols_present = [c for c in self.ORDINAL_COLS if c in X.columns]
        if self._ordinal_cols_present:
            self._ordinal_encoder.fit(X[self._ordinal_cols_present].astype(str))

        # Target Encoder (requiere y)
        self._target_encoder.fit(X, y)
        return self

    def transform(self, X: pd.DataFrame, y=None) -> pd.DataFrame:
        X = X.copy()

        # Ordinal encoding
        if self._ordinal_cols_present:
            ordinal_present = [c for c in self._ordinal_cols_present if c in X.columns]
            if ordinal_present:
                encoded = self._ordinal_encoder.transform(X[ordinal_present].astype(str))
                for i, col in enumerate(ordinal_present):
                    X[f"{col}_encoded"] = encoded[:, i]

        # Target encoding
        X = self._target_encoder.transform(X)
        return X

    def fit_transform(self, X: pd.DataFrame, y: pd.Series = None, **fit_params) -> pd.DataFrame:
        return self.fit(X, y).transform(X)
