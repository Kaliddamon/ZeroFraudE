# Fraud Detection ML Pipeline

Componente de Machine Learning para **Detección Adaptativa de Fraude en E-commerce**.

## Quick Start

```bash
# 1. Crear entorno virtual
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Linux/Mac

# 2. Instalar dependencias
pip install -r requirements.txt

# 3. Generar datos sintéticos
python data/generate_synthetic.py

# 4. Entrenar el pipeline completo
python train.py

# 5. Evaluar en el Test set
python evaluate.py

# 6. Levantar el servicio de inferencia
python -m uvicorn src.inference.app:app --host 0.0.0.0 --port 8000

# 7. Probar el endpoint
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "T001",
    "user_id": "U00001",
    "amount": 1250.50,
    "timestamp": "2023-10-27T14:32:00Z",
    "country": "CO",
    "device_id": "D42",
    "merchant_id": "M18"
  }'
```

## Estructura del proyecto

```
fraud_detection_ml/
├── configs/                     # Configuración (editable sin reentrenar)
│   ├── pipeline.yaml            # Config global: seed, ventanas, modelo
│   ├── thresholds.json          # Umbrales de riesgo
│   └── risk_fusion.yaml        # Pesos del Risk Fusion
├── data/
│   ├── raw/                     # Datos originales
│   ├── processed/               # Datos preprocesados
│   └── generate_synthetic.py   # Generador de datos de prueba
├── src/
│   ├── config.py                # Carga centralizada de configuración
│   ├── validation/schemas.py    # Pydantic: contrato entrada/salida
│   ├── preprocessing/           # Imputación, escalado, encoding
│   ├── features/                # Feature engineering
│   ├── behavioral/              # Perfilado de usuarios
│   ├── models/                  # LightGBM, Logistic Regression
│   ├── anomaly/                 # Isolation Forest
│   ├── risk/                    # Risk Fusion Engine
│   ├── explainability/          # SHAP + explicaciones en lenguaje natural
│   ├── evaluation/              # Métricas y split temporal
│   └── inference/               # Servicio HTTP (FastAPI)
├── tests/                       # Unit + integration tests
├── artifacts/                   # Modelos entrenados (versionados)
├── experiments/                 # Resultados de experimentos
├── train.py                     # Script de entrenamiento
├── evaluate.py                  # Script de evaluación final
├── Dockerfile                   # Imagen Docker del servicio
└── requirements.txt             # Dependencias Python
```

## Contrato de inferencia

### Input (POST /predict)

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

## Tests

```bash
# Unit tests
python -m pytest tests/unit/ -v

# Todos los tests
python -m pytest tests/ -v --tb=short
```

## Docker

```bash
# Construir imagen
docker build -t fraud-ml-service .

# Ejecutar
docker run -p 8000:8000 fraud-ml-service
```
