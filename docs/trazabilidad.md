# Matriz de trazabilidad

Esta matriz relaciona cada componente o requisito con su implementación, evidencia de prueba, documentación y estado de madurez. Los estados se clasifican como:

- **IMPLEMENTADA:** código presente en el repositorio.
- **PROBADA (reportada):** existe prueba y los informes del proyecto indican 0 fallos (no reejecutada en esta sesión → **INFERIDA**).
- **PROBADA (verificada):** prueba ejecutada con resultado verde en esta sesión (ninguna en esta fase → **NO VERIFICABLE**).
- **FALTA:** no presente en el repositorio.
- **PARCIAL:** presente pero con observaciones o desajustes.

## ML — Datos y features

| Requisito / Componente | Implementación | Evidencia de prueba | Documentación | Estado |
|---|---|---|---|---|
| División temporal 70/15/15 sin leakage | `src/evaluation/temporal_split.py`, `train.py` L99-133 | `tests/unit/` | `docs/ml/datos-y-features.md` | IMPLEMENTADA |
| Preprocessing con fit solo en training | `train.py` L153-166 | `tests/unit/test_preprocessing.py` | `docs/ml/datos-y-features.md` | IMPLEMENTADA |
| Features transaccionales y velocity | `src/features/transaction_features.py`, `temporal_features.py` | `tests/unit/test_features.py` | `docs/ml/datos-y-features.md` | IMPLEMENTADA |
| Behavioral profiling con cold start | `src/behavioral/profiler.py`, `deviation.py` | `tests/unit/test_behavioral.py` | `docs/ml/datos-y-features.md` | IMPLEMENTADA |
| Prevención de data leakage | Varios módulos (ver tabla en datos-y-features.md) | `tests/unit/` | `docs/ml/datos-y-features.md` | IMPLEMENTADA |
| Manejo de desbalance (scale_pos_weight) | `src/models/lgbm_model.py` L90-97 | `tests/unit/` | `docs/ml/entrenamiento-y-evaluacion.md` | IMPLEMENTADA |
| Dataset versionado | ❌ Ausente (`data/raw/` ignorado) | — | `docs/limitaciones-y-pendientes.md` | FALTA |

## ML — Entrenamiento y evaluación

| Requisito / Componente | Implementación | Evidencia de prueba | Documentación | Estado |
|---|---|---|---|---|
| Baseline Regresión Logística | `src/models/logistic_model.py`, `train.py` L191-202 | `tests/unit/` | `docs/ml/entrenamiento-y-evaluacion.md` | IMPLEMENTADA |
| LightGBM con early stopping | `src/models/lgbm_model.py`, `train.py` L204-224 | `tests/unit/` | `docs/ml/entrenamiento-y-evaluacion.md` | IMPLEMENTADA |
| Métricas fraude desbalanceado (PR-AUC, F1, costo) | `src/evaluation/metrics.py` | `tests/unit/` | `docs/ml/entrenamiento-y-evaluacion.md` | IMPLEMENTADA |
| Umbrales operativos en thresholds.json | `configs/thresholds.json` | `tests/unit/test_risk_fusion.py` | `docs/ml/inferencia-y-scoring.md` | IMPLEMENTADA |
| Artefactos versionados | `artifacts/3.0.0/` | — | `docs/reproducibilidad.md` | IMPLEMENTADA |
| Métricas `metrics.json` consistentes con thresholds | ⚠️ `metrics.json` tiene threshold_used=0.1474 (estalo) | — | `docs/limitaciones-y-pendientes.md` | PARCIAL |

## ML — Inferencia y scoring

