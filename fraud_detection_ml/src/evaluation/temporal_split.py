"""
src/evaluation/temporal_split.py
==================================
División temporal del dataset para entrenamiento, validación y test.

REGLA CRÍTICA: La división siempre es temporal, nunca aleatoria.
Una división aleatoria permite que el modelo vea transacciones del futuro
durante el entrenamiento, produciendo métricas infladas (data leakage).

Esquema de división:
    Pasado          → Training set   (~70%)
    Periodo medio   → Validation set (~15%)   ← Tuning de hiperparámetros
    Periodo reciente→ Test set       (~15%)   ← Evaluación final (no tocar)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Tuple

import pandas as pd


@dataclass
class TemporalSplit:
    """
    Resultado de la división temporal del dataset.

    Atributos
    ----------
    X_train, y_train : Arrays de entrenamiento.
    X_val, y_val     : Arrays de validación (para tuning de hiperparámetros).
    X_test, y_test   : Arrays de test (NO TOCAR hasta la evaluación final).
    """
    X_train: pd.DataFrame
    y_train: pd.Series
    X_val: pd.DataFrame
    y_val: pd.Series
    X_test: pd.DataFrame
    y_test: pd.Series
    train_size: int
    val_size: int
    test_size: int
    train_fraud_rate: float
    val_fraud_rate: float
    test_fraud_rate: float

    def __str__(self) -> str:
        return (
            f"TemporalSplit:\n"
            f"  Train: {self.train_size:,} rows | fraud rate: {self.train_fraud_rate:.2%}\n"
            f"  Val:   {self.val_size:,} rows | fraud rate: {self.val_fraud_rate:.2%}\n"
            f"  Test:  {self.test_size:,} rows | fraud rate: {self.test_fraud_rate:.2%}"
        )


def temporal_train_val_test_split(
    df: pd.DataFrame,
    target_col: str = "is_fraud",
    train_end_date: Optional[str] = None,
    val_end_date: Optional[str] = None,
    timestamp_col: str = "timestamp",
    feature_cols: Optional[list] = None,
) -> TemporalSplit:
    """
    Divide el dataset en train/val/test respetando el orden cronológico.

    Parameters
    ----------
    df : pd.DataFrame
        Dataset completo con timestamp y target.
    target_col : str
        Nombre de la columna target (por defecto 'is_fraud').
    train_end_date : str, optional
        Fecha de corte para el Training set en formato 'YYYY-MM-DD'.
        Todo lo anterior a esta fecha va a Training.
        Si None, usa el percentil 70 del tiempo.
    val_end_date : str, optional
        Fecha de corte entre Validation y Test en formato 'YYYY-MM-DD'.
        Si None, usa el percentil 85 del tiempo.
    timestamp_col : str
        Nombre de la columna de timestamp.
    feature_cols : list, optional
        Columnas a incluir como features. Si None, usa todas menos target y timestamp.

    Returns
    -------
    TemporalSplit
        Objeto con los 6 conjuntos de datos.
    """
    df = df.copy()

    # Asegurar que timestamp es datetime
    if not pd.api.types.is_datetime64_any_dtype(df[timestamp_col]):
        df[timestamp_col] = pd.to_datetime(df[timestamp_col], utc=True)

    df = df.sort_values(timestamp_col).reset_index(drop=True)

    # Determinar fechas de corte si no se especifican
    if train_end_date is None:
        train_cutoff = df[timestamp_col].quantile(0.70)
    else:
        train_cutoff = pd.to_datetime(train_end_date, utc=True)

    if val_end_date is None:
        val_cutoff = df[timestamp_col].quantile(0.85)
    else:
        val_cutoff = pd.to_datetime(val_end_date, utc=True)

    # División
    mask_train = df[timestamp_col] <= train_cutoff
    mask_val = (df[timestamp_col] > train_cutoff) & (df[timestamp_col] <= val_cutoff)
    mask_test = df[timestamp_col] > val_cutoff

    df_train = df[mask_train]
    df_val = df[mask_val]
    df_test = df[mask_test]

    # Feature columns
    exclude = {target_col, timestamp_col, "transaction_id"}
    if feature_cols is None:
        feature_cols = [c for c in df.columns if c not in exclude]

    def _safe_fraud_rate(subset: pd.DataFrame) -> float:
        if len(subset) == 0:
            return 0.0
        return float(subset[target_col].mean())

    return TemporalSplit(
        X_train=df_train[feature_cols],
        y_train=df_train[target_col],
        X_val=df_val[feature_cols],
        y_val=df_val[target_col],
        X_test=df_test[feature_cols],
        y_test=df_test[target_col],
        train_size=len(df_train),
        val_size=len(df_val),
        test_size=len(df_test),
        train_fraud_rate=_safe_fraud_rate(df_train),
        val_fraud_rate=_safe_fraud_rate(df_val),
        test_fraud_rate=_safe_fraud_rate(df_test),
    )
