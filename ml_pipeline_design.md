# Technical Design Document: Componente de Machine Learning
## Detección Adaptativa de Fraude en E-commerce

**Versión:** 1.0  
**Equipo:** 2 estudiantes  
**Restricción:** ~150 horas-persona totales del proyecto  
**Alcance:** Exclusivamente el pipeline de Machine Learning

---

## Tabla de contenidos

1. Alcance y clasificación de funcionalidades
2. Selección de técnicas de Machine Learning
3. Arquitectura del pipeline
4. Flujo de datos completo
5. Data Preprocessing
6. Feature Engineering
7. Behavioral Profiling
8. Fraud Detection (Supervisado)
9. Anomaly Detection (No supervisado)
10. Risk Fusion
11. Emerging Fraud Patterns
12. Network / Graph Analysis
13. Explainability
14. Evaluación y métricas
15. Validación temporal y concept drift
16. Reproducibilidad
17. Contrato lógico de entrada y salida
18. Persistencia de modelos
19. Testing del pipeline
20. Estructura modular del proyecto
21. Stack tecnológico
22. Arquitectura del componente ML
23. Seguridad y privacidad desde ML
24. Plan de desarrollo (15 semanas)
25. MVP vs extensiones — Resumen final
26. Riesgos técnicos

---

## 1. Alcance y clasificación de funcionalidades

### Qué puede resolver el pipeline

El pipeline puede analizar una transacción individual de e-commerce en el momento en que se produce y emitir un veredicto de riesgo multidimensional basado en:
- Características intrínsecas de la transacción.
- Desviación respecto al comportamiento histórico del usuario.
- Grado de anomalía en el espacio de todas las transacciones conocidas.
- Combinación ponderada de las señales anteriores.

### Qué NO debe abordarse por restricciones de tiempo

- Reentrenamiento automático (online learning) en producción.
- Procesamiento de streams en tiempo real (Kafka, Flink).
- Modelos de grafos neuronales (GNN) completos.
- Sistemas de A/B testing de modelos.
- Explicaciones contrafactuales complejas.

### Clasificación de funcionalidades

| Funcionalidad | Clasificación | Justificación |
|---|---|---|
| Pipeline de validación y preprocesamiento | **MVP** | Requisito base para cualquier modelo |
| Feature engineering transaccional y temporal | **MVP** | Señales más importantes del fraude |
| Behavioral profiling básico (Z-score, flags) | **MVP** | Diferenciador central del sistema |
| Modelo supervisado LightGBM | **MVP** | Relación precision/complejidad óptima |
| Risk Fusion con reglas heurísticas | **MVP** | Sin esto no hay output util |
| Contrato de inferencia (predict function) | **MVP** | Necesario para integración con Backend |
| Isolation Forest (anomaly detection) | **Extensión** | Añade valor pero no es crítico para el MVP |
| Explainability con SHAP | **Extensión** | Deseable pero costoso de integrar bien |
| Emerging pattern detection (DBSCAN) | **Extensión** | Alta complejidad, bajo riesgo de omitir |
| Graph-based features simples | **Extensión** | Viable si hay tiempo sobrante |
| GNN, online learning, concept drift activo | **Experimental** | Fuera del alcance práctico |

---

## 2. Selección de técnicas de Machine Learning

### Evaluación comparativa

| Técnica | Valor | Complejidad | Datos necesarios | Tiempo impl. | Riesgo técnico | Decisión |
|---|---|---|---|---|---|---|
| Logistic Regression | Medio | Baja | Poco | Mínimo | Bajo | ✅ Baseline |
| Random Forest | Alto | Media | Moderado | Bajo | Bajo | Descartado (más lento que LightGBM) |
| **LightGBM** | **Muy alto** | **Media** | **Moderado** | **Bajo** | **Bajo** | **✅ Modelo principal** |
| XGBoost | Muy alto | Media | Moderado | Bajo | Bajo | Alternativa si LightGBM da problemas |
| Redes neuronales | Alto | Alta | Alto | Alto | Alto | ❌ Descartado |
| Autoencoders | Alto | Alta | Alto | Alto | Alto | ❌ Descartado (se usa Isolation Forest) |
| **Isolation Forest** | **Alto** | **Baja** | **Poco** | **Bajo** | **Bajo** | **✅ Anomaly detection** |
| Clustering (K-Means) | Medio | Baja | Poco | Bajo | Bajo | ❌ Descartado (salida difícil de calibrar) |
| Modelos temporales (LSTM) | Alto | Muy alta | Mucho | Muy alto | Muy alto | ❌ Descartado |
| Graph Neural Networks | Muy alto | Muy alta | Mucho | Muy alto | Muy alto | ❌ Descartado |
| Semi-supervisado | Alto | Alta | Moderado | Alto | Alto | ❌ Descartado para MVP |
| Concept drift detection | Medio | Alta | Requiere tiempo | Alto | Alto | ❌ Solo monitoreo básico |

### Estrategia seleccionada

**Modelo baseline:** Regresión Logística
- Propósito: Establecer un piso de rendimiento mínimo e identificar features con poder predictivo.
- Beneficio: Implementación en ~2 horas, interpretable, referencia obligatoria.
- Se entrena con las mismas features que el modelo principal para comparación justa.

**Modelo principal:** LightGBM
- Propósito: Clasificador supervisado de fraude que produce `fraud_probability`.
- Razón de selección: Manejo nativo de variables categóricas, alta velocidad de entrenamiento (crítico para iterar en 150 horas), excelente rendimiento en datos tabulares desbalanceados, parámetro `scale_pos_weight` para imbalance, `early_stopping` nativo.
- Entrega `predict_proba`, permitiendo calibrar el umbral de decisión independientemente.

**Modelo de anomalías:** Isolation Forest
- Propósito: Identificar transacciones atípicas sin depender de etiquetas de fraude.
- Razón de selección: No asume distribución de los datos, eficiente en alta dimensionalidad, sin hiperparámetros críticos, salida converitble a score [0,1].
- Entrenado únicamente con transacciones etiquetadas como legítimas.

**Modelos complementarios (Extensión):**
- DBSCAN sobre transacciones de riesgo medio para detección de patrones emergentes.
- SHAP TreeExplainer sobre LightGBM para explicabilidad.

### Alternativas descartadas y por qué

- **Random Forest:** Produce resultados comparables a LightGBM pero es más lento en entrenamiento e inferencia. No aporta ventaja en este contexto.
- **Autoencoders:** Requieren datos suficientes y tiempo de tuning de la arquitectura. Isolation Forest logra resultados aceptables con mucho menos esfuerzo.
- **LSTM / modelos temporales:** Requieren secuencias largas y estructuradas por usuario. La construcción de esas secuencias es costosa en tiempo de implementación. Las features de velocidad (velocity checks) capturan la dimensión temporal de forma más pragmática.
- **SMOTE:** Se descarta por distorsionar las distribuciones temporales y complicar la validación temporal. Se usa `scale_pos_weight` en su lugar.

---

## 3. Arquitectura del pipeline

El pipeline se divide en dos entornos con responsabilidades distintas:

### Entorno de entrenamiento (Offline)

