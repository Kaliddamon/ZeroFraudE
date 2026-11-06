# Subsistema ML — Inferencia y scoring

## 1. Punto de entrada de inferencia

La clase `FraudDetectionService` en `fraud_detection_ml/src/inference/service.py` expone el método `predict(transaction: TransactionInput) -> PredictionOutput`. Es el único punto de entrada externo.

El servicio se carga con `FraudDetectionService.load(version="1.1.0")` por defecto, pero `fraud_detection_ml/src/inference/app.py` (línea 179) carga `version="3.0.0"` al iniciar el servidor FastAPI. Véase discrepancia de versiones en `docs/limitaciones-y-pendientes.md`.

### Endpoints HTTP del ML Service (`app.py`)

| Endpoint | Método | Descripción |
|---|---|---|
| `/predict` | POST | Inferencia completa. Input: `TransactionInput`, Output: `PredictionOutput` o `ErrorOutput` |
| `/health` | GET | Estado del servicio (healthy/degraded, model_loaded) |
| `/model-info` | GET | Versión del modelo y estado |
| `/metrics` | GET | Contadores en vivo: requests, risk_level distribution, latencia p50/p95 |

## 2. Pipeline de inferencia (pasos dentro de `predict()`)

Según `service.py` líneas 128-284, el pipeline ejecuta:

1. **Behavioral profiler lookup** — `get_behavioral_features()` calcula desviación y flag cold start.
2. **Velocity features** — `compute_velocity_for_inference()` desde historial reciente del perfil.
3. **Ensamblado del feature vector** — `build_feature_vector_inference()` con `MODEL_FEATURES` en orden canónico.
4. **LightGBM** — `predict_proba(X)[0]` → `fraud_probability`.
5. **Isolation Forest** — `score_single(X_if)` → `anomaly_score` (23 features, sin target-encoded + behavioral_deviation).
6. **Risk Fusion** — `RiskFusionEngine.evaluate()` → `risk_score`, `risk_level`, `anomaly_alert`.
7. **Explainability** — `FraudExplainer.explain()` → `explanations` (lista de strings).
8. **Actualización del perfil** — `update_profile()` solo si `risk_level ∈ {LOW, MEDIUM}` (protección contra envenenamiento).
9. **Retorno** — `PredictionOutput` validado por Pydantic.

## 3. Risk Fusion (arquitectura v3.1.1)

Implementado en `fraud_detection_ml/src/risk/fusion.py` y configurado en `configs/risk_fusion.yaml`.

### Fórmula

Con pesos de producción (1.00/0.00/0.00):

```
risk_score = 1.00 × fraud_probability + 0.00 × anomaly_score + 0.00 × behavioral_deviation
           = fraud_probability
```

Para cold start (pesos 0.85/0.15/0.00):

```
risk_score = 0.85 × fraud_probability + 0.15 × anomaly_score + 0.00 × behavioral_deviation
```

### Clasificación en niveles

Según `classify_risk()` (`fusion.py` L144-164), con umbrales de `configs/thresholds.json`:

| Nivel | Condición | Umbral (v3.1.1) |
|---|---|---|
| CRITICAL | risk_score >= critical | 0.50 |
| HIGH | risk_score >= high | 0.25 |
| MEDIUM | risk_score >= medium | 0.05 |
| LOW | risk_score < medium | — |

Las comparaciones son `>=` en orden CRITICAL → HIGH → MEDIUM → LOW (límites inclusivos).

### Señal separada: anomaly_alert

`anomaly_score` NO se suma a `risk_score` (evita doble contabilización; correlación 0.458 con `fraud_probability`, ver `INFORME_AJUSTE_RIESGO_V310.md`). En su lugar:

```
anomaly_alert = (anomaly_score >= anomaly_alert_threshold)  // umbral 0.70
```

`anomaly_alert=True` justifica revisión manual pero **no implica que la transacción sea fraude** (ver `INFORME_ROBUSTEZ_V311.md` sección 4). Es independiente de `risk_level`.

## 4. Salida del contrato (`PredictionOutput`)

Definida en `fraud_detection_ml/src/validation/schemas.py` (clase `PredictionOutput`):

| Campo | Tipo | Rango | Descripción |
|---|---|---|---|
| `transaction_id` | str | — | Echo del input |
| `fraud_probability` | float | [0.0, 1.0] | Probabilidad de fraude (LightGBM) |
| `anomaly_score` | float | [0.0, 1.0] | Score de anomalía (Isolation Forest) |
| `behavioral_deviation` | float | [0.0, 1.0] | Desviación conductual normalizada |
| `risk_score` | float | [0.0, 1.0] | Score compuesto (= fraud_probability en v3.1.1) |
| `risk_level` | Literal | LOW/MEDIUM/HIGH/CRITICAL | Clasificación final |
| `explanations` | List[str] | 1-5 items | Factores en lenguaje natural |
| `model_version` | str | — | Versión semántica del modelo |
| `is_cold_start` | bool | — | Usuario sin historial suficiente |
| `anomaly_alert` | bool | — | Señal separada de escalada (umbral 0.70) |

## 5. Explainability

Implementado en `fraud_detection_ml/src/explainability/shap_explainer.py`:

- **SHAP TreeExplainer** para transacciones HIGH/CRITICAL (valores exactos de Shapley por instancia).
- **Fallback a feature importance global** para LOW/MEDIUM o si SHAP no está disponible (`shap` es dependencia opcional, try/except ImportError).
- Traducción a lenguaje natural mediante plantillas (`EXPLANATION_TEMPLATES`).
- Máximo 3 explicaciones por predicción (`top_k=3` en `service.py` L251).
- Fallback explanations (`_generate_fallback_explanations`) que evitan afirmaciones falsas en cold start (ver `INFORME_CIERRE_V310.md` L20).

## 6. Estado del usuario (cold start)

Según `configs/pipeline.yaml` L20: `cold_start_min_transactions: 5`.

- Usuario con < 5 transacciones → cold start, usa perfil global.
- En cold start: `behavioral_deviation=0.0`, flags `is_new_*`=0.0 (no hay evidencia de inexistencia).
- `is_cold_start=true` en el output permite al backend/frontend ajustar la comunicación.

## 7. Contrato de salida consumido por el backend

El backend mapea `PredictionOutput` a `MLPredictionResult` (`fraud-detection-backend/src/main/java/com/frauddetection/ml/dto/MLPredictionResult.java`) con `@JsonProperty` en snake_case. El adaptador `MLInferenceAdapter` valida que todos los campos requeridos estén presentes, scores en [0,1], `risk_level` válido, `explanations` no vacía y `model_version` presente (`MLInferenceAdapter.java` L101-130).
