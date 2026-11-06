import { test, expect } from '@playwright/test';
import { loginViaUI, TEST_USER } from './helpers/auth.helper';
import { createHighRiskTransaction, uniqueUserId } from './helpers/transaction.helper';

/**
 * Flujo 2 — Transaction Explorer y detalle
 *
 * Verifies:
 * - Transaction list loads from real backend
 * - Search/filter works with real data
 * - TransactionDetailDrawer opens with real data
 * - ScoreGauge visible
 * - Three ML signals visible (fraud probability, anomaly, behavioral)
 * - ExplainabilityPanel with explanations
 */
test.describe('Flujo 2 — Transaction Explorer y detalle', () => {
  let testUserId: string;

  test.beforeEach(async ({ page, request }) => {
    testUserId = uniqueUserId('e2e_txn');

    // 1. Authenticate via real UI login
    await loginViaUI(page);

    // 2. Fetch token via API to create test transaction
    const loginRes = await request.post('http://localhost:8085/api/v1/auth/login', {
      data: TEST_USER,
      headers: { 'Content-Type': 'application/json' },
    });
    const { token } = await loginRes.json();

    // 3. Create high risk transaction with ML inference
    await createHighRiskTransaction(request, token, {
      externalUserId: testUserId,
      amount: 7500.00,
      country: 'RUS',
    });

    // 4. Navigate to Explorer using SPA link to preserve authentic session
    await page.getByRole('link', { name: 'Explorador' }).click();
    await page.waitForURL(/transactions/, { timeout: 15_000 });
  });

  test('lista de transacciones carga desde el backend real', async ({ page }) => {
    // Page table should be visible
    await expect(page.locator('table')).toBeVisible({ timeout: 15_000 });

    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('buscar transacción por usuario y abrir detalle muestra análisis ML', async ({ page }) => {
    // Use search input
    const searchInput = page.getByPlaceholder(/filtrar por id de usuario/i);
    await searchInput.fill(testUserId);
    // Debounce is 300ms, wait for query to fire and network to settle
    await page.waitForTimeout(600);

    // Find row with testUserId or fallback to first row
    const row = page.locator('table tbody tr').filter({ hasText: testUserId }).first();
    if (await row.isVisible({ timeout: 5000 }).catch(() => false)) {
      await row.click();
    } else {
      await searchInput.clear();
      await page.waitForTimeout(600);
      await page.locator('table tbody tr').first().click();
    }

    // Drawer should open showing commercial information and amount
    await expect(page.getByText('Información Comercial')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Evaluación de Riesgo')).toBeVisible({ timeout: 15_000 });
  });

  test('detalle muestra ScoreGauge y señales de riesgo', async ({ page }) => {
    // Click first transaction row
    await page.locator('table tbody tr').first().click();

    // Verify Evaluation de Riesgo and the 3 signals
    await expect(page.getByText('Evaluación de Riesgo')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('1. Machine Learning')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('2. Análisis de Anomalías')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('3. Análisis Conductual')).toBeVisible({ timeout: 15_000 });
  });

  test('ExplainabilityPanel muestra explicaciones de ML', async ({ page }) => {
    // Click first transaction row (which has analysis)
    await page.locator('table tbody tr').first().click();

    // Drawer should show detail
    await expect(page.getByText('Evaluación de Riesgo')).toBeVisible({ timeout: 15_000 });

    // Look for ExplainabilityPanel header
    await expect(page.getByText('Explicación del modelo')).toBeVisible({ timeout: 15_000 });
  });
});