```
Raw Data (CSV / Parquet)
        │
        ▼
┌───────────────────┐
│  Data Validation  │  ← Valida schema, tipos, rangos
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│   Preprocessing   │  ← Imputa, escala, codifica
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│Feature Engineering│  ← Crea features transaccionales,
└─────────┬─────────┘    temporales y relacionales
          │
          ▼
┌───────────────────┐
│Behavioral Profiler│  ← Construye perfiles por usuario,
└─────────┬─────────┘    calcula deviaciones (solo con datos pasados)
          │
          ├──────────────────────────┐
          ▼                          ▼
┌─────────────────┐        ┌──────────────────┐
│  Fraud Model    │        │ Anomaly Model    │
│  (LightGBM)     │        │ (Isolation Forest│
│  Training       │        │  Training)       │
└────────┬────────┘        └────────┬─────────┘
         │                          │
         ▼                          ▼
┌────────────────────────────────────────────┐
│              Evaluation                    │
│  (PR-AUC, F1, Threshold tuning, Cost)      │
└────────────────┬───────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────┐
│           Artifact Registry                │
│  model.joblib | preprocessor.joblib        │
│  thresholds.json | metrics.json            │
│  behavior_profiles.pkl                     │
└────────────────────────────────────────────┘
```

### Entorno de inferencia (Online)

```
Raw Transaction (JSON dict)
        │
        ▼
┌───────────────────┐
│  Input Validation │  ← Pydantic schema validation
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│   Preprocessing   │  ← Mismo transformador del entrenamiento
└─────────┬─────────┘    (cargado desde artifact)
          │
          ▼
┌───────────────────┐
│ Feature Engine    │  ← Genera features en tiempo real
│ + Behavioral      │    + Consulta perfil del usuario
│   Profile Lookup  │
└─────────┬─────────┘
          │
     ┌────┴─────┐
     ▼          ▼
┌─────────┐  ┌──────────────┐
│ LightGBM│  │ Isolation    │
│.predict_│  │ Forest       │
│  proba()│  │.score()      │
└────┬────┘  └──────┬───────┘
     │               │
     ▼               ▼
fraud_prob      anomaly_score
     │               │
     └──────┬─────────┘
            │  behavioral_deviation (del perfil)
            ▼
┌───────────────────┐
│   Risk Fusion     │  ← Combina las 3 señales con pesos
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Explainability   │  ← SHAP values (Extensión) o top features
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Prediction Output │  ← Dict / JSON con el contrato de salida
└───────────────────┘
```

---

## 4. Flujo de datos completo

### Entrada → Preprocessing

- **Entra:** DataFrame raw con columnas: `transaction_id`, `user_id`, `amount`, `timestamp`, `country`, `device_id`, `merchant_id`.
- **Sale:** DataFrame limpio con tipos correctos, sin nulos críticos, con columnas derivadas de timestamp descompuestas.

### Preprocessing → Feature Engineering

- **Entra:** DataFrame limpio.
- **Sale:** DataFrame con features construidas: `amount_log`, `hour_sin`, `hour_cos`, `is_weekend`, `is_new_device`, `amount_z_score`, `tx_count_1h`, etc.

### Feature Engineering → Behavioral Profiler

- **Entra:** Features transaccionales + DataFrame de historial del usuario.
- **Sale:** Features de desviación: `amount_z_score`, `is_new_country`, `behavioral_deviation_score`, `tx_velocity_5min`.

### Feature Vectors → Fraud Model

- **Entra:** Vector de features numéricas normalizado.
- **Sale:** `fraud_probability` ∈ [0, 1].

### Feature Vectors → Anomaly Model

- **Entra:** Mismo vector de features.
- **Sale:** `anomaly_score` ∈ [0, 1] (normalizado desde el raw score del Isolation Forest).

### Risk Fusion

- **Entra:** `fraud_probability`, `anomaly_score`, `behavioral_deviation` ∈ [0, 1].
- **Sale:** `risk_score` ∈ [0, 1], `risk_level` ∈ {LOW, MEDIUM, HIGH, CRITICAL}.

### Explainability

- **Entra:** Feature vector de la instancia, modelo LightGBM.
- **Sale:** Lista de strings con los factores más importantes en lenguaje natural.

---

## 5. Data Preprocessing

### Valores faltantes

| Tipo de columna | Estrategia | Razón |
|---|---|---|
| `amount` | Imputación por mediana del `merchant_id` | El monto depende del comercio |
| `country` | Categoría especial `'UNKNOWN'` | No se debe asumir el país |
| `device_id` | Categoría especial `'UNKNOWN'` | Dispositivo desconocido es señal en sí misma |
| Features de velocidad (tx_count_1h) | Imputar con 0 | Sin historial implica primera transacción |
| Behavioral features de Cold Start | Imputar con media global | Ver sección 7 |

### Valores atípicos

**Crítico:** En fraude, el outlier ES la señal. No se eliminan ni recortan montos atípicos.

Estrategia:
- Variables numéricas como `amount`: transformación `log1p(amount)` para comprimir la escala sin eliminar la información del extremo superior.
- Uso de `RobustScaler` (basado en mediana/IQR) en lugar de `StandardScaler` para que los outliers no distorsionen la escala de las demás variables.
- Los modelos de árboles (LightGBM, Isolation Forest) son invariantes a transformaciones monótonas, pero el escalado sí importa para el Isolation Forest y las features de Z-score.

### Variables categóricas

- **Baja cardinalidad** (`is_weekend`, `payment_method`): OneHotEncoding.
- **Media cardinalidad** (`country`, ~200 valores): OrdinalEncoding + LightGBM las trata nativamente.
- **Alta cardinalidad** (`merchant_id`, `device_id`, miles de valores): Target Encoding con smoothing usando la fórmula: `encoded = (n * category_mean + m * global_mean) / (n + m)` donde m es el parámetro de smoothing. **Se calcula solo sobre el conjunto de entrenamiento** para evitar leakage.

### Variables numéricas

- `amount`: `log1p` → `RobustScaler`.
- Features de velocidad (`tx_count_5min`, `tx_count_1h`): normalización MinMax [0,1].
- Z-scores: ya están normalizados por construcción.

### Timestamps

- Descomponer en: `hour_of_day`, `day_of_week`, `day_of_month`, `month`.
- Codificar cíclicamente: `hour_sin = sin(2π * hour / 24)`, `hour_cos = cos(2π * hour / 24)`.
- Calcular `days_since_last_transaction` por usuario (requiere historial previo).

### Duplicados e inconsistencias

- Eliminar duplicados exactos por `transaction_id`.
- Detectar transacciones con mismo `(user_id, amount, merchant_id, timestamp)` con diferencia < 60 segundos: flag `is_duplicate_candidate = 1`.
- Rechazar filas con `amount ≤ 0` (error de datos).

### Evitar Data Leakage

> Esta es la regla más importante del pipeline.

**Reglas estrictas:**
1. **División temporal siempre antes de cualquier transformación.** El split se hace sobre los datos crudos; los transformadores se ajustan (`fit`) únicamente sobre el Training set y se aplican (`transform`) sobre Validation y Test.
2. **Target Encoding:** El encoding de alta cardinalidad usa solo las etiquetas del Training set. Nunca incluir la etiqueta de la propia transacción que se está transformando.
3. **Behavioral features:** Todas las agregaciones históricas usan una ventana `[t - W, t)`, es decir, excluyen el timestamp exacto de la transacción actual y cualquier dato posterior.
4. **Ninguna feature puede requerir información del futuro.** Ejemplo prohibido: "tasa de fraude del comercio calculada sobre todo el dataset".

---

## 6. Feature Engineering

### 6.1 Transaction Features (Obligatorias — MVP)

| Feature | Descripción | Tipo |
|---|---|---|
| `amount_log` | log1p(amount) | Numérica |
| `hour_sin` | Codificación cíclica de hora | Numérica |
| `hour_cos` | Codificación cíclica de hora | Numérica |
| `day_of_week` | 0=Lunes, 6=Domingo | Categórica |
| `is_weekend` | 1 si sábado o domingo | Binaria |
| `is_night` | 1 si hora ∈ [22, 6] | Binaria |
| `country_encoded` | OrdinalEncoding del país | Numérica |
| `merchant_target_enc` | Target encoding del merchant | Numérica |
| `device_target_enc` | Target encoding del dispositivo | Numérica |

