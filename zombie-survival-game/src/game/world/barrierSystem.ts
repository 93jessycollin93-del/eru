import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  accessRow,
  addBoard,
  boardCost,
  breakGlass as simBreakGlass,
  clearGlass,
  closeDoor,
  colliderEnabled,
  createBarrierWorld,
  effectiveLocked,
  hitBarrier,
  keypadEnter,
  lockCommand,
  navCost,
  occludes,
  openDoor,
  pushOpen,
  removeBoard,
  setLockPower,
  tickBarrier,
  toggleBolt,
  vaultSeconds,
  zombieAccess,
  zombieClimbSeconds,
  type Barrier,
  type BarrierWorld,
  type HitResult,
  type Side,
  type ZombieAccess,
} from "../../sim/barriers";
import { cellsInBox, setCellCost, type NavGrid } from "../../sim/nav";
import { BARRICADE, DOOR, WINDOW } from "../../sim/tuning";
import type { TextureLibrary } from "../render/textures";
import type { AABB, ColliderWorld, RayHit } from "./colliders";
import type { BarrierSpec, TownData } from "./town";

const WALL_T = 0.25;
/** Jamb liner inside a door opening; the leaves hang between the liners. */
const JAMB = 0.03;
const LEAF_T = { hollow: 0.035, solid: 0.045, glass: 0.045, steel: 0.045 } as const;
const PLANK_W = 0.14;
const PLANK_T = 0.022;
/** Board heights as fractions of the opening, in the order they go up (first one at handle height). */
const BOARD_SLOTS = { door: [0.5, 0.2, 0.8, 0.07], window: [0.5, 0.15, 0.85] } as const;
const SWING_RATE = DOOR.openAngle / DOOR.swingSeconds;
/** Front door paint: oxblood, navy, forest green, white, black, stained oak, slate. */
const DOOR_PAINT = ["#7a2a24", "#25384d", "#33442f", "#e2ddd2", "#2a2a2a", "#8a6a44", "#5e666b"];

type DoorBuild = "hollow" | "solid" | "glass" | "steel";

interface Leaf {
  mesh: THREE.InstancedMesh;
  index: number;
  /** Which jamb this leaf hangs on (+1 / -1 along the wall axis). */
  hinge: 1 | -1;
  width: number;
  height: number;
  thick: number;
  /** Scale from the build's shared leaf geometry to this leaf's size. */
  sx: number;
  sy: number;
  /** Instance in the glass mesh for a glazed leaf, else -1. */
  glass: number;
}

interface Slot {
  spec: BarrierSpec;
  along: THREE.Vector3;
  n: THREE.Vector3;
  centre: THREE.Vector3;
  box: AABB;
  collider: number;
  cells: number[];
  leaves: Leaf[];
  /** Swing direction along the normal: -1 into side -1 (swingIn), +1 out. */
  swing: 1 | -1;
  angle: number;
  target: number;
  pane: number;
  /** Crossable from side +1 and from side -1 (see crossable()). */
  crossable: [boolean, boolean];
  /** What the meshes last showed, so pools are rebuilt only when it changes. */
  shown: { boards: number; side: Side; glass: string };
}

export interface Traversal {
  /** Where the climb starts (on the near side, lined up with the opening) and lands. */
  from: THREE.Vector3;
  to: THREE.Vector3;
  dur: number;
  /** Height of the arc over the sill. */
  peak: number;
}

export interface BarrierTarget {
  id: number;
  dist: number;
  side: Side;
}

const tmpM = new THREE.Matrix4();
const tmpM2 = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const reachHit: RayHit = { box: null };
/** Nav cost of an opening no body can pass (the cost layer's maximum). */
const UNCROSSABLE = 255;

/** Small stable pseudo-random number for cosmetic jitter (board tilt), so rebuilds look the same. */
const jitter = (a: number, b: number) => {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x) - 0.5;
};

/**
 * The physical side of doors, windows and barricades: leaf, glass and board
 * meshes (instanced), colliders, nav costs and swing animation. All the rules
 * live in src/sim/barriers.ts; this class only mirrors that state into the world.
 */
export class BarrierSystem {
  world: BarrierWorld = { barriers: [] };
  readonly specs: BarrierSpec[];
  readonly group = new THREE.Group();
  /** Transparent meshes (keep them out of ambient occlusion). */
  readonly seeThrough: THREE.Object3D[] = [];
  private slots: Slot[] = [];
  private leafMeshes: THREE.InstancedMesh[] = [];
  private glass!: THREE.InstancedMesh;
  private shardMesh!: THREE.InstancedMesh;
  private boards!: THREE.InstancedMesh;
  private keypads: { id: number; light: THREE.Mesh; mat: THREE.MeshStandardMaterial }[] = [];
  private swinging = new Set<number>();
  private electronic: number[] = [];
  private dirty = new Set<THREE.InstancedMesh>();
  private blink = 0;

