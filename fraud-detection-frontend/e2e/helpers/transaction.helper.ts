import { type APIRequestContext } from '@playwright/test';
import { createApiHelper } from './api.helper';

/** Generates a unique external user ID per test run */
export function uniqueUserId(prefix = 'e2e_usr'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Generates a unique device ID */
export function uniqueDeviceId(): string {
  return `dev_e2e_${Date.now()}`;
}

/** Generates a unique merchant ID */
export function uniqueMerchantId(): string {
  return `mch_e2e_${Date.now()}`;
}

/**
 * Creates a HIGH-risk transaction via API (amount >5000, country RUS)
 * which should trigger automatic alert generation via ML inference.
 */
export async function createHighRiskTransaction(
  request: APIRequestContext,
  token: string,
  overrides: Partial<{
    externalUserId: string;
    amount: number;
    country: string;
  }> = {}
) {
  const api = createApiHelper(request, token);
  return api.createTransaction({
    externalUserId: overrides.externalUserId ?? uniqueUserId('e2e_high'),
    amount: overrides.amount ?? 8500.0,
    timestamp: new Date().toISOString(),
    country: overrides.country ?? 'RUS',
    deviceId: uniqueDeviceId(),
    merchantId: uniqueMerchantId(),
    currency: 'USD',
  });
}

/**
 * Creates a LOW-risk transaction via API (small amount, US country)
 * which should NOT trigger automatic alert generation.
 */
export async function createLowRiskTransaction(
  request: APIRequestContext,
  token: string,
  overrides: Partial<{
    externalUserId: string;
    amount: number;
  }> = {}
) {
  const api = createApiHelper(request, token);
  return api.createTransaction({
    externalUserId: overrides.externalUserId ?? uniqueUserId('e2e_low'),
    amount: overrides.amount ?? 15.0,
    timestamp: new Date().toISOString(),
    country: 'USA',
    deviceId: uniqueDeviceId(),
    merchantId: uniqueMerchantId(),
    currency: 'USD',
  });
}

