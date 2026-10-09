/** A point or direction in world space. */
export interface Vector2 {
  x: number;
  y: number;
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
}

/** Position and facing direction of a ship. */
export interface ShipState {
  position: Vector2;
  /** Facing direction in radians. 0 = right, PI/2 = down, -PI/2 = up. */
  angle: number;
}