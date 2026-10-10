import { expect, test } from './fixtures';
import { finishMatchByTime, openGame, setOptions, startMatch } from './helpers';

/**
 * Visual regression: compares screenshots with the baselines stored in
 * tests/visual.spec.ts-snapshots/. Create or update them with
 * `npm run test:e2e:update` and commit the images.
 */
test.describe('Visual regression', () => {
  test('main menu', async ({ page }) => {
    await openGame(page);
    await expect(page.getByRole('tabpanel').locator('tbody tr')).toHaveCount(5);
    await expect(page).toHaveScreenshot('menu.png', {
      fullPage: true,
      // The player name is random.
      mask: [page.getByText(/Playing as/)],
    });
  });

  test('arena in a stable state', async ({ page }) => {
    await openGame(page, { noEnemies: true });
    await startMatch(page);
    await expect(page).toHaveScreenshot('arena.png');
  });

  test('result screen', async ({ page }) => {
    await openGame(page, { noEnemies: true });
    await setOptions(page, 60, 4);
    await startMatch(page);
    await finishMatchByTime(page);
    await expect(page.getByText('Saved to the ranking and history.')).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Match over' })).toHaveScreenshot('result.png');
  });
});
