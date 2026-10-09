import * as THREE from "three";
import type { Input } from "../input";
import type { ColliderWorld } from "../world/colliders";
import type { Terrain } from "../world/terrain";
import { WORLD_HALF } from "../world/terrain";
import { createBody, mobility, type BodyState } from "../../sim/body";
import { Humanoid } from "./humanoid";

const RADIUS = 0.35;
const HEIGHT = 1.8;
const WALK = 2.7;
const SPRINT = 5.4;
const CROUCH = 1.4;
const GRAVITY = 16;
const JUMP = 5.0;
const MOUSE_SENS = 0.0022;

export class Player {
  readonly model = new Humanoid({ skin: "#c9a27e", shirt: "#6b7558", pants: "#43546e", shoes: "#3a3128" });
  readonly pos = new THREE.Vector3();
  private velY = 0;
  private grounded = true;
  /** Camera yaw / pitch. Body yaw follows separately. */
  yaw = Math.PI / 2;
  pitch = -0.1;
  bodyYaw = Math.PI / 2;
  speed = 0;

  /** All physiology lives in the engine-agnostic body simulation. */
  body: BodyState = createBody();
  crouching = false;
  aiming = false;
  sprinting = false;
  /** Radius zombies can hear footsteps from this frame. */
  footstepRadius = 0;
  /** 0..1 attack animation progress, driven by the game. */
  attackAnim = 0;
  overweight = false;

  private camPos = new THREE.Vector3();
  private camAim = 0;

  reset(spawn: THREE.Vector3) {
    this.pos.copy(spawn);
    this.velY = 0;
    this.body = createBody();
    this.crouching = false;
    this.yaw = this.bodyYaw = Math.PI / 2;
    this.pitch = -0.1;
    this.model.body.rotation.set(0, 0, 0);
    this.model.body.position.set(0, 0, 0);
    this.camPos.set(spawn.x - 4, spawn.y + 2, spawn.z);
  }

