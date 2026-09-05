"""
tests/unit/test_preprocessing.py
=================================
Tests unitarios para los módulos de preprocessing.
"""

import numpy as np
import pandas as pd
import pytest

from src.preprocessing.imputer import FraudImputerTransformer
from src.preprocessing.encoder import TargetEncoderWithSmoothing


class TestFraudImputer:

    def test_amount_nulls_imputed(self):
        df = pd.DataFrame({
            "amount": [100.0, np.nan, 200.0],
            "merchant_id": ["M1", "M1", "M2"],
        })
        imputer = FraudImputerTransformer()
        result = imputer.fit_transform(df)
        assert not result["amount"].isna().any()

    def test_country_null_becomes_unknown(self):
        df = pd.DataFrame({
            "country": ["US", None, "GB"],
        })
        imputer = FraudImputerTransformer()
        result = imputer.fit_transform(df)
        assert result["country"].iloc[1] == "UNKNOWN"

    def test_device_id_null_becomes_unknown(self):
        df = pd.DataFrame({
            "device_id": ["D1", None, "D3"],
        })
        imputer = FraudImputerTransformer()
        result = imputer.fit_transform(df)
        assert result["device_id"].iloc[1] == "UNKNOWN"

    def test_velocity_cols_filled_with_zero(self):
        df = pd.DataFrame({
            "tx_count_5min": [1.0, np.nan, 3.0],
            "tx_count_1h": [np.nan, np.nan, 5.0],
        })
        imputer = FraudImputerTransformer()
        result = imputer.fit_transform(df)
        assert result["tx_count_5min"].iloc[1] == 0.0
        assert result["tx_count_1h"].iloc[0] == 0.0

    def test_original_df_not_modified(self):
        df = pd.DataFrame({"country": ["US", None]})
        imputer = FraudImputerTransformer()
        _ = imputer.fit_transform(df)
        assert pd.isna(df["country"].iloc[1])  # Original unchanged (still NaN, not 'UNKNOWN')


class TestTargetEncoder:

    def test_encodes_with_smoothing(self):
        X = pd.DataFrame({"merchant_id": ["A", "A", "A", "B", "B"]})
        y = pd.Series([0, 0, 1, 1, 1])

        encoder = TargetEncoderWithSmoothing(cols=["merchant_id"], smoothing=1.0)
        result = encoder.fit_transform(X, y)

        assert "merchant_id_target_enc" in result.columns
        # A has mean=1/3, B has mean=1
        # With smoothing=1 and global_mean=3/5=0.6
        # A: (3*(1/3) + 1*0.6)/(3+1) = 1.6/4 = 0.4
        # B: (2*1 + 1*0.6)/(2+1) = 2.6/3 ≈ 0.867
        assert result["merchant_id_target_enc"].iloc[0] == pytest.approx(0.4, abs=0.05)
        assert result["merchant_id_target_enc"].iloc[3] == pytest.approx(0.867, abs=0.05)

    def test_unknown_category_gets_global_mean(self):
        X_train = pd.DataFrame({"merchant_id": ["A", "B"]})
        y_train = pd.Series([0, 1])

        encoder = TargetEncoderWithSmoothing(cols=["merchant_id"], smoothing=0.0)
        encoder.fit(X_train, y_train)

        X_new = pd.DataFrame({"merchant_id": ["C_UNKNOWN"]})
        result = encoder.transform(X_new)

        global_mean = 0.5  # (0+1)/2
        assert result["merchant_id_target_enc"].iloc[0] == pytest.approx(global_mean)
