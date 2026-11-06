import { type Page } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('networkidle');
  }

  async waitForStats() {
    await this.page.waitForSelector('[data-testid="stat-card"], .stat-card, [class*="stat"], [class*="metric"], [class*="dashboard"]', {
      timeout: 20_000,
    });
  }

  async getVisibleMetrics(): Promise<string[]> {
    const cards = this.page.locator('[data-testid*="stat"], [class*="card"], [class*="metric"]');
    const count = await cards.count();
    const texts: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await cards.nth(i).textContent();
      if (text?.trim()) texts.push(text.trim());
    }
    return texts;
  }
}

