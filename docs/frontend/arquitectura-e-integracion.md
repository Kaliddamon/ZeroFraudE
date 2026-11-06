# Frontend — Arquitectura e integración

## 1. Framework y stack realmente utilizado

`fraud-detection-frontend/package.json`:

| Tecnología | Versión | Propósito |
|---|---|---|
| React | ^19.2.8 | Interfaz de usuario |
| TypeScript | ~6.0.2 | Tipado estricto |
| Vite | ^8.3.0 | Build tool y dev server |
| Tailwind CSS | ^3.4.19 | Estilizado (paleta institucional oscura) |
| @tanstack/react-query | ^5.103.1 | Caché, reintentos, sincronización de estado servidor |
| axios | ^1.20.0 | Cliente HTTP |
| react-router-dom | ^7.18.4 | Enrutado |
| lucide-react | ^1.47.0 | Iconos |
| recharts | ^3.10.1 | Gráficos |
| msw | ^2.15.0 | Mock Service Worker (mocks de API) |
| framer-motion | ^13.4.0 | Animaciones |
| vitest | ^3.2.7 + Testing Library + jsdom | Pruebas |
| oxlint | ^1.81.0 | Linter |

Scripts (`package.json`):
- `dev`: `vite` — servidor de desarrollo
- `build`: `tsc -b && vite build` — build de producción
- `test`: `vitest run` — ejecución de pruebas
- `lint`: `oxlint` — lint

## 2. Configuración de acceso al backend

`src/services/api/apiClient.ts`:

- Instancia Axios con `baseURL = import.meta.env.VITE_API_URL ?? '/api/v1'`.
- Timeout: 10_000 ms.
- Interceptor de request: inyección de JWT desde `localStorage.getItem('zfe_token')` como `Authorization: Bearer <token>`.
- Interceptor de response: convierte errores HTTP a `AppError`; en 401/403 (no en endpoint de login) limpia el token y redirige a `/login`.
- Mapa de mensajes por estado: 400, 403, 404, 409, 422, 503, 500, 0 (sin conexión).

Variable de entorno: `VITE_API_URL` (definida en `.env` como `http://localhost:8081/api/v1` según `docker-compose.yml` L67; el archivo `.env` local tiene `VITE_USE_MOCKS=false` pero no se encontró `VITE_API_URL` en él al leerlo — véase limitaciones).

## 3. Estructura de rutas y componentes

### Rutas (según `src/app/App.tsx` y `main.tsx`)

| Ruta | Componente | Propósito |
|---|---|---|
| `/login` | `LoginPage` | Autenticación, guarda JWT en localStorage |
| `/dashboard` | `DashboardPage` | KPIs, scatter plot, tabla de inferencia en vivo, drawer de detalle |
| `/transactions` | `TransactionExplorer` | Tabla paginada con filtros (riesgo, usuario, fechas, montos) |
| *(implícito)* | `TransactionDetailDrawer` | Drawer de detalle (no es ruta independiente, se abre sobre las páginas) |

### Páginas implementadas

| Archivo | Propósito |
|---|---|
| `src/pages/LoginPage.tsx` | Login con email/password, JWT, navegación a `/dashboard` |
| `src/pages/DashboardPage.tsx` | Dashboard con KPIs (capital protegido, volumen evaluado, fraude detectado, alertas en cola), scatter plot, distribución de severidad, tabla de inferencia en tiempo real, drawer de detalle |
| `src/pages/TransactionExplorer.tsx` | Tabla de transacciones con búsqueda por usuario, filtro por nivel de riesgo, paginación server-side, ordenación, URL search params sincronizados |

### Páginas NO implementadas (según plan Kanban FE-08, FE-09)

- **Alert Center** (gestión de alertas con revisión) — no existe en `src/pages/`.
- **User Profile** (perfil de comportamiento del usuario) — no existe en `src/pages/`.

### Componentes clave

| Archivo | Propósito |
|---|---|
| `src/components/ui/RiskBadge.tsx` | Badge visual por nivel de riesgo (LOW/MEDIUM/HIGH/CRITICAL) |
| `src/components/ui/MetricCard.tsx` | Tarjeta de métrica con valor, tendencia, icono |
| `src/components/ui/Button.tsx` | Botón con estado de carga |
| `src/components/ui/Card.tsx`, `Input.tsx`, `Badge.tsx`, `Sidebar.tsx` | Componentes atómicos |
| `src/components/ml/ModelScoreBar.tsx` | Barra de puntuación de riesgo con nivel |
| `src/components/ml/TransactionDetailDrawer.tsx` | Drawer de detalle de transacción con análisis y explicaciones |
| `src/components/ml/FraudScatterPlot.tsx` | Gráfico de dispersión de transacciones |
| `src/components/ml/MLPipelineTelemetryBar.tsx` | Barra de telemetría del pipeline ML |

