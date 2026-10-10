# Pirate Battle

A top-down 2D naval shooter built with **React**, **TypeScript (strict)** and **PixiJS**, with a ranking and match history served by a mocked REST API (**MSW**) and consumed with **Axios** and **TanStack Query**.

**Live demo:** https://pirate-battle-black.vercel.app/

Sail between islands, sink enemy ships and score as many points as you can before the timer runs out.

---

## Contents

- [Setup](#setup)
- [Commands](#commands)
- [Controls](#controls)
- [Gameplay configuration](#gameplay-configuration)
- [Network scenarios (mock API)](#network-scenarios-mock-api)
- [Environment variables](#environment-variables)
- [Project structure](#project-structure)
- [Known limitations](#known-limitations)
- [Assets and licenses](#assets-and-licenses)

Architecture and design decisions are described in [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Setup

Requirements: **Node.js 20 or newer** and npm.

```bash
git clone https://github.com/pedrohpss/pirate-battle.git
cd pirate-battle
npm install
npm run dev
```

Open the address printed by Vite (usually http://localhost:5173).

No backend or private service is needed: the ranking and history API is mocked in the browser by MSW, both in development and in the published build.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Type-checks (`tsc -b`) and builds the optimized bundle into `dist/` |
| `npm run preview` | Serves the production build locally |
| `npm run lint` | Lints the source code |
| `npm run typecheck` | Type-checks only, without building |
| `npm run test:e2e` | Runs the Playwright tests (desktop and mobile Chromium) |
| `npm run test:e2e:update` | Re-creates the visual regression baselines |
| `npm run test:e2e:report` | Opens the last HTML test report |
| `npm run perf` | Profiles a 3-minute match and 5 play/leave cycles (see [PERFORMANCE.md](./PERFORMANCE.md)) |

## End-to-end tests (Playwright)

First time only: `npx playwright install chromium`.

`npm run test:e2e` builds the game in **test mode** (`vite build --mode test`, which reads `.env.test`: API timeout 4 s, shorter than the default so timeout scenarios run faster, but longer than the slowest normal answer of 3 s), serves it with `vite preview` on port 4173 and runs every spec in `tests/`:

| Spec | Covers |
| --- | --- |
| `options.spec.ts` | Navigation, validation and persistence of options |
| `assets.spec.ts` | Loading progress, asset failure and retry |
| `movement.spec.ts` | Start state, movement, rotation, arena limits, island collision |
| `combat.spec.ts` | Bow and broadside shots, cooldowns, projectile removal, scoring without duplication, Chaser ram, Shooter behaviour, spawn interval and both enemy types |
| `match-flow.spec.ts` | End by time and by death, frozen simulation, clean restart, pause, focus loss, no input accumulation, result persistence, abandoned matches, repeated navigation |
| `leaderboards.spec.ts` | Ranking pagination, loading, empty and error states, keyboard tabs, registration, pending save after refresh, retry after timeout without duplicates, out-of-order answers |
| `touch.spec.ts` | Touch buttons (several at once) and pause on a phone |
| `visual.spec.ts` | Screenshots of the menu, the arena and the result screen |

Projects: **desktop** (Chromium 1280 × 800, all specs) and **mobile** (Pixel 5 landscape, touch, options and visual specs).

**How the tests control the game.** With `?test=1` the game runs in test mode: randomness is seeded (`&seed=N`), enemies can be turned off (`&noEnemies=1`), and the simulation does not advance by itself. Tests advance the clock with `window.__PIRATE_TEST__.advance(seconds)`, which runs the real game loop in fixed 1/60 s steps, and read a copy of the state with `getState()`. Movement and attacks are always driven by real keyboard or pointer events.

Every test runs in a fresh browser context (empty storage) and fails if the page logs an unhandled error. Reports go to `playwright-report/` (HTML, with traces of failed tests); visual baselines are in `tests/visual.spec.ts-snapshots/`.

## Controls

Keyboard (game keys are only captured while a match is running):

| Key | Action |
| --- | --- |
| `W` / `↑` | Sail forward |
| `A` / `←` | Turn left |
| `D` / `→` | Turn right |
| `Space` | Bow cannon (1 shot) |
| `Q` | Left broadside (3 parallel shots) |
| `E` | Right broadside (3 parallel shots) |
| `Esc` / `P` | Pause |

Moving and firing can be combined freely. The game also pauses automatically when the window loses focus or the tab is hidden; resuming always requires the player (Resume button or `Esc`).

**Touch screens** show on-screen controls during a match:
- **Movement pad (left thumb):** the top row sails forward, the left and right columns turn. Touch an upper corner to sail and turn with one thumb, and slide between zones without lifting it.
- **Cannons (right thumb):** left broadside, bow cannon and right broadside, held while the finger is down.

Several fingers work at once, so you can move and fire together. Dragging on the screen does not select text or open the browser's copy menu. Pause with the round button at the top. Add `?touch=1` to the URL to show the touch buttons on a desktop.

**Supported orientation on mobile: landscape.** The arena is 16:9, so in portrait it would be too small to play. The main menu tells phone players held upright to turn the device; in portrait the match pauses and asks you to rotate. The rules of the match never change with the screen size.

## Gameplay configuration

All gameplay values live in one typed object, `DEFAULT_GAME_CONFIG` in [`src/game/config.ts`](./src/game/config.ts). Balancing the game only means changing numbers there; no system logic has to change.

| Group | Values |
| --- | --- |
| Match | duration (90 s by default) |
| Arena | size (1600 × 900 world units), tile size, islands (position and size in tiles) |
| Player | health 150, speed 180 u/s, turn speed 2.5 rad/s, collision radius |
| Bow cannon | cooldown 0.4 s, 1 projectile, speed 480 u/s, range 520 u, damage 25 |
| Broadsides | cooldown 1 s (left and right independent), 3 projectiles 24 u apart, speed 420 u/s, range 380 u, damage 20 |
| Spawning | every 4 s, first after 1 s, 50% Chaser / 50% Shooter, max 10 alive, at least 450 u from the player |
| Chaser | health 40, speed 130 u/s, contact damage 20 |
| Shooter | health 60, speed 100 u/s, stops at 260 u, fires within 380 u, cooldown 2 s, damage 10 |

The **Options** screen exposes two of these values, validated and saved in `localStorage`:

| Option | Allowed values |
| --- | --- |
| Game session time | whole seconds from **60 to 180** |
| Enemy spawn time | **1 to 10** seconds (decimals allowed). Below 1 s the 10-enemy cap is reached almost at once; above 10 s matches become idle. |

Each match takes a snapshot (deep copy) of the configuration when it starts, so changing options never affects a match in progress.

## Network scenarios (mock API)

The mock API supports reproducible network conditions, so loading, empty and error states can be shown and tested.

**How to choose a scenario**

- In the main menu, open **Network simulation (demo)** and pick one; or
- add it to the URL: `?scenario=timeout` (optionally `&seed=7` for the random latency).

The choice is saved in `localStorage` and survives a refresh. **Reset demo data** restores the initial state: default scenario and seed, no registered matches, no pending submissions.

| Scenario (`?scenario=`) | Behavior |
| --- | --- |
| `success` | Everything works, ~300 ms per request (default) |
| `empty` | Ranking and history come back empty |
| `many-pages` | 45 extra ranking entries |
| `slow` | Every request takes 2.5 s |
| `variable-latency` | 0.1–3 s per request, from a seeded generator (same seed = same delays) |
| `out-of-order` | Odd requests take 2.5 s, even ones 150 ms, so answers arrive out of order |
| `timeout` | The server never answers |
| `network-error` | Connection failure |
| `server-error` | HTTP 500 on every endpoint |
| `bad-request` | HTTP 400 on every endpoint (not retried) |
| `ranking-error` | Only the ranking fails (500) |
| `history-error` | Only the history fails (500) |
| `register-timeout` | Saving a match is stored but never answered; the retry recovers it without duplicating |
| `register-unavailable` | Saving a match fails with 503; switch back to `success` and retry to recover |

**Reproducing the main failures**

1. *Timeout after saving:* select **Timeout after saving**, finish a match and wait for the "Not saved yet" message. Select **Success**, click **Retry saving**: the match appears exactly once in Match History.
2. *Server unavailable at the end of the match:* select **Saving unavailable (503)** and finish a match. Go to the main menu (the banner says a match is waiting), select **Success** and click **Retry now**.
3. *Pending submission after refresh:* repeat step 2, but press F5 before retrying. The pending match is sent again automatically on start.
4. *Out-of-order answers:* select **Out of order** and quickly page through the ranking. A late answer for an earlier page never replaces the page on screen.

## Environment variables

None are required. Optional:

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_TIMEOUT_MS` | `5000` | Timeout of each API request, in milliseconds |

## Project structure

```
src/
├── game/          Game: PixiJS rendering, simulation and input (no React inside the loop)
│   ├── simulation/  Rules: movement, collisions, weapons, enemies, spawning (no PixiJS)
│   ├── render/      PixiJS: arena, ships, projectiles, effects, health bars
│   ├── input/       Keyboard and touch → player intentions
│   └── session/     Game loop, pause, resource lifecycle, bridge to React
├── api/           REST client: contracts, Axios, TanStack Query, pending submissions
├── mocks/         MSW handlers, mock database, fixtures, network scenarios
├── settings/      Local persistence: options, last result, player identity
└── ui/            React screens: menu, options, HUD, dialogs, ranking, history
public/
├── assets/        Challenge assets (images, sounds)
└── mockServiceWorker.js   MSW service worker (needed in the published build)
```

## Known limitations

- Ships use circular hitboxes, so the bow can overlap the sand slightly at some angles.
- Enemies do not path-find around islands: they slide along the coast and can get stuck behind an island for a while.
- The Shooter does not check line of sight; its shots simply hit the island in between.

See [ARCHITECTURE.md](./ARCHITECTURE.md#limitations-and-trade-offs) for the reasoning behind these trade-offs.

## Assets and licenses

All images and sounds in `public/assets/` are the assets provided by the challenge ([junglegaming/game-developer-challenge](https://github.com/junglegaming/game-developer-challenge)). No external assets were added. Ship damage states, health bars, menu panels and buttons use these files directly; health bar measurements come from `assets/spritesheet/ui_sheet.json`.
