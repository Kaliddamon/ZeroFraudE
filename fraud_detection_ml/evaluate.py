"""
evaluate.py
============
Script de evaluación final sobre el Test set.

Este script se ejecuta UNA SOLA VEZ al final del proyecto.
El Test set nunca fue usado durante el entrenamiento ni el tuning.

Genera:
    - Métricas definitivas (PR-AUC, F1, Recall, FPR, Cost)
    - Comparación con el baseline
    - Métricas del modelo de anomalías
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from src.config import load_config, ARTIFACTS_DIR, EXPERIMENTS_DIR
from src.preprocessing.imputer import FraudImputerTransformer
from src.preprocessing.encoder import FraudEncoderTransformer
from src.behavioral.profiler import BehavioralProfiler
from src.features.feature_pipeline import MODEL_FEATURES
from src.models.lgbm_model import LightGBMFraudModel
from src.models.logistic_model import LogisticFraudModel
from src.anomaly.isolation_forest import FraudAnomalyDetector
from src.evaluation.temporal_split import temporal_train_val_test_split
from src.evaluation.metrics import compute_all_metrics, save_metrics

import argparse
import joblib


def main():
    parser = argparse.ArgumentParser(description="Evaluate the trained model on the Test set")
    parser.add_argument(
        "--data",
        type=str,
        default=str(ROOT / "data" / "raw" / "synthetic_transactions.csv"),
    )
    parser.add_argument("--version", type=str, default="1.0.0")
    args = parser.parse_args()

    config = load_config()
    version = args.version
    artifacts_dir = ARTIFACTS_DIR / version

    print("=" * 60)
    print(f"  FINAL EVALUATION — Test Set")
    print(f"  Model version: {version}")
    print("=" * 60)

    # ── Carga de datos y split ────────────────────────────────────────────
    df = pd.read_csv(args.data)
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)

    # Re-construir behavioral features (order cronológico)
    profiler = BehavioralProfiler()
    df = profiler.fit_transform(df, window_days=config.features.behavioral_window_days)

    split = temporal_train_val_test_split(
        df, target_col="is_fraud",
        train_end_date=config.data.train_end_date,
        val_end_date=config.data.val_end_date,
    )

    # Imputación y encoding
    imputer = joblib.load(artifacts_dir / "imputer.joblib")
    encoder = joblib.load(artifacts_dir / "encoder.joblib")

    X_test = imputer.transform(split.X_test)
    X_test = encoder.transform(X_test)

    for c in MODEL_FEATURES:
        if c not in X_test.columns:
            X_test[c] = 0.0
    X_test = X_test[MODEL_FEATURES]

    # ── Carga de modelos ──────────────────────────────────────────────────
    lgbm = LightGBMFraudModel.load(artifacts_dir / "fraud_model.joblib")

    with open(artifacts_dir / "thresholds.json", "r") as f:
        thresholds = json.load(f)
    threshold = thresholds["critical"]

    # ── Evaluación LightGBM en Test set ───────────────────────────────────
    print("\n[LightGBM] Evaluating on Test set...")
    lgbm_proba = lgbm.predict_proba(X_test)
    lgbm_metrics = compute_all_metrics(
        split.y_test.values, lgbm_proba,
        threshold=threshold,
        cost_fp=config.evaluation.cost_fp,
        cost_fn=config.evaluation.cost_fn,
    )

    exp_dir = EXPERIMENTS_DIR / "final_evaluation"
    save_metrics(lgbm_metrics, exp_dir / "lgbm_test_metrics.json",
                 extra_info={"model_type": "LightGBM", "dataset": "test_set",
                            "threshold": threshold, "model_version": version})

    # ── Evaluación Anomaly en Test set ────────────────────────────────────
    anomaly_path = artifacts_dir / "anomaly_model.joblib"
    if anomaly_path.exists():
        print("\n[Isolation Forest] Scoring Test set...")
        anomaly = FraudAnomalyDetector.load(anomaly_path)
        anomaly_scores = anomaly.score(X_test)
        print(f"  Anomaly score range: [{anomaly_scores.min():.3f}, {anomaly_scores.max():.3f}]")
        print(f"  Mean anomaly score (fraud):   {anomaly_scores[split.y_test.values == 1].mean():.3f}")
        print(f"  Mean anomaly score (legit):   {anomaly_scores[split.y_test.values == 0].mean():.3f}")

    # ── Resumen ──────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("  FINAL RESULTS (Test Set)")
    print("=" * 60)
    print(f"  Test set size:   {split.test_size:,}")
    print(f"  Fraud rate:      {split.test_fraud_rate:.2%}")
    print(f"  Threshold:       {threshold:.4f}")
    print(f"  PR-AUC:          {lgbm_metrics['pr_auc']:.4f}")
    print(f"  ROC-AUC:         {lgbm_metrics['roc_auc']:.4f}")
    print(f"  F1:              {lgbm_metrics['f1']:.4f}")
    print(f"  Precision:       {lgbm_metrics['precision']:.4f}")
    print(f"  Recall:          {lgbm_metrics['recall']:.4f}")
    print(f"  FPR:             {lgbm_metrics['false_positive_rate']:.4f}")
    print(f"  FNR:             {lgbm_metrics['false_negative_rate']:.4f}")
    print(f"  Total cost:      ${lgbm_metrics['total_cost']:,.2f}")
    print(f"  TP: {lgbm_metrics['true_positives']}  FP: {lgbm_metrics['false_positives']}  "
          f"FN: {lgbm_metrics['false_negatives']}  TN: {lgbm_metrics['true_negatives']}")
    print("=" * 60)


if __name__ == "__main__":
    main()
