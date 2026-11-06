# ADR-002: Umbrales operativos de riesgo (v3.1.1)

## Estado

**Aceptada** — reflejada en `configs/thresholds.json` y `artifacts/3.0.0/thresholds.json`.

## Contexto

El umbral crítico original (0.1474, criterio de coste puro `FP×5 + FN×150`) clasificaba el 10% de transacciones legítimas como CRITICAL, haciendo inútiles las bandas MEDIUM/HIGH. Se necesitaba un esquema de umbrales con significado operativo claro y que preservara la separación entre bandas.

## Decisión

Umbrales operativos sobre `risk_score` (= `fraud_probability` en v3.1.1), seleccionados exclusivamente sobre Validation Set (no sobre Test Set):

| Nivel | Umbral | Justificación operativa |
|---|---|---|
| MEDIUM | 0.05 | Por encima del p95 de legítimos (0.0460) — captura lo inusual sin ser excesivo |
| HIGH | 0.25 | Entre p95 de legítimos (0.0460) y p25 de fraudes (0.3114) |
| CRITICAL | 0.50 | Probabilidad ≥ 50% de fraude — decisión operativa clara |
| anomaly_alert | 0.70 | `anomaly_score >= 0.70` → señal separada de revisión manual |

Las comparaciones en `classify_risk()` son `>=` en orden CRITICAL → HIGH → MEDIUM → LOW (límites inclusivos).

## Justificación

- Los umbrales no se derivan de porcentajes fijos del umbral crítico; tienen significado de negocio independiente.
- Seleccionados sobre Validation Set con criterio operativo (`INFORME_AJUSTE_RIESGO_V310.md` sección 5, `INFORME_ROBUSTEZ_V311.md` sección 5).
- Test Set independiente nunca se usó para elegir umbrales (`INFORME_ROBUSTEZ_V311.md` sección 6).
- En Test Set: 0.6% de legítimos en CRITICAL, 67.4% de fraudes en CRITICAL, coste $20,930.

## Archivos afectados

- `fraud_detection_ml/configs/thresholds.json` — versión 3.1.1
- `fraud_detection_ml/artifacts/3.0.0/thresholds.json` — idéntico (consistencia de despliegue)
- `fraud_detection_ml/src/risk/fusion.py` — `threshold_critical`, `threshold_high`, `threshold_medium` cargados desde config
- `fraud_detection_ml/train.py` — evalúa con umbrales configurados, no los sobrescribe

## Inconsistencia conocida

`INFORME_CIERRE_V310.md` reporta umbrales F2 alternativos (critical=0.3012, high=0.2259, medium=0.1416) que **no coinciden** con la configuración actual. Ese informe representa un estado intermedio (v3.1.0) supersedido por v3.1.1. La fuente de verdad es `configs/thresholds.json` y `artifacts/3.0.0/thresholds.json`.

## Vigencia

Vigente para artefactos 3.0.0 y configuración v3.1.1. Los umbrales pueden ajustarse editando `thresholds.json` y reiniciando el servicio ML, sin reentrenar el modelo.
