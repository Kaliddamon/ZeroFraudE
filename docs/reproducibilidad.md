# Reproducibilidad y operación

## 1. Requisitos y versiones verificadas

| Subsistema | Tecnología | Versión (verificada en archivo) | Fuente |
|---|---|---|---|
| ML | Python | 3.14 (pyc cpython-314) | `__pycache__` en `fraud_detection_ml/` |
| ML | FastAPI | >=0.111 | `requirements.txt` L23 |
| ML | LightGBM | >=4.3 | `requirements.txt` L13 |
| ML | scikit-learn | >=1.5 | `requirements.txt` L12 |
| ML | pandas | >=2.2 | `requirements.txt` L8 |
| ML | Pydantic | >=2.7 | `requirements.txt` L17 |
| Backend | Java | 21 | `pom.xml` L22 (`<java.version>21</java.version>`) |
| Backend | Spring Boot | 3.3.3 | `pom.xml` L13 |
| Frontend | React | ^19.2.8 | `package.json` L23 |
| Frontend | TypeScript | ~6.0.2 | `package.json` L42 |
| Frontend | Vite | ^8.3.0 | `package.json` L43 |
| Base de datos | PostgreSQL | 16-alpine | `docker-compose.yml` L5 |

**Nota:** `requirements.txt` especifica versiones mínimas (operador `>=`), no pines exactos. Para reproducibilidad estricta se recomendaría fijar versiones exactas (operador `==`).

## 2. Semilla de reproducibilidad

- Seed global = 42, definido en `configs/pipeline.yaml` L7.
- Aplicado en `train.py` L70: `np.random.seed(config.seed)`.
- LightGBM y scikit-learn usan `random_state=config.seed`.

## 3. Pasos de instalación (no ejecutados en esta sesión)

### ML

Desde `fraud_detection_ml/`:
```bash
# Crear y activar entorno virtual (ejemplo Windows)
python -m venv venv
venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt

# Ejecutar pruebas
venv\Scripts\python.exe -m pytest tests/ -v --tb=short
```

### Backend

Desde `fraud-detection-backend/`:
```bash
# Compilar y probar
mvn test
```

Requiere Maven y JDK 21.

### Frontend

Desde `fraud-detection-frontend/`:
```bash
# Instalar dependencias
npm install

# Ejecutar pruebas
npm test

# Build de producción
npm run build

# Servidor de desarrollo
npm run dev
```

Requiere Node.js y npm.

## 4. Entrenamiento del modelo

Desde `fraud_detection_ml/`:
```bash
venv\Scripts\python.exe train.py --data data/raw/synthetic_transactions.csv --version 1.0.0
```

**Requisito previo:** El archivo `data/raw/synthetic_transactions.csv` debe existir. Este directorio **no está versionado** en el repositorio (ignorado por `.gitignore`), por lo que el dataset no está disponible para reproducir el entrenamiento desde cero sin obtenerlo externamente.

El entrenamiento genera artefactos en `artifacts/<version>/`:
- `fraud_model.joblib`, `anomaly_model.joblib`, `behavior_profiles.pkl`, `encoder.joblib`, `imputer.joblib`, `feature_config.json`, `thresholds.json`, `metrics.json`.

## 5. Evaluación final en Test Set

Desde `fraud_detection_ml/`:
```bash
venv\Scripts\python.exe evaluate.py --data data/raw/synthetic_transactions.csv --version 1.0.0
```

**Importante:** `evaluate.py` evalúa el Test Set que nunca se usó durante el entrenamiento ni tuning (ver docstring del archivo).

## 6. Ejecución local del ML Service

Desde `fraud_detection_ml/`:
```bash
venv\Scripts\python.exe -m src.inference.app
```

O directamente:
```bash
venv\Scripts\python.exe src/inference/app.py
```

El servicio expone:
- `POST http://localhost:8000/predict`
- `GET http://localhost:8000/health`
- `GET http://localhost:8000/model-info`
- `GET http://localhost:8000/metrics`

El servicio carga la versión "3.0.0" de los artefactos por defecto (`app.py` L179). Si los artefactos no están disponibles, `/predict` retorna 503.

## 7. Ejecución local del backend

