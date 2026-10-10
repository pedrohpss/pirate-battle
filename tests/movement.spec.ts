import { expect, test } from './fixtures';
import { advance, distanceToRect, getState, openGame, startMatch } from './helpers';

// Values from src/game/config.ts.
const MOVE_SPEED = 180;
const TURN_SPEED = 2.5;

// 3. Start of the match, movement, rotation, arena limits and island collisions.
test.describe('Movement', () => {
  test.beforeEach(async ({ page }) => {
    await openGame(page, { noEnemies: true });
    await startMatch(page);
  });

  test('starts with full health, no score and the configured time', async ({ page }) => {
    const state = await getState(page);
    expect(state.player.health).toBe(state.player.maxHealth);
    expect(state.score).toBe(0);
    expect(state.timeLeft).toBe(90);
    expect(state.enemies).toHaveLength(0);
  });

  test('sails forward and turns at the configured speeds', async ({ page }) => {
    const start = await getState(page);

    await page.keyboard.down('KeyW');
    await advance(page, 1);
    await page.keyboard.up('KeyW');
    const moved = await getState(page);
    // Starts facing up: one second forward moves MOVE_SPEED units up.
    expect(start.player.y - moved.player.y).toBeCloseTo(MOVE_SPEED, 3);
    expect(moved.player.x).toBeCloseTo(start.player.x, 3);

    await page.keyboard.down('KeyD');
    await advance(page, 1);
    await page.keyboard.up('KeyD');
    const turned = await getState(page);
    expect(turned.player.angle - moved.player.angle).toBeCloseTo(TURN_SPEED, 3);

    await page.keyboard.down('ArrowLeft');
    await advance(page, 1);
    await page.keyboard.up('ArrowLeft');
    expect((await getState(page)).player.angle).toBeCloseTo(moved.player.angle, 3);
  });

  test('stays inside the arena', async ({ page }) => {
    await page.keyboard.down('KeyW');
    await advance(page, 4); // far more than the distance to the top edge
    await page.keyboard.up('KeyW');
    const state = await getState(page);
    expect(state.player.y).toBeCloseTo(state.player.radius, 3);
  });

  test('cannot sail through an island', async ({ page }) => {
    const start = await getState(page);
    const island = start.obstacles[2]; // bottom-left island
    const target = { x: island.x + island.width / 2, y: island.y + island.height / 2 };

    // Turn right until the bow points at the island, using the real keys.
    const targetAngle = Math.atan2(target.y - start.player.y, target.x - start.player.x);
    const turn = (targetAngle - start.player.angle + Math.PI * 2) % (Math.PI * 2);
    await page.keyboard.down('KeyD');
    await advance(page, turn / TURN_SPEED);
    await page.keyboard.up('KeyD');

    // Sail toward it in small steps and watch the distance to every island.
    await page.keyboard.down('KeyW');
    let touched = false;
    for (let i = 0; i < 60; i++) {
      await advance(page, 0.05);
      const { player, obstacles } = await getState(page);
      const closest = Math.min(...obstacles.map((rect) => distanceToRect(player.x, player.y, rect)));
      // Never inside an island (tiny tolerance for floating point).
      expect(closest).toBeGreaterThanOrEqual(player.radius - 0.01);
      if (closest < player.radius + 0.5) touched = true;
    }
    await page.keyboard.up('KeyW');
    expect(touched, 'the ship should have reached the coast').toBe(true);
  });
});
