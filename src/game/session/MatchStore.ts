import type { EndReason } from '../simulation/types';

/** Where the match is in its life cycle. */
export type MatchStatus = 'loading' | 'error' | 'running' | 'paused' | 'ended';

/**
 * The small part of the game state that the React interface needs.
 * It changes rarely (a hit, a point, once per second), never every frame.
 */
export interface MatchSnapshot {
  status: MatchStatus;
  /** Asset loading progress from 0 to 1 (only meaningful while loading). */
  loadingProgress: number;
  /** Message shown when loading fails. */
  errorMessage: string | null;
  score: number;
  health: number;
  maxHealth: number;
  /** Whole seconds left on the match timer (rounded up, as a clock shows it). */
  timeLeft: number;
  /** Seconds of active play, filled in when the match ends. */
  timePlayed: number;
  endReason: EndReason | null;
}

const INITIAL_SNAPSHOT: MatchSnapshot = {
  status: 'loading',
  loadingProgress: 0,
  errorMessage: null,
  score: 0,
  health: 0,
  maxHealth: 0,
  timeLeft: 0,
  timePlayed: 0,
  endReason: null,
};

/**
 * Bridge between the game loop and React.
 *
 * - The game loop calls `update()` every frame, but subscribers are only
 *   notified when a value actually changed. That keeps React from
 *   re-rendering 60 times per second.
 * - React reads it with `useSyncExternalStore(store.subscribe, store.getSnapshot)`.
 * - Pause and resume go through here too, so the game loop and the
 *   interface always agree on the current status.
 */
export class MatchStore {
  private snapshot: MatchSnapshot = INITIAL_SNAPSHOT;
  private readonly listeners = new Set<() => void>();

  /** Registers a listener; returns a function that removes it. */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Current state. Returns the same object until something changes. */
  readonly getSnapshot = (): MatchSnapshot => this.snapshot;

  /** Merges new values in and notifies listeners only if something changed. */
  update(changes: Partial<MatchSnapshot>): void {
    const keys = Object.keys(changes) as (keyof MatchSnapshot)[];
    const hasChanged = keys.some((key) => changes[key] !== this.snapshot[key]);
    if (!hasChanged) return;

    // A new object, so React can tell the snapshot changed.
    this.snapshot = { ...this.snapshot, ...changes };
    this.listeners.forEach((listener) => listener());
  }

  /** Pauses only a running match (so pausing twice is harmless). */
  pause(): void {
    if (this.snapshot.status === 'running') this.update({ status: 'paused' });
  }

  /** Resumes only a paused match. Must come from an explicit player action. */
  resume(): void {
    if (this.snapshot.status === 'paused') this.update({ status: 'running' });
  }
}
