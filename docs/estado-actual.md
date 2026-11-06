# Estado actual del sistema

> **Nota:** Esta sección describe el estado real observado en el repositorio, sin dar por confirmada ninguna fase de Kanban sin evidencia local. No se ha consultado GitHub Projects online (no hay acceso a ese tablero).

## 1. Resumen ejecutivo

ZeroFraudE es un sistema de detección de fraude en transacciones e-commerce compuesto por tres subsistemas completamente integrados:

| Subsistema | Tecnología principal | Estado | Evidencia |
|---|---|---|---|
| **ML Pipeline** | Python 3.14, FastAPI, LightGBM, scikit-learn, Pydantic | Implementado y probado | `fraud_detection_ml/src/`, `fraud_detection_ml/tests/` (87 tests) |
| **Backend API** | Java 21, Spring Boot 3.3.3, Spring Data JPA, Flyway, PostgreSQL, JWT | Implementado y verificado | `fraud-detection-backend/` (58 tests JUnit 5) |
| **Frontend Web** | React 19, TypeScript, Vite, Tailwind, TanStack Query, MSW, Recharts | Implementado y verificado | `fraud-detection-frontend/` (94 tests Vitest + 16 E2E Playwright) |

El modelo LightGBM está entrenado (artefactos `artifacts/3.0.0/`) con PR-AUC=0.7860 en Test Set independiente.
El Hito 4 ha sido **completado y validado de extremo a extremo (QA-02)** contra el stack Docker Compose real (Backend Spring Boot, Frontend React, PostgreSQL y Servicio ML FastAPI), aprobando el 100% de las pruebas (16/16 tests E2E verdes).

## 2. Cambios pendientes en el repositorio (trabajo del usuario, respetado)

Según `git status --short` en rama `master`:

**Archivos modificados (tracked):**
- `fraud-detection-backend/target/classes/application-dev.yml`
- `fraud-detection-backend/target/classes/application.yml`
- `fraud-detection-backend/target/classes/com/frauddetection/config/OpenApiConfig.class`
- `fraud-detection-backend/target/classes/db/migration/V6__insert_default_admin.sql`
- `fraud-detection-backend/target/maven-status/maven-compiler-plugin/compile/default-compile/createdFiles.lst`

**Archivos no versionados (untracked):**
- `.idea/`, `.opencode/`
- `INFORME_AJUSTE_RIESGO_V310.md`, `INFORME_CIERRE_V310.md`, `INFORME_MEJORA_SENALES_AUXILIARES_V311.md`, `INFORME_ROBUSTEZ_V311.md`
- `docker-compose.yml`
- `fraud-detection-backend/src/test/` y `fraud-detection-backend/target/`
- `fraud-detection-frontend/.env`
- `ml_pipeline_design.md`
- `scripts/__pycache__/`, `skills-candidates/`

Todos estos cambios se tratan como trabajo del usuario y **no se modifican** durante esta fase de documentación.

## 3. Instrucciones del repositorio descubiertas

- No existe `AGENTS.md` ni directorio `.cursor/` en la raíz del repositorio.
- Existe `.opencode/skills/` con 8 skills instaladas: `architecture-diagrams`, `backend-testing`, `frontend-design`, `frontend-testing`, `github-workflows-ci`, `integration-contract-review`, `ml-pipeline-validation`, `safe-change-review`.
- Existe `skills-candidates/` con 12 skills adicionales (candidatos, no instalados).
- No hay directorio `.github/` → **no hay CI/CD configurado** (GitHub Actions ausente).
- `ml_pipeline_design.md` es el Technical Design Document del componente ML (versión 1.0, 1.365 líneas).

## 4. Documentos de ajuste e informes del proyecto

Se encuentran en la raíz (no versionados, `??` en git status):

| Archivo | Contenido | Estado |
|---|---|---|
| `INFORME_ROBUSTEZ_V311.md` | Decisión final v3.1.1: risk_score = fraud_probability, anomaly_score como señal separada (anomaly_alert) | **Más reciente y coherente con configuración actual** |
| `INFORME_MEJORA_SENALES_AUXILIARES_V311.md` | Mejora de señales auxiliares (behavioral_deviation, Isolation Forest sin target-encoded) | Complementario a v3.1.1 |
| `INFORME_AJUSTE_RIESGO_V310.md` | Ajuste risk fusion v3.1.0 (pesos 1.00/0.00/0.00, thresholds 0.50/0.25/0.05) | Estado intermedio |
| `INFORME_CIERRE_V310.md` | Cierre v3.1.0 con umbrales F2 (0.3012/0.2259/0.1416) — **CONTRADICE** la configuración actual | Supersedido por v3.1.1 |

**Inconsistencia detectada:** `INFORME_CIERRE_V310.md` reporta umbrales `critical=0.3012`, `high=0.2259`, `medium=0.1416` que no coinciden con `configs/thresholds.json` (actual: `critical=0.50`, `high=0.25`, `medium=0.05`). Véase sección de limitaciones.

## 5. ¿Está el proyecto en el hito 3 de 5?

**NO VERIFICABLE.** No hay acceso al tablero de GitHub Projects online. El estado de los hitos se infiere únicamente del código y los informes locales (véase `docs/kanban-estado.md`).

## 6. Estado de implementación respecto al plan Kanban

Tras la ejecución y completitud del Hito 4 y QA-02:

| Elemento | Referencia en plan | Estado real | Evidencia |
|---|---|---|---|
| Dockerfile de backend | `docker-compose.yml`, `docker-compose.e2e.yml` | ✅ **Implementado** | `fraud-detection-backend/Dockerfile` |
| Dockerfile de frontend | `docker-compose.yml`, `docker-compose.e2e.yml` | ✅ **Implementado** | `fraud-detection-frontend/Dockerfile` |
| Dashboard analítico | FE-04 | ✅ **Implementado** | Donut chart, 7-day chart, MetricCard dinámicas |
| Transaction Explorer | FE-05 | ✅ **Implementado** | `src/pages/TransactionExplorer.tsx` |
| Detalle y Explicabilidad ML | FE-06, FE-07 | ✅ **Implementado** | `TransactionDetailDrawer.tsx`, `ExplainabilityPanel.tsx` |
| Página Alert Center | FE-08 | ✅ **Implementado** | `src/pages/AlertCenter.tsx`, resolución tipificada |
| Página User Profile | FE-09 | ✅ **Implementado** | `src/pages/UserProfile.tsx`, historial y comparador conductual |
| Pruebas E2E Playwright | QA-02 | ✅ **Implementado y Verificado** | 16 pruebas en `fraud-detection-frontend/e2e/`, 100% pasando |
| CI/CD GitHub Actions | INF-01, QA-01 | ❌ **Ausente** | No existe `.github/` (pendiente Hito 5) |
| Dataset de entrenamiento versionado | ML-01 | ❌ **Ausente** | `data/raw/` ignorado por `.gitignore` |
| Model Card | DOC-02 | ❌ **Ausente** | Pendiente Hito 5 |
