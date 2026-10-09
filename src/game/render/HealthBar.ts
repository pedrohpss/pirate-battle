import { Container, Graphics, Sprite } from 'pixi.js';
import type { Texture } from 'pixi.js';
import type { Rect } from '../simulation/types';

/** Visual definition of a health bar, taken from the asset metadata (ui_sheet.json). */
export interface HealthBarStyle {
  frame: Texture;
  /**
   * Fill colors from the healthiest to the most critical.
   * The first one whose `minRatio` is below the current ratio is used.
   */
  fills: { minRatio: number; texture: Texture }[];
  /** Area inside the frame where the fill is visible, in image pixels. */
  fillRect: Rect;
  /** Size of the frame image, in pixels. */
  width: number;
  height: number;
  /** Size multiplier applied to the whole bar. */
  scale: number;
}

/**
 * A health bar drawn with PixiJS: the frame image plus a fill image
 * that is cut (masked) from the left according to the remaining health.
 */
export class HealthBar {
  readonly container = new Container();
  private readonly style: HealthBarStyle;
  private readonly fill: Sprite;
  /** Rectangle that hides the "lost health" part of the fill. */
  private readonly mask = new Graphics();
  /** Last ratio drawn; avoids redrawing the mask when nothing changed. */
  private lastRatio = -1;

  constructor(style: HealthBarStyle) {
    this.style = style;

    // Asset metadata says: draw the frame first, then the fill on top.
    const frame = new Sprite(style.frame);
    this.fill = new Sprite(style.fills[0].texture);
    this.fill.mask = this.mask;
    this.container.addChild(frame, this.fill, this.mask);

    // Pivot at the bottom center, so the bar sits centered above a point.
    this.container.pivot.set(style.width / 2, style.height);
    this.container.scale.set(style.scale);
  }

  /** Updates the bar for a health ratio between 0 (empty) and 1 (full). */
  setRatio(ratio: number): void {
    if (ratio === this.lastRatio) return;
    this.lastRatio = ratio;

    const fill = this.style.fills.find((option) => ratio > option.minRatio);
    this.fill.texture = (fill ?? this.style.fills[this.style.fills.length - 1]).texture;

    const { x, y, width, height } = this.style.fillRect;
    this.mask.clear().rect(x, y, width * ratio, height).fill(0xffffff);
  }

  /** Places the bar centered above a point (in world units). */
  setPosition(x: number, y: number): void {
    this.container.position.set(x, y);
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
