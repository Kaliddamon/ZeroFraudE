"""
tests/unit/test_risk_fusion.py
===============================
Tests unitarios para el Risk Fusion Engine.
"""

import json
from pathlib import Path

import pytest
from src.config import load_config
from src.risk.fusion import RiskFusionEngine

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
THRESHOLDS_PATH = PROJECT_ROOT / "configs" / "thresholds.json"


class TestRiskFusionEngine:

    @pytest.fixture
    def engine(self):
        return RiskFusionEngine()

    def test_weights_sum_to_one(self, engine):
        assert engine.w_fraud + engine.w_anomaly + engine.w_behavioral == pytest.approx(1.0)

    def test_cold_start_weights_sum_to_one(self, engine):
        assert engine.w_fraud_cold + engine.w_anomaly_cold + engine.w_behavioral_cold == pytest.approx(1.0)

    def test_invalid_weights_raise(self):
        with pytest.raises(ValueError):
            RiskFusionEngine(w_fraud=0.5, w_anomaly=0.3, w_behavioral=0.1)

    def test_risk_score_in_range(self, engine):
        score = engine.compute_risk_score(0.8, 0.7, 0.9)
        assert 0.0 <= score <= 1.0

    def test_all_zeros_produces_zero(self, engine):
        score = engine.compute_risk_score(0.0, 0.0, 0.0)
        assert score == 0.0

    def test_all_ones_produces_one(self, engine):
        score = engine.compute_risk_score(1.0, 1.0, 1.0)
        assert score == pytest.approx(1.0)

    def test_fraud_has_most_weight(self, engine):
        # fraud=1 with anomaly=0, behavioral=0
        score_fraud = engine.compute_risk_score(1.0, 0.0, 0.0)
        # anomaly=1 with fraud=0, behavioral=0
        score_anomaly = engine.compute_risk_score(0.0, 1.0, 0.0)
        # fraud_probability has more weight
        assert score_fraud > score_anomaly

    def test_cold_start_ignores_behavioral(self, engine):
        score = engine.compute_risk_score(0.5, 0.5, 1.0, is_cold_start=True)
        score_no_behavioral = engine.compute_risk_score(0.5, 0.5, 0.0, is_cold_start=True)
        assert score == score_no_behavioral  # behavioral weight = 0 in cold start

    def test_critical_classification(self, engine):
        assert engine.classify_risk(0.90) == "CRITICAL"

    def test_high_classification(self, engine):
        assert engine.classify_risk(0.70) == "HIGH"

    def test_medium_classification(self, engine):
        assert engine.classify_risk(0.50) == "MEDIUM"

    def test_low_classification(self, engine):
        assert engine.classify_risk(0.20) == "LOW"

    def test_boundary_critical(self, engine):
        assert engine.classify_risk(0.85) == "CRITICAL"

    def test_boundary_high(self, engine):
        assert engine.classify_risk(0.65) == "HIGH"

    def test_boundary_medium(self, engine):
        assert engine.classify_risk(0.40) == "MEDIUM"

    def test_evaluate_returns_both(self, engine):
        result = engine.evaluate(0.9, 0.8, 0.7)
        assert "risk_score" in result
        assert "risk_level" in result
        assert result["risk_level"] in ("LOW", "MEDIUM", "HIGH", "CRITICAL")

    def test_input_clipped_to_range(self, engine):
        # Values out of [0, 1] should be clipped, not crash
        score = engine.compute_risk_score(1.5, -0.5, 2.0)
        assert 0.0 <= score <= 1.0


class TestThresholdConfiguration:
    """
    Pruebas del camino de configuración real de umbrales.

    Valida que RiskFusionEngine.from_config carga los umbrales desde
    configs/thresholds.json y no utiliza los valores por defecto del
    constructor. Estos tests verifican el comportamiento implementado;
    no demuestran por sí solos que los umbrales sean metodológicamente
    óptimos.
    """

    @pytest.fixture
    def production_config(self):
        return load_config()

    @pytest.fixture
    def production_engine(self, production_config):
        return RiskFusionEngine.from_config(production_config)

    def test_thresholds_json_exists_and_is_read(self):
        assert THRESHOLDS_PATH.exists(), f"Falta {THRESHOLDS_PATH}"
        with open(THRESHOLDS_PATH, "r", encoding="utf-8") as f:
            raw = json.load(f)
        assert "critical" in raw
        assert "high" in raw
        assert "medium" in raw

    def test_load_config_reads_production_thresholds(self, production_config):
        assert production_config.thresholds.critical == 0.0812
        assert production_config.thresholds.high == 0.0609
        assert production_config.thresholds.medium == 0.0381

    def test_from_config_uses_production_values_not_defaults(self, production_engine):
        """from_config debe cargar valores de producción, no los defaults del constructor."""
        assert production_engine.threshold_critical == 0.0812
        assert production_engine.threshold_high == 0.0609
        assert production_engine.threshold_medium == 0.0381
        # Los defaults del constructor son 0.85 / 0.65 / 0.40, distintos a producción
        default_engine = RiskFusionEngine()
        assert default_engine.threshold_critical == 0.85
        assert default_engine.threshold_high == 0.65
        assert default_engine.threshold_medium == 0.40
        assert production_engine.threshold_critical != default_engine.threshold_critical

    def test_production_threshold_matches_json_file(self, production_engine):
        with open(THRESHOLDS_PATH, "r", encoding="utf-8") as f:
            raw = json.load(f)
        assert production_engine.threshold_critical == raw["critical"]
        assert production_engine.threshold_high == raw["high"]
        assert production_engine.threshold_medium == raw["medium"]

    def test_classify_risk_production_critical_boundary(self, production_engine):
        # Umbral inclusivo: exactamente critical → CRITICAL
        assert production_engine.classify_risk(0.0812) == "CRITICAL"

    def test_classify_risk_production_high_boundary(self, production_engine):
        assert production_engine.classify_risk(0.0609) == "HIGH"

    def test_classify_risk_production_medium_boundary(self, production_engine):
        assert production_engine.classify_risk(0.0381) == "MEDIUM"

    def test_classify_risk_production_just_below_medium(self, production_engine):
        assert production_engine.classify_risk(0.0380) == "LOW"

    def test_classify_risk_production_just_below_critical(self, production_engine):
        assert production_engine.classify_risk(0.0811) == "HIGH"

    def test_classify_risk_production_just_below_high(self, production_engine):
        assert production_engine.classify_risk(0.0608) == "MEDIUM"

    def test_classify_risk_production_score_0_20_is_critical(self, production_engine):
        # Con production config, 0.20 >= 0.0812 → CRITICAL
        assert production_engine.classify_risk(0.20) == "CRITICAL"

    def test_defaults_versus_production_are_documented(self):
        """
        Documenta la diferencia entre defaults del constructor y valores de producción.

        - Defaults del constructor: critical=0.85, high=0.65, medium=0.40
        - Valores de producción (configs/thresholds.json): critical=0.0812,
          high=0.0609, medium=0.0381
        - train.py optimiza critical sobre fraud_probability (LightGBM) en validación.
        - classify_risk aplica el umbral sobre risk_score (fusión de señales).
        """
        defaults = RiskFusionEngine()
        assert defaults.threshold_critical == 0.85
        assert defaults.threshold_high == 0.65
        assert defaults.threshold_medium == 0.40

        config = load_config()
        assert config.thresholds.critical == 0.0812
        assert config.thresholds.high == 0.0609
        assert config.thresholds.medium == 0.0381
