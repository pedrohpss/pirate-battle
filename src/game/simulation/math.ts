import type { Vector2 } from './types';

/** Limits `value` to the range [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Straight-line distance between two points. */
export function distance(a: Vector2, b: Vector2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Angle (in radians) of the line that goes from `from` to `to`. */
export function angleTo(from: Vector2, to: Vector2): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

/**
 * Smallest signed rotation that turns `current` into `target`,
 * always between -PI and PI. Negative = turn left, positive = turn right.
 * Example: from 170 degrees to -170 degrees is +20, not -340.
 */
export function angleDifference(current: number, target: number): number {
  let difference = (target - current) % (Math.PI * 2);
  if (difference > Math.PI) difference -= Math.PI * 2;
  if (difference < -Math.PI) difference += Math.PI * 2;
  return difference;
}

/** Rotates `current` toward `target`, by at most `maxStep` radians. */
export function turnTowards(current: number, target: number, maxStep: number): number {
  const difference = angleDifference(current, target);
  return current + clamp(difference, -maxStep, maxStep);
}

/**
 * Deterministic random number generator (Mulberry32).
 * The same seed always produces the same sequence, which makes
 * matches reproducible in automated tests. Returns numbers in [0, 1).
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
