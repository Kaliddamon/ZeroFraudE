# Calidad y pruebas

## 1. Tecnologías de prueba por subsistema

| Subsistema | Framework | Librerías clave | Comando de ejecución |
|---|---|---|---|
| ML | pytest | pytest, pytest-cov, httpx | `fraud_detection_ml/venv\Scripts\python.exe -m pytest tests/ -v` |
| Backend | JUnit 5 | Mockito, AssertJ, Spring Boot Test | `mvn test` (en `fraud-detection-backend/`) |
| Frontend | Vitest | @testing-library/react, @testing-library/jest-dom, jsdom, MSW | `npm test` (en `fraud-detection-frontend/`) |

**Importante:** Estas suites de prueba no se reejecutaron en esta sesión de documentación (requiere instalar dependencias: entorno virtual Python con `requirements.txt`, Maven con `pom.xml`, Node.js con `package.json`). Los resultados citados a continuación provienen de los informes `INFORME_*` del proyecto y están marcados como **INFERIDA**.

## 2. Alcance de las pruebas

### ML (`fraud_detection_ml/tests/`)

Archivos de prueba:
- `tests/unit/test_preprocessing.py` — imputación sin NaN, rango del scaler
- `tests/unit/test_features.py` — z-score sin división por cero, ventanas de velocity, codificación cíclica en [-1,1]
- `tests/unit/test_behavioral.py` — cold start con perfil global, perfil no actualizado en fraude
- `tests/unit/test_risk_fusion.py` — pesos suman 1.0, clasificación por umbrales, `anomaly_alert` independiente
- `tests/unit/test_schemas.py` — schema de entrada/salida
- `tests/integration/test_normal_transaction.py` — pipeline end-to-end, transacción normal no es CRITICAL, cold start sin afirmaciones falsas, señales auxiliares

Según `INFORME_ROBUSTEZ_V311.md` L144-148: 87 tests ML, 0 fallos, 0 errores. (Informes anteriores citaban 73, 75, 82 — discrepancia no resuelta, véase limitaciones).

### Backend (`fraud-detection-backend/src/test/`)

Archivos de prueba:
- `AlertControllerTest.java` — contratos y endpoints de alertas (listar, detalle, revisión tipificada, creación manual)
- `TransactionControllerTest.java` — endpoint de transacciones, paginación, filtros
- `UserBehaviorControllerTest.java` — perfil conductual e historial de usuario
- `StatisticsControllerTest.java` — estadísticas del dashboard (KPIs, series temporales, donut)
- `TransactionServiceTest.java` — orquestar transacción (ML éxito, ML falla → PENDING_ANALYSIS, alerta por severidad)
- `AlertServiceTest.java` — ciclo de vida de alertas, persistencia de notas y decisiones (`FRAUD_CONFIRMED`, `FALSE_POSITIVE`, `REQUIRES_FOLLOWUP`), validación de duplicados (409 Conflict)
- `UserBehaviorServiceTest.java` — cálculo de métricas agregadas y transacciones por usuario
- `StatisticsServiceTest.java` — agregación de métricas de negocio y capital protegido
- `MLInferenceAdapterTest.java` — adaptador ML (éxito, timeout, reintento, validación de contrato)
- `GlobalExceptionHandlerTest.java` — handler global de excepciones RFC 7807

**Resultado ejecutado y verificado:** 58 tests backend, 0 fallos, BUILD SUCCESS.

### Frontend (`fraud-detection-frontend/src/`)

Archivos de prueba unitaria (Vitest):
- `transactions.service.test.ts` — endpoint correcto, detalle con explicaciones, error 404
- `alerts.service.test.ts` — creación, consulta, revisión tipificada y validación de decisión requerida
- `RiskBadge.test.tsx`, `ModelScoreBar.test.tsx`, `MetricCard.test.tsx` — componentes atómicos y visuales
- `TransactionDetailDrawer.test.tsx` — panel de detalle, explicaciones SHAP, creación manual de alertas y revisión tipificada
- `ExplainabilityPanel.test.tsx` — panel de interpretabilidad y navegación contextual
- `DashboardPage.test.tsx` — KPIs con datos reales y gráficos analíticos
- `AlertCenter.test.tsx` — lista de alertas, filtros por estado/severidad, drawer y visualización de resoluciones
- `UserProfile.test.tsx` — métricas históricas, cold start banner, historial cronológico paginado y comparador conductual

**Resultado ejecutado y verificado:** 10 archivos de prueba, 94 tests, 0 fallos.

### End-to-End (E2E Playwright en `fraud-detection-frontend/e2e/`)

