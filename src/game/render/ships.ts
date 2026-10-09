import { SHIP_DAMAGE_STAGES } from './assets';

/**
 * The ship images point down, but the simulation uses angle 0 = right.
 * Adding this offset converts a simulation angle into a sprite rotation.
 */
export const SHIP_SPRITE_ROTATION_OFFSET = -Math.PI / 2;

/**
 * Picks which damage image to show for the current health:
 * more than 2/3 -> 0 (intact), more than 1/3 -> 1 (damaged),
 * above 0 -> 2 (badly damaged), 0 -> 3 (wrecked).
 */
export function getDamageStage(health: number, maxHealth: number): number {
  if (health <= 0) return SHIP_DAMAGE_STAGES - 1;
  const ratio = health / maxHealth;
  if (ratio > 2 / 3) return 0;
  if (ratio > 1 / 3) return 1;
  return 2;
}
