# Limitaciones conocidas, riesgos técnicos y trabajo pendiente

Este documento separa explícitamente el **estado actual**, el **trabajo pendiente** y las **recomendaciones**. Todas las afirmaciones están basadas en evidencia del repositorio.

## 1. Limitaciones conocidas (estado actual)

| # | Limitación | Evidencia | Clasificación |
|---|-----------|-----------|---------------|
| L1 | No hay acceso al tablero de GitHub Projects online; el estado de los 5 hitos de Kanban se infiere solo del código local | No se puede consultar el tablero remoto | NO VERIFICABLE |
| L2 | No se reejecutaron las suites de prueba en esta sesión (requiere instalar dependencias Python/Maven/Node) | `git status`, archivos de prueba presentes | NO VERIFICABLE (resultado) |
| L3 | `artifacts/3.0.0/metrics.json` reporta `threshold_used=0.1474` (criterio coste puro antiguo), inconsistente con `configs/thresholds.json` actual (0.50/0.25/0.05) | `metrics.json` L16 vs `thresholds.json` L3-5 | VERIFICADA |
| L4 | `INFORME_CIERRE_V310.md` reporta umbrales F2 (0.3012/0.2259/0.1416) que contradicen la configuración actual v3.1.1 | INFORME_CIERRE_V310.md L18 vs `thresholds.json` | VERIFICADA |
| L5 | Desajuste de versiones del modelo: `service.load()` default "1.1.0", `app.py` carga "3.0.0", `pipeline.yaml` dice "1.0.0", `thresholds.json` dice "3.1.1", frontend muestra badge "v1.1.0" | `service.py` L63, `app.py` L179, `pipeline.yaml` L8, `thresholds.json` L2, `TransactionExplorer.tsx` L77 | VERIFICADA |
| L6 | Los Dockerfiles de backend y frontend referenciados en `docker-compose.yml` no existen | `docker-compose.yml` L41, L60 vs ausencia de archivos | VERIFICADA |
| L7 | `data/raw/` no está versionado (ignorado por `.gitignore`); `train.py` requiere el CSV para entrenar | `train.py` L63-64, `.gitignore` | VERIFICADA |
| L8 | JWT_SECRET tiene valor por defecto hardcodeado en `application.yml` y está expuesto en `docker-compose.yml` | `application.yml` L42, `docker-compose.yml` L52 | VERIFICADA (riesgo de seguridad) |
| L9 | `.env` del frontend con `VITE_USE_MOCKS=false` no está versionado y no se encontró condicionamiento explícito en servicios leídos | `.env` L1, `apiClient.ts`, `transactions.service.ts` | VERIFICADA |
| L10 | Conteos de pruebas inconsistentes entre informes: ML reporta 73/75/82/87 según el INFORME leído | INFORME_CIERRE L62 (73), INFORME_AJUSTE L183 (75), INFORME_ROBUSTEZ L146 (82), INFORME_MEJORA L141 (87) | VERIFICADA |

## 2. Riesgos técnicos (priorizados)

### Críticos

| # | Riesgo | Descripción | Evidencia |
|---|--------|-------------|-----------|
| R1 | **Despliegue incompleto** | `docker compose up` no levanta backend ni frontend porque faltan sus Dockerfiles | `docker-compose.yml` L41, L60 vs ausencia de archivos |
| R2 | **Secreto expuesto** | JWT_SECRET hardcodeado con valor por defecto en código y docker-compose | `application.yml` L42, `docker-compose.yml` L52 |
| R3 | **Dataset no reproducible** | No se puede entrenar el modelo desde cero sin el dataset CSV externo | `train.py` L63-64, `data/raw/` ausente |

### Altos

| # | Riesgo | Descripción | Evidencia |
|---|--------|-------------|-----------|
| R4 | **Inconsistencia de versiones** | Varios archivos reportan versiones distintas del modelo; riesgo de desplegar artefacto/config desalineados | `service.py` L63, `app.py` L179, `pipeline.yaml` L8, `thresholds.json` L2 |
| R5 | **métricas estalo en artefactos** | `artifacts/3.0.0/metrics.json` reporta threshold_used=0.1474 no coherente con thresholds actuales | `metrics.json` L16 vs `thresholds.json` L3-5 |
| R6 | **Documentación contradictoria** | INFORME_CIERRE_V310.md (umbrales F2) contradice configs actuales (v3.1.1) | INFORME_CIERRE_V310.md L18 vs `thresholds.json` |
| R7 | **Sin CI/CD** | No hay GitHub Actions; las pruebas no se ejecutan automáticamente en push/PR | Ausencia de `.github/` |
| R8 | **Encodings a 0 en inferencia** | merchant/device/country target encoding se ponen a 0 en inferencia real para categorías nuevas | `service.py` L193-197 |

### Medios

| # | Riesgo | Descripción | Evidencia |
|---|--------|-------------|-----------|
| R9 | **Páginas frontend faltantes** | Alert Center (FE-08) y User Profile (FE-09) no implementadas | Ausencia en `src/pages/` |
| R10 | **Sin pruebas E2E** | No existe Playwright ni pruebas de extremo a extremo navegador | Plan QA-02 vs ausencia en repo |
| R11 | **behavioral_deviation fuera de risk_score** | Tiene PR-AUC=0.3974 pero no se usa en la decisión de riesgo | `configs/risk_fusion.yaml` L18-19 |
| R12 | **anomaly_alert con falsos positivos** | 13.2% de alertas de anomalía son legítimos (Test Set) | `INFORME_MEJORA_SENALES_AUXILIARES_V311.md` L76-78 |

