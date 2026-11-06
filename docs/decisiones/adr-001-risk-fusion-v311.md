# ADR-001: Arquitectura de Risk Fusion v3.1.1

## Estado

**Aceptada** — reflejada en `configs/risk_fusion.yaml` y `configs/thresholds.json` (versión 3.1.1).

## Contexto

El diseño original (`ml_pipeline_design.md` sección 10) proponía una fusión ponderada de tres señales:

```
risk_score = 0.60 × fraud_probability + 0.25 × anomaly_score + 0.15 × behavioral_deviation
```

Con umbrales críticos alrededor de 0.85/0.65/0.40 (valores por defecto del constructor `RiskFusionEngine()`).

Durante el desarrollo se detectó que esta fusión empujaba transacciones legítimas a bandas altas de riesgo. En particular, un caso legítimo con `fraud_probability=0.1616` se clasificaba como CRITICAL porque el umbral crítico era 0.1474 (criterio de coste puro), colapsando el 10% de legítimos en CRITICAL.

## Decisión

Se adoptó la **arquitectura híbrida v3.1.1**:

1. `risk_score = fraud_probability` (pesos 1.00/0.00/0.00). `fraud_probability` está bien calibrada (Brier=0.0180, PR-AUC=0.8112 en validación).
2. `anomaly_score` NO se suma a `risk_score` (evita doble contabilización; correlación 0.458 con `fraud_probability`). Se usa como **señal separada** `anomaly_alert` con umbral 0.70, para revisión manual. No implica fraude.
3. `behavioral_deviation` no se usa en `risk_score` (ROC-AUC=0.5000 en validación, sin valor predictivo incremental para la decisión).
4. Umbrales operativos seleccionados sobre Validation Set: `medium=0.05`, `high=0.25`, `critical=0.50`.
5. Pesos de cold start: `0.85 × fraud_probability + 0.15 × anomaly_score + 0.00 × behavioral_deviation`.

## Justificación

- `fraud_probability` tiene la mejor PR-AUC (0.8112) y mejor Brier (0.0180) de las señales individuales (ver `INFORME_AJUSTE_RIESGO_V310.md` sección 3, `INFORME_ROBUSTEZ_V311.md` sección 3).
- La fusión aprendida (regresión logística sobre las 3 señales) tenía menor coste en validación pero marcaba el 8.6% de legítimos como CRITICAL — inaceptable sin justificación de negocio (`INFORME_ROBUSTEZ_V311.md` sección 3).
- En Test Set independiente, la arquitectura v3.1.1 mejora coste ($20,930 vs $24,130), PR-AUC (0.7860 vs 0.7778), Brier (0.0209 vs 0.0261) y captura de fraudes en CRITICAL (67.4% vs 62.2%), con solo 0.6% de legítimos en CRITICAL.

## Consecuencias

- **Positivas:** Simplicidad, `risk_score` directamente interpretable como probabilidad de fraude, menos falsos positivos en CRITICAL, umbrales ajustables sin reentrenar (`thresholds.json`).
- **Negativas:** `anomaly_alert` genera falsos positivos de revisión (13.2% en Test Set); `behavioral_deviation` no se aprovecha en la decisión a pesar de tener PR-AUC=0.3974; `anomaly_score` detecta solo 5.4% de fraudes que LightGBM pasa por alto con fp<0.25.

## Archivos afectados

- `fraud_detection_ml/configs/risk_fusion.yaml` — pesos 1.00/0.00/0.00, `anomaly_alert_threshold: 0.70`
- `fraud_detection_ml/configs/thresholds.json` — versión 3.1.1, critical=0.50, high=0.25, medium=0.05
- `fraud_detection_ml/src/risk/fusion.py` — `compute_anomaly_alert()`, `anomaly_alert` en `evaluate()`
- `fraud_detection_ml/src/inference/service.py` — incluye `anomaly_alert` en `PredictionOutput`
- `fraud_detection_ml/src/validation/schemas.py` — campo `anomaly_alert: bool`
- `fraud_detection_ml/artifacts/3.0.0/thresholds.json` — idéntico a configs
- `fraud_detection_ml/train.py` — ya no auto-tunea ni sobrescribe umbrales
- `fraud_detection_ml/tests/unit/test_risk_fusion.py` — pruebas de la nueva configuración
- `fraud_detection_ml/tests/integration/test_normal_transaction.py` — pruebas de regresión

## Alternativas consideradas y descartadas

| Alternativa | Motivo de descarte |
|---|---|
| Fusión 0.60/0.25/0.15 (diseño original) | Empuja legítimos a bandas altas; umbral crítico 0.1474 colapsa el 10% de legítimos en CRITICAL |
| Recalibración de probabilidades (Platt/Isotonic) | `fraud_probability` ya está bien calibrada (9 de 10 bins alineados); no justifica complejidad |
| Fusión aprendida (regresión logística) | Menor coste en validación pero 8.6% de legítimos en CRITICAL; sobreajuste a validación |
| Reentrenar LightGBM | No hay evidencia de que mejore significativamente; el problema era de umbrales/fusión, no del modelo |

## Vigencia

Esta decisión está vigente para la versión de artefactos 3.0.0 y configuración v3.1.1. Cualquier cambio de umbrales debe documentarse actualizando `configs/thresholds.json` y este ADR.