## 4. Servicios de acceso al backend

| Archivo | Funciones | Endpoints |
|---|---|---|
| `src/services/api/transactions.service.ts` | `fetchTransactions(filters)`, `fetchTransactionDetail(id)` | `GET /transactions`, `GET /transactions/:id` |
| `src/services/api/apiClient.ts` | Instancia Axios con interceptores JWT y manejo de errores | Todos los endpoints |

**Nota:** No se encontró un servicio dedicado para `/auth/login`, `/alerts`, `/users/:id/behavior` o `/statistics/dashboard` en el código leído. `LoginPage` llama directamente a `apiClient.post('/auth/login', ...)`. `DashboardPage` llama a `apiClient.get('/statistics/dashboard')` y `apiClient.get('/transactions?...')` directamente.

## 5. Tipos TypeScript (contrato con el backend)

| Archivo | Tipos definidos |
|---|---|
| `src/types/api.types.ts` | `RiskLevel`, `AlertStatus`, `AlertSeverity`, `UserRole`, `AuthResponse`, `PagedResponse<T>`, `ApiError`, `PaginationParams` |
| `src/types/transaction.types.ts` | `TransactionSummary`, `TransactionDetail`, `CreateTransactionRequest`, `TransactionCreateResponse`, `TransactionFilters`, `FraudAnalysis` |
| `src/types/alert.types.ts` | `Alert`, `AlertDetail`, `DashboardStatistics`, `UserBehavior` |

Los tipos están sincronizados con los DTOs del backend (CTR-01 del plan Kanban).

## 6. Mocks (MSW)

`src/mocks/handlers.ts` define handlers MSW para todos los endpoints:
- `POST /auth/login` → devuelve token mock
- `GET /transactions` → lista paginada con filtros por riesgo
- `GET /transactions/:id` → detalle con análisis (incluye `explanations`)
- `POST /transactions` → creación mock (201)
- `GET /alerts`, `GET /alerts/:id`, `PATCH /alerts/:id/review`
- `GET /statistics/dashboard` → estadísticas mock
- `GET /users/:id/transactions`, `/users/:id/behavior`
- `GET /fraud-analysis/:id`

Fixtures realistas cubren los cuatro niveles de riesgo (LOW, MEDIUM, HIGH, CRITICAL) con `riskScore`, `riskLevel`, `explanations`, `anomalyScore`, `behavioralDeviation`.

Variable `VITE_USE_MOCKS=false` en `.env` (no versionado): no se encontró condicionamiento explícito de esta variable en los servicios leídos para activar/desactivar MSW.

## 7. Gestión de errores y estados

- `AppError` clase tipada con `code`, `message`, `statusCode`, `details`.
- Interceptor de Axios mapea códigos HTTP a mensajes amigables.
- 401/403 fuera de login → limpia `zfe_token` y redirige a `/login`.
- Estado de carga (`isLoading`) y error (`isError`) manejados con TanStack Query en `TransactionExplorer` y `DashboardPage`.
- Páginas muestran estados vacíos y de error con mensajes informativos.

## 8. Pruebas del frontend

Ubicadas en `fraud-detection-frontend/src/`:

| Archivo | Qué prueba |
|---|---|
| `transactions.service.test.ts` | `fetchTransactionDetail`: endpoint correcto, detalle con explicaciones, error 404 |
| `RiskBadge.test.tsx` | Componente RiskBadge |
| `ModelScoreBar.test.tsx` | Componente ModelScoreBar |
| `TransactionDetailDrawer.test.tsx` | Drawer de detalle |
| `MetricCard.test.tsx` | Tarjeta de métrica |

Tecnología: Vitest + React Testing Library + jsdom + MSW. Setup en `src/test/setup.ts`. Configuración en `vitest.config.ts` (jsdom, globals, alias `@`).

Según informes del proyecto: 36 tests frontend, 0 fallos (no reejecutados en esta sesión).

**Observación del skill frontend-testing:** Las pruebas deben afirmar comportamiento y nombres accesibles, no clases CSS de Tailwind (ej. `bg-emerald-500/10`). Se debe verificar que no existan assertions sobre clases CSS en los tests finales.
