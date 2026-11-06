# Backend — API y contratos

## 1. Estructura de paquetes

`fraud-detection-backend/src/main/java/com/frauddetection/`:

| Paquete | Responsabilidad | Archivos principales |
|---|---|---|
| `controller` | Endpoints REST (Capa de presentación) | `TransactionController`, `FraudAnalysisController`, `AlertController`, `AuthController`, `UserController`, `StatisticsController` |
| `service` | Lógica de negocio | `TransactionService`, `AlertService`, `AuthService`, `StatisticsService`, `UserBehaviorService` |
| `service.port` | Puertos de arquitectura hexagonal | `MLInferencePort` |
| `ml.adapter` | Adaptador de inferencia ML (HTTP) | `MLInferenceAdapter` |
| `ml.dto` | DTOs de contrato con ML Service | `MLInferenceRequest`, `MLPredictionResult` |
| `dto.request` | Esquemas de solicitud | `CreateTransactionRequest`, `LoginRequest`, `ReviewAlertRequest` |
| `dto.response` | Esquemas de respuesta | `TransactionCreateResponse`, `TransactionDetailResponse`, `TransactionSummaryResponse`, `FraudAnalysisResponse`, `AlertResponse`, `AlertDetailResponse`, `AlertReviewResponse`, `AuthResponse`, `DashboardStatisticsResponse`, `UserBehaviorResponse`, `PagedResponse`, `ErrorResponse` |
| `domain` | Entidades JPA | `Transaction`, `FraudAnalysis`, `Alert`, `User` |
| `domain.enums` | Enumerados | `AlertStatus`, `RiskLevel`, `Role` |
| `repository` | Acceso a datos (Spring Data JPA) | `TransactionRepository`, `FraudAnalysisRepository`, `AlertRepository`, `UserRepository` |
| `mapper` | Entidad ↔ DTO | `AlertMapper`, `FraudAnalysisMapper`, `TransactionMapper` |
| `exception` | Excepciones y handler global | `GlobalExceptionHandler`, `MLServiceException`, `MLTimeoutException`, `MLUnavailableException`, `InvalidMLResponseException`, `BusinessRuleException`, `DuplicateResourceException`, `FraudSystemException`, `ResourceNotFoundException` |
| `config` | Configuración Spring | `SecurityConfig`, `OpenApiConfig`, `RestTemplateConfig`, `RequestIdFilter` |
| `security` | Autenticación JWT | `JwtAuthFilter`, `JwtService` |

## 2. Endpoints confirmados (implementados)

| Endpoint | Método | Controlador | Autenticación | Descripción |
|---|---|---|---|---|
| `/api/v1/auth/login` | POST | `AuthController` | Pública | Autenticar y obtener JWT |
| `/api/v1/transactions` | POST | `TransactionController` | JWT | Registrar transacción + análisis fraude síncrono |
| `/api/v1/transactions` | GET | `TransactionController` | JWT | Listar con filtros y paginación |
| `/api/v1/transactions/{id}` | GET | `TransactionController` | JWT | Detalle completo con análisis |
| `/api/v1/fraud-analysis/{id}` | GET | `FraudAnalysisController` | JWT | Análisis de fraude por ID |
| `/api/v1/alerts` | GET | `AlertController` | JWT | Listar alertas con filtros |
| `/api/v1/alerts/{id}` | GET | `AlertController` | JWT | Detalle de alerta |
| `/api/v1/alerts/{id}/review` | PATCH | `AlertController` | JWT | Revisar alerta (marcar REVIEWED) |
| `/api/v1/users/{id}/transactions` | GET | `UserController` | JWT | Historial de transacciones por usuario |
| `/api/v1/users/{id}/behavior` | GET | `UserController` | JWT | Perfil comportamental de usuario |
| `/api/v1/statistics/dashboard` | GET | `StatisticsController` | JWT | Estadísticas del dashboard |
| `/v3/api-docs`, `/swagger-ui.html` | GET | springdoc | Pública | OpenAPI 3.0 y Swagger UI |
| `/actuator/health`, `/actuator/info` | GET | Spring Actuator | Pública | Health check |

Puerto del backend: 8081 (`application.yml` L27, `docker-compose.yml` L45).

## 3. Contrato de solicitud: crear transacción

**Request:** `POST /api/v1/transactions` con body `CreateTransactionRequest`:

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `externalUserId` | str | Sí | ID externo del usuario |
| `amount` | BigDecimal | Sí | Monto positivo |
| `timestamp` | Instant | Sí | ISO 8601 |
| `country` | str | Sí | Código país (se convierte a mayúsculas) |
| `deviceId` | str | Sí | ID dispositivo |
| `merchantId` | str | Sí | ID comercio |
| `currency` | str | No (default "USD") | Moneda |

**Response:** `TransactionCreateResponse`:
- `transactionId`: str (UUID del transaction)
- `status`: "ANALYZED" (201 Created) o "PENDING_ANALYSIS" (202 Accepted si ML falla)
- `analysis`: `FraudAnalysisResponse` (null si PENDING_ANALYSIS)
- `alertGenerated`: boolean

## 4. Contrato de integración con ML Service

