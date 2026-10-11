import { clamp } from './math';
import type { Rect, Vector2 } from './types';

/**
 * Collision helpers. Ships and projectiles are treated as circles and
 * islands as rectangles, which is cheap to compute and easy to reason about.
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

/** True when two circles overlap. */
export function circlesOverlap(
  centerA: Vector2,
  radiusA: number,
  centerB: Vector2,
  radiusB: number,
): boolean {
  const dx = centerB.x - centerA.x;
  const dy = centerB.y - centerA.y;
  const minDistance = radiusA + radiusB;
  return dx * dx + dy * dy < minDistance * minDistance;
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

/** A copy of `rect` grown by `amount` on every side. */
export function inflateRect(rect: Rect, amount: number): Rect {
  return {
    x: rect.x - amount,
    y: rect.y - amount,
    width: rect.width + amount * 2,
    height: rect.height + amount * 2,
  };
}

/**
 * True when the straight line from `a` to `b` passes through `rect`.
 * Used as a cheap "line of sight" test (Liang–Barsky clipping): the segment
 * is clipped against each side; if nothing is left, it misses the rectangle.
 */
export function segmentIntersectsRect(a: Vector2, b: Vector2, rect: Rect): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  // For each side: p = direction of travel across it, q = distance to it.
  const p = [-dx, dx, -dy, dy];
  const q = [a.x - rect.x, rect.x + rect.width - a.x, a.y - rect.y, rect.y + rect.height - a.y];
  let enter = 0;
  let exit = 1;

  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false; // parallel to this side and outside it
      continue;
    }
    const t = q[i] / p[i];
    if (p[i] < 0) enter = Math.max(enter, t);
    else exit = Math.min(exit, t);
    if (enter > exit) return false;
  }
  return true;
}

/**
 * If two circles overlap, pushes both apart by half the overlap each.
 * Used so ships bump into each other instead of stacking (enemy with enemy,
 * player with Shooter).
 */
export function separateCircles(
  centerA: Vector2,
  radiusA: number,
  centerB: Vector2,
  radiusB: number,
): void {
  const dx = centerB.x - centerA.x;
  const dy = centerB.y - centerA.y;
  const distance = Math.hypot(dx, dy);
  const overlap = radiusA + radiusB - distance;
  if (overlap <= 0 || distance === 0) return;

  const pushX = (dx / distance) * (overlap / 2);
  const pushY = (dy / distance) * (overlap / 2);
  centerA.x -= pushX;
  centerA.y -= pushY;
  centerB.x += pushX;
  centerB.y += pushY;
}
