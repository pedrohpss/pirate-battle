import { delay, http, HttpResponse } from 'msw';
import { API_BASE_URL, parseMatchRecord } from '../api/contracts';
import type { ApiErrorBody, MatchRecord, MatchSettings } from '../api/contracts';
import { createSeededRandom } from '../game/simulation/math';
import { buildHistory, buildRanking, getAllMatches, insertMatch } from './db';
import { getScenario, getSeed } from './scenarios';
import type { ScenarioId } from './scenarios';

/**
 * MSW request handlers: a fake REST server that runs inside the browser.
 * The same handlers are used in development, in the published build and in tests.
 */

type Endpoint = 'ranking' | 'history' | 'register';

const NORMAL_LATENCY_MS = 300;
const SLOW_LATENCY_MS = 2500;
const FAST_LATENCY_MS = 150;
const MAX_PAGE_SIZE = 50;

// Random latency is seeded, so a given seed always produces the same delays.
let random = createSeededRandom(getSeed());
let randomSeed = getSeed();
let requestCount = 0;

function seededRandom(): number {
  const seed = getSeed();
  if (seed !== randomSeed) {
    randomSeed = seed;
    random = createSeededRandom(seed);
  }
  return random();
}

function errorResponse(status: number, message: string) {
  return HttpResponse.json<ApiErrorBody>({ message }, { status });
}

/** Waits as long as the current scenario says. 'timeout' never returns. */
async function simulateLatency(scenario: ScenarioId): Promise<void> {
  requestCount += 1;
  switch (scenario) {
    case 'slow':
      return delay(SLOW_LATENCY_MS);
    case 'variable-latency':
      return delay(100 + Math.round(seededRandom() * 2900));
    case 'out-of-order':
      return delay(requestCount % 2 === 1 ? SLOW_LATENCY_MS : FAST_LATENCY_MS);
    case 'timeout':
      return delay('infinite');
    default:
      return delay(NORMAL_LATENCY_MS);
  }
}

/** The failure the current scenario forces on this endpoint, or null. */
function simulateFailure(scenario: ScenarioId, endpoint: Endpoint) {
  switch (scenario) {
    case 'network-error':
      return HttpResponse.error();
    case 'server-error':
      return errorResponse(500, 'Internal server error.');
    case 'bad-request':
      return errorResponse(400, 'The request was rejected.');
    case 'ranking-error':
      return endpoint === 'ranking' ? errorResponse(500, 'The ranking is unavailable.') : null;
    case 'history-error':
      return endpoint === 'history' ? errorResponse(500, 'The match history is unavailable.') : null;
    case 'register-unavailable':
      return endpoint === 'register' ? errorResponse(503, 'Saving matches is unavailable.') : null;
    default:
      return null;
  }
}

/** Reads a positive whole number from the query string, or null. */
function readPositiveInt(url: URL, name: string): number | null {
  const value = Number(url.searchParams.get(name));
  return Number.isInteger(value) && value > 0 ? value : null;
}

function readPaging(url: URL): { page: number; pageSize: number } | null {
  const page = readPositiveInt(url, 'page');
  const pageSize = readPositiveInt(url, 'pageSize');
  if (page === null || pageSize === null || pageSize > MAX_PAGE_SIZE) return null;
  return { page, pageSize };
}

/** 45 extra ranking entries for the "many-pages" scenario, the same every time. */
function extraMatches(settings: MatchSettings): MatchRecord[] {
  const generate = createSeededRandom(4242);
  return Array.from({ length: 45 }, (_, index) => ({
    matchId: `extra-match-${String(index + 1).padStart(3, '0')}`,
    playerId: `extra-player-${index + 1}`,
    playerName: `Deckhand ${index + 1}`,
    endedAt: new Date(Date.UTC(2026, 8, 1, 12, index)).toISOString(),
    score: Math.floor(generate() * 10),
    duration: settings.matchDuration,
    endReason: 'time' as const,
    settings,
  }));
}

export const handlers = [
  http.get(`${API_BASE_URL}/ranking`, async ({ request }) => {
    const scenario = getScenario();
    await simulateLatency(scenario);
    const failure = simulateFailure(scenario, 'ranking');
    if (failure) return failure;

    const url = new URL(request.url);
    const paging = readPaging(url);
    const matchDuration = readPositiveInt(url, 'matchDuration');
    const spawnInterval = Number(url.searchParams.get('spawnInterval'));
    if (!paging || matchDuration === null || !(spawnInterval > 0)) {
      return errorResponse(400, 'Invalid ranking query.');
    }

    const settings = { matchDuration, spawnInterval };
    let matches = scenario === 'empty' ? [] : getAllMatches(localStorage);
    if (scenario === 'many-pages') matches = [...matches, ...extraMatches(settings)];

    return HttpResponse.json(buildRanking(matches, settings, paging.page, paging.pageSize));
  }),

  http.get(`${API_BASE_URL}/players/:playerId/matches`, async ({ request, params }) => {
    const scenario = getScenario();
    await simulateLatency(scenario);
    const failure = simulateFailure(scenario, 'history');
    if (failure) return failure;

    const playerId = params.playerId;
    const paging = readPaging(new URL(request.url));
    if (typeof playerId !== 'string' || !paging) {
      return errorResponse(400, 'Invalid history query.');
    }

    const matches = scenario === 'empty' ? [] : getAllMatches(localStorage);
    return HttpResponse.json(buildHistory(matches, playerId, paging.page, paging.pageSize));
  }),

  http.post(`${API_BASE_URL}/matches`, async ({ request }) => {
    const scenario = getScenario();
    const record = parseMatchRecord(await request.json());
    if (!record) return errorResponse(400, 'Invalid match record.');

    // The record is stored, but the answer never arrives: the client times out
    // and retries. The retry finds the stored record and gets 200, not a duplicate.
    if (scenario === 'register-timeout') {
      insertMatch(localStorage, record);
      await delay('infinite');
    }

    await simulateLatency(scenario);
    const failure = simulateFailure(scenario, 'register');
    if (failure) return failure;

    const result = insertMatch(localStorage, record);
    return HttpResponse.json(result, { status: result.created ? 201 : 200 });
  }),
];
