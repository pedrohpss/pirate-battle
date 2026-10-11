import { expect, test } from './fixtures';
import { getState, openGame, startMatch } from './helpers';

// Sound on/off. Test mode plays no audio, but the setting and the button
// work the same way, so they can be checked here.
test('the sound button and the M key mute and unmute, and the choice is saved', async ({ page }) => {
  await openGame(page, { noEnemies: true });
  await startMatch(page);

  const soundButton = page.getByRole('button', { name: 'Mute sound (M)' });
  await expect(soundButton).toHaveAttribute('aria-pressed', 'false');

  await soundButton.click();
  await expect(soundButton).toHaveAttribute('aria-pressed', 'true');
  // Muting does not pause or otherwise affect the match.
  expect((await getState(page)).status).toBe('running');

  await page.keyboard.press('m');
  await expect(soundButton).toHaveAttribute('aria-pressed', 'false');

  // Muted, then refresh: still muted.
  await page.keyboard.press('m');
  await page.reload();
  await startMatch(page);
  await expect(page.getByRole('button', { name: 'Mute sound (M)' })).toHaveAttribute('aria-pressed', 'true');
});
