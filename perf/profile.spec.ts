import { mkdirSync, writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * Profiles a full 3-minute match and 5 start/play/leave cycles.
 *
 * Match: 180 s, an enemy every 1 s (the 10-enemy cap is reached quickly).
 * The ship spins and fires all cannons the whole time to keep many
 * projectiles and explosions on screen. `?perf=1` keeps the real-time loop
 * but makes the ship unsinkable, so the match lasts the full 3 minutes.
 */

interface PerfWindow {
  __PIRATE_TEST__?: {
    getState(): { status: string; enemies: unknown[]; projectiles: unknown[] };
  };
  __perf?: { frames: number[]; samples: { enemies: number; projectiles: number }[]; stop: boolean };
}

function percentile(sorted: number[], p: number): number {
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

const round = (value: number, digits = 1) => Number(value.toFixed(digits));

async function setOptions(page: Page, duration: number, spawn: number): Promise<void> {
  await page.getByRole('button', { name: 'Options' }).click();
  await page.getByLabel('Game session time').fill(String(duration));
  await page.getByLabel('Enemy spawn time').fill(String(spawn));
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('button', { name: 'Back' }).click();
}

async function play(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.waitForFunction(
    () => (window as unknown as PerfWindow).__PIRATE_TEST__?.getState().status === 'running',
  );
}

async function holdAllControls(page: Page, down: boolean): Promise<void> {
  for (const key of ['KeyW', 'KeyD', 'Space', 'KeyQ', 'KeyE']) {
    if (down) await page.keyboard.down(key);
    else await page.keyboard.up(key);
  }
}

test('profile a 3-minute match and 5 play/leave cycles', async ({ page }) => {
  await page.goto('/?perf=1&seed=1');
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();

  // ------------------------------------------------------------ environment
  const environment = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    return {
      userAgent: navigator.userAgent,
      cpuThreads: navigator.hardwareConcurrency,
      deviceMemoryGB: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
      gpu: gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'unknown',
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      devicePixelRatio: window.devicePixelRatio,
    };
  });

  // ------------------------------------------------------- 3-minute match
  await setOptions(page, 180, 1);
  await play(page);

  // Record the time between frames and, once per second, the entity count.
  await page.evaluate(() => {
    const w = window as unknown as PerfWindow;
    const record = { frames: [] as number[], samples: [] as { enemies: number; projectiles: number }[], stop: false };
    w.__perf = record;
    let last = performance.now();
    const onFrame = (now: number) => {
      record.frames.push(now - last);
      last = now;
      if (!record.stop) requestAnimationFrame(onFrame);
    };
    requestAnimationFrame(onFrame);
    const timer = setInterval(() => {
      const state = w.__PIRATE_TEST__?.getState();
      if (!state || record.stop) return clearInterval(timer);
      record.samples.push({ enemies: state.enemies.length, projectiles: state.projectiles.length });
    }, 1000);
  });

  await holdAllControls(page, true);
  await page.waitForFunction(
    () => (window as unknown as PerfWindow).__PIRATE_TEST__?.getState().status === 'ended',
    undefined,
    { timeout: 200_000, polling: 1000 },
  );
  await holdAllControls(page, false);

  const recorded = await page.evaluate(() => {
    const w = window as unknown as PerfWindow;
    if (!w.__perf) throw new Error('No recording');
    w.__perf.stop = true;
    return { frames: w.__perf.frames.slice(1), samples: w.__perf.samples };
  });

  const sorted = [...recorded.frames].sort((a, b) => a - b);
  const totalMs = recorded.frames.reduce((sum, value) => sum + value, 0);
  const match = {
    durationSeconds: round(totalMs / 1000),
    frames: recorded.frames.length,
    averageFps: round(recorded.frames.length / (totalMs / 1000)),
    frameTimeMs: {
      average: round(totalMs / recorded.frames.length, 2),
      p50: round(percentile(sorted, 50), 2),
      p95: round(percentile(sorted, 95), 2),
      p99: round(percentile(sorted, 99), 2),
      max: round(sorted[sorted.length - 1], 2),
    },
    framesOver33ms: recorded.frames.filter((value) => value > 33.4).length,
    entities: {
      maxEnemies: Math.max(...recorded.samples.map((s) => s.enemies)),
      averageEnemies: round(recorded.samples.reduce((sum, s) => sum + s.enemies, 0) / recorded.samples.length),
      maxProjectiles: Math.max(...recorded.samples.map((s) => s.projectiles)),
      averageProjectiles: round(
        recorded.samples.reduce((sum, s) => sum + s.projectiles, 0) / recorded.samples.length,
      ),
    },
  };

  // ------------------------------------------------- memory over 5 cycles
  await page.getByRole('button', { name: 'Main Menu' }).click();
  await setOptions(page, 60, 1);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const measure = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    await page.waitForTimeout(500);
    const { metrics } = await cdp.send('Performance.getMetrics');
    const get = (name: string) => metrics.find((metric) => metric.name === name)?.value ?? 0;
    const canvases = await page.locator('canvas').count();
    return {
      jsHeapMB: round(get('JSHeapUsedSize') / 1024 / 1024, 2),
      domNodes: get('Nodes'),
      eventListeners: get('JSEventListeners'),
      canvases,
    };
  };

  const memory = [{ cycle: 0, ...(await measure()) }];
  for (let cycle = 1; cycle <= 5; cycle++) {
    await play(page);
    await holdAllControls(page, true);
    await page.waitForTimeout(10_000);
    await holdAllControls(page, false);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Main Menu' }).click();
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    memory.push({ cycle, ...(await measure()) });
  }

  // ---------------------------------------------------------------- output
  const results = { date: new Date().toISOString(), environment, match, memory };
  mkdirSync('perf', { recursive: true });
  writeFileSync('perf/results.json', JSON.stringify(results, null, 2));
  writeFileSync('perf/RESULTS.md', toMarkdown(results));
  console.log(JSON.stringify(results, null, 2));

  // Leaving the game must not leave canvases behind.
  expect(memory[memory.length - 1].canvases).toBe(0);
});

