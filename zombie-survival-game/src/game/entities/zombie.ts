import * as THREE from "three";
import { pick, range } from "../../sim/rng";
import type { ColliderWorld } from "../world/colliders";
import type { Terrain } from "../world/terrain";
import { Humanoid } from "./humanoid";

export type ZombieState = "idle" | "wander" | "investigate" | "chase" | "dead";

export interface NoiseEvent {
  pos: THREE.Vector3;
  radius: number;
  ttl: number;
}

export interface ZombieContext {
  dt: number;
  playerPos: THREE.Vector3;
  playerAlive: boolean;
  /** How far the player can be seen from right now, in metres. */
  visibility: number;
  /** Radius of the player's footstep noise this frame. */
  footstepRadius: number;
  noises: NoiseEvent[];
  colliders: ColliderWorld;
  terrain: Terrain;
  onAttack: (z: Zombie) => void;
}

const SKINS = ["#7d8a6f", "#8f8d78", "#6f7a66", "#9a8f7c", "#7a7f72"];
const SHIRTS = ["#4d4a44", "#5a3e34", "#3c4a55", "#6b6452", "#7a6b5a", "#3e3a36", "#58584f", "#6d3030"];
const PANTS = ["#2f3238", "#3a3530", "#46413a", "#2b3340", "#4a4a40"];

const RADIUS = 0.35;
const ATTACK_RANGE = 1.25;
const ATTACK_WINDUP = 0.65;

let nextId = 1;

export class Zombie {
  readonly id = nextId++;
  readonly model: Humanoid;
  readonly pos: THREE.Vector3;
  yaw = Math.random() * Math.PI * 2;
  state: ZombieState = "idle";
  hp = 100;
  /** Seconds since death, used for the fall animation and despawn. */
  deadTime = 0;
  private target = new THREE.Vector3();
  private stateTimer = range(Math.random, 1, 5);
  private senseTimer = Math.random() * 0.3;
  private lastSeen = 0;
  private attackTimer = 0;
  private stun = 0;
  private knock = new THREE.Vector3();
  private moveSpeed = 0;
  private readonly walkSpeed: number;
  private readonly runSpeed: number;
  private groanTimer = range(Math.random, 3, 12);

