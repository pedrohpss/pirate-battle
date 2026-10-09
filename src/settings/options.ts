import { DEFAULT_GAME_CONFIG } from '../game/config';
import type { GameConfig } from '../game/config';
import { isRecord, readStorage, writeStorage } from './storage';

/** The settings the player can change in the Options screen. */
export interface GameOptions {
  /** Match length in seconds of active play. */
  matchDuration: number;
  /** Seconds between enemy spawns. */
  spawnInterval: number;
}

/**
 * Allowed values (documented in the README).
 * - Match duration: 60 to 180 seconds, whole seconds (required by the challenge).
 * - Spawn interval: 1 to 10 seconds. Below 1 s the arena fills up faster than
 *   anyone can react; above 10 s matches become too quiet.
 */
export const OPTION_LIMITS = {
  matchDuration: { min: 60, max: 180, step: 1 },
  spawnInterval: { min: 1, max: 10, step: 0.5 },
} as const;

export const DEFAULT_OPTIONS: GameOptions = {
  matchDuration: DEFAULT_GAME_CONFIG.matchDuration,
  spawnInterval: DEFAULT_GAME_CONFIG.spawn.interval,
};

export type OptionErrors = Partial<Record<keyof GameOptions, string>>;

/** What the form sends: raw text from the inputs (or numbers from storage). */
export type OptionsInput = Record<keyof GameOptions, string | number>;

const STORAGE_KEY = 'options:v1';

/** Turns a form value into a number, or null if it is empty or not a number. */
function toNumber(value: string | number): number | null {
  if (typeof value === 'string' && value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/**
 * Checks every option. Returns the valid options, or null plus an error
 * message for each invalid field (shown next to that field in the form).
 */
export function validateOptions(input: OptionsInput): {
  options: GameOptions | null;
  errors: OptionErrors;
} {
  const errors: OptionErrors = {};
  const { matchDuration: durationLimits, spawnInterval: spawnLimits } = OPTION_LIMITS;

  const matchDuration = toNumber(input.matchDuration);
  if (matchDuration === null) {
    errors.matchDuration = 'Enter a number of seconds.';
  } else if (
    !Number.isInteger(matchDuration) ||
    matchDuration < durationLimits.min ||
    matchDuration > durationLimits.max
  ) {
    errors.matchDuration = `Use a whole number from ${durationLimits.min} to ${durationLimits.max}.`;
  }

  const spawnInterval = toNumber(input.spawnInterval);
  if (spawnInterval === null) {
    errors.spawnInterval = 'Enter a number of seconds.';
  } else if (spawnInterval < spawnLimits.min || spawnInterval > spawnLimits.max) {
    errors.spawnInterval = `Use a value from ${spawnLimits.min} to ${spawnLimits.max}.`;
  }

  if (Object.keys(errors).length > 0 || matchDuration === null || spawnInterval === null) {
    return { options: null, errors };
  }
  return { options: { matchDuration, spawnInterval }, errors };
}

/** Saved options, or the defaults if nothing valid was saved. */
export function loadOptions(): GameOptions {
  const saved = readStorage(STORAGE_KEY, (value) => {
    if (!isRecord(value)) return null;
    const { matchDuration, spawnInterval } = value;
    if (typeof matchDuration !== 'number' || typeof spawnInterval !== 'number') return null;
    return validateOptions({ matchDuration, spawnInterval }).options;
  });
  return saved ?? DEFAULT_OPTIONS;
}

export function saveOptions(options: GameOptions): boolean {
  return writeStorage(STORAGE_KEY, options);
}

/**
 * Builds the configuration for ONE match: a deep copy of the defaults with
 * the player's options applied. Because it is a copy (a "snapshot"), changing
 * options later never affects a match that already started.
 */
export function createMatchConfig(options: GameOptions): GameConfig {
  const config = structuredClone(DEFAULT_GAME_CONFIG);
  config.matchDuration = options.matchDuration;
  config.spawn.interval = options.spawnInterval;
  return config;
}

/** Reads the player-facing options back from a match configuration. */
export function optionsFromConfig(config: GameConfig): GameOptions {
  return { matchDuration: config.matchDuration, spawnInterval: config.spawn.interval };
}