### 6.2 Behavioral Features (Obligatorias — MVP)

Todas calculadas sobre historial del usuario con ventana `[t - 30 días, t)`.

| Feature | Descripción |
|---|---|
| `user_avg_amount_30d` | Promedio de montos del usuario en 30 días |
| `user_std_amount_30d` | Desviación estándar de montos |
| `amount_z_score` | (amount - avg) / (std + ε) |
| `amount_ratio_to_avg` | amount / (avg + ε) |
| `is_new_device` | 1 si `device_id` no aparece en historial |
| `is_new_country` | 1 si `country` no aparece en historial |
| `is_new_merchant` | 1 si `merchant_id` no aparece en historial |
| `user_tx_count_30d` | Total de transacciones en 30 días |
| `days_since_last_tx` | Días desde la última transacción |

### 6.3 Temporal Features / Velocity (Obligatorias — MVP)

| Feature | Descripción | Ventana |
|---|---|---|
| `tx_count_5min` | Nº transacciones del mismo usuario | últimos 5 min |
| `tx_count_1h` | Nº transacciones del mismo usuario | última hora |
| `tx_count_24h` | Nº transacciones del mismo usuario | últimas 24h |
| `amount_sum_1h` | Suma de montos en la última hora | última hora |
| `unique_merchants_24h` | Merchants distintos en 24h | últimas 24h |
| `unique_countries_24h` | Países distintos en 24h | últimas 24h |

### 6.4 Relational Features (Opcionales — Extensión)

| Feature | Descripción |
|---|---|
| `device_user_count_24h` | Nº de usuarios distintos usando el mismo device_id en 24h |
| `merchant_fraud_rate_hist` | Tasa de fraude histórica del merchant (calculada solo sobre training) |
| `device_fraud_rate_hist` | Tasa de fraude histórica del dispositivo |

---

## 7. Behavioral Profiling

El perfilado de comportamiento responde: *¿Qué tan diferente es esta transacción respecto al comportamiento habitual de este usuario?*

### Información almacenada por perfil de usuario

```python
# Estructura conceptual del perfil
UserProfile = {
    "user_id": str,
    "tx_count": int,                     # Total de transacciones legítimas
    "amount_ema": float,                 # Exponential Moving Average del monto
    "amount_variance_ema": float,        # Varianza EMA (para calcular std)
    "known_countries": set[str],         # Países vistos en transacciones legítimas
    "known_devices": set[str],           # Dispositivos vistos
    "known_merchants": set[str],         # Merchants habituales
    "typical_hours": List[float],        # Histograma suavizado de horas
    "last_transaction_at": datetime,
    "profile_version": int               # Para control de actualizaciones
}
```

### Cómo se actualiza

- **Durante entrenamiento:** Se construye el perfil procesando transacciones en orden cronológico. Para cada transacción, primero se calculan las features de desviación usando el perfil actual, y luego se actualiza el perfil con la información de esa transacción.
- **Durante inferencia:** El perfil del usuario se carga desde storage (archivo `.pkl` o base de datos clave-valor), se usan sus valores para calcular desviaciones, y después de la inferencia se actualiza con la nueva transacción **solo si no fue clasificada como fraude o sospechosa** (`risk_level ≠ CRITICAL`).

### Cómo se calcula la desviación

```
behavioral_deviation_score = weighted_average(
    is_new_device     * 0.30,
    is_new_country    * 0.25,
    amount_z_score_normalized * 0.25,  # min-max normalizado a [0,1]
    is_unusual_hour   * 0.20
)
```

Este score se normaliza a [0, 1] y se retorna como `behavioral_deviation` en el output del pipeline.

### Cold Start — Usuarios nuevos

Si un usuario tiene menos de **K = 5 transacciones** en su historial:

1. Se asigna el **perfil global** calculado como estadísticas del agregado de todos los usuarios.
2. El `behavioral_deviation` recibe un **peso reducido** en el Risk Fusion (ver sección 10).
3. Se añade el flag `is_cold_start = 1` al contexto interno del pipeline.
4. El perfil global se actualiza con nuevas transacciones de todos los usuarios para mantenerse representativo.

### Protección contra envenenamiento del perfil

- Solo se actualiza el perfil con transacciones cuyo `risk_level ∈ {LOW, MEDIUM}` y que hayan sido confirmadas como no fraudulentas.
- Las transacciones `HIGH` o `CRITICAL` quedan en un buffer de "revisión pendiente" y no se incorporan al perfil hasta confirmación (manual o por tiempo sin reporte).
- Esta protección evita que un atacante que ejecuta transacciones fraudulentas repetidas "normalice" su perfil.

---

## 8. Fraud Detection (Supervisado)

### Variable objetivo

`is_fraud` ∈ {0, 1} — etiqueta binaria presente en el dataset de entrenamiento.

### División temporal de datos

```
Cronológicamente:
├── Jan – Mar: Training set    (~70%)
├── Apr:       Validation set  (~15%)  ← Hiperparámetros y threshold tuning
└── May:       Test set        (~15%)  ← Evaluación final (no tocar hasta el final)
```

El Test set se reserva y no se consulta hasta la evaluación final. Se usa para reportar las métricas definitivas del proyecto.

### Entrenamiento

```python
# Configuración conceptual de LightGBM
params = {
    "objective": "binary",
    "metric": ["binary_logloss", "average_precision"],  # PR-AUC
    "n_estimators": 500,
    "learning_rate": 0.05,
    "num_leaves": 31,
    "scale_pos_weight": n_negatives / n_positives,  # Penaliza la clase mayoritaria
    "early_stopping_rounds": 50,
    "random_state": 42,
    "n_jobs": -1
}
```

### Manejo de class imbalance

- **Estrategia primaria:** `scale_pos_weight = (nº ejemplos negativos) / (nº ejemplos positivos)`. Esto le indica al modelo que cada ejemplo de fraude tiene el mismo peso que múltiples ejemplos legítimos. Implementado nativamente en LightGBM sin overhead adicional.
- **Estrategia descartada — SMOTE:** Genera ejemplos sintéticos interpolando en el espacio de features. El problema con series temporales es que puede generar muestras que violan el orden temporal, creando data leakage implícito. Se descarta.
- **Estrategia descartada — Undersampling aleatorio:** Descarta información legítima valiosa. Solo se consideraría si el training set es extremadamente grande.

### Threshold Tuning

El modelo retorna `predict_proba`, no una clasificación binaria. El umbral de decisión se selecciona en el **Validation set** maximizando una función de costo:

```
Cost = (FP_count * cost_FP) + (FN_count * cost_FN)

Donde:
  cost_FP = costo de rechazar una transacción legítima (fricción al usuario, potencial pérdida de venta)
  cost_FN = promedio del monto de transacciones fraudulentas no detectadas
```

El umbral óptimo se almacena en `thresholds.json` y es el único parámetro que puede ajustarse sin reentrenar el modelo.

### Selección de hiperparámetros

Se usa `Optuna` (ligero, eficiente) o una búsqueda manual guiada en el Validation set, optimizando PR-AUC. El espacio de búsqueda se acota a 4-5 hiperparámetros críticos:
- `num_leaves`: [15, 63]
- `learning_rate`: [0.01, 0.1]
- `min_child_samples`: [10, 100]
- `colsample_bytree`: [0.6, 1.0]

Se ejecutan máximo 30 trials. Con early stopping nativo, cada trial es rápido.

### Persistencia e inferencia

- Modelo guardado con `joblib.dump(model, "artifacts/fraud_model.joblib")`.
- Durante inferencia: `model.predict_proba(X)[:, 1]` retorna `fraud_probability`.