### Bajos

| # | Riesgo | Descripción | Evidencia |
|---|--------|-------------|-----------|
| R13 | **Frontend badge de versión stale** | Muestra "LightGBM v1.1.0" cuando el modelo real es 3.0.0/3.1.1 | `TransactionExplorer.tsx` L77 |
| R14 | **Sin Model Card** | No hay documentación formal del modelo (métricas, limitaciones, sesgos) | Ausencia en repo |
| R15 | **Sin OpenAPI exportado** | springdoc expone `/v3/api-docs` pero no hay archivo openapi.json/yaml versionado | Ausencia en repo |

## 3. Deuda técnica

| # | Elemento | Descripción | Dónde se evidencia |
|---|----------|-------------|-------------------|
| D1 | INFORME_CIERRE_V310.md supersedido | Contiene umbrales F2 que ya no aplican; debería archivarse o marcarse como obsoleto | INFORME_CIERRE_V310.md vs `thresholds.json` |
| D2 | Múltiples versiones de artefactos | `artifacts/` tiene 1.0.0, 1.1.0, 2.0.0, 3.0.0, v1.0.0 sin un modelo_registry claro que indique cuál es la versión activa | `artifacts/` listado |
| D3 | Métricas de artifacts desactualizadas | `metrics.json` no refleja los umbrales operativos actuales | `artifacts/3.0.0/metrics.json` L16 |
| D4 | Versión de modelo en frontend hardcodeada | Badge "LightGBM v1.1.0" no se actualiza automáticamente | `TransactionExplorer.tsx` L77 |

## 4. Preguntas pendientes

| # | Pregunta | Cómo se podría resolver |
|---|----------|------------------------|
| P1 | ¿A qué hito de Kanban corresponde exactamente el trabajo actual (¿hito 3 de 5)? | Consultar el tablero de GitHub Projects online (no accesible desde esta sesión) |
| P2 | ¿Cuál es el conteo real y actualizado de pruebas por suite? | Ejecutar `pytest`, `mvn test`, `npm test` y consolidar un solo reporte |
| P3 | ¿El archivo `.env` del frontend con `VITE_USE_MOCKS=false` se usa para alternar mocks/backend real? | Buscar lecturas de `import.meta.env.VITE_USE_MOCKS` en el código frontend |
| P4 | ¿El dataset de entrenamiento puede obtenerse de una fuente pública (PaySim, IEEE-CIS, etc.)? | Verificar requisitos del anteproyecto y documentación de ML |
| P5 | ¿Se planea reentrenar LightGBM o mantener la versión 3.0.0 indefinidamente? | Documentar decisión en `ml_pipeline_design.md` o ADR |

## 5. Mejoras recomendadas (prioridad, solo documentación/configuración)

1. **Crear Dockerfiles de backend y frontend** para que `docker compose up` funcione completo (bloqueante para despliegue).
2. **Unificar versiones del modelo:** elegir una versión canónica (ej. 3.0.0) y alinear `service.load()`, `app.py`, `pipeline.yaml`, `thresholds.json` y el badge del frontend.
3. **Regenerar `artifacts/3.0.0/metrics.json`** con los umbrales actuales o marcarlo como obsoleto.
4. **Archivar o marcar como obsoleto `INFORME_CIERRE_V310.md`** para evitar confusión con los umbrales F2.
5. **Mover JWT_SECRET a variable de entorno obligatoria sin valor por defecto** en producción.
6. **Versionar el dataset de entrenamiento** o documentar cómo obtenerlo/regenerarlo.
7. **Agregar CI/CD (GitHub Actions)** con `mvn test`, `pytest`, `npm test` y build de imágenes Docker.
8. **Implementar páginas Alert Center y User Profile** (FE-08, FE-09).
9. **Agregar pruebas E2E Playwright** (QA-02).
10. **Crear Model Card del modelo LightGBM** con métricas de Test Set, limitaciones y sesgos.
11. **Exportar y versionar OpenAPI spec** (`openapi.json` o `openapi.yaml`) del backend.
12. **Consolidar los informes `INFORME_*`** en un único documento de decisiones actualizado (v3.1.1).

## 6. Estado de madurez por área (resumen)

| Área | Madurez | Comentario |
|------|---------|------------|
| ML pipeline (entrenamiento, inferencia, scoring) | Sustancial | Código completo y artefactos entrenados; versiónes desalineadas |
| Backend API | Sustancial | Endpoints, auth, integración ML implementados; pruebas no reejecutadas |
| Frontend | Parcial | Faltan 2 páginas; mocks presentes; pruebas no reejecutadas |
| Despliegue / DevOps | Inicial | docker-compose incompleto (falta Dockerfiles BE/FE); sin CI/CD |
| Documentación | Inicial | Informes `INFORME_*` presentes pero contradictorios; sin README raíz ni Model Card |
| Calidad / Pruebas | Parcial | Suites presentes pero no reejecutadas; sin E2E; sin CI |