| Requisito / Componente | Implementación | Evidencia de prueba | Documentación | Estado |
|---|---|---|---|---|
| Contrato de inferencia predict() | `src/inference/service.py`, `schemas.py` | `tests/integration/test_normal_transaction.py` | `docs/ml/inferencia-y-scoring.md` | IMPLEMENTADA |
| Risk score = fraud_probability (v3.1.1) | `src/risk/fusion.py`, `configs/risk_fusion.yaml` | `tests/unit/test_risk_fusion.py` | `docs/ml/inferencia-y-scoring.md` | IMPLEMENTADA |
| anomaly_score como señal separada (anomaly_alert) | `src/risk/fusion.py` L125-142 | `tests/unit/test_risk_fusion.py` | `docs/ml/inferencia-y-scoring.md` | IMPLEMENTADA |
| Explainability SHAP / fallback | `src/explainability/shap_explainer.py` | `tests/unit/` | `docs/ml/inferencia-y-scoring.md` | IMPLEMENTADA |
| Servicio HTTP FastAPI /predict, /health, /metrics | `src/inference/app.py` | `tests/integration/` | `docs/ml/inferencia-y-scoring.md` | IMPLEMENTADA |
| Versiones de modelo alineadas | ⚠️ Desajuste (1.1.0 / 3.0.0 / 1.0.0 / 3.1.1) | — | `docs/limitaciones-y-pendientes.md` | PARCIAL |

## Backend — API y contratos

| Requisito / Componente | Implementación | Evidencia de prueba | Documentación | Estado |
|---|---|---|---|---|
| Endpoints REST transacciones | `TransactionController.java` | `TransactionControllerTest.java`, `TransactionServiceTest.java` | `docs/backend/api-y-contratos.md` | IMPLEMENTADA |
| Endpoint auth login JWT | `AuthController.java`, `SecurityConfig.java` | `e2e/auth-dashboard.spec.ts` | `docs/backend/api-y-contratos.md` | IMPLEMENTADA |
| Endpoints alertas (listar, detalle, revisar tipificada, creación manual) | `AlertController.java`, `AlertService.java` | `AlertControllerTest.java`, `AlertServiceTest.java`, `alert-review.spec.ts` | `docs/backend/api-y-contratos.md` | IMPLEMENTADA |
| Endpoint estadísticas dashboard | `StatisticsController.java`, `StatisticsService.java` | `StatisticsControllerTest.java`, `StatisticsServiceTest.java` | `docs/backend/api-y-contratos.md` | IMPLEMENTADA |
| Endpoint perfil conductual e historial | `UserBehaviorController.java`, `UserBehaviorService.java` | `UserBehaviorControllerTest.java`, `UserBehaviorServiceTest.java` | `docs/backend/api-y-contratos.md` | IMPLEMENTADA |
| Adaptador ML con timeout, retry, fallback | `MLInferenceAdapter.java` | `MLInferenceAdapterTest.java` | `docs/backend/api-y-contratos.md` | IMPLEMENTADA |
| Validación de contrato ML | `MLInferenceAdapter.validateMLResponse()` | `MLInferenceAdapterTest.java` | `docs/backend/api-y-contratos.md` | IMPLEMENTADA |
| Manejo de errores RFC 7807 | `GlobalExceptionHandler.java` | `GlobalExceptionHandlerTest.java` | `docs/backend/api-y-contratos.md` | IMPLEMENTADA |
| OpenAPI exportado/versionado | ⚠️ Expone /v3/api-docs; no hay archivo openapi en repo | — | `docs/limitaciones-y-pendientes.md` | PARCIAL |
| JWT_SECRET sin default hardcodeado | Configurado vía variable de entorno (.env) | Verificado en E2E | `docs/limitaciones-y-pendientes.md` | IMPLEMENTADA |

## Backend — Persistencia e integración

| Requisito / Componente | Implementación | Evidencia de prueba | Documentación | Estado |
|---|---|---|---|---|
| Migraciones Flyway V1-V7 | `db/migration/` | Pruebas de integración Spring Boot | `docs/backend/api-y-contratos.md` | IMPLEMENTADA |
| Orquestar transacción → ML → análisis → alerta | `TransactionService.java` | `TransactionServiceTest.java` | `docs/backend/api-y-contratos.md` | IMPLEMENTADA |
| Fallback PENDING_ANALYSIS si ML falla | `TransactionService.java` L94-105 | `TransactionServiceTest.java` | `docs/backend/api-y-contratos.md` | IMPLEMENTADA |
| Dockerfile backend | `fraud-detection-backend/Dockerfile` | Verificado en `docker-compose.e2e.yml` | `docs/arquitectura/overview.md` | IMPLEMENTADA |

## Frontend