---

## 9. Anomaly Detection

### Técnica seleccionada: Isolation Forest

El Isolation Forest aísla observaciones construyendo árboles de decisión aleatorios. Las anomalías se aíslan con pocas particiones (caminos cortos en el árbol). Es eficiente, no paramétrico y no asume distribución gaussiana.

### Entrenamiento

- Se entrena **únicamente con transacciones etiquetadas como legítimas** del Training set.
- Esto lo hace sensible a cualquier desviación del comportamiento normal, independientemente de si esa desviación está en los ejemplos de fraude conocidos.
- Parámetro clave: `contamination = 0.01` (estimación de la proporción de anomalías).

### Normalización del score

El Isolation Forest retorna un score crudo negativo (más negativo = más anómalo). Se normaliza a [0, 1]:

```python
raw_score = iso_forest.score_samples(X)  # scores negativos
# Normalización: invertir y escalar
anomaly_score = 1 - (raw_score - raw_score.min()) / (raw_score.max() - raw_score.min())
```

El resultado es `anomaly_score ∈ [0, 1]` donde 1 = máxima anomalía.

### Relación con el modelo supervisado

El Isolation Forest captura casos que el modelo supervisado puede ignorar porque:
- No aparecen en los ejemplos históricos de fraude (fraude nuevo, no visto).
- Son transacciones legítimas pero extremadamente inusuales que merecen revisión.

Un score alto de anomalía con baja `fraud_probability` sugiere un comportamiento nuevo, no necesariamente fraude. Esto es señal de un potencial patrón emergente.

---

## 10. Risk Fusion

### Problema con el promedio simple

Promediar `fraud_probability`, `anomaly_score` y `behavioral_deviation` asigna igual importancia a las tres señales. Esto ignora que:
- `fraud_probability` es la señal más directamente entrenada sobre la tarea objetivo.
- `behavioral_deviation` puede ser 1.0 para un usuario que simplemente compra por primera vez en un país nuevo (viaje legítimo).
- `anomaly_score` es útil como señal secundaria pero tiene muchos falsos positivos si se usa sola.

### Estrategia: Weighted Fusion con escalones heurísticos

```python
def compute_risk_score(fraud_prob, anomaly_score, behavioral_dev, is_cold_start):
    # Pesos base
    w_fraud = 0.60
    w_anomaly = 0.25
    w_behavioral = 0.15
    
    # Reducir peso de behavioral para cold start
    if is_cold_start:
        w_fraud = 0.70
        w_anomaly = 0.30
        w_behavioral = 0.00
    
    risk_score = (w_fraud * fraud_prob) + \
                 (w_anomaly * anomaly_score) + \
                 (w_behavioral * behavioral_dev)
    
    return round(risk_score, 4)
```

Los pesos son configurables en `configs/risk_fusion.yaml` sin reentrenar ningún modelo.

### Clasificación en niveles

Los thresholds se determinan en el Validation set usando la distribución de `risk_score` sobre transacciones con etiquetas conocidas, buscando minimizar la función de costo definida en la sección 8.

```python
def classify_risk(risk_score, thresholds):
    if risk_score >= thresholds["critical"]:  # ej: 0.85
        return "CRITICAL"
    elif risk_score >= thresholds["high"]:    # ej: 0.65
        return "HIGH"
    elif risk_score >= thresholds["medium"]:  # ej: 0.40
        return "MEDIUM"
    else:
        return "LOW"
```

Los thresholds se guardan en `configs/thresholds.json`:
```json
{
  "version": "1.0.0",
  "critical": 0.85,
  "high": 0.65,
  "medium": 0.40,
  "last_tuned": "2023-10-27",
  "validation_pr_auc": 0.834
}
```

**Modificación de thresholds sin reentrenamiento:** Se edita únicamente `thresholds.json` y se reinicia el componente de inferencia. Los pesos del Risk Fusion en `risk_fusion.yaml` también son ajustables sin reentrenamiento. Esto permite al equipo de operaciones aumentar la sensibilidad del sistema (bajar thresholds) ante períodos de mayor fraude.

---

## 11. Emerging Fraud Patterns (Extensión)

### Objetivo

Detectar clusters de transacciones que comparten características inusuales, sin afirmar que son fraude confirmado.

### Mecanismo

1. Seleccionar diariamente las transacciones con `risk_level ∈ {MEDIUM, HIGH}` y `fraud_probability < 0.6` (anomalías sin señal clara de fraude conocido).
2. Aplicar **DBSCAN** sobre el espacio de features reducido (PCA a 5-10 dimensiones para eficiencia).
3. Los clusters con más de N transacciones en una ventana de 24h y que comparten al menos 2 características comunes (mismo país, mismo rango horario, mismo tipo de merchant) se reportan como patrones potenciales.

### Salida

```python
EmergingPattern = {
    "pattern_id": str,
    "novelty_score": float,      # Distancia promedio al centroide del training set
    "observed_transactions": int,
    "time_window_hours": int,
    "fraud_correlation": float,  # % confirmados como fraude después de revisión
    "confidence": str,           # LOW | MEDIUM | HIGH (basado en tamaño del cluster)
    "common_features": List[str] # ["country=NG", "hour=03", "new_device=True"]
}
```

### Limitaciones importantes

- DBSCAN es sensible a la elección de `eps` y `min_samples`. Requiere tuning.
- No puede afirmar que un cluster es fraude sin validación humana posterior.
- Los patrones se presentan siempre con nivel de confianza explícito (LOW/MEDIUM/HIGH).
- Esta funcionalidad es un sistema de alertas para analistas, no un clasificador automático.

---

## 12. Network / Graph Analysis (Opcional)

### Evaluación de viabilidad

Construir un grafo completo `(Users, Devices, Merchants, Transactions)` y aplicar GNN requiere:
- Librería especializada (PyTorch Geometric o DGL).
- Datos suficientes para que el grafo sea representativo.
- Tiempo de implementación de 3-4 semanas solo para la infraestructura del grafo.

**Conclusión: GNN no es viable para este proyecto.**

### Alternativa viable: Graph-derived features (Extensión)

En lugar de un modelo de grafos, se calculan features numéricas que capturan la información relacional:

| Feature | Descripción | Cómo calcularla |
|---|---|---|
| `device_user_count_24h` | Nº de usuarios distintos en el mismo dispositivo en 24h | Aggregation por `device_id` sobre historial |
| `device_fraud_count_7d` | Nº de fraudes confirmados asociados al dispositivo en 7 días | Aggregation por `device_id` sobre datos etiquetados |
| `merchant_chargeback_rate` | Tasa de chargebacks del merchant | Aggregation por `merchant_id` sobre training set |
| `shared_device_risk_avg` | Risk score promedio de otros usuarios del mismo dispositivo | Requiere joins sobre historial |

Estas features se calculan como parte del Feature Engineering y se incluyen en el modelo de LightGBM. Capturan la señal relacional sin la complejidad de un modelo de grafos.

---

## 13. Explainability

### Técnica seleccionada: SHAP TreeExplainer (Extensión)

Para LightGBM, SHAP provee valores exactos de Shapley en tiempo polinomial usando `TreeExplainer`. Es la técnica más fundamentada matemáticamente y compatible con el modelo seleccionado.

### Uso en inferencia

Para transacciones con `risk_level ∈ {HIGH, CRITICAL}`:

```python
explainer = shap.TreeExplainer(model)
shap_values = explainer.shap_values(X_instance)  # Un valor por feature

# Seleccionar las 3 features con mayor |SHAP value|
top_features = sorted(zip(feature_names, abs(shap_values)), 
                      key=lambda x: x[1], reverse=True)[:3]
```

