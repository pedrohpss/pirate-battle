import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests. They run against an optimized build made in "test" mode
 * (see .env.test: shorter API timeout), served by `vite preview`.
 *
 *   npm run test:e2e            run all tests (desktop + mobile)
 *   npm run test:e2e:update     re-create the visual baselines
 *   npm run test:e2e:report     open the HTML report
 */
const PORT = 4173;

export default defineConfig({
  testDir: './tests',
  // Each test opens its own browser context: fresh localStorage, no shared state.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: {
    // Some network scenarios include retries with backoff.
    timeout: 15_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: 'disabled' },
  },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
      testIgnore: /touch\.spec\.ts/,
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 5 landscape'] },
      // Main flows on a phone-sized touch screen.
      testMatch: /(touch|options|visual)\.spec\.ts/,
    },
  ],
  webServer: {
    command: `npx vite build --mode test --outDir dist-test && npx vite preview --outDir dist-test --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
