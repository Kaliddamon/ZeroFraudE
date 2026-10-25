"""
src/risk/fusion.py
==================
Risk Fusion Engine: combina fraud_probability, anomaly_score y
behavioral_deviation en un risk_score final y lo clasifica en niveles.

Estrategia v3.1.1 (Híbrida con señal de escalada separada):
- risk_score = ponderado de fraud_probability, anomaly_score y behavioral_deviation
  según los pesos configurados (por defecto 1.00/0.00/0.00 => risk_score = fraud_probability).
- anomaly_score NO se suma a risk_score para evitar doble contabilización
  con fraud_probability (correlación 0.458).
- anomaly_score se usa como señal separada de escalada (anomaly_alert):
  anomaly_alert = True si anomaly_score >= anomaly_alert_threshold.
  Es una señal informativa para revisión manual, independiente de risk_level.
  No implica que la transacción sea fraude.

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
    Combina las señales del pipeline en un risk_score ∈ [0, 1]
    y lo clasifica en LOW / MEDIUM / HIGH / CRITICAL.

    Además expone anomaly_alert como señal separada de escalada
    (no forma parte de risk_score).

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
        anomaly_alert_threshold: float = 0.70,
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
        self.anomaly_alert_threshold = anomaly_alert_threshold

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

        Con los pesos de producción (1.00/0.00/0.00), risk_score == fraud_probability.

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

    def compute_anomaly_alert(self, anomaly_score: float) -> bool:
        """
        Determina si anomaly_score justifica una alerta de escalada.

        Esta señal es SEPARADA de risk_score y risk_level. Un anomaly_alert=True
        sugiere revisión manual pero no implica que la transacción sea fraude.

        Parameters
        ----------
        anomaly_score : float ∈ [0, 1]

        Returns
        -------
        bool
            True si anomaly_score >= anomaly_alert_threshold.
        """
        anomaly_score = float(max(0.0, min(1.0, anomaly_score)))
        return anomaly_score >= self.anomaly_alert_threshold

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
        Método conveniente que calcula score, clasificación y anomaly_alert.

        Returns
        -------
        dict
            {"risk_score": float, "risk_level": RiskLevel, "anomaly_alert": bool}
        """
        score = self.compute_risk_score(
            fraud_probability, anomaly_score, behavioral_deviation, is_cold_start
        )
        level = self.classify_risk(score)
        anomaly_alert = self.compute_anomaly_alert(anomaly_score)
        return {
            "risk_score": score,
            "risk_level": level,
            "anomaly_alert": anomaly_alert,
        }

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
            anomaly_alert_threshold=config.risk_fusion.anomaly_alert_threshold,
        )
