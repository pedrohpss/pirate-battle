import { Container, Sprite, Text } from 'pixi.js';
import type { Texture } from 'pixi.js';
import type { GameEvent, Vector2 } from '../simulation/types';
import type { GameTextures } from './assets';
import { SHIP_SPRITE_ROTATION_OFFSET } from './ships';

/** A short visual effect that changes size and fades out, then is removed. */
interface ActiveEffect {
  /** A sprite (flash, explosion, wreck) or a text ("+1"). */
  sprite: Sprite | Text;
  /** Seconds since the effect started. */
  age: number;
  /** Total length of the effect in seconds. */
  duration: number;
  startScale: number;
  endScale: number;
  /** Where it started and how far it moves up (world units) during its life. */
  startY: number;
  rise: number;
}

/** Options for one effect. */
interface EffectOptions {
  texture: Texture;
  position: Vector2;
  duration: number;
  startScale: number;
  endScale: number;
  rotation?: number;
  tint?: number;
}

/** Light blue tint that turns an explosion sprite into a water splash. */
const WATER_SPLASH_TINT = 0xcfefff;

/** Look of the "+1" that rises when the player sinks an enemy (gold, like the HUD). */
const SCORE_TEXT_STYLE = {
  fontFamily: 'system-ui, sans-serif',
  fontSize: 40,
  fontWeight: '900',
  fill: 0xffd75e,
  stroke: { color: 0x3b2310, width: 6 },
} as const;

/**
 * Turns simulation events into short visual effects
 * (muzzle flashes, impacts, splashes, explosions and sinking wrecks).
 * Purely visual: never affects gameplay.
 */
export class EffectsRenderer {
  /** Effects drawn under the ships (sinking wrecks). */
  readonly underShips = new Container();
  /** Effects drawn over the ships (flashes, explosions). */
  readonly overShips = new Container();
  private readonly textures: GameTextures;
  private effects: ActiveEffect[] = [];

  constructor(textures: GameTextures) {
    this.textures = textures;
  }

  /** Starts an effect for each event that needs one. */
  handleEvents(events: readonly GameEvent[]): void {
    const { textures } = this;

    for (const event of events) {
      switch (event.type) {
        case 'shotFired':
          this.spawn(this.overShips, {
            texture: textures.explosionSmall,
            position: event.position,
            duration: 0.18,
            startScale: 0.4,
            endScale: 0.9,
          });
          break;

        case 'projectileImpact':
          if (event.surface === 'water') {
            this.spawn(this.overShips, {
              texture: textures.explosionSmall,
              position: event.position,
              duration: 0.35,
              startScale: 0.2,
              endScale: 0.6,
              tint: WATER_SPLASH_TINT,
            });
          } else {
            this.spawn(this.overShips, {
              texture: textures.explosionMedium,
              position: event.position,
              duration: 0.3,
              startScale: 0.3,
              endScale: event.surface === 'ship' ? 0.8 : 0.6,
            });
          }
          break;

        case 'shipDestroyed':
          // The wreck slowly sinks (fades and shrinks) under a big explosion.
          this.spawn(this.underShips, {
            texture: textures.ships[event.kind][3],
            position: event.position,
            duration: 1.5,
            startScale: 1,
            endScale: 0.8,
            rotation: event.angle + SHIP_SPRITE_ROTATION_OFFSET,
          });
          this.spawn(this.overShips, {
            texture: textures.explosionLarge,
            position: event.position,
            duration: 0.6,
            startScale: 0.6,
            endScale: 1.5,
          });
          // "+1" rising from the wreck, only when the kill gave a point.
          if (event.scored) this.spawnScoreText(event.position);
          break;
      }
    }
  }

  /** Animates every effect and removes the finished ones. */
  update(dt: number): void {
    this.effects = this.effects.filter((effect) => {
      effect.age += dt;
      const progress = Math.min(effect.age / effect.duration, 1); // 0 -> 1

      // Linear interpolation from startScale to endScale while fading out.
      const scale = effect.startScale + (effect.endScale - effect.startScale) * progress;
      effect.sprite.scale.set(scale);
      effect.sprite.alpha = 1 - progress;
      effect.sprite.y = effect.startY - effect.rise * progress;

      if (progress >= 1) {
        effect.sprite.destroy();
        return false;
      }
      return true;
    });
  }

  private spawn(layer: Container, options: EffectOptions): void {
    const sprite = new Sprite(options.texture);
    sprite.anchor.set(0.5);
    sprite.position.set(options.position.x, options.position.y);
    sprite.scale.set(options.startScale);
    sprite.rotation = options.rotation ?? 0;
    if (options.tint !== undefined) sprite.tint = options.tint;

    layer.addChild(sprite);
    this.effects.push({
      sprite,
      age: 0,
      duration: options.duration,
      startScale: options.startScale,
      endScale: options.endScale,
      startY: options.position.y,
      rise: 0,
    });
  }

  /** A "+1" that grows a little, rises and fades out over the explosion. */
  private spawnScoreText(position: Vector2): void {
    const text = new Text({ text: '+1', style: SCORE_TEXT_STYLE });
    text.anchor.set(0.5);
    const startY = position.y - 30; // just above the ship
    text.position.set(position.x, startY);
    this.overShips.addChild(text);
    this.effects.push({ sprite: text, age: 0, duration: 1, startScale: 0.8, endScale: 1.2, startY, rise: 70 });
  }
}
