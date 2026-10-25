"""
train.py
========
Script principal de entrenamiento del pipeline de fraude.

Ejecuta el pipeline completo:
    1. Carga de datos
    2. División temporal (antes de cualquier profiling)
    3. Behavioral profiling (construye perfiles solo en training set)
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
import bisect
import json
import sys
from datetime import timedelta
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

    # ── 2. División temporal PRIMERO (antes de cualquier profiling) ─────
    print("\n[2/11] Temporal train/val/test split...")
    # Incluir timestamp en feature_cols para poder usarlo en feature engineering
    # y behavioral profiling antes de eliminarlo.
    all_feature_cols = [c for c in df.columns if c not in {"is_fraud", "transaction_id"}]
    split = temporal_train_val_test_split(
        df,
        target_col="is_fraud",
        train_end_date=config.data.train_end_date,
        val_end_date=config.data.val_end_date,
        feature_cols=all_feature_cols,
    )
    print(split)

    # ── 3. Feature engineering: Transaccionales (sobre training set) ─────
    print("\n[3/11] Computing transaction features (training set)...")
    X_train = add_transaction_features(split.X_train.copy())
    X_val = add_transaction_features(split.X_val.copy())
    X_test = add_transaction_features(split.X_test.copy())

    # ── 4. Velocity features (sobre training set, orden cronológico) ─────
    print("\n[4/11] Computing velocity features (training set)...")
    X_train = add_velocity_features_batch(X_train)

    # Para val/test: calcular velocity usando training data como historial
    print("\n[5/11] Computing velocity features for val/test using training history...")
    X_val = _compute_velocity_with_history(X_train, X_val)
    X_test = _compute_velocity_with_history(X_train, X_test)

    # ── 6. Behavioral Profiling (SOLO en datos de entrenamiento) ──────────
    print("\n[6/11] Building behavioral profiles (training data only)...")
    profiler = BehavioralProfiler()
    X_train = profiler.fit_transform(
        X_train, window_days=config.features.behavioral_window_days
    )
    print(f"  Profiles built for {profiler.user_count:,} users (training data only)")

    # Para val/test: calcular behavioral features usando el profiler entrenado
    print("\n[7/11] Computing behavioral features for val/test using trained profiler...")
    X_val = _compute_behavioral_for_val_test(profiler, X_val)
    X_test = _compute_behavioral_for_val_test(profiler, X_test)

    # ── 8. Extraer behavioral_deviation ANTES de seleccionar solo features del modelo ──
    # behavioral_deviation no está en MODEL_FEATURES, así que guardarlo antes de filtrar columnas
    behavioral_deviation_train = X_train["behavioral_deviation"].values
    behavioral_deviation_val = X_val["behavioral_deviation"].values

    # ── 9. Eliminar columna timestamp (ya no se necesita) ─────────────────
    X_train = X_train.drop(columns=["timestamp"])
    X_val = X_val.drop(columns=["timestamp"])
    X_test = X_test.drop(columns=["timestamp"])

    # ── 10. Imputation ─────────────────────────────────────────────────────
    print("\n[8/11] Imputing missing values...")
    imputer = FraudImputerTransformer()
    X_train = imputer.fit_transform(X_train)
    X_val = imputer.transform(X_val)
    X_test = imputer.transform(X_test)
    joblib.dump(imputer, artifacts_dir / "imputer.joblib", compress=3)
    print(f"  Imputer fitted on training set and saved.")

    # ── 10. Encoding ─────────────────────────────────────────────────────
    print("\n[9/11] Encoding categorical features...")
    encoder = FraudEncoderTransformer(smoothing=10.0)
    X_train = encoder.fit_transform(X_train, split.y_train)
    X_val = encoder.transform(X_val)
    X_test = encoder.transform(X_test)
    joblib.dump(encoder, artifacts_dir / "encoder.joblib", compress=3)
    print(f"  Encoder fitted on training set and saved.")

    # ── 11. Feature matrix (selección de columnas del modelo) ─────────────
    print("\n[10/11] Building feature matrix...")
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

    # ── 12. Baseline (Logistic Regression) ─────────────────────────────────
    print("\n[11/16] Training baseline (Logistic Regression)...")
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

    # ── 13. Modelo principal (LightGBM) ───────────────────────────────────
    print("\n[12/16] Training main model (LightGBM)...")
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

    # ── 14. Anomaly Detection (Isolation Forest) ──────────────────────────
    print("\n[13/16] Training anomaly detector (Isolation Forest)...")
    # Features para Isolation Forest:
    # - Excluir target-encoded porque derivan de etiquetas de fraude (fuga en no supervisado)
    # - Incluir behavioral_deviation (valor predictivo incremental para fraudes de bajo fp)
    target_encoded = {"country_encoded", "merchant_target_enc", "device_target_enc"}
    iforest_features = [c for c in MODEL_FEATURES if c not in target_encoded]
    if "behavioral_deviation" not in iforest_features:
        iforest_features.append("behavioral_deviation")

    X_train_for_iforest = X_train.copy()
    X_train_for_iforest["behavioral_deviation"] = behavioral_deviation_train
    X_legit = X_train_for_iforest[split.y_train == 0][iforest_features]
    anomaly = FraudAnomalyDetector(
        contamination=config.anomaly.contamination,
        n_estimators=config.anomaly.n_estimators,
        random_state=config.seed,
    )
    anomaly.fit(X_legit)
    anomaly.save(artifacts_dir / "anomaly_model.joblib")
    print(f"  Trained on {len(X_legit):,} legitimate transactions.")
    print(f"  IF features ({len(iforest_features)}): {iforest_features}")

    # ── 15. Evaluacion en Validation set (sobre risk_score) ────────────────
    print("\n[14/16] Evaluating on Validation set (risk_score scale)...")

    # Calcular componentes para el set de validación
    lgbm_proba_val = lgbm.predict_proba(X_val)
    X_val_for_iforest = X_val.copy()
    X_val_for_iforest["behavioral_deviation"] = behavioral_deviation_val
    anomaly_scores_val = anomaly.score(X_val_for_iforest[iforest_features])

    # Combinar en risk_score usando RiskFusionEngine con los pesos
    # configurados en configs/risk_fusion.yaml (ahora 1.00/0.00/0.00:
    # risk_score = fraud_probability).
    risk_engine = RiskFusionEngine.from_config(config)
    risk_scores_val = []
    for i in range(len(X_val)):
        r = risk_engine.evaluate(
            fraud_probability=float(lgbm_proba_val[i]),
            anomaly_score=float(anomaly_scores_val[i]),
            behavioral_deviation=float(behavioral_deviation_val[i]),
            is_cold_start=False,  # Val set tiene usuarios con historial
        )
        risk_scores_val.append(r["risk_score"])
    risk_scores_val = np.array(risk_scores_val)

    # Evaluar en los umbrales operativos configurados en configs/thresholds.json.
    # No se sobrescriben los umbrales: se seleccionaron sobre Validacion con
    # criterio operativo (medium=0.05, high=0.25, critical=0.50) y se respetan.
    critical = config.thresholds.critical
    high = config.thresholds.high
    medium = config.thresholds.medium

    from src.evaluation.metrics import compute_all_metrics

    val_metrics = compute_all_metrics(
        split.y_val.values, risk_scores_val,
        threshold=critical,
        cost_fp=config.evaluation.cost_fp, cost_fn=config.evaluation.cost_fn,
    )

    print(f"  Umbrales operativos: medium={medium}, high={high}, critical={critical}")
    print(f"  PR-AUC (val): {val_metrics['pr_auc']:.4f}")
    print(f"  ROC-AUC (val): {val_metrics['roc_auc']:.4f}")
    print(f"  F1 (val): {val_metrics['f1']:.4f}")
    print(f"  Recall (val): {val_metrics['recall']:.4f}")
    print(f"  FPR (val): {val_metrics['false_positive_rate']:.4f}")
    print(f"  Coste total (val): ${val_metrics['total_cost']:,.2f}")
    print(f"  TP={val_metrics['true_positives']} FP={val_metrics['false_positives']} "
          f"FN={val_metrics['false_negatives']} TN={val_metrics['true_negatives']}")
    print(f"  % legítimos en CRITICAL: {100*np.mean(risk_scores_val[split.y_val.values==0] >= critical):.1f}%")
    print(f"  % fraudes en CRITICAL:   {100*np.mean(risk_scores_val[split.y_val.values==1] >= critical):.1f}%")

    # Guardar metricas de validacion (sin tocar thresholds.json)
    exp_dir_lgbm = EXPERIMENTS_DIR / "exp_002_lgbm_main"
    save_metrics(val_metrics, exp_dir_lgbm / "metrics.json",
                 extra_info={"model_type": "LightGBM", "threshold_scale": "risk_score",
                             "threshold_critical": critical, "threshold_high": high,
                             "threshold_medium": medium})

    # ── Guardar behavioral profiles (SOLO training data) ──────────────────
    profiler.save(artifacts_dir / "behavior_profiles.pkl")
    print(f"\n  Behavioral profiles saved ({profiler.user_count} users, training data only).")

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


def _compute_velocity_with_history(
    X_train: pd.DataFrame,
    X_target: pd.DataFrame,
) -> pd.DataFrame:
    """
    Calcula velocity features para X_target usando X_train como historial.

    Para cada fila de X_target, cuenta transacciones del mismo usuario en las
    ventanas de tiempo [t - W, t) usando SOLO filas de X_train como historial.
    Esto evita que transacciones de val/test contaminen el historial de otras
    transacciones de val/test.

    Parameters
    ----------
    X_train : pd.DataFrame
        Datos de entrenamiento (contiene columnas de timestamp, user_id, etc.)
    X_target : pd.DataFrame
        Filas de validación o prueba para las cuales calcular velocity.

    Returns
    -------
    pd.DataFrame
        X_target con columnas de velocity añadidas.
    """
    from src.features.temporal_features import compute_velocity_for_inference

    X_target = X_target.copy()

    # Preparar historial de entrenamiento por usuario
    train_by_user = {}
    for _, row in X_train.iterrows():
        uid = row["user_id"]
        if uid not in train_by_user:
            train_by_user[uid] = []
        train_by_user[uid].append(
            {
                "timestamp": row["timestamp"],
                "amount": row["amount"],
                "merchant_id": row["merchant_id"],
                "country": row["country"],
            }
        )

    # Ordenar historial de entrenamiento por timestamp
    for uid in train_by_user:
        train_by_user[uid].sort(key=lambda x: x["timestamp"])

    v_tx_count_5min = []
    v_tx_count_1h = []
    v_tx_count_24h = []
    v_amount_sum_1h = []
    v_unique_merchants_24h = []
    v_unique_countries_24h = []

    for _, row in X_target.iterrows():
        uid = row["user_id"]
        t_current = row["timestamp"]
        history = train_by_user.get(uid, [])

        # Filtrar solo transacciones anteriores al timestamp actual
        past = [
            h for h in history
            if pd.to_datetime(h["timestamp"], utc=True) < t_current
        ]

        t_5min = t_current - timedelta(minutes=5)
        t_1h = t_current - timedelta(hours=1)
        t_24h = t_current - timedelta(hours=24)

        count_5min = sum(
            1 for h in past
            if pd.to_datetime(h["timestamp"], utc=True) >= t_5min
        )
        count_1h = sum(
            1 for h in past
            if pd.to_datetime(h["timestamp"], utc=True) >= t_1h
        )
        count_24h = sum(
            1 for h in past
            if pd.to_datetime(h["timestamp"], utc=True) >= t_24h
        )
        mask_1h = [
            h for h in past
            if pd.to_datetime(h["timestamp"], utc=True) >= t_1h
        ]
        sum_amount_1h = sum(h["amount"] for h in mask_1h)
        mask_24h = [
            h for h in past
            if pd.to_datetime(h["timestamp"], utc=True) >= t_24h
        ]
        unique_merch_24h = len({h["merchant_id"] for h in mask_24h})
        unique_ctry_24h = len({h["country"] for h in mask_24h})

        v_tx_count_5min.append(count_5min)
        v_tx_count_1h.append(count_1h)
        v_tx_count_24h.append(count_24h)
        v_amount_sum_1h.append(sum_amount_1h)
        v_unique_merchants_24h.append(unique_merch_24h)
        v_unique_countries_24h.append(unique_ctry_24h)

    X_target["tx_count_5min"] = v_tx_count_5min
    X_target["tx_count_1h"] = v_tx_count_1h
    X_target["tx_count_24h"] = v_tx_count_24h
    X_target["amount_sum_1h"] = v_amount_sum_1h
    X_target["unique_merchants_24h"] = v_unique_merchants_24h
    X_target["unique_countries_24h"] = v_unique_countries_24h

    return X_target


def _compute_behavioral_for_val_test(
    profiler: "BehavioralProfiler",
    X_target: pd.DataFrame,
) -> pd.DataFrame:
    """
    Calcula behavioral features para filas de val/test usando el profiler
    entrenado exclusivamente con datos de entrenamiento.

    No actualiza el profiler (no hay contaminación por datos de val/test).
    Usuarios sin historial en training se tratan como cold start.

    Parameters
    ----------
    profiler : BehavioralProfiler
        Profiler entrenado solo con datos de entrenamiento.
    X_target : pd.DataFrame
        Filas de validación o prueba.

    Returns
    -------
    pd.DataFrame
        X_target con columnas de behavioral features añadidas/reemplazadas.
    """
    behavioral_rows = []
    for _, row in X_target.iterrows():
        features = profiler.get_behavioral_features(
            user_id=row["user_id"],
            amount=row["amount"],
            timestamp=row["timestamp"],
            country=row["country"],
            device_id=row["device_id"],
            merchant_id=row["merchant_id"],
        )
        behavioral_rows.append(features)

    behavioral_df = pd.DataFrame(behavioral_rows, index=X_target.index)

    # Reemplazar columnas de behavioral en X_target
    behavioral_cols = [
        "user_avg_amount_30d", "user_std_amount_30d",
        "amount_z_score", "amount_ratio_to_avg",
        "is_new_device", "is_new_country", "is_new_merchant",
        "user_tx_count_30d", "days_since_last_tx",
        "behavioral_deviation",
    ]
    for col in behavioral_cols:
        if col in behavioral_df.columns:
            X_target[col] = behavioral_df[col].values

    return X_target


if __name__ == "__main__":
    main()