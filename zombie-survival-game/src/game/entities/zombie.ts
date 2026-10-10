import * as THREE from "three";
import { mulberry32, pick, range } from "../../sim/rng";
import type { ZombieAccess } from "../../sim/barriers";
import { BARRIER, SENSES, WINDOW, ZOMBIE, sightRate } from "../../sim/tuning";
import type { ColliderWorld, RayHit } from "../world/colliders";
import type { Terrain } from "../world/terrain";
import { Humanoid } from "./humanoid";

export type ZombieState = "idle" | "wander" | "investigate" | "chase" | "down" | "dead";

export interface NoiseEvent {
  pos: THREE.Vector3;
  radius: number;
  ttl: number;
  /** Where hearers should head instead of pos (just past a barrier being pounded, so newcomers join in). */
  lure?: THREE.Vector3;
  /** The barrier making the noise: zombies already pounding on it don't keep themselves going with it. */
  barrierId?: number;
}

export interface Clamber {
  start: THREE.Vector3;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  dur: number;
  peak: number;
  id: number;
}

export interface ZombieContext {
  dt: number;
  playerPos: THREE.Vector3;
  playerVel: THREE.Vector3;
  playerAlive: boolean;
  playerMoving: boolean;
  playerSprinting: boolean;
  playerCrouching: boolean;
  /** How far the player can be seen from right now, in metres. */
  visibility: number;
  /** Radius of the player's footstep noise this frame. */
  footstepRadius: number;
  noises: NoiseEvent[];
  colliders: ColliderWorld;
  terrain: Terrain;
  /** Whether this zombie may attack now (only a few can at once). */
  canAttack: (z: Zombie) => boolean;
  onAttack: (z: Zombie) => void;
  /** Fired once when a zombie commits to chasing you. */
  onNotice: (z: Zombie) => void;
  /**
   * Ask for a path. Returns waypoints, null if unreachable, or undefined if
   * the per-frame pathfinding budget is used up (try again next frame).
   */
  findPath: (from: THREE.Vector3, to: THREE.Vector3) => [number, number][] | null | undefined;
  /** How it can get past a barrier it bumped into, from where it stands. */
  barrierContact: (z: Zombie, id: number) => ZombieAccess;
  /** The point on a barrier to face while pounding on it. */
  barrierPoint: (id: number, from: THREE.Vector3) => THREE.Vector3;
  /** The player is on this zombie's side of the barrier (no need to break through to get at them). */
  playerSameSide: (z: Zombie, id: number) => boolean;
  /** Whether it has one of the barrier's few places to swing from. */
  canBreach: (z: Zombie, id: number) => boolean;
  onBarrierHit: (z: Zombie, id: number) => void;
  onBarrierPush: (z: Zombie, id: number) => void;
  /** The door, window or boards between it and the player (first thing a reach would hit), if any. */
  barrierBetween: (z: Zombie) => { id: number; dist: number } | null;
  /** A climb through a window, or null if there's no room on the far side. */
  clamberPoints: (z: Zombie, id: number) => { from: THREE.Vector3; to: THREE.Vector3; dur: number; peak: number } | null;
}

// Grey-green, waxy skin; clothes from ordinary life, now filthy.
const SKINS = ["#8c9180", "#9a9584", "#7f8676", "#a39a88", "#868b7e", "#8d8478"];
const HAIR = ["#1f1a16", "#3a2c22", "#5a4a3a", "#7a6a55", "#2a2a2a", "#8a8070"];
const SHIRTS = ["#4d4a44", "#5a3e34", "#3c4a55", "#6b6452", "#7a6b5a", "#3e3a36", "#58584f", "#6d3030"];
const PANTS = ["#2f3238", "#3a3530", "#46413a", "#2b3340", "#4a4a40"];

const SENSE_INTERVAL = 0.2;
/** Feeler angles tried when the way ahead is blocked. */
const STEER_ANGLES = [0.6, -0.6, 1.2, -1.2, 1.8, -1.8];
/** Seconds down after being shoved off a window it was climbing. */
const SHOVED_DOWN = 1.2;
const probeHit: RayHit = { box: null };

