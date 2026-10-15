import * as THREE from "three";
import type { Appearance, GearId } from "../../sim/appearance";
import { BONES, SHAPES, geometryFor, restPositions, type BoneName } from "./humanoidGeometry";
import { piecesFor, strapMask } from "./humanoidLook";
import { humanoidUniforms, makeHumanoidMaterial, type HumanoidUniforms } from "./humanoidShader";

/**
 * Procedural skinned human: a 19-bone skeleton and a body generated from
 * lofted cross-sections (humanoidGeometry.ts), dressed by a shader from an
 * engine-agnostic Appearance (humanoidShader.ts): clothes, face, hair, gear,
 * and the state of the dead. One draw call per character. Animation is
 * procedural (see animate()).
 */

// ----------------------------------------------------------------- humanoid

export class Humanoid {
  readonly root = new THREE.Group();
  /** Rotates the whole body for falling over on death. */
  readonly body = new THREE.Group();
  readonly mesh: THREE.SkinnedMesh;
  readonly bones: Record<BoneName, THREE.Bone>;
  /** Parent for things attached to the head. */
  readonly head: THREE.Object3D;
  /** Attach held items here; it sits in the right palm. */
  readonly hand = new THREE.Group();
  readonly appearance: Appearance;
  private material: THREE.MeshStandardMaterial;
  private uniforms: HumanoidUniforms;
  private bodyKey: string;
  private phase = Math.random() * Math.PI * 2;
  private time = Math.random() * 100;
  private zombie: boolean;
  /** Per-zombie quirks so a crowd doesn't move in lockstep. */
  private limp = 0;
  private hunch = 0;
  /** How high the arms come up: 1 reaching, 0.5 half-raised, 0 hanging. */
  private reach = 1;
  private twitch = 0;
  private flinchT = 0;
  private flinchDir = 1;
  /** Smoothed pose so transitions (aiming, crouching) blend instead of popping. */
  private pose = new Map<THREE.Bone, THREE.Euler>();
  private hipsY = 0;