### Traducción a lenguaje natural

Se define un diccionario de plantillas de explicación:

```python
EXPLANATION_TEMPLATES = {
    "amount_z_score": "Amount {ratio:.1f}× above user average",
    "is_new_device": "First transaction from this device",
    "is_new_country": "Country not in user's recent history",
    "tx_count_5min": "{value} transactions in the last 5 minutes",
    "is_night": "Transaction at unusual hour ({hour}:00)",
}
```

### Alternativa MVP si SHAP no se implementa a tiempo

Si el tiempo no permite integrar SHAP, se usa **Feature Importance global** del modelo como proxy:

```python
top_features = pd.Series(
    model.feature_importances_,
    index=feature_names
).nlargest(3).index.tolist()
```

Esta alternativa es menos precisa por instancia pero puede implementarse en minutos. Se documenta explícitamente como aproximación.

---

## 14. Evaluación y métricas

### Por qué accuracy es inadecuada

Si el 1% de transacciones son fraude, un modelo que siempre predice "NO fraude" tiene 99% de accuracy. Es un indicador engañoso en problemas altamente desbalanceados.

### Métricas primarias

| Métrica | Por qué es importante en fraude |
|---|---|
| **PR-AUC** | Evalúa el trade-off Precision-Recall a todos los umbrales. No se ve inflada por la clase mayoritaria. Es la métrica más honesta para clases raras. |
| **Recall @ threshold** | En fraude, fallar en detectar un fraude (FN) tiene un costo financiero directo. Maximizar Recall, controlando Precision, es el objetivo operacional. |
| **F1-Score** | Balance entre Precision y Recall al umbral seleccionado. |
| **Confusion Matrix** | Desglose de TP, FP, TN, FN absolutos para entender el comportamiento real. |

### Métricas secundarias

- **ROC-AUC:** Reportar para comparación con literatura, pero no usar para selección de modelo.
- **False Positive Rate (FPR):** Transacciones legítimas bloqueadas. Crítico para experiencia de usuario.
- **False Negative Rate (FNR):** Fraudes no detectados. Crítico para pérdidas financieras.

### Evaluación basada en costos

```
Cost_total = (FP_count * cost_FP) + (FN_count * cost_FN)

Ejemplo con datos reales:
  cost_FP = $5      (procesamiento manual de una alerta falsa)
  cost_FN = $150    (monto promedio de transacción fraudulenta)

Threshold óptimo: el que minimiza Cost_total en el Validation set.
```

### Herramienta de evaluación

Todos los resultados de evaluación se guardan en:
```
experiments/
└── exp_001_lgbm_baseline/
    ├── metrics.json        ← Todas las métricas numéricas
    ├── confusion_matrix.png
    ├── pr_curve.png
    ├── roc_curve.png
    └── params.json         ← Hiperparámetros usados
```

---

## 15. Validación temporal y concept drift

### Por qué la división aleatoria produce resultados engañosos

En una división aleatoria k-fold, el modelo puede ver en training transacciones que ocurrieron **después** de las que aparecen en validación. Esto simula que el modelo "conoce el futuro", produciendo métricas infladas que no reflejan el rendimiento real en producción.

Adicionalmente, los perfiles de comportamiento de usuarios se construyen con datos futuros si no se respeta el orden temporal, rompiendo la causalidad del sistema.

**La división debe ser siempre temporal y estricta.**

### Esquema de validación temporal

```
Ene  Feb  Mar │ Abr │ May
─────────────────────────────────
   Training   │ Val │ Test
              │     │
              │     └─ Evaluación final (no tocar hasta el final)
              └─ Tuning de hiperparámetros y thresholds
```

### Concept Drift

El fraude evoluciona. Los patrones que entrenamos hoy pueden ser obsoletos en 6 meses.

**Monitoreo básico (sin online learning):**

1. Registrar la distribución de `fraud_probability` por semana en producción.
2. Alertar si la distribución se desplaza significativamente (test de Kolmogorov-Smirnov entre la distribución actual y la de entrenamiento).
3. Registrar el `model_version` en cada predicción para correlacionar degradación con la versión del modelo.

**Respuesta al drift:** Reentrenar el modelo periódicamente (mensualmente) con datos más recientes. El pipeline reproducible facilita este proceso.

No se implementa online learning en el MVP. El costo de implementación supera el beneficio dentro del alcance del proyecto.

---

## 16. Reproducibilidad

### Seeds deterministas

```python
GLOBAL_SEED = 42
np.random.seed(GLOBAL_SEED)
random.seed(GLOBAL_SEED)
# LightGBM y sklearn usan random_state=GLOBAL_SEED en su inicialización
```

### Estructura de experimentos

Cada experimento se identifica con un ID único y un timestamp:

```
experiments/
├── exp_001_logistic_regression_baseline/
│   ├── params.json
│   ├── metrics.json
│   └── artifacts/
├── exp_002_lgbm_v1/
│   ├── params.json
│   ├── metrics.json
│   └── artifacts/
└── exp_003_lgbm_v2_with_behavioral/
    ├── params.json
    ├── metrics.json
    └── artifacts/
```

### Versionado de datasets

Los datasets se versionan por hash MD5 del archivo:
```
data/
├── raw/
│   └── transactions_v1.csv.md5  ← Hash del archivo original
└── processed/
    └── transactions_processed_20231027.parquet
```

### Versionado de modelos

El archivo `artifacts/model_registry.json` mantiene un registro:
```json
[
  {
    "version": "1.0.0",
    "model_file": "fraud_model_v1.0.0.joblib",
    "trained_at": "2023-10-27T10:00:00Z",
    "dataset_hash": "abc123",
    "pr_auc_validation": 0.834,
    "threshold_critical": 0.85,
    "threshold_high": 0.65
  }
]
```

### Configuración centralizada

`configs/pipeline.yaml`:
```yaml
seed: 42
model_version: "1.0.0"

data:
  train_end_date: "2023-03-31"
  val_end_date: "2023-04-30"
  
features:
  behavioral_window_days: 30
  velocity_windows_minutes: [5, 60, 1440]
  cold_start_min_transactions: 5

risk_fusion:
  weights:
    fraud_probability: 0.60
    anomaly_score: 0.25
    behavioral_deviation: 0.15
  cold_start_weights:
    fraud_probability: 0.70
    anomaly_score: 0.30
    behavioral_deviation: 0.00

thresholds:
  critical: 0.85
  high: 0.65
  medium: 0.40
```

---

## 17. Contrato lógico de entrada y salida

La función principal del componente de inferencia es `predict()`. Este es el contrato que el Backend debe respetar.

### Input

```json
{
  "transaction_id": "T001",
  "user_id": "U123",
  "amount": 1250.50,
  "timestamp": "2023-10-27T14:32:00Z",
  "country": "CO",
  "device_id": "D42",
  "merchant_id": "M18"
}
```

**Campos requeridos:** Todos.  
**Tipos:** `transaction_id` → string, `user_id` → string, `amount` → float positivo, `timestamp` → ISO 8601, `country` → string 2-3 chars, `device_id` → string, `merchant_id` → string.

### Output

```json
{
  "transaction_id": "T001",
  "fraud_probability": 0.87,
  "anomaly_score": 0.81,
  "behavioral_deviation": 0.92,
  "risk_score": 0.89,
  "risk_level": "HIGH",
  "explanations": [
    "Amount 8.3× above user average",
    "First transaction from this device",
    "Country not in user's recent history"
  ],
  "model_version": "1.0.0",
  "is_cold_start": false
}
```

