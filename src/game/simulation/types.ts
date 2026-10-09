/** A point or direction in world space. */
export interface Vector2 {
  x: number;
  y: number;
}

/** An axis-aligned rectangle in world space (x, y = top-left corner). */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * What the player wants to do this frame.
 * Keyboard and touch controls both produce this same shape,
 * so the simulation does not care where the input came from.
 */
export interface PlayerInput {
  forward: boolean;
  turnLeft: boolean;
  turnRight: boolean;
  fireFront: boolean;
  fireLeft: boolean;
  fireRight: boolean;
}

/** The three cannon positions of a ship. */
export type WeaponSlot = 'front' | 'left' | 'right';

/** Who fired a projectile: player shots hit enemies and vice versa. */
export type Team = 'player' | 'enemy';

export type EnemyKind = 'chaser' | 'shooter';

/** Every kind of ship, used by the renderer to pick textures. */
export type ShipKind = 'player' | EnemyKind;

/** Data shared by every ship in the arena. */
export interface Ship {
  /** Unique number, used by the renderer to match a sprite to this ship. */
  id: number;
  position: Vector2;
  /** Facing direction in radians. 0 = right, PI/2 = down, -PI/2 = up. */
  angle: number;
  health: number;
  maxHealth: number;
  radius: number;
}

export interface PlayerShip extends Ship {
  /** Seconds left until each cannon can fire again (0 = ready). */
  cooldowns: Record<WeaponSlot, number>;
}

export interface EnemyShip extends Ship {
  kind: EnemyKind;
  /** Seconds until the Shooter can fire again (unused by Chasers). */
  fireCooldown: number;
}

/** A cannonball flying through the arena. */
export interface Projectile {
  /** Unique number, used by the renderer to match a sprite to this projectile. */
  id: number;
  team: Team;
  position: Vector2;
  /** Movement per second (direction * speed). */
  velocity: Vector2;
  radius: number;
  damage: number;
  /** Seconds left before it falls into the water (range / speed). */
  remainingTime: number;
}

/**
 * Something that happened during a simulation step.
 * The renderer (and later the audio) reacts to these to show effects,
 * without the simulation knowing anything about effects or sounds.
 */
export type GameEvent =
  | { type: 'shotFired'; team: Team; position: Vector2; angle: number }
  | { type: 'projectileImpact'; position: Vector2; surface: 'island' | 'water' | 'ship' }
  | { type: 'shipDestroyed'; kind: ShipKind; position: Vector2; angle: number };
