#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sincronizador del Tablero Kanban a GitHub Issues y Milestones.
Lee la propuesta, genera etiquetas, hitos y actualiza o crea las tarjetas (issues)
con criterios de aceptacion robustos, exhaustivos y sin emojis.
"""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

# Soporte completo para UTF-8 en terminal Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

# Etiquetas por track con sus colores y descripciones (sin emojis)
TRACK_LABELS = {
    "ML": {
        "name": "track:ml",
        "color": "0969da",
        "description": "Componente Machine Learning (Python/FastAPI/LightGBM)",
    },
    "Backend": {
        "name": "track:backend",
        "color": "2da44e",
        "description": "Componente Backend API (Java 17/Spring Boot 3.2)",
    },
    "Frontend": {
        "name": "track:frontend",
        "color": "088c8c",
        "description": "Componente Frontend Dashboard (React/TypeScript/Tailwind)",
    },
    "DevOps": {
        "name": "track:devops",
        "color": "bc4c00",
        "description": "DevOps, Docker Compose y CI/CD GitHub Actions",
    },
    "Transversal": {
        "name": "track:cross",
        "color": "8250df",
        "description": "Contratos JSON, integracion transversal y arquitectura",
    },
    "QA": {
        "name": "track:qa",
        "color": "bf8700",
        "description": "Testing unitario, integracion y pruebas E2E",
    },
    "Extensión": {
        "name": "track:extension",
        "color": "6e7781",
        "description": "Modulos opcionales o de extension futura",
    },
}

SCOPE_LABELS = {
    "mvp": {
        "name": "scope:mvp",
        "color": "cf222e",
        "description": "Requerimiento mandatorio para el MVP",
    },
    "extension": {
        "name": "scope:extension",
        "color": "57606a",
        "description": "Funcionalidad de extension opcional",
    },
}

# Criterios de aceptacion robustecidos y tecnicamente exhaustivos para cada tarjeta
ROBUST_ACCEPTANCE_CRITERIA = {
    "INF-01": [
        "Estructura de monorepo organizada con directorios independientes para fraud-detection-backend, fraud_detection_ml y fraud-detection-frontend.",
        "Archivos .gitignore configurados por tecnologia para excluir binarios, artefactos de build (target/, build/), entornos virtuales (.venv) y variables de entorno (.env).",
        "Archivo docker-compose.yml base configurado con PostgreSQL 15, volumenes persistentes de datos, variables de entorno parametrizadas y healthcheck activo.",
        "Red interna Docker (fraud-network) configurada para permitir comunicacion segura por nombre de servicio entre backend, frontend y servicio ML.",
        "Estrategia de branching Git Flow documentada con ramas main (produccion) y develop (integracion) protegidas contra commits directos.",
    ],
    "CTR-01": [
        "Esquemas Pydantic para inferencia de ML definidos con validacion estricta de tipos, rangos numericos y campos obligatorios.",
        "DTOs en Java (Spring Boot) alineados 1:1 en estructura con los esquemas de inferencia mediante anotaciones Jackson (@JsonProperty, @JsonFormat).",
        "Interfaces TypeScript en frontend sincronizadas con los contratos de respuesta transaccional y evaluacion de riesgo.",
        "Especificacion preliminar OpenAPI 3.0 / Swagger documentando payloads de request y response con ejemplos representativos.",
        "Acuerdo formal de interfaces firmado entre los desarrolladores de Backend, Frontend y ML con versionado semantico v1.0.0.",
    ],
    "ML-01": [
        "Script automatizado de descarga y verificacion de integridad del dataset crudo mediante checksum hash SHA-256 o MD5.",
        "Validacion automatica de esquema tabular (nombres de columnas, tipos numericos/categoricos esperados y tasa de valores nulos).",
        "Notebook reproducible 01_eda.ipynb ejecutable de principio a fin sin dependencias manuales ni errores de ejecucion.",
        "Analisis formal de distribuciones estadisticas y desbalanceo severo de clases (calculo de ratio positivo/negativo y tasa de prevalencia).",
        "Generacion y almacenamiento de graficos exploratorios (matriz de correlaciones, histogramas de montos y patrones horarios) en el repositorio.",
    ],
    "BE-01": [
        "Proyecto base Spring Boot 3.2 configurado con Java 17, Spring Data JPA, Spring Validation y driver PostgreSQL.",
        "Scripts de migracion Flyway secuenciales implementados: V1__create_users_table.sql, V2__create_transactions_table.sql, V3__create_fraud_analyses_table.sql y V4__create_alerts_table.sql.",
        "Indices de rendimiento creados en base de datos para busquedas frecuentes por user_id, transaction_date, risk_level y status.",
        "Restricciones de integridad referencial (claves foraneas, checks de montos positivos y constraints unique) aplicadas y verificadas.",
        "Prueba automatizada de arranque del contexto Spring Boot con verificacion de migraciones exitosas sin errores DDL.",
    ],
    "FE-01": [
        "Proyecto frontend inicializado con Vite, React 18 y TypeScript configurado en modo estricto (strict: true).",
        "Tailwind CSS configurado con la paleta de colores institucional oscura (#0f1117 de fondo, paneles en #161b22, acentos esmeralda y severidades de riesgo).",
        "React Router v6 configurado con rutas declarativas: /dashboard, /transactions, /transactions/:id, /alerts y /profile/:userId.",
        "Layout general implementado con Sidebar de navegacion colapsable, Header superior con estado de red/sesion y area de contenido responsiva.",
        "Comando npm run build ejecutado exitosamente sin advertencias de tipos TypeScript ni errores de empaquetado.",
    ],
    "FE-02": [
        "Mock Service Worker (MSW) instalado e integrado en el ciclo de vida de la aplicacion web para interceptar peticiones de red en modo desarrollo.",
        "Tipos e interfaces TypeScript estructurados estrictamente a partir de los contratos acordados en CTR-01.",
        "Handlers de MSW desarrollados para /api/v1/transactions, /api/v1/transactions/:id, /api/v1/alerts y /api/v1/statistics/dashboard.",
        "Conjunto de fixtures de prueba realistas cubriendo los cuatro escenarios de riesgo: LOW, MEDIUM, HIGH y CRITICAL.",
        "Mecanismo de conmutacion dinamica por variable de entorno (VITE_USE_MOCKS=true/false) para alternar transparentemente entre mocks y backend real.",
    ],
    "ML-02": [
        "Division temporal estricta del dataset en tres particiones cronologicas (70% Train, 15% Validation, 15% Test) evitando filtracion temporal (look-ahead bias).",
        "Transformadores de escalado numerico (RobustScaler / StandardScaler) ajustados (fit) exclusivamente con datos de entrenamiento.",
        "Estrategia de codificacion de categorias (Target Encoding / One-Hot Encoding) con manejo explicito de categorias no vistas en inferencia.",
        "Pipeline de preprocesamiento serializado en disco (preprocessor.joblib) con metadatos de columnas y tipos.",
        "Suite de pruebas unitarias en Pytest verificando ausencia de valores NaN, dimensiones consistentes y preservacion de distribuciones.",
    ],
    "ML-03": [
        "Transformaciones matematicas de variables transaccionales implementadas (logaritmo de monto, ratio monto/media historica).",
        "Variables de periodicidad temporal ciclica modeladas mediante funciones trigonometricas seno y coseno (hora del dia y dia de la semana).",
        "Calculo de caracteristicas de velocidad transaccional en ventanas deslizantes (tx_count_5min, tx_count_1h, tx_amount_sum_24h).",
        "Pipeline modular implementado bajo la interfaz estandar BaseEstimator y TransformerMixin de Scikit-learn.",
        "Pruebas unitarias que validen la generacion correcta de caracteristicas tanto para lotes historicos como para eventos transaccionales individuales.",
    ],
    "ML-04": [
        "Modelo de regresion logistica entrenado como linea base comparativa con regularizacion L2 sobre datos preprocesados.",
        "Modulo de evaluacion desacoplado que calcule PR-AUC (Precision-Recall AUC), ROC-AUC, F1-Score optimizado y matriz de confusion.",
        "Funcion de costo de negocio implementada que compute el impacto economico de falsos positivos (friccion comercial) vs falsos negativos (fraude consumado).",
        "Persistencia de resultados y curvas de evaluacion en formato JSON estructurado (metrics_baseline.json).",
        "Documentacion de tiempos de inferencia y metricas de desempeno del modelo base para servir de benchmark al modelo principal.",
    ],
    "ML-05": [
        "Modelo de arboles potenciados por gradiente (LightGBM) entrenado optimizando parametros criticos (num_leaves, max_depth, learning_rate, scale_pos_weight).",
        "Calibracion y optimizacion de umbrales de clasificacion (Threshold Tuning) sobre el conjunto de validacion maximizando la metrica de costo de negocio.",
        "Superacion comprobada y cuantificada de la metrica PR-AUC del modelo LightGBM respecto a la linea base de regresion logistica.",
        "Serializacion del modelo entrenado y calibrado (fraud_model.joblib) junto con el archivo de configuracion de hiperparametros.",
        "Pruebas unitarias de inferencia verificando que las probabilidades emitidas esten acotadas estrictamente en el intervalo [0.0, 1.0].",
    ],
    "BE-02": [
        "Configuracion de Spring Security 6 con politica de sesion sin estado (SessionCreationPolicy.STATELESS) y proteccion CSRF adaptada.",
        "Almacenamiento seguro de credenciales con hashing BCrypt (factor de trabajo >= 10) y gestion de usuarios en base de datos.",
        "Endpoint POST /api/v1/auth/login funcional que valide credenciales y retorne token de acceso JWT firmado con clave secreta HMAC-SHA256.",
        "Filtro de autenticacion JwtAuthenticationFilter interceptando peticiones HTTP y verificando expiracion, firma y claims del token Bearer.",
        "Autorizacion basada en roles (ROLE_ANALYST, ROLE_ADMIN) protegiendo rutas sensibles con respuestas estandarizadas 401 Unauthorized y 403 Forbidden.",
    ],
    "BE-03": [
        "Endpoint POST /api/v1/transactions con validaciones de entrada exhaustivas (@NotNull, @Positive, codigos de divisa ISO, longitudes maximas).",
        "Endpoint GET /api/v1/transactions implementado con paginacion server-side completa mediante Pageable de Spring Data (page, size, sort).",
        "Filtros dinamicos multi-criterio implementados mediante JPA Specifications (rango de fechas, rango de montos, nivel de riesgo y cliente).",
        "Mapeo desacoplado de entidades de dominio JPA a DTOs de respuesta garantizando no exponer detalles internos de persistencia.",
        "Pruebas de integracion con MockMvc verificando codigos de respuesta HTTP (200 OK, 201 Created, 400 Bad Request) y payloads JSON.",
    ],
    "FE-03": [
        "Componente RiskBadge desarrollado con variantes visuales estrictas para los niveles LOW, MEDIUM, HIGH y CRITICAL.",
        "Accesibilidad garantizada en RiskBadge incorporando icono representativo y texto explicativo, cumpliendo pautas WCAG de contraste de color.",
        "Componente MetricCard implementado con soporte para titulo descriptivo, valor numerico/monetario formateado, indicador de tendencia e icono.",
        "Estados de carga esqueletica (Skeleton loaders) integrados en los componentes atómicos para transiciones visuales suaves.",
        "Suite de pruebas unitarias en Vitest y React Testing Library verificando renderizado de props y variantes de estilo.",
    ],
    "FE-04": [
        "Cuadricula de KPIs analiticos en Dashboard (Total de Transacciones, Tasa de Fraude, Monto en Riesgo y Alertas Pendientes) utilizando MetricCard.",
        "Grafico circular (Donut Chart) con Recharts que represente la distribucion porcentual de transacciones segun categoria de riesgo.",
        "Grafico de area temporal con Recharts mostrando la evolucion de transacciones legitimas vs sospechosas en ventana de 7 dias.",
        "Mini-tabla interactiva con las 5 transacciones de mayor criticidad recientes, con vinculo directo a la vista de detalle.",
        "Manejo robusto de estados de carga, reconexion y pantallas de error ante indisponibilidad del servicio de datos.",
    ],
    "FE-05": [
        "Tabla de transacciones interactiva con visualizacion de ID, fecha y hora, cliente, monto formateado, canal de pago y RiskBadge.",
        "Barra de filtros reactivos multi-criterio: busqueda por texto, selector de nivel de riesgo, selector de rango de fechas y filtro de montos.",
        "Control de paginacion server-side con navegacion entre paginas, selector de elementos por pagina (10, 25, 50) y contador total.",
        "Integracion con TanStack Query (@tanstack/react-query) con gestion de cache, reintentos automaticos y debounce de 300ms en filtros de texto.",
        "Sincronizacion bidireccional de los filtros activos en los parametros de consulta de la URL (URL search params) para navegacion reproducible.",
    ],
    "ML-06": [
        "Modulo de calculo de perfiles historicos agregados por cliente (monto promedio, desviacion estandar, ubicaciones frecuentes y horas habituales).",
        "Calculo matematico del Z-Score del monto transaccional respecto a la distribucion historica del cliente.",
        "Generacion de indicadores de desviacion conductual: nuevo dispositivo (is_new_device), nueva ubicacion geografica y salto de velocidad.",
        "Mecanismo de contingencia para clientes sin historial previo (Cold Start con K < 5 transacciones) asignando perfiles de poblacion general.",
        "Pruebas unitarias verificando la precision de los calculos estadisticos y el comportamiento determinista ante perfiles frios.",
    ],
    "ML-07": [
        "Modulo de Risk Fusion que integre mediante combinacion lineal ponderada la probabilidad supervisada, score de anomalia y desviacion conductual.",
        "Reglas de umbrales calibradas para segmentar el score consolidado en cuatro rangos discretos: LOW, MEDIUM, HIGH y CRITICAL.",
        "Sistema de politicas heuristicas de sobrescritura (override) inmediata para transacciones con patrones de fraude critico inequívoco.",
        "Archivo de configuracion thresholds.json desacoplado y versionado para permitir ajustes de pesos y umbrales sin modificar codigo.",
        "Pruebas unitarias de cobertura exhaustiva sobre valores frontera (0.0, 0.3, 0.6, 0.85, 1.0) y activacion de reglas heuristicas.",
    ],
    "ML-08": [
        "Clase de servicio FraudDetectionService implementada con metodo unificado predict(transaction_payload: dict) -> dict.",
        "Validacion estricta de entrada con esquema Pydantic TransactionInputSchema rechazando tipos invalidos y datos incompletos.",
        "Formato de respuesta normalizado incluyendo score continuo [0.0, 1.0], categoria de riesgo, desglose de subcomponentes y lista de factores explicativos.",
        "Control centralizado de excepciones retornando codigos de error semanticos ante fallos de preprocesamiento o datos atipicos.",
        "Medicion y garantia de latencia de inferencia local en memoria inferior a 150 milisegundos por transaccion.",
    ],
    "BE-04": [
        "Definicion de interfaz MLInferencePort en la capa de aplicacion siguiendo principios de arquitectura hexagonal.",
        "Implementacion de MLInferenceAdapter utilizando RestClient o WebClient de Spring Boot para llamadas HTTP al microservicio ML.",
        "Configuracion de timeouts estrictos (timeout de conexion de 2s y timeout de lectura de 5s) para evitar bloqueos del hilo de ejecucion.",
        "Mecanismo de degradacion elegante (fallback) que aplique clasificacion preventiva basada en reglas si el servicio ML no responde.",
        "Pruebas unitarias con WireMock simulando respuestas exitosas, respuestas lentas con timeout y codigos de error HTTP 500/503.",
    ],
    "BE-05": [
        "Orquestacion completa en TransactionService: persistir transaccion cruda -> invocar MLInferencePort -> persistir analisis en fraud_analyses.",
        "Generacion automatica de registro en tabla alerts cuando la evaluacion de riesgo resulte en clasificacion HIGH o CRITICAL.",
        "Manejo transaccional atomico (@Transactional) asegurando consistencia de datos entre transaccion, analisis y alerta.",
        "Respuesta HTTP 201 Created retornando el payload unificado con los datos de la transaccion y el resultado completo de evaluacion de riesgo.",
        "Test de integracion E2E en backend comprobando el ciclo de vida completo de una transaccion fraudulenta y la creacion de su alerta.",
    ],
    "BE-06": [
        "Clase controladora de excepciones global anotada con @RestControllerAdvice capturando errores en toda la capa de controladores.",
        "Estructura uniforme de respuesta de error conforme al estandar RFC 7807 (Problem Details for HTTP APIs: type, title, status, detail, timestamp, path).",
        "Mapeo de errores de validacion (@Valid / MethodArgumentNotValidException) detallando la lista de campos especificos con fallo.",
        "Mapeo de excepciones de negocio: ResourceNotFoundException (404), BadCredentialsException (401), AccessDeniedException (403) y MLServiceException (503).",
        "Registro de logs estructurados con niveles adecuados (WARN para validaciones, ERROR para caidas de servicios) sin filtrar trazas de pila al cliente.",
    ],
    "FE-06": [
        "Vista de detalle de transaccion estructurada en dos paneles coordinados: informacion comercial e indicador de analisis analitico.",
        "Panel de transaccion visualizando fecha, cliente, comercio, canal, tarjeta enmascarada, monto e IP de origen.",
        "Panel de evaluacion con indicador visual radial/gauge del score consolidado y desglose de las tres fuentes (ML, Anomalia, Conducta).",
        "Accion contextual para crear alerta manual o marcar alerta existente como revisada directamente desde la vista.",
        "Manejo de estado de transaccion no encontrada (404) con mensaje informativo y navegacion segura hacia el Transaction Explorer.",
    ],
    "FE-07": [
        "Componente ExplainabilityPanel desarrollado para traducir los pesos matematicos de inferencia en explicaciones comprensibles en lenguaje natural.",
        "Barras de impacto relativo visualizando la contribucion positiva o negativa de cada variable a la decision de riesgo final.",
        "Enlace directo y contextual hacia la vista de Behavioral Profile del usuario asociado a la transaccion inspeccionada.",
        "Diseno intuitivo adaptado para analistas de operaciones de fraude sin exigir conocimientos avanzados de Machine Learning.",
        "Pruebas de componentes simulando diversos factores explicativos y verificando renderizado correcto de textos y porcentajes.",
    ],
    "ML-09": [
        "Modelo Isolation Forest entrenado sobre variables numericas normalizadas utilizando unicamente registros transaccionales legitimos.",
        "Calibracion del hiperparametro contamination ajustado a la tasa historica esperada de eventos anomalos en el negocio.",
        "Estandarizacion y escalado del score de decision nativo de Scikit-learn para transformarlo en una escala normalizada en el rango [0.0, 1.0].",
        "Integracion del score de anomalia resultante en el pipeline de Risk Fusion de forma desacoplada.",
        "Validacion empirica sobre transacciones sinteticas atipicas comprobando que obtienen puntuaciones de anomalia significativamente superiores al promedio.",
    ],
    "ML-10": [
        "Integracion de shap.TreeExplainer inicializado y optimizado sobre el modelo LightGBM entrenado.",
        "Extraccion automatizada de los Top 3 a 5 factores de mayor valor absoluto de contribucion SHAP para cada inferencia individual.",
        "Modulo de traduccion que convierta las variables y sus valores SHAP en afirmaciones semanticas legibles (por ejemplo, Monto 3.8x superior al promedio).",
        "Optimizacion de rendimiento garantizando que el computo de explicaciones no incremente la latencia total de inferencia en mas de 50ms.",
        "Pruebas unitarias comprobando consistencia entre la direccion de los valores SHAP y el sentido del score de prediccion.",
    ],
    "BE-07": [
        "Endpoint GET /api/v1/alerts con paginacion server-side y filtros por estado (OPEN, UNDER_REVIEW, RESOLVED, DISMISSED) y nivel de severidad.",
        "Endpoint PATCH /api/v1/alerts/{id}/review permitiendo actualizar estado, agregar notas de investigacion y registrar analista revisor.",
        "Mecanismo de auditoria registrando marca temporal de revision (reviewed_at) e identificador del usuario autenticado que efectuo la accion.",
        "Validaciones de maquina de estados para impedir modificaciones sobre alertas ya finalizadas sin permisos administrativos.",
        "Pruebas de integracion con MockMvc verificando persistencia de notas, actualizacion de estados y respuesta HTTP 200 OK.",
    ],
    "BE-08": [
        "Endpoint GET /api/v1/statistics/dashboard implementado con consultas agregadas optimizadas en PostgreSQL mediante funciones nativas o indices.",
        "Payload consolidado conteniendo: total de transacciones procesadas, transacciones sospechosas, tasa porcentual de fraude y volumen economico retenido.",
        "Serie temporal con desglose diario de los ultimos 7 o 30 dias para alimentar graficos de evolucion de fraude en el frontend.",
        "Optimizacion de tiempo de respuesta garantizando ejecucion en menos de 300 milisegundos con volumenes de prueba de 100,000 registros.",
        "Pruebas de servicio y repositorio asegurando consistencia numerica entre las estadisticas agregadas y los registros individuales.",
    ],
    "FE-08": [
        "Vista de Alert Center con tabla de alertas activas, filtros rapidos por estado (Pendientes, En Revision, Resueltas) y badges de severidad.",
        "Drawer lateral o modal contextual que permita inspeccionar los detalles de la alerta sin perder la posicion en la lista de trabajo.",
        "Formulario interactivo de revision con selector de decision (Fraude Confirmado, Falso Positivo, Requiere Seguimiento) y campo de notas.",
        "Actualizacion optimista de la interfaz o invalidacion automatica de queries con TanStack Query al confirmar la revision.",
        "Notificaciones visuales emergentes (Toast) confirmando la actualizacion exitosa o notificando posibles errores de red.",
    ],
    "FE-09": [
        "Vista dedicada de perfil de usuario visualizando metricas agregadas: antiguedad, volumen transaccional, ticket medio y canales frecuentes.",
        "Grafico o panel comparativo que contraste los valores de la transaccion sospechosa actual contra el patron historico habitual del cliente.",
        "Historial cronologico de transacciones del usuario con indicadores de riesgo individuales y estados de revision.",
        "Identificacion visual explicita de estado de Cold Start para clientes recientes con menos de 5 transacciones registradas.",
        "Pruebas de renderizado verificando visualizacion correcta para usuarios nuevos sin historial y para clientes con amplio historial.",
    ],
    "QA-01": [
        "Backend: Cobertura global de pruebas unitarias y de integracion superior al 65% verificada mediante reporte automatizado de JaCoCo.",
        "ML: Suite completa en Pytest con pruebas unitarias para preprocesamiento, generacion de features, modelos, Z-scores y Risk Fusion.",
        "Frontend: Pruebas unitarias y de integracion de componentes con Vitest y React Testing Library cubriendo componentes y utilitarios criticos.",
        "Comandos unificados de testing documentados para cada componente (mvn test, pytest, npm test).",
        "Ejecucion completa de todas las suites en entorno local finalizando con 100% de pruebas pasando satisfactoriamente sin fallos.",
    ],
    "INF-02": [
        "Dockerfile multi-stage para servicio ML (FastAPI/Uvicorn) basado en imagen ligera python:3.11-slim, usuario no root y dependencias compiladas.",
        "Dockerfile multi-stage para Backend Spring Boot con Eclipse Temurin 17 JRE, build automatizado con Maven Wrapper y optimizacion de capas.",
        "Dockerfile multi-stage para Frontend con Node.js en etapa de compilacion y servidor Nginx Alpine para estaticos con ruteo SPA (try_files).",
        "Variables de entorno parametrizadas de forma segura sin credenciales ni secretos quemados en el codigo de las imagenes.",
        "Verificacion de compilacion exitosa de las tres imagenes y arranque de contenedores con consumo moderado de memoria y CPU.",
    ],
    "INT-01": [
        "Archivo docker-compose.yml maestro configurado orquestando los cuatro servicios: PostgreSQL, microservicio ML, API Backend y Frontend Nginx.",
        "Dependencias de inicio sincronizadas mediante clausula depends_on con condition service_healthy asegurando arranque secuencial ordenado.",
        "Comunicacion de red verificada entre contenedores utilizando la red interna de Docker y resolucion DNS interna por nombre de servicio.",
        "Integracion del frontend con la API real mediante configuracion de proxy inverso o variable VITE_API_URL desactivando MSW.",
        "Verificacion manual o asistida del flujo E2E: inicio de sesion -> creacion de transaccion -> evaluacion ML -> visualizacion en dashboard.",
    ],
    "ML-11": [
        "Evaluacion final y rigurosa de los modelos predictivos sobre el conjunto de prueba reservado (Test Set del 15%) sin contaminacion de datos.",
        "Generacion y guardado de graficos de evaluacion: Curva Precision-Recall (PR), Curva ROC, Matriz de Confusion y Curva de Costo vs Umbral.",
        "Tabla comparativa formal documentando metricas de desempeno: Baseline (Regresion Logistica) vs LightGBM vs Sistema Hibrido.",
        "Documento estructurado de metricas finales (final_metrics_report.md) con PR-AUC, F1-Score, Brier Score, Precision y Recall.",
        "Conclusiones tecnicas redactadas analizando el comportamiento de los modelos ante el desbalanceo severo y las implicaciones operativas.",
    ],
    "DOC-01": [
        "Integracion completa de springdoc-openapi en Spring Boot con interfaz Swagger UI accesible en la ruta /swagger-ui.html.",
        "Documentacion de la totalidad de endpoints REST con resumenes tecnicos, tags por dominio y codigos de respuesta HTTP documentados.",
        "Modelos de peticion y respuesta anotados con esquemas descriptivos (@Schema) y valores de ejemplo validos.",
        "Configuracion de esquema de seguridad Bearer JWT en Swagger UI permitiendo autenticarse y ejecutar peticiones directamente desde la UI.",
        "Exportacion y versionado del archivo de especificacion estandar OpenAPI 3.0 (openapi.json o openapi.yaml) en el repositorio.",
    ],
    "QA-02": [
        "Framework Playwright configurado en el proyecto frontend para ejecucion de pruebas de extremo a extremo en navegadores reales.",
        "Prueba E2E automatizada del flujo critico de usuario: autenticacion con credenciales validas -> visualizacion de metricas en Dashboard.",
        "Prueba E2E automatizada de exploracion: busqueda de transacciones con filtros en Explorer -> apertura de vista de detalle -> analisis de factores.",
        "Prueba E2E automatizada de gestion operativa: apertura de Alert Center -> consulta de alerta -> actualizacion de estado con notas de revision.",
        "Captura automatica de screenshots y trazas de ejecucion ante fallos y verificacion exitosa en ejecucion headless.",
    ],
    "EXT-01": [
        "Modulo de clustering no supervisado implementado con algoritmo DBSCAN o HDBSCAN sobre caracteristicas de transacciones sospechosas.",
        "Ajuste y calibracion de hiperparametros de densidad (eps y min_samples) para aislar patrones de ataque coordinado respecto al ruido disperso.",
        "Calculo de metricas de dispersion de cluster y asignacion de indice de confianza a las agrupaciones anomalas detectadas.",
        "Generacion de reporte de tipologias emergentes detallando centroides, cantidad de transacciones involucradas y factores comunes.",
        "Pruebas unitarias con datos sinteticos verificando la identificacion efectiva de agrupaciones de transacciones anomalas correlacionadas.",
    ],
    "DOC-02": [
        "Documento README.md principal consolidado con descripcion del proyecto, arquitectura global, requisitos previos y guia de inicio rapido en un comando.",
        "Model Card formal elaborada conforme a estandares de la industria, documentando proposito, metricas, limitaciones tecnicas, sesgos y consideraciones eticas.",
        "Diagramas de arquitectura de software y flujo de datos actualizados e integrados en la documentacion tecnica del repositorio.",
        "Video de demostracion o guion de demostracion detallado (walkthrough funcional de 3 a 5 minutos) exhibiendo las caracteristicas principales del sistema.",
        "Repositorio auditado y depurado, libre de artefactos temporales o credenciales, con verificacion de integracion continua lista para presentacion final.",
    ],
}


def run_gh_cmd(args, input_data=None, check=True):
    """Ejecuta un comando de GitHub CLI (`gh`) de forma segura."""
    cmd = ["gh"] + args
    result = subprocess.run(
        cmd,
        input=input_data,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    if check and result.returncode != 0:
        raise RuntimeError(
            f"Error ejecutando {' '.join(cmd)}:\nSTDERR: {result.stderr}\nSTDOUT: {result.stdout}"
        )
    return result


def get_default_repo():
    """Detecta el repositorio GitHub actual."""
    try:
        res = subprocess.run(
            ["git", "config", "--get", "remote.origin.url"],
            capture_output=True,
            text=True,
            check=True,
        )
        url = res.stdout.strip()
        match = re.search(r"github\.com[:/]([^/]+)/([^/\.]+)", url)
        if match:
            return f"{match.group(1)}/{match.group(2)}"
    except Exception:
        pass
    return "Kaliddamon/ZeroFraudE"


def parse_kanban_markdown(file_path: Path):
    """Parsea el archivo Markdown y extrae hitos y tarjetas."""
    content = file_path.read_text(encoding="utf-8")

    sections = re.split(r"(### Hito \d+: [^\n]+)", content)
    milestones_data = []

    for i in range(1, len(sections), 2):
        header = sections[i].strip().replace("### ", "")
        body = sections[i + 1] if i + 1 < len(sections) else ""

        meta_match = re.search(r"\*Meta:\s*([^\*]+)\*", body)
        meta_desc = meta_match.group(1).strip() if meta_match else ""

        items = []
        rows = re.findall(
            r"\|\s*\*\*([A-Z0-9-]+)\*\*\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|",
            body,
        )

        for card_id, track, title, est, criteria in rows:
            items.append(
                {
                    "id": card_id.strip(),
                    "track": track.strip(),
                    "title": title.strip(),
                    "est": est.strip(),
                    "criteria": criteria.strip(),
                }
            )

        milestones_data.append(
            {
                "title": header,
                "description": meta_desc,
                "items": items,
            }
        )

    return milestones_data


def build_issue_body(item: dict, milestone_title: str) -> str:
    """Genera el contenido markdown del cuerpo del issue, sin emojis y con criterios robustos."""
    card_id = item["id"]
    track = item["track"]
    est = item["est"]

    # Usar criterios robustos predefinidos si existen para este ID
    if card_id in ROBUST_ACCEPTANCE_CRITERIA:
        criteria_list = ROBUST_ACCEPTANCE_CRITERIA[card_id]
    else:
        criteria_raw = item["criteria"]
        if "<br>" in criteria_raw:
            criteria_list = [p.strip().lstrip("•*- ") for p in criteria_raw.split("<br>") if p.strip()]
        elif ";" in criteria_raw:
            criteria_list = [p.strip() for p in criteria_raw.split(";") if p.strip()]
        else:
            criteria_list = [criteria_raw]

    criteria_md = "\n".join([f"- [ ] {c}" for c in criteria_list])

    body = f"""### Contexto y Objetivo
