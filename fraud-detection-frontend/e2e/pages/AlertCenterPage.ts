import { type Page, type Locator } from '@playwright/test';

export class AlertCenterPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/alerts');
    await this.page.waitForLoadState('networkidle');
  }

  async filterByStatus(status: 'OPEN' | 'REVIEWED') {
    const statusFilter = this.page.getByRole('combobox').or(
      this.page.getByRole('button', { name: new RegExp(status, 'i') })
    ).first();
    if (await statusFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await statusFilter.click();
      const option = this.page.getByRole('option', { name: new RegExp(status, 'i') });
      if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
        await option.click();
      }
    }
  }

  async findAlertByDescription(description: string): Promise<Locator> {
    return this.page.locator(`[class*="alert"], tr, [class*="row"], [class*="card"]`).filter({ hasText: description }).first();
  }

  async clickAlertByDescription(description: string) {
    const alert = await this.findAlertByDescription(description);
    await alert.click();
  }
}

