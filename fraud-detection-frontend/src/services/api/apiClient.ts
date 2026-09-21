import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { ApiError } from '@/types/api.types';

// ── Clase de error tipada de aplicación ──────────────────────────────────────

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly details?: ApiError['details']
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// ── Instancia Axios ───────────────────────────────────────────────────────────

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api/v1',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 10_000,
});

// ── Interceptor de Request: inyectar JWT ──────────────────────────────────────

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('zfe_token');
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Interceptor de Response: convertir errores HTTP a AppError ────────────────

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    const status = error.response?.status ?? 0;
    const data   = error.response?.data;

    // Session expired
    if (status === 401) {
      localStorage.removeItem('zfe_token');
      window.location.href = '/login';
      return Promise.reject(new AppError('SESSION_EXPIRED', 'Sesión expirada. Inicia sesión nuevamente.', 401));
    }

    const appError = new AppError(
      data?.error ?? 'UNKNOWN_ERROR',
      data?.message ?? mapStatusToMessage(status),
      status,
      data?.details
    );
    return Promise.reject(appError);
  }
);

function mapStatusToMessage(status: number): string {
  const messages: Record<number, string> = {
    400: 'La solicitud contiene datos inválidos.',
    403: 'No tienes permisos para realizar esta acción.',
    404: 'El recurso solicitado no existe.',
    409: 'Conflicto con un recurso existente.',
    422: 'Los datos enviados no son válidos.',
    503: 'El servicio de análisis no está disponible temporalmente.',
    500: 'Error interno del servidor. Intenta de nuevo.',
    0:   'Sin conexión. Verifica tu red.',
  };
  return messages[status] ?? 'Ocurrió un error inesperado.';
}
