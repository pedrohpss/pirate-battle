import { Assets } from 'pixi.js';
import type { Texture } from 'pixi.js';

/** Paths are relative to /public (served at the site root by Vite). */
const TILE_PATH = '/assets/png/default/tiles';
const SHIP_PATH = '/assets/png/default/ships';

/**
 * Tile numbers used to draw an island, laid out like the island itself:
 * corners, edges and the center. Bigger islands repeat the middle row/column.
 */
export const ISLAND_TILE_GRID = [
  [1, 2, 3], // top-left, top, top-right
  [17, 18, 19], // left, center, right
  [33, 34, 35], // bottom-left, bottom, bottom-right
] as const;

/** Every texture the game needs, already loaded. */
export interface GameTextures {
  water: Texture;
  playerShip: Texture;
  /** Island tile textures, indexed by tile number. */
  islandTiles: Map<number, Texture>;
}

/** Loads all textures in parallel. Pixi caches them, so reloading is free. */
export async function loadGameTextures(): Promise<GameTextures> {
  const islandTileIds = ISLAND_TILE_GRID.flat();

  const [water, playerShip, ...islandTextures] = await Promise.all([
    Assets.load<Texture>(`${TILE_PATH}/tile_73.png`),
    Assets.load<Texture>(`${SHIP_PATH}/ship_2.png`),
    ...islandTileIds.map((id) => Assets.load<Texture>(`${TILE_PATH}/tile_${id}.png`)),
  ]);

  const islandTiles = new Map<number, Texture>();
  islandTileIds.forEach((id, index) => islandTiles.set(id, islandTextures[index]));

  return { water, playerShip, islandTiles };
}