let nextId = 1;

export class Zombie {
  readonly id = nextId++;
  readonly model: Humanoid;
  readonly pos: THREE.Vector3;
  yaw = Math.random() * Math.PI * 2;
  state: ZombieState = "idle";
  hp = ZOMBIE.hp;
  /** 0..1+ how sure it is that something is there. 1 = chase. */
  awareness = 0;
  /** Seconds since death, used for the fall animation and despawn. */
  deadTime = 0;
  readonly runner: boolean;
  private target = new THREE.Vector3();
  private stateTimer = range(Math.random, 1, 5);
  private senseTimer = Math.random() * SENSE_INTERVAL;
  private lastSeen = 0;
  private attackTimer = 0;
  private stun = 0;
  private downTimer = 0;
  private getUp = 0;
  private knock = new THREE.Vector3();
  private moveSpeed = 0;
  private readonly walkSpeed: number;
  private readonly chaseSpeed: number;
  private groanTimer = range(Math.random, 3, 12);
  /** Steering memory so it commits to going around an obstacle one way. */
  private steerBias = 0;
  private steerTimer = 0;
  private stuckTimer = 0;
  private lastPos = new THREE.Vector3();
  /** Route around buildings when the straight line is blocked. */
  private path: [number, number][] | null = null;
  private pathIdx = 0;
  private pathTimer = 0;
  private pathGoal = new THREE.Vector3(1e9, 0, 1e9);
  private directClear = true;
  private moveTarget = new THREE.Vector3();
  /** The barrier it's pounding on, if any. */
  breach: number | null = null;
  /** Climbing through a window. */
  clamber: Clamber | null = null;
  /** A window it found it can't climb through, and for how long to stop trying. */
  private noClimb = { id: -1, t: 0 };

  /**
   * Everything about who this zombie was (looks, build, gait, runner or not)
   * comes from `seed`, so a saved zombie comes back as the same person.
   */
  constructor(
    position: THREE.Vector3,
    readonly seed: number,
  ) {
    const rng = mulberry32(seed);
    this.pos = position.clone();
    this.lastPos.copy(this.pos);
    const r = rng();
    this.model = new Humanoid(
      { skin: pick(rng, SKINS), shirt: pick(rng, SHIRTS), pants: pick(rng, PANTS), shoes: "#1e1c1a", hair: pick(rng, HAIR) },
      {
        zombie: true,
        sex: rng() < 0.42 ? "f" : "m",
        build: r < 0.3 ? "slim" : r < 0.8 ? "average" : "heavy",
        sleeve: pick(rng, [0.3, 0.5, 0.95, 1]),
        hair: rng() < 0.15 ? 0 : 0.5 + rng() * 0.5,
        grime: 0.6 + rng() * 0.4,
        blood: 0.35 + rng() * 0.65,
        height: 0.93 + rng() * 0.12,
      },
    );
    this.walkSpeed = range(rng, ...ZOMBIE.wanderSpeed);
    this.runner = rng() < ZOMBIE.runnerChance;
    this.chaseSpeed = this.runner ? range(rng, ...ZOMBIE.runnerSpeed) : range(rng, ...ZOMBIE.chaseSpeed);
    this.model.root.position.copy(this.pos);
  }

  get alive() {
    return this.state !== "dead";
  }

  get radius() {
    return ZOMBIE.radius;
  }

  get hunting() {
    return this.state === "chase";
  }

  get isDown() {
    return this.state === "down";
  }

  /** True while winding up a swing at the player. */
  get attacking() {
    return this.attackTimer > 0;
  }

  wantsToGroan(dt: number): boolean {
    this.groanTimer -= dt * (this.state === "chase" ? 2.5 : 1);
    if (this.groanTimer > 0) return false;
    this.groanTimer = range(Math.random, 5, 14);
    return true;
  }

