"""
tests/unit/test_schemas.py
===========================
Tests de validación de los schemas de entrada y salida (Pydantic).
"""

import pytest
from datetime import datetime, timezone, timedelta
from src.validation.schemas import TransactionInput, PredictionOutput, ErrorOutput


# ── TransactionInput ─────────────────────────────────────────────────────────

class TestTransactionInput:

    def test_valid_input(self):
        tx = TransactionInput(
            transaction_id="T001",
            user_id="U123",
            amount=1250.50,
            timestamp=datetime(2023, 10, 27, 14, 32, 0, tzinfo=timezone.utc),
            country="CO",
            device_id="D42",
            merchant_id="M18",
        )
        assert tx.transaction_id == "T001"
        assert tx.amount == 1250.50
        assert tx.country == "CO"

    def test_negative_amount_rejected(self):
        with pytest.raises(Exception):
            TransactionInput(
                transaction_id="T002",
                user_id="U123",
                amount=-100.0,
                timestamp=datetime(2023, 10, 27, tzinfo=timezone.utc),
                country="US",
                device_id="D1",
                merchant_id="M1",
            )

    def test_zero_amount_rejected(self):
        with pytest.raises(Exception):
            TransactionInput(
                transaction_id="T003",
                user_id="U123",
                amount=0.0,
                timestamp=datetime(2023, 10, 27, tzinfo=timezone.utc),
                country="US",
                device_id="D1",
                merchant_id="M1",
            )

    def test_amount_above_million_rejected(self):
        with pytest.raises(Exception):
            TransactionInput(
                transaction_id="T004",
                user_id="U123",
                amount=1_000_001.0,
                timestamp=datetime(2023, 10, 27, tzinfo=timezone.utc),
                country="US",
                device_id="D1",
                merchant_id="M1",
            )

    def test_future_timestamp_rejected(self):
        future = datetime.now(timezone.utc) + timedelta(hours=2)
        with pytest.raises(Exception):
            TransactionInput(
                transaction_id="T005",
                user_id="U123",
                amount=50.0,
                timestamp=future,
                country="US",
                device_id="D1",
                merchant_id="M1",
            )

    def test_country_uppercased(self):
        tx = TransactionInput(
            transaction_id="T006",
            user_id="U123",
            amount=50.0,
            timestamp=datetime(2023, 10, 27, tzinfo=timezone.utc),
            country="co",
            device_id="D1",
            merchant_id="M1",
        )
        assert tx.country == "CO"

    def test_empty_user_id_rejected(self):
        with pytest.raises(Exception):
            TransactionInput(
                transaction_id="T007",
                user_id="",
                amount=50.0,
                timestamp=datetime(2023, 10, 27, tzinfo=timezone.utc),
                country="US",
                device_id="D1",
                merchant_id="M1",
            )

    def test_country_too_long_rejected(self):
        with pytest.raises(Exception):
            TransactionInput(
                transaction_id="T008",
                user_id="U1",
                amount=50.0,
                timestamp=datetime(2023, 10, 27, tzinfo=timezone.utc),
                country="TOOLONG",
                device_id="D1",
                merchant_id="M1",
            )


# ── PredictionOutput ─────────────────────────────────────────────────────────

class TestPredictionOutput:

    def test_valid_output(self):
        output = PredictionOutput(
            transaction_id="T001",
            fraud_probability=0.87,
            anomaly_score=0.81,
            behavioral_deviation=0.92,
            risk_score=0.89,
            risk_level="HIGH",
            explanations=["Amount 8.3× above user average"],
            model_version="1.0.0",
        )
        assert output.risk_level == "HIGH"
        assert output.is_cold_start is False

    def test_fraud_probability_out_of_range(self):
        with pytest.raises(Exception):
            PredictionOutput(
                transaction_id="T001",
                fraud_probability=1.5,
                anomaly_score=0.5,
                behavioral_deviation=0.5,
                risk_score=0.5,
                risk_level="LOW",
                explanations=["Test"],
                model_version="1.0.0",
            )

    def test_invalid_risk_level_rejected(self):
        with pytest.raises(Exception):
            PredictionOutput(
                transaction_id="T001",
                fraud_probability=0.5,
                anomaly_score=0.5,
                behavioral_deviation=0.5,
                risk_score=0.5,
                risk_level="EXTREME",
                explanations=["Test"],
                model_version="1.0.0",
            )

    def test_empty_explanations_rejected(self):
        with pytest.raises(Exception):
            PredictionOutput(
                transaction_id="T001",
                fraud_probability=0.5,
                anomaly_score=0.5,
                behavioral_deviation=0.5,
                risk_score=0.5,
                risk_level="LOW",
                explanations=[],
                model_version="1.0.0",
            )


# ── ErrorOutput ──────────────────────────────────────────────────────────────

class TestErrorOutput:

    def test_error_output(self):
        err = ErrorOutput(
            transaction_id="T001",
            error="VALIDATION_ERROR",
            message="Amount must be positive",
        )
        assert err.model_version == "unknown"
