import { type APIRequestContext } from '@playwright/test';

const BASE_API = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:8085';

/**
 * Returns an authenticated API helper bound to the given request context.
 */
export function createApiHelper(request: APIRequestContext, token: string) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  return {
    /** POST /api/v1/transactions — creates a transaction and triggers ML inference */
    async createTransaction(payload: {
      externalUserId: string;
      amount: number;
      timestamp: string;
      country: string;
      deviceId: string;
      merchantId: string;
      currency?: string;
    }) {
      const res = await request.post(`${BASE_API}/api/v1/transactions`, {
        data: { currency: 'USD', ...payload },
        headers,
      });
      if (!res.ok()) {
        throw new Error(`createTransaction failed: ${res.status()} ${await res.text()}`);
      }
      return res.json();
    },

    /** POST /api/v1/alerts — manually creates an alert */
    async createAlert(payload: {
      transactionId: string;
      severity: string;
      description: string;
    }) {
      const res = await request.post(`${BASE_API}/api/v1/alerts`, {
        data: payload,
        headers,
      });
      if (!res.ok()) {
        throw new Error(`createAlert failed: ${res.status()} ${await res.text()}`);
      }
      return res.json();
    },

    /** GET /api/v1/alerts — list alerts with optional filters */
    async getAlerts(params?: Record<string, string>) {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      const res = await request.get(`${BASE_API}/api/v1/alerts${qs}`, { headers });
      if (!res.ok()) {
        throw new Error(`getAlerts failed: ${res.status()} ${await res.text()}`);
      }
      return res.json();
    },

    /** GET /api/v1/transactions — list transactions */
    async getTransactions(params?: Record<string, string>) {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      const res = await request.get(`${BASE_API}/api/v1/transactions${qs}`, { headers });
      if (!res.ok()) {
        throw new Error(`getTransactions failed: ${res.status()} ${await res.text()}`);
      }
      return res.json();
    },
  };
}

