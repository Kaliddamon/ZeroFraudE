"""
tests/integration/test_pipeline_inference_parity.py
===================================================
Pruebas de paridad y consistencia del pipeline de inferencia desplegable.

Verifica:
1. Correspondencia canónica de las 25 características entre entrenamiento e inferencia.
2. Determinismo e invariancia de predicción para transacciones idénticas.
3. Comportamiento en cold start sin excepciones ni valores NaN/Inf.
4. Mapeo estricto y determinista de umbrales operativos (thresholds.json v3.1.1).
5. Generación consistente de explicaciones en lenguaje natural (XAI).
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from src.config import ARTIFACTS_DIR, ROOT
from src.features.feature_pipeline import MODEL_FEATURES, build_feature_vector_inference
from src.inference.service import FraudDetectionService
from src.validation.schemas import TransactionInput


@pytest.fixture(scope="module")
def artifacts_version():
    return "3.0.0"


@pytest.fixture(scope="module")
def service(artifacts_version):
    """Inicializa el servicio de inferencia una sola vez para la suite."""
    return FraudDetectionService.load(version=artifacts_version)


@pytest.fixture(scope="module")
def thresholds_data(artifacts_version):
    """Carga los umbrales operativos vigentes."""
    path = ARTIFACTS_DIR / artifacts_version / "thresholds.json"
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


class TestFeatureContractParity:
    """Verifica que el vector de entrada a los modelos respeta el contrato exacto."""

    def test_feature_vector_dimensions_and_order(self, artifacts_version):
        """El vector generado para inferencia debe tener exactamente las 25 características de feature_config.json en el orden canónico."""
        config_path = ARTIFACTS_DIR / artifacts_version / "feature_config.json"
        with open(config_path, "r", encoding="utf-8") as f:
            expected_features = json.load(f)

        assert MODEL_FEATURES == expected_features, (
            "Discrepancia entre MODEL_FEATURES en código y feature_config.json en disco"
        )
        assert len(MODEL_FEATURES) == 25

        tx_sample = {
            "amount": 150.0,
            "timestamp": "2023-11-15T10:30:00Z",
            "country": "US",
            "device_id": "DEV-001",
            "merchant_id": "MERCH-001",
        }
        behavioral_sample = {f: 0.0 for f in MODEL_FEATURES}
        velocity_sample = {f: 0.0 for f in MODEL_FEATURES}
        encoding_sample = {"country_encoded": 0.0, "merchant_target_enc": 0.0, "device_target_enc": 0.0}

        vector = build_feature_vector_inference(
            transaction=tx_sample,
            behavioral_features=behavioral_sample,
            velocity_features=velocity_sample,
            encoding_features=encoding_sample,
        )

        assert list(vector.columns) == MODEL_FEATURES
        assert vector.shape == (1, 25)
        assert not vector.isna().any().any(), "El vector de features contiene valores NaN"
        assert not np.isinf(vector.values).any(), "El vector de features contiene valores infinitos"


class TestInferenceDeterminism:
    """Verifica que el modelo y el preprocesamiento son 100% deterministas."""

    def test_identical_transactions_produce_identical_scores(self, service):
        """Dos transacciones idénticas evaluadas consecutivamente deben generar scores equivalentes."""
        tx1 = TransactionInput(
            transaction_id="parity-det-001",
            user_id="U02797",
            amount=15.00,
            timestamp="2023-12-27T14:00:00Z",
            country="GB",
            device_id="D06611",
            merchant_id="M0129",
        )
        tx2 = TransactionInput(
            transaction_id="parity-det-002",
            user_id="U02797",
            amount=15.00,
            timestamp="2023-12-27T14:00:00Z",
            country="GB",
            device_id="D06611",
            merchant_id="M0129",
        )

        res1 = service.predict(tx1)
        res2 = service.predict(tx2)

        assert abs(res1.fraud_probability - res2.fraud_probability) < 1e-4
        assert abs(res1.anomaly_score - res2.anomaly_score) < 1e-4
        assert res1.risk_level == res2.risk_level
        assert res1.anomaly_alert == res2.anomaly_alert


class TestOperationalThresholdsCompliance:
    """Verifica que las decisiones operativas respetan thresholds.json v3.1.1."""

    def test_risk_level_mapping_against_thresholds(self, service, thresholds_data):
        """Comprueba que cada score se mapea rigurosamente a la banda de severidad correspondiente."""
        med_th = thresholds_data["medium"]      # 0.05
        high_th = thresholds_data["high"]       # 0.25
        crit_th = thresholds_data["critical"]   # 0.50

        # Transacción de muy bajo importe de usuario legítimo -> MEDIUM o LOW
        tx_low = TransactionInput(
            transaction_id="th-check-001",
            user_id="U02797",
            amount=0.50,
            timestamp="2023-12-27T14:32:00Z",
            country="GB",
            device_id="D06611",
            merchant_id="M0129",
        )
        res_low = service.predict(tx_low)

        if res_low.risk_score >= crit_th:
            assert res_low.risk_level == "CRITICAL"
        elif res_low.risk_score >= high_th:
            assert res_low.risk_level == "HIGH"
        elif res_low.risk_score >= med_th:
            assert res_low.risk_level == "MEDIUM"
        else:
            assert res_low.risk_level == "LOW"

        # Transacción fraudulenta extrema -> CRITICAL
        tx_high = TransactionInput(
            transaction_id="th-check-002",
            user_id="U02797",
            amount=999.00,
            timestamp="2023-12-27T03:15:00Z",
            country="NG",
            device_id="D_UNKNOWN_SUSPICIOUS",
            merchant_id="M_UNKNOWN_HIGH_RISK",
        )
        res_high = service.predict(tx_high)
        assert res_high.risk_score >= high_th
        assert res_high.risk_level in ("HIGH", "CRITICAL")
        assert len(res_high.explanations) > 0


class TestColdStartSafety:
    """Verifica la robustez y seguridad ante usuarios nuevos (Cold Start)."""

    def test_unseen_user_cold_start_handling(self, service):
        """Un usuario nuevo no debe generar errores, debe marcar is_cold_start=True y generar scores válidos en [0, 1]."""
        tx_cold = TransactionInput(
            transaction_id="cold-001",
            user_id="NEW_USER_NOT_IN_TRAINING_SET",
            amount=45.0,
            timestamp="2023-12-27T12:00:00Z",
            country="CO",
            device_id="DEV-COLD-1",
            merchant_id="M-COLD-1",
        )
        res = service.predict(tx_cold)

        assert res.is_cold_start is True
        assert 0.0 <= res.fraud_probability <= 1.0
        assert 0.0 <= res.anomaly_score <= 1.0
        assert 0.0 <= res.risk_score <= 1.0
        assert res.risk_level in ("LOW", "MEDIUM", "HIGH", "CRITICAL")
        assert res.behavioral_deviation == 0.0

