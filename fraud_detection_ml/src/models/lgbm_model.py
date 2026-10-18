"""
src/models/lgbm_model.py
========================
Modelo principal: LightGBM para clasificación binaria de fraude.

Características clave:
- scale_pos_weight automático para manejar class imbalance.
- Early stopping sobre el conjunto de validación.
- Guarda y carga con joblib.
- Expone feature_importances para el módulo de explainability.

Parámetros configurables desde configs/pipeline.yaml.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd

from src.models.base_model import BaseFraudModel


class LightGBMFraudModel(BaseFraudModel):
    """
    Clasificador de fraude basado en LightGBM.

    Razón de selección: Mejor relación precisión/velocidad/complejidad
    para datos tabulares con class imbalance. Manejo nativo de categóricas,
    early stopping integrado y compatible con SHAP TreeExplainer.
    """

    def __init__(
        self,
        n_estimators: int = 500,
        learning_rate: float = 0.05,
        num_leaves: int = 31,
        min_child_samples: int = 20,
        colsample_bytree: float = 0.8,
        early_stopping_rounds: int = 50,
        scale_pos_weight: Optional[float] = None,
        scale_pos_weight_mode: str = "sqrt",
        subsample: float = 0.8,
        subsample_freq: int = 1,
        reg_alpha: float = 0.1,
        reg_lambda: float = 1.0,
        max_depth: int = -1,
        random_state: int = 42,
        n_jobs: int = -1,
    ) -> None:
        self.n_estimators = n_estimators
        self.learning_rate = learning_rate
        self.num_leaves = num_leaves
        self.min_child_samples = min_child_samples
        self.colsample_bytree = colsample_bytree
        self.early_stopping_rounds = early_stopping_rounds
        self.scale_pos_weight = scale_pos_weight
        self.scale_pos_weight_mode = scale_pos_weight_mode
        self.subsample = subsample
        self.subsample_freq = subsample_freq
        self.reg_alpha = reg_alpha
        self.reg_lambda = reg_lambda
        self.max_depth = max_depth
        self.random_state = random_state
        self.n_jobs = n_jobs

        self._model: Optional[lgb.LGBMClassifier] = None
        self._feature_names: Optional[list] = None

    def fit(
        self,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        X_val: Optional[pd.DataFrame] = None,
        y_val: Optional[pd.Series] = None,
    ) -> "LightGBMFraudModel":
        """
        Entrena LightGBM con scale_pos_weight calibrado y regularización.
        """
        n_pos = int(y_train.sum())
        n_neg = int((y_train == 0).sum())

        if n_pos == 0:
            raise ValueError("El training set no contiene ejemplos de fraude (is_fraud=1).")

        if self.scale_pos_weight is not None:
            spw = float(self.scale_pos_weight)
        elif self.scale_pos_weight_mode == "sqrt":
            spw = float(np.sqrt(n_neg / n_pos))
        elif self.scale_pos_weight_mode == "auto":
            spw = float(n_neg / n_pos)
        else:
            spw = 1.0

        self._model = lgb.LGBMClassifier(
            objective="binary",
            n_estimators=self.n_estimators,
            learning_rate=self.learning_rate,
            num_leaves=self.num_leaves,
            min_child_samples=self.min_child_samples,
            colsample_bytree=self.colsample_bytree,
            scale_pos_weight=spw,
            subsample=self.subsample,
            subsample_freq=self.subsample_freq,
            reg_alpha=self.reg_alpha,
            reg_lambda=self.reg_lambda,
            max_depth=self.max_depth,
            random_state=self.random_state,
            n_jobs=self.n_jobs,
            verbose=-1,  # Silenciar output de LightGBM durante entrenamiento
        )

        self._feature_names = list(X_train.columns)

        fit_params = {}
        if X_val is not None and y_val is not None:
            fit_params["eval_set"] = [(X_val, y_val)]
            fit_params["eval_metric"] = "average_precision"
            fit_params["callbacks"] = [
                lgb.early_stopping(
                    stopping_rounds=self.early_stopping_rounds,
                    verbose=False,
                ),
                lgb.log_evaluation(period=-1),  # Silenciar
            ]

        self._model.fit(X_train, y_train, **fit_params)
        return self

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        """
        Retorna fraud_probability ∈ [0, 1] para cada muestra.
        """
        if self._model is None:
            raise RuntimeError("El modelo no ha sido entrenado. Llama a fit() primero.")
        proba = self._model.predict_proba(X)
        return proba[:, 1]  # Columna 1 = probabilidad de la clase positiva (fraude)

    def save(self, path: str | Path) -> None:
        """Serializa el modelo a disco con joblib."""
        if self._model is None:
            raise RuntimeError("No hay modelo entrenado para guardar.")
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(
            {"model": self._model, "feature_names": self._feature_names},
            path,
            compress=3,
        )

    @classmethod
    def load(cls, path: str | Path) -> "LightGBMFraudModel":
        """Carga un modelo serializado desde disco."""
        data = joblib.load(path)
        instance = cls()
        instance._model = data["model"]
        instance._feature_names = data.get("feature_names")
        return instance

    @property
    def feature_importances(self) -> Optional[np.ndarray]:
        """Importancias de features por ganancia (gain)."""
        if self._model is None:
            return None
        return self._model.booster_.feature_importance(importance_type="gain")

    @property
    def feature_names(self) -> Optional[list]:
        return self._feature_names

    @property
    def best_iteration(self) -> Optional[int]:
        """Número de iteraciones usadas tras early stopping."""
        if self._model is None:
            return None
        return getattr(self._model, "best_iteration_", None)
