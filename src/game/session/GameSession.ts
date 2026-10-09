import { Application } from 'pixi.js';
import type { Ticker } from 'pixi.js';
import type { GameConfig } from '../config';
import { KeyboardInput } from '../input/KeyboardInput';
import { loadGameTextures } from '../render/assets';
import { GameRenderer } from '../render/GameRenderer';
import { GameSimulation } from '../simulation/GameSimulation';
import type { MatchStore } from './MatchStore';

/**
 * Upper limit for a single frame step, in seconds.
 * Prevents huge jumps when the browser stalls or the tab was hidden.
 */
const MAX_FRAME_TIME = 0.1;

/** Keys that pause the game. */
const PAUSE_KEYS = new Set(['Escape', 'KeyP']);

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
  private readonly app = new Application();
  private readonly keyboard = new KeyboardInput();
  private simulation: GameSimulation | null = null;
  private renderer: GameRenderer | null = null;
  private unsubscribeFromStore: (() => void) | null = null;

  // Make start/destroy safe in any order (React Strict Mode mounts twice).
  private initialized = false;
  private destroyed = false;

  constructor(container: HTMLElement, config: GameConfig, store: MatchStore) {
    this.container = container;
    this.config = config;
    this.store = store;
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

    try {
      const textures = await loadGameTextures((progress) =>
        // Rounded to whole percents so React updates at most 100 times.
        this.store.update({ loadingProgress: Math.round(progress * 100) / 100 }),
      );
      if (this.destroyed) return;

      this.simulation = new GameSimulation(this.config);
      this.renderer = new GameRenderer(this.app, textures, this.simulation);
    } catch (error) {
      if (this.destroyed) return;
      console.error('Failed to load game assets', error);
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
    this.app.ticker.add(this.tick);
  }

  /** Releases listeners, ticker, sprites and canvas. Safe to call at any time. */
  destroy(): void {
    this.destroyed = true;
    this.keyboard.detach();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('blur', this.onFocusLost);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.unsubscribeFromStore?.();
    if (this.initialized) this.app.destroy(true, { children: true });
  }

  /** The game loop: runs once per frame. */
  private readonly tick = (ticker: Ticker): void => {
    const simulation = this.simulation;
    const renderer = this.renderer;
    if (!simulation || !renderer) return;

    const dt = Math.min(ticker.deltaMS / 1000, MAX_FRAME_TIME);
    const { status } = this.store.getSnapshot();

    // Rules only advance while running: a paused match keeps its timer,
    // cooldowns and positions exactly as they were.
    if (status === 'running') {
      simulation.update(dt, this.keyboard.getState());
    }

    // Effects freeze while paused, but keep playing after the match ends
    // (so the final explosion finishes).
    renderer.render(status === 'paused' ? 0 : dt, simulation.drainEvents());
    this.publishSnapshot();
  };

  /** Sends the values the interface needs to the store. */
  private publishSnapshot(): void {
    const simulation = this.simulation;
    if (!simulation) return;

    this.store.update({
      score: simulation.score,
      health: simulation.player.health,
      maxHealth: simulation.player.maxHealth,
      timeLeft: Math.ceil(simulation.timeLeft),
    });

    if (simulation.isOver && this.store.getSnapshot().status !== 'ended') {
      this.store.update({
        status: 'ended',
        endReason: simulation.endReason,
        timePlayed: simulation.elapsed,
      });
    }
  }

  /** Game keys are captured only while the match is running. */
  private readonly onStatusChange = (): void => {
    this.keyboard.setEnabled(this.store.getSnapshot().status === 'running');
  };

  /** Manual pause with Esc or P. */
  private readonly onKeyDown = (event: KeyboardEvent): void => {
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
