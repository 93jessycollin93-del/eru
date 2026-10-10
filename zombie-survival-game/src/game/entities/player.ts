import * as THREE from "three";
import type { Input } from "../input";
import type { ColliderWorld } from "../world/colliders";
import type { Terrain } from "../world/terrain";
import { WORLD_HALF } from "../world/terrain";
import { aimSway, createBody, mobility, spendStamina, type BodyState } from "../../sim/body";
import { FIREARM, FOOTSTEPS, MOVE, STAMINA } from "../../sim/tuning";
import { Humanoid } from "./humanoid";

const RADIUS = 0.35;
const HEIGHT = 1.8;
const MOUSE_SENS = 0.0022;

export type Gait = "still" | "crouch" | "walk" | "jog" | "sprint";

export class Player {
  readonly model = new Humanoid(
    { skin: "#c49a78", shirt: "#5a6148", pants: "#3e4a5c", shoes: "#3a3128", hair: "#3b2e24" },
    { build: "average", sex: "m", sleeve: 1, hair: 0.85, grime: 0.2 },
  );
  readonly pos = new THREE.Vector3();
  /** Horizontal velocity (m/s). */
  readonly vel = new THREE.Vector3();
  private velY = 0;
  private grounded = true;
  /** Camera yaw / pitch. Body yaw follows separately. */
  yaw = Math.PI / 2;
  pitch = -0.1;
  bodyYaw = Math.PI / 2;

  /** All physiology lives in the engine-agnostic body simulation. */
  body: BodyState = createBody();
  crouching = false;
  aiming = false;
  sprinting = false;
  gait: Gait = "still";
  /** Radius zombies can hear footsteps from this frame. */
  footstepRadius = 0;
  /** 0..1 attack animation progress, driven by the game. */
  attackAnim = 0;
  overweight = false;
  /** 0 (hip) .. 1 (fully aimed), eases in over ~0.2 s. */
  aimProgress = 0;

  /** Scripted climb through a window: input, gravity and collision are off until it ends. */
  private climb: { start: THREE.Vector3; via: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; peak: number } | null = null;

  private camPos = new THREE.Vector3();
  private recoil = { pitch: 0, yaw: 0 };
  private shake = 0;
  private bobPhase = 0;
  private swayTime = Math.random() * 10;

  get speed() {
    return Math.hypot(this.vel.x, this.vel.z);
  }

  get traversing() {
    return this.climb !== null;
  }

  /**
   * Climb from where you stand to `via` (lined up with the opening), then over
   * the sill to `to`, peaking `peak` metres up, taking `dur` seconds.
   */
  traverse(via: THREE.Vector3, to: THREE.Vector3, dur: number, peak: number) {
    this.climb = { start: this.pos.clone(), via: via.clone(), to: to.clone(), t: 0, dur, peak };
    this.vel.set(0, 0, 0);
    this.velY = 0;
    this.crouching = false;
  }

  private updateClimb(dt: number, terrain: Terrain) {
    const c = this.climb!;
    c.t += dt;
    const u = Math.min(1, c.t / c.dur);
    // The first fifth lines you up with the opening; the rest is up, over and down.
    const lead = 0.2;
    if (u < lead) {
      this.pos.lerpVectors(c.start, c.via, u / lead);
      this.pos.y = terrain.height(this.pos.x, this.pos.z);
    } else {
      const k = (u - lead) / (1 - lead);
      this.pos.lerpVectors(c.via, c.to, k);
      this.pos.y = terrain.height(this.pos.x, this.pos.z) + Math.sin(Math.PI * k) * c.peak;
    }
    const dir = c.to.clone().sub(c.via);
    this.bodyYaw = Math.atan2(dir.x, dir.z);
    this.footstepRadius = 0;
    this.gait = "crouch";
    this.model.animate(dt, 1.2, { crouch: true });
    this.model.root.position.copy(this.pos);
    this.model.root.rotation.y = this.bodyYaw;
    if (u >= 1) {
      this.pos.copy(c.to);
      this.pos.y = terrain.height(c.to.x, c.to.z);
      this.climb = null;
      this.grounded = true;
    }
  }

  reset(spawn: THREE.Vector3) {
    this.pos.copy(spawn);
    this.vel.set(0, 0, 0);
    this.velY = 0;
    this.body = createBody();
    this.crouching = false;
    this.climb = null;
    this.yaw = this.bodyYaw = Math.PI / 2;
    this.pitch = -0.1;
    this.recoil.pitch = this.recoil.yaw = 0;
    this.shake = 0;
    this.model.fall(0);
    this.model.root.visible = true;
    this.camPos.set(spawn.x - 4, spawn.y + 2, spawn.z);
  }

