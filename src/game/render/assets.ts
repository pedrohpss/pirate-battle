import { Assets } from 'pixi.js';
import type { Texture } from 'pixi.js';

/** Base folder of the PNGs (inside /public, served at the site root by Vite). */
const PNG_PATH = '/assets/png/default';

/** Every single texture the game uses, by name. Add new ones here. */
const TEXTURE_PATHS = {
  water: `${PNG_PATH}/tiles/tile_73.png`,
  playerShip: `${PNG_PATH}/ships/ship_2.png`,
  cannonBall: `${PNG_PATH}/ship_parts/cannon_ball.png`,
  explosionSmall: `${PNG_PATH}/effects/explosion_3.png`,
  explosionMedium: `${PNG_PATH}/effects/explosion_2.png`,
} as const;

type TextureName = keyof typeof TEXTURE_PATHS;

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
export type GameTextures = Record<TextureName, Texture> & {
  /** Island tile textures, indexed by tile number. */
  islandTiles: Map<number, Texture>;
};

/** Loads all textures in parallel. Pixi caches them, so reloading is free. */
export async function loadGameTextures(): Promise<GameTextures> {
  const namedEntries = Object.entries(TEXTURE_PATHS) as [TextureName, string][];
  const islandTileIds = ISLAND_TILE_GRID.flat();

  const [namedTextures, islandTextures] = await Promise.all([
    Promise.all(namedEntries.map(([, path]) => Assets.load<Texture>(path))),
    Promise.all(
      islandTileIds.map((id) => Assets.load<Texture>(`${PNG_PATH}/tiles/tile_${id}.png`)),
    ),
  ]);

  // Turn the two arrays back into "name -> texture" lookups.
  const named = Object.fromEntries(
    namedEntries.map(([name], index) => [name, namedTextures[index]]),
  ) as Record<TextureName, Texture>;

  const islandTiles = new Map<number, Texture>();
  islandTileIds.forEach((id, index) => islandTiles.set(id, islandTextures[index]));

  return { ...named, islandTiles };
}
