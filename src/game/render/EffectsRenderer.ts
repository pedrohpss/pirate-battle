import { Container, Sprite } from 'pixi.js';
import type { Texture } from 'pixi.js';
import type { GameEvent, Vector2 } from '../simulation/types';
import type { GameTextures } from './assets';

/** A short visual effect that grows and fades out, then is removed. */
interface ActiveEffect {
  sprite: Sprite;
  /** Seconds since the effect started. */
  age: number;
  /** Total length of the effect in seconds. */
  duration: number;
  startScale: number;
  endScale: number;
}

/** Light blue tint that turns an explosion sprite into a water splash. */
const WATER_SPLASH_TINT = 0xcfefff;

/**
 * Turns simulation events into short visual effects
 * (muzzle flashes, impacts, splashes). Purely visual: never affects gameplay.
 */
export class EffectsRenderer {
  /** Layer that holds every effect sprite. Added to the world by GameRenderer. */
  readonly container = new Container();
  private readonly textures: GameTextures;
  private effects: ActiveEffect[] = [];

  constructor(textures: GameTextures) {
    this.textures = textures;
  }

  /** Starts an effect for each event that needs one. */
  handleEvents(events: readonly GameEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case 'shotFired':
          this.spawn(this.textures.explosionSmall, event.position, 0.18, 0.4, 0.9);
          break;
        case 'projectileImpact':
          if (event.surface === 'island') {
            this.spawn(this.textures.explosionMedium, event.position, 0.3, 0.3, 0.6);
          } else {
            const splash = this.spawn(this.textures.explosionSmall, event.position, 0.35, 0.2, 0.6);
            splash.tint = WATER_SPLASH_TINT;
          }
          break;
      }
    }
  }

  /** Animates every effect and removes the finished ones. */
  update(dt: number): void {
    this.effects = this.effects.filter((effect) => {
      effect.age += dt;
      const progress = Math.min(effect.age / effect.duration, 1); // 0 -> 1

      // Grow from startScale to endScale while fading out.
      const scale = effect.startScale + (effect.endScale - effect.startScale) * progress;
      effect.sprite.scale.set(scale);
      effect.sprite.alpha = 1 - progress;

      if (progress >= 1) {
        effect.sprite.destroy();
        return false;
      }
      return true;
    });
  }

  private spawn(
    texture: Texture,
    position: Vector2,
    duration: number,
    startScale: number,
    endScale: number,
  ): Sprite {
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.position.set(position.x, position.y);
    sprite.scale.set(startScale);
    this.container.addChild(sprite);
    this.effects.push({ sprite, age: 0, duration, startScale, endScale });
    return sprite;
  }
}