  /** Kick the camera up for a shot; most of it springs back. */
  addRecoil() {
    this.recoil.pitch += FIREARM.recoilPitch;
    this.recoil.yaw += (Math.random() - 0.5) * 2 * FIREARM.recoilYaw;
    // The part that doesn't return stays in your aim, like real muzzle climb.
    this.pitch += FIREARM.recoilPitch * (1 - FIREARM.recoilReturn);
  }

  addShake(amount: number) {
    this.shake = Math.min(1, this.shake + amount);
  }

  /** Being grabbed or hit bleeds off your momentum. */
  slow(factor: number) {
    this.vel.multiplyScalar(factor);
  }

  update(dt: number, input: Input, colliders: ColliderWorld, terrain: Terrain, attacking: boolean) {
    const b = this.body;
    const sens = MOUSE_SENS * (this.aiming ? 0.55 : 1);
    this.yaw -= input.mouseDX * sens;
    this.pitch = Math.max(-1.2, Math.min(0.9, this.pitch - input.mouseDY * sens));
    if (this.climb) {
      this.updateClimb(dt, terrain);
      return;
    }

    if (input.wasPressed("KeyC") || input.wasPressed("ControlLeft")) this.crouching = !this.crouching;
    this.aiming = input.rightDown;
    this.aimProgress += ((this.aiming ? 1 : 0) - this.aimProgress) * Math.min(1, dt * 11);

    // Input relative to the camera.
    let fwd = 0;
    let side = 0;
    if (input.isDown("KeyW") || input.isDown("ArrowUp")) fwd += 1;
    if (input.isDown("KeyS") || input.isDown("ArrowDown")) fwd -= 1;
    if (input.isDown("KeyD") || input.isDown("ArrowRight")) side += 1;
    if (input.isDown("KeyA") || input.isDown("ArrowLeft")) side -= 1;
    const moving = fwd !== 0 || side !== 0;

    const wantsSprint = input.isDown("ShiftLeft") || input.isDown("ShiftRight");
    const wantsWalk = input.isDown("AltLeft") || input.isDown("AltRight");
    this.sprinting = wantsSprint && fwd > 0 && !this.aiming && !this.overweight && !b.winded && b.stamina > 0 && !this.crouching;

    let top: number = this.crouching ? MOVE.crouch : this.sprinting ? MOVE.sprint : wantsWalk ? MOVE.walk : MOVE.jog;
    if (this.aiming) top = Math.min(top, MOVE.aim);
    if (this.overweight) top *= MOVE.overweightFactor;
    top *= mobility(b);

    // Backing up and strafing are slower than moving forwards.
    const dirFactor = fwd < 0 ? MOVE.backwardFactor : fwd === 0 && side !== 0 ? MOVE.strafeFactor : 1;
    const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new THREE.Vector3(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
    const wish = forward.multiplyScalar(fwd).addScaledVector(right, side);
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(top * dirFactor);

    // Accelerate towards the wished velocity; momentum makes movement feel weighty.
    const dv = wish.sub(this.vel);
    const rate = (dv.dot(this.vel) < 0 || !moving ? MOVE.decel : MOVE.accel) * dt;
    const dvLen = dv.length();
    if (dvLen > rate) dv.multiplyScalar(rate / dvLen);
    if (this.grounded) this.vel.add(dv);
    else this.vel.addScaledVector(dv, 0.15); // little air control

    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;

    // Jump and gravity
    const ground = Math.max(terrain.height(this.pos.x, this.pos.z), colliders.supportHeight(this.pos.x, this.pos.z, this.pos.y));
    if (input.wasPressed("Space") && this.grounded && !b.winded && b.stamina > STAMINA.jumpCost) {
      this.velY = MOVE.jumpVelocity;
      this.grounded = false;
      spendStamina(b, STAMINA.jumpCost);
      this.crouching = false;
    }
    this.velY -= MOVE.gravity * dt;
    this.pos.y += this.velY * dt;
    let landedHard = false;
    if (this.pos.y <= ground) {
      landedHard = !this.grounded && this.velY < -6;
      if (landedHard) this.addShake(0.25);
      this.pos.y = ground;
      this.velY = 0;
      this.grounded = true;
    } else if (this.pos.y > ground + 0.05) {
      this.grounded = false;
    }

    const before = this.pos.clone();
    colliders.resolveCylinder(this.pos, RADIUS, this.pos.y, this.crouching ? 1.3 : HEIGHT);
    // Walls absorb the velocity going into them, so you slide instead of sticking.
    const push = this.pos.clone().sub(before).setY(0);
    if (push.lengthSq() > 1e-8) {
      const n = push.normalize();
      const into = this.vel.dot(n);
      if (into < 0) this.vel.addScaledVector(n, -into);
    }
    const lim = WORLD_HALF - 5;
    this.pos.x = Math.max(-lim, Math.min(lim, this.pos.x));
    this.pos.z = Math.max(-lim, Math.min(lim, this.pos.z));

    const speed = this.speed;
    this.gait = speed < 0.2 ? "still" : this.crouching ? "crouch" : this.sprinting ? "sprint" : speed <= MOVE.walk + 0.15 ? "walk" : "jog";
    this.footstepRadius = FOOTSTEPS[this.gait];
    if (landedHard) this.footstepRadius = Math.max(this.footstepRadius, FOOTSTEPS.landing);

    // Body faces where you aim; otherwise it turns towards the direction of travel.
    let desired = this.bodyYaw;
    if (this.aiming || attacking) desired = this.yaw;
    else if (speed > 0.3) desired = Math.atan2(this.vel.x, this.vel.z);
    let diff = desired - this.bodyYaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.bodyYaw += diff * Math.min(1, dt * (this.aiming || attacking ? 20 : 9));

    this.model.animate(dt, speed, {
      crouch: this.crouching,
      aim: this.aiming,
      attack: this.attackAnim > 0 ? this.attackAnim : undefined,
    });
    this.model.root.position.copy(this.pos);
    this.model.root.rotation.y = this.bodyYaw;

    // Recoil springs back; shake fades.
    const k = Math.min(1, dt * FIREARM.recoilRecoverPerSec);
    this.recoil.pitch -= this.recoil.pitch * k;
    this.recoil.yaw -= this.recoil.yaw * k;
    this.shake = Math.max(0, this.shake - dt * 2.5);
    this.bobPhase += dt * speed * 2.1;
    this.swayTime += dt;
  }

  /** 0 = resting, 1 = sprinting. Feeds the body simulation. */
  get exertion() {
    return this.sprinting ? 1 : this.gait === "jog" ? 0.3 : this.gait === "still" ? 0 : 0.15;
  }

  /** Over-the-shoulder camera with collision so walls never block the view. */
  updateCamera(camera: THREE.PerspectiveCamera, colliders: ColliderWorld, dt: number) {
    const a = this.aimProgress;
    const dist = THREE.MathUtils.lerp(3.1, 1.45, a);
    const sideOff = THREE.MathUtils.lerp(0.8, 0.62, a);
    const speed = this.speed;
    // Gentle head bob, stronger when running, damped when aiming.
    const bob = Math.sin(this.bobPhase * 2) * Math.min(0.035, speed * 0.006) * (1 - 0.7 * a);
    const pivot = new THREE.Vector3(this.pos.x, this.pos.y + (this.crouching ? 1.25 : 1.62) + bob, this.pos.z);

    // Weapon sway: breathing, plus whatever the body adds (pain, panic, exhaustion).
    const sway = aimSway(this.body) * (1 + (100 - this.body.stamina) / 120);
    const swayAmp = 0.0016 * sway * a;
    const swayYaw = Math.sin(this.swayTime * 0.9) * swayAmp + Math.sin(this.swayTime * 2.3) * swayAmp * 0.4;
    const swayPitch = Math.sin(this.swayTime * 1.3 + 1) * swayAmp * 0.8;
    const shakeAmt = this.shake * this.shake * 0.03;
    const yaw = this.yaw + this.recoil.yaw + swayYaw + (Math.random() - 0.5) * shakeAmt;
    const pitch = this.pitch + this.recoil.pitch + swayPitch + (Math.random() - 0.5) * shakeAmt;

    const look = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    const right = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
    const shoulder = pivot.clone().addScaledVector(right, sideOff);
    const sideHit = colliders.raycast(pivot.x, pivot.y, pivot.z, right.x, 0, right.z, sideOff + 0.2);
    if (sideHit < sideOff + 0.2) shoulder.copy(pivot).addScaledVector(right, Math.max(0, sideHit - 0.2));
    const back = look.clone().negate();
    const hit = colliders.raycast(shoulder.x, shoulder.y, shoulder.z, back.x, back.y, back.z, dist + 0.3);
    const d = Math.max(0.3, Math.min(dist, hit - 0.3));
    const desired = shoulder.clone().addScaledVector(back, d);
    desired.y = Math.max(desired.y, this.pos.y + 0.3);

    this.camPos.lerp(desired, Math.min(1, dt * 22));
    if (this.camPos.distanceTo(desired) > d * 0.6) this.camPos.copy(desired);
    camera.position.copy(this.camPos);
    camera.lookAt(shoulder.clone().addScaledVector(look, 20));
    const fov = THREE.MathUtils.lerp(70, 48, a) + Math.min(4, Math.max(0, speed - MOVE.jog) * 1.4);
    if (Math.abs(camera.fov - fov) > 0.05) {
      camera.fov += (fov - camera.fov) * Math.min(1, dt * 10);
      camera.updateProjectionMatrix();
    }
  }
}
