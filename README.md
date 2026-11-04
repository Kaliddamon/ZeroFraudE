# ZeroFraudE — Adaptive E-commerce Fraud Detection System

[![CI - Quality Baseline](https://img.shields.io/badge/Quality%20Baseline-195%20Tests%20Passing-emerald.svg)](#)
[![Backend JaCoCo Coverage](https://img.shields.io/badge/JaCoCo%20Coverage-65.72%25-brightgreen.svg)](#)
[![Model Version](https://img.shields.io/badge/Model%20Version-v3.0.0-blue.svg)](#)

Plataforma integral y distribuida de detección, análisis y gestión de fraude en transacciones de comercio electrónico en tiempo real. Combina inferencia estadística y aprendizaje supervisado (LightGBM), un backend empresarial en Spring Boot 3 con base de datos PostgreSQL, y una aplicación web para analistas desarrollada en React 19 y TypeScript.

---

## 1. Arquitectura del Sistema

```
                      +-----------------------------+
                      |   Frontend (React 19 SPA)   |
                      |   Port 5173 / Tailwind / TS |
                      +--------------+--------------+
                                     | REST (JWT)
                                     v
                      +-----------------------------+
                      | Backend (Spring Boot 3.3.3) |
                      | Port 8081 / Java 21 / JPA   |
                      +-------+-------------+-------+
                              |             |
                 JDBC / SQL   v             v   HTTP / JSON
             +--------------------+    +----------------------+
             | PostgreSQL 16 DB   |    | ML Service (FastAPI) |
             | Port 5432          |    | Port 8000 / LightGBM |
             +--------------------+    +----------------------+
```

### Subsistemas
1. **Machine Learning (`fraud_detection_ml`)**:
   - Python 3.11, FastAPI, LightGBM, SHAP, IsolationForest.
   - Inferencia de baja latencia ($p95 < 25\text{ ms}$) con calibración isotónica y explicabilidad XAI.
2. **Backend API (`fraud-detection-backend`)**:
   - Java 21, Spring Boot 3.3.3, Spring Security con JWT, Spring Data JPA, Flyway.
   - Orquestación de ingestión, control de umbrales operacionales y ciclo de vida de alertas.
3. **Frontend (`fraud-detection-frontend`)**:
   - React 19, TypeScript, Vite, Tailwind CSS, TanStack Query, Lucide Icons, MSW.
   - Dashboard analítico, explorador de transacciones con filtrado facetado, panel lateral de inspección profunda (`TransactionDetailDrawer`), panel explicativo XAI (`ExplainabilityPanel`), centro de alertas operativas (`AlertCenter`) y vista de perfil conductual (`UserProfile`).

---

## 2. Puesta en Marcha con Docker Compose

### Requisitos Previos
- Docker Engine $\ge 24.0$ y Docker Compose $\ge 2.20$.

### Configuración de Seguridad y Entorno
1. Copiar la plantilla de entorno a un archivo `.env` local:
  ```bash
  cp .env.example .env
  ```
2. Generar una clave criptográfica segura para `JWT_SECRET` (mínimo 32 caracteres / 256 bits) y configurarla en `.env`:
  ```bash
  # En Linux / macOS / Bash:
  openssl rand -base64 32

  # En Windows PowerShell:
  [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
  ```
  > **Nota de Seguridad:** Docker Compose exige explícitamente la presencia de `JWT_SECRET`. Si no se define en `.env`, el arranque fallará de manera segura. **Nunca** despliegue un secreto de ejemplo o predeterminado en entornos de producción, ya que permitiría la falsificación de tokens administrativos y eludiría el control de acceso.

### Inicio de Todos los Servicios
```bash
docker compose up --build -d
```

### Servicios Expuestos
| Servicio | URL / Puerto | Descripción |
|---|---|---|
| **Frontend Web** | http://localhost:5173 | Interfaz de Analista de Fraude |
| **Backend API** | http://localhost:8081/api/v1 | API REST principal |
| **Swagger UI** | http://localhost:8081/swagger-ui.html | Documentación interactiva OpenAPI |
| **ML Inference** | http://localhost:8000/docs | Documentación de servicio FastAPI |
| **PostgreSQL** | `localhost:5432` | Base de datos relacional (`fraud_dev`) |

---

## 3. Pruebas Automatizadas y Calidad

El proyecto mantiene una suite de calidad integral verificable en cada subsistema:

### Frontend (Vitest & React Testing Library)
```bash
cd fraud-detection-frontend
npm test -- --run
```
- **Resultado:** 68/68 pruebas aprobadas (100% pasando).
- Compilación de producción: `npm run build` (0 errores TS).
- Linter: `npm run lint` (0 errores).

### Backend (JUnit 5, Mockito & JaCoCo)
```bash
cd fraud-detection-backend
mvn test jacoco:report
```
- **Resultado:** 40/40 pruebas aprobadas (100% pasando).
- **Cobertura JaCoCo:** **65.72%** (superando el umbral mínimo del 65%).
- Informe HTML disponible en `target/site/jacoco/index.html`.

### Machine Learning (Pytest)
```bash
cd fraud_detection_ml
pytest tests/ -v
```
- **Resultado:** 87/87 pruebas aprobadas (100% pasando).

---

## 4. Documentación Técnica

- **[Model Card (v3.0.0)](docs/model-card.md):** Métricas, características, calibración y consideraciones éticas del modelo.
- **[Especificación OpenAPI (OpenAPI 3.0)](docs/openapi.yaml):** Contratos de datos CTR-01 y endpoints REST.
- **[Decisiones de Arquitectura](docs/decisiones/):** Registros ADR de decisiones de ingeniería.