  /** Take a hit. Returns true if it died. */
  hit(damage: number, from: THREE.Vector3, knockback: number, knockdown = false): boolean {
    if (!this.alive) return false;
    this.hp -= damage;
    this.attackTimer = 0;
    const away = this.pos.clone().sub(from).setY(0).normalize();
    this.knock.copy(away).multiplyScalar(knockback);
    this.model.setTint(0x551111);
    this.model.flinch(1);
    setTimeout(() => this.model.setTint(0x000000), 90);
    this.awareness = Math.max(this.awareness, 1);
    this.target.copy(from);
    this.lastSeen = 0;
    if (this.hp <= 0) {
      this.state = "dead";
      this.deadTime = 0;
      if (this.clamber) this.pos.copy(this.clamber.start);
      this.clamber = null;
      return true;
    }
    if (this.clamber) {
      // Any hit mid-climb shoves it back out of the window.
      this.pos.copy(this.clamber.start);
      this.clamber = null;
      this.breach = null;
      this.state = "down";
      this.downTimer = SHOVED_DOWN;
      this.getUp = 0;
      this.knock.set(0, 0, 0);
      return false;
    }
    if (knockdown && this.state !== "down") {
      this.state = "down";
      this.downTimer = range(Math.random, ...ZOMBIE.downTime);
      this.getUp = 0;
    } else if (this.state !== "down") {
      this.state = "chase";
      this.stun = Math.max(this.stun, 0.3 + knockback * 0.06);
    }
    return false;
  }

  /** Heard something at pos. */
  alert(pos: THREE.Vector3, boost: number = SENSES.heardBoost) {
    if (!this.alive || this.state === "chase" || this.state === "down") return;
    this.awareness = Math.min(0.95, this.awareness + boost);
    this.state = "investigate";
    this.target.copy(pos);
    this.stateTimer = 20;
  }

