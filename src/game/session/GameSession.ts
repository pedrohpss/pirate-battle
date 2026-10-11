import { Application } from 'pixi.js';
import type { Ticker } from 'pixi.js';
import { soundSettings } from '../../settings/sound';
import { SoundPlayer } from '../audio/SoundPlayer';
import type { GameConfig } from '../config';
import { KeyboardInput } from '../input/KeyboardInput';
import { mergeInputs } from '../input/TouchInput';
import type { TouchInput } from '../input/TouchInput';
import { loadGameTextures } from '../render/assets';
import { GameRenderer } from '../render/GameRenderer';
import { GameSimulation } from '../simulation/GameSimulation';
import { createSeededRandom } from '../simulation/math';
import { readTestOptions } from '../testing/testMode';
import type { PirateTestApi, TestState } from '../testing/testMode';
import type { MatchStatus, MatchStore } from './MatchStore';

/**
 * Upper limit for a single frame step, in seconds.
 * Prevents huge jumps when the browser stalls or the tab was hidden.
 */
const MAX_FRAME_TIME = 0.1;

/** Fixed step used by test mode (60 steps per second of game time). */
const TEST_STEP = 1 / 60;

/** Keys that pause the game. */
const PAUSE_KEYS = new Set(['Escape', 'KeyP']);

/** Key that turns the sound on and off. */
const MUTE_KEY = 'KeyM';

/** A warning sound plays when this many seconds are left. */
const TIME_WARNING_AT = 10;

/** A warning sound plays when the player's health drops below this fraction (30%). */
const LOW_HEALTH_AT = 0.3;

/**
 * Owns everything that lives during one match: the PixiJS application,
 * the simulation, the renderer, the keyboard and the browser listeners.
 *
 * It has no React code. GameCanvas creates it when mounted and calls
 * destroy() when unmounted, which releases every resource.
 */
export class GameSession {
  private readonly container: HTMLElement;
  private readonly config: GameConfig;
  private readonly store: MatchStore;
  /** On-screen buttons (mobile). Owned by the React screen, read here. */
  private readonly touch: TouchInput;
  private readonly app = new Application();
  private readonly keyboard = new KeyboardInput();
  private simulation: GameSimulation | null = null;
  private renderer: GameRenderer | null = null;
  /** Sound effects (not used in test and profiling modes). */
  private sound: SoundPlayer | null = null;
  /** Last status seen, to play a sound only when it changes. */
  private lastStatus: MatchStatus = 'loading';
  /** Last whole second shown, to play the time warning once. */
  private lastTimeLeft = Infinity;
  /** True once the low-health warning has played (health never goes back up). */
  private lowHealthWarned = false;
  private unsubscribeFromStore: (() => void) | null = null;
  /** Test mode (?test=1): the clock is advanced by the tests, not by real time. */
  private readonly testOptions = readTestOptions();
  private testApi: PirateTestApi | null = null;

  // Make start/destroy safe in any order (React Strict Mode mounts twice).
  private initialized = false;
  private destroyed = false;

  constructor(container: HTMLElement, config: GameConfig, store: MatchStore, touch: TouchInput) {
    this.container = container;
    this.config = config;
    this.store = store;
    this.touch = touch;
  }

  /** Creates the canvas, loads the assets and starts the game loop. */
  async start(): Promise<void> {
    await this.app.init({
      resizeTo: this.container,
      background: '#0e3550', // color around the arena when proportions differ
      antialias: true,
      resolution: window.devicePixelRatio,
      autoDensity: true,
    });
    this.initialized = true;
    if (this.destroyed) {
      this.app.destroy(true, { children: true });
      return;
    }
    this.container.appendChild(this.app.canvas);

    // Sounds load in parallel with the textures; the match never waits for them.
    // Tests and profiling run silent, so they stay fast and repeatable.
    if (!this.testOptions.enabled && !this.testOptions.perf) {
      this.sound = new SoundPlayer();
      void this.sound.load();
    }

    try {
      const textures = await loadGameTextures((progress) =>
        // Rounded to whole percents so React updates at most 100 times.
        this.store.update({ loadingProgress: Math.round(progress * 100) / 100 }),
      );
      if (this.destroyed) return;

      this.simulation = this.createSimulation();
      this.renderer = new GameRenderer(this.app, textures, this.simulation);
    } catch (error) {
      if (this.destroyed) return;
      // Handled: the player sees a message and can try again.
      console.warn('Failed to load game assets', error);
      this.store.update({
        status: 'error',
        errorMessage: 'Could not load the game assets. Check your connection and try again.',
      });
      return;
    }

    this.keyboard.attach();
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('blur', this.onFocusLost);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.unsubscribeFromStore = this.store.subscribe(this.onStatusChange);

    this.publishSnapshot();
    this.store.update({ status: 'running' });
    // The player may have switched tabs or apps while the assets were loading:
    // the listeners above did not exist yet, so check once now.
    if (document.hidden) this.store.pause();

    if (this.testOptions.enabled) {
      this.exposeTestApi();
      this.step(0); // draw the first frame
    } else {
      if (this.testOptions.perf) this.exposeTestApi();
      this.app.ticker.add(this.tick);
    }
  }

  /** Releases listeners, ticker, sprites and canvas. Safe to call at any time. */
  destroy(): void {
    this.destroyed = true;
    this.keyboard.detach();
    this.touch.releaseAll();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('blur', this.onFocusLost);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.unsubscribeFromStore?.();
    this.sound?.destroy();
    if (this.testApi && window.__PIRATE_TEST__ === this.testApi) delete window.__PIRATE_TEST__;
    if (this.initialized) this.app.destroy(true, { children: true });
  }

