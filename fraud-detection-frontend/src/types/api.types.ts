// ── API Types (contrato CTR-01 sincronizado con Backend DTOs) ─────────────────

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AlertStatus = 'OPEN' | 'REVIEWED';
export type AlertSeverity = 'HIGH' | 'CRITICAL';
export type UserRole = 'ANALYST' | 'ADMIN';

// ── Auth ──────────────────────────────────────────────────────────────────────
export interface AuthResponse {
  token: string;
  tokenType: 'Bearer';
  expiresIn: number;
  userId: string;
  role: UserRole;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// ── Paginación ────────────────────────────────────────────────────────────────
export interface PagedResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

// ── Error Estándar ────────────────────────────────────────────────────────────
export interface ApiError {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
  details?: Array<{ field: string; error: string; rejectedValue: unknown }>;
}

// ── Query Params comunes ───────────────────────────────────────────────────────
export interface PaginationParams {
  page?: number;
  size?: number;
  sort?: string;
}
