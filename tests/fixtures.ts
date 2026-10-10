import { expect, test as base } from '@playwright/test';

/**
 * Every test fails if the page logs an unhandled error.
 * Browser messages about failed requests are expected in the
 * network-failure scenarios, so they are ignored.
 */
export const test = base.extend<{ consoleGuard: void }>({
  consoleGuard: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() !== 'error') return;
        const text = message.text();
        if (text.startsWith('Failed to load resource')) return;
        errors.push(`console.error: ${text}`);
      });
      await use();
      expect(errors, 'unexpected errors in the console').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
