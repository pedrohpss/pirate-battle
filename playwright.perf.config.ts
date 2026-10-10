import { defineConfig, devices } from '@playwright/test';

/**
 * Performance profiling (not part of the normal test run).
 *
 *   npm run perf
 *
 * Uses the optimized production build and a VISIBLE browser window, so the
 * real GPU is used (headless Chromium renders in software). Do not touch the
 * window while it runs: losing focus pauses the game.
 * Results are written to perf/results.json and perf/RESULTS.md.
 */
const PORT = 4174;

export default defineConfig({
  testDir: './perf',
  workers: 1,
  retries: 0,
  timeout: 10 * 60_000,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 720 },
    headless: false,
  },
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
