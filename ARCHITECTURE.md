# Architecture

This document explains how Pirate Battle is organized and why. The short version: **the game runs in PixiJS outside React, the rules never touch rendering, and React only hears about the few values it displays.**

## Contents

1. [Overview](#1-overview)
2. [React and PixiJS integration](#2-react-and-pixijs-integration)
3. [Simulation loop](#3-simulation-loop)
4. [Collisions](#4-collisions)
5. [Weapons, damage and scoring](#5-weapons-damage-and-scoring)
6. [Enemies and spawning](#6-enemies-and-spawning)
7. [Pause and match end](#7-pause-and-match-end)
8. [Rendering and resource management](#8-rendering-and-resource-management)
9. [Local persistence](#9-local-persistence)
10. [Ranking and match history](#10-ranking-and-match-history)
11. [Mock API (MSW)](#11-mock-api-msw)
12. [Accessibility](#12-accessibility)
13. [Balancing decisions](#13-balancing-decisions)
14. [Limitations and trade-offs](#limitations-and-trade-offs)

---

## 1. Overview

```
Keyboard ──► KeyboardInput ──► PlayerInput ──► GameSimulation ──► GameRenderer ──► canvas
                (input)          (plain data)       (rules)         (PixiJS)
                                                       │
                                                       ▼
                                                  MatchStore ──► React (HUD, dialogs)
                                       (score, health, time, status; notifies on change only)
```

| Layer | Folder | Knows about | Never touches |
| --- | --- | --- | --- |
| Input | `src/game/input` | DOM keyboard events | Ships, PixiJS |
| Simulation | `src/game/simulation` | Rules, numbers, config | PixiJS, React, DOM |
| Rendering | `src/game/render` | PixiJS, simulation state (read-only) | Game rules |
| Session | `src/game/session` | Lifecycle of one match | Specific rules or sprites |
| Interface | `src/ui` | React, the `MatchStore` snapshot | The game loop |
| Data | `src/api`, `src/mocks` | REST contracts, cache | The game |

Because the simulation imports nothing from PixiJS or the DOM, it can run headless. During development it was run in Node with a seeded random generator to verify spawning distances, collisions, end conditions and determinism, and to balance the game.

## 2. React and PixiJS integration

- `GameCanvas` (React) renders a single `<div>` and, in an effect, creates a `GameSession` inside it. The effect cleanup calls `session.destroy()`.
- `GameSession` (plain class) owns the PixiJS `Application`, the simulation, the renderer, the keyboard and every browser listener.
- **React Strict Mode** mounts, unmounts and mounts again in development. `app.init()` is asynchronous, so the session keeps two flags: `initialized` (init finished) and `destroyed` (cleanup ran). If cleanup runs before init finishes, the half-created app is destroyed as soon as init resolves, and no duplicate canvas or listener survives.
- **React never renders per frame.** The loop writes to a `MatchStore`, which compares the new values with the current snapshot and notifies listeners only if something changed. React reads it with `useSyncExternalStore`. Time is published in whole seconds, so the HUD clock re-renders once per second, not 60 times.
- **Restart** gives the game screen a new React `key`. React unmounts the old screen (destroying its session) and mounts a fresh one, which guarantees health, score, timer and entities start clean. Textures are cached by `Assets`, so restarting is instant.

## 3. Simulation loop

One frame (`GameSession.tick`):

```ts
const dt = Math.min(ticker.deltaMS / 1000, MAX_FRAME_TIME); // seconds, capped at 0.1
if (status === 'running') simulation.update(dt, keyboard.getState());
renderer.render(status === 'paused' ? 0 : dt, simulation.drainEvents());
publishSnapshot(); // to the MatchStore
```

- **Time-based:** every speed, cooldown, timer and spawn interval is expressed per second and multiplied by `dt`, so the game behaves the same at 60 Hz or 144 Hz.
- **`dt` cap (0.1 s):** after a stall or a hidden tab, the first frame cannot make ships jump or tunnel through an island. With the cap, a ship moves at most 18 u per step (less than its radius, so it cannot cross a coast in one step) and the fastest projectile at most 48 u (less than a ship's diameter, so it cannot skip over a ship).
- **Order inside `update`:** player movement → player weapons → spawning → enemy AI, movement, separation, collisions and attacks → projectiles → removal of destroyed enemies → end-of-match check.
- **Exact end:** the step is clamped to the time left (`Math.min(dt, timeLeft)`), so a match always ends exactly at its configured duration.
- **Events:** the simulation records what happened (`shotFired`, `projectileImpact`, `shipDestroyed`) in a list. The session drains it each frame and hands it to the renderer. Draining guarantees each event produces its effect once, even while paused. Sound can be added later by reading the same events.

## 4. Collisions

- **Shapes:** ships and projectiles are circles; islands are axis-aligned rectangles. Circles are cheap and rotation-independent.
- **Island colliders** are the island's tiles shrunk by `islandColliderInset` (10 u) on each side, because the sand tiles have rounded, transparent edges.
- **Ship vs island** (`pushCircleOutOfRect`): find the closest point of the rectangle to the circle center; if it is closer than the radius, push the ship away from that point by the overlap. Pushing along that direction makes ships slide along the coast instead of sticking. If the center is inside the rectangle, the ship is pushed out through the nearest side.
- **Arena limits:** positions are clamped so the whole hitbox stays inside the arena.
- **Ship vs ship:** enemies that overlap are pushed apart by half the overlap each, so a group of Chasers does not collapse into one point.
- **Projectile vs island / ship:** circle-rectangle and circle-circle overlap tests. Projectiles only hit the opposite team.
- Distances are compared squared where possible (`dx² + dy² < r²`) to avoid square roots.

## 5. Weapons, damage and scoring

- **Weapons** are data (`WeaponConfig`: cooldown, projectile count, spacing, muzzle offset, speed, range, damage). The same type describes the bow cannon, the broadsides and the Shooter's cannon.
- **Volleys** (`createVolley`): the shot direction is the ship angle plus 0 (bow), −90° (left) or +90° (right). Parallel projectiles are spread along the perpendicular vector, `(i − (count − 1) / 2) × spacing`, all with the same velocity.
- **Cooldowns:** each player slot (bow, left, right) has its own timer, decremented by `dt`. Holding a key fires again as soon as the timer reaches zero.
- **Lifetime:** range is converted to time (`range / speed`). A projectile is removed exactly once when it hits an island, hits a ship, expires (splash effect) or leaves the arena.
- **Damage once:** a projectile is removed in the same step it hits, so it can never damage twice.
- **Score:** `damageEnemyByPlayer` ignores enemies that are already destroyed, and adds 1 point only at the moment a player projectile brings health to zero. A Chaser that rams the player is destroyed through a different path that never scores.
- **Destroyed enemies** are filtered out of every loop and removed at the end of the step, so they no longer move, shoot, damage or collide.

## 6. Enemies and spawning

**AI** (`enemyAI.ts`) only decides; the simulation applies movement, collisions and firing.

- Each enemy computes the angle to the player (`atan2`) and turns toward it, limited by its turn speed (`turnTowards`, using the shortest signed angle difference).
- **Chaser:** always sails forward, so it curves into the player. On contact it deals `contactDamage` and explodes.
- **Shooter:** sails forward only while farther than `preferredDistance`. It fires its bow cannon when the player is within `attackRange` and its aim error is below `aimTolerance` (≈ 11°), respecting its own cooldown. Newly spawned Shooters start with a full cooldown.

**Spawning** (`spawning.ts`):

- Every `spawn.interval` seconds (first after `firstSpawnDelay`), unless `maxAlive` enemies are already alive.
- **Both types every match:** the first spawn is always a Chaser and the second a Shooter; after that the type is drawn with `chaserChance`.
- **Safe points:** a random point is accepted only if it is at least `minDistanceFromPlayer` (450 u) from the player, clear of islands and clear of other ships (with `clearance`). After `maxAttempts` failures the spawn is skipped until the next interval instead of placing an enemy somewhere unfair.
- **Seeded randomness:** `GameSimulation` accepts a random function. The game uses `Math.random`; tests can pass `createSeededRandom(seed)`, which makes a whole match reproducible.

## 7. Pause and match end

- **Status** lives in the `MatchStore`: `loading → running ⇄ paused`, `running → ended`, `loading → error`.
- **Manual pause:** `Esc`, `P` or the HUD button. **Automatic pause:** `window` `blur` and `document` `visibilitychange` (hidden).
- **Nothing accumulates while paused:** the simulation is not updated (timer, cooldowns, entities frozen); the renderer receives `dt = 0`; the keyboard is disabled and its pressed keys cleared; and the `dt` cap absorbs the first frame after resuming.
- **Resuming needs the player:** returning to the tab does not resume; only the Resume button or `Esc` in the dialog does.
- **Touch controls:** `TouchInput` holds which on-screen buttons are pressed and produces the same `PlayerInput` as the keyboard; the session merges both (`mergeInputs`), so the simulation does not know where input came from. Buttons use pointer events with pointer capture (several fingers at once, release even if the finger slides off) and `touch-action: none`. They are shown on coarse pointers (or with `?touch=1`). Pausing disables and clears them like the keyboard.
- **Orientation:** landscape is the supported orientation on phones. In portrait the match pauses and an overlay asks the player to rotate; the arena only rescales, rules never change.
- **Game keys are captured only while running.** `KeyboardInput.setEnabled` follows the store status, so menus and dialogs keep normal keyboard behavior. `setEnabled` is idempotent (it acts only on a real change); an earlier version cleared held keys every time the store notified, which stopped the ship once per second.
- **End:** death (health 0) or time (elapsed = duration). After that, `update()` returns immediately, which stops movement, attacks, damage, spawns and scoring. Death wins if both happen in the same step.

## 8. Rendering and resource management

- **World container:** everything in the arena lives in one `Container` sized in world units (1600 × 900). `fitToScreen` scales it with the smaller of the two ratios and centers it, so the arena is never distorted or cut, and game rules never depend on screen size. The canvas uses `resizeTo`, `resolution: devicePixelRatio` and `autoDensity` for sharp rendering on high-density screens.
- **Layers (bottom to top):** water → islands → sinking wrecks → projectiles → ships → explosions → health bars.
- **Entity sync:** the renderer keeps `Map<id, view>` for enemies and projectiles. Each frame it creates views for new ids, updates existing ones and destroys views whose id disappeared, so sprites never leak.
- **Ship deterioration:** the asset pack has four images per ship colour (intact, damaged, badly damaged, wrecked). `getDamageStage` picks one from the health ratio.
- **Health bars** follow the asset metadata in `ui_sheet.json`: frame first, fill on top, clipped from the left with a mask whose width is the health ratio. The mask is redrawn only when the ratio changes.
- **Effects** (muzzle flash, impacts, water splash, explosion, sinking wreck) grow and fade with linear interpolation and destroy their sprite when finished.
- **Texture loading:** all textures are loaded in parallel through `Assets` (cached, reused across matches), with a progress callback shown as a percentage. If any file fails, loading rejects and the match never starts; the player sees an accessible error with **Try Again**.
- **Teardown:** `GameSession.destroy()` detaches the keyboard and every listener, unsubscribes from the store and destroys the PixiJS application with all children (ticker, canvas, sprites).

## 9. Local persistence

All `localStorage` access goes through `readStorage` / `writeStorage`: wrapped in `try/catch` (storage can be blocked or full), and every read is validated by a parser that returns `null` for unusable data, falling back to defaults. Keys are prefixed (`pirate-battle:`) and versioned (`options:v1`, `last-result:v2`).

| Key | Content |
| --- | --- |
| `options:v1` | Game session time and enemy spawn time (validated with the same function as the form) |
| `last-result:v2` | Last finished match: id, score, time played, end reason, date, options |
| `player:v1` | Player id (UUID) and display name, created once (there is no login) |
| `pending-matches:v1` | Finished matches not yet confirmed by the server |
| `mock-db:v1`, `mock-scenario`, `mock-seed` | Mock server data and network scenario |

Abandoned matches (Main Menu during a match, refresh, closing the tab) never produce a result: a result exists only when the match status becomes `ended`.

## 10. Ranking and match history

### Contracts

Defined once in `src/api/contracts.ts` and shared by the client and the mock server.

| Method | Path | Response |
| --- | --- | --- |
| `GET` | `/api/ranking?matchDuration&spawnInterval&page&pageSize` | `Page<RankingEntry>` |
| `GET` | `/api/players/:playerId/matches?page&pageSize` | `Page<MatchRecord>` (newest first) |
| `POST` | `/api/matches` (body: `MatchRecord`) | `RegisterMatchResponse`; `201` created, `200` already existed |

A `MatchRecord` holds the match id, player id and name, end date, score, effective duration, end reason and the settings used. `parseMatchRecord` validates unknown data on both sides.

### Ranking rules

- Only matches with **the same settings** (duration and spawn interval) are compared; the ranking shown is the one for the current options.
- Deterministic order: higher score → shorter duration → earlier end date → match id.

### Client

- **Axios** (`client.ts`): one instance, `baseURL: '/api'`, 5 s timeout. Errors are classified as `timeout`, `network`, `server` (5xx), `client` (4xx) or `cancelled`.
- **TanStack Query** (`queries.ts`):
  - Keys include every parameter: `['ranking', duration, interval, page]`, `['history', playerId, page]`. A late answer can only fill its own key, never the page on screen. For the same key, the previous request is cancelled through the `AbortSignal` passed to Axios.
  - `placeholderData: keepPreviousData` keeps the current page visible while the next loads; "Next" is disabled meanwhile.
  - `refetchOnMount: 'always'` plus tabs that mount only the visible panel: data refreshes every time a tab is shown.
  - Up to 2 retries (1 s, then 2 s) **only** for timeouts, connection failures and 5xx; 4xx is not retried.
  - `QueryView` renders the four states consistently: loading (with attempt number), error with retry, empty, and data. A failed background refresh keeps the previous data with a warning.

### Registering a finished match without duplicates or losses

1. When a match ends, the App creates a `matchId` (UUID) **once**. It is the idempotency key for every attempt.
2. The record is added to the `SubmissionQueue` **before** any request; unconfirmed records are stored in `localStorage`.
3. `useMutation` sends it. The queue entry becomes `saving` synchronously, so double clicks or repeated calls are ignored.
4. **Success:** the entry becomes `saved`, leaves storage, and both `['ranking']` and `['history']` are invalidated, so the two tabs refresh.
5. **Failure** (after retries): the entry becomes `failed` with a message. It stays stored; the result dialog shows **Retry saving** and the main menu shows a banner with **Retry now**.
6. **On start**, every unconfirmed record is sent again automatically.
7. **Server side**, inserting an existing `matchId` writes nothing and returns the stored record with `200`. So a request that was stored but whose answer was lost (timeout) is recovered by the retry without creating a second entry.

The mutation lives in `App`, which is always mounted, so a request completes even if the player leaves the result screen, and the player can start another match while a submission is pending.

## 11. Mock API (MSW)

- `src/mocks/handlers.ts` implements the three endpoints on top of `db.ts` (fixtures + matches stored in `localStorage`, so confirmed records survive a refresh and both tabs read the same data).
- The worker starts in `main.tsx` before React renders, in development **and** in the production build (`public/mockServiceWorker.js` is deployed with the site). Requests outside `/api` pass through untouched (`onUnhandledFrame: 'bypass'`, `quiet: true`). If the worker cannot start, the game still opens; only the tabs show errors.
- **Scenarios** (`scenarios.ts`) control latency and failures per endpoint: success, empty, many pages, slow, seeded variable latency, out-of-order, timeout, connection failure, 500, 400, ranking-only failure, history-only failure, timeout after storing a match, and 503 on registration. They are selected in the menu panel or with `?scenario=` / `&seed=`, and **Reset demo data** restores the initial state.

## 12. Accessibility

- Menus are fully keyboard-operable with a visible focus ring (`:focus-visible`).
- Pause and result use the native `<dialog>` with `showModal()`: focus moves inside, Tab is trapped, the page behind becomes inert, and the dialog is announced. The main action is focused on open.
- Tabs follow the WAI-ARIA tabs pattern (roles, `aria-selected`, arrow keys, Home/End, roving `tabIndex`).
- The Options form uses labels, hints and errors linked with `aria-describedby`, `aria-invalid`, and moves focus to the first invalid field.
- The HUD is semantic HTML (readable by screen readers); the canvas is `aria-hidden`. Status changes (paused, match over, saving) are announced through `role="status"` regions that change only when the status changes, never per frame. Errors use `role="alert"`.
- Text contrast: dark text on gold buttons, light text on dark panels.

## 13. Balancing decisions

A headless bot that always aims at the nearest enemy was run on several seeds. With the first values (player health 100, spawn every 3 s, Shooter damage 15, Chaser damage 25) it survived about 20 s, far too short for 60–180 s matches. After tuning:

| Value | Before | After |
| --- | --- | --- |
| Player health | 100 | 150 |
| Spawn interval | 3 s | 4 s |
| Shooter damage / cooldown | 15 / 1.8 s | 10 / 2 s |
| Chaser contact damage / speed | 25 / 140 | 20 / 130 |

The same bot then survived 48–105 s (scores 5–15). A human who dodges and uses islands as cover lasts longer. Both Options values change difficulty without touching code.

## Limitations and trade-offs

- **Circular hitboxes:** ships are long (66 × 113 px) but collide as circles (radius 30). Simple and rotation-independent; the bow can overlap sand slightly.
- **No path-finding:** enemies steer straight at the player and slide along coasts; they can be stuck behind an island for a while, which also lets islands act as cover.
- **No line-of-sight check** for the Shooter.
- **No sprite pooling:** projectile and effect sprites are created and destroyed. Counts stay low (at most 10 enemies), so this was not a bottleneck.
- **Navigation** uses component state instead of a router (three screens, no URLs required). A router such as TanStack Router would map them to `/`, `/options` and `/play`.
