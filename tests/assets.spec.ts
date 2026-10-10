import { expect, test } from './fixtures';
import { openGame, waitForStatus } from './helpers';

// 2. Asset loading, failure and retry.
test('shows an error when an asset fails and recovers with Try Again', async ({ page }) => {
  await openGame(page, { noEnemies: true });

  // Break one ship image. context.route (not page.route) also catches requests
  // made by the MSW service worker, which fetches the images for the page.
  const context = page.context();
  await context.route('**/ships/ship_2.png*', (route) => route.abort());
  await page.getByRole('button', { name: 'Play', exact: true }).click();

  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Could not load the game assets');

  // The network is back: the retry must load everything and start the match.
  await context.unroute('**/ships/ship_2.png*');
  await alert.getByRole('button', { name: 'Try Again' }).click();
  await waitForStatus(page, 'running');
  await expect(page.getByRole('region', { name: 'Match status' })).toBeVisible();
});

test('shows loading progress before the match starts', async ({ page }) => {
  await openGame(page, { noEnemies: true });
  // Slow every image down a little so the loading screen is visible.
  await page.context().route('**/assets/png/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.continue();
  });
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByText(/Loading assets… \d+%/)).toBeVisible();
  await waitForStatus(page, 'running');
});
