/* eslint-disable react-hooks/rules-of-hooks */
import { test as base } from '@playwright/test';
import { loginViaApi } from '../helpers/auth.helper';
import { createApiHelper } from '../helpers/api.helper';

export type ZeroFraudEFixtures = {
  /** JWT token obtained via API login */
  authToken: string;
  /** Authenticated API helper */
  api: ReturnType<typeof createApiHelper>;
};

/**
 * Extended Playwright test with ZeroFraudE-specific fixtures.
 * Each test gets a fresh token obtained via API (not UI).
 */
export const test = base.extend<ZeroFraudEFixtures>({
  authToken: async ({ page }, useFixture) => {
    const token = await loginViaApi(page);
    await useFixture(token);
  },

  api: async ({ request, authToken }, useFixture) => {
    await useFixture(createApiHelper(request, authToken));
  },
});

export { expect } from '@playwright/test';
