/**
 * Central place for every gameplay value.
 * Balancing the game should only require changing numbers here,
 * never the logic of the systems.
 */
export interface GameConfig {
  /** Size of the playable area in world units (independent of screen size). */
  arena: { width: number; height: number };
  player: {
    /** Forward speed in world units per second. */
    moveSpeed: number;
    /** Turning speed in radians per second. */
    turnSpeed: number;
    /** Collision radius, used to keep the ship inside the arena. */
    radius: number;
  };
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  arena: { width: 1600, height: 900 },
  player: { moveSpeed: 180, turnSpeed: 2.5, radius: 28 },
};