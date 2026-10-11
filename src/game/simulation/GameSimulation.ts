import type { GameConfig, WeaponConfig } from '../config';
import {
  circleIntersectsRect,
  circlesOverlap,
  inflateRect,
  pushCircleOutOfRect,
  segmentIntersectsRect,
  separateCircles,
} from './collision';
import { decideEnemyAction } from './enemyAI';
import { getIslandCollider } from './islands';
import { angleTo, clamp, distance } from './math';
import { createVolley } from './projectiles';
import { findSpawnPosition, pickEnemyKind } from './spawning';
import type {
  EndReason,
  EnemyShip,
  GameEvent,
  PlayerInput,
  PlayerShip,
  Projectile,
  Rect,
  Ship,
  Team,
  Vector2,
  WeaponSlot,
} from './types';

const WEAPON_SLOTS: WeaponSlot[] = ['front', 'left', 'right'];

/** How far outside an island's corner a Chaser aims when sailing around it. */
const CHASER_CORNER_MARGIN = 12;

/** A corner closer than this counts as reached, and the next one is chosen. */
const CHASER_CORNER_REACHED = 15;

/** Shortest distance from a point to a rectangle (0 if inside). */
function distanceToRect(point: Vector2, rect: Rect): number {
  const dx = Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.width));
  const dy = Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.height));
  return Math.hypot(dx, dy);
}

/**
 * Holds the game state and applies the game rules.
 * This class never imports PixiJS: it is pure logic,
 * which makes it easy to reason about and to test.
 */
export class GameSimulation {
  readonly config: GameConfig;
  /** Island hitboxes. Ships and projectiles cannot pass through them. */
  readonly obstacles: Rect[];
  readonly player: PlayerShip;
  enemies: EnemyShip[] = [];
  /** Every cannonball currently flying. */
  projectiles: Projectile[] = [];
  /** Enemies destroyed by the player's cannons. */
  score = 0;
  /** Total projectiles fired by the player (used by tests and stats). */
  playerProjectilesFired = 0;
  /** Seconds of active play so far (the simulation only advances while running). */
  elapsed = 0;
  /** Why the match ended, or null while it is still going. */
  endReason: EndReason | null = null;

  /** Source of randomness. Can be replaced by a seeded one in tests. */
  private readonly random: () => number;
  /** Events produced since the last call to drainEvents(). */
  private events: GameEvent[] = [];
  private nextEntityId = 1;
  /** Seconds until the next enemy spawn. */
  private spawnTimer: number;
  /** How many enemies have spawned so far in this match. */
  private spawnCount = 0;

  constructor(config: GameConfig, random: () => number = Math.random) {
    this.config = config;
    this.random = random;
    this.spawnTimer = config.spawn.firstSpawnDelay;
    this.obstacles = config.islands.map((island) =>
      getIslandCollider(island, config.tileSize, config.islandColliderInset),
    );
    this.player = {
      id: this.createId(),
      position: { x: config.arena.width / 2, y: config.arena.height / 2 },
      angle: -Math.PI / 2, // start facing up
      health: config.player.maxHealth,
      maxHealth: config.player.maxHealth,
      radius: config.player.radius,
      cooldowns: { front: 0, left: 0, right: 0 },
    };
  }

  /** How many enemies have spawned so far in this match. */
  get enemiesSpawned(): number {
    return this.spawnCount;
  }

  /** True once the match has ended. From then on, update() does nothing. */
  get isOver(): boolean {
    return this.endReason !== null;
  }

  /** Seconds of play left before the timer ends the match. */
  get timeLeft(): number {
    return Math.max(0, this.config.matchDuration - this.elapsed);
  }

