"""
src/explainability/shap_explainer.py
=====================================
Módulo de explainability basado en SHAP TreeExplainer.

Para LightGBM, SHAP usa TreeExplainer que produce valores exactos de Shapley
en tiempo polinomial. Es el método más fundamentado matemáticamente.

Solo se activa para transacciones HIGH y CRITICAL (por eficiencia).
Para LOW y MEDIUM se usa feature importance global como fallback rápido.

Salida: lista de strings en inglés, listos para consumir en el Frontend.
"""

from __future__ import annotations

from typing import Dict, List, Optional

import numpy as np
import pandas as pd

# SHAP es una dependencia de extensión; protegemos la importación
try:
    import shap
    SHAP_AVAILABLE = True
except ImportError:
    SHAP_AVAILABLE = False


# Plantillas de explicaciones en lenguaje natural
# Clave: nombre de la feature → plantilla con placeholders
EXPLANATION_TEMPLATES: Dict[str, str] = {
    "amount_z_score": "Amount {multiplier:.1f}× above user average",
    "amount_log": "Unusually high transaction amount",
    "is_new_device": "First transaction from this device",
    "is_new_country": "Country not in user's recent history",
    "is_new_merchant": "Merchant not in user's transaction history",
    "tx_count_5min": "{value:.0f} transactions in the last 5 minutes",
    "tx_count_1h": "{value:.0f} transactions in the last hour",
    "tx_count_24h": "{value:.0f} transactions in the last 24 hours",
    "amount_sum_1h": "High cumulative amount in the last hour (${value:.2f})",
    "unique_countries_24h": "{value:.0f} different countries in the last 24 hours",
    "unique_merchants_24h": "{value:.0f} different merchants in the last 24 hours",
    "is_night": "Transaction at unusual nighttime hour",
    "is_weekend": "Weekend transaction outside typical pattern",
    "is_duplicate_candidate": "Possible duplicate transaction detected",
    "days_since_last_tx": "Long period of inactivity before this transaction",
    "behavioral_deviation": "Transaction deviates significantly from user's normal behavior",
    "merchant_target_enc": "High-risk merchant category",
    "device_target_enc": "Device associated with previous suspicious activity",
}


