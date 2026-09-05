"""
src/models/base_model.py
========================
Interfaz abstracta para todos los modelos de clasificación del pipeline.

Permite reemplazar LightGBM por XGBoost, Random Forest u otro clasificador
sin modificar el resto del pipeline: solo se cambia la implementación concreta.

Contrato del modelo:
    - fit(X, y)              : Entrena el modelo.
    - predict_proba(X)       : Retorna probabilidades de la clase positiva [0, 1].
    - save(path)             : Persiste el modelo en disco (joblib).
    - load(path) [classmethod]: Carga un modelo desde disco.
    - feature_importances     : Propiedad que retorna importancias de features.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd


class BaseFraudModel(ABC):
    """
    Interfaz abstracta que todos los clasificadores de fraude deben implementar.
    """

    @abstractmethod
    def fit(
        self,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        X_val: Optional[pd.DataFrame] = None,
        y_val: Optional[pd.Series] = None,
    ) -> "BaseFraudModel":
        """
        Entrena el modelo.

        Parameters
        ----------
        X_train : pd.DataFrame
            Features de entrenamiento.
        y_train : pd.Series
            Target binario (0=legítima, 1=fraude).
        X_val : pd.DataFrame, optional
            Features de validación para early stopping.
        y_val : pd.Series, optional
            Target de validación para early stopping.

        Returns
        -------
        self
        """
        ...

    @abstractmethod
    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        """
        Retorna la probabilidad de fraude para cada muestra.

        Parameters
        ----------
        X : pd.DataFrame
            Features de las transacciones a predecir.

        Returns
        -------
        np.ndarray
            Array 1D con fraud_probability ∈ [0, 1] para cada muestra.
        """
        ...

    @abstractmethod
    def save(self, path: str | Path) -> None:
        """Serializa el modelo a disco usando joblib."""
        ...

    @classmethod
    @abstractmethod
    def load(cls, path: str | Path) -> "BaseFraudModel":
        """Carga el modelo desde disco."""
        ...

    @property
    @abstractmethod
    def feature_importances(self) -> Optional[np.ndarray]:
        """
        Importancias de features del modelo entrenado.
        Retorna None si el modelo aún no fue entrenado.
        """
        ...

    def predict(self, X: pd.DataFrame, threshold: float = 0.5) -> np.ndarray:
        """
        Retorna predicciones binarias usando el umbral dado.
        Método concreto basado en predict_proba.
        """
        proba = self.predict_proba(X)
        return (proba >= threshold).astype(int)