  constructor(app: Appearance, opts: { zombie: boolean; height?: number }) {
    this.appearance = app;
    this.zombie = opts.zombie;
    this.bodyKey = `${app.sex}-${app.build}`;
    const rest = restPositions(SHAPES[this.bodyKey]);

    const boneObjs: THREE.Bone[] = BONES.map(([name]) => {
      const b = new THREE.Bone();
      b.name = name;
      return b;
    });
    BONES.forEach(([, parent], i) => {
      const local = parent < 0 ? rest[i].clone() : rest[i].clone().sub(rest[parent]);
      boneObjs[i].position.copy(local);
      if (parent >= 0) boneObjs[parent].add(boneObjs[i]);
    });
    this.bones = Object.fromEntries(BONES.map(([name], i) => [name, boneObjs[i]])) as Record<BoneName, THREE.Bone>;

    this.uniforms = humanoidUniforms(app, opts.zombie, rest);
    this.material = makeHumanoidMaterial(this.uniforms);
    this.mesh = new THREE.SkinnedMesh(geometryFor(this.bodyKey, piecesFor(app)), this.material);
    this.mesh.add(boneObjs[0]);
    this.mesh.bind(new THREE.Skeleton(boneObjs));
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    // Culled by a sphere round the body (a SkinnedMesh uses its own, not the geometry's), so
    // zombies behind the camera skip the main and AO passes. Big enough for reaching arms and a fall.
    this.mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0.2), 1.35);
    this.mesh.frustumCulled = true;
    this.body.add(this.mesh);
    this.root.add(this.body);
    this.root.scale.setScalar(opts.height ?? 1);
    this.hipsY = this.bones.hips.position.y;

    this.head = new THREE.Object3D();
    this.head.position.set(0, 0.095, 0.01);
    this.bones.head.add(this.head);
    this.hand.position.set(0, -0.08, 0.02);
    this.bones.handR.add(this.hand);

    this.limp = app.gait.limp;
    this.hunch = app.gait.hunch;
    this.reach = app.gait.reach;
    for (const b of boneObjs) this.pose.set(b, new THREE.Euler());
  }

  /** Change what's carried on the body (the player's holster, slung weapons, pack). */
  setGear(gear: readonly GearId[]) {
    const key = [...gear].sort().join(",");
    if (key === this.appearance.gear.join(",")) return;
    this.appearance.gear = [...gear].sort();
    this.mesh.geometry = geometryFor(this.bodyKey, piecesFor(this.appearance));
    this.uniforms.uStraps.value = strapMask(this.appearance.gear);
  }

  /** Far away, skip the fine detail (faces, patterns, seams, tears). */
  setDetail(near: boolean) {
    this.uniforms.uDetail.value = near ? 1 : 0;
  }

  setTint(hex: number) {
    this.material.emissive.setHex(hex);
  }

  private shadows = true;
  setShadows(on: boolean) {
    if (on === this.shadows) return;
    this.shadows = on;
    this.mesh.castShadow = on;
  }

  /** A quick recoil of the upper body when hit. dir: +1 hit from the front. */
  flinch(dir = 1) {
    this.flinchT = 1;
    this.flinchDir = dir;
  }

  /** Blend a bone's rotation towards a target. */
  private set(b: THREE.Bone, x: number, y: number, z: number, k: number) {
    const e = this.pose.get(b)!;
    e.x += (x - e.x) * k;
    e.y += (y - e.y) * k;
    e.z += (z - e.z) * k;
    b.rotation.set(e.x, e.y, e.z);
  }

  /**
   * Procedural animation. speed in m/s drives the gait (walk → run), with
   * stride length scaled so feet don't skate.
   */
  animate(dt: number, speed: number, opts: { zombie?: boolean; crouch?: boolean; aim?: boolean; attack?: number } = {}) {
    const B = this.bones;
    const zombie = opts.zombie ?? this.zombie;
    this.time += dt;
    const run = Math.min(1, Math.max(0, (speed - 2.2) / 2.5));
    const stride = 0.55 + speed * 0.32;
    this.phase += (speed / stride) * Math.PI * dt;
    const moving = Math.min(1, speed / 1.2);
    const s = Math.sin(this.phase);
    const c = Math.cos(this.phase);
    const k = Math.min(1, dt * 14);
    const crouch = opts.crouch ? 1 : 0;
    this.flinchT = Math.max(0, this.flinchT - dt * 5);
    const fl = this.flinchT * this.flinchT * this.flinchDir;

    // Legs: thigh swing, knee bends on the forward swing, foot stays level.
    const thighAmp = (0.45 + run * 0.35) * moving;
    const limpL = this.limp > 0 ? 1 - this.limp * 0.6 : 1;
    const limpR = this.limp < 0 ? 1 + this.limp * 0.6 : 1;
    const legPose = (side: "L" | "R", sign: number, limpK: number) => {
      const sw = sign * s * thighAmp * limpK;
      const knee = Math.max(0, -sign * Math.sin(this.phase - 0.9)) * (0.7 + run * 0.7) * moving * limpK + 0.06;
      const thighX = -sw - crouch * 1.05;
      const shinX = knee + crouch * 1.75;
      this.set(B[`thigh${side}`], thighX, 0, sign * 0.02, k);
      this.set(B[`shin${side}`], shinX, 0, 0, k);
      this.set(B[`foot${side}`], -(thighX + shinX) * 0.85, 0, 0, k);
    };
    legPose("L", 1, limpL);
    legPose("R", -1, limpR);

    // Hips bob twice per cycle, sway, and twist; the chest counter-rotates.
    const bob = Math.abs(c) * (0.025 + run * 0.035) * moving;
    B.hips.position.y = this.hipsY - crouch * 0.32 + bob - (zombie ? 0.03 : 0);
    const lean = run * 0.22 + crouch * 0.35 + (zombie ? this.hunch : 0) + (opts.aim ? 0.05 : 0);
    this.set(B.hips, 0, s * 0.12 * moving, c * 0.04 * moving, k);
    this.set(B.spine, lean * 0.5 - fl * 0.25, -s * 0.08 * moving, 0, k);
    const breathe = Math.sin(this.time * (1.4 + run * 2)) * 0.025;
    this.set(B.chest, lean * 0.5 + breathe - fl * 0.2, -s * 0.1 * moving, 0, k);

    // Arms
    const armAmp = (0.35 + run * 0.55) * moving;
    if (zombie) {
      this.twitch -= dt;
      if (this.twitch < -2 - Math.random() * 6) this.twitch = 0.25;
      const jerk = this.twitch > 0 ? Math.sin(this.time * 40) * 0.25 : 0;
      const sway = Math.sin(this.time * 1.7) * 0.12;
      // Arms reach when chasing; at rest they hang according to this zombie's habit.
      const reach = Math.max(this.reach, moving * 0.6);
      const swing = s * (0.15 + (1 - reach) * 0.25) * moving;
      this.set(B.upperArmL, -1.3 * reach + sway * reach - swing, 0.1, -0.12 - (1 - reach) * 0.05, k);
      this.set(B.upperArmR, -1.4 * reach - sway * reach + swing, -0.1, 0.12 + (this.limp ? 0.15 : 0), k);
      this.set(B.forearmL, -0.25 - (1 - reach) * 0.2, 0, 0, k);
      this.set(B.forearmR, -0.35 - (1 - reach) * 0.15, 0, 0, k);
      this.set(B.neck, 0.2 + jerk, Math.sin(this.time * 0.6) * 0.25, Math.sin(this.time * 0.4) * 0.3 + jerk, k);
      this.set(B.head, 0.15, 0, 0.1, k);
    } else if (opts.aim) {
      // Two-handed pistol grip, arms extended at eye line.
      this.set(B.upperArmR, -1.5, 0.15, 0.05, k);
      this.set(B.forearmR, -0.08, 0, 0, k);
      this.set(B.upperArmL, -1.35, -0.55, -0.15, k);
      this.set(B.forearmL, -0.35, 0, 0, k);
      this.set(B.neck, -0.05, 0, 0, k);
      this.set(B.head, -0.05, 0, 0, k);
    } else {
      const elbow = -0.25 - run * 1.0;
      this.set(B.upperArmL, s * armAmp, 0, -0.06 - run * 0.1, k);
      this.set(B.upperArmR, -s * armAmp, 0, 0.06 + run * 0.1, k);
      this.set(B.forearmL, elbow - Math.max(0, s) * 0.2, 0, 0, k);
      this.set(B.forearmR, elbow - Math.max(0, -s) * 0.2, 0, 0, k);
      this.set(B.neck, -lean * 0.4, s * 0.05 * moving, 0, k);
      this.set(B.head, -lean * 0.3, 0, 0, k);
    }

    // Attack: wind up over the shoulder, then strike down across the body.
    if (opts.attack !== undefined && opts.attack > 0) {
      const t = opts.attack;
      const up = t < 0.4 ? t / 0.4 : 1 - (t - 0.4) / 0.6;
      const arm = -0.6 - up * 2.0;
      const kk = Math.min(1, dt * 30);
      if (zombie) {
        this.set(B.upperArmL, arm + 0.6, 0, -0.1, kk);
        this.set(B.upperArmR, arm + 0.6, 0, 0.1, kk);
        this.set(B.spine, this.hunch + (1 - up) * 0.35, 0, 0, kk);
      } else {
        this.set(B.upperArmR, arm, 0.3, 0.2, kk);
        this.set(B.forearmR, -0.4 * up, 0, 0, kk);
        this.set(B.upperArmL, arm + 0.15, -0.5, -0.1, kk);
        this.set(B.forearmL, -0.6, 0, 0, kk);
        this.set(B.chest, 0.1 + (1 - up) * 0.25, (up - 0.5) * 0.9, 0, kk);
      }
    }
  }

  /** Crumple to the ground. t goes 0 → 1. Knees buckle first, then the body tips back. */
  fall(t: number) {
    const e = Math.min(1, Math.max(0, t));
    const buckle = Math.min(1, e / 0.35);
    const tip = Math.max(0, (e - 0.25) / 0.75);
    const B = this.bones;
    const pose = (b: THREE.Bone, x: number, y: number, z: number) => {
      b.rotation.set(x, y, z);
      this.pose.get(b)!.set(x, y, z);
    };
    pose(B.thighL, -0.9 * buckle * (1 - tip * 0.7), 0, 0);
    pose(B.thighR, -0.7 * buckle * (1 - tip * 0.7), 0, 0);
    pose(B.shinL, 1.4 * buckle * (1 - tip * 0.6), 0, 0);
    pose(B.shinR, 1.2 * buckle * (1 - tip * 0.6), 0, 0);
    B.hips.position.y = this.hipsY - 0.35 * buckle * (1 - tip);
    pose(B.upperArmL, -0.3 * tip, 0, -0.9 * tip);
    pose(B.upperArmR, -0.5 * tip, 0, 1.0 * tip);
    pose(B.neck, -0.3 * tip, 0, 0.4 * tip);
    this.body.rotation.x = -(Math.PI / 2) * tip * tip;
    this.body.position.y = 0.1 * tip;
    this.body.position.z = 0.75 * tip;
  }

  dispose() {
    // Geometry shares its body kit's buffers; only the material is per character.
    this.material.dispose();
  }
}

