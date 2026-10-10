import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { finishMatchByTime, openGame, selectScenario, setOptions, startMatch } from './helpers';

const rows = (page: Page) => page.getByRole('tabpanel').locator('tbody tr');

// 10. Ranking and Match History: loading, pagination, empty and error states.
test.describe('Ranking and Match History', () => {
  test('ranking is paginated and ordered', async ({ page }) => {
    await openGame(page);
    await expect(rows(page)).toHaveCount(5);
    await expect(page.getByText('Page 1 of 3')).toBeVisible();
    await expect(rows(page).first().locator('td').first()).toHaveText('1');

    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Page 2 of 3')).toBeVisible();
    await expect(rows(page).first().locator('td').first()).toHaveText('6');
  });

  test('shows a loading state while the request is slow', async ({ page }) => {
    await openGame(page, { scenario: 'slow' });
    await expect(page.getByText('Loading the ranking…')).toBeVisible();
    await expect(rows(page)).toHaveCount(5);
  });

  test('shows empty states', async ({ page }) => {
    await openGame(page, { scenario: 'empty' });
    await expect(page.getByText('No matches with these settings yet. Be the first!')).toBeVisible();
    await page.getByRole('tab', { name: 'Match History' }).click();
    await expect(page.getByText('You have no saved matches yet.')).toBeVisible();
  });

  test('a failing ranking shows an error and does not affect the history or the game', async ({ page }) => {
    await openGame(page, { scenario: 'ranking-error' });
    await expect(page.getByRole('alert')).toContainText('Could not load the ranking.');
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();

    await page.getByRole('tab', { name: 'Match History' }).click();
    await expect(page.getByText('You have no saved matches yet.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
  });

  test('tabs work with the keyboard', async ({ page }) => {
    await openGame(page);
    await page.getByRole('tab', { name: 'Ranking' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Match History' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Match History' })).toBeFocused();
  });
});

// 11. Registering a match, refreshing both tabs, pending submission after refresh.
test.describe('Match registration', () => {
  test('a finished match appears once in the history and in the ranking', async ({ page }) => {
    await openGame(page, { noEnemies: true });
    await setOptions(page, 60, 4);
    await startMatch(page);
    await finishMatchByTime(page);

    await expect(page.getByText('Saved to the ranking and history.')).toBeVisible();
    await page.getByRole('button', { name: 'Main Menu' }).click();

    // Ranking for 60 s / 4 s: 3 fixtures + this match (0 points) in 4th place.
    await expect(page.getByRole('tabpanel')).toContainText('(you)');
    await page.getByRole('tab', { name: 'Match History' }).click();
    await expect(rows(page)).toHaveCount(1);
  });

  test('a match that could not be saved survives a refresh and is sent again', async ({ page }) => {
    await openGame(page, { noEnemies: true, scenario: 'register-unavailable' });
    await setOptions(page, 60, 4);
    await startMatch(page);
    await finishMatchByTime(page);

    await expect(page.getByText(/Not saved yet/)).toBeVisible();
    // The player can start another match while the save is pending.
    await expect(page.getByRole('button', { name: 'Play Again' })).toBeEnabled();
    await page.getByRole('button', { name: 'Main Menu' }).click();
    await expect(page.getByText('1 match is waiting to be saved.')).toBeVisible();

    // The server comes back; the page is opened again (refresh).
    await selectScenario(page, 'Success');
    await page.goto('/');
    await page.getByRole('tab', { name: 'Match History' }).click();
    await expect(rows(page)).toHaveCount(1);
    await expect(page.getByText(/waiting to be saved/)).toHaveCount(0);
  });
});

// 12. Retry after a timeout without duplicates; late answers do not overwrite newer data.
test.describe('Resilience', () => {
  test('a save that timed out is retried without creating a duplicate', async ({ page }) => {
    await openGame(page, { noEnemies: true, scenario: 'register-timeout' });
    await setOptions(page, 60, 4);
    await startMatch(page);
    await finishMatchByTime(page);

    // The server stored the match, but the answer never arrived.
    await expect(page.getByText(/Not saved yet/)).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Main Menu' }).click();
    await selectScenario(page, 'Success');
    await page.getByRole('button', { name: 'Retry now' }).click();
    await expect(page.getByText(/waiting to be saved/)).toHaveCount(0);

    await page.getByRole('tab', { name: 'Match History' }).click();
    await expect(rows(page)).toHaveCount(1);
  });

  test('a late answer for another page never replaces the page on screen', async ({ page }) => {
    // Odd requests take 2.5 s, even requests 150 ms.
    await openGame(page, { scenario: 'out-of-order' });
    await expect(rows(page)).toHaveCount(5); // page 1 (slow request)

    await page.getByRole('button', { name: 'Next' }).click(); // page 2 (fast)
    await expect(page.getByText('Page 2 of 3')).toBeVisible();
    await page.getByRole('button', { name: 'Previous' }).click(); // page 1 refetch (slow)
    await page.getByRole('button', { name: 'Next' }).click(); // page 2 refetch (fast)

    // Let the slow page 1 answer arrive.
    await page.waitForTimeout(3000);
    await expect(page.getByText('Page 2 of 3')).toBeVisible();
    await expect(rows(page).first().locator('td').first()).toHaveText('6');
  });
});
