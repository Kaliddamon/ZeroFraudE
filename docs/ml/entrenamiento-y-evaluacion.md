# Subsistema ML — Entrenamiento y evaluación

## 1. Script de entrenamiento (`train.py`)

`fraud_detection_ml/train.py` ejecuta el pipeline completo en 16 etapas (ver comentarios del archivo):

1. Carga de datos (CSV)
2. División temporal train/val/test
3. Features transaccionales (training)
4. Velocity features (training)
5. Velocity features val/test con historial de training
6. Behavioral profiling solo en training
7. Behavioral features val/test con profiler entrenado
8. Extraer `behavioral_deviation` antes de filtrar columnas
9. Eliminar columna timestamp
10. Imputación (fit en training)
11. Encoding target (fit en training con `y_train`)
12. Matriz de features (solo `MODEL_FEATURES`)
13. Baseline Regresión Logística
14. Modelo principal LightGBM
15. Isolation Forest (solo legítimos, sin target-encoded)
16. Evaluación en Validation con umbrales configurados
17. Guardado de artefactos y perfiles

### Hiperparámetros del modelo

Según `configs/pipeline.yaml` (líneas 56-68):

| Parámetro | Valor |
|---|---|
| `n_estimators` | 500 |
| `learning_rate` | 0.05 |
| `num_leaves` | 24 |
| `min_child_samples` | 30 |
| `colsample_bytree` | 0.8 |
| `early_stopping_rounds` | 50 |
| `scale_pos_weight_mode` | "sqrt" |
| `subsample` | 0.8 |
| `subsample_freq` | 1 |
| `reg_alpha` | 0.1 |
| `reg_lambda` | 1.0 |
| `max_depth` | 6 |
| `random_state` | 42 |

`scale_pos_weight` se calcula como `sqrt(n_neg / n_pos)` cuando `scale_pos_weight_mode="sqrt"` (`src/models/lgbm_model.py` L92-93).

### Métrica de optimización en entrenamiento

LightGBM usa `eval_metric="average_precision"` (PR-AUC) con early stopping sobre el validation set (`train.py` L122-129).

## 2. Evaluación

### Métricas implementadas

`fraud_detection_ml/src/evaluation/metrics.py` implementa:

- **PR-AUC** (`average_precision_score`) — métrica principal para clases desbalanceadas
- **ROC-AUC** — para comparación con literatura, no para selección
- **F1, Precisión, Recall** — en el umbral de decisión
- **FPR, FNR** — tasas de error
- **Matriz de confusión** (TP, FP, TN, FN)
- **Costo total** = FP × cost_FP + FN × cost_FN (cost_FP=5.0, cost_FN=150.0, ver `configs/pipeline.yaml` L77-79)

### `find_optimal_threshold()`

Encuentra el umbral óptimo minimizando costo, maximizando F1 o F2 sobre `precision_recall_curve` (`src/evaluation/metrics.py` L104-160).

**Nota importante (skill ml-pipeline-validation, punto 3):** El constructor por defecto de `RiskFusionEngine()` usa `threshold_critical=0.85`, `threshold_high=0.65`, `threshold_medium=0.40`, mientras que la configuración de producción cargada por `from_config()` lee `configs/thresholds.json` (valores actuales: 0.50/0.25/0.05). Los documentos y pruebas deben distinguir claramente entre valores por defecto del constructor y valores de producción.

## 3. Artefactos generados

En `fraud_detection_ml/artifacts/<version>/`:

| Archivo | Descripción |
|---|---|
| `fraud_model.joblib` | Modelo LightGBM serializado (+ feature_names) |
| `anomaly_model.joblib` | Isolation Forest + rango de normalización |
| `behavior_profiles.pkl` | Perfiles de usuario + perfil global (pickle) |
| `encoder.joblib` | Target encoder (ajustado en training) |
| `imputer.joblib` | Imputador (ajustado en training) |
| `feature_config.json` | Lista ordenada de `MODEL_FEATURES` |
| `thresholds.json` | Umbrales de riesgo y anomaly_alert_threshold |
| `metrics.json` | Métricas del modelo |

### Versiones de artefactos existentes

`fraud_detection_ml/artifacts/` contiene: `1.0.0/`, `1.1.0/`, `2.0.0/`, `3.0.0/`, `v1.0.0/`.

La versión desplegada actual es `3.0.0/` con configuración v3.1.1.

### Estado de `artifacts/3.0.0/metrics.json`

```json
{
  "pr_auc": 0.8061,
  "roc_auc": 0.9216,
  "f1": 0.4609,
  "precision": 0.3133,
  "recall": 0.8717,
  "threshold_used": 0.1474,
  "n_samples": 7659,
  "n_fraud": 382,
  "fraud_rate": 0.0499
}
```

**Inconsistencia detectada:** `threshold_used=0.1474` corresponde al criterio de coste puro antiguo (v3.1.0), no a los umbrales actuales de `configs/thresholds.json` (0.50/0.25/0.05, v3.1.1). Este archivo está estalo. Véase `docs/limitaciones-y-pendientes.md`.

## 4. Métricas reportadas (según informes, no reejecutadas)

Según `INFORME_ROBUSTEZ_V311.md` y `INFORME_MEJORA_SENALES_AUXILIARES_V311.md` (verificación matemática mostrada en los informes):

### Test Set independiente (7,659 filas, nunca usado para tuning)

| Métrica | Valor (arquitectura v3.1.1) |
|---|---|
| PR-AUC | 0.7860 |
| ROC-AUC | 0.9372 |
| Brier score | 0.0209 |
| F1 | 0.756 |
| Precisión | 0.861 |
| Recall | 0.674 |
| FPR (en CRITICAL) | 0.0064 |
| FNR (en CRITICAL) | 0.3262 |
| Coste total | $20,930 |
| TP / FP / FN / TN | 285 / 46 / 138 / 7190 |
| % legítimos en CRITICAL | 0.6% |
| % fraudes en CRITICAL | 67.4% |

Estas cifras provienen de los informes del proyecto y fueron verificadas matemáticamente dentro de los mismos informes (por ejemplo, FPR = 46/(46+7190) = 0.0064). **No se reejecutaron en esta sesión** (requiere instalar dependencias y ejecutar `evaluate.py`).

### Validación (usado para selección de umbrales)

| Señal | PR-AUC | ROC-AUC | Brier |
|---|---|---|---|
| `fraud_probability` (solo) | 0.8112 | 0.9565 | 0.0180 |
| `anomaly_score` (IF mejorado) | 0.5101 | 0.8979 | — |
| `behavioral_deviation` | 0.3974 | 0.7281 | — |

## 5. Baseline de comparación

Regresión Logística entrenada con las mismas features que LightGBM para comparación justa (`ml_pipeline_design.md` sección 8, `train.py` L191-202):

- LightGBM PR-AUC validación: 0.8061 vs baseline 0.7606 → LightGBM supera el piso (según `INFORME_CIERRE_V310.md`).

## 6. Reproducibilidad del entrenamiento

- Seed global = 42 (`configs/pipeline.yaml` L7, aplicado en `train.py` L70).
- `requirements.txt` con versiones mínimas (no pines exactos).
- Para reproducir: `python train.py --data data/raw/synthetic_transactions.csv --version 1.0.0` (requiere el dataset CSV que no está versionado).
