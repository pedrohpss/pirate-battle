# Performance

Measured on **10 October 2026** with `npm run perf` ([`perf/profile.spec.ts`](./perf/profile.spec.ts)). The raw numbers are in [`perf/results.json`](./perf/results.json) and [`perf/RESULTS.md`](./perf/RESULTS.md).

## Summary

- The game stayed at the display refresh rate (**~178 FPS**, frame interval p95 **5.6 ms**) during a 3-minute match with the enemy cap full most of the time.
- There were **10 frames over 33 ms out of 32,282** (0.03%). One of them took about 1 s; its cause was not identified (see [Analysis](#analysis)).
- After 5 play/leave cycles: **no canvas left behind**, and DOM nodes and event listeners did not change from cycle 1 to cycle 5. The JS heap grew by **0.63 MB** in total (about 0.12 MB per cycle). That is too small and too short a series to call it a leak or to rule one out (see [Memory](#memory)).

## How it was measured

| Item | Value |
| --- | --- |
| CPU | AMD Ryzen 7 5700X (8 cores, 16 threads) |
| Memory | 32 GB DDR4 |
| GPU | AMD Radeon RX 7600 (WebGL through ANGLE / Direct3D 11) |
| OS | Windows 10/11 64-bit |
| Browser | Chromium 156 (Playwright), **visible window** so the real GPU is used |
| Viewport | 1280 × 720, device pixel ratio 1 |
| Build | Optimized production build (`vite build`), served by `vite preview` |
| Game mode | `?perf=1&seed=1`: normal real-time loop, seeded randomness, unsinkable player ship |

**Match setup (worst case on purpose):**
- Session time 180 s; enemy spawn every 1 s, so the 10-enemy cap fills quickly.
- The ship sails and turns the whole time (`W` + `D` held) and keeps `Space`, `Q` and `E` held, so every cannon fires as soon as its cooldown allows.
- With these settings there are always enemies on screen, enemy shots, explosions and splashes.

**What is recorded:**
- **Frame interval:** the time between consecutive `requestAnimationFrame` callbacks, measured in the page for the whole match.
- **Entity count:** the number of enemies and projectiles alive, read from the game state once per second.
- **Memory:** five cycles of *Play → play 10 s → pause → Main Menu*. After each cycle, garbage collection is forced through the Chrome DevTools Protocol, then the script reads the JS heap, DOM nodes and JS event listeners, and counts the `<canvas>` elements left in the page.

## Results

### 3-minute match

| Metric | Value |
| --- | --- |
| Recorded time | 181.5 s |
| Frames | 32,282 |
| Average FPS | 177.8 |
| Frame interval: average / p50 / p95 / p99 | 5.62 / 5.6 / 5.6 / 5.7 ms |
| Frame interval: max | 1005.5 ms |
| Frames over 33 ms | 10 |
| Enemies alive (max / average) | 10 / 6.9 |
| Projectiles alive (max / average) | 13 / 6.6 |

### Memory after start / play / leave cycles

| Cycle | JS heap (MB) | DOM nodes | JS event listeners | Canvases |
| --- | --- | --- | --- | --- |
| Before (menu) | 8.26 | 271 | 209 | 0 |
| 1 | 8.41 | 338 | 224 | 0 |
| 2 | 8.52 | 338 | 224 | 0 |
| 3 | 8.64 | 338 | 224 | 0 |
| 4 | 8.80 | 338 | 224 | 0 |
| 5 | 8.89 | 338 | 224 | 0 |

## Analysis

### Frame rate

**The frame rate is limited by the display, not by the game.** Browsers run `requestAnimationFrame` once per screen refresh. An interval of 5.6 ms with almost no spread (p50 = p95 = 5.6 ms, p99 = 5.7 ms) means the browser drew every refresh of a display running at about 178–180 Hz.

A side effect is that the time the game spends per frame was not measured directly, only that it fits inside 5.6 ms. On a common 60 Hz screen each frame has 16.7 ms, so on this machine there is about three times more headroom than a 60 Hz screen needs.

**Rare long frames.** 10 of 32,282 frames took longer than 33 ms. One took about 1 s, which explains why the recording lasted 181.5 s for a 180 s match.

The script records only the length of each frame, not when it happened or what else was going on. So the cause is **not identified**. Likely candidates are the operating system or browser briefly holding back frames for the window, a major garbage collection, or a one-time GPU upload.

Even so, gameplay is protected from these stalls: the game loop caps each simulation step at 0.1 s, so after a stall ships and projectiles do not jump across the arena or pass through islands.

**Entity load.** The highest load was 10 enemies and 13 projectiles at once. Projectiles stay few because each weapon has a cooldown and every shot has a limited range. This is the real worst case allowed by the configuration, not a stress test with thousands of sprites.

### Memory

- **Canvases: 0 after every cycle.** When the player leaves, `GameSession.destroy()` removes the PixiJS application, its canvas and its WebGL context.
- **DOM nodes and event listeners** go up once between the first measurement and cycle 1, then stay **exactly the same** from cycle 1 to 5. The rise is a one-time step and was not traced to a specific element; it probably comes from menu content that was still loading or not yet shown at the first measurement, such as the ranking tab. The flat line from cycle 1 to 5 is what matters: keyboard, blur and visibility listeners and DOM elements are not added again with each match.
- **JS heap** grows by about 0.1–0.16 MB per cycle (8.26 → 8.89 MB) and **had not levelled off after 5 cycles**.
  - The growth is small, and these measurements alone cannot tell where it comes from. Candidates include caches that fill up on first use, such as the TanStack Query cache, the browser's compiled-code caches and PixiJS internal object pools, as well as data the app keeps on purpose.
  - Five cycles are too few to tell growth that will stop from a slow leak.
  - The next step would be to run more cycles, for example 20, and compare two heap snapshots in Chrome DevTools to see which objects are left behind.

## Limitations

- **One machine.** The machine is a fast desktop. Phones and low-end laptops were not profiled. The game is light (one tilemap, at most about 25 sprites in motion, and simple effects), but numbers on weaker devices are unknown.
- **Frame interval, not frame cost.** The script measures the time between frames. It does not measure the CPU or GPU time used by each frame, because the display refresh rate hides that.
- **Long frames lack context.** They are counted but not timestamped or linked to game events.
- **Short memory series.** Five cycles of 10 s each match the challenge requirement, but they are not enough to prove that memory stops growing.
- **One run, one seed.** There was no repetition to measure run-to-run variance.

## How to reproduce

```bash
npm run perf
```

The command builds the production bundle, starts `vite preview` on port 4174 and opens a visible Chromium window. **Do not touch the computer for about 5 minutes**: if the window loses focus, the game pauses. Results are written to `perf/results.json` and `perf/RESULTS.md`.