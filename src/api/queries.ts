import { keepPreviousData, QueryClient, useQuery } from '@tanstack/react-query';
import { isRetryableError } from './client';
import type { MatchSettings } from './contracts';
import { fetchHistory, fetchRanking } from './matchesApi';

/** Rows per page in both tabs. */
export const PAGE_SIZE = 5;

/** Up to 2 automatic retries, only for errors that may go away (timeout, connection, 5xx). */
const MAX_RETRIES = 2;

export function shouldRetry(failureCount: number, error: unknown): boolean {
  return failureCount < MAX_RETRIES && isRetryableError(error);
}

/** Waits 1 s, then 2 s between retries (never more than 4 s). */
export function retryDelay(attemptIndex: number): number {
  return Math.min(1000 * 2 ** attemptIndex, 4000);
}

/**
 * Cache keys. Each page of each ranking has its own key, so a late answer
 * for one page can never overwrite the data of another page.
 * The short keys ('ranking', 'history') invalidate every page at once.
 */
export const queryKeys = {
  allRankings: ['ranking'] as const,
  ranking: (settings: MatchSettings, page: number) =>
    ['ranking', settings.matchDuration, settings.spawnInterval, page] as const,
  allHistories: ['history'] as const,
  history: (playerId: string, page: number) => ['history', playerId, page] as const,
};

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        retryDelay,
        // Data is considered old right away, so reopening a tab refreshes it.
        staleTime: 0,
        // Focus changes also pause the game; avoid surprise refetches there.
        refetchOnWindowFocus: false,
      },
      mutations: { retry: shouldRetry, retryDelay },
    },
  });
}

export function useRankingQuery(settings: MatchSettings, page: number) {
  return useQuery({
    queryKey: queryKeys.ranking(settings, page),
    queryFn: ({ signal }) => fetchRanking(settings, page, PAGE_SIZE, signal),
    // While the next page loads, keep showing the current one instead of a blank list.
    placeholderData: keepPreviousData,
    // Refresh every time the tab is shown again.
    refetchOnMount: 'always',
  });
}

export function useHistoryQuery(playerId: string, page: number) {
  return useQuery({
    queryKey: queryKeys.history(playerId, page),
    queryFn: ({ signal }) => fetchHistory(playerId, page, PAGE_SIZE, signal),
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
  });
}
