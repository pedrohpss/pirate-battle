import type { MatchRecord, MatchSettings } from '../api/contracts';

/**
 * Matches of other (sample) players, so the ranking is never empty.
 * A player can appear more than once (several matches).
 * Most use the default settings (90 s, enemy every 4 s) so the default
 * ranking has several pages; a few use other settings, which shows that
 * matches are only compared with matches played under the same settings.
 * Two entries tie on score on purpose, to show the tie-break rule.
 */

const DEFAULT_SETTINGS: MatchSettings = { matchDuration: 90, spawnInterval: 4 };
const SHORT_SETTINGS: MatchSettings = { matchDuration: 60, spawnInterval: 4 };
const LONG_SETTINGS: MatchSettings = { matchDuration: 180, spawnInterval: 4 };
const HARD_SETTINGS: MatchSettings = { matchDuration: 120, spawnInterval: 2 };

function fixture(
  n: number,
  playerName: string,
  score: number,
  duration: number,
  endReason: MatchRecord['endReason'],
  endedAt: string,
  settings: MatchSettings,
): MatchRecord {
  const id = String(n).padStart(3, '0');
  return {
    matchId: `fixture-match-${id}`,
    playerId: `fixture-player-${playerName.toLowerCase().replace(/\s+/g, '-')}`,
    playerName,
    endedAt,
    score,
    duration,
    endReason,
    settings,
  };
}

export const FIXTURE_MATCHES: readonly MatchRecord[] = [
  // Default settings (90 s, enemy every 4 s): 12 matches, so the ranking has 3 pages.
  fixture(1, 'Robson Cezario', 14, 90, 'time', '2026-10-01T18:20:00.000Z', DEFAULT_SETTINGS),
  fixture(2, 'Natalia', 12, 90, 'time', '2026-10-02T14:05:00.000Z', DEFAULT_SETTINGS),
  // Same score as the next one: the shorter match wins the tie.
  fixture(3, 'Carlos Eduardo', 11, 78.4, 'death', '2026-10-02T21:40:00.000Z', DEFAULT_SETTINGS),
  fixture(4, 'Gustavo Santos', 11, 90, 'time', '2026-10-03T10:15:00.000Z', DEFAULT_SETTINGS),
  fixture(5, 'Alexandre Junior', 9, 90, 'time', '2026-10-03T19:30:00.000Z', DEFAULT_SETTINGS),
  fixture(6, 'Rafael Fernandes', 8, 64.2, 'death', '2026-10-04T16:50:00.000Z', DEFAULT_SETTINGS),
  fixture(7, 'Alyce', 7, 59.8, 'death', '2026-10-05T12:00:00.000Z', DEFAULT_SETTINGS),
  fixture(8, 'Rafael', 6, 90, 'time', '2026-10-05T22:10:00.000Z', DEFAULT_SETTINGS),
  fixture(9, 'Pedro Henrique', 5, 47.1, 'death', '2026-10-06T09:45:00.000Z', DEFAULT_SETTINGS),
  fixture(10, 'Vitória', 4, 38.6, 'death', '2026-10-06T20:20:00.000Z', DEFAULT_SETTINGS),
  fixture(11, 'Pedro Santos', 3, 31.0, 'death', '2026-10-07T13:35:00.000Z', DEFAULT_SETTINGS),
  fixture(12, 'Gustavo Santos', 2, 22.5, 'death', '2026-10-08T17:00:00.000Z', DEFAULT_SETTINGS),
  // Other settings: these never mix with the default ranking.
  fixture(13, 'Robson Cezario', 9, 60, 'time', '2026-10-02T11:00:00.000Z', SHORT_SETTINGS),
  fixture(14, 'Pedro Henrique', 7, 60, 'time', '2026-10-04T15:30:00.000Z', SHORT_SETTINGS),
  fixture(15, 'Vitória', 4, 41.3, 'death', '2026-10-07T18:45:00.000Z', SHORT_SETTINGS),
  fixture(16, 'Natalia', 22, 180, 'time', '2026-10-03T20:00:00.000Z', LONG_SETTINGS),
  fixture(17, 'Alexandre Junior', 15, 141.7, 'death', '2026-10-06T10:10:00.000Z', LONG_SETTINGS),
  fixture(18, 'Alyce', 10, 66.9, 'death', '2026-10-05T19:25:00.000Z', HARD_SETTINGS),
  fixture(19, 'Carlos Eduardo', 6, 44.0, 'death', '2026-10-07T21:05:00.000Z', HARD_SETTINGS),
];