  /** The game loop: runs once per frame with the real elapsed time. */
  private readonly tick = (ticker: Ticker): void => {
    this.step(Math.min(ticker.deltaMS / 1000, MAX_FRAME_TIME));
  };

  /** One frame of the game: input -> rules -> drawing -> interface. */
  private step(dt: number): void {
    const simulation = this.simulation;
    const renderer = this.renderer;
    if (!simulation || !renderer) return;

    const { status } = this.store.getSnapshot();

    // Rules only advance while running: a paused match keeps its timer,
    // cooldowns and positions exactly as they were.
    if (status === 'running') {
      // Keyboard and touch buttons can be used together.
      simulation.update(dt, mergeInputs(this.keyboard.getState(), this.touch.getState()));
    }

    // Effects freeze while paused, but keep playing after the match ends
    // (so the final explosion finishes). The same events also drive the sounds.
    const events = simulation.drainEvents();
    renderer.render(status === 'paused' ? 0 : dt, events);
    this.sound?.handleEvents(events);
    this.publishSnapshot();
  }

  /**
   * Normal play uses Math.random. Test mode uses a seed and can turn enemies off.
   * Profiling mode uses a seed and a ship that cannot sink, so the match runs
   * its full duration with the maximum number of enemies.
   */
  private createSimulation(): GameSimulation {
    const { enabled, perf, seed, noEnemies } = this.testOptions;
    if (perf) {
      const config = { ...this.config, player: { ...this.config.player, maxHealth: 1e9 } };
      return new GameSimulation(config, createSeededRandom(seed));
    }
    if (!enabled) return new GameSimulation(this.config);

    const config = noEnemies
      ? { ...this.config, spawn: { ...this.config.spawn, firstSpawnDelay: Infinity } }
      : this.config;
    return new GameSimulation(config, createSeededRandom(seed));
  }

  /** Lets tests advance the clock and observe the state (test mode only). */
  private exposeTestApi(): void {
    this.testApi = {
      advance: (seconds) => {
        if (!this.testOptions.enabled) throw new Error('advance() needs ?test=1 (manual clock).');
        const steps = Math.round(seconds / TEST_STEP);
        for (let i = 0; i < steps; i++) this.step(TEST_STEP);
      },
      getState: () => this.readTestState(),
    };
    window.__PIRATE_TEST__ = this.testApi;
  }

  private readTestState(): TestState {
    const simulation = this.simulation;
    if (!simulation) throw new Error('The match has not started.');
    const { player } = simulation;
    return {
      status: this.store.getSnapshot().status,
      score: simulation.score,
      elapsed: simulation.elapsed,
      timeLeft: simulation.timeLeft,
      endReason: simulation.endReason,
      player: {
        x: player.position.x,
        y: player.position.y,
        angle: player.angle,
        health: player.health,
        maxHealth: player.maxHealth,
        radius: player.radius,
      },
      enemies: simulation.enemies.map((enemy) => ({
        id: enemy.id,
        kind: enemy.kind,
        x: enemy.position.x,
        y: enemy.position.y,
        health: enemy.health,
        radius: enemy.radius,
      })),
      projectiles: simulation.projectiles.map((projectile) => ({
        team: projectile.team,
        x: projectile.position.x,
        y: projectile.position.y,
      })),
      playerProjectilesFired: simulation.playerProjectilesFired,
      enemiesSpawned: simulation.enemiesSpawned,
      obstacles: simulation.obstacles.map((rect) => ({ ...rect })),
    };
  }

  /** Sends the values the interface needs to the store. */
  private publishSnapshot(): void {
    const simulation = this.simulation;
    if (!simulation) return;

    const timeLeft = Math.ceil(simulation.timeLeft);
    this.store.update({
      score: simulation.score,
      health: simulation.player.health,
      maxHealth: simulation.player.maxHealth,
      timeLeft,
    });

    // Time warning: once, when the clock reaches the last seconds.
    if (timeLeft <= TIME_WARNING_AT && this.lastTimeLeft > TIME_WARNING_AT && !simulation.isOver) {
      this.sound?.play('timeWarning', 0.6);
    }
    this.lastTimeLeft = timeLeft;

    // Low health warning: once, when health first drops below 30% (not when the ship sinks).
    const { health, maxHealth } = simulation.player;
    if (!this.lowHealthWarned && health > 0 && health < maxHealth * LOW_HEALTH_AT) {
      this.lowHealthWarned = true;
      this.sound?.play('healthLow', 0.7);
    }

    if (simulation.isOver && this.store.getSnapshot().status !== 'ended') {
      this.store.update({
        status: 'ended',
        endReason: simulation.endReason,
        timePlayed: simulation.elapsed,
      });
    }
  }

  /** Game keys and touch buttons only act while the match is running. */
  private readonly onStatusChange = (): void => {
    const { status, endReason } = this.store.getSnapshot();
    const running = status === 'running';
    this.keyboard.setEnabled(running);
    this.touch.setEnabled(running);

    // The store also notifies for score and time: only real status changes make a sound.
    if (status !== this.lastStatus) {
      this.sound?.statusChanged(this.lastStatus, status, endReason);
      this.lastStatus = status;
    }
  };

  /** Manual pause with Esc or P; M turns the sound on and off. */
  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === MUTE_KEY && !event.repeat) {
      soundSettings.toggle();
      return;
    }
    if (!PAUSE_KEYS.has(event.code)) return;
    if (this.store.getSnapshot().status !== 'running') return;
    event.preventDefault();
    this.store.pause();
  };

  /** Automatic pause when the window loses focus... */
  private readonly onFocusLost = (): void => {
    this.store.pause();
  };

  /** ...or when the tab is hidden. */
  private readonly onVisibilityChange = (): void => {
    if (document.hidden) this.store.pause();
  };
}
