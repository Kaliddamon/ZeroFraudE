import { defineConfig, devices } from '@playwright/test';

/**
 * QA-02 — ZeroFraudE E2E Playwright Configuration
 *
 * Runs against the full Docker Compose stack (Nginx + Spring Boot + PostgreSQL + ML).
 * MSW is NOT active in production builds.
 * Stack must be running before executing tests.
 *
 * Start stack: docker compose -p zerofraude-h4-e2e up -d
 * Run tests:   npm run test:e2e
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  outputDir: 'test-results/',
});

