# Documentación Técnica — ZeroFraudE

Sistema de detección de fraude en transacciones e-commerce con pipeline de ML, backend API (Spring Boot) y frontend web (React).

> **Estado de este repositorio:** rama `master`. No se ha modificado código funcional durante la redacción de esta documentación. Todos los cambios pendientes previos (archivos `target/`, `.env`, informes `INFORME_*`, `docker-compose.yml`, `scripts/`) son trabajo existente del usuario y se respetan tal como están.

## Índice general y orden de lectura recomendado

| # | Documento | Propósito | Cuándo leerlo |
|---|-----------|-----------|---------------|
| 1 | [estado-actual.md](./estado-actual.md) | Resumen del estado real del sistema, lo que está implementado vs. propuesto, y qué no puede verificarse | Lectura obligatoria primero |
| 2 | [arquitectura/overview.md](./arquitectura/overview.md) | Componentes, responsabilidades, límites entre subsistemas y diagramas de contexto, contenedores y flujos | Para entender la estructura general |
| 3 | [ml/datos-y-features.md](./ml/datos-y-features.md) | Dataset, esquema, variable objetivo, preparación, features, particiones | Para entender el subsistema ML (entrada) |
| 4 | [ml/entrenamiento-y-evaluacion.md](./ml/entrenamiento-y-evaluacion.md) | Entrenamiento, validación temporal, métricas, umbrales, artefactos | Para entender el subsistema ML (entrenamiento) |
| 5 | [ml/inferencia-y-scoring.md](./ml/inferencia-y-scoring.md) | Inferencia, scoring de riesgo, risk fusion, explainability | Para entender el subsistema ML (inferencia) |
| 6 | [backend/api-y-contratos.md](./backend/api-y-contratos.md) | Estructura de paquetes, endpoints, contratos, validaciones, manejo de errores, integración con ML | Para entender el backend |
| 7 | [frontend/arquitectura-e-integracion.md](./frontend/arquitectura-e-integracion.md) | Framework, rutas, componentes, servicios, gestión de errores, pruebas | Para entender el frontend |
| 8 | [integracion.md](./integracion.md) | Flujo de extremo a extremo, diferencias contrato-vs-implementado | Para entender la integración ML ↔ backend ↔ frontend |
| 9 | [calidad/pruebas.md](./calidad/pruebas.md) | Tecnologías, comandos, alcance de pruebas, resultados, aspectos no cubiertos | Para entender la calidad |
| 10 | [reproducibilidad.md](./reproducibilidad.md) | Requisitos, versiones, instalación, entrenamiento, ejecución, despliegue | Para ejecutar el sistema |
| 11 | [decisiones/adr-001-risk-fusion-v311.md](./decisiones/adr-001-risk-fusion-v311.md) | Decisión arquitectónica: risk score = fraud_probability, anomaly_score como señal separada | Para entender una decisión clave |
| 12 | [decisiones/adr-002-umbrales-operativos.md](./decisiones/adr-002-umbrales-operativos.md) | Decisión arquitectónica: umbrales critical=0.50, high=0.25, medium=0.05 | Para entender los umbrales |
| 13 | [trazabilidad.md](./trazabilidad.md) | Matriz de trazabilidad componente → implementación → prueba → documentación → madurez | Para seguimiento y auditoría |
| 14 | [limitaciones-y-pendientes.md](./limitaciones-y-pendientes.md) | Limitaciones conocidas, riesgos, deuda técnica, preguntas pendientes, mejoras recomendadas | Para conocer riesgos y trabajo pendiente |
| 15 | [kanban-estado.md](./kanban-estado.md) | Estado del proyecto respecto a los 5 hitos de Kanban con evidencia local | Para entender el avance por hito |

## Convenciones usadas en esta documentación

- **VERIFICADA:** afirmación comprobable con archivo, símbolo, línea, test o salida de comando del repositorio.
- **INFERIDA:** conclusión basada en evidencias indirectas o informes del proyecto, no reejecutada en esta sesión.
- **NO VERIFICABLE:** dato que no se puede confirmar con los archivos disponibles (ej. acceso a GitHub Projects online, ejecución de suites de prueba sin instalar dependencias).
- No se documenta como implementada una capacidad que solo aparece en un plan, comentario, demo o mock.
- No se exponen secretos, valores de `.env`, credenciales ni datos transaccionales sensibles. Se documentan únicamente nombres y finalidad de variables de entorno.

## Convención de enlaces

Todos los enlaces son relativos dentro de `docs/`. Las referencias al código usan rutas relativas desde la raíz del repositorio (por ejemplo `fraud_detection_ml/src/inference/service.py`).
