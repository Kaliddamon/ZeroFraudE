"""
src/behavioral/profile.py
==========================
Dataclass que representa el perfil de comportamiento de un usuario.

El perfil se actualiza incrementalmente con cada transacción legítima.
Se usa Exponential Moving Average (EMA) para el monto, que da más peso
a las transacciones recientes sin descartar el historial completo.

Protección contra envenenamiento:
    El perfil solo se actualiza cuando risk_level ∈ {LOW, MEDIUM}.
    Las transacciones HIGH y CRITICAL no modifican el perfil.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Optional, Set


@dataclass
class UserProfile:
    """
    Perfil de comportamiento de un usuario del e-commerce.

    Almacena estadísticas incrementales calculadas exclusivamente
    sobre transacciones legítimas (no fraudulentas).
    """

    user_id: str

    # Conteo de transacciones legítimas procesadas
    tx_count: int = 0

    # EMA del monto (alpha = 0.1 → da peso a las últimas ~9 transacciones)
    amount_ema: float = 0.0
    amount_variance_ema: float = 0.0   # Variance tracking para std aproximada
    _ema_alpha: float = field(default=0.1, repr=False)

    # Historial de entidades conocidas (solo transacciones legítimas)
    known_countries: Set[str] = field(default_factory=set)
    known_devices: Set[str] = field(default_factory=set)
    known_merchants: Set[str] = field(default_factory=set)

    # Histograma de horas del día (24 buckets) normalizado
    # typical_hours[h] = proporción de transacciones en la hora h
    typical_hours: List[float] = field(default_factory=lambda: [0.0] * 24)

    # Timestamps de las últimas N transacciones (para velocity en inferencia)
    # Se mantienen solo las últimas 200 para limitar el tamaño del perfil
    recent_amounts: List[float] = field(default_factory=list)
    recent_timestamps: List[str] = field(default_factory=list)   # ISO 8601
    recent_merchants: List[str] = field(default_factory=list)
    recent_countries: List[str] = field(default_factory=list)

    last_transaction_at: Optional[str] = None   # ISO 8601
    profile_version: int = 0

    # Máximo de transacciones recientes a mantener en memoria
    _max_recent: int = field(default=200, repr=False)

    # ── Propiedades calculadas ───────────────────────────────────────────────

    @property
    def amount_std(self) -> float:
        """Desviación estándar aproximada usando la varianza EMA."""
        return math.sqrt(max(self.amount_variance_ema, 0.0))

    @property
    def is_cold_start(self, min_transactions: int = 5) -> bool:
        """True si el usuario tiene pocas transacciones (perfil poco confiable)."""
        return self.tx_count < min_transactions

    # ── Actualización del perfil ─────────────────────────────────────────────

    def update(
        self,
        amount: float,
        timestamp: datetime,
        country: str,
        device_id: str,
        merchant_id: str,
    ) -> None:
        """
        Actualiza el perfil con una nueva transacción legítima.

        IMPORTANTE: Solo llamar a este método si la transacción
        fue clasificada como LOW o MEDIUM (no HIGH/CRITICAL).

        Parameters
        ----------
        amount      : Monto de la transacción.
        timestamp   : Datetime de la transacción (UTC).
        country     : Código de país.
        device_id   : ID del dispositivo.
        merchant_id : ID del comercio.
        """
        self.tx_count += 1

        # -- EMA del monto --
        if self.tx_count == 1:
            self.amount_ema = amount
            self.amount_variance_ema = 0.0
        else:
            prev_ema = self.amount_ema
            self.amount_ema = (
                self._ema_alpha * amount + (1 - self._ema_alpha) * prev_ema
            )
            # Welford-style online variance con EMA
            diff = amount - prev_ema
            self.amount_variance_ema = (
                (1 - self._ema_alpha) * (self.amount_variance_ema + self._ema_alpha * diff ** 2)
            )

        # -- Entidades conocidas --
        self.known_countries.add(country)
        self.known_devices.add(device_id)
        self.known_merchants.add(merchant_id)

        # -- Histograma de horas --
        hour = timestamp.hour
        # Actualización incremental del histograma
        total = self.tx_count
        for h in range(24):
            self.typical_hours[h] = self.typical_hours[h] * (total - 1) / total
        self.typical_hours[hour] += 1.0 / total

        # -- Historial reciente --
        ts_iso = timestamp.isoformat()
        self.recent_amounts.append(amount)
        self.recent_timestamps.append(ts_iso)
        self.recent_merchants.append(merchant_id)
        self.recent_countries.append(country)
        self.last_transaction_at = ts_iso

        # -- Recortar a max_recent --
        if len(self.recent_amounts) > self._max_recent:
            self.recent_amounts = self.recent_amounts[-self._max_recent:]
            self.recent_timestamps = self.recent_timestamps[-self._max_recent:]
            self.recent_merchants = self.recent_merchants[-self._max_recent:]
            self.recent_countries = self.recent_countries[-self._max_recent:]

        self.profile_version += 1

    def is_unusual_hour(self, hour: int, threshold: float = 0.02) -> bool:
        """
        Retorna True si la hora es inusual para este usuario.

        Una hora es inusual si su proporción histórica es menor que threshold.
        Para cold start (pocos datos), siempre retorna False (no sabemos aún).
        """
        if self.tx_count < 5:
            return False
        return self.typical_hours[hour] < threshold

    def to_dict(self) -> dict:
        """Serialización a dict para almacenamiento en pickle."""
        return {
            "user_id": self.user_id,
            "tx_count": self.tx_count,
            "amount_ema": self.amount_ema,
            "amount_variance_ema": self.amount_variance_ema,
            "known_countries": list(self.known_countries),
            "known_devices": list(self.known_devices),
            "known_merchants": list(self.known_merchants),
            "typical_hours": self.typical_hours,
            "recent_amounts": self.recent_amounts,
            "recent_timestamps": self.recent_timestamps,
            "recent_merchants": self.recent_merchants,
            "recent_countries": self.recent_countries,
            "last_transaction_at": self.last_transaction_at,
            "profile_version": self.profile_version,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "UserProfile":
        """Deserialización desde dict (cargado desde pickle)."""
        profile = cls(user_id=data["user_id"])
        profile.tx_count = data["tx_count"]
        profile.amount_ema = data["amount_ema"]
        profile.amount_variance_ema = data["amount_variance_ema"]
        profile.known_countries = set(data["known_countries"])
        profile.known_devices = set(data["known_devices"])
        profile.known_merchants = set(data["known_merchants"])
        profile.typical_hours = data["typical_hours"]
        profile.recent_amounts = data["recent_amounts"]
        profile.recent_timestamps = data["recent_timestamps"]
        profile.recent_merchants = data["recent_merchants"]
        profile.recent_countries = data["recent_countries"]
        profile.last_transaction_at = data["last_transaction_at"]
        profile.profile_version = data["profile_version"]
        return profile
