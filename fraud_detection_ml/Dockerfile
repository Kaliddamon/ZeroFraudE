FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copiar e instalar dependencias Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código fuente
COPY src/ src/
COPY configs/ configs/
COPY artifacts/ artifacts/
COPY train.py evaluate.py ./

# Puerto del servicio de inferencia
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Ejecutar el servicio de inferencia por defecto
CMD ["python", "-m", "uvicorn", "src.inference.app:app", "--host", "0.0.0.0", "--port", "8000"]
