"""
tests/unit/test_risk_fusion.py
===============================
Tests unitarios para el Risk Fusion Engine.
"""

import pytest
from src.risk.fusion import RiskFusionEngine


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
