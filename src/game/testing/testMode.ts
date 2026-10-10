import type { EndReason, EnemyKind, Rect, Team } from '../simulation/types';
import type { MatchStatus } from '../session/MatchStore';

/**
 * Test mode, used by the Playwright tests (never active in normal play).
 *
 * Enabled with `?test=1` in the URL:
 * - `seed=<number>`: seeded randomness, so enemies spawn in the same places every run;
 * - `noEnemies=1`: no enemy spawns (isolates movement, collision and weapon tests).
 *
 * In test mode the simulation does NOT advance with real time. Tests move the
 * clock with `window.__PIRATE_TEST__.advance(seconds)`, which runs the real
 * game loop step by step (rules, input from real key/touch events, collisions
 * and rendering). Tests can also read a snapshot of the state. Nothing else.
 */
export interface TestOptions {
  enabled: boolean;
  seed: number;
  noEnemies: boolean;
}

export function readTestOptions(search: string = window.location.search): TestOptions {
  const params = new URLSearchParams(search);
  const seed = Number(params.get('seed'));
  return {
    enabled: params.get('test') === '1',
    seed: Number.isInteger(seed) && seed !== 0 ? seed : 1,
    noEnemies: params.get('noEnemies') === '1',
  };
}

/** What a test can observe. Plain data, copied, so tests cannot change the game. */
export interface TestState {
  status: MatchStatus;
  score: number;
  elapsed: number;
  timeLeft: number;
  endReason: EndReason | null;
  player: { x: number; y: number; angle: number; health: number; maxHealth: number; radius: number };
  enemies: { id: number; kind: EnemyKind; x: number; y: number; health: number; radius: number }[];
  projectiles: { team: Team; x: number; y: number }[];
  /** Total player projectiles created since the match started. */
  playerProjectilesFired: number;
  /** Total enemies spawned since the match started. */
  enemiesSpawned: number;
  obstacles: Rect[];
}

export interface PirateTestApi {
  /** Runs the game loop for `seconds` of game time, in fixed 1/60 s steps. */
  advance(seconds: number): void;
  getState(): TestState;
}

declare global {
  interface Window {
    __PIRATE_TEST__?: PirateTestApi;
  }
}