  update(ctx: ZombieContext) {
    const { dt } = ctx;
    if (this.state === "dead") {
      this.deadTime += dt;
      this.model.fall(this.deadTime * 2.2);
      return;
    }

    if (this.state === "down") {
      this.updateDown(ctx);
      return;
    }

    if (this.clamber) {
      this.senseTimer -= dt;
      this.updateClamber(ctx);
      return;
    }

    this.senseTimer -= dt;
    if (this.senseTimer <= 0) {
      this.senseTimer = SENSE_INTERVAL;
      this.sense(ctx, SENSE_INTERVAL);
    }

    this.stateTimer -= dt;
    if (this.noClimb.t > 0) this.noClimb.t -= dt;
    let speed = 0;
    let faceOnly = false;
    const toPlayer = ctx.playerPos.clone().sub(this.pos).setY(0);
    const playerDist = toPlayer.length();

    if (this.breach !== null) {
      // Keep at it until the way is open, it can reach you, or it forgets why it came.
      const giveUp =
        this.state === "idle" ||
        this.state === "wander" ||
        ctx.barrierContact(this, this.breach) !== "blocking" ||
        (this.state === "chase" && (ctx.canAttack(this) || ctx.playerSameSide(this, this.breach)));
      if (giveUp) {
        this.breach = null;
        if (this.attackTimer > 0) this.attackTimer = 0;
      } else {
        this.updateBreach(ctx);
        return;
      }
    }

    switch (this.state) {
      case "idle":
        if (this.awareness > SENSES.suspicious) {
          // Something caught its eye: stand and stare.
          faceOnly = true;
        } else if (this.stateTimer <= 0) {
          this.state = "wander";
          this.stateTimer = range(Math.random, 4, 10);
          const a = Math.random() * Math.PI * 2;
          const r = range(Math.random, 4, 14);
          this.target.set(this.pos.x + Math.cos(a) * r, 0, this.pos.z + Math.sin(a) * r);
        }
        break;
      case "wander":
      case "investigate": {
        const arrived = Math.hypot(this.target.x - this.pos.x, this.target.z - this.pos.z) < 1.2;
        if (arrived || this.stateTimer <= 0) {
          this.state = "idle";
          this.stateTimer = range(Math.random, 2, 7);
        } else if (this.awareness > SENSES.suspicious && this.state === "investigate") {
          speed = ZOMBIE.investigateSpeed * 0.6; // creeping towards what it noticed
        } else {
          speed = this.state === "investigate" ? Math.max(this.walkSpeed * 1.4, ZOMBIE.investigateSpeed) : this.walkSpeed;
        }
        break;
      }
      case "chase": {
        this.lastSeen += dt;
        if (this.lastSeen < 0.5) this.target.copy(ctx.playerPos);
        if (!ctx.playerAlive || this.lastSeen > ZOMBIE.loseTrackAfter) {
          this.state = "investigate";
          this.stateTimer = 15;
          this.awareness = 0.6;
          break;
        }
        const allowed = ctx.canAttack(this);
        if (playerDist < ZOMBIE.attackRange && allowed) {
          this.attackTimer += dt;
          faceOnly = true;
          if (this.attackTimer >= ZOMBIE.attackWindup) {
            this.attackTimer = -ZOMBIE.attackRecovery;
            if (playerDist < ZOMBIE.attackRange + 0.35) ctx.onAttack(this);
          }
        } else {
          if (this.attackTimer > 0) this.attackTimer = 0;
          if (this.attackTimer < 0) this.attackTimer = Math.min(0, this.attackTimer + dt);
          const between = !allowed && playerDist < ZOMBIE.attackRange + 0.7 ? ctx.barrierBetween(this) : null;
          if (between && between.dist > ZOMBIE.radius + BARRIER.engageReach) {
            // You're just behind a door or glass: walk into it (the feeler will engage it).
            speed = this.chaseSpeed;
          } else if (between && this.onBarrier(ctx, between.id)) {
            // Close enough: go at what's in the way instead of waiting.
            speed = 0;
            faceOnly = true;
          } else if (!allowed && playerDist < ZOMBIE.attackRange + 0.7) {
            // Crowd behind the ones already on you.
            speed = 0;
            faceOnly = true;
          } else {
            speed = this.chaseSpeed * (playerDist < ZOMBIE.lungeRange && this.lastSeen < 0.5 ? ZOMBIE.lungeFactor : 1);
          }
        }
        break;
      }
    }

    if (this.stun > 0) {
      this.stun -= dt;
      speed = 0;
    }

    this.updateRoute(ctx, speed > 0 && !faceOnly);
    this.steer(ctx, speed, faceOnly);
    this.finishMove(ctx, faceOnly ? 0 : speed);

    const windup = this.attackTimer > 0 ? this.attackTimer / ZOMBIE.attackWindup : undefined;
    this.model.animate(dt, this.moveSpeed, { zombie: true, attack: windup });
    this.model.root.position.copy(this.pos);
    this.model.root.rotation.y = this.yaw;
  }

  /** Pound on the barrier: one blow per attack cycle if it has a place to swing from, otherwise crowd and wait. */
  private updateBreach(ctx: ZombieContext) {
    const { dt } = ctx;
    const id = this.breach!;
    if (this.state === "chase") {
      this.lastSeen += dt;
      if (this.lastSeen < 0.5) this.target.copy(ctx.playerPos);
      if (!ctx.playerAlive || this.lastSeen > ZOMBIE.loseTrackAfter) {
        this.state = "investigate";
        this.stateTimer = 15;
        this.awareness = 0.6;
      }
    } else if (this.stateTimer <= 0) {
      // Investigating and heard nothing more: it loses interest.
      this.state = "idle";
      this.stateTimer = range(Math.random, 2, 7);
      this.breach = null;
    }
    const face = ctx.barrierPoint(id, this.pos);
    let diff = Math.atan2(face.x - this.pos.x, face.z - this.pos.z) - this.yaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.yaw += diff * Math.min(1, dt * 6);
    if (this.breach !== null && ctx.canBreach(this, id) && this.stun <= 0) {
      this.attackTimer += dt;
      if (this.attackTimer >= ZOMBIE.attackWindup) {
        this.attackTimer = -ZOMBIE.attackRecovery;
        ctx.onBarrierHit(this, id);
      }
    } else if (this.attackTimer > 0) {
      this.attackTimer = 0;
    } else if (this.attackTimer < 0) {
      this.attackTimer = Math.min(0, this.attackTimer + dt);
    }
    if (this.stun > 0) this.stun -= dt;
    this.finishMove(ctx, 0);
    const windup = this.attackTimer > 0 ? this.attackTimer / ZOMBIE.attackWindup : undefined;
    this.model.animate(dt, this.moveSpeed, { zombie: true, attack: windup });
    this.model.root.position.copy(this.pos);
    this.model.root.rotation.y = this.yaw;
  }

