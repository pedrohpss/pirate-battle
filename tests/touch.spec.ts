import type { Locator } from '@playwright/test';
import { expect, test } from './fixtures';
import { advance, getState, openGame, startMatch } from './helpers';

/** Holds a touch button down (pointer events, like a finger). */
async function pressButton(button: Locator, pointerId: number): Promise<void> {
  await button.dispatchEvent('pointerdown', { pointerId, pointerType: 'touch', isPrimary: pointerId === 1, button: 0 });
}

async function releaseButton(button: Locator, pointerId: number): Promise<void> {
  await button.dispatchEvent('pointerup', { pointerId, pointerType: 'touch', isPrimary: pointerId === 1, button: 0 });
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

test('the pause button works on touch screens', async ({ page }) => {
  await openGame(page, { noEnemies: true, touch: true });
  await startMatch(page);
  await page.getByRole('button', { name: 'Pause (Esc)' }).click();
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sail forward' })).toHaveCount(0);
});
