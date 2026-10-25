"""
tests/unit/test_risk_fusion.py
===============================

Tests unitarios para el Risk Fusion Engine.

Los umbrales de produccion (configs/thresholds.json) se seleccionaron
exclusivamente sobre el Validation Set con criterio operativo:
    medium = 0.05  (por encima del p95 de legítimos = 0.0460)
    high   = 0.25  (entre p95 de legítimos y p25 de fraudes = 0.3114)
    critical = 0.50 (probabilidad >= 50% de fraude)

Los pesos de produccion (configs/risk_fusion.yaml) son:
    w_fraud_probability = 1.00
    w_anomaly_score     = 0.00
    w_behavioral_deviation = 0.00

Justificacion (basada en evidencia sobre Validacion):
- fraud_probiculty esta bien calibrado (Brier=0.0180) y tiene excelente
  discriminacion (PR-AUC=0.8112, ROC-AUC=0.9565).
- behavioral_deviation es inútil solo (ROC-AUC=0.5000, FNR=1.0) -> peso 0.00.
- anomaly_score esta correlacionada con fraud_probability (0.458) y aporta
  poco valor incremental -> peso 0.00.
- Se prefiere una formula simple (fraud_probability solo) sobre complejidad
  innecesaria.

Estos tests verifican el comportamiento implementado; no demuestran por sí
solos que los umbrales sean metodologicamente óptimos.
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
        assert "anomaly_alert" in result
        assert result["risk_level"] in ("LOW", "MEDIUM", "HIGH", "CRITICAL")
        assert isinstance(result["anomaly_alert"], bool)

    def test_compute_anomaly_alert_default_threshold(self, engine):
        # Default anomaly_alert_threshold = 0.70
        assert engine.compute_anomaly_alert(0.80) is True
        assert engine.compute_anomaly_alert(0.70) is True
        assert engine.compute_anomaly_alert(0.69) is False
        assert engine.compute_anomaly_alert(0.0) is False

    def test_anomaly_alert_independent_of_risk_level(self, engine):
        # anomaly_alert es independiente de risk_level:
        # fraud_probability bajo pero anomaly_score alto => alerta sin riesgo crítico
        result = engine.evaluate(0.10, 0.90, 0.0)
        assert result["anomaly_alert"] is True
        assert result["risk_level"] != "CRITICAL"  # risk_score = 0.10 < 0.85 (default)

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
        assert production_config.thresholds.critical == 0.50
        assert production_config.thresholds.high == 0.25
        assert production_config.thresholds.medium == 0.05

    def test_from_config_uses_production_values_not_defaults(self, production_engine):
        """from_config debe cargar valores de produccion, no los defaults del constructor."""
        assert production_engine.threshold_critical == 0.50
        assert production_engine.threshold_high == 0.25
        assert production_engine.threshold_medium == 0.05
        # Los defaults del constructor son 0.85 / 0.65 / 0.40, distintos a produccion
        default_engine = RiskFusionEngine()
        assert default_engine.threshold_critical == 0.85
        assert default_engine.threshold_high == 0.65
        assert default_engine.threshold_medium == 0.40
        assert production_engine.threshold_critical != default_engine.threshold_critical

    def test_from_config_uses_production_weights_not_defaults(self, production_engine):
        """from_config debe cargar los pesos de produccion (1.00/0.00/0.00)."""
        assert production_engine.w_fraud == pytest.approx(1.00)
        assert production_engine.w_anomaly == pytest.approx(0.00)
        assert production_engine.w_behavioral == pytest.approx(0.00)
        default_engine = RiskFusionEngine()
        assert default_engine.w_fraud == pytest.approx(0.60)
        assert default_engine.w_anomaly == pytest.approx(0.25)
        assert default_engine.w_behavioral == pytest.approx(0.15)
        assert production_engine.w_fraud != default_engine.w_fraud

    def test_from_config_uses_production_anomaly_alert_threshold(self, production_engine):
        """from_config debe cargar anomaly_alert_threshold de produccion (0.70)."""
        assert production_engine.anomaly_alert_threshold == 0.70
        default_engine = RiskFusionEngine()
        assert default_engine.anomaly_alert_threshold == 0.70  # default matches
        # Production engine uses 0.70 from config
        assert production_engine.anomaly_alert_threshold == default_engine.anomaly_alert_threshold

    def test_production_threshold_matches_json_file(self, production_engine):
        with open(THRESHOLDS_PATH, "r", encoding="utf-8") as f:
            raw = json.load(f)
        assert production_engine.threshold_critical == raw["critical"]
        assert production_engine.threshold_high == raw["high"]
        assert production_engine.threshold_medium == raw["medium"]
        assert production_engine.anomaly_alert_threshold == raw["anomaly_alert_threshold"]

    def test_compute_anomaly_alert_production_threshold(self, production_engine):
        # Production anomaly_alert_threshold = 0.70
        assert production_engine.compute_anomaly_alert(0.70) is True
        assert production_engine.compute_anomaly_alert(0.80) is True
        assert production_engine.compute_anomaly_alert(0.69) is False
        assert production_engine.compute_anomaly_alert(0.0) is False

    def test_evaluate_production_returns_anomaly_alert(self, production_engine):
        result = production_engine.evaluate(0.10, 0.80, 0.0)
        assert result["anomaly_alert"] is True
        assert result["risk_score"] == pytest.approx(0.10)  # w_fraud=1.00
        assert result["risk_level"] == "MEDIUM"  # 0.10 >= 0.05, < 0.25

        result2 = production_engine.evaluate(0.10, 0.50, 0.0)
        assert result2["anomaly_alert"] is False
        assert result2["risk_score"] == pytest.approx(0.10)

    def test_classify_risk_production_critical_boundary(self, production_engine):
        # Umbral inclusivo: exactamente critical -> CRITICAL
        assert production_engine.classify_risk(0.50) == "CRITICAL"

    def test_classify_risk_production_high_boundary(self, production_engine):
        assert production_engine.classify_risk(0.25) == "HIGH"

    def test_classify_risk_production_medium_boundary(self, production_engine):
        assert production_engine.classify_risk(0.05) == "MEDIUM"

    def test_classify_risk_production_just_below_medium(self, production_engine):
        assert production_engine.classify_risk(0.049) == "LOW"

    def test_classify_risk_production_just_below_critical(self, production_engine):
        assert production_engine.classify_risk(0.499) == "HIGH"

    def test_classify_risk_production_just_below_high(self, production_engine):
        assert production_engine.classify_risk(0.249) == "MEDIUM"

    def test_classify_risk_production_score_0_03_is_low(self, production_engine):
        # Con production config, 0.03 < 0.05 -> LOW
        assert production_engine.classify_risk(0.03) == "LOW"

    def test_defaults_versus_production_are_documented(self):
        """
        Documenta la diferencia entre defaults del constructor y valores de produccion.

        - Defaults del constructor: critical=0.85, high=0.65, medium=0.40,
          anomaly_alert_threshold=0.70
          Pesos: 0.60/0.25/0.15
        - Valores de produccion (configs/thresholds.json y risk_fusion.yaml):
          critical=0.50, high=0.25, medium=0.05,
          anomaly_alert_threshold=0.70
          Pesos: 1.00/0.00/0.00 (fraud_probability solo)
        - Los umbrales de produccion se aplican sobre risk_score, que con los
          pesos actuales equivale a fraud_probability. Seleccionados sobre
          Validacion con criterio operativo, no derivados de porcentajes fijos
          del umbral crítico.
        - anomaly_alert_threshold=0.70: una transacción con anomaly_score >= 0.70
          activa una alerta de escalada separada (anomaly_alert=True), sin afectar
          risk_level.
        """
        defaults = RiskFusionEngine()
        assert defaults.threshold_critical == 0.85
        assert defaults.threshold_high == 0.65
        assert defaults.threshold_medium == 0.40
        assert defaults.anomaly_alert_threshold == 0.70
        assert defaults.w_fraud == pytest.approx(0.60)
        assert defaults.w_anomaly == pytest.approx(0.25)
        assert defaults.w_behavioral == pytest.approx(0.15)

        config = load_config()
        assert config.thresholds.critical == 0.50
        assert config.thresholds.high == 0.25
        assert config.thresholds.medium == 0.05
        assert config.thresholds.anomaly_alert_threshold == 0.70
        assert config.risk_fusion.anomaly_alert_threshold == 0.70
        assert config.thresholds.validation_pr_auc == 0.8112
