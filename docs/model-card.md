# Model Card — ZeroFraudE Transaction Fraud Detector

## 1. Resumen del Modelo

- **Nombre:** ZeroFraudE LightGBM Classifier
- **Versión:** `3.0.0`
- **Tipo de Modelo:** Gradient Boosting Decision Trees (`LightGBM`) con calibración de probabilidades (`Isotonic Regression`) y componente complementario de detección de anomalías (`IsolationForest`).
- **Fecha de versión:** Noviembre 2026
- **Licencia:** Académica / MIT

---

## 2. Propósito y Alcance

### Uso Previsto
Detección en tiempo real de transacciones fraudulentas en plataformas de comercio electrónico. El modelo estima la probabilidad posterior de fraude $P(\text{fraud} \mid x)$ y genera señales complementarias de anomalía estadística y desviación comportamental respecto al historial de 30 días del usuario.

### Usuarios Objetivo
Analistas de fraude, sistemas automáticos de scoring de transacciones y equipos de riesgo operacional.

### Usos Fuera de Alcance
- Decisión legal vinculante sin supervisión humana.
- Evaluación crediticia o solvencia financiera.
- Detección de lavado de activos (AML) transfronterizo fuera del contexto e-commerce minorista.

---

## 3. Arquitectura y Señales

El sistema genera tres señales independientes y complementarias:

1. **`fraud_probability`**: Probabilidad calibrada $[0, 1]$ estimada por el clasificador LightGBM supervisado.
2. **`anomaly_score`**: Puntuación normalizada $[0, 1]$ generada por un modelo IsolationForest independiente.
3. **`behavioral_deviation`**: Métrica de divergencia z-score respecto a la ventana histórica móvil de 30 días del usuario.

### Umbrales Operacionales (Backend Contract CTR-01)

| Nivel de Riesgo | Rango de Probabilidad | Acción Sugerida |
|---|---|---|
| **CRITICAL** | $\ge 0.50$ | Bloqueo preventivo / Alerta inmediata |
| **HIGH** | $[0.25, 0.50)$ | Revisión prioritaria en Centro de Alertas |
| **MEDIUM** | $[0.05, 0.25)$ | Monitoreo pasivo |
| **LOW** | $< 0.05$ | Aprobación automática |

---

## 4. Conjunto de Datos y Preprocesamiento

### Partición Temporal
- **Entrenamiento:** 70% inicial (orden cronológico)
- **Validación:** 15% subsiguiente
- **Prueba:** 15% final

### Features Principales (22 variables)
- **Temporales:** `hour_sin`, `hour_cos`, `day_of_week`, `is_weekend`, `is_night`
- **Monto y Distribución:** `amount_log`, `user_avg_amount_30d`, `user_std_amount_30d`, `amount_z_score`, `amount_ratio_to_avg`
- **Novedad / Dispositivo / Geografía:** `is_new_device`, `is_new_country`, `is_new_merchant`
- **Velocidad Transaccional:** `tx_count_5min`, `tx_count_1h`, `tx_count_24h`, `amount_sum_1h`, `unique_merchants_24h`, `unique_countries_24h`
- **Patrón duplicado:** `is_duplicate_candidate`

### Manejo de Categorías y Cold Start
- **Target Encoding con Fallback:** Categorías con frecuencia $\le 5$ se colapsan a categoría global desconocida para evitar filtración y sobreajuste.
- **Cold Start:** Usuarios con $< 5$ transacciones históricas reciben imputación de media global con indicador booleano de baja confianza.

---

## 5. Métricas de Rendimiento (Versión 3.0.0)

Evaluado sobre el conjunto de prueba (`Test Set`, $N = 7{,}659$ transacciones, $382$ fraudes, tasa de fraude del $4.99\%$) con estricta separación temporal y umbral operativo de $0.1474$ (fuente: `artifacts/3.0.0/metrics.json`):

### Métricas Verificadas en Artefacto v3.0.0

| Métrica | Valor Verificado | Observación |
|---|---:|---|
| **PR-AUC** | **0.8061** | Área bajo curva Precision-Recall (objetivo futuro $\ge 0.82$) |
| **ROC-AUC** | **0.9216** | Área bajo curva ROC (objetivo futuro $\ge 0.94$) |
| **Recall (Sensibilidad)** | **87.17%** | $333$ fraudes detectados de $382$ totales |
| **Precision** | **31.33%** | 333 verdaderos positivos / 1,063 alertas totales |
| **F1-Score** | **0.4609** | Media armónica entre Precision y Recall |
| **FPR (Falsos Positivos)** | **10.03%** | 730 falsos positivos sobre 6,547 transacciones legítimas |
| **FNR (Falsos Negativos)** | **12.83%** | 49 fraudes no detectados |
| **Costo Total Estimado** | **$11,000.00** | Función de costo con $C_{\text{FP}} = \$5$ y $C_{\text{FN}} = \$150$ |

### Métricas No Verificadas / Objetivos Operacionales
- **Latencia de Inferencia (p95):** No medida empíricamente en el artefacto de evaluación; objetivo de arquitectura definido como $p95 < 25\text{ ms}$, sujeto a benchmark de carga en infraestructura dedicada.

---

## 6. Explicabilidad e Interpretabilidad

- **Algoritmo XAI:** TreeSHAP (`shap.TreeExplainer`) aplicado en tiempo de inferencia para transacciones clasificadas como HIGH o CRITICAL.
- **Traducción Semántica:** En frontend (`ExplainabilityPanel`), los pesos y variables técnicas se transforman a categorías legibles (Monto, Dispositivo, Geografía, Velocidad, Comercio).
- **Gobernanza:** Cuando no se dispone de vectores numéricos SHAP brutos, la UI presenta una nota de transparencia informando que la explicación se basa en reglas y no inventa porcentajes ficticios.

---

## 7. Limitaciones y Consideraciones Éticas

- **Sesgo Geográfico:** Transacciones originadas en países con escaso volumen histórico pueden exhibir una desviación conductual elevada sin representar fraude real.
- **Deriva Conceptual (Concept Drift):** Los patrones de fraude mutan estacionalmente (e.g., Black Friday, Cyber Monday). Se recomienda reentrenamiento mensual automatizado.
- **Supervisión Humana Obligatoria:** Las transacciones críticas generan alertas para intervención del analista, garantizando el principio de *Human-in-the-Loop*.
