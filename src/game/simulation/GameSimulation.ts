import type { GameConfig } from '../config';
import type { PlayerInput, ShipState } from './types';

/**
 * Holds the game state and applies the game rules.
 * This class never imports PixiJS: it is pure logic,
 * which makes it easy to reason about and to test.
 */
export class GameSimulation {
  readonly config: GameConfig;
  readonly player: ShipState;

  constructor(config: GameConfig) {
    this.config = config;
    this.player = {
      position: { x: config.arena.width / 2, y: config.arena.height / 2 },
      angle: -Math.PI / 2, // start facing up
    };
  }

  /** Advances the game by `dt` seconds. Called once per frame. */
  update(dt: number, input: PlayerInput): void {
    this.updatePlayer(dt, input);
  }

  private updatePlayer(dt: number, input: PlayerInput): void {
    const { moveSpeed, turnSpeed, radius } = this.config.player;
    const ship = this.player;

    // Rotation: angular speed (rad/s) multiplied by elapsed time (s).
    if (input.turnLeft) ship.angle -= turnSpeed * dt;
    if (input.turnRight) ship.angle += turnSpeed * dt;

    // Forward movement: cos/sin of the angle give the facing direction.
    if (input.forward) {
      ship.position.x += Math.cos(ship.angle) * moveSpeed * dt;
      ship.position.y += Math.sin(ship.angle) * moveSpeed * dt;
    }

    // Keep the whole ship inside the arena.
    const { width, height } = this.config.arena;
    ship.position.x = clamp(ship.position.x, radius, width - radius);
    ship.position.y = clamp(ship.position.y, radius, height - radius);
  }
}

/** Limits `value` to the range [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}