**Invariantes del output:**
- `fraud_probability`, `anomaly_score`, `behavioral_deviation`, `risk_score` ∈ [0.0, 1.0].
- `risk_level` ∈ {"LOW", "MEDIUM", "HIGH", "CRITICAL"}.
- `explanations`: lista de 1 a 5 strings en inglés.
- `model_version`: string semántico (MAJOR.MINOR.PATCH).
- `is_cold_start`: boolean, indica si el perfil es poco confiable.

### Manejo de errores del contrato

```json
{
  "transaction_id": "T001",
  "error": "VALIDATION_ERROR",
  "message": "Field 'amount' must be positive. Received: -50.0",
  "model_version": "1.0.0"
}
```

El componente de inferencia nunca lanza excepciones no controladas. Si el input es inválido, retorna un dict con `"error"` en lugar de hacer crash.

---

## 18. Persistencia de modelos

### Herramientas seleccionadas

| Herramienta | Uso | Justificación |
|---|---|---|
| **joblib** | Serialización de modelos sklearn/LightGBM y pipelines | Nativo en sklearn, eficiente con arrays NumPy, sin overhead |
| **JSON** | Thresholds, métricas, configuración | Legible por humanos, editable sin código |
| **pickle** | Perfiles de comportamiento (diccionarios Python) | Simple, suficiente para este volumen |

**Descartados:**
- **MLflow:** Agrega valor real en equipos grandes con múltiples experimentos simultáneos. Para dos estudiantes, la estructura de carpetas `experiments/` cumple el mismo propósito con menos overhead.
- **ONNX:** Útil si se necesita portabilidad entre lenguajes (ej. ejecutar el modelo desde Java). No necesario porque el Backend llama al componente ML como servicio Python.

### Estructura de artefactos

```
artifacts/
├── v1.0.0/
│   ├── fraud_model.joblib          ← Modelo LightGBM entrenado
│   ├── preprocessor.joblib         ← Pipeline sklearn (Imputer + Scaler + Encoder)
│   ├── anomaly_model.joblib        ← Isolation Forest
│   ├── behavior_profiles.pkl       ← Diccionario {user_id: UserProfile}
│   ├── thresholds.json             ← Umbrales de riesgo
│   ├── metrics.json                ← Métricas del modelo en validation/test
│   ├── feature_config.json         ← Lista ordenada de features (para reproducir X)
│   └── model_card.md               ← Documentación del modelo
└── model_registry.json             ← Historial de versiones
```

### Carga en inferencia

```python
# Pseudocódigo de carga de artefactos al inicializar el servicio
class FraudDetectionService:
    def __init__(self, version="latest"):
        version_dir = f"artifacts/{version}"
        self.preprocessor = joblib.load(f"{version_dir}/preprocessor.joblib")
        self.fraud_model = joblib.load(f"{version_dir}/fraud_model.joblib")
        self.anomaly_model = joblib.load(f"{version_dir}/anomaly_model.joblib")
        self.profiles = pickle.load(open(f"{version_dir}/behavior_profiles.pkl", "rb"))
        self.thresholds = json.load(open(f"{version_dir}/thresholds.json"))
        self.feature_config = json.load(open(f"{version_dir}/feature_config.json"))
```

---

## 19. Testing del pipeline

### Unit Tests (pytest)

| Módulo | Test | Qué verifica |
|---|---|---|
| `preprocessing` | `test_imputer_handles_nulls` | Que la imputación no genera NaN en la salida |
| `preprocessing` | `test_scaler_range` | Que RobustScaler produce valores en rango razonable |
| `features` | `test_amount_z_score_zero_std` | Que z-score no divide por cero cuando std=0 |
| `features` | `test_velocity_window` | Que tx_count_5min cuenta solo transacciones en los últimos 5 min |
| `features` | `test_cyclic_encoding` | Que hour_sin y hour_cos están en [-1, 1] |
| `behavioral` | `test_new_user_cold_start` | Que usuario sin historial recibe perfil global |
| `behavioral` | `test_profile_not_updated_on_fraud` | Que el perfil no se actualiza si risk_level=CRITICAL |
| `risk` | `test_risk_fusion_weights_sum_to_one` | Que los pesos del Risk Fusion sumen 1.0 |
| `risk` | `test_threshold_classification` | Que risk_score=0.9 produce risk_level=CRITICAL |
| `inference` | `test_output_schema` | Que el output cumple el contrato (todos los campos presentes y en rango) |

### Integration Tests

Prueba del pipeline end-to-end con un input sintético:

```python
def test_full_pipeline_high_risk():
    # Input diseñado para producir HIGH risk
    transaction = {
        "transaction_id": "TEST001",
        "user_id": "USER_TEST",
        "amount": 5000.0,     # Muy alto
        "timestamp": "2023-10-27T03:15:00Z",  # Madrugada
        "country": "NG",      # País inusual
        "device_id": "NEW_DEVICE_001",  # Dispositivo nuevo
        "merchant_id": "M001"
    }
    
    result = service.predict(transaction)
    
    assert result["risk_level"] in ["HIGH", "CRITICAL"]
    assert result["fraud_probability"] > 0.5
    assert len(result["explanations"]) >= 1
    assert 0.0 <= result["risk_score"] <= 1.0
    assert result["model_version"] == "1.0.0"
```

### Data Validation Tests (Pydantic)

```python
def test_invalid_amount_rejected():
    with pytest.raises(ValidationError):
        TransactionInput(amount=-100, ...)

def test_future_timestamp_rejected():
    future_time = datetime.utcnow() + timedelta(hours=24)
    with pytest.raises(ValidationError):
        TransactionInput(timestamp=future_time, ...)
```

### Qué se prueba automáticamente vs manualmente

| Aspecto | Automático | Manual |
|---|---|---|
| Schema del input/output | ✅ Pydantic + pytest | |
| Cálculo de features numéricas | ✅ Unit tests | |
| Pipeline end-to-end | ✅ Integration test | |
| Calidad del modelo (PR-AUC) | | ✅ Revisión de métricas en notebook |
| Razonabilidad de explicaciones | | ✅ Revisión humana de casos extremos |
| Comportamiento con datos reales | | ✅ Manual en notebook de evaluación |

---

## 20. Estructura modular del proyecto