  constructor(
    private town: TownData,
    private colliders: ColliderWorld,
    private nav: NavGrid,
    textures?: TextureLibrary,
  ) {
    this.specs = town.barrierSpecs;
    this.buildMeshes(textures);
    for (const spec of this.specs) this.slots.push(this.buildSlot(spec));
    // With every collider in place, work out which openings a body can actually get through.
    for (const s of this.slots) {
      const walkable = s.cells.some((c) => !this.nav.blocked[c]);
      s.crossable = s.spec.kind === "window"
        ? [walkable && this.traversal(s.spec.id, 1, s.centre) !== null, walkable && this.traversal(s.spec.id, -1, s.centre) !== null]
        : [walkable, walkable];
    }
    this.electronic = this.specs.filter((s) => s.electronic).map((s) => s.id);
    this.buildKeypads();
  }

  // ------------------------------------------------------------------ setup

  private buildMeshes(textures?: TextureLibrary) {
    // Leaf meshes: one instanced mesh per door build; sizes within a build differ by a few cm and are scaled.
    const groups = new Map<DoorBuild, BarrierSpec[]>();
    for (const s of this.specs) {
      if (s.kind !== "door") continue;
      const b = s.build as DoorBuild;
      if (!groups.has(b)) groups.set(b, []);
      groups.get(b)!.push(s);
    }
    const wood = textures?.get("wood");
    const metal = textures?.get("metal");
    const mats: Record<DoorBuild, THREE.MeshStandardMaterial> = {
      hollow: paintable(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 })),
      solid: paintable(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.05 })),
      glass: paintable(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.6 })),
      steel: paintable(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.45, normalMap: metal?.normalMap ?? null })),
    };
    for (const [b, list] of groups) {
      const w = leafWidth(list[0]);
      const h = leafHeight(list[0]);
      this.leafRef.set(b, { w, h });
      const geo = leafGeometry(b, w, h, LEAF_T[b]);
      const count = list.reduce((n, s) => n + s.leaves, 0);
      const mesh = new THREE.InstancedMesh(geo, mats[b], count);
      // Interior doors are out of the sun; their shadows aren't worth a pass.
      mesh.castShadow = b !== "hollow";
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.leafMeshes.push(mesh);
      this.group.add(mesh);
      let i = 0;
      const paint = new THREE.Color();
      for (const s of list) {
        const idx: number[] = [];
        // Every house picked its own front door colour; other doors keep their maker's finish.
        paint.set(b === "solid" ? DOOR_PAINT[Math.floor((jitter(s.id, 3) + 0.5) * DOOR_PAINT.length) % DOOR_PAINT.length] : "#ffffff");
        for (let k = 0; k < s.leaves; k++) {
          mesh.setColorAt(i, paint);
          idx.push(i++);
        }
        this.leafIndex.set(s.id, { mesh, idx });
      }
    }

    // Glass: every window pane and glazed door panel, one instance each.
    const windows = this.specs.filter((s) => s.kind === "window");
    const glazedLeaves = this.specs.filter((s) => s.kind === "door" && s.build === "glass").reduce((n, s) => n + s.leaves, 0);
    this.glass = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshStandardMaterial({
        color: "#93a6aa",
        transparent: true,
        opacity: 0.26,
        roughness: 0.12,
        metalness: 0.55,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      Math.max(1, windows.length + glazedLeaves),
    );
    this.glass.renderOrder = 2;
    this.glass.frustumCulled = false;
    this.glass.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Shards left in a broken frame until you clear them.
    this.shardMesh = new THREE.InstancedMesh(
      shardGeometry(),
      new THREE.MeshStandardMaterial({ color: "#b4c4c6", transparent: true, opacity: 0.62, roughness: 0.08, metalness: 0.35, side: THREE.DoubleSide, depthWrite: false }),
      Math.max(1, windows.length),
    );
    this.shardMesh.renderOrder = 2;
    this.shardMesh.frustumCulled = false;
    this.shardMesh.count = 0;

    // Boards: a pool packed with only the boards that exist (count grows and shrinks).
    let cap = 0;
    for (const s of this.specs) cap += BARRICADE.maxBoards[s.kind] * Math.ceil(s.width / BARRICADE.plankLength - 1e-9);
    const plank = new THREE.BoxGeometry(1, PLANK_W, PLANK_T);
    this.boards = new THREE.InstancedMesh(
      plank,
      new THREE.MeshStandardMaterial({ color: "#a08262", roughness: 0.85, map: wood?.map ?? null, normalMap: wood?.normalMap ?? null }),
      Math.max(1, cap),
    );
    // Boards lie flat on the wall: their shadow is a hairline, not worth a shadow pass.
    this.boards.castShadow = false;
    this.boards.receiveShadow = true;
    this.boards.frustumCulled = false;
    this.boards.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.boards.count = 0;

    this.group.add(this.glass, this.shardMesh, this.boards);
    this.seeThrough.push(this.glass, this.shardMesh);
  }

  private leafIndex = new Map<number, { mesh: THREE.InstancedMesh; idx: number[] }>();
  private leafRef = new Map<DoorBuild, { w: number; h: number }>();
  private nextPane = 0;
  private boardsDirty = true;
  private shardsDirty = true;

  private buildSlot(spec: BarrierSpec): Slot {
    const along = new THREE.Vector3(spec.axis === "x" ? 1 : 0, 0, spec.axis === "z" ? 1 : 0);
    const n = new THREE.Vector3(spec.nx, 0, spec.nz);
    const centre = new THREE.Vector3(spec.cx, 0, spec.cz);
    const hw = spec.width / 2;
    const ht = WALL_T / 2;
    const box: AABB = {
      minX: spec.cx - (spec.axis === "x" ? hw : ht),
      maxX: spec.cx + (spec.axis === "x" ? hw : ht),
      minZ: spec.cz - (spec.axis === "z" ? hw : ht),
      maxZ: spec.cz + (spec.axis === "z" ? hw : ht),
      minY: spec.bottom,
      maxY: spec.top,
      occludes: false,
      barrierId: spec.id,
      ...(spec.kind === "window" ? { glass: true } : {}),
    };
    const collider = this.colliders.add(box);
    // A one-cell strip on the wall centre line, so crossing is charged once.
    const c = this.nav.cell / 2;
    const cells = cellsInBox(this.nav, {
      minX: spec.axis === "x" ? spec.cx - hw : spec.cx - c,
      maxX: spec.axis === "x" ? spec.cx + hw : spec.cx + c,
      minZ: spec.axis === "z" ? spec.cz - hw : spec.cz - c,
      maxZ: spec.axis === "z" ? spec.cz + hw : spec.cz + c,
    });

    const leaves: Leaf[] = [];
    if (spec.kind === "door") {
      const li = this.leafIndex.get(spec.id)!;
      const glazed = spec.build === "glass";
      const ref = this.leafRef.get(spec.build as DoorBuild)!;
      for (let k = 0; k < spec.leaves; k++) {
        // A single leaf hangs on the spec's hinge jamb; a pair hangs one on each.
        const hinge: 1 | -1 = spec.leaves === 2 ? (k === 0 ? 1 : -1) : spec.hinge;
        leaves.push({
          mesh: li.mesh,
          index: li.idx[k],
          hinge,
          width: leafWidth(spec),
          height: leafHeight(spec),
          thick: LEAF_T[spec.build as DoorBuild],
          sx: leafWidth(spec) / ref.w,
          sy: leafHeight(spec) / ref.h,
          glass: glazed ? this.nextPane++ : -1,
        });
      }
    }
    const pane = spec.kind === "window" ? this.nextPane++ : -1;
    return {
      spec,
      along,
      n,
      centre,
      box,
      collider,
      cells,
      leaves,
      swing: spec.swingIn ? -1 : 1,
      angle: 0,
      target: 0,
      pane,
      crossable: [true, true],
      shown: { boards: -1, side: -1, glass: "" },
    };
  }

  private buildKeypads() {
    for (const s of this.specs) {
      if (!s.keypad) continue;
      const mat = new THREE.MeshStandardMaterial({ color: "#111", emissive: "#000", emissiveIntensity: 2 });
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.012, 0.008), mat);
      light.position.set(s.keypad.x + s.keypad.nx * 0.002, s.keypad.y + 0.075, s.keypad.z + s.keypad.nz * 0.002);
      light.rotation.y = Math.atan2(s.keypad.nx, s.keypad.nz);
      this.group.add(light);
      this.keypads.push({ id: s.id, light, mat });
    }
  }

  // ------------------------------------------------------------------ state

  /** Fresh doors and windows for a new game. */
  reset(rng: () => number) {
    const type = new Map(this.town.buildings.map((b) => [b.address, b.type]));
    this.world = createBarrierWorld(
      this.specs.map((s) => ({
        kind: s.kind,
        build: s.build,
        role: s.role,
        width: s.width,
        sill: s.bottom,
        pushSide: s.pushSide,
        electronic: s.electronic ? { ...s.electronic } : undefined,
        house: type.get(s.building) === "house",
      })),
      rng,
    );
    this.syncAll();
  }

  /** Mirror the whole barrier world into meshes, colliders and nav (also after loading a save). */
  syncAll() {
    this.boardsDirty = this.shardsDirty = true;
    for (const s of this.slots) {
      this.refresh(s.spec.id);
      s.angle = s.target;
      this.placeDoor(s);
    }
    this.swinging.clear();
    this.flush();
  }

  barrier(id: number): Barrier {
    return this.world.barriers[id];
  }

  /** Re-derive collider, sight, nav cost and visuals after a state change. */
  private refresh(id: number) {
    const b = this.world.barriers[id];
    const s = this.slots[id];
    this.colliders.setEnabled(s.collider, colliderEnabled(b));
    s.box.occludes = occludes(b);
    // An opening nobody can get through either way (furniture both sides) is priced out of every route.
    setCellCost(this.nav, s.cells, s.crossable[0] || s.crossable[1] ? navCost(b) : UNCROSSABLE);
    if (b.kind === "door") {
      const target = b.broken ? DOOR.burstAngle : b.open ? DOOR.openAngle : 0;
      if (target !== s.target) {
        s.target = target;
        this.swinging.add(id);
      }
      this.placeDoor(s);
    } else if (s.shown.glass !== b.glass) {
      this.setInstance(this.glass, s.pane, b.glass === "intact" ? this.paneMatrix(s) : ZERO);
      this.shardsDirty = true;
    }
    s.shown.glass = b.glass;
    if (s.shown.boards !== b.boards.length || s.shown.side !== b.boardSide) {
      s.shown.boards = b.boards.length;
      s.shown.side = b.boardSide;
      this.boardsDirty = true;
    }
  }

  private setInstance(mesh: THREE.InstancedMesh, i: number, m: THREE.Matrix4) {
    if (i < 0) return;
    mesh.setMatrixAt(i, m);
    this.dirty.add(mesh);
  }

  private flush() {
    if (this.boardsDirty) this.packBoards();
    if (this.shardsDirty) this.packShards();
    for (const m of this.dirty) m.instanceMatrix.needsUpdate = true;
    this.dirty.clear();
  }

  /** Every board that exists, packed at the front of the pool. */
  private packBoards() {
    let used = 0;
    for (const s of this.slots) {
      const b = this.world.barriers[s.spec.id];
      if (b?.boards.length) used = this.placeBoards(s, b, used);
    }
    this.boards.count = used;
    // An empty instanced mesh still costs a draw call.
    this.boards.visible = used > 0;
    this.dirty.add(this.boards);
    this.boardsDirty = false;
  }

  /** Shards in every broken (but not cleared) window frame. */
  private packShards() {
    let used = 0;
    for (const s of this.slots) {
      if (this.world.barriers[s.spec.id]?.glass === "broken" && s.spec.kind === "window") this.shardMesh.setMatrixAt(used++, this.paneMatrix(s));
    }
    this.shardMesh.count = used;
    this.shardMesh.visible = used > 0;
    this.dirty.add(this.shardMesh);
    this.shardsDirty = false;
  }

  /** Yaw that turns local +X onto the wall axis. */
  private wallYaw(s: Slot) {
    return Math.atan2(-s.along.z, s.along.x);
  }

  private paneMatrix(s: Slot) {
    const sp = s.spec;
    const inset = sp.kind === "window" ? 0.05 : 0;
    tmpV.copy(s.centre).setY((sp.bottom + sp.top) / 2);
    tmpQ.setFromAxisAngle(UP, this.wallYaw(s));
    tmpS.set(sp.width - inset * 2, sp.top - sp.bottom - inset * 2, 1);
    return tmpM.compose(tmpV, tmpQ, tmpS);
  }

  /** Leaf transforms for the current swing angle. */
  private placeDoor(s: Slot) {
    const b = this.world.barriers[s.spec.id];
    const broken = b?.broken ?? false;
    for (const leaf of s.leaves) {
      const theta = s.angle;
      const swingN = tmpS.copy(s.n).multiplyScalar(s.swing);
      // Pivot on the jamb, at the face of the wall the leaf swings towards.
      const pivot = new THREE.Vector3()
        .copy(s.centre)
        .addScaledVector(s.along, leaf.hinge * (s.spec.width / 2 - JAMB))
        .addScaledVector(swingN, WALL_T / 2);
      // d: from the hinge to the free edge; back: the thickness direction (into the reveal when closed).
      const d = new THREE.Vector3().copy(s.along).multiplyScalar(-leaf.hinge * Math.cos(theta)).addScaledVector(swingN, Math.sin(theta));
      const back = new THREE.Vector3().copy(swingN).multiplyScalar(-Math.cos(theta)).addScaledVector(s.along, -leaf.hinge * Math.sin(theta));
      pivot.addScaledVector(back, leaf.thick / 2).setY(0.01);
      const yaw = Math.atan2(-d.z, d.x);
      tmpM.makeRotationY(yaw).setPosition(pivot);
      if (broken) {
        // Hanging off the top hinge with the bottom one torn out.
        tmpM2.makeTranslation(0, leaf.height, 0).multiply(new THREE.Matrix4().makeRotationZ(DOOR.burstTilt)).multiply(new THREE.Matrix4().makeTranslation(0, -leaf.height, 0));
        tmpM.multiply(tmpM2);
      }
      if (leaf.glass >= 0) {
        const intact = b?.glass === "intact";
        if (intact) {
          const pw = leaf.width - 0.18;
          const ph = leaf.height - 0.25 - 0.09 - 0.04;
          tmpM2.compose(new THREE.Vector3(leaf.width / 2, 0.25 + 0.02 + ph / 2, 0), tmpQ.identity(), new THREE.Vector3(pw, ph, 1));
          this.setInstance(this.glass, leaf.glass, tmpM2.premultiply(tmpM));
        } else {
          this.setInstance(this.glass, leaf.glass, ZERO);
        }
      }
      tmpM.multiply(tmpM2.makeScale(leaf.sx, leaf.sy, 1));
      leaf.mesh.setMatrixAt(leaf.index, tmpM);
      this.dirty.add(leaf.mesh);
    }
  }

  private placeBoards(s: Slot, b: Barrier, offset: number): number {
    const sp = s.spec;
    const planks = Math.ceil(sp.width / BARRICADE.plankLength - 1e-9);
    const span = sp.width + 0.3;
    const len = Math.min(BARRICADE.plankLength, span / planks + (planks > 1 ? 0.1 : 0));
    const slotsY = BOARD_SLOTS[sp.kind];
    const bottom = sp.kind === "door" ? 0.1 : sp.bottom;
    const top = sp.top;
    const yaw = this.wallYaw(s);
    let used = offset;
    for (let i = 0; i < b.boards.length && i < slotsY.length; i++) {
      const y = bottom + (top - bottom) * slotsY[i];
      for (let p = 0; p < planks; p++) {
        const off = planks === 1 ? 0 : (p - (planks - 1) / 2) * (span - len);
        const tilt = jitter(sp.id, i * 3 + p) * 0.16;
        tmpV
          .copy(s.centre)
          .addScaledVector(s.n, b.boardSide * (WALL_T / 2 + PLANK_T / 2 + 0.003 + p * 0.004))
          .addScaledVector(s.along, off + jitter(sp.id + 7, i) * 0.06)
          .setY(y);
        tmpQ.setFromAxisAngle(UP, yaw);
        tmpQ.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), tilt));
        tmpS.set(len, 1, 1);
        this.boards.setMatrixAt(used++, tmpM.compose(tmpV, tmpQ, tmpS));
      }
    }
    return used;
  }

  // -------------------------------------------------------------- per frame

  /** Swing doors, count down electric pulses. Returns doors whose lock just re-engaged. */
  update(dt: number): number[] {
    for (const id of this.swinging) {
      const s = this.slots[id];
      const step = SWING_RATE * dt * (this.world.barriers[id].broken ? 3 : 1);
      s.angle += Math.max(-step, Math.min(step, s.target - s.angle));
      if (Math.abs(s.target - s.angle) < 1e-4) {
        s.angle = s.target;
        this.swinging.delete(id);
      }
      this.placeDoor(s);
    }
    const relocked: number[] = [];
    for (const id of this.electronic) {
      if (tickBarrier(this.world.barriers[id], dt)) {
        this.refresh(id);
        if (effectiveLocked(this.world.barriers[id])) relocked.push(id);
      }
    }
    this.blink += dt;
    for (const k of this.keypads) {
      const b = this.world.barriers[k.id];
      const e = b?.electronic;
      let color = "#000000";
      if (e?.powered) {
        if (e.lockoutLeft > 0) color = Math.floor(this.blink * 4) % 2 ? "#ff2a1a" : "#000000";
        else color = effectiveLocked(b) ? "#ff2a1a" : "#22ff55";
      }
      k.mat.emissive.set(color);
      k.mat.color.set(color === "#000000" ? "#151515" : color);
    }
    this.flush();
    return relocked;
  }

  // ------------------------------------------------------------- geometry

  sideOf(id: number, pos: { x: number; z: number }): Side {
    const s = this.slots[id];
    return (pos.x - s.centre.x) * s.n.x + (pos.z - s.centre.z) * s.n.z >= 0 ? 1 : -1;
  }

  centre(id: number): THREE.Vector3 {
    return this.slots[id].centre;
  }

  normal(id: number): THREE.Vector3 {
    return this.slots[id].n;
  }

  /** The point on the opening nearest to pos (on the wall centre line). */
  closestPoint(id: number, pos: { x: number; z: number }, out = new THREE.Vector3()): THREE.Vector3 {
    const s = this.slots[id];
    const t = (pos.x - s.centre.x) * s.along.x + (pos.z - s.centre.z) * s.along.z;
    const hw = s.spec.width / 2;
    return out.copy(s.centre).addScaledVector(s.along, Math.max(-hw, Math.min(hw, t)));
  }

  /** A point d metres out from the opening's centre on a side. */
  approach(id: number, side: Side, d: number, out = new THREE.Vector3()): THREE.Vector3 {
    const s = this.slots[id];
    return out.copy(s.centre).addScaledVector(s.n, side * d);
  }

  /** The closed door's box, for checking nothing is standing in the way before it shuts. */
  doorBox(id: number): AABB {
    return this.slots[id].box;
  }

  /** The barrier you're facing within range, preferring what you look at. */
  nearest(pos: THREE.Vector3, yaw: number, range: number): BarrierTarget | null {
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    let best: BarrierTarget | null = null;
    let bestScore = Infinity;
    const p = new THREE.Vector3();
    for (const s of this.slots) {
      if (Math.abs(s.centre.x - pos.x) > range + 3 || Math.abs(s.centre.z - pos.z) > range + 3) continue;
      this.closestPoint(s.spec.id, pos, p);
      const dx = p.x - pos.x;
      const dz = p.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d > range) continue;
      // Openings in upper walls aren't reachable; this town is single storey, so just check the sill isn't overhead.
      if (s.spec.bottom > pos.y + 1.6) continue;
      const facing = d > 1e-3 ? (dx * fx + dz * fz) / d : 1;
      if (facing < 0.3 && d > 0.6) continue;
      if (!this.reachable(s, pos)) continue;
      const score = d - facing * 0.8;
      if (score < bestScore) {
        bestScore = score;
        best = { id: s.spec.id, dist: d, side: this.sideOf(s.spec.id, pos) };
      }
    }
    return best;
  }

  /**
   * Nothing solid between you and the opening but the barrier itself, so you
   * can't work a door through a wall. Aims a little inside the jambs.
   */
  private reachable(s: Slot, pos: THREE.Vector3): boolean {
    const t = (pos.x - s.centre.x) * s.along.x + (pos.z - s.centre.z) * s.along.z;
    const lim = Math.max(0, s.spec.width / 2 - 0.2);
    const ax = s.centre.x + s.along.x * Math.max(-lim, Math.min(lim, t)) - pos.x;
    const az = s.centre.z + s.along.z * Math.max(-lim, Math.min(lim, t)) - pos.z;
    const d = Math.hypot(ax, az);
    if (d < 0.4) return true;
    const y = Math.max(pos.y + 1.0, s.spec.bottom + 0.15);
    const hit = this.colliders.raycast(pos.x, y, pos.z, ax / d, 0, az / d, d, false, reachHit);
    return hit >= d - 0.2 || reachHit.box?.barrierId === s.spec.id;
  }

  /** This barrier as a target, if it's within range and nothing solid is in the way. */
  target(id: number, pos: THREE.Vector3, range: number): BarrierTarget | null {
    const p = this.closestPoint(id, pos);
    const d = Math.hypot(p.x - pos.x, p.z - pos.z);
    if (d > range || !this.reachable(this.slots[id], pos)) return null;
    return { id, dist: d, side: this.sideOf(id, pos) };
  }

  /** The keypad within reach that you're facing, scored like other targets (lower is better). */
  nearestKeypad(pos: THREE.Vector3, yaw: number, range: number): { id: number; score: number } | null {
    for (const s of this.specs) {
      if (!s.keypad) continue;
      const dx = s.keypad.x - pos.x;
      const dz = s.keypad.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d > range) continue;
      // Only from the side it's mounted on.
      if (dx * s.keypad.nx + dz * s.keypad.nz > 0) continue;
      const facing = d > 1e-3 ? (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / d : 1;
      if (facing < 0.5 && d > 0.5) continue;
      return { id: s.id, score: d - facing * 0.8 };
    }
    return null;
  }

  // -------------------------------------------------------------- actions

  open(id: number, side: Side): string | null {
    const why = openDoor(this.world.barriers[id], side);
    this.refresh(id);
    return why;
  }

  close(id: number): string | null {
    const why = closeDoor(this.world.barriers[id]);
    this.refresh(id);
    return why;
  }

  bolt(id: number, side: Side): string | null {
    const why = toggleBolt(this.world.barriers[id], side);
    this.refresh(id);
    return why;
  }

  hit(id: number, dmg: number, side: Side): HitResult {
    const r = hitBarrier(this.world.barriers[id], dmg, side);
    this.refresh(id);
    return r;
  }

  push(id: number, side: Side): boolean {
    const ok = pushOpen(this.world.barriers[id], side);
    if (ok) this.refresh(id);
    return ok;
  }

  breakGlass(id: number): boolean {
    const ok = simBreakGlass(this.world.barriers[id]);
    this.refresh(id);
    return ok;
  }

  clear(id: number): boolean {
    const ok = clearGlass(this.world.barriers[id]);
    this.refresh(id);
    return ok;
  }

  board(id: number, side: Side): boolean {
    const ok = addBoard(this.world.barriers[id], side);
    this.refresh(id);
    return ok;
  }

  pry(id: number, side: Side): { planks: number } | null {
    const got = removeBoard(this.world.barriers[id], side);
    this.refresh(id);
    return got;
  }

  /** An empty window frame: arms and blades reach through it (glass and boards stop them). */
  reachThrough(id: number): boolean {
    const b = this.world.barriers[id];
    return b.kind === "window" && b.glass !== "intact" && b.boards.length === 0;
  }

  /** Every way into the building from outside is shut to a zombie. */
  sealed(address: string): boolean {
    return this.specs.every(
      (s) => s.building !== address || s.role === "interior" || s.role === "armory" || zombieAccess(this.world.barriers[s.id], 1) === "blocking",
    );
  }

  access(id: number, from: Side): ZombieAccess {
    return zombieAccess(this.world.barriers[id], from);
  }

  cost(id: number) {
    return boardCost(this.world.barriers[id]);
  }

  /**
   * A climb through a window from one side, lined up with where you stand.
   * Null if the far side has no room to land.
   */
  traversal(id: number, from: Side, pos: { x: number; z: number }, zombie = false): Traversal | null {
    const s = this.slots[id];
    if (s.spec.kind !== "window") return null;
    const t = (pos.x - s.centre.x) * s.along.x + (pos.z - s.centre.z) * s.along.z;
    const lim = Math.max(0, s.spec.width / 2 - 0.4);
    const off = Math.max(-lim, Math.min(lim, t));
    const base = new THREE.Vector3().copy(s.centre).addScaledVector(s.along, off);
    const start = base.clone().addScaledVector(s.n, from * 0.5);
    const to = this.landing(s, base, from);
    if (!to) return null;
    const sill = { sill: s.spec.bottom } as Barrier;
    return { from: start, to, dur: zombie ? zombieClimbSeconds(sill) : vaultSeconds(sill), peak: s.spec.bottom + 0.15 };
  }

  /** The first clear spot on the far side: straight in first, then further in and sideways. */
  private landing(s: Slot, base: THREE.Vector3, from: Side): THREE.Vector3 | null {
    for (const d of WINDOW.landing) {
      for (const side of WINDOW.landingSideways) {
        const to = base.clone().addScaledVector(s.n, -from * d).addScaledVector(s.along, side);
        const probe = { x: to.x, z: to.z };
        this.colliders.resolveCylinder(probe, 0.35, 0.05, 1.7);
        if (Math.hypot(probe.x - to.x, probe.z - to.z) < 1e-3) return to;
      }
    }
    return null;
  }

  /**
   * Can a body get through this opening going from `from` to the other side?
   * Doors need a walkable cell in the doorway; windows also need somewhere to
   * land. Furniture never moves, so this is worked out once.
   */
  crossable(id: number, from: Side): boolean {
    return this.slots[id].crossable[from === 1 ? 0 : 1];
  }

  // ------------------------------------------------------- access control

  /** Controller power for every door it drives. Returns doors whose lock just let go or bit. */
  setControllerPower(controller: string, powered: boolean): { id: number; change: "released" | "engaged" }[] {
    const out: { id: number; change: "released" | "engaged" }[] = [];
    for (const id of this.electronic) {
      const b = this.world.barriers[id];
      if (b.electronic?.controller !== controller) continue;
      const change = setLockPower(b, powered);
      if (change) {
        out.push({ id, change });
        this.refresh(id);
      }
    }
    return out;
  }

  /** A console command from the controller's shell. Returns the barrier id it acted on. */
  command(controller: string, door: string, action: "lock" | "unlock" | "pulse"): number | null {
    for (const id of this.electronic) {
      const b = this.world.barriers[id];
      if (b.electronic?.controller !== controller || b.electronic.name !== door) continue;
      lockCommand(b, action);
      this.refresh(id);
      return id;
    }
    return null;
  }

  keypad(id: number, code: string) {
    const r = keypadEnter(this.world.barriers[id], code);
    this.refresh(id);
    return r;
  }

  /** Doors on a controller as its console reports them. */
  accessRows(controller: string) {
    return this.electronic
      .map((id) => this.world.barriers[id])
      .filter((b) => b.electronic?.controller === controller)
      .map((b) => accessRow(b)!);
  }
}