  /**
   * Advances the game by `dt` seconds. Called once per frame.
   * When the match is over, it stops movement, attacks, damage,
   * spawns and scoring by simply doing nothing.
   */
  update(dt: number, input: PlayerInput): void {
    if (this.isOver) return;

    // Never simulate past the end of the match.
    const step = Math.min(dt, this.timeLeft);

    this.updatePlayer(step, input);
    this.updatePlayerWeapons(step, input);
    this.updateSpawning(step);
    this.updateEnemies(step);
    this.updateProjectiles(step);
    this.removeDestroyedEnemies();
    this.elapsed += step;

    if (this.player.health <= 0) {
      this.endReason = 'death';
      this.events.push({
        type: 'shipDestroyed',
        kind: 'player',
        position: { ...this.player.position },
        angle: this.player.angle,
        scored: false,
      });
    } else if (this.timeLeft <= 0) {
      this.endReason = 'time';
    }
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

  private createId(): number {
    return this.nextEntityId++;
  }

  // ---------------------------------------------------------------- player

  private updatePlayer(dt: number, input: PlayerInput): void {
    const { moveSpeed, turnSpeed } = this.config.player;
    const ship = this.player;

    // Rotation: angular speed (rad/s) multiplied by elapsed time (s).
    if (input.turnLeft) ship.angle -= turnSpeed * dt;
    if (input.turnRight) ship.angle += turnSpeed * dt;

    if (input.forward) this.moveForward(ship, moveSpeed, dt);

    this.keepShipInPlayableArea(ship);
  }

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
    const { cooldowns } = this.player;
    const { frontWeapon, sideWeapon } = this.config.player;

    for (const slot of WEAPON_SLOTS) {
      // Count the timer down, never below zero.
      cooldowns[slot] = Math.max(0, cooldowns[slot] - dt);
      if (!wantsToFire[slot] || cooldowns[slot] > 0) continue;

      const weapon = slot === 'front' ? frontWeapon : sideWeapon;
      this.fire(this.player, slot, weapon, 'player');
      cooldowns[slot] = weapon.cooldown;
    }
  }

  // --------------------------------------------------------- ship helpers

  /** Moves a ship in the direction it is facing. cos/sin give that direction. */
  private moveForward(ship: Ship, speed: number, dt: number): void {
    ship.position.x += Math.cos(ship.angle) * speed * dt;
    ship.position.y += Math.sin(ship.angle) * speed * dt;
  }

  /** Pushes a ship out of islands and keeps it fully inside the arena. */
  private keepShipInPlayableArea(ship: Ship): void {
    for (const obstacle of this.obstacles) {
      pushCircleOutOfRect(ship.position, ship.radius, obstacle);
    }
    const { width, height } = this.config.arena;
    ship.position.x = clamp(ship.position.x, ship.radius, width - ship.radius);
    ship.position.y = clamp(ship.position.y, ship.radius, height - ship.radius);
  }

  private fire(ship: Ship, slot: WeaponSlot, weapon: WeaponConfig, team: Team): void {
    const volley = createVolley({
      shipPosition: ship.position,
      shipAngle: ship.angle,
      slot,
      weapon,
      team,
      projectileRadius: this.config.projectileRadius,
      nextId: () => this.createId(),
    });

    this.projectiles.push(...volley.projectiles);
    if (team === 'player') this.playerProjectilesFired += volley.projectiles.length;
    this.events.push({
      type: 'shotFired',
      team,
      position: volley.muzzlePosition,
      angle: volley.angle,
    });
  }

  // --------------------------------------------------------------- enemies

  /** Counts down to the next spawn and creates an enemy when it is time. */
  private updateSpawning(dt: number): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = this.config.spawn.interval;

    if (this.enemies.length >= this.config.spawn.maxAlive) return;

    const kind = pickEnemyKind(this.spawnCount, this.config.spawn.chaserChance, this.random);
    const stats = kind === 'chaser' ? this.config.chaser : this.config.shooter;

    const position = findSpawnPosition({
      config: this.config,
      radius: stats.radius,
      playerPosition: this.player.position,
      obstacles: this.obstacles,
      ships: [this.player, ...this.enemies],
      random: this.random,
    });
    if (!position) return; // no safe place right now; try again next interval

