import { parseMatchRecord } from '../api/contracts';
import type { MatchRecord, MatchSettings, Page, RankingEntry } from '../api/contracts';
import { FIXTURE_MATCHES } from './fixtures';

/**
 * The mock server's "database".
 * Fixtures are fixed; matches registered by the player are kept in
 * localStorage, so confirmed records survive a page refresh.
 */

const DB_KEY = 'pirate-battle:mock-db:v1';

/** The part of localStorage the database uses (replaceable in tests). */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function readStoredMatches(storage: KeyValueStorage): MatchRecord[] {
  try {
    const raw = storage.getItem(DB_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    // Drop anything that is not a valid record (old formats, manual edits).
    return parsed.map(parseMatchRecord).filter((record): record is MatchRecord => record !== null);
  } catch {
    return [];
  }
}

function writeStoredMatches(storage: KeyValueStorage, matches: MatchRecord[]): void {
  storage.setItem(DB_KEY, JSON.stringify(matches));
}

/** Every match the server knows: fixtures + matches registered by the player. */
export function getAllMatches(storage: KeyValueStorage): MatchRecord[] {
  return [...FIXTURE_MATCHES, ...readStoredMatches(storage)];
}

/**
 * Saves a match. Idempotent: if a match with the same id already exists,
 * nothing is written and the existing record is returned.
 */
export function insertMatch(
  storage: KeyValueStorage,
  record: MatchRecord,
): { record: MatchRecord; created: boolean } {
  const existing = getAllMatches(storage).find((match) => match.matchId === record.matchId);
  if (existing) return { record: existing, created: false };

  writeStoredMatches(storage, [...readStoredMatches(storage), record]);
  return { record, created: true };
}

export function resetDatabase(storage: KeyValueStorage): void {
  storage.removeItem(DB_KEY);
}

function sameSettings(a: MatchSettings, b: MatchSettings): boolean {
  return a.matchDuration === b.matchDuration && a.spawnInterval === b.spawnInterval;
}

/**
 * Ranking order, fully deterministic:
 * 1. higher score first;
 * 2. same score: shorter duration first (scored faster);
 * 3. still tied: the match that ended first (got there first);
 * 4. still tied: match id, alphabetically (never ambiguous).
 */
export function compareForRanking(a: MatchRecord, b: MatchRecord): number {
  return (
    b.score - a.score ||
    a.duration - b.duration ||
    Date.parse(a.endedAt) - Date.parse(b.endedAt) ||
    a.matchId.localeCompare(b.matchId)
  );
}

/** Cuts a list into pages. Pages start at 1. */
export function paginate<T>(items: T[], page: number, pageSize: number): Page<T> {
  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page, pageSize, totalItems, totalPages };
}

export function buildRanking(
  matches: MatchRecord[],
  settings: MatchSettings,
  page: number,
  pageSize: number,
): Page<RankingEntry> {
  const ranked: RankingEntry[] = matches
    .filter((match) => sameSettings(match.settings, settings))
    .sort(compareForRanking)
    .map((match, index) => ({
      rank: index + 1,
      matchId: match.matchId,
      playerId: match.playerId,
      playerName: match.playerName,
      score: match.score,
      duration: match.duration,
      endedAt: match.endedAt,
    }));
  return paginate(ranked, page, pageSize);
}

/** A player's matches, most recent first. */
export function buildHistory(
  matches: MatchRecord[],
  playerId: string,
  page: number,
  pageSize: number,
): Page<MatchRecord> {
  const history = matches
    .filter((match) => match.playerId === playerId)
    .sort((a, b) => Date.parse(b.endedAt) - Date.parse(a.endedAt) || a.matchId.localeCompare(b.matchId));
  return paginate(history, page, pageSize);
}
