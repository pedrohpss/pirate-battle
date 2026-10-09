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

/** Everything that defines how a cannon (or a group of cannons) shoots. */
export interface WeaponConfig {
  /** Minimum time between two shots of this weapon, in seconds. */
  cooldown: number;
  /** How many projectiles each shot fires side by side. */
  projectileCount: number;
  /** Distance between parallel projectiles, in world units. */
  spacing: number;
  /** Distance from the ship center where projectiles appear. */
  muzzleOffset: number;
  /** Projectile speed in world units per second. */
  projectileSpeed: number;
  /** How far a projectile travels before disappearing, in world units. */
  projectileRange: number;
  /** Health removed from the ship that gets hit. */
  damage: number;
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
  /** Collision radius of every cannonball. */
  projectileRadius: number;
  player: {
    /** Forward speed in world units per second. */
    moveSpeed: number;
    /** Turning speed in radians per second. */
    turnSpeed: number;
    /** Collision radius, used for arena limits, islands and hits. */
    radius: number;
    /** Single cannon at the bow. */
    frontWeapon: WeaponConfig;
    /** Broadside cannons; left and right each have their own cooldown. */
    sideWeapon: WeaponConfig;
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
  projectileRadius: 5,
  player: {
    moveSpeed: 180,
    turnSpeed: 2.5,
    radius: 30,
    frontWeapon: {
      cooldown: 0.4,
      projectileCount: 1,
      spacing: 0,
      muzzleOffset: 58,
      projectileSpeed: 480,
      projectileRange: 520,
      damage: 25,
    },
    sideWeapon: {
      cooldown: 1,
      projectileCount: 3,
      spacing: 24,
      muzzleOffset: 26,
      projectileSpeed: 420,
      projectileRange: 380,
      damage: 20,
    },
  },
};
