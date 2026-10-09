import type { GameConfig, WeaponConfig } from '../config';
import { circleIntersectsRect, pushCircleOutOfRect } from './collision';
import { getIslandCollider } from './islands';
import { clamp } from './math';
import { createVolley } from './projectiles';
import type {
  GameEvent,
  PlayerInput,
  Projectile,
  Rect,
  ShipState,
  WeaponSlot,
} from './types';

const WEAPON_SLOTS: WeaponSlot[] = ['front', 'left', 'right'];

/**
 * Holds the game state and applies the game rules.
 * This class never imports PixiJS: it is pure logic,
 * which makes it easy to reason about and to test.
 */
export class GameSimulation {
  readonly config: GameConfig;
  readonly player: ShipState;
  /** Island hitboxes. Ships and projectiles cannot pass through them. */
  readonly obstacles: Rect[];
  /** Every cannonball currently flying. */
  projectiles: Projectile[] = [];

  /** Seconds left until each player cannon can fire again (0 = ready). */
  private readonly playerCooldowns: Record<WeaponSlot, number> = {
    front: 0,
    left: 0,
    right: 0,
  };
  /** Events produced since the last call to drainEvents(). */
  private events: GameEvent[] = [];
  private nextEntityId = 1;

  constructor(config: GameConfig) {
    this.config = config;
    this.obstacles = config.islands.map((island) =>
      getIslandCollider(island, config.tileSize, config.islandColliderInset),
    );
    this.player = {
      position: { x: config.arena.width / 2, y: config.arena.height / 2 },
      angle: -Math.PI / 2, // start facing up
    };
  }

  /** Advances the game by `dt` seconds. Called once per frame. */
  update(dt: number, input: PlayerInput): void {
    this.updatePlayer(dt, input);
    this.updatePlayerWeapons(dt, input);
    this.updateProjectiles(dt);
  }

  /**
   * Returns the events that happened since the last call and clears the list,
   * so each event is handled exactly once (even if the game is paused).
   */
  drainEvents(): GameEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }

  // ---------------------------------------------------------------- player

  private updatePlayer(dt: number, input: PlayerInput): void {
    const { moveSpeed, turnSpeed, radius } = this.config.player;
    const ship = this.player;

    // 1. Rotation: angular speed (rad/s) multiplied by elapsed time (s).
    if (input.turnLeft) ship.angle -= turnSpeed * dt;
    if (input.turnRight) ship.angle += turnSpeed * dt;

    // 2. Forward movement: cos/sin of the angle give the facing direction.
    if (input.forward) {
      ship.position.x += Math.cos(ship.angle) * moveSpeed * dt;
      ship.position.y += Math.sin(ship.angle) * moveSpeed * dt;
    }

    // 3. Islands: if the ship moved into one, push it back to the coast.
    this.resolveIslandCollisions(ship, radius);

    // 4. Arena limits: keep the whole ship inside the visible area.
    this.keepInsideArena(ship, radius);
  }

  /** Pushes a ship (treated as a circle) out of every island it overlaps. */
  private resolveIslandCollisions(ship: ShipState, radius: number): void {
    for (const obstacle of this.obstacles) {
      pushCircleOutOfRect(ship.position, radius, obstacle);
    }
  }

  private keepInsideArena(ship: ShipState, radius: number): void {
    const { width, height } = this.config.arena;
    ship.position.x = clamp(ship.position.x, radius, width - radius);
    ship.position.y = clamp(ship.position.y, radius, height - radius);
  }

  // --------------------------------------------------------------- weapons

  /**
   * Each cannon has its own cooldown timer. Holding the fire key shoots
   * again as soon as the timer reaches zero.
   */
  private updatePlayerWeapons(dt: number, input: PlayerInput): void {
    const wantsToFire: Record<WeaponSlot, boolean> = {
      front: input.fireFront,
      left: input.fireLeft,
      right: input.fireRight,
    };

    for (const slot of WEAPON_SLOTS) {
      // Count the timer down, never below zero.
      this.playerCooldowns[slot] = Math.max(0, this.playerCooldowns[slot] - dt);

      if (!wantsToFire[slot] || this.playerCooldowns[slot] > 0) continue;

      const weapon = this.getPlayerWeapon(slot);
      this.fire(this.player, slot, weapon);
      this.playerCooldowns[slot] = weapon.cooldown;
    }
  }

  private getPlayerWeapon(slot: WeaponSlot): WeaponConfig {
    const { frontWeapon, sideWeapon } = this.config.player;
    return slot === 'front' ? frontWeapon : sideWeapon;
  }

  private fire(ship: ShipState, slot: WeaponSlot, weapon: WeaponConfig): void {
    const volley = createVolley({
      shipPosition: ship.position,
      shipAngle: ship.angle,
      slot,
      weapon,
      team: 'player',
      projectileRadius: this.config.projectileRadius,
      nextId: () => this.nextEntityId++,
    });

    this.projectiles.push(...volley.projectiles);
    this.events.push({
      type: 'shotFired',
      slot,
      position: volley.muzzlePosition,
      angle: volley.angle,
    });
  }

  // ----------------------------------------------------------- projectiles

  /** Moves every projectile and removes the ones that should disappear. */
  private updateProjectiles(dt: number): void {
    this.projectiles = this.projectiles.filter((projectile) =>
      this.updateProjectile(projectile, dt),
    );
  }

  /** Returns true if the projectile is still flying after this step. */
  private updateProjectile(projectile: Projectile, dt: number): boolean {
    projectile.position.x += projectile.velocity.x * dt;
    projectile.position.y += projectile.velocity.y * dt;
    projectile.remainingTime -= dt;

    // Hit an island: removed, with an impact effect.
    const hitIsland = this.obstacles.some((obstacle) =>
      circleIntersectsRect(projectile.position, projectile.radius, obstacle),
    );
    if (hitIsland) {
      this.events.push({
        type: 'projectileImpact',
        position: { ...projectile.position },
        surface: 'island',
      });
      return false;
    }

    // Reached its maximum range: falls into the water.
    if (projectile.remainingTime <= 0) {
      this.events.push({
        type: 'projectileImpact',
        position: { ...projectile.position },
        surface: 'water',
      });
      return false;
    }

    // Left the arena: removed silently.
    const { width, height } = this.config.arena;
    const { x, y } = projectile.position;
    if (x < 0 || x > width || y < 0 || y > height) return false;

    return true;
  }
}