Validación automatizada sobre el stack integrado real (Backend Spring Boot, Frontend React, PostgreSQL y Servicio ML FastAPI):
- `auth-dashboard.spec.ts` (Flujo 1): Login con JWT, carga de KPIs en vivo, visualización de Donut y gráfico de 7 días, manejo de credenciales inválidas.
- `transaction-detail.spec.ts` (Flujo 2): Carga de transacciones reales, búsqueda por usuario, inspección de ScoreGauge, 3 señales de riesgo (ML, Isolation Forest, Behavior) y panel SHAP.
- `alert-review.spec.ts` (Flujo 3): Carga de alertas reales, persistencia de revisión con notas y tipología de decisión (`FRAUD_CONFIRMED`, `FALSE_POSITIVE`, `REQUIRES_FOLLOWUP`).
- `manual-alert-creation.spec.ts` (Flujo 4 - ACT-01): Creación manual de alertas vía API (201 Created), control de duplicados (409 Conflict), creación manual desde TransactionDetailDrawer y visualización en Alert Center.
- `user-profile.spec.ts` (Flujo 5 - FE-09): Carga de perfil conductual y métricas agregadas, navegación contextual con `txId`, panel comparativo con cálculo de desviaciones, historial cronológico y navegación fluida desde ExplainabilityPanel.

**Resultado ejecutado y verificado:** 16 pruebas E2E ejecutadas contra Docker Compose real, 16 pasadas, 0 fallos.

## 3. Estado de verificación de pruebas

| Suite | Framework | Tests Totales | Aprobados | Fallidos | Estado |
|---|---|---|---|---|---|
| ML Service | pytest | 87 | 87 | 0 | ✅ Reportado verde en v3.1.1 |
| Backend API | JUnit 5 / Mockito | 58 | 58 | 0 | ✅ Verificado y ejecutado |
| Frontend Unit | Vitest / RTL | 94 | 94 | 0 | ✅ Verificado y ejecutado |
| E2E Stack Real | Playwright | 16 | 16 | 0 | ✅ Verificado y ejecutado |

## 4. Aspectos de calidad cubiertos y pendientes

| Aspecto | Estado | Evidencia |
|---|---|---|
| CI/CD (GitHub Actions) | ❌ Ausente | No existe directorio `.github/` |
| Cobertura de código (JaCoCo backend) | ⚠️ Omitida en test rápido | Configurada en pom.xml |
| Cobertura de código (pytest-cov ML) | ⚠️ Reportada | Informes de ML |
| Pruebas E2E Playwright | ✅ Verificado (QA-02) | 16 pruebas en `fraud-detection-frontend/e2e/` |
| Pruebas de carga/rendimiento | ❌ Ausente | Pendiente para producción |
| Linter backend | ❌ No configurado | No se encontró checkstyle |
| Linter frontend | ✅ Verificado | `oxlint` 0 errores |
| Build frontend | ✅ Verificado | `tsc -b && vite build` 0 errores |
| Validación de contrato OpenAPI | ✅ Verificado | springdoc expone `/v3/api-docs` y swagger-ui |

## 5. Reglas de calidad observadas

- **ML (skill ml-pipeline-validation):** Re-ejecutar suite completa tras cambios; pinchar versiones en `requirements.txt`; documentar rationale de umbrales en `ml_pipeline_design.md`; no tratar tests de contrato como sustituto de tests de integración; no introducir nuevos frameworks ML.
- **Integración (skill integration-contract-review):** Los umbrales viven en un solo lugar (`thresholds.json`); el frontend no debe redefinir bandas; cada llamada cross-service tiene timeout y fallback; los tests de contrato complementan, no reemplazan, los de integración.
- **Frontend (skill frontend-testing):** Un solo runner (Vitest + Testing Library + jsdom); afirmar comportamiento y nombres accesibles, no clases CSS de Tailwind; MSW es el mock de API; `npm test` debe estar verde antes de considerar una tarea terminada; no dejar tests skippeados.

## 6. Comandos confirmados en el proyecto (no ejecutados en esta sesión)

Estos comandos aparecen en los archivos de configuración y pueden ejecutarse una vez instaladas las dependencias:

```bash
# ML (desde fraud_detection_ml/)
fraud_detection_ml/venv\Scripts\python.exe -m pytest tests/ -v --tb=short

# Backend (desde fraud-detection-backend/)
mvn test

# Frontend (desde fraud-detection-frontend/)
npm test
npm run lint
npm run build

# Despliegue (desde raíz, requiere Dockerfiles de BE y FE que faltan)
docker compose up -d
```
