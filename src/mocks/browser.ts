import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';
import { applyScenarioFromUrl } from './scenarios';

/**
 * Starts the mock API in the browser (development AND the published build).
 * Requests to /api/* are answered by the handlers; everything else
 * (game images, sounds, the page itself) passes through untouched.
 */
export async function startMockServer(): Promise<void> {
  applyScenarioFromUrl(window.location.search);
  const worker = setupWorker(...handlers);
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: true, // keeps the console clean
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  });
}
