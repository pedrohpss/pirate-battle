import type { GameConfig } from '../config';
import { circleIntersectsRect, circlesOverlap } from './collision';
import { distance } from './math';
import type { EnemyKind, Rect, Ship, Vector2 } from './types';

/**
 * Decides which enemy type comes next.
 * The first two spawns are always one Chaser and one Shooter, so both types
 * are guaranteed to appear in every match. After that it is random,
 * following the configured chance.
 */
export function pickEnemyKind(
  spawnCount: number,
  chaserChance: number,
  random: () => number,
): EnemyKind {
  if (spawnCount === 0) return 'chaser';
  if (spawnCount === 1) return 'shooter';
  return random() < chaserChance ? 'chaser' : 'shooter';
}

export interface SpawnSearch {
  config: GameConfig;
  /** Radius of the ship that will spawn. */
  radius: number;
  playerPosition: Vector2;
  obstacles: Rect[];
  /** Ships already in the arena (the new one must not overlap them). */
  ships: Ship[];
  random: () => number;
}

/**
 * Looks for a random point where an enemy can appear safely:
 * inside the arena, away from islands and other ships, and far enough from
 * the player so it cannot cause unavoidable damage right away.
 * Returns null if no valid point was found after `maxAttempts` tries.
 */
export function findSpawnPosition(search: SpawnSearch): Vector2 | null {
  const { config, radius, playerPosition, obstacles, ships, random } = search;
  const { width, height } = config.arena;
  const { clearance, minDistanceFromPlayer, maxAttempts } = config.spawn;

  // The ship plus some free water around it.
  const safeRadius = radius + clearance;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = {
      x: safeRadius + random() * (width - safeRadius * 2),
      y: safeRadius + random() * (height - safeRadius * 2),
    };

    const tooCloseToPlayer = distance(candidate, playerPosition) < minDistanceFromPlayer;
    if (tooCloseToPlayer) continue;

    const onIsland = obstacles.some((obstacle) =>
      circleIntersectsRect(candidate, safeRadius, obstacle),
    );
    if (onIsland) continue;

    const onAnotherShip = ships.some((ship) =>
      circlesOverlap(candidate, safeRadius, ship.position, ship.radius),
    );
    if (onAnotherShip) continue;

    return candidate;
  }

  return null;
}
