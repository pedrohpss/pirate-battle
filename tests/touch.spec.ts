import type { Locator } from '@playwright/test';
import { expect, test } from './fixtures';
import { advance, getState, openGame, startMatch } from './helpers';

/**
 * Puts a finger down on an element (pointer events, like a real touch).
 * `fx`/`fy` say where, as a fraction of the element's size (0.5 = centre).
 * The movement pad decides what to do from the finger's position.
 */
async function pressButton(target: Locator, pointerId: number, fx = 0.5, fy = 0.5): Promise<void> {
  const box = await target.boundingBox();
  if (!box) throw new Error('Element is not visible');
  await target.dispatchEvent('pointerdown', {
    pointerId,
    pointerType: 'touch',
    isPrimary: pointerId === 1,
    button: 0,
    clientX: box.x + box.width * fx,
    clientY: box.y + box.height * fy,
  });
}

async function releaseButton(target: Locator, pointerId: number): Promise<void> {
  await target.dispatchEvent('pointerup', { pointerId, pointerType: 'touch', isPrimary: pointerId === 1, button: 0 });
}

// 9 (touch part). On-screen controls on a phone, landscape.
test('touch buttons sail, turn and fire, several at once', async ({ page }) => {
  await openGame(page, { noEnemies: true, touch: true });
  await startMatch(page);

  const sail = page.getByRole('button', { name: 'Sail forward' });
  const turnRight = page.getByRole('button', { name: 'Turn right' });
  const fireBow = page.getByRole('button', { name: 'Fire bow cannon' });
  await expect(sail).toBeVisible();
  await expect(fireBow).toBeVisible();
  // The keyboard reminder is replaced by the buttons.
  await expect(page.getByText(/broadsides/)).toHaveCount(0);

  const start = await getState(page);

  // Two fingers: sail and fire at the same time.
  await pressButton(sail, 1);
  await pressButton(fireBow, 2);
  await advance(page, 1);
  await releaseButton(fireBow, 2);
  await releaseButton(sail, 1);

  const moved = await getState(page);
  expect(start.player.y - moved.player.y).toBeCloseTo(180, 3);
  expect(moved.playerProjectilesFired).toBe(3); // bow cooldown 0.4 s

  // After releasing, nothing keeps going.
  await advance(page, 0.5);
  expect((await getState(page)).player.y).toBe(moved.player.y);

  await pressButton(turnRight, 3);
  await advance(page, 1);
  await releaseButton(turnRight, 3);
  expect((await getState(page)).player.angle - moved.player.angle).toBeCloseTo(2.5, 3);
});

test('one finger on an upper corner of the pad sails and turns together', async ({ page }) => {
  await openGame(page, { noEnemies: true, touch: true });
  await startMatch(page);

  const pad = page.getByRole('group', { name: 'Movement' });
  const start = await getState(page);

  // Upper-left corner of the pad: sail forward + turn left with one thumb.
  await pressButton(pad, 1, 0.15, 0.25);
  await advance(page, 1);
  await releaseButton(pad, 1);

  const end = await getState(page);
  expect(end.player.angle - start.player.angle).toBeCloseTo(-2.5, 3);
  expect(start.player.y - end.player.y).toBeGreaterThan(30); // it also sailed (along a curve)
});

test('the pause button works on touch screens', async ({ page }) => {
  await openGame(page, { noEnemies: true, touch: true });
  await startMatch(page);
  await page.getByRole('button', { name: 'Pause (Esc)' }).click();
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sail forward' })).toHaveCount(0);
});
