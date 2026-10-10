import type { EndReason } from '../game/simulation/types';
import { validateOptions } from './options';
import type { GameOptions } from './options';
import { isRecord, readStorage, writeStorage } from './storage';

/** Summary of a finished match. */
export interface MatchResult {
  /** Same id used to register the match on the server. */
  matchId: string;
  score: number;
  /** Seconds of active play. */
  timePlayed: number;
  endReason: EndReason;
  /** When the match ended (ISO 8601 date string). */
  endedAt: string;
  /** The options the match was played with. */
  options: GameOptions;
}

const STORAGE_KEY = 'last-result:v2';

/** The last finished match, or null if there is none (or the data is broken). */
export function loadLastResult(): MatchResult | null {
  return readStorage(STORAGE_KEY, (value) => {
    if (!isRecord(value)) return null;
    const { matchId, score, timePlayed, endReason, endedAt, options } = value;

    const validNumbers = typeof score === 'number' && typeof timePlayed === 'number';
    const validReason = endReason === 'time' || endReason === 'death';
    const validDate = typeof endedAt === 'string' && !Number.isNaN(Date.parse(endedAt));
    const validOptions =
      isRecord(options) &&
      validateOptions({
        matchDuration: Number(options.matchDuration),
        spawnInterval: Number(options.spawnInterval),
      }).options;

    if (typeof matchId !== 'string' || !validNumbers || !validReason || !validDate || !validOptions) {
      return null;
    }
    return { matchId, score, timePlayed, endReason, endedAt, options: validOptions };
  });
}

/** What the match screen reports; the App adds the matchId. */
export type MatchSummary = Omit<MatchResult, 'matchId'>;

/**
 * Saves a finished match. Only completed matches get here:
 * abandoned matches (Main Menu, refresh, closing the tab) are never saved.
 */
export function saveLastResult(result: MatchResult): boolean {
  return writeStorage(STORAGE_KEY, result);
}
