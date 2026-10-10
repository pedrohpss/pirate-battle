import { expect, test } from './fixtures';
import {
  advance,
  finishMatchByTime,
  getState,
  hasTestApi,
  openGame,
  setOptions,
  startMatch,
  waitForStatus,
} from './helpers';

// 6. End by time and by death, simulation stops, clean restart.
test.describe('End of match', () => {
  test('ends exactly when the time runs out and freezes the simulation', async ({ page }) => {
    await openGame(page, { noEnemies: true });
    await setOptions(page, 60, 4);
    await startMatch(page);

    await advance(page, 59);
    expect((await getState(page)).status).toBe('running');

    await finishMatchByTime(page);
    const ended = await getState(page);
    expect(ended.endReason).toBe('time');
    expect(ended.elapsed).toBeCloseTo(60, 5);
    await expect(page.getByRole('dialog', { name: 'Match over' })).toContainText("Time's up");

    // Keys and time do nothing anymore.
    await page.keyboard.down('KeyW');
    await advance(page, 2);
    await page.keyboard.up('KeyW');
    const after = await getState(page);
    expect(after.elapsed).toBe(ended.elapsed);
    expect(after.player.y).toBe(ended.player.y);
  });

  test('ends when the ship sinks', async ({ page }) => {
    await openGame(page, { seed: 1 });
    await startMatch(page);
    for (let i = 0; i < 90 && (await getState(page)).status !== 'ended'; i++) {
      await advance(page, 1);
    }
    const state = await getState(page);
    expect(state.endReason).toBe('death');
    expect(state.player.health).toBe(0);
    await expect(page.getByRole('dialog', { name: 'Match over' })).toContainText('Your ship sank.');
  });

  test('Play Again starts a clean match', async ({ page }) => {
    await openGame(page, { seed: 1 });
    await startMatch(page);
    for (let i = 0; i < 90 && (await getState(page)).status !== 'ended'; i++) {
      await advance(page, 1);
    }
    await page.getByRole('button', { name: 'Play Again' }).click();
    await waitForStatus(page, 'running');

    const fresh = await getState(page);
    expect(fresh.elapsed).toBe(0);
    expect(fresh.score).toBe(0);
    expect(fresh.player.health).toBe(fresh.player.maxHealth);
    expect(fresh.enemies).toHaveLength(0);
    expect(fresh.projectiles).toHaveLength(0);
  });
});

// 7. Pause, focus loss and resume without the clock moving.
test.describe('Pause', () => {
  test.beforeEach(async ({ page }) => {
    await openGame(page, { noEnemies: true });
    await startMatch(page);
    await advance(page, 1);
  });

  test('manual pause freezes the clock and resuming needs the player', async ({ page }) => {
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
    const paused = await getState(page);

    await advance(page, 3);
    expect((await getState(page)).elapsed).toBe(paused.elapsed);
    expect((await getState(page)).timeLeft).toBe(paused.timeLeft);

    await page.getByRole('button', { name: 'Resume' }).click();
    await waitForStatus(page, 'running');
    await advance(page, 1);
    expect((await getState(page)).elapsed).toBeCloseTo(paused.elapsed + 1, 5);
  });

  test('losing focus or hiding the tab pauses the match', async ({ page }) => {
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await waitForStatus(page, 'paused');
    await page.getByRole('button', { name: 'Resume' }).click();
    await waitForStatus(page, 'running');

    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitForStatus(page, 'paused');
    // Coming back does not resume by itself.
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect((await getState(page)).status).toBe('paused');
  });

  test('keys held during the pause do not move the ship after resuming', async ({ page }) => {
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
    await page.keyboard.down('KeyW');
    await page.getByRole('button', { name: 'Resume' }).click();
    await waitForStatus(page, 'running');

    const resumed = await getState(page);
    await advance(page, 0.5);
    await page.keyboard.up('KeyW');
    expect((await getState(page)).player.y).toBe(resumed.player.y);
  });
});

// 8. Result screen and its persistence after refresh.
test('the result is shown and kept after a refresh', async ({ page }) => {
  await openGame(page, { noEnemies: true });
  await setOptions(page, 60, 4);
  await startMatch(page);
  await finishMatchByTime(page);

  const dialog = page.getByRole('dialog', { name: 'Match over' });
  await expect(dialog).toContainText('Score');
  await expect(dialog).toContainText('1:00');
  await dialog.getByRole('button', { name: 'Main Menu' }).click();

  await page.reload();
  const lastMatch = page.getByRole('region', { name: 'Last match' });
  await expect(lastMatch).toContainText('0 points');
  await expect(lastMatch).toContainText('Survived');
});

// 9. Abandoning a match and repeated navigation between screens.
test('an abandoned match is not recorded and leaves nothing running', async ({ page }) => {
  await openGame(page, { noEnemies: true });

  for (let round = 0; round < 3; round++) {
    await startMatch(page);
    await advance(page, 2);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Main Menu' }).click();
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    // The match was destroyed: its test API (and loop) are gone.
    expect(await hasTestApi(page)).toBe(false);
  }

  await expect(page.getByRole('region', { name: 'Last match' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Match History' }).click();
  await expect(page.getByText('You have no saved matches yet.')).toBeVisible();
});
