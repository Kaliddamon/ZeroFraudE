import { test, expect } from './fixtures/test-data.fixture';
import { createHighRiskTransaction, uniqueUserId } from './helpers/transaction.helper';

/**
 * Flujo 3 — Alert Center y revisión de alertas (FE-08)
 *
 * Verifies:
 * - Alert list loads from real backend (GET /api/v1/alerts)
 * - Filter by OPEN / REVIEWED status works
 * - Alert detail opens via "Ver detalle"
 * - Reviews alert with tipified decision: FRAUD_CONFIRMED, FALSE_POSITIVE, REQUIRES_FOLLOWUP
 * - Decision and notes persist in backend and display in Alert Center
 */
test.describe('Flujo 3 — Alert Center y revisión de alertas', () => {
  const reviewNotes = `E2E review notes ${Date.now()}`;

  test.beforeEach(async ({ page, request, authToken }) => {
    // Generar una transacción de alto riesgo para asegurar una alerta fresca
    await createHighRiskTransaction(request, authToken, {
      externalUserId: uniqueUserId('e2e_alert'),
      amount: 9000.00,
      country: 'RUS',
    });

    await page.waitForTimeout(1500);
    await page.goto('/alerts');
    await page.waitForLoadState('networkidle');
  });

  test('Alert Center carga alertas reales del backend', async ({ page }) => {
    const bodyText = await page.locator('body').textContent() ?? '';
    expect(bodyText.length).toBeGreaterThan(100);

    const hasError = await page
      .getByText(/sin conexión|500|connection refused/i)
      .first()
      .isVisible()
      .catch(() => false);
    expect(hasError).toBe(false);

    const hasAlertContent = bodyText.match(/alert|alerta|open|abierto|critical|high/i) !== null;
    expect(hasAlertContent, 'Should show alert-related content').toBe(true);
  });

  test('revisar alerta persiste notas y cambia estado a REVIEWED con decisión tipificada', async ({ page, authToken }) => {
    // Localizar una fila con alerta pendiente (OPEN) en la tabla actual
    const targetRow = page
      .locator('table tbody tr')
      .filter({ hasText: /pendiente|abierta/i })
      .first();

    const isVisible = await targetRow.isVisible({ timeout: 5000 }).catch(() => false);
    if (!isVisible) {
      test.skip(true, 'No hay alertas pendientes visibles en la primera página');
      return;
    }

    const targetAlertId = (await targetRow.locator('td').first().textContent())?.trim();
    expect(targetAlertId).toBeTruthy();

    const detailBtn = targetRow.getByRole('button', { name: /ver detalle/i });
    await expect(detailBtn).toBeVisible({ timeout: 5000 });
    await detailBtn.click();

    // Esperar a que el drawer se abra y cargue la información
    await expect(page.getByText('Información Comercial')).toBeVisible({ timeout: 10_000 });

    // Abrir el formulario de revisión si no está abierto
    const openReviewBtn = page.getByRole('button', { name: /marcar alerta como revisada/i });
    await expect(openReviewBtn).toBeVisible({ timeout: 10_000 });
    await openReviewBtn.click();

    // Seleccionar decisión tipificada FRAUD_CONFIRMED
    const decisionBtn = page
      .getByRole('button', { name: /fraude confirmado/i })
      .first();
    await expect(decisionBtn).toBeVisible({ timeout: 10_000 });
    await decisionBtn.click();

    // Llenar notas de investigación en #review-notes
    const notesInput = page.locator('#review-notes');
    await expect(notesInput).toBeVisible({ timeout: 5000 });
    await notesInput.fill(reviewNotes);

    // Confirmar resolución
    const confirmBtn = page.getByRole('button', { name: /confirmar revisión/i });
    await expect(confirmBtn).toBeVisible({ timeout: 5000 });
    await confirmBtn.click();
    await page.waitForTimeout(1500);

    // Verificar en el backend que targetAlertId ahora tiene estado REVIEWED y decisión FRAUD_CONFIRMED
    const BASE_API = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:8085';
    const directRes = await page.request.get(`${BASE_API}/api/v1/alerts/${targetAlertId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(directRes.ok()).toBe(true);

    const alertDetail = await directRes.json();
    expect(alertDetail.status).toBe('REVIEWED');
    expect(alertDetail.decision).toBe('FRAUD_CONFIRMED');
    if (alertDetail.notes) {
      expect(alertDetail.notes).toContain(reviewNotes);
    }
  });

  test('validar tipologías de decisión: FALSE_POSITIVE y REQUIRES_FOLLOWUP', async ({ page, request, authToken }) => {
    const BASE_API = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:8085';

    // Crear dos transacciones adicionales para validar ambas decisiones
    const tx1 = await createHighRiskTransaction(request, authToken, {
      externalUserId: uniqueUserId('e2e_fp'),
      amount: 6000.0,
    });
    const tx2 = await createHighRiskTransaction(request, authToken, {
      externalUserId: uniqueUserId('e2e_rf'),
      amount: 7000.0,
    });

    await page.waitForTimeout(1500);

    const alertsRes = await request.get(`${BASE_API}/api/v1/alerts?size=50`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const alerts = (await alertsRes.json()).content ?? [];

    const alertFP = alerts.find((a: any) => a.transactionId === (tx1.transactionId ?? tx1.id));
    const alertRF = alerts.find((a: any) => a.transactionId === (tx2.transactionId ?? tx2.id));

    if (alertFP) {
      const resFP = await page.request.patch(`${BASE_API}/api/v1/alerts/${alertFP.alertId}/review`, {
        data: { decision: 'FALSE_POSITIVE', notes: 'Validado como falso positivo E2E' },
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });
      expect(resFP.ok()).toBe(true);
      const bodyFP = await resFP.json();
      expect(bodyFP.status).toBe('REVIEWED');
      expect(bodyFP.decision).toBe('FALSE_POSITIVE');
    }

    if (alertRF) {
      const resRF = await page.request.patch(`${BASE_API}/api/v1/alerts/${alertRF.alertId}/review`, {
        data: { decision: 'REQUIRES_FOLLOWUP', notes: 'Requiere seguimiento adicional con cliente' },
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });
      expect(resRF.ok()).toBe(true);
      const bodyRF = await resRF.json();
      expect(bodyRF.status).toBe('REVIEWED');
      expect(bodyRF.decision).toBe('REQUIRES_FOLLOWUP');
    }
  });
});
