"""
src/risk/fusion.py
==================
Risk Fusion Engine: combina fraud_probability, anomaly_score y
behavioral_deviation en un risk_score final y lo clasifica en niveles.

Estrategia: Weighted Average con pesos diferenciados para cold start.
Los pesos y thresholds son configurables sin reentrenar el modelo.

Jerarquía de señales:
    fraud_probability > anomaly_score > behavioral_deviation

Razón: fraud_probability está directamente entrenada sobre el objetivo.
Las otras dos señales son complementarias, no primarias.
"""

from __future__ import annotations

from typing import List, Literal

RiskLevel = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]


class RiskFusionEngine:
    """
    Combina las tres señales del pipeline en un risk_score ∈ [0, 1]
    y lo clasifica en LOW / MEDIUM / HIGH / CRITICAL.

    Los pesos y thresholds se cargan desde la configuración y pueden
    modificarse sin reentrenar ningún modelo.
    """

    def __init__(
        self,
        w_fraud: float = 0.60,
        w_anomaly: float = 0.25,
        w_behavioral: float = 0.15,
        w_fraud_cold: float = 0.70,
        w_anomaly_cold: float = 0.30,
        w_behavioral_cold: float = 0.00,
        threshold_critical: float = 0.85,
        threshold_high: float = 0.65,
        threshold_medium: float = 0.40,
    ) -> None:
        self.w_fraud = w_fraud
        self.w_anomaly = w_anomaly
        self.w_behavioral = w_behavioral
        self.w_fraud_cold = w_fraud_cold
        self.w_anomaly_cold = w_anomaly_cold
        self.w_behavioral_cold = w_behavioral_cold
        self.threshold_critical = threshold_critical
        self.threshold_high = threshold_high
        self.threshold_medium = threshold_medium

        # Validación de pesos
        self._validate_weights()

    def _validate_weights(self) -> None:
        tol = 1e-6
        if abs(self.w_fraud + self.w_anomaly + self.w_behavioral - 1.0) > tol:
            raise ValueError(
                f"Los pesos base deben sumar 1.0. "
                f"Actual: {self.w_fraud + self.w_anomaly + self.w_behavioral:.4f}"
            )
        if abs(self.w_fraud_cold + self.w_anomaly_cold + self.w_behavioral_cold - 1.0) > tol:
            raise ValueError(
                f"Los pesos cold start deben sumar 1.0. "
                f"Actual: {self.w_fraud_cold + self.w_anomaly_cold + self.w_behavioral_cold:.4f}"
            )

    def compute_risk_score(
        self,
        fraud_probability: float,
        anomaly_score: float,
        behavioral_deviation: float,
        is_cold_start: bool = False,
    ) -> float:
        """
        Calcula el risk_score ponderado.

        Parameters
        ----------
        fraud_probability   : float ∈ [0, 1], salida del modelo LightGBM.
        anomaly_score       : float ∈ [0, 1], salida normalizada del Isolation Forest.
        behavioral_deviation: float ∈ [0, 1], desviación del perfil del usuario.
        is_cold_start       : bool, si True usa pesos de cold start.

        Returns
        -------
        float
            risk_score ∈ [0, 1] redondeado a 4 decimales.
        """
        # Validar rangos de entrada
        fraud_probability = float(max(0.0, min(1.0, fraud_probability)))
        anomaly_score = float(max(0.0, min(1.0, anomaly_score)))
        behavioral_deviation = float(max(0.0, min(1.0, behavioral_deviation)))

        if is_cold_start:
            w_f, w_a, w_b = self.w_fraud_cold, self.w_anomaly_cold, self.w_behavioral_cold
        else:
            w_f, w_a, w_b = self.w_fraud, self.w_anomaly, self.w_behavioral

        risk_score = (
            w_f * fraud_probability
            + w_a * anomaly_score
            + w_b * behavioral_deviation
        )

        return round(float(max(0.0, min(1.0, risk_score))), 4)

    def classify_risk(self, risk_score: float) -> RiskLevel:
        """
        Clasifica el risk_score en un nivel de riesgo.

        Parameters
        ----------
        risk_score : float ∈ [0, 1]

        Returns
        -------
        RiskLevel
            "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
        """
        if risk_score >= self.threshold_critical:
            return "CRITICAL"
        elif risk_score >= self.threshold_high:
            return "HIGH"
        elif risk_score >= self.threshold_medium:
            return "MEDIUM"
        else:
            return "LOW"

    def evaluate(
        self,
        fraud_probability: float,
        anomaly_score: float,
        behavioral_deviation: float,
        is_cold_start: bool = False,
    ) -> dict:
        """
        Método conveniente que calcula score Y clasificación en un solo paso.

        Returns
        -------
        dict
            {"risk_score": float, "risk_level": RiskLevel}
        """
        score = self.compute_risk_score(
            fraud_probability, anomaly_score, behavioral_deviation, is_cold_start
        )
        level = self.classify_risk(score)
        return {"risk_score": score, "risk_level": level}

    @classmethod
    def from_config(cls, config) -> "RiskFusionEngine":
        """
        Construye el engine desde el objeto PipelineConfig.

        Parameters
        ----------
        config : PipelineConfig
            Objeto de configuración cargado por src/config.py.
        """
        return cls(
            w_fraud=config.risk_fusion.weights.fraud_probability,
            w_anomaly=config.risk_fusion.weights.anomaly_score,
            w_behavioral=config.risk_fusion.weights.behavioral_deviation,
            w_fraud_cold=config.risk_fusion.cold_start_weights.fraud_probability,
            w_anomaly_cold=config.risk_fusion.cold_start_weights.anomaly_score,
            w_behavioral_cold=config.risk_fusion.cold_start_weights.behavioral_deviation,
            threshold_critical=config.thresholds.critical,
            threshold_high=config.thresholds.high,
            threshold_medium=config.thresholds.medium,
        )
