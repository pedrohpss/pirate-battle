import { Container, Sprite, TilingSprite } from 'pixi.js';
import type { Application } from 'pixi.js';
import type { GameConfig } from '../config';
import type { GameSimulation } from '../simulation/GameSimulation';
import type { GameTextures } from './assets';

/**
 * The ship images point down, but the simulation uses angle 0 = right.
 * Adding this offset converts a simulation angle into a sprite rotation.
 */
const SHIP_SPRITE_ROTATION_OFFSET = -Math.PI / 2;

/**
 * Draws the simulation state with PixiJS.
 * It never changes the game state: it only reads and displays it.
 */
export class GameRenderer {
  private readonly app: Application;
  private readonly arena: GameConfig['arena'];
  /** Groups everything inside the arena so it can be scaled as one piece. */
  private readonly world = new Container();
  private readonly playerSprite: Sprite;
  private lastScreenWidth = 0;
  private lastScreenHeight = 0;

  constructor(app: Application, textures: GameTextures, arena: GameConfig['arena']) {
    this.app = app;
    this.arena = arena;

    const water = new TilingSprite({
      texture: textures.water,
      width: arena.width,
      height: arena.height,
    });
    this.world.addChild(water);

    this.playerSprite = new Sprite(textures.playerShip);
    this.playerSprite.anchor.set(0.5); // rotate around the center
    this.world.addChild(this.playerSprite);

    app.stage.addChild(this.world);
  }

  /** Called once per frame, after the simulation update. */
  render(simulation: GameSimulation): void {
    this.fitToScreen();

    const { position, angle } = simulation.player;
    this.playerSprite.position.set(position.x, position.y);
    this.playerSprite.rotation = angle + SHIP_SPRITE_ROTATION_OFFSET;
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

    // The smaller ratio guarantees the whole arena is visible.
    const scale = Math.min(width / this.arena.width, height / this.arena.height);
    this.world.scale.set(scale);
    this.world.position.set(
      (width - this.arena.width * scale) / 2,
      (height - this.arena.height * scale) / 2,
    );
  }
}