```
fraud_detection_ml/
│
├── configs/
│   ├── pipeline.yaml            ← Configuración global (seeds, ventanas, pesos)
│   └── thresholds.json          ← Umbrales de riesgo (editable sin reentrenar)
│
├── data/
│   ├── raw/                     ← Datos originales (ignorados en git con .gitignore)
│   └── processed/               ← Parquet preprocesado por versión
│
├── notebooks/
│   ├── 01_eda.ipynb             ← Análisis exploratorio (solo lectura)
│   ├── 02_feature_analysis.ipynb
│   ├── 03_model_evaluation.ipynb
│   └── 04_error_analysis.ipynb
│
├── src/
│   ├── __init__.py
│   ├── config.py                ← Carga pipeline.yaml, expone objeto Config
│   │
│   ├── validation/
│   │   ├── __init__.py
│   │   └── schemas.py           ← Pydantic models para input/output
│   │
│   ├── preprocessing/
│   │   ├── __init__.py
│   │   ├── imputer.py           ← Estrategias de imputación
│   │   ├── scaler.py            ← RobustScaler wrapper
│   │   └── encoder.py           ← Target encoding, OHE
│   │
│   ├── features/
│   │   ├── __init__.py
│   │   ├── transaction_features.py   ← Features de la transacción
│   │   ├── temporal_features.py      ← Velocity checks, decomposición timestamp
│   │   └── feature_pipeline.py      ← Compone todas las features en orden
│   │
│   ├── behavioral/
│   │   ├── __init__.py
│   │   ├── profile.py           ← UserProfile dataclass + lógica de actualización
│   │   ├── profiler.py          ← Construcción de perfiles batch (entrenamiento)
│   │   └── deviation.py         ← Cálculo de behavioral_deviation_score
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   ├── base_model.py        ← Interface abstracta (permite cambiar LightGBM por otro)
│   │   ├── lgbm_model.py        ← Implementación LightGBM
│   │   └── logistic_model.py    ← Baseline
│   │
│   ├── anomaly/
│   │   ├── __init__.py
│   │   └── isolation_forest.py  ← Entrenamiento, scoring y normalización
│   │
│   ├── risk/
│   │   ├── __init__.py
│   │   └── fusion.py            ← Risk Fusion engine
│   │
│   ├── explainability/
│   │   ├── __init__.py
│   │   └── shap_explainer.py    ← SHAP wrapper + traducción a lenguaje natural
│   │
│   ├── evaluation/
│   │   ├── __init__.py
│   │   ├── metrics.py           ← PR-AUC, F1, confusion matrix, cost metric
│   │   └── temporal_split.py    ← División temporal reproducible
│   │
│   └── inference/
│       ├── __init__.py
│       ├── service.py           ← FraudDetectionService (carga artefactos, predict())
│       └── app.py               ← FastAPI/Flask app (expone /predict como HTTP)
│
├── tests/
│   ├── unit/
│   │   ├── test_preprocessing.py
│   │   ├── test_features.py
│   │   ├── test_behavioral.py
│   │   └── test_risk_fusion.py
│   └── integration/
│       └── test_pipeline_e2e.py
│
├── artifacts/                   ← Modelos entrenados (ignorados en git, versionados por nombre)
├── experiments/                 ← Resultados de experimentos
│
├── train.py                     ← Script principal de entrenamiento
├── evaluate.py                  ← Script de evaluación sobre Test set
├── requirements.txt
├── Dockerfile
└── README.md
```

### Comunicación entre módulos

Los módulos se comunican mediante **interfaces explícitas de entrada y salida** (dicts tipados o dataclasses). Ningún módulo importa de otro nivel de abstracción más alto que él mismo.

El patrón de reemplazabilidad se logra a través de `base_model.py`:

```python
# Pseudocódigo conceptual
class BaseModel(ABC):
    @abstractmethod
    def fit(self, X: pd.DataFrame, y: pd.Series) -> None: ...
    
    @abstractmethod
    def predict_proba(self, X: pd.DataFrame) -> np.ndarray: ...
    
    @abstractmethod
    def save(self, path: str) -> None: ...
```

Para reemplazar LightGBM por XGBoost:
1. Crear `xgboost_model.py` implementando `BaseModel`.
2. Cambiar la importación en `train.py`.
3. El resto del pipeline no necesita modificación.

---

## 21. Stack tecnológico

| Tecnología | Función | Beneficio | Costo de aprendizaje |
|---|---|---|---|
| **Python 3.10+** | Lenguaje base | Ecosistema ML más rico, ubicuo | Bajo (ya conocido) |
| **pandas 2.x** | Manipulación de datos tabulares | Expresivo, eficiente para el volumen del proyecto | Bajo |
| **NumPy** | Operaciones numéricas vectorizadas | Base de todo el ecosistema científico | Bajo |
| **scikit-learn** | Pipelines, métricas, preprocessing, Isolation Forest | Estándar de la industria, API consistente | Bajo-Medio |
| **LightGBM** | Modelo supervisado principal | Rápido, eficiente en memoria, buen rendimiento en tabulares | Bajo |
| **Pydantic v2** | Validación del contrato de entrada/salida | Tipado estricto, mensajes de error claros | Bajo |
| **joblib** | Serialización de modelos y pipelines | Eficiente con arrays grandes, nativo en sklearn | Mínimo |
| **pytest** | Testing automatizado | Estándar Python, simple, extensible | Bajo |
| **SHAP** | Explainability (Extensión) | Implementación eficiente para LightGBM | Medio |
| **FastAPI** | Exposición del servicio de inferencia como HTTP | Tipado automático, OpenAPI generado, async | Bajo-Medio |
| **Docker** | Reproducibilidad del entorno | Elimina "funciona en mi máquina" | Bajo |

**Tecnologías descartadas:**
- **TensorFlow/PyTorch:** No necesarios dado el modelo seleccionado.
- **MLflow:** Overhead desproporcionado. La estructura de carpetas `experiments/` es suficiente.
- **Kafka/Spark:** No hay procesamiento de streams en el alcance.
- **Optuna:** Útil pero opcional. El tuning manual de 4-5 hiperparámetros es viable.

---

## 22. Arquitectura del componente ML

```
                    ┌──────────────────────────────────┐
                    │         ML COMPONENT             │
                    │                                  │
                    │  ┌──────────────────────────┐    │
                    │  │    Inference Layer        │    │
  Backend API  ────►│  │  (FastAPI / función)      │    │
  JSON input        │  └─────────┬────────────────┘    │
                    │            │                      │
                    │  ┌─────────▼────────────────┐    │
                    │  │   Input Validation        │    │
                    │  │   (Pydantic Schema)       │    │
                    │  └─────────┬────────────────┘    │
                    │            │                      │
                    │  ┌─────────▼────────────────┐    │
                    │  │   Preprocessing Pipeline  │    │
                    │  │   (joblib artifact)       │    │
                    │  └─────────┬────────────────┘    │
                    │            │                      │
                    │  ┌─────────▼────────────────┐    │
                    │  │   Feature Engine          │    │
                    │  │   + Behavioral Profile    │◄───┼── profiles.pkl
                    │  │     Lookup                │    │
                    │  └──┬──────────────────┬─────┘    │
                    │     │                  │           │
                    │  ┌──▼──────┐    ┌──────▼──────┐  │
                    │  │LightGBM │    │Isolation    │  │
                    │  │Model    │    │Forest       │  │
                    │  └──┬──────┘    └──────┬──────┘  │
                    │     │ fraud_prob        │ anom_sc  │
                    │     └─────────┬────────┘          │
                    │               │ + behavioral_dev   │
                    │  ┌────────────▼───────────────┐   │
                    │  │      Risk Fusion Engine    │   │
                    │  │   (pesos + thresholds.json)│   │
                    │  └────────────┬───────────────┘   │
                    │               │                    │
                    │  ┌────────────▼───────────────┐   │
                    │  │     Explainability         │   │
                    │  │   (SHAP / top features)    │   │
                    │  └────────────┬───────────────┘   │
                    │               │                    │
  Backend API  ◄────┤  ┌────────────▼───────────────┐   │
  JSON output       │  │   Prediction Output        │   │
                    │  │   (validated by Pydantic)  │   │
                    │  └────────────────────────────┘   │
                    └──────────────────────────────────┘
```

### Garantías de la arquitectura

- **Bajo acoplamiento:** El Backend solo conoce el contrato JSON. No importa si el modelo es LightGBM o XGBoost.
- **Modularidad:** Cada módulo de `src/` puede modificarse independientemente.
- **Testabilidad:** Cada módulo recibe y retorna estructuras de datos simples (dicts, DataFrames), sin efectos secundarios ocultos.
- **Reproducibilidad:** Los artefactos versionados garantizan que la misma versión del servicio produce el mismo output ante el mismo input.
- **Facilidad de integración:** FastAPI genera OpenAPI spec automáticamente; el Backend puede consumirla directamente.

---

## 23. Seguridad y privacidad desde ML

### Riesgos identificados y medidas

