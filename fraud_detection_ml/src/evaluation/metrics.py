"""
src/evaluation/metrics.py
==========================
Métricas de evaluación para el pipeline de detección de fraude.

Métricas primarias:
    PR-AUC  : La más honesta en datasets desbalanceados. No se infla por TN.
    Recall  : Fraudes detectados. Minimiza las pérdidas financieras.
    F1      : Balance Precision-Recall al umbral seleccionado.

Métricas secundarias:
    ROC-AUC : Para comparación con literatura, no para selección de modelo.
    FPR     : Tasa de falsas alarmas. Impacta la experiencia del usuario legítimo.
    FNR     : Tasa de fraudes no detectados. Impacta las pérdidas financieras.

Evaluación basada en costos:
    Permite seleccionar el umbral óptimo minimizando el costo total esperado.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.metrics import (
    average_precision_score,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
)


def compute_all_metrics(
    y_true: np.ndarray,
    y_proba: np.ndarray,
    threshold: float = 0.5,
    cost_fp: float = 5.0,
    cost_fn: float = 150.0,
) -> Dict[str, float]:
    """
    Calcula el conjunto completo de métricas para el dataset dado.

    Parameters
    ----------
    y_true    : Array de etiquetas reales (0/1).
    y_proba   : Array de probabilidades predichas ∈ [0, 1].
    threshold : Umbral de decisión para las métricas binarias.
    cost_fp   : Costo de un falso positivo (bloquear transacción legítima).
    cost_fn   : Costo de un falso negativo (fraude no detectado).

    Returns
    -------
    dict
        Diccionario con todas las métricas calculadas.
    """
    y_pred = (y_proba >= threshold).astype(int)

    # Confusion matrix
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()

    # Tasas
    n_actual_pos = tp + fn
    n_actual_neg = tn + fp

    fpr = fp / n_actual_neg if n_actual_neg > 0 else 0.0
    fnr = fn / n_actual_pos if n_actual_pos > 0 else 0.0

    # Costo total al umbral dado
    total_cost = fp * cost_fp + fn * cost_fn

    return {
        # Métricas primarias
        "pr_auc": float(average_precision_score(y_true, y_proba)),
        "roc_auc": float(roc_auc_score(y_true, y_proba)),
        "f1": float(f1_score(y_true, y_pred, zero_division=0)),
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        # Conteos de confusion matrix
        "true_positives": int(tp),
        "false_positives": int(fp),
        "true_negatives": int(tn),
        "false_negatives": int(fn),
        # Tasas derivadas
        "false_positive_rate": float(fpr),
        "false_negative_rate": float(fnr),
        # Evaluación de costo
        "total_cost": float(total_cost),
        "cost_fp": cost_fp,
        "cost_fn": cost_fn,
        "threshold_used": threshold,
        # Info general
        "n_samples": int(len(y_true)),
        "n_fraud": int(y_true.sum()),
        "fraud_rate": float(y_true.mean()),
    }


def find_optimal_threshold(
    y_true: np.ndarray,
    y_proba: np.ndarray,
    cost_fp: float = 5.0,
    cost_fn: float = 150.0,
) -> Tuple[float, Dict[str, float]]:
    """
    Encuentra el umbral óptimo minimizando el costo total.

    Evalúa todos los umbrales de la curva PR y selecciona el que minimiza:
        Cost = FP_count * cost_FP + FN_count * cost_FN

    Parameters
    ----------
    y_true  : Array de etiquetas reales.
    y_proba : Array de probabilidades predichas.
    cost_fp : Costo de un falso positivo.
    cost_fn : Costo de un falso negativo.

    Returns
    -------
    Tuple[float, dict]
        (umbral_óptimo, métricas_en_ese_umbral)
    """
    precisions, recalls, thresholds = precision_recall_curve(y_true, y_proba)

    best_threshold = 0.5
    best_cost = float("inf")

    for threshold in thresholds:
        y_pred = (y_proba >= threshold).astype(int)
        tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
        cost = fp * cost_fp + fn * cost_fn
        if cost < best_cost:
            best_cost = cost
            best_threshold = float(threshold)

    metrics = compute_all_metrics(y_true, y_proba, threshold=best_threshold, cost_fp=cost_fp, cost_fn=cost_fn)
    return best_threshold, metrics


def save_metrics(
    metrics: Dict[str, float],
    path: str | Path,
    extra_info: Optional[dict] = None,
) -> None:
    """
    Guarda las métricas como JSON en el directorio del experimento.

    Parameters
    ----------
    metrics    : Diccionario de métricas.
    path       : Ruta del archivo JSON de salida.
    extra_info : Información adicional a incluir (hiperparámetros, etc.).
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    output = {**(extra_info or {}), **metrics}
    with open(path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, default=str)

    print(f"[Metrics] Saved to {path}")
    print(f"  PR-AUC:  {metrics.get('pr_auc', 'N/A'):.4f}")
    print(f"  ROC-AUC: {metrics.get('roc_auc', 'N/A'):.4f}")
    print(f"  F1:      {metrics.get('f1', 'N/A'):.4f}")
    print(f"  Recall:  {metrics.get('recall', 'N/A'):.4f}")
    print(f"  FPR:     {metrics.get('false_positive_rate', 'N/A'):.4f}")
    print(f"  Cost:    ${metrics.get('total_cost', 'N/A'):,.2f}")