Tarjeta **{card_id}** perteneciente al track **{track}** dentro de **{milestone_title}**.

### Estimacion de Esfuerzo
- Tiempo estimado: `{est}`

### Criterios de Aceptacion (Definition of Done)
{criteria_md}

---
*ZeroFraudE — Deteccion Adaptativa de Fraude en E-commerce*
"""
    return body


def update_or_sync_issues(repo: str, milestones_data: list, dry_run: bool):
    """Actualiza los issues existentes con la nueva descripcion y criterios robustos sin emojis."""
    print(f"\nObteniendo issues existentes en: {repo}")
    res = run_gh_cmd(
        ["issue", "list", "--repo", repo, "--limit", "200", "--json", "number,title", "--state", "all"]
    )
    existing_issues = json.loads(res.stdout)
    
    # Mapeo por ID de tarjeta, por ejemplo 'INF-01' -> issue_number
    card_to_issue = {}
    for iss in existing_issues:
        title = iss["title"]
        match = re.search(r"\[([A-Z0-9-]+)\]", title)
        if match:
            card_to_issue[match.group(1)] = iss["number"]

    print(f"Se encontraron {len(card_to_issue)} issues vinculados a tarjetas en el repositorio.")

    count = 0
    for m in milestones_data:
        m_title = m["title"]
        for item in m["items"]:
            card_id = item["id"]
            title = f"[{card_id}] {item['title']}"
            body = build_issue_body(item, m_title)

            if card_id in card_to_issue:
                issue_num = card_to_issue[card_id]
                if dry_run:
                    print(f"\n[DRY-RUN ACTUALIZACION] Issue #{issue_num}: {title}")
                    print(body[:300] + "...\n[Criterios restantes]")
                else:
                    print(f"-> Actualizando issue #{issue_num}: {title} ...")
                    run_gh_cmd(
                        ["issue", "edit", str(issue_num), "--repo", repo, "--body-file", "-"],
                        input_data=body,
                    )
                    print(f"   Actualizado con exito.")
                count += 1
            else:
                # Si por alguna razon no existiera, crearlo
                labels = []
                track_name = item["track"]
                if track_name in TRACK_LABELS:
                    labels.append(TRACK_LABELS[track_name]["name"])
                else:
                    labels.append("track:cross")

                if card_id.startswith("EXT-") or "Opcional" in item["title"]:
                    labels.append("scope:extension")
                else:
                    labels.append("scope:mvp")

                if dry_run:
                    print(f"\n[DRY-RUN CREACION] {title}")
                else:
                    print(f"-> Creando nuevo issue: {title} ...")
                    cmd = [
                        "issue",
                        "create",
                        "--repo",
                        repo,
                        "--title",
                        title,
                        "--body",
                        body,
                        "--milestone",
                        m_title,
                    ]
                    for lbl in labels:
                        cmd.extend(["--label", lbl])
                    run_gh_cmd(cmd)
                    print(f"   Creado con exito.")
                count += 1

    print(f"\nProceso finalizado. Total de issues actualizados/sincronizados: {count}")


def main():
    parser = argparse.ArgumentParser(description="Actualiza las descripciones y criterios de aceptacion de los issues.")
    parser.add_argument(
        "--file",
        type=str,
        default=r"C:\Users\CRIST\.gemini\antigravity-ide\brain\b0803df9-c46a-4525-ad0b-a2d2789c4280\kanban_board_proposal.md",
        help="Ruta al archivo Markdown de la propuesta Kanban",
    )
    parser.add_argument(
        "--repo",
        type=str,
        default=None,
        help="Repositorio GitHub (ej: Kaliddamon/ZeroFraudE)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simula la actualizacion sin modificar GitHub",
    )

    args = parser.parse_args()
    md_file = Path(args.file)

    if not md_file.exists():
        print(f"Error: El archivo {md_file} no existe.")
        sys.exit(1)

    repo = args.repo or get_default_repo()
    print("=" * 70)
    print("ACTUALIZADOR DE CRITERIOS DE ACEPTACION (SIN EMOJIS)")
    print(f"Repositorio: {repo}")
    print(f"Modo:        {'DRY-RUN (Simulacion)' if args.dry_run else 'PRODUCCION (Actualizacion real)'}")
    print("=" * 70)

    milestones_data = parse_kanban_markdown(md_file)
    update_or_sync_issues(repo, milestones_data, args.dry_run)


if __name__ == "__main__":
    main()
