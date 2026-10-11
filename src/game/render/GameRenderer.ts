import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js';
import type { Application } from 'pixi.js';
import type { IslandConfig } from '../config';
import type { GameSimulation } from '../simulation/GameSimulation';
import type { GameEvent, Ship, ShipKind } from '../simulation/types';
import { ISLAND_DECORATION_TILES, ISLAND_TILE_GRID } from './assets';
import type { GameTextures } from './assets';
import { EffectsRenderer } from './EffectsRenderer';
import { HealthBar } from './HealthBar';
import type { HealthBarStyle } from './HealthBar';
import { SHIP_SPRITE_ROTATION_OFFSET, getDamageStage } from './ships';

/**
 * When true, draws the hitboxes used by the simulation (red lines).
 * Very useful to check collisions; keep it false in the delivered game.
 */
const DEBUG_DRAW_COLLIDERS = false;

/** How far above the ship's center the health bar is drawn, in world units. */
const HEALTH_BAR_OFFSET = 62;

/** The sprites that represent one ship on screen. */
interface ShipView {
  sprite: Sprite;
  healthBar: HealthBar;
}

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
  // Layers, from bottom to top.
  private readonly projectileLayer = new Container();
  private readonly shipLayer = new Container();
  private readonly healthBarLayer = new Container();
  private readonly effects: EffectsRenderer;

  private readonly playerView: ShipView;
  /** Links each enemy id (simulation) to its sprites (screen). */
  private readonly enemyViews = new Map<number, ShipView>();
  /** Links each projectile id (simulation) to its sprite (screen). */
  private readonly projectileSprites = new Map<number, Sprite>();

  private readonly playerBarStyle: HealthBarStyle;
  private readonly enemyBarStyle: HealthBarStyle;
  private readonly colliderDebug = new Graphics();
  private lastScreenWidth = 0;
  private lastScreenHeight = 0;

  constructor(app: Application, textures: GameTextures, simulation: GameSimulation) {
    this.app = app;
    this.textures = textures;
    this.simulation = simulation;
    const { arena } = simulation.config;

    // Measurements below come from assets/spritesheet/ui_sheet.json ("fill_rect").
    this.playerBarStyle = {
      frame: textures.healthFrame,
      fills: [
        { minRatio: 0.6, texture: textures.healthFillGreen },
        { minRatio: 0.3, texture: textures.healthFillAmber },
        { minRatio: -1, texture: textures.healthFillRed },
      ],
      fillRect: { x: 30, y: 15, width: 196, height: 20 },
      width: 256,
      height: 48,
      scale: 0.35,
    };
    this.enemyBarStyle = {
      frame: textures.enemyHealthFrame,
      fills: [
        { minRatio: 0.4, texture: textures.enemyHealthFillGreen },
        { minRatio: -1, texture: textures.enemyHealthFillRed },
      ],
      fillRect: { x: 24, y: 12, width: 112, height: 15 },
      width: 160,
      height: 40,
      scale: 0.45,
    };

    // Layer order matters: what is added later is drawn on top.
    this.world.addChild(
      new TilingSprite({ texture: textures.water, width: arena.width, height: arena.height }),
    );
    simulation.config.islands.forEach((island, index) => {
      this.world.addChild(this.createIsland(island, index));
    });
    this.effects = new EffectsRenderer(textures);
    this.world.addChild(
      this.effects.underShips,
      this.projectileLayer,
      this.shipLayer,
      this.effects.overShips,
      this.healthBarLayer,
    );
    if (DEBUG_DRAW_COLLIDERS) this.world.addChild(this.colliderDebug);

    this.playerView = this.createShipView('player', this.playerBarStyle);

    app.stage.addChild(this.world);
  }

  /**
   * Called once per frame, after the simulation update.
   * `dt` animates purely visual effects; `events` are what happened this step.
   */
  render(dt: number, events: readonly GameEvent[]): void {
    this.fitToScreen();
    this.updateShipView(this.playerView, this.simulation.player, 'player');
    this.syncEnemies();
    this.syncProjectiles();
    this.effects.handleEvents(events);
    this.effects.update(dt);
    if (DEBUG_DRAW_COLLIDERS) this.drawColliders();
  }

  // ----------------------------------------------------------------- ships

  private createShipView(kind: ShipKind, barStyle: HealthBarStyle): ShipView {
    const sprite = new Sprite(this.textures.ships[kind][0]);
    sprite.anchor.set(0.5); // rotate around the center
    this.shipLayer.addChild(sprite);

    const healthBar = new HealthBar(barStyle);
    this.healthBarLayer.addChild(healthBar.container);
    return { sprite, healthBar };
  }

  /** Copies position, rotation, damage image and health from a ship to its view. */
  private updateShipView(view: ShipView, ship: Ship, kind: ShipKind): void {
    const { position } = ship;
    view.sprite.position.set(position.x, position.y);
    view.sprite.rotation = ship.angle + SHIP_SPRITE_ROTATION_OFFSET;
    view.sprite.texture = this.textures.ships[kind][getDamageStage(ship.health, ship.maxHealth)];

    // The bar does not rotate with the ship: it always stays above it.
    view.healthBar.setPosition(position.x, position.y - HEALTH_BAR_OFFSET);
    view.healthBar.setRatio(ship.health / ship.maxHealth);
  }

  /**
   * Keeps exactly one view per enemy: creates views for new enemies,
   * updates existing ones and destroys views of enemies that are gone.
   */
  private syncEnemies(): void {
    const aliveIds = new Set<number>();

    for (const enemy of this.simulation.enemies) {
      aliveIds.add(enemy.id);
      let view = this.enemyViews.get(enemy.id);
      if (!view) {
        view = this.createShipView(enemy.kind, this.enemyBarStyle);
        this.enemyViews.set(enemy.id, view);
      }
      this.updateShipView(view, enemy, enemy.kind);
    }

    for (const [id, view] of this.enemyViews) {
      if (!aliveIds.has(id)) {
        view.sprite.destroy();
        view.healthBar.destroy();
        this.enemyViews.delete(id);
      }
    }
  }

  // ----------------------------------------------------------- projectiles

  /** Same idea as syncEnemies, for cannonballs. */
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

  // ------------------------------------------------------------------- map

  /**
   * Builds an island out of sand tiles: corners on the corners,
   * edges along the borders and the center tile filling the inside.
   */
  private createIsland(island: IslandConfig, islandIndex: number): Container {
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

    this.decorateIsland(container, island, islandIndex);
    return container;
  }

  /**
   * Adds a palm tree, a bush, a rock and grass tufts on the sand.
   * Positions are fractions of the island size, so they fit islands of any
   * size. Every other island is mirrored so they do not all look the same.
   * No randomness: the arena looks identical in every match (and in the
   * visual tests).
   */
  private decorateIsland(container: Container, island: IslandConfig, islandIndex: number): void {
    const { tileSize } = this.simulation.config;
    const width = island.columns * tileSize;
    const height = island.rows * tileSize;
    const mirrored = islandIndex % 2 === 1;
    const tiles = ISLAND_DECORATION_TILES;

    // x, y = fraction of the island (0 = left/top, 1 = right/bottom).
    const decorations = [
      { tile: tiles.tuftsA, x: 0.28, y: 0.3, scale: 0.9, rotation: 0 },
      { tile: tiles.tuftsB, x: 0.7, y: 0.72, scale: 0.9, rotation: 1.2 },
      { tile: islandIndex === 2 ? tiles.mossyRock : tiles.rock, x: 0.7, y: 0.32, scale: 0.55, rotation: 0 },
      { tile: islandIndex === 1 ? tiles.leaves : tiles.bush, x: 0.32, y: 0.68, scale: 0.75, rotation: 0.4 },
      // The palm last, so its leaves are drawn over everything else.
      { tile: tiles.palm, x: 0.52, y: 0.48, scale: 1.4, rotation: islandIndex * 0.9 },
    ];

    for (const decoration of decorations) {
      const sprite = new Sprite(this.textures.islandTiles.get(decoration.tile));
      sprite.anchor.set(0.5);
      const x = mirrored ? 1 - decoration.x : decoration.x;
      sprite.position.set(x * width, decoration.y * height);
      sprite.scale.set(decoration.scale);
      sprite.rotation = decoration.rotation;
      container.addChild(sprite);
    }
  }

  /** Draws every hitbox as a red outline (debug only). */
  private drawColliders(): void {
    const g = this.colliderDebug.clear();
    for (const rect of this.simulation.obstacles) {
      g.rect(rect.x, rect.y, rect.width, rect.height);
    }
    for (const ship of [this.simulation.player, ...this.simulation.enemies]) {
      g.circle(ship.position.x, ship.position.y, ship.radius);
    }
    g.stroke({ width: 2, color: 0xff3333 });
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
