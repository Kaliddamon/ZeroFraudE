"""
tests/unit/test_behavioral.py
==============================
Tests unitarios para el Behavioral Profiler y las features de desviación.
"""

import pytest
import pandas as pd
from datetime import datetime, timezone

from src.behavioral.profile import UserProfile
from src.behavioral.deviation import compute_behavioral_features
from src.behavioral.profiler import BehavioralProfiler


class TestUserProfile:

    def test_new_profile_is_cold_start(self):
        profile = UserProfile(user_id="U1")
        assert profile.tx_count == 0
        assert profile.amount_ema == 0.0

    def test_update_increases_tx_count(self):
        profile = UserProfile(user_id="U1")
        profile.update(
            amount=100.0,
            timestamp=datetime(2023, 1, 1, 10, 0, tzinfo=timezone.utc),
            country="US",
            device_id="D1",
            merchant_id="M1",
        )
        assert profile.tx_count == 1
        assert profile.amount_ema == 100.0
        assert "US" in profile.known_countries
        assert "D1" in profile.known_devices

    def test_ema_updates_correctly(self):
        profile = UserProfile(user_id="U1")
        # First transaction: EMA = amount
        profile.update(100.0, datetime(2023, 1, 1, tzinfo=timezone.utc), "US", "D1", "M1")
        assert profile.amount_ema == 100.0

        # Second transaction: EMA should shift toward new value
        profile.update(200.0, datetime(2023, 1, 2, tzinfo=timezone.utc), "US", "D1", "M1")
        # alpha=0.1: new_ema = 0.1 * 200 + 0.9 * 100 = 110
        assert profile.amount_ema == pytest.approx(110.0)

    def test_serialization_roundtrip(self):
        profile = UserProfile(user_id="U1")
        profile.update(100.0, datetime(2023, 1, 1, tzinfo=timezone.utc), "US", "D1", "M1")
        d = profile.to_dict()
        restored = UserProfile.from_dict(d)
        assert restored.user_id == "U1"
        assert restored.tx_count == 1
        assert "US" in restored.known_countries


class TestBehavioralDeviation:

    def test_cold_start_returns_zero_deviation(self):
        profile = UserProfile(user_id="U_NEW")  # tx_count = 0
        features = compute_behavioral_features(
            profile=profile,
            amount=100.0,
            timestamp=datetime(2023, 1, 1, 10, 0, tzinfo=timezone.utc),
            country="US",
            device_id="D1",
            merchant_id="M1",
        )
        assert features["behavioral_deviation"] == 0.0

    def test_new_device_detected(self):
        profile = UserProfile(user_id="U1")
        # Build up the profile with 5+ transactions
        for i in range(6):
            profile.update(
                amount=50.0,
                timestamp=datetime(2023, 1, i + 1, 10, 0, tzinfo=timezone.utc),
                country="US",
                device_id="D_KNOWN",
                merchant_id="M1",
            )

        features = compute_behavioral_features(
            profile=profile,
            amount=50.0,
            timestamp=datetime(2023, 1, 10, 10, 0, tzinfo=timezone.utc),
            country="US",
            device_id="D_NEW_DEVICE",
            merchant_id="M1",
        )
        assert features["is_new_device"] == 1.0

    def test_known_device_not_flagged(self):
        profile = UserProfile(user_id="U1")
        for i in range(6):
            profile.update(50.0, datetime(2023, 1, i + 1, 10, 0, tzinfo=timezone.utc),
                          "US", "D1", "M1")

        features = compute_behavioral_features(
            profile=profile, amount=50.0,
            timestamp=datetime(2023, 1, 10, 10, 0, tzinfo=timezone.utc),
            country="US", device_id="D1", merchant_id="M1",
        )
        assert features["is_new_device"] == 0.0

    def test_z_score_high_amount(self):
        profile = UserProfile(user_id="U1")
        # Use varying amounts so EMA variance is non-zero
        amounts = [40.0, 55.0, 45.0, 60.0, 50.0, 35.0, 65.0, 48.0, 52.0, 50.0]
        for i, amt in enumerate(amounts):
            profile.update(amt, datetime(2023, 1, i + 1, 10, 0, tzinfo=timezone.utc),
                          "US", "D1", "M1")

        features = compute_behavioral_features(
            profile=profile, amount=500.0,  # ~10x the average
            timestamp=datetime(2023, 1, 15, 10, 0, tzinfo=timezone.utc),
            country="US", device_id="D1", merchant_id="M1",
        )
        assert features["amount_z_score"] > 2.0
        assert features["amount_ratio_to_avg"] > 5.0


class TestBehavioralProfiler:

    def test_profile_not_updated_on_fraud(self):
        profiler = BehavioralProfiler()

        # First, create the user with some legit transactions
        profiler.update_profile("U1", 50.0,
                               datetime(2023, 1, 1, 10, 0, tzinfo=timezone.utc),
                               "US", "D1", "M1", risk_level="LOW")
        assert profiler._profiles["U1"].tx_count == 1

        # HIGH risk: should NOT update
        profiler.update_profile("U1", 5000.0,
                               datetime(2023, 1, 2, 3, 0, tzinfo=timezone.utc),
                               "NG", "D_NEW", "M99", risk_level="HIGH")
        assert profiler._profiles["U1"].tx_count == 1  # Still 1

        # CRITICAL risk: should NOT update
        profiler.update_profile("U1", 10000.0,
                               datetime(2023, 1, 3, 3, 0, tzinfo=timezone.utc),
                               "RU", "D_NEW2", "M99", risk_level="CRITICAL")
        assert profiler._profiles["U1"].tx_count == 1  # Still 1

    def test_profiler_save_load(self, tmp_path):
        profiler = BehavioralProfiler()
        profiler.update_profile("U1", 100.0,
                               datetime(2023, 1, 1, tzinfo=timezone.utc),
                               "US", "D1", "M1", risk_level="LOW")
        
        path = tmp_path / "profiles.pkl"
        profiler.save(path)

        loaded = BehavioralProfiler.load(path)
        assert loaded.user_count == 1
        assert "U1" in loaded._profiles