/** Held-item geometry, one merged vertex-coloured mesh per item (built once, shared). */
const heldGeometry = new Map<string, THREE.BufferGeometry | null>();
let heldMaterial: THREE.MeshStandardMaterial | null = null;

type Part = { w: number; h: number; d: number; color: string; y: number; z?: number; rotX?: number };

const HELD: Record<string, { parts: Part[]; rotX: number }> = {
  pistol: {
    // Barrel (local +z) points out of the fist along the forearm.
    rotX: Math.PI / 2,
    parts: [
      { w: 0.03, h: 0.11, d: 0.045, color: "#1d1d1d", y: -0.02 },
      { w: 0.032, h: 0.05, d: 0.19, color: "#262626", y: 0.025, z: 0.07 },
    ],
  },
  baseball_bat: {
    rotX: -Math.PI / 2,
    parts: [
      { w: 0.04, h: 0.85, d: 0.04, color: "#8a6a42", y: -0.38 },
      { w: 0.065, h: 0.35, d: 0.065, color: "#8a6a42", y: -0.7 },
    ],
  },
  fire_axe: {
    rotX: -Math.PI / 2,
    parts: [
      { w: 0.04, h: 0.9, d: 0.04, color: "#7a2a20", y: -0.4 },
      { w: 0.03, h: 0.18, d: 0.26, color: "#9aa0a6", y: -0.8, z: 0.1 },
    ],
  },
  hammer: {
    rotX: -Math.PI / 2,
    parts: [
      // 0.33 m hickory handle, thicker at the grip and slimming towards the head.
      { w: 0.032, h: 0.17, d: 0.026, color: "#9a7a52", y: -0.045 },
      { w: 0.024, h: 0.16, d: 0.019, color: "#9a7a52", y: -0.21 },
      // Steel head across the end: striking face on the axe-blade side (+z), claw behind, tilted back.
      { w: 0.024, h: 0.028, d: 0.06, color: "#5d6166", y: -0.3, z: 0.01 },
      { w: 0.03, h: 0.03, d: 0.015, color: "#5d6166", y: -0.3, z: 0.0475 },
      { w: 0.022, h: 0.012, d: 0.042, color: "#5d6166", y: -0.296, z: -0.038, rotX: 0.4 },
    ],
  },
  kitchen_knife: {
    rotX: -Math.PI / 2,
    parts: [
      { w: 0.025, h: 0.1, d: 0.025, color: "#222222", y: -0.03 },
      { w: 0.012, h: 0.19, d: 0.035, color: "#c0c4c8", y: -0.16 },
    ],
  },
};