| Requisito / Componente | Implementación | Evidencia de prueba | Documentación | Estado |
|---|---|---|---|---|
| React 19 + TypeScript + Vite + Tailwind | `package.json`, `src/` | `tsc -b && vite build` (0 errores) | `docs/frontend/arquitectura-e-integracion.md` | IMPLEMENTADA |
| Rutas protegidas (/dashboard, /transactions, /alerts, /profile/:userId, /login) | `src/app/App.tsx`, `src/pages/` | `e2e/` (16 pruebas) | `docs/frontend/arquitectura-e-integracion.md` | IMPLEMENTADA |
| Dashboard analítico (FE-04) | `src/pages/DashboardPage.tsx` | `DashboardPage.test.tsx`, `auth-dashboard.spec.ts` | `docs/frontend/arquitectura-e-integracion.md` | IMPLEMENTADA |
| Transaction Explorer (FE-05) | `src/pages/TransactionExplorer.tsx` | `transaction-detail.spec.ts` | `docs/frontend/arquitectura-e-integracion.md` | IMPLEMENTADA |
| Detalle transaccional y explicabilidad (FE-06, FE-07) | `TransactionDetailDrawer.tsx`, `ExplainabilityPanel.tsx` | `TransactionDetailDrawer.test.tsx`, `ExplainabilityPanel.test.tsx` | `docs/frontend/arquitectura-e-integracion.md` | IMPLEMENTADA |
| Alert Center con resolución tipificada (FE-08) | `src/pages/AlertCenter.tsx`, `alerts.service.ts` | `AlertCenter.test.tsx`, `alerts.service.test.ts`, `alert-review.spec.ts` | `docs/frontend/arquitectura-e-integracion.md` | IMPLEMENTADA |
| User Profile con historial y comparador conductual (FE-09) | `src/pages/UserProfile.tsx`, `users.service.ts` | `UserProfile.test.tsx`, `user-profile.spec.ts` | `docs/frontend/arquitectura-e-integracion.md` | IMPLEMENTADA |
| Componentes UI atómicos (RiskBadge, ModelScoreBar, MetricCard) | `src/components/ui/`, `src/components/ml/` | `src/*/*.test.tsx` (94 tests unitarios verdes) | `docs/frontend/arquitectura-e-integracion.md` | IMPLEMENTADA |
| MSW mocks alineados a contratos reales | `src/mocks/handlers.ts` | Vitest suites | `docs/frontend/arquitectura-e-integracion.md` | IMPLEMENTADA |
| Validación E2E Playwright (QA-02) | `fraud-detection-frontend/e2e/` | 16 pruebas E2E ejecutadas y aprobadas | `docs/calidad/pruebas.md` | IMPLEMENTADA |

## DevOps e integración cruzada

| Requisito / Componente | Implementación | Evidencia de prueba | Documentación | Estado |
|---|---|---|---|---|
| docker-compose con 4 servicios | `docker-compose.yml`, `docker-compose.e2e.yml` | Stack E2E corriendo y validado | `docs/arquitectura/overview.md` | IMPLEMENTADA |
| Dockerfile ML | `fraud_detection_ml/Dockerfile` | Contenedor en ejecución | `docs/reproducibilidad.md` | IMPLEMENTADA |
| Dockerfile backend | `fraud-detection-backend/Dockerfile` | Contenedor en ejecución | `docs/arquitectura/overview.md` | IMPLEMENTADA |
| Dockerfile frontend | `fraud-detection-frontend/Dockerfile` | Contenedor en ejecución | `docs/arquitectura/overview.md` | IMPLEMENTADA |
| CI/CD GitHub Actions | ❌ Ausente (no hay .github/) | — | `docs/limitaciones-y-pendientes.md` | FALTA |
| Comunicación síncrona HTTP | Verificado en código y Docker Compose | `MLInferenceAdapter`, `apiClient` | `docs/integracion.md` | IMPLEMENTADA |

## Documentación

| Requisito | Implementación | Estado |
|---|---|---|
| README raíz con arquitectura global | ❌ Ausente (creado `docs/README.md` en esta fase) | FALTA → cubierto por docs/ |
| Modelo Card del ML | ❌ Ausente | FALTA |
| Diagrama de arquitectura | ❌ Ausente (creados diagramos Mermaid en `docs/arquitectura/overview.md`) | Parcialmente cubierto |
| Documentación de umbrales y riesgo | `INFORME_*` + `docs/ml/` | IMPLEMENTADA (parcial, con inconsistencias) |
