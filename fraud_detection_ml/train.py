"""
train.py
========
Script principal de entrenamiento del pipeline de fraude.

Ejecuta el pipeline completo:
    1. Carga de datos
    2. División temporal
    3. Behavioral profiling (construye perfiles en orden cronológico)
    4. Feature engineering
    5. Encoding (target encoding sobre training set)
    6. Entrenamiento del baseline (Logistic Regression)
    7. Entrenamiento del modelo principal (LightGBM)
    8. Entrenamiento del modelo de anomalías (Isolation Forest)
    9. Threshold tuning (minimización de costo en Validation)
    10. Evaluación en Validation set
    11. Guardado de todos los artefactos

Uso:
    python train.py
    python train.py --data data/raw/synthetic_transactions.csv
    python train.py --data data/raw/kaggle_dataset.csv
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

# Añadir la raíz del proyecto al path para imports
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from src.config import load_config, ARTIFACTS_DIR, EXPERIMENTS_DIR, CONFIGS_DIR
from src.preprocessing.imputer import FraudImputerTransformer
from src.preprocessing.encoder import FraudEncoderTransformer
from src.behavioral.profiler import BehavioralProfiler
from src.features.feature_pipeline import MODEL_FEATURES, build_feature_matrix_batch
from src.features.transaction_features import add_transaction_features
from src.features.temporal_features import add_velocity_features_batch
from src.models.lgbm_model import LightGBMFraudModel
from src.models.logistic_model import LogisticFraudModel
from src.anomaly.isolation_forest import FraudAnomalyDetector
from src.evaluation.temporal_split import temporal_train_val_test_split
from src.evaluation.metrics import compute_all_metrics, find_optimal_threshold, save_metrics
from src.risk.fusion import RiskFusionEngine

import joblib


def main():
    parser = argparse.ArgumentParser(description="Train the fraud detection pipeline")
    parser.add_argument(
        "--data",
        type=str,
        default=str(ROOT / "data" / "raw" / "synthetic_transactions.csv"),
        help="Path to the transactions CSV file.",
    )
    parser.add_argument("--version", type=str, default="1.0.0", help="Model version string.")
    args = parser.parse_args()

    config = load_config()
    np.random.seed(config.seed)

    version = args.version
    artifacts_dir = ARTIFACTS_DIR / version
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print(f"  FRAUD DETECTION ML PIPELINE — Training")
    print(f"  Model version: {version}")
    print(f"  Seed: {config.seed}")
    print("=" * 60)

    # ── 1. Carga de datos ──────────────────────────────────────────────────
    print("\n[1/11] Loading data...")
    df = pd.read_csv(args.data)
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    print(f"  Loaded {len(df):,} transactions | Fraud rate: {df['is_fraud'].mean():.2%}")

    # Validaciones básicas
    required_cols = ["transaction_id", "user_id", "amount", "timestamp", "country",
                     "device_id", "merchant_id", "is_fraud"]
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    # Eliminar duplicados y montos negativos
    df = df.drop_duplicates(subset=["transaction_id"])
    df = df[df["amount"] > 0].reset_index(drop=True)

    # ── 2. Feature engineering: Transaccionales ────────────────────────────
    print("\n[2/11] Computing transaction features...")
    df = add_transaction_features(df)

    # ── 3. Feature engineering: Velocidad ──────────────────────────────────
    print("\n[3/11] Computing velocity features (batch windowing)...")
    df = add_velocity_features_batch(df)

    # ── 4. Behavioral Profiling (en orden cronológico, ANTES del split) ────
    print("\n[4/11] Building behavioral profiles (chronological order)...")
    profiler = BehavioralProfiler()
    df = profiler.fit_transform(df, window_days=config.features.behavioral_window_days)
    print(f"  Profiles built for {profiler.user_count:,} users")

    # ── 5. División temporal ───────────────────────────────────────────────
    print("\n[5/11] Temporal train/val/test split...")
    split = temporal_train_val_test_split(
        df,
        target_col="is_fraud",
        train_end_date=config.data.train_end_date,
        val_end_date=config.data.val_end_date,
        feature_cols=None,  # Usa todas las columnas excepto target/timestamp/id
    )
    print(split)

    # ── 6. Imputation ─────────────────────────────────────────────────────
    print("\n[6/11] Imputing missing values...")
    imputer = FraudImputerTransformer()
    X_train = imputer.fit_transform(split.X_train)
    X_val = imputer.transform(split.X_val)
    X_test = imputer.transform(split.X_test)
    joblib.dump(imputer, artifacts_dir / "imputer.joblib", compress=3)
    print(f"  Imputer fitted on training set and saved.")

    # ── 7. Encoding ───────────────────────────────────────────────────────
    print("\n[7/11] Encoding categorical features...")
    encoder = FraudEncoderTransformer(smoothing=10.0)
    X_train = encoder.fit_transform(X_train, split.y_train)
    X_val = encoder.transform(X_val)
    X_test = encoder.transform(X_test)
    joblib.dump(encoder, artifacts_dir / "encoder.joblib", compress=3)
    print(f"  Encoder fitted on training set and saved.")

    # ── 8. Feature matrix (selección de columnas del modelo) ──────────────
    print("\n[8/11] Building feature matrix...")
    # Seleccionar solo las features que el modelo espera
    available = [c for c in MODEL_FEATURES if c in X_train.columns]
    missing_feats = [c for c in MODEL_FEATURES if c not in X_train.columns]
    if missing_feats:
        print(f"  WARNING: Missing features (filled with 0): {missing_feats}")
        for c in missing_feats:
            X_train[c] = 0.0
            X_val[c] = 0.0
            X_test[c] = 0.0

    X_train = X_train[MODEL_FEATURES]
    X_val = X_val[MODEL_FEATURES]
    X_test = X_test[MODEL_FEATURES]
    print(f"  Feature matrix shape: {X_train.shape}")

    # Guardar feature config
    with open(artifacts_dir / "feature_config.json", "w") as f:
        json.dump(MODEL_FEATURES, f, indent=2)

    # ── 9. Baseline (Logistic Regression) ─────────────────────────────────
    print("\n[9/11] Training baseline (Logistic Regression)...")
    baseline = LogisticFraudModel(random_state=config.seed)
    baseline.fit(X_train, split.y_train)
    baseline_proba = baseline.predict_proba(X_val)
    baseline_metrics = compute_all_metrics(
        split.y_val.values, baseline_proba, threshold=0.5,
        cost_fp=config.evaluation.cost_fp, cost_fn=config.evaluation.cost_fn,
    )
    exp_dir = EXPERIMENTS_DIR / "exp_001_logistic_baseline"
    save_metrics(baseline_metrics, exp_dir / "metrics.json",
                 extra_info={"model_type": "LogisticRegression"})
    baseline.save(exp_dir / "baseline_model.joblib")

    # ── 10. Modelo principal (LightGBM) ───────────────────────────────────
    print("\n[10/11] Training main model (LightGBM)...")
    lgbm = LightGBMFraudModel(
        n_estimators=config.model.n_estimators,
        learning_rate=config.model.learning_rate,
        num_leaves=config.model.num_leaves,
        min_child_samples=config.model.min_child_samples,
        colsample_bytree=config.model.colsample_bytree,
        early_stopping_rounds=config.model.early_stopping_rounds,
        scale_pos_weight=getattr(config.model, "scale_pos_weight", None),
        scale_pos_weight_mode=getattr(config.model, "scale_pos_weight_mode", "sqrt"),
        subsample=getattr(config.model, "subsample", 0.8),
        subsample_freq=getattr(config.model, "subsample_freq", 1),
        reg_alpha=getattr(config.model, "reg_alpha", 0.1),
        reg_lambda=getattr(config.model, "reg_lambda", 1.0),
        max_depth=getattr(config.model, "max_depth", -1),
        random_state=config.seed,
    )
    lgbm.fit(X_train, split.y_train, X_val, split.y_val)
    print(f"  Best iteration: {lgbm.best_iteration}")
    lgbm.save(artifacts_dir / "fraud_model.joblib")

    # ── 11. Threshold tuning ──────────────────────────────────────────────
    print("\n[11/11] Threshold tuning on Validation set...")
    lgbm_proba_val = lgbm.predict_proba(X_val)
    best_threshold, best_metrics = find_optimal_threshold(
        split.y_val.values, lgbm_proba_val,
        cost_fp=config.evaluation.cost_fp, cost_fn=config.evaluation.cost_fn,
    )

    print(f"  Optimal threshold: {best_threshold:.4f}")

    # Guardar métricas y threshold
    exp_dir_lgbm = EXPERIMENTS_DIR / "exp_002_lgbm_main"
    save_metrics(best_metrics, exp_dir_lgbm / "metrics.json",
                 extra_info={"model_type": "LightGBM", "best_threshold": best_threshold})

    thresholds_data = {
        "version": version,
        "critical": round(best_threshold, 4),
        "high": round(best_threshold * 0.75, 4),
        "medium": round(best_threshold * 0.47, 4),
        "last_tuned": pd.Timestamp.now(tz="UTC").isoformat(),
        "validation_pr_auc": round(best_metrics["pr_auc"], 4),
        "notes": "Tuned by train.py using cost-based optimization."
    }
    with open(CONFIGS_DIR / "thresholds.json", "w") as f:
        json.dump(thresholds_data, f, indent=2)
    with open(artifacts_dir / "thresholds.json", "w") as f:
        json.dump(thresholds_data, f, indent=2)
    print(f"  Thresholds saved to configs/thresholds.json and artifacts/{version}/")

    # ── 10. Anomaly Detection (Isolation Forest) ──────────────────────────
    print("\n[10/10] Training anomaly detector (Isolation Forest)...")
    X_legit = X_train[split.y_train == 0]
    anomaly = FraudAnomalyDetector(
        contamination=config.anomaly.contamination,
        n_estimators=config.anomaly.n_estimators,
        random_state=config.seed,
    )
    anomaly.fit(X_legit)
    anomaly.save(artifacts_dir / "anomaly_model.joblib")
    print(f"  Trained on {len(X_legit):,} legitimate transactions.")

    # ── Guardar behavioral profiles ──────────────────────────────────────
    profiler.save(artifacts_dir / "behavior_profiles.pkl")
    print(f"\n  Behavioral profiles saved ({profiler.user_count} users).")

    # ── Guardar métricas finales del modelo ──────────────────────────────
    with open(artifacts_dir / "metrics.json", "w") as f:
        json.dump(best_metrics, f, indent=2)

    # ── Resumen final ────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("  TRAINING COMPLETE")
    print("=" * 60)
    print(f"  Model version:       {version}")
    print(f"  Artifacts dir:       {artifacts_dir}")
    print(f"  Optimal threshold:   {best_threshold:.4f}")
    print(f"  PR-AUC (validation): {best_metrics['pr_auc']:.4f}")
    print(f"  ROC-AUC (validation):{best_metrics['roc_auc']:.4f}")
    print(f"  F1 (validation):     {best_metrics['f1']:.4f}")
    print(f"  Recall (validation): {best_metrics['recall']:.4f}")
    print(f"  Total cost (val):    ${best_metrics['total_cost']:,.2f}")
    print()
    print(f"  Baseline PR-AUC:     {baseline_metrics['pr_auc']:.4f}")
    print(f"  LightGBM PR-AUC:     {best_metrics['pr_auc']:.4f}")
    improvement = (best_metrics["pr_auc"] - baseline_metrics["pr_auc"]) / max(baseline_metrics["pr_auc"], 1e-6) * 100
    print(f"  Improvement:         +{improvement:.1f}%")
    print("=" * 60)


if __name__ == "__main__":
    main()
