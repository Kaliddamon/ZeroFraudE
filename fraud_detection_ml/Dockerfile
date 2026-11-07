FROM python:3.11-slim

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Crear usuario sin privilegios para Hugging Face Spaces (UID 1000)
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    MODEL_VERSION=3.0.0 \
    PYTHONUNBUFFERED=1

WORKDIR $HOME/app

# Copiar e instalar dependencias Python
COPY --chown=user:user requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Copiar código fuente y artefactos del modelo para inferencia
COPY --chown=user:user src/ src/
COPY --chown=user:user configs/ configs/
COPY --chown=user:user artifacts/ artifacts/

# Puerto del servicio de inferencia
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Ejecutar el servicio de inferencia por defecto
CMD ["python", "-m", "uvicorn", "src.inference.app:app", "--host", "0.0.0.0", "--port", "8000"]