  constructor(position: THREE.Vector3, rng: () => number) {
    this.pos = position.clone();
    this.model = new Humanoid({
      skin: pick(rng, SKINS),
      shirt: pick(rng, SHIRTS),
      pants: pick(rng, PANTS),
      shoes: "#1e1c1a",
    });
    this.walkSpeed = range(rng, 0.5, 0.95);
    // Most shamble, a few are frighteningly quick.
    this.runSpeed = rng() < 0.12 ? range(rng, 3.6, 4.4) : range(rng, 1.9, 2.8);
    // Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: "#d8d2a0" });
    for (const x of [-0.06, 0.06]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.01), eyeMat);
      eye.position.set(x, 0.03, 0.131);
      this.model.head.add(eye);
    }
    this.model.root.position.copy(this.pos);
  }

  get alive() {
    return this.state !== "dead";
  }

  get radius() {
    return RADIUS;
  }

  /** True while it is actively hunting the player. */
  get hunting() {
    return this.state === "chase";
  }

  /** Called when it should groan; returns true at most every few seconds. */
  wantsToGroan(dt: number): boolean {
    this.groanTimer -= dt * (this.state === "chase" ? 2.5 : 1);
    if (this.groanTimer > 0) return false;
    this.groanTimer = range(Math.random, 5, 14);
    return true;
  }

  hit(damage: number, from: THREE.Vector3, knockback: number): boolean {
    if (!this.alive) return false;
    this.hp -= damage;
    this.stun = Math.max(this.stun, 0.25 + knockback * 0.1);
    this.attackTimer = 0;
    const away = this.pos.clone().sub(from).setY(0).normalize();
    this.knock.copy(away).multiplyScalar(knockback);
    this.model.setTint(0x551111);
    setTimeout(() => this.model.setTint(0x000000), 90);
    // Getting hit always tells it where you are.
    this.state = "chase";
    this.target.copy(from);
    this.lastSeen = 0;
    if (this.hp <= 0) {
      this.state = "dead";
      this.deadTime = 0;
      return true;
    }
    return false;
  }

  /** Alert this zombie to a position (noise, another zombie spotting you). */
  alert(pos: THREE.Vector3) {
    if (!this.alive || this.state === "chase") return;
    this.state = "investigate";
    this.target.copy(pos);
    this.stateTimer = 20;
  }

  update(ctx: ZombieContext) {
    const { dt } = ctx;
    if (!this.alive) {
      this.deadTime += dt;
      this.model.fall(this.deadTime * 2.2);
      return;
    }

    this.senseTimer -= dt;
    if (this.senseTimer <= 0) {
      this.senseTimer = 0.25;
      this.sense(ctx);
    }

    this.stateTimer -= dt;
    let speed = 0;
    const toPlayer = ctx.playerPos.clone().sub(this.pos).setY(0);
    const playerDist = toPlayer.length();

    switch (this.state) {
      case "idle":
        if (this.stateTimer <= 0) {
          this.state = "wander";
          this.stateTimer = range(Math.random, 4, 10);
          const a = Math.random() * Math.PI * 2;
          const r = range(Math.random, 4, 14);
          this.target.set(this.pos.x + Math.cos(a) * r, 0, this.pos.z + Math.sin(a) * r);
        }
        break;
      case "wander":
      case "investigate": {
        const arrived = this.pos.distanceTo(this.target.setY(this.pos.y)) < 1.2;
        if (arrived || this.stateTimer <= 0) {
          this.state = "idle";
          this.stateTimer = range(Math.random, 2, 7);
        } else {
          speed = this.state === "investigate" ? Math.max(this.walkSpeed * 1.6, 1.2) : this.walkSpeed;
        }
        break;
      }
      case "chase": {
        this.lastSeen += dt;
        // While it can still see you it tracks you exactly.
        if (this.lastSeen < 0.5) this.target.copy(ctx.playerPos);
        if (!ctx.playerAlive || this.lastSeen > 7) {
          // Lost them: shuffle over to where they were last seen.
          this.state = "investigate";
          this.stateTimer = 15;
          break;
        }
        if (playerDist < ATTACK_RANGE) {
          this.attackTimer += dt;
          if (this.attackTimer >= ATTACK_WINDUP) {
            this.attackTimer = -0.5; // recovery
            if (playerDist < ATTACK_RANGE + 0.35) ctx.onAttack(this);
          }
        } else {
          this.attackTimer = Math.min(this.attackTimer, 0);
          if (this.attackTimer < 0) this.attackTimer += dt;
          speed = this.runSpeed;
        }
        break;
      }
    }

    if (this.stun > 0) {
      this.stun -= dt;
      speed = 0;
    }

    // Steer towards the target.
    const dir = this.target.clone().sub(this.pos).setY(0);
    const dist = dir.length();
    if (dist > 0.05) {
      const desiredYaw = Math.atan2(dir.x, dir.z);
      let diff = desiredYaw - this.yaw;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.yaw += diff * Math.min(1, dt * 6);
    }
    this.moveSpeed += (speed - this.moveSpeed) * Math.min(1, dt * 4);
    if (this.moveSpeed > 0.01) {
      this.pos.x += Math.sin(this.yaw) * this.moveSpeed * dt;
      this.pos.z += Math.cos(this.yaw) * this.moveSpeed * dt;
    }
    if (this.knock.lengthSq() > 0.0001) {
      this.pos.addScaledVector(this.knock, dt);
      this.knock.multiplyScalar(Math.max(0, 1 - dt * 8));
    }

    const ground = ctx.terrain.height(this.pos.x, this.pos.z);
    ctx.colliders.resolveCylinder(this.pos, RADIUS, ground, 1.8);
    this.pos.y = ctx.terrain.height(this.pos.x, this.pos.z);

    const attacking = this.attackTimer > 0 ? this.attackTimer / ATTACK_WINDUP : undefined;
    this.model.animate(dt, this.moveSpeed, { zombie: true, attack: attacking });
    this.model.root.position.copy(this.pos);
    this.model.root.rotation.y = this.yaw;
  }

  private sense(ctx: ZombieContext) {
    if (!ctx.playerAlive) return;
    const dx = ctx.playerPos.x - this.pos.x;
    const dz = ctx.playerPos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);

    // Sight: a forward cone, much wider up close, blocked by walls.
    if (dist < ctx.visibility) {
      const facing = (Math.sin(this.yaw) * dx + Math.cos(this.yaw) * dz) / Math.max(dist, 0.001);
      const inCone = dist < 3 || facing > 0.25;
      if (
        inCone &&
        ctx.colliders.lineOfSight(this.pos.x, this.pos.y + 1.6, this.pos.z, ctx.playerPos.x, ctx.playerPos.y + 1.2, ctx.playerPos.z)
      ) {
        this.state = "chase";
        this.target.copy(ctx.playerPos);
        this.lastSeen = 0;
        return;
      }
    }

    if (this.state === "chase") {
      // Keep heading for the last known position; hearing them refreshes it.
      if (dist < ctx.footstepRadius * 1.5) {
        this.target.copy(ctx.playerPos);
        this.lastSeen = Math.min(this.lastSeen, 3);
      }
      return;
    }

    if (dist < ctx.footstepRadius) {
      this.alert(ctx.playerPos);
      return;
    }
    for (const n of ctx.noises) {
      if (this.pos.distanceTo(n.pos) < n.radius) {
        this.alert(n.pos);
        return;
      }
    }
  }
}
