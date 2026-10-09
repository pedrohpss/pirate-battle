import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js';
import type { Application } from 'pixi.js';
import type { IslandConfig } from '../config';
import type { GameSimulation } from '../simulation/GameSimulation';
import type { GameEvent } from '../simulation/types';
import { ISLAND_TILE_GRID } from './assets';
import type { GameTextures } from './assets';
import { EffectsRenderer } from './EffectsRenderer';

/**
 * The ship images point down, but the simulation uses angle 0 = right.
 * Adding this offset converts a simulation angle into a sprite rotation.
 */
const SHIP_SPRITE_ROTATION_OFFSET = -Math.PI / 2;

/**
 * When true, draws the hitboxes used by the simulation (red lines).
 * Very useful to check collisions; keep it false in the delivered game.
 */
const DEBUG_DRAW_COLLIDERS = false;

/**
 * Draws the simulation state with PixiJS.
 * It never changes the game state: it only reads and displays it.
 */
export class GameRenderer {
  private readonly app: Application;
  private readonly simulation: GameSimulation;
  private readonly textures: GameTextures;
  /** Groups everything inside the arena so it can be scaled as one piece. */
  private readonly world = new Container();
  private readonly playerSprite: Sprite;
  /** Holds one sprite per flying cannonball. */
  private readonly projectileLayer = new Container();
  /** Links each projectile id (simulation) to its sprite (screen). */
  private readonly projectileSprites = new Map<number, Sprite>();
  private readonly effects: EffectsRenderer;
  private readonly playerColliderDebug = new Graphics();
  private lastScreenWidth = 0;
  private lastScreenHeight = 0;

  constructor(app: Application, textures: GameTextures, simulation: GameSimulation) {
    this.app = app;
    this.textures = textures;
    this.simulation = simulation;
    const { arena } = simulation.config;

    // Layer order matters: what is added later is drawn on top.
    const water = new TilingSprite({
      texture: textures.water,
      width: arena.width,
      height: arena.height,
    });
    this.world.addChild(water);

    for (const island of simulation.config.islands) {
      this.world.addChild(this.createIsland(island));
    }

    this.world.addChild(this.projectileLayer);

    this.playerSprite = new Sprite(textures.playerShip);
    this.playerSprite.anchor.set(0.5); // rotate around the center
    this.world.addChild(this.playerSprite);

    this.effects = new EffectsRenderer(textures);
    this.world.addChild(this.effects.container);

    if (DEBUG_DRAW_COLLIDERS) this.createColliderDebug();

    app.stage.addChild(this.world);
  }

  /**
   * Called once per frame, after the simulation update.
   * `dt` animates purely visual effects; `events` are what happened this step.
   */
  render(dt: number, events: readonly GameEvent[]): void {
    this.fitToScreen();

    const { position, angle } = this.simulation.player;
    this.playerSprite.position.set(position.x, position.y);
    this.playerSprite.rotation = angle + SHIP_SPRITE_ROTATION_OFFSET;
    this.playerColliderDebug.position.set(position.x, position.y);

    this.syncProjectiles();
    this.effects.handleEvents(events);
    this.effects.update(dt);
  }

  /**
   * Keeps exactly one sprite per projectile:
   * creates sprites for new projectiles, moves existing ones,
   * and destroys sprites whose projectile no longer exists.
   */
  private syncProjectiles(): void {
    const aliveIds = new Set<number>();

    for (const projectile of this.simulation.projectiles) {
      aliveIds.add(projectile.id);

      let sprite = this.projectileSprites.get(projectile.id);
      if (!sprite) {
        sprite = new Sprite(this.textures.cannonBall);
        sprite.anchor.set(0.5);
        this.projectileLayer.addChild(sprite);
        this.projectileSprites.set(projectile.id, sprite);
      }
      sprite.position.set(projectile.position.x, projectile.position.y);
    }

    for (const [id, sprite] of this.projectileSprites) {
      if (!aliveIds.has(id)) {
        sprite.destroy();
        this.projectileSprites.delete(id);
      }
    }
  }

  /**
   * Builds an island out of sand tiles: corners on the corners,
   * edges along the borders and the center tile filling the inside.
   */
  private createIsland(island: IslandConfig): Container {
    const { tileSize } = this.simulation.config;
    const container = new Container();
    container.position.set(island.column * tileSize, island.row * tileSize);

    for (let row = 0; row < island.rows; row++) {
      for (let column = 0; column < island.columns; column++) {
        // 0 = first row/column, 2 = last one, 1 = anything in between.
        const gridRow = row === 0 ? 0 : row === island.rows - 1 ? 2 : 1;
        const gridColumn = column === 0 ? 0 : column === island.columns - 1 ? 2 : 1;
        const tileId = ISLAND_TILE_GRID[gridRow][gridColumn];

        const tile = new Sprite(this.textures.islandTiles.get(tileId));
        tile.position.set(column * tileSize, row * tileSize);
        container.addChild(tile);
      }
    }
    return container;
  }

  /** Draws the island hitboxes and the player hitbox as red outlines. */
  private createColliderDebug(): void {
    const islands = new Graphics();
    for (const rect of this.simulation.obstacles) {
      islands.rect(rect.x, rect.y, rect.width, rect.height);
    }
    islands.stroke({ width: 2, color: 0xff3333 });
    this.world.addChild(islands);

    this.playerColliderDebug
      .circle(0, 0, this.simulation.config.player.radius)
      .stroke({ width: 2, color: 0xff3333 });
    this.world.addChild(this.playerColliderDebug);
  }

  /**
   * Scales the arena to fit the screen without distortion and centers it.
   * Only recalculates when the screen size actually changes.
   */
  private fitToScreen(): void {
    const { width, height } = this.app.screen;
    if (width === this.lastScreenWidth && height === this.lastScreenHeight) return;
    this.lastScreenWidth = width;
    this.lastScreenHeight = height;

    const { arena } = this.simulation.config;
    // The smaller ratio guarantees the whole arena is visible.
    const scale = Math.min(width / arena.width, height / arena.height);
    this.world.scale.set(scale);
    this.world.position.set(
      (width - arena.width * scale) / 2,
      (height - arena.height * scale) / 2,
    );
  }
}
