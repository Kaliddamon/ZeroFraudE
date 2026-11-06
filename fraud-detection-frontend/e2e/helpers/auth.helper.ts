import { type Page } from '@playwright/test';

const BASE_API = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:8085';

export const TEST_USER = {
  email: 'admin@frauddetection.com',
  password: 'Admin2024',
} as const;

/**
 * Authenticates via API and stores JWT in localStorage.
 * Avoids going through the UI login form for setup steps.
 */
export async function loginViaApi(page: Page): Promise<string> {
  const response = await page.request.post(`${BASE_API}/api/v1/auth/login`, {
    data: TEST_USER,
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok()) {
    throw new Error(`Login failed: ${response.status()} ${await response.text()}`);
  }

  const body = await response.json();
  const token: string = body.token ?? body.accessToken ?? body.jwt;

  if (!token) {
    throw new Error(`No token in auth response: ${JSON.stringify(body)}`);
  }

  // Inject token into browser localStorage so apiClient interceptor picks it up
  await page.goto('/login');
  await page.evaluate((t) => localStorage.setItem('zfe_token', t), token);

  return token;
}

/**
 * Full UI login flow — used in auth-dashboard spec.
 */
export async function loginViaUI(page: Page): Promise<void> {
  await page.goto('/login');
  await page.locator('input[name="email"]').fill(TEST_USER.email);
  await page.locator('input[name="password"]').fill(TEST_USER.password);
  await page.getByRole('button', { name: /ingresar al sistema|iniciar sesión|login|ingresar/i }).click();
  await page.waitForURL(/dashboard/, { timeout: 15_000 });
}

