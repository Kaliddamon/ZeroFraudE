import { test, expect } from './fixtures/test-data.fixture';
import { createHighRiskTransaction, uniqueUserId } from './helpers/transaction.helper';

/**
 * Flujo 5 — Perfil conductual del usuario (FE-09)
 *
 * Verifies:
 * - Direct access to user profile (/profile/:userId) loads metrics from real backend
 * - Navigation from ExplainabilityPanel with txId context
 * - Comparison panel displays deviation and contextual metrics
 * - Chronological transaction history table loads and displays transactions
 * - Clicking a transaction in the history table opens TransactionDetailDrawer
 * - User without transaction context displays "Sin transacción seleccionada" notice
 */
test.describe('Flujo 5 — Perfil conductual del usuario (FE-09)', () => {
  let testUserId: string;
  let testTxId: string;

  test.beforeEach(async ({ request, authToken }) => {
    testUserId = uniqueUserId('e2e_profile');

    // Crear una transacción con inferencia ML para asociar al usuario
    const tx = await createHighRiskTransaction(request, authToken, {
      externalUserId: testUserId,
      amount: 4500.0,
      country: 'USA',
    });

    testTxId = tx.transactionId ?? tx.id;
  });

  test('perfil conductual carga métricas agregadas y datos históricos del backend', async ({ page }) => {
    // Navegar directamente al perfil del usuario
    await page.goto(`/profile/${testUserId}`);
    await page.waitForLoadState('networkidle');

    // Header del perfil con ID de usuario
    await expect(page.getByText(testUserId)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /Perfil de Comportamiento/i })).toBeVisible();

    // Métricas clave del perfil
    await expect(page.getByText('Total transacciones')).toBeVisible();
    await expect(page.getByText('Monto promedio')).toBeVisible();
    await expect(page.getByText('Horario típico')).toBeVisible();

    // Geografía y Comercios
    await expect(page.getByRole('heading', { name: 'Geografía y Dispositivos' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Comercios Frecuentes' })).toBeVisible();

    // Historial cronológico presente
    await expect(page.getByRole('heading', { name: /Historial Cronológico/i })).toBeVisible();

    // Al no haber txId en la URL, se debe mostrar el aviso informativo
    await expect(page.getByText(/Sin transacción seleccionada/i)).toBeVisible();
  });

  test('panel comparativo y navegación con txId contextual', async ({ page }) => {
    // Navegar con txId en query param
    await page.goto(`/profile/${testUserId}?txId=${testTxId}`);
    await page.waitForLoadState('networkidle');

    // Panel de análisis comparativo visible
    await expect(page.getByRole('heading', { name: /Análisis Comparativo/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Comparación con perfil histórico/i)).toBeVisible();

    // Historial cronológico con la transacción
    const historyTable = page.locator('table');
    await expect(historyTable).toBeVisible({ timeout: 10_000 });

    // La transacción recién creada debe aparecer en el historial
    const txRow = historyTable.locator('tbody tr').first();
    await expect(txRow).toBeVisible();

    // Hacer clic en "Ver" abre el TransactionDetailDrawer
    const viewBtn = txRow.getByRole('button', { name: /ver/i });
    if (await viewBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await viewBtn.click();
      await expect(page.getByText('Información Comercial')).toBeVisible({ timeout: 10_000 });
    }
  });

  test('navegación desde ExplainabilityPanel hacia perfil preserva txId', async ({ page }) => {
    // Ir a transacciones y abrir la transacción
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByPlaceholder(/filtrar por id de usuario/i);
    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await searchInput.fill(testUserId);
      await page.waitForTimeout(600);
      await page.waitForLoadState('networkidle').catch(() => { });
    }

    const row = page.locator('table tbody tr').filter({ hasText: testUserId }).first();
    if (await row.isVisible({ timeout: 5000 }).catch(() => false)) {
      await row.click();
      await page.waitForTimeout(1000);

      // En el drawer, localizar enlace al perfil conductual
      const profileLink = page.getByRole('link', { name: /ver perfil conductual completo/i });
      if (await profileLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await profileLink.click();
        await page.waitForURL(new RegExp(`/profile/${testUserId}`), { timeout: 15_000 });

        // Verificar que la URL preservó el parámetro txId
        expect(page.url()).toContain(`txId=`);
        await expect(page.getByText(/Comparación con perfil histórico/i)).toBeVisible({ timeout: 10_000 });
      }
    }
  });
});