function toMarkdown(results: {
  date: string;
  environment: Record<string, unknown>;
  match: {
    durationSeconds: number;
    frames: number;
    averageFps: number;
    frameTimeMs: Record<string, number>;
    framesOver33ms: number;
    entities: Record<string, number>;
  };
  memory: { cycle: number; jsHeapMB: number; domNodes: number; eventListeners: number; canvases: number }[];
}): string {
  const { environment: env, match, memory } = results;
  const lines = [
    '# Performance results (generated)',
    '',
    `Generated by \`npm run perf\` on ${results.date}.`,
    '',
    '## Environment (as reported by the browser)',
    '',
    `- Browser: ${String(env.userAgent)}`,
    `- GPU: ${String(env.gpu)}`,
    `- CPU threads: ${String(env.cpuThreads)}; device memory: ${String(env.deviceMemoryGB ?? 'n/a')} GB`,
    `- Viewport: ${String(env.viewport)} at device pixel ratio ${String(env.devicePixelRatio)}`,
    '- Build: optimized production build (`vite build`), served by `vite preview`',
    '',
    '## 3-minute match (180 s, enemy every 1 s, ship spinning and firing all cannons)',
    '',
    '| Metric | Value |',
    '| --- | --- |',
    `| Recorded time | ${match.durationSeconds} s |`,
    `| Frames | ${match.frames} |`,
    `| Average FPS | ${match.averageFps} |`,
    `| Frame time average | ${match.frameTimeMs.average} ms |`,
    `| Frame time p50 | ${match.frameTimeMs.p50} ms |`,
    `| Frame time p95 | ${match.frameTimeMs.p95} ms |`,
    `| Frame time p99 | ${match.frameTimeMs.p99} ms |`,
    `| Frame time max | ${match.frameTimeMs.max} ms |`,
    `| Frames over 33 ms | ${match.framesOver33ms} |`,
    `| Enemies (max / average) | ${match.entities.maxEnemies} / ${match.entities.averageEnemies} |`,
    `| Projectiles (max / average) | ${match.entities.maxProjectiles} / ${match.entities.averageProjectiles} |`,
    '',
    '## Memory after 5 start / play 10 s / leave cycles (after forced garbage collection)',
    '',
    '| Cycle | JS heap (MB) | DOM nodes | JS event listeners | Canvases in the page |',
    '| --- | --- | --- | --- | --- |',
    ...memory.map(
      (m) => `| ${m.cycle === 0 ? 'before (menu)' : m.cycle} | ${m.jsHeapMB} | ${m.domNodes} | ${m.eventListeners} | ${m.canvases} |`,
    ),
    '',
  ];
  return lines.join('\n');
}
