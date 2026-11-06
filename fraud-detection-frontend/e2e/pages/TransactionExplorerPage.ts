import { type Page } from '@playwright/test';

export class TransactionExplorerPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/transactions');
    await this.page.waitForLoadState('networkidle');
  }

  async searchByUserId(userId: string) {
    const searchInput = this.page.getByPlaceholder(/filtrar por id de usuario/i);
    if (await searchInput.isVisible({ timeout: 5000 })) {
      await searchInput.fill(userId);
      await this.page.waitForTimeout(600);
      await this.page.waitForLoadState('networkidle').catch(() => {});
    }
  }

  async getTransactionRows() {
    return this.page.locator('table tbody tr');
  }

  async clickFirstTransactionContaining(text: string) {
    const row = this.page.locator('table tbody tr').filter({ hasText: text }).first();
    await row.click();
  }

  async clickFirstTransaction() {
    const rows = await this.getTransactionRows();
    await rows.first().click();
  }
}
