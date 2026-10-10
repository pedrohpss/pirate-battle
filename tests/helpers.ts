import type { Page } from '@playwright/test';
import { expect } from './fixtures';

/** Mirror of src/game/testing/testMode.ts (kept separate: tests do not import app code). */
export interface TestState {
  status: 'loading' | 'error' | 'running' | 'paused' | 'ended';
  score: number;
  elapsed: number;
  timeLeft: number;
  endReason: 'time' | 'death' | null;
  player: { x: number; y: number; angle: number; health: number; maxHealth: number; radius: number };
  enemies: { id: number; kind: 'chaser' | 'shooter'; x: number; y: number; health: number; radius: number }[];
  projectiles: { team: 'player' | 'enemy'; x: number; y: number }[];
  playerProjectilesFired: number;
  enemiesSpawned: number;
  obstacles: { x: number; y: number; width: number; height: number }[];
}

interface TestWindow {
  __PIRATE_TEST__?: { advance(seconds: number): void; getState(): TestState };
}

export interface OpenOptions {
  seed?: number;
  noEnemies?: boolean;
  scenario?: string;
  touch?: boolean;
}

/** Opens the game in test mode (manual clock, seeded randomness). */
export async function openGame(page: Page, options: OpenOptions = {}): Promise<void> {
  const params = new URLSearchParams({ test: '1', seed: String(options.seed ?? 1) });
  if (options.noEnemies) params.set('noEnemies', '1');
  if (options.scenario) params.set('scenario', options.scenario);
  if (options.touch) params.set('touch', '1');
  await page.goto(`/?${params.toString()}`);
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
}

/** Clicks Play and waits until the match is running. */
export async function startMatch(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await waitForStatus(page, 'running');
}

export async function waitForStatus(page: Page, status: TestState['status']): Promise<void> {
  await page.waitForFunction(
    (expected) => (window as unknown as TestWindow).__PIRATE_TEST__?.getState().status === expected,
    status,
  );
}

/** Advances the game clock by `seconds` (the game never moves on its own in test mode). */
export async function advance(page: Page, seconds: number): Promise<void> {
  await page.evaluate((s) => (window as unknown as TestWindow).__PIRATE_TEST__?.advance(s), seconds);
}

export async function getState(page: Page): Promise<TestState> {
  const state = await page.evaluate(() => (window as unknown as TestWindow).__PIRATE_TEST__?.getState());
  if (!state) throw new Error('Test API not available: is a match running in test mode?');
  return state;
}

export async function hasTestApi(page: Page): Promise<boolean> {
  return page.evaluate(() => (window as unknown as TestWindow).__PIRATE_TEST__ !== undefined);
}

/** Opens Options, saves the given values and goes back to the menu. */
export async function setOptions(page: Page, matchDuration: number, spawnInterval: number): Promise<void> {
  await page.getByRole('button', { name: 'Options' }).click();
  await page.getByLabel('Game session time').fill(String(matchDuration));
  await page.getByLabel('Enemy spawn time').fill(String(spawnInterval));
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Options saved.')).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
}

/** Chooses a network scenario in the main menu panel. */
export async function selectScenario(page: Page, label: string): Promise<void> {
  const panel = page.locator('details.network-panel');
  if (!(await panel.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await page.getByText('Network simulation (demo)').click();
  }
  await page.getByLabel('Scenario').selectOption({ label });
}

/** Plays a whole match with no enemies until the timer ends (60 s match). */
export async function finishMatchByTime(page: Page): Promise<void> {
  await advance(page, 61);
  await expect(page.getByRole('dialog', { name: 'Match over' })).toBeVisible();
}

/** Distance from a point to the closest point of a rectangle (0 if inside). */
export function distanceToRect(
  x: number,
  y: number,
  rect: { x: number; y: number; width: number; height: number },
): number {
  const cx = Math.min(Math.max(x, rect.x), rect.x + rect.width);
  const cy = Math.min(Math.max(y, rect.y), rect.y + rect.height);
  return Math.hypot(x - cx, y - cy);
}

/** Smallest signed rotation from `current` to `target`, between -PI and PI. */
export function angleDifference(current: number, target: number): number {
  let difference = (target - current) % (Math.PI * 2);
  if (difference > Math.PI) difference -= Math.PI * 2;
  if (difference < -Math.PI) difference += Math.PI * 2;
  return difference;
}