// --------------------------------------------------------------- geometry

function leafWidth(s: BarrierSpec) {
  return (s.width - 2 * JAMB) / s.leaves - (s.leaves === 2 ? 0.004 : 0.006);
}

function leafHeight(s: BarrierSpec) {
  return s.top - 0.04 - 0.01;
}

/** A box with a flat vertex colour, for merging into one leaf geometry. Paintable parts take the door's paint. */
function part(w: number, h: number, d: number, x: number, y: number, z: number, color: string, paint = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setAttribute("paint", new THREE.BufferAttribute(new Float32Array(n).fill(paint), 1));
  return g;
}

/**
 * Instance colour normally tints a whole instance; here it only tints the
 * parts marked paintable, so a red door keeps its brass handle.
 */
function paintable(mat: THREE.MeshStandardMaterial) {
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float paint;")
      .replace(
        "#include <color_vertex>",
        THREE.ShaderChunk.color_vertex.replace("vColor.xyz *= instanceColor.xyz;", "vColor.xyz *= mix( vec3( 1.0 ), instanceColor.xyz, paint );"),
      );
  };
  mat.customProgramCacheKey = () => "paintable-leaf";
  return mat;
}

/**
 * One door leaf in local space: hinge edge on x = 0, free edge on x = w, floor
 * at y = 0, centred on z (both faces get handles).
 */
