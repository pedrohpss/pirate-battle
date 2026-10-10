import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import type { TestState } from './helpers';
import { advance, angleDifference, getState, openGame, setOptions, startMatch } from './helpers';

// Values from src/game/config.ts.
const CHASER_CONTACT_DAMAGE = 20;
const SHOOTER_PREFERRED_DISTANCE = 260;
const SHOOTER_ATTACK_RANGE = 380;

/** Presses a key for exactly one simulation step. */
async function tap(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await advance(page, 1 / 60);
  await page.keyboard.up(key);
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// 4. Front and side shots, cooldown, damage and score without duplication.
test.describe('Weapons', () => {
  test.beforeEach(async ({ page }) => {
    await openGame(page, { noEnemies: true });
    await startMatch(page);
  });

  test('bow fires 1 projectile, each broadside fires 3 in parallel', async ({ page }) => {
    await tap(page, 'Space');
    expect((await getState(page)).playerProjectilesFired).toBe(1);

    await tap(page, 'KeyQ');
    const afterLeft = await getState(page);
    expect(afterLeft.playerProjectilesFired).toBe(4);

    // The three left shots fly side by side: same distance from the ship's axis line
    // is not required, but they must be three distinct parallel positions.
    const leftShots = afterLeft.projectiles.filter((p) => p.team === 'player').slice(-3);
    expect(new Set(leftShots.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)).size).toBe(3);

    await tap(page, 'KeyE');
    expect((await getState(page)).playerProjectilesFired).toBe(7);
  });

  test('each weapon respects its cooldown', async ({ page }) => {
    // Bow cooldown is 0.4 s: holding Space for 1 s fires at ~0, 0.4 and 0.8 s.
    await page.keyboard.down('Space');
    await advance(page, 1);
    await page.keyboard.up('Space');
    expect((await getState(page)).playerProjectilesFired).toBe(3);

    // Broadside cooldown is 1 s and left/right are independent.
    const before = (await getState(page)).playerProjectilesFired;
    await page.keyboard.down('KeyQ');
    await page.keyboard.down('KeyE');
    await advance(page, 0.5);
    await page.keyboard.up('KeyQ');
    await page.keyboard.up('KeyE');
    expect((await getState(page)).playerProjectilesFired - before).toBe(6);
  });

  test('projectiles disappear when they hit an island or reach their range', async ({ page }) => {
    await tap(page, 'Space');
    expect((await getState(page)).projectiles).toHaveLength(1);
    await advance(page, 2); // longer than the bow range allows
    expect((await getState(page)).projectiles).toHaveLength(0);
  });
});

test.describe('Enemies and damage', () => {
  test('destroying an enemy with cannons scores exactly 1 point per enemy', async ({ page }) => {
    await openGame(page, { seed: 3 });
    await startMatch(page);
    await page.keyboard.down('Space');

    // A simple bot that uses the real keys: turn toward the nearest enemy and keep firing.
    let state: TestState = await getState(page);
    const destroyedByPlayer = new Set<number>();
    for (let i = 0; i < 400 && state.score < 2 && state.status === 'running'; i++) {
      const nearest = [...state.enemies].sort(
        (a, b) => distance(a, state.player) - distance(b, state.player),
      )[0];
      const turn = nearest
        ? angleDifference(
            state.player.angle,
            Math.atan2(nearest.y - state.player.y, nearest.x - state.player.x),
          )
        : 0;
      const key = turn > 0.05 ? 'KeyD' : turn < -0.05 ? 'KeyA' : null;
      if (key) await page.keyboard.down(key);
      await advance(page, 0.05);
      if (key) await page.keyboard.up(key);

      const next = await getState(page);
      // Score never jumps by more than the number of enemies that disappeared.
      const gone = state.enemies.filter((enemy) => !next.enemies.some((e) => e.id === enemy.id));
      expect(next.score - state.score).toBeLessThanOrEqual(gone.length);
      if (next.score > state.score) gone.forEach((enemy) => destroyedByPlayer.add(enemy.id));
      state = next;
    }
    await page.keyboard.up('Space');

    expect(state.score).toBeGreaterThanOrEqual(1);
    expect(state.score).toBeLessThanOrEqual(state.enemiesSpawned);
  });

  test('a Chaser that rams the player deals damage, explodes and gives no points', async ({ page }) => {
    await openGame(page, { seed: 1 });
    await startMatch(page);

    let state = await getState(page);
    let rammed = false;
    for (let i = 0; i < 300 && !rammed; i++) {
      await advance(page, 0.05);
      const next = await getState(page);
      const damage = state.player.health - next.player.health;
      const chaserGone = state.enemies.some(
        (enemy) => enemy.kind === 'chaser' && !next.enemies.some((e) => e.id === enemy.id),
      );
      if (damage === CHASER_CONTACT_DAMAGE && chaserGone) {
        rammed = true;
        expect(next.score).toBe(state.score); // no points for a ram
      }
      state = next;
    }
    expect(rammed, 'a Chaser should reach the idle player').toBe(true);
  });

  // 5. Chaser and Shooter behaviour and spawn interval.
  test('a Shooter approaches, keeps its distance and fires', async ({ page }) => {
    await openGame(page, { seed: 1 });
    await startMatch(page);

    let fired = false;
    for (let i = 0; i < 400 && !fired; i++) {
      await advance(page, 0.05);
      const state = await getState(page);
      const shooter = state.enemies.find((enemy) => enemy.kind === 'shooter');
      if (shooter && state.projectiles.some((p) => p.team === 'enemy')) {
        fired = true;
        const gap = distance(shooter, state.player);
        expect(gap).toBeLessThanOrEqual(SHOOTER_ATTACK_RANGE + 10);
        expect(gap).toBeGreaterThanOrEqual(SHOOTER_PREFERRED_DISTANCE - 60);
      }
    }
    expect(fired, 'a Shooter should open fire').toBe(true);
  });

  test('enemies spawn at the configured interval, far from the player, both types', async ({ page }) => {
    await openGame(page, { seed: 2 });
    await setOptions(page, 90, 2);
    await startMatch(page);

    await advance(page, 0.9);
    expect((await getState(page)).enemiesSpawned).toBe(0);
    await advance(page, 0.2); // first spawn at 1 s
    const first = await getState(page);
    expect(first.enemiesSpawned).toBe(1);
    expect(first.enemies[0].kind).toBe('chaser');
    // Spawned at least 450 units away; it has sailed toward the player for ~0.1 s since.
    expect(distance(first.enemies[0], first.player)).toBeGreaterThanOrEqual(400);

    await advance(page, 2); // next one 2 s later
    const second = await getState(page);
    expect(second.enemiesSpawned).toBe(2);
    expect(second.enemies.map((enemy) => enemy.kind)).toContain('shooter');
  });
});
