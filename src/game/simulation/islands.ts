import type { IslandConfig } from '../config';
import type { Rect } from './types';

/** Full area covered by an island's tiles, in world units. */
export function getIslandBounds(island: IslandConfig, tileSize: number): Rect {
  return {
    x: island.column * tileSize,
    y: island.row * tileSize,
    width: island.columns * tileSize,
    height: island.rows * tileSize,
  };
}

/** Island hitbox: the tile area shrunk by `inset` on every side. */
export function getIslandCollider(island: IslandConfig, tileSize: number, inset: number): Rect {
  const bounds = getIslandBounds(island, tileSize);
  return {
    x: bounds.x + inset,
    y: bounds.y + inset,
    width: bounds.width - inset * 2,
    height: bounds.height - inset * 2,
  };
}