function leafGeometry(build: DoorBuild, w: number, h: number, t: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const lever = (y: number, color: string) => {
    for (const side of [-1, 1]) {
      const z = side * (t / 2 + 0.006);
      parts.push(part(0.055, 0.055, 0.012, w - 0.065, y, z, color)); // rose
      parts.push(part(0.02, 0.02, 0.05, w - 0.065, y, side * (t / 2 + 0.03), color)); // spindle
      parts.push(part(0.12, 0.02, 0.02, w - 0.11, y, side * (t / 2 + 0.055), color)); // lever towards the hinge
    }
  };
  switch (build) {
    case "hollow":
      parts.push(part(w, h, t, w / 2, h / 2, 0, "#d9d4c7"));
      lever(1.0, "#a9a9a4");
      break;
    case "solid": {
      parts.push(part(w, h, t, w / 2, h / 2, 0, "#ffffff", 1));
      // Raised panels on both faces, a shade darker in their recesses.
      for (const side of [-1, 1]) {
        const z = side * (t / 2 + 0.004);
        parts.push(part(w - 0.26, h * 0.36, 0.01, w / 2, h * 0.73, z, "#e6e6e6", 1));
        parts.push(part(w - 0.26, h * 0.36, 0.01, w / 2, h * 0.27, z, "#e6e6e6", 1));
        parts.push(part(w - 0.3, h * 0.32, 0.012, w / 2, h * 0.73, z * 1.05, "#f4f4f4", 1));
        parts.push(part(w - 0.3, h * 0.32, 0.012, w / 2, h * 0.27, z * 1.05, "#f4f4f4", 1));
      }
      lever(1.0, "#b39a5c");
      // Deadbolt: thumbturn one side, key cylinder the other.
      parts.push(part(0.045, 0.045, t + 0.03, w - 0.065, 1.18, 0, "#b39a5c"));
      break;
    }
    case "glass": {
      const al = "#3c3f42";
      parts.push(part(0.09, h, t, 0.045, h / 2, 0, al));
      parts.push(part(0.09, h, t, w - 0.045, h / 2, 0, al));
      parts.push(part(w - 0.18, 0.09, t, w / 2, h - 0.045, 0, al));
      parts.push(part(w - 0.18, 0.25, t, w / 2, 0.125, 0, al));
      // Push bars across both faces.
      for (const side of [-1, 1]) parts.push(part(w * 0.7, 0.035, 0.035, w * 0.55, 1.02, side * (t / 2 + 0.045), "#b7babd"));
      for (const side of [-1, 1]) {
        parts.push(part(0.03, 0.03, 0.04, w * 0.22, 1.02, side * (t / 2 + 0.02), "#b7babd"));
        parts.push(part(0.03, 0.03, 0.04, w * 0.88, 1.02, side * (t / 2 + 0.02), "#b7babd"));
      }
      break;
    }
    case "steel":
      parts.push(part(w, h, t, w / 2, h / 2, 0, "#5b6367"));
      for (const side of [-1, 1]) parts.push(part(w - 0.06, 0.25, 0.004, w / 2, 0.16, side * (t / 2 + 0.002), "#80868b"));
      lever(1.02, "#2b2c2d");
      break;
  }
  const merged = mergeGeometries(parts, false)!;
  for (const p of parts) p.dispose();
  return merged;
}