  /** Up onto the sill and over, ignoring collision. */
  private updateClamber(ctx: ZombieContext) {
    const c = this.clamber!;
    c.t += ctx.dt;
    const u = Math.min(1, c.t / c.dur);
    const lead = 0.25;
    if (u < lead) {
      this.pos.lerpVectors(c.start, c.from, u / lead);
      this.pos.y = ctx.terrain.height(this.pos.x, this.pos.z);
    } else {
      const k = (u - lead) / (1 - lead);
      this.pos.lerpVectors(c.from, c.to, k);
      this.pos.y = ctx.terrain.height(this.pos.x, this.pos.z) + Math.sin(Math.PI * k) * c.peak;
    }
    this.yaw = Math.atan2(c.to.x - c.from.x, c.to.z - c.from.z);
    if (u >= 1) {
      this.pos.copy(c.to);
      this.pos.y = ctx.terrain.height(c.to.x, c.to.z);
      this.clamber = null;
      this.lastPos.copy(this.pos);
      this.path = null;
    }
    this.moveSpeed = 0;
    this.model.animate(ctx.dt, 0.8, { zombie: true });
    this.model.root.position.copy(this.pos);
    this.model.root.rotation.y = this.yaw;
  }

  /** It walked into a door or window. Returns true if that changed what it's doing. */
  private onBarrier(ctx: ZombieContext, id: number): boolean {
    const access = ctx.barrierContact(this, id);
    if (access === "passable") return false;
    if (this.state === "wander") {
      // Nothing worth breaking in for: turn back.
      this.state = "idle";
      this.stateTimer = range(Math.random, 2, 5);
      return true;
    }
    if (access === "pushable") {
      ctx.onBarrierPush(this, id);
      return true;
    }
    if (access === "climbable") {
      if (this.noClimb.id === id && this.noClimb.t > 0) return false;
      const c = WINDOW.zombiesClimb ? ctx.clamberPoints(this, id) : null;
      if (!c) {
        // Nowhere to land: stop trying this one for a while and find another way.
        this.noClimb = { id, t: 8 };
        this.path = null;
        return false;
      }
      this.clamber = { start: this.pos.clone(), ...c, t: 0, id };
      this.breach = null;
      return true;
    }
    this.breach = id;
    this.stuckTimer = 0;
    return true;
  }

  private updateDown(ctx: ZombieContext) {
    const { dt } = ctx;
    this.downTimer -= dt;
    if (this.downTimer > 0) {
      this.getUp = Math.min(1, this.getUp + dt * 4);
      this.model.fall(this.getUp);
    } else {
      // Clamber back up over about a second.
      this.getUp -= dt * 1.1;
      this.model.fall(Math.max(0, this.getUp));
      if (this.getUp <= 0) {
        this.model.fall(0);
        this.state = "chase";
        this.lastSeen = 0;
        this.stun = 0.2;
      }
    }
    if (this.knock.lengthSq() > 0.0001) {
      this.pos.addScaledVector(this.knock, dt);
      this.knock.multiplyScalar(Math.max(0, 1 - dt * 8));
      ctx.colliders.resolveCylinder(this.pos, ZOMBIE.radius, this.pos.y, 0.6);
      this.pos.y = ctx.terrain.height(this.pos.x, this.pos.z);
    }
    this.model.root.position.copy(this.pos);
  }