class FraudExplainer:
    """
    Generador de explicaciones en lenguaje natural para predicciones de fraude.

    Dos modos de operación:
    1. SHAP (Extensión): valores exactos por instancia si SHAP está disponible.
    2. Feature Importance global: fallback rápido usando importancias del modelo.
    """

    def __init__(self, model, feature_names: List[str]) -> None:
        """
        Parameters
        ----------
        model        : Modelo LightGBM entrenado (instancia de LightGBMFraudModel).
        feature_names: Lista de features en el mismo orden que el modelo espera.
        """
        self._model = model
        self._feature_names = feature_names
        self._shap_explainer = None
        self._global_importance: Optional[np.ndarray] = None

        # Precalcular importancias globales como fallback
        if hasattr(model, "feature_importances") and model.feature_importances is not None:
            self._global_importance = model.feature_importances

        # Inicializar SHAP si está disponible
        if SHAP_AVAILABLE:
            try:
                lgbm_booster = model._model  # LGBMClassifier sklearn wrapper
                self._shap_explainer = shap.TreeExplainer(lgbm_booster)
            except Exception:
                self._shap_explainer = None

    def explain(
        self,
        X_instance: pd.DataFrame,
        risk_level: str,
        feature_values: Optional[dict] = None,
        top_k: int = 3,
    ) -> List[str]:
        """
        Genera las explicaciones para UNA transacción.

        Parameters
        ----------
        X_instance    : DataFrame de 1 fila con las features del modelo.
        risk_level    : Nivel de riesgo calculado ("LOW", "MEDIUM", "HIGH", "CRITICAL").
        feature_values: Dict con los valores originales de algunas features
                        (ej. amount_z_score, tx_count_5min) para las plantillas.
        top_k         : Número máximo de explicaciones a retornar.

        Returns
        -------
        List[str]
            Lista de 1 a top_k strings en inglés.
        """
        feature_values = feature_values or {}

        # Para HIGH y CRITICAL usar SHAP (más preciso por instancia)
        if risk_level in ("HIGH", "CRITICAL") and self._shap_explainer is not None:
            try:
                return self._explain_with_shap(X_instance, feature_values, top_k)
            except Exception:
                pass  # Fallback a global importance si SHAP falla

        # Para LOW, MEDIUM o si SHAP no está disponible: global importance
        return self._explain_with_global_importance(X_instance, feature_values, top_k)

    def _explain_with_shap(
        self,
        X_instance: pd.DataFrame,
        feature_values: dict,
        top_k: int,
    ) -> List[str]:
        """Genera explicaciones usando SHAP TreeExplainer."""
        shap_values = self._shap_explainer.shap_values(X_instance)

        # Para clasificadores binarios, shap_values puede ser una lista [neg, pos]
        if isinstance(shap_values, list):
            shap_vals = shap_values[1][0]  # Valores para la clase positiva
        else:
            shap_vals = shap_values[0]

        # Ordenar features por |SHAP value| descendente
        sorted_indices = np.argsort(np.abs(shap_vals))[::-1]

        explanations = []
        for idx in sorted_indices:
            if len(explanations) >= top_k:
                break
            feature_name = self._feature_names[idx]
            shap_val = shap_vals[idx]
            # Solo incluir si el SHAP value indica contribución positiva al riesgo
            if shap_val > 0:
                explanation = self._format_explanation(
                    feature_name,
                    float(X_instance.iloc[0][feature_name]) if feature_name in X_instance.columns else 0.0,
                    feature_values,
                )
                if explanation:
                    explanations.append(explanation)

        return explanations if explanations else ["Unusual transaction pattern detected"]

    def _explain_with_global_importance(
        self,
        X_instance: pd.DataFrame,
        feature_values: dict,
        top_k: int,
    ) -> List[str]:
        """Genera explicaciones usando feature importance global del modelo."""
        if self._global_importance is None:
            return ["Risk pattern detected based on transaction features"]

        # Ponderar importancia global por el valor de la feature en esta instancia
        # (solo features con valor != 0 son activas)
        instance_vals = X_instance.iloc[0].values
        # Score = importancia * |valor| (features activas con mayor importancia global)
        active_scores = np.abs(instance_vals) * self._global_importance

        sorted_indices = np.argsort(active_scores)[::-1]

        explanations = []
        for idx in sorted_indices:
            if len(explanations) >= top_k:
                break
            if active_scores[idx] < 1e-6:
                continue
            feature_name = self._feature_names[idx]
            explanation = self._format_explanation(
                feature_name,
                float(instance_vals[idx]),
                feature_values,
            )
            if explanation:
                explanations.append(explanation)

        return explanations if explanations else ["Risk factors identified in transaction"]

    def _format_explanation(
        self,
        feature_name: str,
        feature_value: float,
        extra_values: dict,
    ) -> Optional[str]:
        """Formatea una feature en lenguaje natural usando la plantilla."""
        template = EXPLANATION_TEMPLATES.get(feature_name)
        if not template:
            return None

        try:
            # Extraer valores específicos para placeholders
            if "{multiplier" in template:
                # Para amount_z_score: convertir z-score a multiplicador.
                # Solo retornar si el importe está realmente por encima del
                # promedio del usuario (multiplicador > 1.0). Un ratio < 1.0 no
                # puede describirse como "above user average".
                z = extra_values.get("amount_z_score", feature_value)
                avg = extra_values.get("user_avg_amount_30d", 1.0)
                amount = extra_values.get("amount", 0.0)
                is_cold_start = extra_values.get("is_cold_start", False)
                multiplier = amount / (avg + 1e-6) if avg > 0 else abs(z)
                if multiplier <= 1.0 or is_cold_start:
                    return None
                return template.format(multiplier=multiplier)
            elif "{value" in template:
                return template.format(value=feature_value)
            else:
                # Template sin placeholders: solo retornar si la feature está activa con evidencia real
                if feature_name == "amount_log":
                    # Solo marcar como importe alto si supera el promedio del usuario
                    # o tiene z-score elevado. En cold start no hay referencia real
                    # de usuario, por lo que se omite.
                    ratio = extra_values.get("amount_ratio_to_avg", 1.0)
                    z = extra_values.get("amount_z_score", 0.0)
                    is_cold_start = extra_values.get("is_cold_start", False)
                    if is_cold_start or (ratio <= 2.0 and abs(z) <= 2.0):
                        return None
                    return template
                elif feature_name in (
                    "is_new_device", "is_new_country", "is_new_merchant",
                    "is_night", "is_duplicate_candidate"
                ):
                    # Flags binarios: solo retornar si el flag está realmente activado (valor > 0.5)
                    if feature_value > 0.5:
                        return template
                elif abs(feature_value) > 0.1:
                    return template
        except Exception:
            return None

        return None
