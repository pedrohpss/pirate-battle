import { Assets } from 'pixi.js';
import type { Texture } from 'pixi.js';
import type { ShipKind } from '../simulation/types';

/** Base folder of the PNGs (inside /public, served at the site root by Vite). */
const PNG_PATH = '/assets/png/default';

/** Every single texture the game uses, by name. Add new ones here. */
const TEXTURE_PATHS = {
  water: `${PNG_PATH}/tiles/tile_73.png`,
  cannonBall: `${PNG_PATH}/ship_parts/cannon_ball.png`,
  explosionSmall: `${PNG_PATH}/effects/explosion_3.png`,
  explosionMedium: `${PNG_PATH}/effects/explosion_2.png`,
  explosionLarge: `${PNG_PATH}/effects/explosion_1.png`,
  healthFrame: `${PNG_PATH}/ui/hud/health_frame.png`,
  healthFillGreen: `${PNG_PATH}/ui/hud/health_fill_green.png`,
  healthFillAmber: `${PNG_PATH}/ui/hud/health_fill_amber.png`,
  healthFillRed: `${PNG_PATH}/ui/hud/health_fill_red.png`,
  enemyHealthFrame: `${PNG_PATH}/ui/hud/enemy_health_frame.png`,
  enemyHealthFillGreen: `${PNG_PATH}/ui/hud/enemy_health_fill_green.png`,
  enemyHealthFillRed: `${PNG_PATH}/ui/hud/enemy_health_fill_red.png`,
} as const;

type TextureName = keyof typeof TEXTURE_PATHS;

/**
 * Ship color used by each kind (1 = white, 2 = black, 3 = red,
 * 4 = green, 5 = blue, 6 = yellow).
 */
const SHIP_COLORS: Record<ShipKind, number> = {
  player: 2,
  chaser: 3,
  shooter: 4,
};

/**
 * The asset pack has 4 versions of each ship, 6 numbers apart:
 * intact, damaged, badly damaged and wrecked.
 * Example for the black ship: ship_2, ship_8, ship_14, ship_20.
 */
export const SHIP_DAMAGE_STAGES = 4;

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
  /** For each ship kind, its 4 damage stages (index 0 = intact, 3 = wrecked). */
  ships: Record<ShipKind, Texture[]>;
  /** Island tile textures, indexed by tile number. */
  islandTiles: Map<number, Texture>;
};

function loadTexture(path: string): Promise<Texture> {
  return Assets.load<Texture>(path);
}

/** Loads the 4 damage stages of one ship color. */
function loadShipStages(color: number): Promise<Texture[]> {
  const paths = Array.from(
    { length: SHIP_DAMAGE_STAGES },
    (_, stage) => `${PNG_PATH}/ships/ship_${color + stage * 6}.png`,
  );
  return Promise.all(paths.map(loadTexture));
}

/** Loads all textures in parallel. Pixi caches them, so reloading is free. */
export async function loadGameTextures(): Promise<GameTextures> {
  const namedEntries = Object.entries(TEXTURE_PATHS) as [TextureName, string][];
  const islandTileIds = ISLAND_TILE_GRID.flat();

  const [namedTextures, islandTextures, player, chaser, shooter] = await Promise.all([
    Promise.all(namedEntries.map(([, path]) => loadTexture(path))),
    Promise.all(islandTileIds.map((id) => loadTexture(`${PNG_PATH}/tiles/tile_${id}.png`))),
    loadShipStages(SHIP_COLORS.player),
    loadShipStages(SHIP_COLORS.chaser),
    loadShipStages(SHIP_COLORS.shooter),
  ]);

  // Turn the arrays back into "name -> texture" lookups.
  const named = Object.fromEntries(
    namedEntries.map(([name], index) => [name, namedTextures[index]]),
  ) as Record<TextureName, Texture>;

  const islandTiles = new Map<number, Texture>();
  islandTileIds.forEach((id, index) => islandTiles.set(id, islandTextures[index]));

  return { ...named, ships: { player, chaser, shooter }, islandTiles };
}
