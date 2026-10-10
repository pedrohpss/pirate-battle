import type { MatchRecord, MatchSettings } from '../api/contracts';

/**
 * Matches of other (fictional) players, so the ranking is never empty.
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
  fixture(1, 'Saltbeard', 14, 90, 'time', '2026-10-01T18:20:00.000Z', DEFAULT_SETTINGS),
  fixture(2, 'Red Ines', 12, 90, 'time', '2026-10-02T14:05:00.000Z', DEFAULT_SETTINGS),
  fixture(3, 'Mara Gale', 11, 78.4, 'death', '2026-10-02T21:40:00.000Z', DEFAULT_SETTINGS),
  fixture(4, 'Iron Ruth', 11, 90, 'time', '2026-10-03T10:15:00.000Z', DEFAULT_SETTINGS),
  fixture(5, 'Old Tobias', 9, 90, 'time', '2026-10-03T19:30:00.000Z', DEFAULT_SETTINGS),
  fixture(6, 'Jade Corsair', 8, 64.2, 'death', '2026-10-04T16:50:00.000Z', DEFAULT_SETTINGS),
  fixture(7, 'Silent Pike', 7, 59.8, 'death', '2026-10-05T12:00:00.000Z', DEFAULT_SETTINGS),
  fixture(8, 'Barnacle Bo', 6, 90, 'time', '2026-10-05T22:10:00.000Z', DEFAULT_SETTINGS),
  fixture(9, 'Finn Tide', 5, 47.1, 'death', '2026-10-06T09:45:00.000Z', DEFAULT_SETTINGS),
  fixture(10, 'Coral Vex', 4, 38.6, 'death', '2026-10-06T20:20:00.000Z', DEFAULT_SETTINGS),
  fixture(11, 'Dusk Harper', 3, 31.0, 'death', '2026-10-07T13:35:00.000Z', DEFAULT_SETTINGS),
  fixture(12, 'Captain Marlow', 2, 22.5, 'death', '2026-10-08T17:00:00.000Z', DEFAULT_SETTINGS),
  fixture(13, 'Saltbeard', 9, 60, 'time', '2026-10-02T11:00:00.000Z', SHORT_SETTINGS),
  fixture(14, 'Finn Tide', 7, 60, 'time', '2026-10-04T15:30:00.000Z', SHORT_SETTINGS),
  fixture(15, 'Coral Vex', 4, 41.3, 'death', '2026-10-07T18:45:00.000Z', SHORT_SETTINGS),
  fixture(16, 'Iron Ruth', 22, 180, 'time', '2026-10-03T20:00:00.000Z', LONG_SETTINGS),
  fixture(17, 'Old Tobias', 15, 141.7, 'death', '2026-10-06T10:10:00.000Z', LONG_SETTINGS),
  fixture(18, 'Red Ines', 10, 66.9, 'death', '2026-10-05T19:25:00.000Z', HARD_SETTINGS),
  fixture(19, 'Mara Gale', 6, 44.0, 'death', '2026-10-07T21:05:00.000Z', HARD_SETTINGS),
];