El backend llama al ML Service vía `MLInferenceAdapter` (`fraud-detection-backend/src/main/java/com/frauddetection/ml/adapter/MLInferenceAdapter.java`):

- **URL:** `ml.service.url + "/predict"` (default `http://localhost:8000`, configurable via `ML_SERVICE_URL`).
- **Método:** POST con `RestTemplate`.
- **Request DTO:** `MLInferenceRequest` (snake_case vía `@JsonProperty`): `transaction_id`, `user_id`, `amount`, `timestamp`, `country`, `device_id`, `merchant_id`.
- **Response DTO:** `MLPredictionResult` (snake_case): `transaction_id`, `fraud_probability`, `anomaly_score`, `behavioral_deviation`, `risk_score`, `risk_level`, `explanations`, `model_version`, `is_cold_start`, `anomaly_alert`.

### Validación de contrato del adaptador (`validateMLResponse`, L101-130)

El adaptador valida antes de retornar:
1. `transaction_id` coincide con el request.
2. Ningún score es null (`fraud_probability`, `anomaly_score`, `behavioral_deviation`, `risk_score`).
3. Todos los scores en rango [0, 1].
4. `risk_level` ∈ {LOW, MEDIUM, HIGH, CRITICAL}.
5. `explanations` no nula ni vacía.
6. `model_version` no nula ni en blanco.

Cualquier fallo lanza `InvalidMLResponseException`.

### Resiliencia

- Timeout de conexión: 2s, lectura: 5s (`application.yml` L33-35).
- 1 reintento con delay configurable (default 500ms) solo en `SocketTimeoutException` (`MLInferenceAdapter.java` L56-62).
- Fallback: si ML falla (`MLServiceException`), la transacción se guarda con estado `PENDING_ANALYSIS` sin análisis ni alerta (`TransactionService.java` L94-105).

## 5. Orquestación de transacción (`TransactionService.createAndAnalyze`)

Flujo (`TransactionService.java` L67-137):

1. Persistir `Transaction` (repositorio).
2. Construir `MLInferenceRequest` y llamar a `mlInferencePort.predict()`.
3. Si ML falla → retornar `PENDING_ANALYSIS` (sin análisis ni alerta).
4. Persistir `FraudAnalysis` con los scores del ML.
5. Asociar análisis a la transacción.
6. Generar `Alert` si `risk_level` ∈ {HIGH, CRITICAL} (vía `AlertService.generateIfRequired()`).
7. Retornar `TransactionCreateResponse` con status "ANALYZED" y análisis completo.

Todo dentro de `@Transactional`.

## 6. Autenticación y seguridad

- **Spring Security 6** con sesiones stateless (JWT) — `SecurityConfig.java`.
- Rutas públicas: `/api/v1/auth/**`, `/swagger-ui/**`, `/v3/api-docs/**`, `/actuator/health`, `/actuator/info`.
- Todas las demás requieren autenticación.
- `JwtAuthFilter` intercepta peticiones y verifica token Bearer.
- `BCryptPasswordEncoder` con fuerza 12 (`SecurityConfig.java` L56).
- CORS con `allowedOriginPatterns("*")` (permisivo en desarrollo).
- JWT_SECRET configurado via `JWT_SECRET` con valor por defecto hardcodeado en `application.yml` L42 y `docker-compose.yml` L52 — **riesgo de secreto expuesto**.

## 7. Manejo de errores

`GlobalExceptionHandler` (`@RestControllerAdvice`) captura excepciones y retorna respuestas uniformes (estilo RFC 7807):

| Excepción | Código HTTP | Cuándo |
|---|---|---|
| `ResourceNotFoundException` | 404 | Recurso no encontrado |
| `InvalidMLResponseException` | 500/503 | Respuesta ML inválida o no disponible |
| `MLServiceException`, `MLTimeoutException`, `MLUnavailableException` | 503 | Fallo del servicio ML |
| `BusinessRuleException`, `DuplicateResourceException` | 400/409 | Reglas de negocio |
| `MethodArgumentNotValidException` | 400 | Validación de entrada (@Valid) |

Logs estructurados con SLF4J; no se filtran trazas de pila al cliente.

## 8. Persistencia

Motor: PostgreSQL 16 (`docker-compose.yml` L5-15).
Migraciones Flyway: `V1__create_users_table.sql` a `V7__insert_mock_data.sql` (`src/main/resources/db/migration/`).
`ddl-auto: validate` (Hibernate valida pero no crea/modifica tablas — `application.yml` L16).

## 9. Pruebas del backend

Ubicadas en `fraud-detection-backend/src/test/java/com/frauddetection/`:

| Archivo | Qué prueba |
|---|---|
| `TransactionServiceTest.java` | Orquestar transacción: ML éxito, ML falla (PENDING_ANALYSIS), alerta LOW/alto/crítico, petición correcta al ML port |
| `MLInferenceAdapterTest.java` | Adaptador ML (respuesta exitosa, timeout, reintento, validación de contrato) |
| `GlobalExceptionHandlerTest.java` | Handler global de excepciones |

Tecnología: JUnit 5, Mockito, AssertJ. Según informes del proyecto: 26 tests, 0 fallos (no reejecutados en esta sesión).