  /** Decide where to head right now: straight at the target, or along a path. */
  private updateRoute(ctx: ZombieContext, moving: boolean) {
    this.moveTarget.copy(this.target);
    if (!moving) return;
    this.pathTimer -= ctx.dt;
    const dist = Math.hypot(this.target.x - this.pos.x, this.target.z - this.pos.z);
    if (this.senseTimer >= SENSE_INTERVAL - ctx.dt || this.path) {
      // Refresh "can I walk straight there?" a few times a second.
      if (this.senseTimer >= SENSE_INTERVAL - ctx.dt) {
        const dx = (this.target.x - this.pos.x) / Math.max(dist, 1e-3);
        const dz = (this.target.z - this.pos.z) / Math.max(dist, 1e-3);
        this.directClear = ctx.colliders.raycast(this.pos.x, this.pos.y + 0.6, this.pos.z, dx, 0, dz, dist) >= dist - 0.3;
      }
    }
    if (this.directClear || dist < 1.5) {
      this.path = null;
      return;
    }
    const goalMoved = this.pathGoal.distanceTo(this.target) > 2.5;
    if (!this.path || this.pathTimer <= 0 || goalMoved) {
      const result = ctx.findPath(this.pos, this.target);
      if (result !== undefined) {
        this.path = result;
        this.pathIdx = 0;
        this.pathTimer = 1.5;
        this.pathGoal.copy(this.target);
      }
    }
    if (!this.path || !this.path.length) return;
    let wp = this.path[this.pathIdx];
    while (wp && Math.hypot(wp[0] - this.pos.x, wp[1] - this.pos.z) < 0.6 && this.pathIdx < this.path.length - 1) {
      this.pathIdx++;
      wp = this.path[this.pathIdx];
    }
    if (wp) this.moveTarget.set(wp[0], this.pos.y, wp[1]);
  }

  /** Turn towards where it's heading, feeling around anything the path missed. */
  private steer(ctx: ZombieContext, speed: number, faceOnly: boolean) {
    const { dt } = ctx;
    const dir = (faceOnly ? this.target : this.moveTarget).clone().sub(this.pos).setY(0);
    const dist = dir.length();
    if (dist < 0.05) return;
    let desired = Math.atan2(dir.x, dir.z);

    if (speed > 0 && !faceOnly) {
      this.steerTimer -= dt;
      const probe = Math.min(1.2, dist);
      const blocked = (a: number) =>
        ctx.colliders.raycast(this.pos.x, this.pos.y + 0.6, this.pos.z, Math.sin(a), 0, Math.cos(a), probe + ZOMBIE.radius) < probe + ZOMBIE.radius - 0.05;
      // The straight-ahead feeler also says what it touched: a door or window means deal with it.
      const ahead = ctx.colliders.raycast(
        this.pos.x,
        this.pos.y + 0.6,
        this.pos.z,
        Math.sin(desired),
        0,
        Math.cos(desired),
        probe + ZOMBIE.radius,
        false,
        probeHit,
      );
      const barrier = probeHit.box?.barrierId;
      if (barrier !== undefined && ahead < ZOMBIE.radius + BARRIER.engageReach && this.onBarrier(ctx, barrier)) return;
      const aheadBlocked = ahead < probe + ZOMBIE.radius - 0.05;
      if (this.steerTimer > 0 && this.steerBias !== 0 && aheadBlocked) {
        desired += this.steerBias;
      } else if (aheadBlocked) {
        for (const off of STEER_ANGLES) {
          if (!blocked(desired + off)) {
            this.steerBias = off;
            this.steerTimer = 0.8;
            desired += off;
            break;
          }
        }
      } else {
        this.steerBias = 0;
      }
    }

    let diff = desired - this.yaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.yaw += diff * Math.min(1, dt * (this.state === "chase" ? 7 : 4));
  }

