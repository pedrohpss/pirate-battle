/**
 * Network scenarios for the mock API: a reproducible way to show and test
 * how the interface behaves when the network is slow, out of order or broken.
 *
 * How to choose one:
 * - the "Network simulation" panel in the main menu, or
 * - the URL: ?scenario=timeout (optionally &seed=7 for the random latency).
 * The choice is saved in localStorage, so it survives a refresh.
 */

export const SCENARIOS = [
  { id: 'success', label: 'Success', description: 'Everything works, about 300 ms per request.' },
  { id: 'empty', label: 'Empty lists', description: 'Ranking and history come back empty.' },
  { id: 'many-pages', label: 'Many pages', description: 'Adds 45 extra ranking entries.' },
  { id: 'slow', label: 'Slow', description: 'Every request takes 2.5 seconds.' },
  {
    id: 'variable-latency',
    label: 'Variable latency',
    description: 'Each request takes 0.1 to 3 s (seeded, so it is reproducible).',
  },
  {
    id: 'out-of-order',
    label: 'Out of order',
    description: 'Odd requests take 2.5 s, even ones 150 ms, so answers arrive out of order.',
  },
  { id: 'timeout', label: 'Timeout', description: 'The server never answers.' },
  { id: 'network-error', label: 'Connection failure', description: 'Every request fails to connect.' },
  { id: 'server-error', label: 'Server error (500)', description: 'Every request answers 500.' },
  { id: 'bad-request', label: 'Client error (400)', description: 'Every request answers 400.' },
  { id: 'ranking-error', label: 'Ranking fails', description: 'Only the ranking answers 500.' },
  { id: 'history-error', label: 'History fails', description: 'Only the history answers 500.' },
  {
    id: 'register-timeout',
    label: 'Timeout after saving',
    description: 'Saving a match is stored, but the answer never arrives. Retrying must not duplicate it.',
  },
  {
    id: 'register-unavailable',
    label: 'Saving unavailable (503)',
    description: 'Saving a match fails. Switch back to Success and retry to recover.',
  },
] as const;

export type ScenarioId = (typeof SCENARIOS)[number]['id'];

const SCENARIO_KEY = 'pirate-battle:mock-scenario';
const SEED_KEY = 'pirate-battle:mock-seed';
const DEFAULT_SCENARIO: ScenarioId = 'success';
const DEFAULT_SEED = 1;

function isScenarioId(value: string | null): value is ScenarioId {
  return SCENARIOS.some((scenario) => scenario.id === value);
}

function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeKey(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the scenario simply will not survive a refresh.
  }
}

/** Applies ?scenario= and ?seed= from the URL, if present. Called once at startup. */
export function applyScenarioFromUrl(search: string): void {
  const params = new URLSearchParams(search);
  const scenario = params.get('scenario');
  const seed = params.get('seed');
  if (isScenarioId(scenario)) writeKey(SCENARIO_KEY, scenario);
  if (seed !== null && Number.isInteger(Number(seed))) writeKey(SEED_KEY, seed);
}

export function getScenario(): ScenarioId {
  const saved = readKey(SCENARIO_KEY);
  return isScenarioId(saved) ? saved : DEFAULT_SCENARIO;
}

export function setScenario(id: ScenarioId): void {
  writeKey(SCENARIO_KEY, id);
}

export function getSeed(): number {
  const saved = Number(readKey(SEED_KEY));
  return Number.isInteger(saved) && saved !== 0 ? saved : DEFAULT_SEED;
}

/** Back to the initial state: default scenario and seed. */
export function resetScenario(): void {
  writeKey(SCENARIO_KEY, null);
  writeKey(SEED_KEY, null);
}