Desde `fraud-detection-backend/`:
```bash
mvn spring-boot:run
```

El backend expone la API en `http://localhost:8081/api/v1`. Requiere PostgreSQL disponible en `localhost:5432` (o configurar `DB_URL`, `DB_USER`, `DB_PASSWORD` en `application-dev.yml`).

Variables de entorno relevantes (no exponer valores):
- `DB_URL`, `DB_USER`, `DB_PASSWORD` — conexión a PostgreSQL
- `ML_SERVICE_URL` — URL del servicio ML (default `http://localhost:8000`)
- `JWT_SECRET` — clave secreta para firmar JWT (tiene valor por defecto en `application.yml`; se recomienda no usar el default en producción)
- `JWT_EXPIRATION_MS` — expiración del token (default 86400000 ms = 24h)

## 8. Ejecución local del frontend

Desde `fraud-detection-frontend/`:
```bash
npm run dev
```

El frontend se sirve en `http://localhost:5173`. Usa `VITE_API_URL` para conectar al backend (default `/api/v1` si no está definida).

El archivo `.env` local contiene `VITE_USE_MOCKS=false` (no versionado). No se encontró condicionamiento explícito de esta variable en el código de servicios leído.

## 9. Despliegue con Docker

Desde la raíz del repositorio:
```bash
docker compose up -d
```

**Limitación crítica:** `docker-compose.yml` referencia `./fraud-detection-backend/Dockerfile` y `./fraud-detection-frontend/Dockerfile`, pero esos archivos **no existen**. Solo existe `fraud_detection_ml/Dockerfile`. Por tanto, `docker compose up` no levantará el stack completo sin crear primero los Dockerfiles faltantes (tarea fuera del alcance de esta fase de documentación).

Servicios orquestados por `docker-compose.yml`:
- `postgres` (puerto 5432)
- `ml-service` (puerto 8000)
- `backend` (puerto 8081)
- `frontend` (puerto 5173)

## 10. Pasos para verificar el funcionamiento (demo, según INFORME_CIERRE_V310.md)

1. Levantar servicios con `docker compose up -d` (requiere Dockerfiles completos).
2. Abrir `http://localhost:5173`, login como admin.
3. Ir a `/dashboard` y hacer clic en una transacción.
4. Verificar score, nivel de riesgo y explicaciones del modelo.

**Nota:** Estos pasos provienen del informe del proyecto y no se verificaron en esta sesión por falta de Dockerfiles completos.

## 11. Configuración de umbrales (ajustable sin reentrenar)

Los umbrales están en `fraud_detection_ml/configs/thresholds.json` y se replican en `artifacts/3.0.0/thresholds.json`:

| Umbral | Valor (v3.1.1) | Significado |
|---|---|---|
| `critical` | 0.50 | risk_score >= 0.50 → CRITICAL |
| `high` | 0.25 | risk_score >= 0.25 → HIGH |
| `medium` | 0.05 | risk_score >= 0.05 → MEDIUM |
| `anomaly_alert_threshold` | 0.70 | anomaly_score >= 0.70 → anomaly_alert=True |

Modificar `thresholds.json` y reiniciar el servicio ML es suficiente para cambiar los umbrales operativos sin reentrenar el modelo (ver `ml_pipeline_design.md` sección 10).

## 12. Artefactos versionados

Directorio `fraud_detection_ml/artifacts/` con versiones: `1.0.0/`, `1.1.0/`, `2.0.0/`, `3.0.0/`, `v1.0.0/`.

La versión actualmente referenciada por el servicio es `3.0.0/` (ver `app.py` L179).

## 13. Experiment tracking

Directorio `fraud_detection_ml/experiments/` con:
- `exp_001_logistic_baseline/metrics.json` — métricas del baseline
- `exp_002_lgbm_main/metrics.json` — métricas de validación LightGBM
- `final_evaluation/lgbm_test_metrics.json` — métricas finales en Test Set
- `scores/val_scores.csv`, `scores/test_scores.csv`, `scores/test_scores_v311.csv` — distribuciones de scores
- `architecture_comparison_val.csv`, `ablation_val.csv` — comparaciones de arquitectura

Estos archivos son evidencia de las métricas reportadas en los informes `INFORME_*`.
