# Subsistema ML — Datos y features

> **Fuente principal:** `ml_pipeline_design.md` (diseño) + código fuente de `fraud_detection_ml/src/` + configuración en `fraud_detection_ml/configs/`.

## 1. Procedencia y características del dataset

El pipeline está diseñado para consumir un dataset tabular de transacciones e-commerce con las siguientes columnas requeridas (ver `train.py` líneas 89-93):

```
transaction_id, user_id, amount, timestamp, country, device_id, merchant_id, is_fraud
```

- `is_fraud` ∈ {0, 1} es la variable objetivo binaria.
- El dataset debe estar en `data/raw/` (por defecto `synthetic_transactions.csv`, ver `train.py` línea 63-65).
- **Limitación:** `data/raw/` no está versionado en el repositorio (ignorado por `.gitignore` del ML). No hay dataset crudo disponible en el repo para reproducir el entrenamiento desde cero sin obtenerlo externamente. Véase `docs/limitaciones-y-pendientes.md`.

Según los informes del proyecto, el dataset tiene aproximadamente 7,659 filas con una tasa de fraude del ~5% (ver `artifacts/3.0.0/metrics.json` línea 18: `fraud_rate=0.04987...`, `n_fraud=382`). Esta cifra proviene de los artefactos almacenados y no se reejecutó en esta sesión.

## 2. Esquema de datos de entrada (contrato de inferencia)

El contrato de entrada del ML Service está definido en `fraud_detection_ml/src/validation/schemas.py` (clase `TransactionInput`, Pydantic v2):

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `transaction_id` | str | min_length=1, max_length=100 | ID único generado por el backend |
| `user_id` | str | min_length=1, max_length=100 | ID del usuario del e-commerce |
| `amount` | float | gt=0, le=1_000_000 | Monto positivo |
| `timestamp` | datetime | ISO 8601 con timezone; no futuro (>5 min tolerance) | Momento de la transacción |
| `country` | str | min_length=2, max_length=3; mayúsculas | Código ISO 3166-1 |
| `device_id` | str | min_length=1, max_length=100 | ID del dispositivo |
| `merchant_id` | str | min_length=1, max_length=100 | ID del comercio |

El backend envía este payload como `MLInferenceRequest` (`fraud-detection-backend/src/main/java/com/frauddetection/ml/dto/MLInferenceRequest.java`) con anotaciones `@JsonProperty` en snake_case para coincidir exactamente con el schema Pydantic.

## 3. Preparación y preprocesamiento

El preprocesamiento se ejecuta en `train.py` con el siguiente orden (líneas 99-183):

1. **División temporal** (antes de cualquier transformación) — `temporal_train_val_test_split()` en `src/evaluation/temporal_split.py`.
2. **Features transaccionales** — `add_transaction_features()` sobre train/val/test.
3. **Velocity features** — `add_velocity_features_batch()` en train; `_compute_velocity_with_history()` para val/test usando solo historial de training.
4. **Behavioral profiling** — `BehavioralProfiler.fit_transform()` solo en training set.
5. **Imputación** — `FraudImputerTransformer.fit_transform()` en train, `.transform()` en val/test.
6. **Encoding** — `FraudEncoderTransformer.fit_transform(X_train, y_train)` (target encoding con smoothing=10.0, solo sobre training), `.transform()` en val/test.
7. **Selección de columnas del modelo** — `X_train[MODEL_FEATURES]` etc.

### Reglas de prevención de data leakage (verificadas en código)

