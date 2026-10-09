import type { GameConfig } from '../config';
import { angleDifference, angleTo, distance, turnTowards } from './math';
import type { EnemyShip, Vector2 } from './types';

/** What an enemy decided to do this frame. */
export interface EnemyDecision {
  moveForward: boolean;
  wantsToFire: boolean;
}

/**
 * Enemy "brain": turns the ship toward the player and decides whether
 * to move and whether to shoot. It only rotates the ship; moving,
 * collisions and firing are applied by the simulation.
 *
 * - Chaser: always turns toward the player and sails forward to ram it.
 * - Shooter: approaches until `preferredDistance`, then holds position,
 *   and fires when the player is in range and the bow is aimed at it.
 */
export function decideEnemyAction(
  enemy: EnemyShip,
  target: Vector2,
  config: GameConfig,
  dt: number,
): EnemyDecision {
  const stats = enemy.kind === 'chaser' ? config.chaser : config.shooter;

  // Rotate toward the player, limited by the ship's turning speed.
  const targetAngle = angleTo(enemy.position, target);
  enemy.angle = turnTowards(enemy.angle, targetAngle, stats.turnSpeed * dt);

  if (enemy.kind === 'chaser') {
    return { moveForward: true, wantsToFire: false };
  }

  const { preferredDistance, attackRange, aimTolerance } = config.shooter;
  const distanceToTarget = distance(enemy.position, target);
  const aimError = Math.abs(angleDifference(enemy.angle, targetAngle));

  return {
    moveForward: distanceToTarget > preferredDistance,
    wantsToFire: distanceToTarget <= attackRange && aimError <= aimTolerance,
  };
}
