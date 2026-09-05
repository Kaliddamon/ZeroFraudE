"""
tests/unit/test_features.py
============================
Tests unitarios para transaction_features y temporal_features.
"""

import numpy as np
import pandas as pd
import pytest
from datetime import timezone

from src.features.transaction_features import add_transaction_features
from src.features.temporal_features import compute_velocity_for_inference


def _make_df(rows):
    """Helper: crea un DataFrame de transacciones de prueba."""
    df = pd.DataFrame(rows)
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    return df


class TestTransactionFeatures:

    def test_amount_log_positive(self):
        df = _make_df([{
            "transaction_id": "T1", "user_id": "U1", "amount": 100.0,
            "timestamp": "2023-01-01T10:00:00Z", "merchant_id": "M1",
            "country": "US", "device_id": "D1",
        }])
        result = add_transaction_features(df)
        assert result["amount_log"].iloc[0] == pytest.approx(np.log1p(100.0))

    def test_cyclic_encoding_range(self):
        df = _make_df([{
            "transaction_id": "T1", "user_id": "U1", "amount": 50.0,
            "timestamp": "2023-01-01T23:00:00Z", "merchant_id": "M1",
            "country": "US", "device_id": "D1",
        }])
        result = add_transaction_features(df)
        assert -1.0 <= result["hour_sin"].iloc[0] <= 1.0
        assert -1.0 <= result["hour_cos"].iloc[0] <= 1.0

    def test_is_weekend_flag(self):
        # 2023-01-07 is Saturday
        df = _make_df([{
            "transaction_id": "T1", "user_id": "U1", "amount": 50.0,
            "timestamp": "2023-01-07T10:00:00Z", "merchant_id": "M1",
            "country": "US", "device_id": "D1",
        }])
        result = add_transaction_features(df)
        assert result["is_weekend"].iloc[0] == 1

    def test_is_night_flag(self):
        df = _make_df([{
            "transaction_id": "T1", "user_id": "U1", "amount": 50.0,
            "timestamp": "2023-01-01T03:00:00Z", "merchant_id": "M1",
            "country": "US", "device_id": "D1",
        }])
        result = add_transaction_features(df)
        assert result["is_night"].iloc[0] == 1

    def test_is_night_false_daytime(self):
        df = _make_df([{
            "transaction_id": "T1", "user_id": "U1", "amount": 50.0,
            "timestamp": "2023-01-01T14:00:00Z", "merchant_id": "M1",
            "country": "US", "device_id": "D1",
        }])
        result = add_transaction_features(df)
        assert result["is_night"].iloc[0] == 0

    def test_duplicate_candidate_detection(self):
        df = _make_df([
            {"transaction_id": "T1", "user_id": "U1", "amount": 100.0,
             "timestamp": "2023-01-01T10:00:00Z", "merchant_id": "M1",
             "country": "US", "device_id": "D1"},
            {"transaction_id": "T2", "user_id": "U1", "amount": 100.0,
             "timestamp": "2023-01-01T10:00:30Z", "merchant_id": "M1",
             "country": "US", "device_id": "D1"},
        ])
        result = add_transaction_features(df)
        assert result["is_duplicate_candidate"].iloc[1] == 1


class TestVelocityFeaturesInference:

    def test_empty_history(self):
        result = compute_velocity_for_inference(
            user_history=None,
            current_timestamp=pd.to_datetime("2023-01-01T10:00:00Z"),
            current_amount=50.0,
            current_merchant="M1",
            current_country="US",
        )
        assert result["tx_count_5min"] == 0
        assert result["tx_count_1h"] == 0
        assert result["tx_count_24h"] == 0
        assert result["amount_sum_1h"] == 0.0

    def test_velocity_counts(self):
        history = pd.DataFrame({
            "timestamp": pd.to_datetime([
                "2023-01-01T09:58:00Z",  # within 5min
                "2023-01-01T09:30:00Z",  # within 1h
                "2023-01-01T09:00:00Z",  # within 1h
                "2022-12-31T12:00:00Z",  # within 24h
            ]),
            "amount": [20, 30, 40, 50],
            "merchant_id": ["M1", "M2", "M3", "M4"],
            "country": ["US", "US", "GB", "US"],
        })
        current_ts = pd.to_datetime("2023-01-01T10:00:00Z")

        result = compute_velocity_for_inference(
            user_history=history,
            current_timestamp=current_ts,
            current_amount=100.0,
            current_merchant="M5",
            current_country="US",
        )
        assert result["tx_count_5min"] == 1   # only 09:58
        assert result["tx_count_1h"] == 3     # 09:00, 09:30, 09:58
        assert result["tx_count_24h"] == 4    # all 4
        assert result["amount_sum_1h"] == 90  # 20+30+40
        assert result["unique_merchants_24h"] == 4
        assert result["unique_countries_24h"] == 2  # US, GB
