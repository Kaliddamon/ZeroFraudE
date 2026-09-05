"""
src/anomaly/isolation_forest.py
================================
Modelo de detección de anomalías basado en Isolation Forest.

Complementa al modelo supervisado detectando comportamientos inusuales
que no aparecen en los ejemplos históricos de fraude.

Estrategia:
- Entrenado ÚNICAMENTE con transacciones etiquetadas como legítimas (is_fraud=0).
- El raw score (negativo) se normaliza a [0, 1]: 1 = máxima anomalía.
- Se guarda junto al rango de scores del training para normalización consistente.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest


class FraudAnomalyDetector:
    """
    Detector de anomalías para el pipeline de fraude.

    Uso en entrenamiento:
        detector = FraudAnomalyDetector()
        # Entrenar solo con transacciones legítimas
        X_legit = X_train[y_train == 0]
        detector.fit(X_legit)
        anomaly_scores = detector.score(X_all)
        detector.save("artifacts/v1.0.0/anomaly_model.joblib")

    Uso en inferencia:
        detector = FraudAnomalyDetector.load("artifacts/v1.0.0/anomaly_model.joblib")
        score = detector.score_single(x_vector)  # float ∈ [0, 1]
    """

    def __init__(
        self,
        contamination: float = 0.01,
        n_estimators: int = 100,
        max_samples: str | int = "auto",
        random_state: int = 42,
        n_jobs: int = -1,
    ) -> None:
        self.contamination = contamination
        self.n_estimators = n_estimators
        self.max_samples = max_samples
        self.random_state = random_state
        self.n_jobs = n_jobs

        self._model: Optional[IsolationForest] = None
        # Rango del raw score en training para normalización consistente
        self._score_min: float = 0.0
        self._score_max: float = 1.0

    def fit(self, X_legit: pd.DataFrame) -> "FraudAnomalyDetector":
        """
        Entrena el Isolation Forest SOLO con transacciones legítimas.

        Parameters
        ----------
        X_legit : pd.DataFrame
            Features de transacciones etiquetadas como legítimas (is_fraud=0).
        """
        self._model = IsolationForest(
            contamination=self.contamination,
            n_estimators=self.n_estimators,
            max_samples=self.max_samples,
            random_state=self.random_state,
            n_jobs=self.n_jobs,
        )
        self._model.fit(X_legit)

        # Calcular rango del raw score sobre los datos de training para normalización
        raw_scores = self._model.score_samples(X_legit)
        self._score_min = float(raw_scores.min())
        self._score_max = float(raw_scores.max())

        return self

    def score(self, X: pd.DataFrame) -> np.ndarray:
        """
        Retorna anomaly_score ∈ [0, 1] para cada muestra.

        1.0 = máxima anomalía (transacción muy diferente al comportamiento normal).
        0.0 = completamente normal.

        Parameters
        ----------
        X : pd.DataFrame
            Features de las transacciones a puntuar.

        Returns
        -------
        np.ndarray
            Array 1D con anomaly_score ∈ [0, 1].
        """
        if self._model is None:
            raise RuntimeError("Modelo no entrenado. Llama fit() primero.")

        raw_scores = self._model.score_samples(X)
        return self._normalize_scores(raw_scores)

    def score_single(self, x: pd.DataFrame) -> float:
        """
        Retorna anomaly_score para UNA transacción (inferencia).

        Parameters
        ----------
        x : pd.DataFrame
            DataFrame de 1 fila con el vector de features.

        Returns
        -------
        float
            anomaly_score ∈ [0, 1].
        """
        scores = self.score(x)
        return float(scores[0])

    def _normalize_scores(self, raw_scores: np.ndarray) -> np.ndarray:
        """
        Normaliza los raw scores negativos a [0, 1].

        Fórmula:
            anomaly_score = 1 - (raw - min) / (max - min)

        Donde min y max son del training set.
        Valores fuera del rango de training se clip a [0, 1].
        """
        score_range = self._score_max - self._score_min
        if score_range < 1e-10:
            # Evitar división por cero si todos los scores son iguales
            return np.zeros(len(raw_scores))

        normalized = 1.0 - (raw_scores - self._score_min) / score_range
        return np.clip(normalized, 0.0, 1.0)

    def save(self, path: str | Path) -> None:
        """Serializa el modelo y el rango de normalización a disco."""
        if self._model is None:
            raise RuntimeError("No hay modelo entrenado para guardar.")
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(
            {
                "model": self._model,
                "score_min": self._score_min,
                "score_max": self._score_max,
            },
            path,
            compress=3,
        )

    @classmethod
    def load(cls, path: str | Path) -> "FraudAnomalyDetector":
        """Carga el modelo desde disco."""
        data = joblib.load(path)
        instance = cls()
        instance._model = data["model"]
        instance._score_min = data["score_min"]
        instance._score_max = data["score_max"]
        return instance
