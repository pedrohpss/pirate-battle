import type { WeaponConfig } from '../config';
import type { Projectile, Team, Vector2, WeaponSlot } from './types';

/**
 * Direction of each cannon relative to the ship's heading.
 * Front shoots straight ahead; left and right shoot at 90 degrees.
 */
const SLOT_ANGLE_OFFSET: Record<WeaponSlot, number> = {
  front: 0,
  left: -Math.PI / 2,
  right: Math.PI / 2,
};

export interface VolleyRequest {
  shipPosition: Vector2;
  shipAngle: number;
  slot: WeaponSlot;
  weapon: WeaponConfig;
  team: Team;
  projectileRadius: number;
  /** Gives a fresh unique id for each projectile. */
  nextId: () => number;
}

export interface Volley {
  projectiles: Projectile[];
  /** Center point of the shot, used for the muzzle flash effect. */
  muzzlePosition: Vector2;
  /** Direction the projectiles travel, in radians. */
  angle: number;
}

/**
 * Creates the projectiles of one shot.
 * Several projectiles are placed side by side, perpendicular to the
 * shooting direction, so they fly in parallel lines.
 */
export function createVolley(request: VolleyRequest): Volley {
  const { shipPosition, shipAngle, slot, weapon } = request;
  const angle = shipAngle + SLOT_ANGLE_OFFSET[slot];

  // Unit vector pointing where the shot goes.
  const direction = { x: Math.cos(angle), y: Math.sin(angle) };
  // Unit vector at 90 degrees from it: used to spread parallel projectiles.
  const perpendicular = { x: -direction.y, y: direction.x };

  const muzzlePosition = {
    x: shipPosition.x + direction.x * weapon.muzzleOffset,
    y: shipPosition.y + direction.y * weapon.muzzleOffset,
  };

  const projectiles: Projectile[] = [];
  for (let i = 0; i < weapon.projectileCount; i++) {
    // Centers the group: for 3 projectiles the offsets are -1, 0 and +1 spacing.
    const lateralOffset = (i - (weapon.projectileCount - 1) / 2) * weapon.spacing;

    projectiles.push({
      id: request.nextId(),
      team: request.team,
      position: {
        x: muzzlePosition.x + perpendicular.x * lateralOffset,
        y: muzzlePosition.y + perpendicular.y * lateralOffset,
      },
      velocity: {
        x: direction.x * weapon.projectileSpeed,
        y: direction.y * weapon.projectileSpeed,
      },
      radius: request.projectileRadius,
      damage: weapon.damage,
      remainingTime: weapon.projectileRange / weapon.projectileSpeed,
    });
  }

  return { projectiles, muzzlePosition, angle };
}
