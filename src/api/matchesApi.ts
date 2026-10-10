import { apiClient } from './client';
import type { MatchRecord, MatchSettings, Page, RankingEntry, RegisterMatchResponse } from './contracts';

/**
 * The three API calls. Plain async functions (no React): TanStack Query
 * calls them and takes care of caching, retries and loading states.
 * The `signal` lets TanStack Query cancel a request that is no longer needed.
 */

export async function fetchRanking(
  settings: MatchSettings,
  page: number,
  pageSize: number,
  signal?: AbortSignal,
): Promise<Page<RankingEntry>> {
  const { data } = await apiClient.get<Page<RankingEntry>>('/ranking', {
    params: { ...settings, page, pageSize },
    signal,
  });
  return data;
}

export async function fetchHistory(
  playerId: string,
  page: number,
  pageSize: number,
  signal?: AbortSignal,
): Promise<Page<MatchRecord>> {
  const { data } = await apiClient.get<Page<MatchRecord>>(
    `/players/${encodeURIComponent(playerId)}/matches`,
    { params: { page, pageSize }, signal },
  );
  return data;
}

/** Safe to call more than once for the same match: the server answers with the existing record. */
export async function registerMatch(record: MatchRecord): Promise<RegisterMatchResponse> {
  const { data } = await apiClient.post<RegisterMatchResponse>('/matches', record);
  return data;
}