function buildHeld(id: string): THREE.BufferGeometry | null {
  const def = HELD[id];
  if (!def) return null;
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const m = new THREE.Matrix4();
  const nm = new THREE.Matrix3();
  for (const part of def.parts) {
    const box = new THREE.BoxGeometry(part.w, part.h, part.d);
    m.makeRotationX(part.rotX ?? 0).setPosition(0, part.y, part.z ?? 0);
    box.applyMatrix4(m);
    nm.getNormalMatrix(m);
    // Already linear: with colour management on (three's default), Color(hex) converts from sRGB.
    const c = new THREE.Color(part.color);
    const base = pos.length / 3;
    const bp = box.getAttribute("position");
    const bn = box.getAttribute("normal");
    for (let i = 0; i < bp.count; i++) {
      pos.push(bp.getX(i), bp.getY(i), bp.getZ(i));
      nor.push(bn.getX(i), bn.getY(i), bn.getZ(i));
      col.push(c.r, c.g, c.b);
    }
    for (const i of box.getIndex()!.array) idx.push(base + i);
    box.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

/** The mesh for an item held in the hand: one draw call, geometry and material shared. */
export function makeHeldItem(id: string): THREE.Object3D | null {
  if (!heldGeometry.has(id)) heldGeometry.set(id, buildHeld(id));
  const geo = heldGeometry.get(id);
  if (!geo) return null;
  heldMaterial ??= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.3 });
  const mesh = new THREE.Mesh(geo, heldMaterial);
  mesh.castShadow = true;
  const g = new THREE.Group();
  g.add(mesh);
  g.rotation.x = HELD[id].rotX;
  return g;
}