/** Jagged shards around the inside of a unit frame (x, y in [-0.5, 0.5]). */
function shardGeometry(): THREE.BufferGeometry {
  const pos: number[] = [];
  let seed = 9;
  const r = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const edge = (ax: number, ay: number, bx: number, by: number, nx: number, ny: number, count: number) => {
    for (let i = 0; i < count; i++) {
      const t0 = i / count;
      const t1 = (i + 1) / count;
      const tm = (t0 + t1) / 2 + (r() - 0.5) * 0.08;
      const depth = 0.04 + r() * 0.22;
      const x0 = ax + (bx - ax) * t0;
      const y0 = ay + (by - ay) * t0;
      const x1 = ax + (bx - ax) * t1;
      const y1 = ay + (by - ay) * t1;
      const xm = ax + (bx - ax) * tm + nx * depth;
      const ym = ay + (by - ay) * tm + ny * depth;
      pos.push(x0, y0, 0, x1, y1, 0, xm, ym, 0);
    }
  };
  edge(-0.5, -0.5, 0.5, -0.5, 0, 1, 9);
  edge(0.5, 0.5, -0.5, 0.5, 0, -1, 9);
  edge(-0.5, 0.5, -0.5, -0.5, 1, 0, 7);
  edge(0.5, -0.5, 0.5, 0.5, -1, 0, 7);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
