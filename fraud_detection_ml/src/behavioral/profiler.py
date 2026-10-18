"""
src/behavioral/profiler.py
==========================
Construcción de perfiles de usuario en modo batch (entrenamiento).

Procesa el DataFrame en orden cronológico estricto.
Para cada transacción:
  1. Calcula las features de desviación usando el perfil ACTUAL del usuario.
  2. Actualiza el perfil con la transacción (solo si es legítima).

Esta secuencia garantiza que no hay data leakage: el perfil usado para
calcular la desviación de la transacción t nunca contiene información de t.

También construye un GlobalProfile como fallback para cold start.
"""

from __future__ import annotations

import pickle
from pathlib import Path
from typing import Dict, Optional

import numpy as np
import pandas as pd

from src.behavioral.profile import UserProfile
from src.behavioral.deviation import compute_behavioral_features


class BehavioralProfiler:
    """
    Construye y mantiene perfiles de usuario para el pipeline de fraude.

    Uso en entrenamiento:
        profiler = BehavioralProfiler()
        df_with_behavioral = profiler.fit_transform(df, window_days=30)
        profiler.save("artifacts/v1.0.0/behavior_profiles.pkl")

    Uso en inferencia:
        profiler = BehavioralProfiler.load("artifacts/v1.0.0/behavior_profiles.pkl")
        features = profiler.get_behavioral_features(transaction_input)
    """

    COLD_START_MIN_TX = 5

    def __init__(self) -> None:
        self._profiles: Dict[str, UserProfile] = {}
        self._global_profile: Optional[UserProfile] = None

    # ── Entrenamiento ────────────────────────────────────────────────────────

    def fit_transform(
        self,
        df: pd.DataFrame,
        window_days: int = 30,
    ) -> pd.DataFrame:
        """
        Procesa el DataFrame en orden cronológico y añade behavioral features.

        Parameters
        ----------
        df : pd.DataFrame
            DataFrame con columnas: user_id, amount, timestamp, country,
            device_id, merchant_id, is_fraud (0/1).
            Debe estar ordenado por timestamp ASC.
        window_days : int
            Ventana histórica en días para calcular estadísticas del usuario.

        Returns
        -------
        pd.DataFrame
            DataFrame original con columnas behavioral añadidas.
        """
        df = df.copy().sort_values("timestamp").reset_index(drop=True)

        if not pd.api.types.is_datetime64_any_dtype(df["timestamp"]):
            df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)

        # Inicializar columnas behavioral
        behavioral_cols = [
            "user_avg_amount_30d", "user_std_amount_30d",
            "amount_z_score", "amount_ratio_to_avg",
            "is_new_device", "is_new_country", "is_new_merchant",
            "user_tx_count_30d", "days_since_last_tx",
        ]

        n = len(df)
        user_ids = df["user_id"].astype(str).tolist()
        amounts = df["amount"].astype(float).tolist()
        timestamps = df["timestamp"].tolist()
        countries = df["country"].astype(str).tolist() if "country" in df.columns else ["UNKNOWN"] * n
        device_ids = df["device_id"].astype(str).tolist() if "device_id" in df.columns else ["UNKNOWN"] * n
        merchant_ids = df["merchant_id"].astype(str).tolist() if "merchant_id" in df.columns else ["UNKNOWN"] * n
        is_frauds = df["is_fraud"].fillna(0).astype(int).tolist() if "is_fraud" in df.columns else [0] * n

        col_to_idx = {col: idx for idx, col in enumerate(behavioral_cols)}
        results = np.zeros((n, len(behavioral_cols)), dtype=np.float32)

        # Acumular datos de todos los usuarios para el perfil global
        all_amounts = []

        for i in range(n):
            user_id = user_ids[i]
            amount = amounts[i]
            ts = timestamps[i]
            country = countries[i]
            device_id = device_ids[i]
            merchant_id = merchant_ids[i]
            is_fraud = is_frauds[i]

            # Obtener o crear perfil del usuario
            if user_id not in self._profiles:
                self._profiles[user_id] = UserProfile(user_id=user_id)

            profile = self._profiles[user_id]

            # Calcular features de desviación ANTES de actualizar el perfil
            features = compute_behavioral_features(
                profile=profile,
                amount=amount,
                timestamp=ts,
                country=country,
                device_id=device_id,
                merchant_id=merchant_id,
                cold_start_min_tx=self.COLD_START_MIN_TX,
            )

            # Asignar features en la matriz de resultados
            for col, val in features.items():
                if col in col_to_idx:
                    results[i, col_to_idx[col]] = val

            # Actualizar el perfil SOLO con transacciones legítimas
            # (Las fraudulentas no deben contaminar el perfil normal)
            if is_fraud == 0:
                profile.update(
                    amount=amount,
                    timestamp=ts,
                    country=country,
                    device_id=device_id,
                    merchant_id=merchant_id,
                )

            all_amounts.append(amount)

        # Asignar columnas calculadas al DataFrame
        for col, idx in col_to_idx.items():
            df[col] = results[:, idx]

        # Construir perfil global como estadística de todos los usuarios
        self._build_global_profile(all_amounts)

        return df

    def _build_global_profile(self, all_amounts: list) -> None:
        """Construye un perfil global promedio para cold start."""
        self._global_profile = UserProfile(user_id="__global__")
        if all_amounts:
            self._global_profile.amount_ema = float(np.mean(all_amounts))
            self._global_profile.amount_variance_ema = float(np.var(all_amounts))
            self._global_profile.tx_count = len(all_amounts)

    # ── Inferencia ───────────────────────────────────────────────────────────

    def get_behavioral_features(
        self,
        user_id: str,
        amount: float,
        timestamp,
        country: str,
        device_id: str,
        merchant_id: str,
    ) -> dict:
        """
        Retorna las behavioral features para UNA transacción en inferencia.

        Si el usuario está en cold start, usa el perfil global.

        Parameters
        ----------
        user_id     : ID del usuario.
        amount      : Monto de la transacción.
        timestamp   : Timestamp de la transacción (datetime o str ISO 8601).
        country     : Código de país.
        device_id   : ID del dispositivo.
        merchant_id : ID del comercio.

        Returns
        -------
        dict
            Diccionario con todas las behavioral features y el flag is_cold_start.
        """
        if isinstance(timestamp, str):
            timestamp = pd.to_datetime(timestamp, utc=True)

        profile = self._profiles.get(user_id)
        is_cold_start = False

        if profile is None or profile.tx_count < self.COLD_START_MIN_TX:
            # Usar perfil global para cold start
            profile = self._global_profile or UserProfile(user_id="__fallback__")
            is_cold_start = True

        features = compute_behavioral_features(
            profile=profile,
            amount=amount,
            timestamp=timestamp,
            country=country,
            device_id=device_id,
            merchant_id=merchant_id,
            cold_start_min_tx=self.COLD_START_MIN_TX,
        )
        features["is_cold_start"] = is_cold_start
        return features

    def update_profile(
        self,
        user_id: str,
        amount: float,
        timestamp,
        country: str,
        device_id: str,
        merchant_id: str,
        risk_level: str,
    ) -> None:
        """
        Actualiza el perfil de un usuario tras inferencia.

        Solo actualiza si risk_level ∈ {LOW, MEDIUM}.
        Las transacciones HIGH y CRITICAL no modifican el perfil
        para evitar envenenamiento del perfil legítimo.

        Parameters
        ----------
        risk_level : str
            Nivel de riesgo calculado por el Risk Fusion Engine.
        """
        if risk_level in ("HIGH", "CRITICAL"):
            return  # Protección contra envenenamiento

        if isinstance(timestamp, str):
            timestamp = pd.to_datetime(timestamp, utc=True)

        if user_id not in self._profiles:
            self._profiles[user_id] = UserProfile(user_id=user_id)

        self._profiles[user_id].update(
            amount=amount,
            timestamp=timestamp,
            country=country,
            device_id=device_id,
            merchant_id=merchant_id,
        )

    # ── Persistencia ─────────────────────────────────────────────────────────

    def save(self, path: str | Path) -> None:
        """Serializa todos los perfiles a un archivo pickle."""
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "profiles": {uid: p.to_dict() for uid, p in self._profiles.items()},
            "global_profile": self._global_profile.to_dict() if self._global_profile else None,
        }
        with open(path, "wb") as f:
            pickle.dump(data, f)

    @classmethod
    def load(cls, path: str | Path) -> "BehavioralProfiler":
        """Carga perfiles desde un archivo pickle."""
        with open(path, "rb") as f:
            data = pickle.load(f)

        profiler = cls()
        profiler._profiles = {
            uid: UserProfile.from_dict(d)
            for uid, d in data["profiles"].items()
        }
        if data.get("global_profile"):
            profiler._global_profile = UserProfile.from_dict(data["global_profile"])
        return profiler

    @property
    def user_count(self) -> int:
        return len(self._profiles)
