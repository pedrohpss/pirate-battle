import type { EndReason } from '../game/simulation/types';

/**
 * Typed contracts of the ranking and match history REST API.
 * Shared by the client (Axios + TanStack Query) and the mock server (MSW),
 * so both sides always agree on the shape of the data.
 *
 * Endpoints:
 *   GET  /api/ranking?matchDuration=&spawnInterval=&page=&pageSize=  -> Page<RankingEntry>
 *   GET  /api/players/:playerId/matches?page=&pageSize=              -> Page<MatchRecord>
 *   POST /api/matches   (body: MatchRecord)                          -> RegisterMatchResponse
 *        201 = created, 200 = this matchId was already registered (idempotent)
 */

export const API_BASE_URL = '/api';

/** The settings a match was played with. Only matches with equal settings are ranked together. */
export interface MatchSettings {
  /** Match length in seconds. */
  matchDuration: number;
  /** Seconds between enemy spawns. */
  spawnInterval: number;
}

/** One finished match, as stored in the match history. */
export interface MatchRecord {
  /**
   * Unique id created by the client when the match ends.
   * It is also the idempotency key: sending the same match twice never duplicates it.
   */
  matchId: string;
  playerId: string;
  playerName: string;
  /** When the match ended (ISO 8601). */
  endedAt: string;
  score: number;
  /** Seconds of active play. */
  duration: number;
  endReason: EndReason;
  settings: MatchSettings;
}

/** One line of the ranking. */
export interface RankingEntry {
  /** Position in the ranking, starting at 1. */
  rank: number;
  matchId: string;
  playerId: string;
  playerName: string;
  score: number;
  duration: number;
  endedAt: string;
}

/** A page of results. Pages start at 1. */
export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface RegisterMatchResponse {
  record: MatchRecord;
  /** false when the match had already been registered before (a retry). */
  created: boolean;
}

/** Body of every error response. */
export interface ApiErrorBody {
  message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/**
 * Checks that unknown data (a request body, something read from storage)
 * really is a MatchRecord. Returns null when it is not.
 */
export function parseMatchRecord(value: unknown): MatchRecord | null {
  if (!isRecord(value) || !isRecord(value.settings)) return null;
  const { matchId, playerId, playerName, endedAt, score, duration, endReason } = value;
  const { matchDuration, spawnInterval } = value.settings;

  const valid =
    isNonEmptyString(matchId) &&
    isNonEmptyString(playerId) &&
    isNonEmptyString(playerName) &&
    isNonEmptyString(endedAt) &&
    !Number.isNaN(Date.parse(endedAt)) &&
    isNonNegativeNumber(score) &&
    Number.isInteger(score) &&
    isNonNegativeNumber(duration) &&
    (endReason === 'time' || endReason === 'death') &&
    isNonNegativeNumber(matchDuration) &&
    isNonNegativeNumber(spawnInterval);

  if (!valid) return null;
  return {
    matchId,
    playerId,
    playerName,
    endedAt,
    score,
    duration,
    endReason,
    settings: { matchDuration, spawnInterval },
  };
}