  update(dt: number, input: Input, colliders: ColliderWorld, terrain: Terrain, attacking: boolean) {
    this.yaw -= input.mouseDX * MOUSE_SENS * (this.aiming ? 0.6 : 1);
    this.pitch = Math.max(-1.2, Math.min(0.9, this.pitch - input.mouseDY * MOUSE_SENS * (this.aiming ? 0.6 : 1)));

    if (input.wasPressed("KeyC") || input.wasPressed("ControlLeft")) this.crouching = !this.crouching;
    this.aiming = input.rightDown;

    const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new THREE.Vector3(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
    const move = new THREE.Vector3();
    if (input.isDown("KeyW") || input.isDown("ArrowUp")) move.add(forward);
    if (input.isDown("KeyS") || input.isDown("ArrowDown")) move.sub(forward);
    if (input.isDown("KeyD") || input.isDown("ArrowRight")) move.add(right);
    if (input.isDown("KeyA") || input.isDown("ArrowLeft")) move.sub(right);
    const moving = move.lengthSq() > 0;
    if (moving) move.normalize();

    const wantsSprint = input.isDown("ShiftLeft") || input.isDown("ShiftRight");
    const b = this.body;
    this.sprinting = wantsSprint && moving && !this.aiming && !this.overweight && b.stamina > 1 && input.isDown("KeyW");
    if (this.sprinting) this.crouching = false;

    let target = this.crouching ? CROUCH : this.sprinting ? SPRINT : WALK;
    if (this.aiming) target = Math.min(target, 1.8);
    if (this.overweight) target *= 0.65;
    target *= mobility(b);
    if (!moving) target = 0;
    this.speed += (target - this.speed) * Math.min(1, dt * 10);

    this.pos.addScaledVector(move, this.speed * dt);

    // Jump and gravity
    const ground = Math.max(terrain.height(this.pos.x, this.pos.z), colliders.supportHeight(this.pos.x, this.pos.z, this.pos.y));
    if (input.wasPressed("Space") && this.grounded && b.stamina > 8) {
      this.velY = JUMP;
      this.grounded = false;
      b.stamina -= 8;
      this.crouching = false;
    }
    this.velY -= GRAVITY * dt;
    this.pos.y += this.velY * dt;
    let landedHard = false;
    if (this.pos.y <= ground) {
      landedHard = !this.grounded && this.velY < -6;
      this.pos.y = ground;
      this.velY = 0;
      this.grounded = true;
    } else if (this.pos.y > ground + 0.05) {
      this.grounded = false;
    }

    colliders.resolveCylinder(this.pos, RADIUS, this.pos.y, this.crouching ? 1.3 : HEIGHT);
    const lim = WORLD_HALF - 5;
    this.pos.x = Math.max(-lim, Math.min(lim, this.pos.x));
    this.pos.z = Math.max(-lim, Math.min(lim, this.pos.z));

    this.footstepRadius = !moving ? 0 : this.crouching ? 1.2 : this.sprinting ? 15 : 5;
    if (landedHard) this.footstepRadius = Math.max(this.footstepRadius, 6);

    // Body faces where you aim; otherwise it turns towards the direction of travel.
    let desired = this.bodyYaw;
    if (this.aiming || attacking) desired = this.yaw;
    else if (moving) desired = Math.atan2(move.x, move.z);
    let diff = desired - this.bodyYaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.bodyYaw += diff * Math.min(1, dt * (this.aiming || attacking ? 20 : 10));

    this.model.animate(dt, this.speed, {
      crouch: this.crouching,
      aim: this.aiming,
      attack: this.attackAnim > 0 ? this.attackAnim : undefined,
    });
    this.model.root.position.copy(this.pos);
    this.model.root.rotation.y = this.bodyYaw;
  }

  /** 0 = resting, 1 = sprinting. Feeds the body simulation. */
  get exertion() {
    return this.sprinting ? 1 : this.speed > 0.5 ? 0.3 : 0;
  }

  /** Over-the-shoulder camera with collision so walls never block the view. */
  updateCamera(camera: THREE.PerspectiveCamera, colliders: ColliderWorld, dt: number) {
    this.camAim += ((this.aiming ? 1 : 0) - this.camAim) * Math.min(1, dt * 12);
    const dist = THREE.MathUtils.lerp(3.1, 1.5, this.camAim);
    const side = THREE.MathUtils.lerp(0.8, 0.65, this.camAim);
    const pivot = new THREE.Vector3(this.pos.x, this.pos.y + (this.crouching ? 1.25 : 1.62), this.pos.z);

    const look = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    const right = new THREE.Vector3(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
    const shoulder = pivot.clone().addScaledVector(right, side);
    // Pull the camera in if a wall is between the shoulder and the desired spot.
    const sideHit = colliders.raycast(pivot.x, pivot.y, pivot.z, right.x, 0, right.z, side + 0.2);
    if (sideHit < side + 0.2) shoulder.copy(pivot).addScaledVector(right, Math.max(0, sideHit - 0.2));
    const back = look.clone().negate();
    const hit = colliders.raycast(shoulder.x, shoulder.y, shoulder.z, back.x, back.y, back.z, dist + 0.3);
    const d = Math.max(0.3, Math.min(dist, hit - 0.3));
    const desired = shoulder.clone().addScaledVector(back, d);
    // Don't sink below the ground on steep looks.
    desired.y = Math.max(desired.y, this.pos.y + 0.3);

    this.camPos.lerp(desired, Math.min(1, dt * 20));
    if (this.camPos.distanceTo(desired) > d * 0.6) this.camPos.copy(desired);
    camera.position.copy(this.camPos);
    camera.lookAt(shoulder.clone().addScaledVector(look, 20));
    const fov = THREE.MathUtils.lerp(70, 48, this.camAim);
    if (Math.abs(camera.fov - fov) > 0.05) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }
}