| Regla | Implementación | Evidencia |
|---|---|---|
| Split temporal antes de cualquier transformación | `temporal_train_val_test_split()` ordena por timestamp y corta en percentiles 70/85 | `src/evaluation/temporal_split.py` L97-113 |
| Encoders ajustados solo en training | `encoder.fit_transform(X_train, split.y_train)` | `train.py` L163 |
| Imputer ajustado solo en training | `imputer.fit_transform(X_train)` | `train.py` L154 |
| Behavioral profiles construidos solo en training | `profiler.fit_transform(X_train)` | `train.py` L131 |
| Val/test usan profiler entrenado sin actualizar | `profiler.get_behavioral_features()` (lectura sola) | `train.py` L445-494 |
| Isolation Forest solo con legítimos (is_fraud=0) | `X_legit = X_train_for_iforest[split.y_train == 0]` | `train.py` L238 |
| IF excluye columnas target-encoded (fuga en no supervisado) | `iforest_features` excluye `country_encoded`, `merchant_target_enc`, `device_target_enc` | `train.py` L231-234, corregido en v3.1.1 |

## 4. Features del modelo

La lista canónica `MODEL_FEATURES` está en `fraud_detection_ml/src/features/feature_pipeline.py` líneas 34-65 (27 columnas):

### Transaccionales
| Feature | Descripción | Tipo |
|---|---|---|
| `amount_log` | log1p(amount) | Numérica |
| `hour_sin`, `hour_cos` | Codificación cíclica de hora | Numérica |
| `day_of_week` | 0=Lunes, 6=Domingo | Numérica |
| `is_weekend` | 1 si sábado o domingo | Binaria |
| `is_night` | 1 si hora ∈ [22, 6] | Binaria |
| `is_duplicate_candidate` | Duplicado candidato (0 en inferencia) | Binaria |

### Behavioral (perfil de usuario)
| Feature | Descripción |
|---|---|
| `user_avg_amount_30d` | Media EMA de montos del usuario |
| `user_std_amount_30d` | Desviación estándar EMA |
| `amount_z_score` | (amount - avg) / (std + ε) |
| `amount_ratio_to_avg` | amount / (avg + ε) |
| `is_new_device` | 1 si dispositivo no está en el perfil |
| `is_new_country` | 1 si país no está en el perfil |
| `is_new_merchant` | 1 si merchant no está en el perfil |
| `user_tx_count_30d` | Transacciones del usuario en 30 días |
| `days_since_last_tx` | Días desde última transacción |

### Velocity (ventanas deslizantes)
| Feature | Ventana |
|---|---|
| `tx_count_5min` | Últimos 5 minutos |
| `tx_count_1h` | Última hora |
| `tx_count_24h` | Últimas 24 horas |
| `amount_sum_1h` | Suma de montos en última hora |
| `unique_merchants_24h` | Merchants distintos en 24h |
| `unique_countries_24h` | Países distintos en 24h |

### Encodings
| Feature | Descripción |
|---|---|
| `country_encoded` | Ordinal encoding del país |
| `merchant_target_enc` | Target encoding del merchant (solo training) |
| `device_target_enc` | Target encoding del dispositivo (solo training) |

### Nota sobre inferencia real
En `fraud_detection_ml/src/inference/service.py` líneas 193-197, los encodings de categorías se establecen a 0.0 en inferencia real ("el modelo de árboles es robusto a esto para categorías nuevas"). Esto puede degradar calidad para categorías nunca vistas durante el entrenamiento.

## 5. Particiones de datos

La división es temporal y estricta (ver `src/evaluation/temporal_split.py`):

```
Pasado (~70%)      → Training set
Periodo medio (~15%) → Validation set (tuning de hiperparámetros y umbrales)
Periodo reciente (~15%) → Test set (evaluación final, nunca se toca hasta el final)
```

Los cortes se determinan por percentiles 70 y 85 del timestamp cuando `train_end_date`/`val_end_date` son `null` (ver `configs/pipeline.yaml` líneas 13-14). La fracción de fraude reportada en los artefactos es ~4.99% (ver `artifacts/3.0.0/metrics.json`).

El desbalance de clases se maneja con `scale_pos_weight_mode="sqrt"` en LightGBM (`src/models/lgbm_model.py` L92-93), no con SMOTE (SMOTE fue descartado explícitamente en `ml_pipeline_design.md` sección 8 y en `train.py`).
