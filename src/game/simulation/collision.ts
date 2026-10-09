import { clamp } from './math';
import type { Rect, Vector2 } from './types';

/**
 * Collision helpers. Ships are treated as circles and islands as rectangles,
 * which is cheap to compute and easy to reason about.
 */

/** Closest point inside `rect` to `point`. */
function closestPointInRect(point: Vector2, rect: Rect): Vector2 {
  return {
    x: clamp(point.x, rect.x, rect.x + rect.width),
    y: clamp(point.y, rect.y, rect.y + rect.height),
  };
}

/** True when a circle overlaps a rectangle. */
export function circleIntersectsRect(center: Vector2, radius: number, rect: Rect): boolean {
  const closest = closestPointInRect(center, rect);
  const dx = center.x - closest.x;
  const dy = center.y - closest.y;
  return dx * dx + dy * dy < radius * radius;
}

/**
 * If a circle overlaps a rectangle, moves the circle (in place) the minimum
 * distance needed so they only touch. This is what makes a ship "slide"
 * along the coast instead of entering the island.
 */
export function pushCircleOutOfRect(center: Vector2, radius: number, rect: Rect): void {
  const closest = closestPointInRect(center, rect);
  const dx = center.x - closest.x;
  const dy = center.y - closest.y;
  const distanceSquared = dx * dx + dy * dy;

  // Not touching: nothing to do.
  if (distanceSquared >= radius * radius) return;

  if (distanceSquared > 0) {
    // Usual case: the center is outside the rect but too close.
    // Push it away from the closest point until the gap equals the radius.
    const distance = Math.sqrt(distanceSquared);
    const overlap = radius - distance;
    center.x += (dx / distance) * overlap;
    center.y += (dy / distance) * overlap;
    return;
  }

  // Rare case: the center is inside the rect.
  // Push it out through the nearest side.
  const toLeft = center.x - rect.x;
  const toRight = rect.x + rect.width - center.x;
  const toTop = center.y - rect.y;
  const toBottom = rect.y + rect.height - center.y;
  const nearest = Math.min(toLeft, toRight, toTop, toBottom);

  if (nearest === toLeft) center.x = rect.x - radius;
  else if (nearest === toRight) center.x = rect.x + rect.width + radius;
  else if (nearest === toTop) center.y = rect.y - radius;
  else center.y = rect.y + rect.height + radius;
}