| Riesgo | Descripción | Medida |
|---|---|---|
| **Data leakage en entrenamiento** | Usar datos futuros o el target de la instancia actual en features | División temporal estricta; target encoding calculado solo sobre training |
| **Exposición de PII en artefactos** | Los perfiles de usuario contienen `user_id` y patterns de comportamiento | No almacenar nombres reales ni información de pago en los perfiles; usar solo IDs anónimos |
| **Envenenamiento del modelo (Model Poisoning)** | Un atacante envía transacciones manipuladas para corromper el perfil de usuario | El perfil no se actualiza con transacciones de alto riesgo (ver sección 7) |
| **Extracción de información vía outputs** | Un atacante consulta el modelo repetidamente con pequeñas variaciones para inferir features del modelo | El output no expone valores SHAP crudos en el MVP; las explicaciones son en lenguaje natural |
| **Inputs adversariales** | El atacante conoce las features del modelo y construye transacciones que evaden la detección | Validación estricta del input con Pydantic; el modelo de anomalías es difícil de evadir sin conocer su distribución |
| **Almacenamiento de datos sensibles** | Los perfiles o logs pueden contener información financiera sensible | Los logs del componente ML no deben incluir el campo `amount` en texto plano ni `device_id`; usar hashes |
| **Uso de datos futuros en perfiles** | Si se reconstruye el perfil con todos los datos disponibles en el dataset | El profiler en training solo usa datos `[t-W, t)` para cada transacción |

### Medidas razonables para un proyecto académico

1. Usar solo IDs anónimos (nunca nombres, emails, números de tarjeta) en el pipeline de ML.
2. Mantener el código en repositorio privado durante el desarrollo.
3. Documentar explícitamente en `model_card.md` las limitaciones de privacidad del modelo.
4. No publicar los datos de entrenamiento con información real de usuarios.

---

## 24. Plan de desarrollo (15 semanas)

| Fase | Semanas | Objetivo | Entregable | Dependencia | Riesgo |
|---|---|---|---|---|---|
| **1. Dataset y EDA** | 1–2 | Comprender el dataset, distribuciones, tasa de fraude, calidad de datos | Notebook EDA, script de carga reproducible, informe de calidad | Dataset disponible | **Alto** — Si el dataset no es adecuado, todo cambia |
| **2. Data Validation y Preprocessing** | 3 | Pipeline de limpieza robusto, módulos `validation/` y `preprocessing/` | `preprocessor.joblib` funcionando en tests unitarios | Fase 1 | Bajo |
| **3. Feature Engineering** | 4–5 | Construir todas las features del MVP (transaccionales + temporales + behavioral básico) | `feature_pipeline.py` con tests unitarios | Fase 2 | Medio — La lógica de ventanas temporales puede ser compleja |
| **4. Baseline** | 5 | Regresión Logística end-to-end, métricas en Validation set | `logistic_model.joblib`, `experiments/exp_001/metrics.json` | Fase 3 | Bajo |
| **5. Modelo Principal** | 6–7 | LightGBM con tuning básico, threshold tuning sobre Validation | `fraud_model.joblib`, `thresholds.json`, PR-AUC > baseline | Fase 4 | Medio |
| **6. Behavioral Profiling** | 8 | Perfiles de usuario, cálculo de desviación, cold start | `behavior_profiles.pkl`, tests de profiler | Fase 3 | Medio — La lógica de actualización sin leakage es sutil |
| **7. Risk Fusion** | 9 | Motor de fusión con pesos configurables, clasificación en niveles | `fusion.py` con tests, `risk_fusion.yaml` | Fases 5–6 | Bajo |
| **8. Contrato de Inferencia** | 9–10 | `FraudDetectionService.predict()` completo, Pydantic schemas | Función `predict()` con tests de integración E2E | Fases 5–7 | Bajo |
| **9. Anomaly Detection** | 10–11 | Isolation Forest integrado en pipeline de inferencia | `anomaly_model.joblib`, anomaly_score en output | Fases 3, 8 | Bajo |
| **10. Explainability** | 11–12 | SHAP integrado, traducción a lenguaje natural | `explanations` en output del contrato | Fase 8 | Medio — SHAP puede ser lento; requiere optimización |
| **11. Evaluación Final** | 12 | Evaluación sobre Test set (nunca visto antes), reporte final | `experiments/final/metrics.json`, gráficos PR/ROC | Fases 5, 8 | Bajo |
| **12. Reproducibilidad** | 13 | `train.py` y `evaluate.py` ejecutables desde cero en entorno limpio | `README.md` con instrucciones, `requirements.txt` fijado | Todas | Bajo |
| **13. Testing** | 13–14 | Suite de tests completa (unit + integration) | `pytest` pasa en CI sin fallos | Todas | Bajo |
| **14. Preparación Inferencia** | 14–15 | FastAPI app, Docker, integración con Backend | `app.py` corriendo en Docker, testeado con curl | Fase 8 | Medio — Requiere coordinación con equipo Backend |
| **Extensiones** | 15 | Emerging patterns (DBSCAN) si hay tiempo | `experiments/emerging_patterns/` | Fase 8 | Alta — Solo si todo lo anterior está terminado |

---

## 25. MVP vs Extensiones — Resumen final

### MVP — Obligatorio

- [ ] Pipeline de validación y preprocesamiento reproducible.
- [ ] Feature engineering: transaccionales + temporales (velocity) + behavioral básico.
- [ ] Modelo baseline (Logistic Regression).
- [ ] Modelo principal LightGBM con manejo de imbalance.
- [ ] Evaluación temporal rigurosa (PR-AUC, F1, Cost).
- [ ] Behavioral profiling básico (Z-score de monto, flags binarios).
- [ ] Risk Fusion con pesos configurables.
- [ ] Contrato lógico `predict(dict) → dict` completo y validado.
- [ ] Persistencia de artefactos versionados.
- [ ] Tests unitarios e integración.
- [ ] FastAPI/Flask app para exposición HTTP.
- [ ] Docker para reproducibilidad del entorno.

### Extensión — Si el MVP está completo

- [ ] Isolation Forest para anomaly detection integrado en el Risk Fusion.
- [ ] SHAP TreeExplainer para explicaciones por instancia.
- [ ] Graph-based features simples (device_user_count, merchant_fraud_rate).
- [ ] Emerging pattern detection con DBSCAN.

### Experimental — No comprometer el entregable

- Detección activa de concept drift.
- Online learning incremental.
- Graph Neural Networks.

---

## 26. Riesgos técnicos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| **Dataset inadecuado** (muy pocas instancias de fraude, sin etiquetas) | Alta | Crítico | Usar datasets públicos conocidos (IEEE-CIS Fraud Detection, PaySim) como fallback desde el día 1 |
| **Data leakage no detectado** | Media | Alto | Code review específico de la lógica temporal; tests automáticos que verifican que el split es estricto |
| **Behavioral profiling con leakage** | Media | Alto | El profiler debe ser el módulo con más pruebas unitarias; revisar con datos sintéticos donde el resultado es conocido |
| **SHAP demasiado lento en inferencia** | Media | Medio | Calcular SHAP solo para HIGH/CRITICAL; pre-computar con `approximate=True`; si no es viable, usar feature importance global |
| **LightGBM no converge bien** | Baja | Medio | XGBoost como backup con misma API; el baseline de regresión logística siempre está disponible |
| **Isolation Forest produce demasiados FP** | Media | Medio | Ajustar `contamination`; reducir el peso de `anomaly_score` en el Risk Fusion a 0.10 si el FP rate es alto |
| **Cold start con mala experiencia de usuario** | Alta | Bajo | El flag `is_cold_start` en el output permite al Backend/Frontend comunicar la incertidumbre al usuario |
| **Formato del contrato cambia durante integración** | Media | Medio | Pydantic garantiza que cualquier cambio en el schema es explícito y genera error inmediato; versionar el output |
