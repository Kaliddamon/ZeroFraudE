"""
src/models/logistic_model.py
=============================
Modelo baseline: Regresión Logística.

Propósito: establecer un piso de rendimiento mínimo.
Se entrena con las mismas features que LightGBM para comparación justa.
Implementa la misma interfaz BaseFraudModel para compatibilidad total.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression

from src.models.base_model import BaseFraudModel


class LogisticFraudModel(BaseFraudModel):
    """
    Clasificador baseline de fraude basado en Regresión Logística.

    Razón de uso: Interpretable, rápido, útil como referencia mínima.
    Si LightGBM no supera significativamente a la regresión logística,
    el feature engineering necesita revisión.
    """

    def __init__(
        self,
        max_iter: int = 1000,
        random_state: int = 42,
        class_weight: str = "balanced",
        solver: str = "lbfgs",
        C: float = 1.0,
    ) -> None:
        self.max_iter = max_iter
        self.random_state = random_state
        self.class_weight = class_weight
        self.solver = solver
        self.C = C

        self._model: Optional[LogisticRegression] = None
        self._feature_names: Optional[list] = None

    def fit(
        self,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        X_val: Optional[pd.DataFrame] = None,
        y_val: Optional[pd.Series] = None,
    ) -> "LogisticFraudModel":
        """
        Entrena la regresión logística con class_weight='balanced'.
        X_val / y_val se ignoran (no hay early stopping en logistic regression).
        """
        self._feature_names = list(X_train.columns)
        self._model = LogisticRegression(
            max_iter=self.max_iter,
            random_state=self.random_state,
            class_weight=self.class_weight,
            solver=self.solver,
            C=self.C,
        )
        self._model.fit(X_train, y_train)
        return self

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        if self._model is None:
            raise RuntimeError("Modelo no entrenado. Llama fit() primero.")
        return self._model.predict_proba(X)[:, 1]

    def save(self, path: str | Path) -> None:
        if self._model is None:
            raise RuntimeError("No hay modelo para guardar.")
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(
            {"model": self._model, "feature_names": self._feature_names},
            path,
            compress=3,
        )

    @classmethod
    def load(cls, path: str | Path) -> "LogisticFraudModel":
        data = joblib.load(path)
        instance = cls()
        instance._model = data["model"]
        instance._feature_names = data.get("feature_names")
        return instance

    @property
    def feature_importances(self) -> Optional[np.ndarray]:
        """Coeficientes absolutos como proxy de importancia."""
        if self._model is None:
            return None
        return np.abs(self._model.coef_[0])

    @property
    def feature_names(self) -> Optional[list]:
        return self._feature_names
