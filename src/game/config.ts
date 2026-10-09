/**
 * Central place for every gameplay value.
 * Balancing the game should only require changing numbers here,
 * never the logic of the systems.
 */

/** An island described in tiles (1 tile = `tileSize` world units). */
export interface IslandConfig {
  /** Tile column of the top-left corner. */
  column: number;
  /** Tile row of the top-left corner. */
  row: number;
  /** Width in tiles (minimum 2). */
  columns: number;
  /** Height in tiles (minimum 2). */
  rows: number;
}

export interface GameConfig {
  /** Size of the playable area in world units (independent of screen size). */
  arena: { width: number; height: number };
  /** Size of one map tile in world units. */
  tileSize: number;
  islands: IslandConfig[];
  /**
   * How much the island hitbox is shrunk on each side, in world units.
   * The sand tiles have rounded, transparent edges, so a hitbox the size
   * of the full tiles would feel like an invisible wall.
   */
  islandColliderInset: number;
  player: {
    /** Forward speed in world units per second. */
    moveSpeed: number;
    /** Turning speed in radians per second. */
    turnSpeed: number;
    /** Collision radius, used for arena limits, islands and hits. */
    radius: number;
  };
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  arena: { width: 1600, height: 900 },
  tileSize: 64,
  islands: [
    { column: 4, row: 2, columns: 3, rows: 3 },
    { column: 18, row: 3, columns: 4, rows: 3 },
    { column: 8, row: 9, columns: 3, rows: 3 },
  ],
  islandColliderInset: 10,
  player: { moveSpeed: 180, turnSpeed: 2.5, radius: 30 },
};