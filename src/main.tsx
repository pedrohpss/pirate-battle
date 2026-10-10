import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from './api/queries';
import App from './App';
import './index.css';

/**
 * The ranking and history API exists only as a mock (MSW), so it is started
 * in development AND in the published build. If it cannot start (very old
 * browser, private mode without service workers), the game still opens:
 * only the ranking and history show an error.
 */
async function startMockApi(): Promise<void> {
  try {
    const { startMockServer } = await import('./mocks/browser');
    await startMockServer();
  } catch (error) {
    console.warn('Mock API unavailable: ranking and history will not load.', error);
  }
}

const queryClient = createQueryClient();
const rootElement = document.getElementById('root');

if (rootElement) {
  void startMockApi().then(() => {
    createRoot(rootElement).render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </StrictMode>,
    );
  });
}