  private finishMove(ctx: ZombieContext, target: number) {
    const { dt } = ctx;
    const wantsToMove = target > 0;
    this.moveSpeed += (target - this.moveSpeed) * Math.min(1, dt * (target > this.moveSpeed ? 3 : 6));
    if (this.moveSpeed > 0.01) {
      this.pos.x += Math.sin(this.yaw) * this.moveSpeed * dt;
      this.pos.z += Math.cos(this.yaw) * this.moveSpeed * dt;
    }
    if (this.knock.lengthSq() > 0.0001) {
      this.pos.addScaledVector(this.knock, dt);
      this.knock.multiplyScalar(Math.max(0, 1 - dt * 8));
    }
    ctx.colliders.resolveCylinder(this.pos, ZOMBIE.radius, this.pos.y, 1.8);
    this.pos.y = ctx.terrain.height(this.pos.x, this.pos.z);

    // Stuck: trying to move but going nowhere. Pick a side and slide off.
    const moved = this.pos.distanceTo(this.lastPos);
    this.lastPos.copy(this.pos);
    if (wantsToMove && moved < this.moveSpeed * dt * 0.25) {
      this.stuckTimer += dt;
      if (this.stuckTimer > 0.8) {
        this.steerBias = (Math.random() < 0.5 ? -1 : 1) * 1.5;
        this.steerTimer = 1.2;
        this.yaw += this.steerBias * 0.5;
        this.stuckTimer = 0;
      }
    } else {
      this.stuckTimer = 0;
    }
  }

  private sense(ctx: ZombieContext, interval: number) {
    if (!ctx.playerAlive) return;
    const dx = ctx.playerPos.x - this.pos.x;
    const dz = ctx.playerPos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const facingCos = (Math.sin(this.yaw) * dx + Math.cos(this.yaw) * dz) / Math.max(dist, 0.001);
    const los =
      dist <= ctx.visibility &&
      ctx.colliders.lineOfSight(this.pos.x, this.pos.y + 1.6, this.pos.z, ctx.playerPos.x, ctx.playerPos.y + (ctx.playerCrouching ? 0.9 : 1.3), ctx.playerPos.z);
    const rate = sightRate({
      distance: dist,
      visibility: ctx.visibility,
      facingCos,
      lineOfSight: los,
      moving: ctx.playerMoving,
      sprinting: ctx.playerSprinting,
      crouching: ctx.playerCrouching,
    });

    if (rate > 0) {
      this.awareness = rate === Infinity ? 1.2 : this.awareness + rate * interval;
      if (this.state === "chase") {
        this.lastSeen = 0;
        this.target.copy(ctx.playerPos);
      } else if (this.awareness >= 1) {
        this.state = "chase";
        this.lastSeen = 0;
        this.target.copy(ctx.playerPos);
        ctx.onNotice(this);
      } else if (this.awareness > SENSES.suspicious) {
        // Look towards the movement it half-saw.
        this.target.copy(ctx.playerPos);
        if (this.state === "wander") {
          this.state = "investigate";
          this.stateTimer = 12;
        }
      }
      return;
    }

    if (this.state !== "chase") this.awareness = Math.max(0, this.awareness - SENSES.decay * interval);

    if (this.state === "chase") {
      // Lost sight. Hearing you refreshes where you are; otherwise guess where you went.
      if (dist < ctx.footstepRadius * 1.3) {
        this.target.copy(ctx.playerPos);
        this.lastSeen = Math.min(this.lastSeen, 2);
      } else if (this.lastSeen > 0.4 && this.lastSeen < 0.6) {
        this.target.addScaledVector(ctx.playerVel, ZOMBIE.predictSeconds);
      }
      return;
    }

    if (dist < ctx.footstepRadius) {
      this.alert(ctx.playerPos);
      return;
    }
    for (const n of ctx.noises) {
      // While pounding on something, other zombies' pounding doesn't keep it going (only you can).
      if (n.barrierId !== undefined && this.breach !== null) continue;
      const nd = this.pos.distanceTo(n.pos);
      if (nd < n.radius) {
        // Close, loud noises make it certain something's there.
        this.alert(n.lure ?? n.pos, nd < n.radius * 0.4 ? 0.9 : SENSES.heardBoost);
        return;
      }
    }
  }
}
