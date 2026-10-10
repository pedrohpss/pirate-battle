import { expect, test } from './fixtures';
import { getState, openGame, setOptions, startMatch } from './helpers';

// 1. Navigation, validation and persistence of the options.
test.describe('Options', () => {
  test('rejects invalid values with accessible messages', async ({ page }) => {
    await openGame(page);
    await page.getByRole('button', { name: 'Options' }).click();

    const duration = page.getByLabel('Game session time');
    const spawn = page.getByLabel('Enemy spawn time');
    await duration.fill('30');
    await spawn.fill('0');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText('Use a whole number from 60 to 180.')).toBeVisible();
    await expect(page.getByText('Use a value from 1 to 10.')).toBeVisible();
    await expect(duration).toHaveAttribute('aria-invalid', 'true');
    // Focus goes to the first invalid field.
    await expect(duration).toBeFocused();

    await duration.fill('');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Enter a number of seconds.')).toBeVisible();
  });

  test('saves valid values, keeps them after refresh and uses them in the next match', async ({ page }) => {
    await openGame(page, { noEnemies: true });
    await setOptions(page, 75, 2.5);

    await page.reload();
    await page.getByRole('button', { name: 'Options' }).click();
    await expect(page.getByLabel('Game session time')).toHaveValue('75');
    await expect(page.getByLabel('Enemy spawn time')).toHaveValue('2.5');
    await page.getByRole('button', { name: 'Back' }).click();

    await startMatch(page);
    expect((await getState(page)).timeLeft).toBe(75);
  });
});
