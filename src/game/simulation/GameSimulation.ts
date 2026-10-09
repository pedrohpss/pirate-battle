import type { GameConfig } from '../config';
import { pushCircleOutOfRect } from './collision';
import { getIslandCollider } from './islands';
import { clamp } from './math';
import type { PlayerInput, Rect, ShipState } from './types';

/**
 * Holds the game state and applies the game rules.
 * This class never imports PixiJS: it is pure logic,
 * which makes it easy to reason about and to test.
 */
export class GameSimulation {
  readonly config: GameConfig;
  readonly player: ShipState;
  /** Island hitboxes. Ships and projectiles cannot pass through them. */
  readonly obstacles: Rect[];

  constructor(config: GameConfig) {
    this.config = config;
    this.obstacles = config.islands.map((island) =>
      getIslandCollider(island, config.tileSize, config.islandColliderInset),
    );
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

    // 1. Rotation: angular speed (rad/s) multiplied by elapsed time (s).
    if (input.turnLeft) ship.angle -= turnSpeed * dt;
    if (input.turnRight) ship.angle += turnSpeed * dt;

    // 2. Forward movement: cos/sin of the angle give the facing direction.
    if (input.forward) {
      ship.position.x += Math.cos(ship.angle) * moveSpeed * dt;
      ship.position.y += Math.sin(ship.angle) * moveSpeed * dt;
    }

    // 3. Islands: if the ship moved into one, push it back to the coast.
    this.resolveIslandCollisions(ship, radius);

    // 4. Arena limits: keep the whole ship inside the visible area.
    this.keepInsideArena(ship, radius);
  }

  /** Pushes a ship (treated as a circle) out of every island it overlaps. */
  private resolveIslandCollisions(ship: ShipState, radius: number): void {
    for (const obstacle of this.obstacles) {
      pushCircleOutOfRect(ship.position, radius, obstacle);
    }
  }

  private keepInsideArena(ship: ShipState, radius: number): void {
    const { width, height } = this.config.arena;
    ship.position.x = clamp(ship.position.x, radius, width - radius);
    ship.position.y = clamp(ship.position.y, radius, height - radius);
  }
}