    this.spawnCount += 1;
    this.enemies.push({
      id: this.createId(),
      kind,
      position,
      angle: angleTo(position, this.player.position), // born facing the player
      health: stats.maxHealth,
      maxHealth: stats.maxHealth,
      radius: stats.radius,
      // A full cooldown at birth gives the player time to react.
      fireCooldown: this.config.shooter.weapon.cooldown,
    });
  }

  private updateEnemies(dt: number): void {
    const alive = this.enemies.filter((enemy) => enemy.health > 0);

    // 1. Think and move.
    const decisions = alive.map((enemy) => {
      // Chasers sail around islands instead of pushing against them.
      const target = enemy.kind === 'chaser' ? this.chaserTarget(enemy) : this.player.position;
      const decision = decideEnemyAction(enemy, target, this.config, dt);
      const stats = enemy.kind === 'chaser' ? this.config.chaser : this.config.shooter;
      if (decision.moveForward) this.moveForward(enemy, stats.moveSpeed, dt);
      return decision;
    });

    // 2. Keep enemies from stacking on top of each other. Two passes, because
    //    pushing one pair apart can create a small overlap with a third ship.
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < alive.length; i++) {
        for (let j = i + 1; j < alive.length; j++) {
          const a = alive[i];
          const b = alive[j];
          separateCircles(a.position, a.radius, b.position, b.radius);
        }
      }
    }

    // 3. Collisions with the map, shooting and ramming.
    alive.forEach((enemy, index) => {
      this.keepShipInPlayableArea(enemy);

      if (enemy.kind === 'shooter') {
        this.updateShooterWeapon(enemy, decisions[index].wantsToFire, dt);
      } else {
        this.checkChaserImpact(enemy);
      }
    });

    // 4. Ships are solid: the player cannot sail through a Shooter, and a
    //    Shooter cannot sail through the player. Both are pushed apart by half
    //    the overlap, so they bump instead of overlapping. (A Chaser that
    //    touches the player explodes instead, handled above.)
    for (const enemy of alive) {
      if (enemy.kind !== 'shooter' || enemy.health <= 0) continue;
      separateCircles(this.player.position, this.player.radius, enemy.position, enemy.radius);
      this.keepShipInPlayableArea(enemy);
    }
    this.keepShipInPlayableArea(this.player);
  }

  private updateShooterWeapon(enemy: EnemyShip, wantsToFire: boolean, dt: number): void {
    const { weapon } = this.config.shooter;
    enemy.fireCooldown = Math.max(0, enemy.fireCooldown - dt);
    if (!wantsToFire || enemy.fireCooldown > 0) return;

    this.fire(enemy, 'front', weapon, 'enemy');
    enemy.fireCooldown = weapon.cooldown;
  }

  /**
   * Where a Chaser should steer this frame.
   *
   * If nothing is in the way, it goes straight at the player. If an island
   * blocks the straight line, it heads for a corner of that island instead
   * (a point just outside it), picking the corner that makes the shortest
   * trip to the player. Once it rounds the corner, the player is in sight
   * again and it attacks directly. This is a simple form of "steering around
   * obstacles", much lighter than a full path-finding algorithm.
   */
  private chaserTarget(chaser: EnemyShip): Vector2 {
    const target = this.player.position;
    // Slightly smaller than the real contact distance, so a ship that is
    // just touching the coast still "sees" past it.
    const blockedArea = (obstacle: Rect) => inflateRect(obstacle, chaser.radius - 1);

    // The blocking island closest to the Chaser (if any).
    let blocking: Rect | null = null;
    for (const obstacle of this.obstacles) {
      if (!segmentIntersectsRect(chaser.position, target, blockedArea(obstacle))) continue;
      if (!blocking || distanceToRect(chaser.position, obstacle) < distanceToRect(chaser.position, blocking)) {
        blocking = obstacle;
      }
    }
    if (!blocking) return target;

    // Candidate corners, a little outside the island so the ship clears it.
    const around = inflateRect(blocking, chaser.radius + CHASER_CORNER_MARGIN);
    const { width, height } = this.config.arena;
    const corners: Vector2[] = [
      { x: around.x, y: around.y },
      { x: around.x + around.width, y: around.y },
      { x: around.x, y: around.y + around.height },
      { x: around.x + around.width, y: around.y + around.height },
    ].map((corner) => ({
      x: clamp(corner.x, chaser.radius, width - chaser.radius),
      y: clamp(corner.y, chaser.radius, height - chaser.radius),
    }));

    let best: Vector2 | null = null;
    let bestCost = Infinity;
    for (const corner of corners) {
      // Skip a corner already reached, and corners hidden behind the island.
      if (distance(chaser.position, corner) < CHASER_CORNER_REACHED) continue;
      if (segmentIntersectsRect(chaser.position, corner, blockedArea(blocking))) continue;
      const cost = distance(chaser.position, corner) + distance(corner, target);
      if (cost < bestCost) {
        bestCost = cost;
        best = corner;
      }
    }
    return best ?? target;
  }

  /** A Chaser touching the player damages it and explodes (no points). */
  private checkChaserImpact(chaser: EnemyShip): void {
    const touching = circlesOverlap(
      chaser.position,
      chaser.radius,
      this.player.position,
      this.player.radius,
    );
    if (!touching) return;

    this.damagePlayer(this.config.chaser.contactDamage);
    chaser.health = 0;
    this.pushShipDestroyed(chaser, false); // a ram never scores
  }

  /** Removes enemies with no health left, so they stop acting and colliding. */
  private removeDestroyedEnemies(): void {
    this.enemies = this.enemies.filter((enemy) => enemy.health > 0);
  }

  // ---------------------------------------------------------------- damage

  private damagePlayer(amount: number): void {
    this.player.health = Math.max(0, this.player.health - amount);
  }

  /** Damages an enemy. If it is destroyed here, the player scores 1 point. */
  private damageEnemyByPlayer(enemy: EnemyShip, amount: number): void {
    if (enemy.health <= 0) return; // already destroyed: never score twice
    enemy.health = Math.max(0, enemy.health - amount);

    if (enemy.health === 0) {
      this.score += 1;
      this.pushShipDestroyed(enemy, true);
    }
  }

  private pushShipDestroyed(enemy: EnemyShip, scored: boolean): void {
    this.events.push({
      type: 'shipDestroyed',
      kind: enemy.kind,
      position: { ...enemy.position },
      angle: enemy.angle,
      scored,
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

    // 1. Hit an island: removed, with an impact effect.
    const hitIsland = this.obstacles.some((obstacle) =>
      circleIntersectsRect(projectile.position, projectile.radius, obstacle),
    );
    if (hitIsland) {
      this.pushImpact(projectile, 'island');
      return false;
    }

    // 2. Hit a ship of the other team: applies damage once and is removed.
    if (this.tryHitShip(projectile)) {
      this.pushImpact(projectile, 'ship');
      return false;
    }

    // 3. Reached its maximum range: falls into the water.
    if (projectile.remainingTime <= 0) {
      this.pushImpact(projectile, 'water');
      return false;
    }

    // 4. Left the arena: removed silently.
    const { width, height } = this.config.arena;
    const { x, y } = projectile.position;
    return x >= 0 && x <= width && y >= 0 && y <= height;
  }

  /** Player shots hit enemies; enemy shots hit the player. */
  private tryHitShip(projectile: Projectile): boolean {
    const hits = (ship: Ship) =>
      circlesOverlap(projectile.position, projectile.radius, ship.position, ship.radius);

    if (projectile.team === 'player') {
      const target = this.enemies.find((enemy) => enemy.health > 0 && hits(enemy));
      if (!target) return false;
      this.damageEnemyByPlayer(target, projectile.damage);
      return true;
    }

    if (!hits(this.player)) return false;
    this.damagePlayer(projectile.damage);
    return true;
  }

  private pushImpact(projectile: Projectile, surface: 'island' | 'water' | 'ship'): void {
    this.events.push({
      type: 'projectileImpact',
      position: { ...projectile.position },
      surface,
    });
  }
}
