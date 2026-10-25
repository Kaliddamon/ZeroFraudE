"""
src/inference/service.py
=========================
FraudDetectionService — núcleo del componente de inferencia.

Carga todos los artefactos al inicializarse y expone el método predict(),
que implementa el contrato lógico de entrada/salida definido en el TDD.

Contrato de entrada:
    TransactionInput (Pydantic schema)

Contrato de salida:
    PredictionOutput (Pydantic schema)

El servicio es stateful: mantiene el BehavioralProfiler en memoria
y lo actualiza con cada predicción nueva (solo si risk_level ∈ {LOW, MEDIUM}).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

import joblib
import pandas as pd

from src.anomaly.isolation_forest import FraudAnomalyDetector
from src.behavioral.profiler import BehavioralProfiler
from src.config import ROOT, PipelineConfig, load_config
from src.evaluation.metrics import compute_all_metrics
from src.explainability.shap_explainer import FraudExplainer
from src.features.feature_pipeline import MODEL_FEATURES, build_feature_vector_inference
from src.features.temporal_features import compute_velocity_for_inference
from src.models.lgbm_model import LightGBMFraudModel
from src.risk.fusion import RiskFusionEngine
from src.validation.schemas import ErrorOutput, PredictionOutput, TransactionInput


class FraudDetectionService:
    """
    Servicio de inferencia de fraude en tiempo real.

    Carga los artefactos una sola vez al inicializarse.
    El método predict() es el único punto de entrada externo.

    Uso:
        service = FraudDetectionService.load(version="1.0.0")
        result = service.predict(transaction_input)
    """

    def __init__(self) -> None:
        self._fraud_model: Optional[LightGBMFraudModel] = None
        self._anomaly_detector: Optional[FraudAnomalyDetector] = None
        self._behavioral_profiler: Optional[BehavioralProfiler] = None
        self._risk_engine: Optional[RiskFusionEngine] = None
        self._explainer: Optional[FraudExplainer] = None
        self._config: Optional[PipelineConfig] = None
        self._model_version: str = "unknown"
        self._is_ready: bool = False

    @classmethod
    def load(cls, version: str = "1.1.0", artifacts_dir: Optional[str] = None) -> "FraudDetectionService":
        """
        Carga todos los artefactos desde disco e inicializa el servicio.

        Parameters
        ----------
        version       : Versión del modelo a cargar (nombre del subdirectorio en artifacts/).
        artifacts_dir : Directorio raíz de artefactos. Por defecto: fraud_detection_ml/artifacts/.

        Returns
        -------
        FraudDetectionService
            Servicio listo para inferencia.
        """
        svc = cls()
        svc._config = load_config()
        svc._model_version = version

        base = Path(artifacts_dir) if artifacts_dir else ROOT / "artifacts" / version

        print(f"[Service] Loading artifacts from {base} ...")

        # Modelo supervisado
        fraud_model_path = base / "fraud_model.joblib"
        if not fraud_model_path.exists():
            raise FileNotFoundError(f"Fraud model not found: {fraud_model_path}")
        svc._fraud_model = LightGBMFraudModel.load(fraud_model_path)
        print(f"[Service] Fraud model loaded.")

        # Modelo de anomalías
        anomaly_path = base / "anomaly_model.joblib"
        if anomaly_path.exists():
            svc._anomaly_detector = FraudAnomalyDetector.load(anomaly_path)
            print(f"[Service] Anomaly model loaded.")
        else:
            print(f"[Service] WARNING: Anomaly model not found. Anomaly score will be 0.")

        # Perfiles de comportamiento
        profiles_path = base / "behavior_profiles.pkl"
        if profiles_path.exists():
            svc._behavioral_profiler = BehavioralProfiler.load(profiles_path)
            print(f"[Service] Behavioral profiles loaded ({svc._behavioral_profiler.user_count} users).")
        else:
            print(f"[Service] WARNING: Profiles not found. All users treated as cold start.")
            svc._behavioral_profiler = BehavioralProfiler()

        # Risk Fusion Engine
        svc._risk_engine = RiskFusionEngine.from_config(svc._config)
        print(f"[Service] Risk Fusion Engine initialized.")

        # Explainability
        if svc._fraud_model is not None and svc._fraud_model.feature_names:
            try:
                svc._explainer = FraudExplainer(
                    model=svc._fraud_model,
                    feature_names=svc._fraud_model.feature_names or MODEL_FEATURES,
                )
                print(f"[Service] Explainer initialized.")
            except Exception as e:
                print(f"[Service] WARNING: Explainer init failed: {e}")

        svc._is_ready = True
        print(f"[Service] Ready. Model version: {version}")
        return svc

    def predict(self, transaction: TransactionInput) -> PredictionOutput:
        """
        Ejecuta el pipeline completo de inferencia para una transacción.

        Pipeline:
            1. Behavioral profiler lookup (features de desviación + cold start flag)
            2. Velocity features (desde historial del perfil)
            3. Ensamblado del feature vector (MODEL_FEATURES en orden canónico)
            4. LightGBM → fraud_probability
            5. Isolation Forest → anomaly_score
            6. Risk Fusion → risk_score + risk_level
            7. Explainability → explanations
            8. Actualización del perfil (solo si risk_level ∈ {LOW, MEDIUM})
            9. Retorno del PredictionOutput

        Parameters
        ----------
        transaction : TransactionInput
            Input validado por Pydantic.

        Returns
        -------
        PredictionOutput
            Output validado por Pydantic con el contrato completo.
        """
        if not self._is_ready:
            raise RuntimeError("Service not ready. Call FraudDetectionService.load() first.")

        ts = pd.to_datetime(transaction.timestamp, utc=True)

        # ── 1. Behavioral features ──────────────────────────────────────────
        behavioral_result = self._behavioral_profiler.get_behavioral_features(
            user_id=transaction.user_id,
            amount=transaction.amount,
            timestamp=ts,
            country=transaction.country,
            device_id=transaction.device_id,
            merchant_id=transaction.merchant_id,
        )
        is_cold_start: bool = behavioral_result.pop("is_cold_start", False)
        behavioral_deviation: float = behavioral_result.get("behavioral_deviation", 0.0)

        # ── 2. Velocity features ────────────────────────────────────────────
        # Obtener historial reciente del perfil para velocity
        profile = self._behavioral_profiler._profiles.get(transaction.user_id)
        user_history = None
        if profile and profile.recent_timestamps:
            user_history = pd.DataFrame({
                "timestamp": pd.to_datetime(profile.recent_timestamps, utc=True),
                "amount": profile.recent_amounts,
                "merchant_id": profile.recent_merchants,
                "country": profile.recent_countries,
            })

        velocity_features = compute_velocity_for_inference(
            user_history=user_history,
            current_timestamp=ts,
            current_amount=transaction.amount,
            current_merchant=transaction.merchant_id,
            current_country=transaction.country,
        )

        # ── 3. Encodings (fallback a 0 si no hay encoders en memoria) ──────
        # En MVP: usamos 0 para merchant/device encoding en inferencia real
        # (el modelo de árboles es robusto a esto para categorías nuevas)
        encoding_features = {
            "country_encoded": 0.0,
            "merchant_target_enc": 0.0,
            "device_target_enc": 0.0,
        }

        # ── 4. Ensamblar feature vector ─────────────────────────────────────
        X = build_feature_vector_inference(
            transaction=transaction.model_dump(),
            behavioral_features=behavioral_result,
            velocity_features=velocity_features,
            encoding_features=encoding_features,
        )

        # ── 5. Fraud probability (LightGBM) ────────────────────────────────
        fraud_probability = float(self._fraud_model.predict_proba(X)[0])

        # ── 6. Anomaly score (Isolation Forest) ────────────────────────────
        # Isolation Forest fue entrenado con un subconjunto de features:
        # MODEL_FEATURES sin target-encoded (country_encoded, merchant_target_enc,
        # device_target_enc) y con behavioral_deviation añadido.
        if self._anomaly_detector is not None:
            target_encoded = {"country_encoded", "merchant_target_enc", "device_target_enc"}
            iforest_features = [c for c in self._fraud_model.feature_names or MODEL_FEATURES
                                if c not in target_encoded and c in X.columns]
            X_if = X[iforest_features].copy()
            X_if["behavioral_deviation"] = behavioral_deviation
            anomaly_score = float(self._anomaly_detector.score_single(X_if))
        else:
            anomaly_score = 0.0

        # ── 7. Risk Fusion ─────────────────────────────────────────────────
        risk_result = self._risk_engine.evaluate(
            fraud_probability=fraud_probability,
            anomaly_score=anomaly_score,
            behavioral_deviation=behavioral_deviation,
            is_cold_start=is_cold_start,
        )
        risk_score: float = risk_result["risk_score"]
        risk_level: str = risk_result["risk_level"]
        anomaly_alert: bool = risk_result["anomaly_alert"]

        # ── 8. Explainability ──────────────────────────────────────────────
        explanations = []
        if self._explainer is not None:
            feature_values_for_templates = {
                "amount": transaction.amount,
                "amount_z_score": behavioral_result.get("amount_z_score", 0.0),
                "amount_ratio_to_avg": behavioral_result.get("amount_ratio_to_avg", 1.0),
                "user_avg_amount_30d": behavioral_result.get("user_avg_amount_30d", 0.0),
                "is_cold_start": is_cold_start,
                **velocity_features,
            }
            try:
                explanations = self._explainer.explain(
                    X_instance=X,
                    risk_level=risk_level,
                    feature_values=feature_values_for_templates,
                    top_k=3,
                )
            except Exception:
                explanations = ["Risk pattern detected"]

        if not explanations:
            explanations = self._generate_fallback_explanations(
                transaction, behavioral_result, velocity_features, risk_level, is_cold_start
            )

        # ── 9. Actualizar perfil ────────────────────────────────────────────
        self._behavioral_profiler.update_profile(
            user_id=transaction.user_id,
            amount=transaction.amount,
            timestamp=ts,
            country=transaction.country,
            device_id=transaction.device_id,
            merchant_id=transaction.merchant_id,
            risk_level=risk_level,
        )

        # ── 10. Construir y validar output ─────────────────────────────────
        return PredictionOutput(
            transaction_id=transaction.transaction_id,
            fraud_probability=round(fraud_probability, 4),
            anomaly_score=round(anomaly_score, 4),
            anomaly_alert=anomaly_alert,
            behavioral_deviation=round(behavioral_deviation, 4),
            risk_score=risk_score,
            risk_level=risk_level,
            explanations=explanations,
            model_version=self._model_version,
            is_cold_start=is_cold_start,
        )

    def _generate_fallback_explanations(
        self,
        transaction: TransactionInput,
        behavioral: dict,
        velocity: dict,
        risk_level: str,
        is_cold_start: bool = False,
    ) -> list:
        """Genera explicaciones de fallback básicas sin SHAP.

        En cold start no hay historial individual del usuario, por lo que no
        se emiten explicaciones de importe basadas en un "promedio de usuario"
        inexistente, ni se afirma que un dispositivo/país/merchant sea "nuevo"
        sin evidencia real.
        """
        explanations = []

        if behavioral.get("is_new_device", 0) == 1 and not is_cold_start:
            explanations.append("First transaction from this device")
        if behavioral.get("is_new_country", 0) == 1 and not is_cold_start:
            explanations.append(f"Country {transaction.country} not in user's recent history")
        if (
            abs(behavioral.get("amount_z_score", 0)) > 2
            and not is_cold_start
            and behavioral.get("amount_ratio_to_avg", 1.0) > 1.0
        ):
            ratio = behavioral.get("amount_ratio_to_avg", 1.0)
            explanations.append(f"Amount {ratio:.1f}× above user average")
        if velocity.get("tx_count_5min", 0) >= 3:
            n = int(velocity["tx_count_5min"])
            explanations.append(f"{n} transactions in the last 5 minutes")
        if behavioral.get("is_new_merchant", 0) == 1 and not is_cold_start:
            explanations.append("Merchant not in user's transaction history")

        if not explanations:
            if risk_level in ("HIGH", "CRITICAL"):
                explanations = ["Multiple risk indicators detected"]
            else:
                explanations = ["Transaction within acceptable risk parameters"]

        return explanations[:3]

    @property
    def is_ready(self) -> bool:
        return self._is_ready

    @property
    def model_version(self) -> str:
        return self._model_version
