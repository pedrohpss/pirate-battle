import { Assets } from 'pixi.js';
import type { Texture } from 'pixi.js';

/** Paths are relative to /public (served at the site root by Vite). */
const TEXTURE_PATHS = {
  water: '/assets/png/default/tiles/tile_73.png',
  playerShip: '/assets/png/default/ships/ship_2.png',
};

/** Every texture the game needs, already loaded. */
export interface GameTextures {
  water: Texture;
  playerShip: Texture;
}

/** Loads all textures in parallel. Pixi caches them, so reloading is free. */
export async function loadGameTextures(): Promise<GameTextures> {
  const [water, playerShip] = await Promise.all([
    Assets.load<Texture>(TEXTURE_PATHS.water),
    Assets.load<Texture>(TEXTURE_PATHS.playerShip),
  ]);
  return { water, playerShip };
}