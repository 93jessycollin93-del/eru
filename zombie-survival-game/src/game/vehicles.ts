import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { VEHICLES, loadVehicle, rollVehicle, type VehicleKind, type VehicleSpec, type VehicleState } from "../sim/vehicle";
import type { ColliderWorld } from "./world/colliders";
import type { Terrain } from "./world/terrain";
import type { LootContainer } from "./world/town";

/** Where the town left each car: its trunk is the container with this id. */
export interface VehicleSpot {
  id: number;
  x: number;
  z: number;
  yaw: number;
  color: string;
  fuel: number;
}

/**
 * Side profile of each body style, in metres from the car's centre (+z is the front):
 * where the hood meets the windscreen, where the roof starts and ends, where the rear glass meets
 * the trunk or tailgate, and the beltline under the windows.
 */
interface Profile {
  hoodEnd: number;
  roofFront: number;
  roofRear: number;
  glassBase: number;
  belt: number;
  /** Pickups: an open bed behind the cab. */
  bed?: boolean;
}

const profile = (s: VehicleSpec): Profile => {
  const L2 = s.length / 2;
  switch (s.kind) {
    case "sedan":
      return { hoodEnd: L2 - 1.25, roofFront: L2 - 2.0, roofRear: -L2 + 1.35, glassBase: -L2 + 0.95, belt: 0.92 };
    case "hatchback":
      return { hoodEnd: L2 - 1.0, roofFront: L2 - 1.7, roofRear: -L2 + 0.5, glassBase: -L2 + 0.14, belt: 0.92 };
    case "van":
      return { hoodEnd: L2 - 0.6, roofFront: L2 - 1.25, roofRear: -L2 + 0.06, glassBase: -L2 + 0.02, belt: 1.05 };
    case "pickup":
      return { hoodEnd: L2 - 1.35, roofFront: L2 - 2.05, roofRear: L2 - 3.05, glassBase: L2 - 3.1, belt: 1.08, bed: true };
  }
};

/** Material slots, in the order body geometry groups use them. */
const SLOT = { body: 0, glass: 1, trim: 2, chrome: 3, head: 4, tail: 5, plate: 6 } as const;

type Parts = THREE.BufferGeometry[][];

const box = (parts: Parts, slot: number, w: number, h: number, d: number, x: number, y: number, z: number) => {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  parts[slot].push(g.toNonIndexed());
};

/** A side profile extruded across the car's width (centred), smoothed with a small bevel. */
const extrudeSide = (shape: THREE.Shape, width: number, bevel: number) => {
  const g = new THREE.ExtrudeGeometry(shape, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 10 });
  // Shape x is the car's length and extrusion runs along z: turn it so length is z and width is x.
  g.rotateY(-Math.PI / 2);
  g.translate((width - bevel * 2) / 2, 0, 0);
  return g.toNonIndexed();
};

const bodyCache = new Map<VehicleKind, THREE.BufferGeometry>();
const wheelCache = new Map<VehicleKind, THREE.BufferGeometry>();

/** One geometry per body style, its groups in SLOT order: every car of a kind shares it. */
function bodyGeometry(s: VehicleSpec): THREE.BufferGeometry {
  const cached = bodyCache.get(s.kind);
  if (cached) return cached;
  const p = profile(s);
  const L2 = s.length / 2;
  const W = s.width;
  const r = s.wheelRadius;
  const arch = r + 0.07;
  const sill = 0.3;
  const wz = s.wheelBase / 2;
  const parts: Parts = Object.values(SLOT).map(() => []);

  // Lower body: bottom edge with arches over the wheels, bumpers, hood, beltline, trunk.
  const lower = new THREE.Shape();
  lower.moveTo(-L2, sill + 0.04);
  lower.lineTo(-wz - arch, sill);
  lower.lineTo(-wz - arch, r);
  lower.absarc(-wz, r, arch, Math.PI, 0, true);
  lower.lineTo(-wz + arch, sill);
  lower.lineTo(wz - arch, sill);
  lower.lineTo(wz - arch, r);
  lower.absarc(wz, r, arch, Math.PI, 0, true);
  lower.lineTo(wz + arch, sill);
  lower.lineTo(L2, sill + 0.04);
  lower.lineTo(L2, 0.6);
  lower.quadraticCurveTo(L2 - 0.02, p.belt - 0.12, L2 - 0.2, p.belt - 0.1);
  lower.lineTo(p.hoodEnd, p.belt);
  lower.lineTo(p.glassBase, p.belt);
  lower.lineTo(-L2 + 0.12, p.belt - 0.03);
  lower.quadraticCurveTo(-L2, p.belt - 0.06, -L2, 0.62);
  lower.closePath();
  parts[SLOT.body].push(extrudeSide(lower, W, 0.05));

  // Glasshouse: narrower than the body, so the beltline reads as a shoulder.
  const cabin = new THREE.Shape();
  cabin.moveTo(p.hoodEnd, p.belt - 0.01);
  cabin.lineTo(p.roofFront, s.height - 0.05);
  cabin.lineTo(p.roofRear, s.height - 0.05);
  cabin.lineTo(p.glassBase, p.belt - 0.01);
  cabin.closePath();
  const cw = W * 0.86;
  parts[SLOT.glass].push(extrudeSide(cabin, cw, 0.02));
  // Roof panel and pillars in body colour.
  box(parts, SLOT.body, cw + 0.02, 0.06, p.roofFront - p.roofRear + 0.06, 0, s.height - 0.04, (p.roofFront + p.roofRear) / 2);
  const bPillar = (p.roofFront + p.roofRear) / 2 + (s.kind === "van" ? 0.6 : 0.05);
  box(parts, SLOT.trim, cw + 0.03, s.height - p.belt - 0.08, 0.09, 0, (s.height + p.belt) / 2 - 0.02, bPillar);
  if (s.kind === "van") box(parts, SLOT.body, cw + 0.03, s.height - p.belt - 0.1, (bPillar - p.roofRear) - 0.4, 0, (s.height + p.belt) / 2 - 0.03, (bPillar + p.roofRear) / 2 - 0.15);

  // Open bed: a dark floor sunk into the rear deck, with rails.
  if (p.bed) {
    const bedLen = p.glassBase - (-L2) - 0.2;
    box(parts, SLOT.trim, W * 0.86, 0.03, bedLen, 0, p.belt + 0.005, -L2 + 0.1 + bedLen / 2);
    for (const sx of [-1, 1]) box(parts, SLOT.body, 0.07, 0.1, bedLen + 0.1, sx * (W / 2 - 0.05), p.belt + 0.05, -L2 + 0.1 + bedLen / 2);
    box(parts, SLOT.body, W - 0.1, 0.12, 0.07, 0, p.belt + 0.03, -L2 + 0.06);
  }

  // Bumpers, grille, lights, plate, mirrors, door seams, handles.
  box(parts, SLOT.trim, W + 0.04, 0.2, 0.16, 0, 0.44, L2 - 0.02);
  box(parts, SLOT.trim, W + 0.04, 0.2, 0.16, 0, 0.44, -L2 + 0.02);
  box(parts, SLOT.trim, W * 0.48, 0.16, 0.04, 0, 0.68, L2 + 0.005);
  box(parts, SLOT.chrome, W * 0.5, 0.02, 0.045, 0, 0.77, L2 + 0.005);
  for (const sx of [-1, 1]) {
    box(parts, SLOT.head, 0.34, 0.13, 0.05, sx * (W / 2 - 0.27), 0.7, L2 - 0.005);
    box(parts, SLOT.tail, 0.28, 0.16, 0.05, sx * (W / 2 - 0.2), p.bed ? 0.85 : 0.8, -L2 + 0.005);
    box(parts, SLOT.body, 0.1, 0.09, 0.17, sx * (W / 2 + 0.05), p.belt + 0.11, p.hoodEnd - 0.12);
    box(parts, SLOT.glass, 0.02, 0.07, 0.14, sx * (W / 2 + 0.1), p.belt + 0.11, p.hoodEnd - 0.12);
    // Door seams and handles.
    const doorFront = p.hoodEnd - 0.05;
    const seams = s.kind === "hatchback" || s.kind === "pickup" ? [doorFront, bPillar - 0.04] : [doorFront, bPillar - 0.04, p.roofRear + 0.25];
    for (const z of seams) box(parts, SLOT.trim, 0.012, p.belt - sill - 0.12, 0.015, sx * (W / 2 + 0.001), (p.belt + sill) / 2 + 0.04, z);
    box(parts, SLOT.chrome, 0.02, 0.03, 0.14, sx * (W / 2 + 0.008), p.belt - 0.12, bPillar - 0.25);
    box(parts, SLOT.chrome, 0.02, 0.03, 0.14, sx * (W / 2 + 0.008), p.belt - 0.12, bPillar + (s.kind === "hatchback" ? -0.95 : 0.85));
    // Wheel-arch liners: dark plastic visible above the tyres.
    box(parts, SLOT.trim, 0.06, 0.05, arch * 1.8, sx * (W / 2 - 0.02), r + arch - 0.06, wz);
    box(parts, SLOT.trim, 0.06, 0.05, arch * 1.8, sx * (W / 2 - 0.02), r + arch - 0.06, -wz);
  }
  box(parts, SLOT.plate, 0.5, 0.12, 0.02, 0, 0.62, -L2 - 0.012);
  box(parts, SLOT.plate, 0.5, 0.12, 0.02, 0, 0.42, L2 + 0.075);
  // A rubbing strip along each flank and a dark rocker panel under the doors give the sides depth.
  for (const sx of [-1, 1]) {
    box(parts, SLOT.trim, 0.025, 0.05, (p.hoodEnd - 0.1) - (-L2 + 0.35), sx * (W / 2 + 0.012), sill + (p.belt - sill) * 0.42, (p.hoodEnd - 0.1 + (-L2 + 0.35)) / 2);
    box(parts, SLOT.trim, 0.03, 0.1, 2 * (wz - arch) - 0.04, sx * (W / 2 + 0.005), sill + 0.06, 0);
  }
  // Underbody shadow catcher.
  box(parts, SLOT.trim, W - 0.15, 0.08, s.length - 0.4, 0, sill + 0.02, 0);

  // Every slot has parts, so group i of the merged geometry is material slot i.
  const merged = mergeGeometries(parts.map((list) => mergeGeometries(list, false)!), true)!;
  merged.computeBoundingSphere();
  bodyCache.set(s.kind, merged);
  return merged;
}

/** Tyre (group 0) with rim and hub (group 1), axle along x. */
function wheelGeometry(s: VehicleSpec): THREE.BufferGeometry {
  const cached = wheelCache.get(s.kind);
  if (cached) return cached;
  const r = s.wheelRadius;
  const tyre = new THREE.CylinderGeometry(r, r, 0.22, 18).toNonIndexed();
  tyre.rotateZ(Math.PI / 2);
  // Two raised tread bands so the tyre reads as a tyre, not a drum.
  const treads = [-0.075, 0.075].map((off) => {
    const t = new THREE.TorusGeometry(r - 0.025, 0.035, 6, 18).toNonIndexed();
    t.rotateY(Math.PI / 2);
    t.translate(off, 0, 0);
    return t;
  });
  const rim = new THREE.CylinderGeometry(r * 0.62, r * 0.62, 0.232, 12).toNonIndexed();
  rim.rotateZ(Math.PI / 2);
  const hub = new THREE.CylinderGeometry(r * 0.18, r * 0.18, 0.25, 8).toNonIndexed();
  hub.rotateZ(Math.PI / 2);
  // Spokes make the spin visible.
  const spokes: THREE.BufferGeometry[] = [rim, hub];
  for (let i = 0; i < 5; i++) {
    const sp = new THREE.BoxGeometry(0.24, r * 0.9, 0.05).toNonIndexed();
    sp.rotateX((i / 5) * Math.PI);
    spokes.push(sp);
  }
  const g = mergeGeometries([mergeGeometries([tyre, ...treads], false)!, mergeGeometries(spokes, false)!], true)!;
  wheelCache.set(s.kind, g);
  return g;
}

const shared = {
  // Tinted glass that catches the sky: lighter and glossier than a black slab.
  glass: new THREE.MeshStandardMaterial({ color: "#5d6f7d", roughness: 0.08, metalness: 0.35, envMapIntensity: 1.6 }),
  trim: new THREE.MeshStandardMaterial({ color: "#1a1b1c", roughness: 0.85 }),
  chrome: new THREE.MeshStandardMaterial({ color: "#c3c7ca", roughness: 0.25, metalness: 0.9 }),
  plate: new THREE.MeshStandardMaterial({ color: "#d9d6c8", roughness: 0.6 }),
  tyre: new THREE.MeshStandardMaterial({ color: "#121212", roughness: 0.95 }),
};
const paintCache = new Map<string, THREE.MeshStandardMaterial>();

/** Paint weathered by days in the open: dustier, duller, a little faded. */
const paint = (color: string, wear: number) => {
  const key = `${color}:${wear}`;
  let m = paintCache.get(key);
  if (!m) {
    const c = new THREE.Color(color).lerp(new THREE.Color("#8a8472"), wear * 0.12);
    m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.32 + wear * 0.14, metalness: 0.45 - wear * 0.08 });
    paintCache.set(key, m);
  }
  return m;
};

export class VehicleObject {
  readonly spec: VehicleSpec;
  readonly root = new THREE.Group();
  /** Body roll and pitch from acceleration ride on this, under the root's terrain tilt. */
  readonly chassis = new THREE.Group();
  readonly body: THREE.Mesh;
  readonly wheels: { pivot: THREE.Group; mesh: THREE.Mesh; front: boolean }[] = [];
  readonly headMat: THREE.MeshStandardMaterial;
  readonly tailMat: THREE.MeshStandardMaterial;
  collider = -1;
  private spin = 0;

  constructor(
    public state: VehicleState,
    public readonly spot: VehicleSpot,
    public readonly container: LootContainer | undefined,
  ) {
    this.spec = VEHICLES[state.kind];
    const s = this.spec;
    this.headMat = new THREE.MeshStandardMaterial({ color: "#e9e4d0", emissive: "#fff3d0", emissiveIntensity: 0, roughness: 0.2 });
    this.tailMat = new THREE.MeshStandardMaterial({ color: "#5a0d0b", emissive: "#ff1a10", emissiveIntensity: 0, roughness: 0.3 });
    const wear = Math.round((100 - state.body) / 25);
    const mats = [paint(state.color, wear), shared.glass, shared.trim, shared.chrome, this.headMat, this.tailMat, shared.plate];
    this.body = new THREE.Mesh(bodyGeometry(s), mats);
    this.body.castShadow = true;
    this.body.receiveShadow = true;
    this.chassis.add(this.body);
    const wg = wheelGeometry(s);
    for (const [sx, sz] of [
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ]) {
      const pivot = new THREE.Group();
      // Tyres sit flush with the body's flank, as on a real car.
      pivot.position.set(sx * (s.width / 2 - 0.09), s.wheelRadius, sz * (s.wheelBase / 2));
      const mesh = new THREE.Mesh(wg, [shared.tyre, shared.chrome]);
      mesh.castShadow = true;
      pivot.add(mesh);
      this.root.add(pivot);
      this.wheels.push({ pivot, mesh, front: sz > 0 });
    }
    this.root.add(this.chassis);
  }

  /** Corner offsets of the footprint, for terrain tilt and collisions. */
  private corner(sx: number, sz: number) {
    const s = this.spec;
    const lx = sx * (s.width / 2 - 0.13);
    const lz = sz * (s.wheelBase / 2);
    const c = Math.cos(this.state.yaw);
    const sn = Math.sin(this.state.yaw);
    return { x: this.state.x + lx * c + lz * sn, z: this.state.z - lx * sn + lz * c };
  }

  /** Sit the car on the ground, tilted to the terrain; lean the body with acceleration (m/s²). */
  pose(terrain: Terrain, dt: number, accel = 0, lateral = 0) {
    const h = (sx: number, sz: number) => {
      const c = this.corner(sx, sz);
      return terrain.height(c.x, c.z);
    };
    const fl = h(1, 1);
    const fr = h(-1, 1);
    const rl = h(1, -1);
    const rr = h(-1, -1);
    const s = this.spec;
    const pitch = Math.atan2((fl + fr) / 2 - (rl + rr) / 2, s.wheelBase);
    const roll = Math.atan2((fl + rl) / 2 - (fr + rr) / 2, s.width - 0.26);
    this.root.position.set(this.state.x, (fl + fr + rl + rr) / 4, this.state.z);
    this.root.rotation.set(-pitch, this.state.yaw, roll, "YXZ");
    // Squat under power, dive under braking, lean out of corners: a few degrees at most.
    const k = Math.min(1, dt * 6);
    this.chassis.rotation.x += (THREE.MathUtils.clamp(-accel * 0.005, -0.05, 0.05) - this.chassis.rotation.x) * k;
    this.chassis.rotation.z += (THREE.MathUtils.clamp(lateral * 0.006, -0.06, 0.06) - this.chassis.rotation.z) * k;
    // Wheels roll with the road and the fronts steer.
    this.spin += (this.state.speed / s.wheelRadius) * dt;
    const maxSteer = Math.atan(s.wheelBase / s.turnRadius);
    for (const w of this.wheels) {
      w.mesh.rotation.x = this.spin;
      if (w.front) w.pivot.rotation.y = -this.state.steer * maxSteer;
    }
  }

  setLights(head: boolean, brake: boolean, reversing: boolean) {
    this.headMat.emissiveIntensity = head ? 2.2 : 0;
    this.tailMat.emissiveIntensity = brake ? 2.4 : head ? 0.8 : 0;
    this.tailMat.emissive.set(reversing ? "#fff6e8" : "#ff1a10");
  }

  /** Points along the car's centreline, each the centre of a circle as wide as the car. */
  hitCircles(): { x: number; z: number; r: number }[] {
    const s = this.spec;
    const r = s.width / 2;
    const off = s.length / 2 - r;
    const fx = Math.sin(this.state.yaw);
    const fz = Math.cos(this.state.yaw);
    return [-off, 0, off].map((o) => ({ x: this.state.x + fx * o, z: this.state.z + fz * o, r }));
  }

  /** Distance from a point to the car's footprint (0 inside). */
  distanceTo(x: number, z: number) {
    const dx = x - this.state.x;
    const dz = z - this.state.z;
    const c = Math.cos(this.state.yaw);
    const sn = Math.sin(this.state.yaw);
    const lx = dx * c - dz * sn;
    const lz = dx * sn + dz * c;
    const ex = Math.max(0, Math.abs(lx) - this.spec.width / 2);
    const ez = Math.max(0, Math.abs(lz) - this.spec.length / 2);
    return Math.hypot(ex, ez);
  }

  /** The driver's door, on the left for this county's cars (+x in the car's own frame). */
  doorPoint(side: 1 | -1 = 1, out = 0.75) {
    const s = this.spec;
    const lx = side * (s.width / 2 + out);
    const lz = s.wheelBase * 0.12;
    const c = Math.cos(this.state.yaw);
    const sn = Math.sin(this.state.yaw);
    return { x: this.state.x + lx * c + lz * sn, z: this.state.z - lx * sn + lz * c };
  }
}

/** Every car in town: building, parking (colliders), saving. Driving itself lives in Game. */
export class VehicleSystem {
  readonly list: VehicleObject[] = [];

  constructor(
    private scene: THREE.Object3D,
    private colliders: ColliderWorld,
    private terrain: Terrain,
  ) {}

  build(spots: VehicleSpot[], containers: LootContainer[]) {
    const byId = new Map(containers.map((c) => [c.id, c]));
    for (const spot of spots) {
      const v = new VehicleObject(rollVehicle(spot.id, spot.x, spot.z, spot.yaw, spot.color, spot.fuel), spot, byId.get(spot.id));
      this.list.push(v);
      this.scene.add(v.root);
      v.pose(this.terrain, 1);
      this.park(v);
    }
  }

  byId(id: number) {
    return this.list.find((v) => v.state.id === id);
  }

  /** Back to where the town left them, as found. */
  reset() {
    for (const v of this.list) {
      v.state = rollVehicle(v.spot.id, v.spot.x, v.spot.z, v.spot.yaw, v.spot.color, v.container?.fuel ?? v.spot.fuel);
      v.setLights(false, false, false);
      v.pose(this.terrain, 1);
      this.park(v);
    }
  }

  load(saved: unknown) {
    const list = Array.isArray(saved) ? saved : [];
    for (const v of this.list) {
      const raw = list.find((r) => r && typeof r === "object" && (r as { id?: unknown }).id === v.state.id);
      v.state = loadVehicle(rollVehicle(v.spot.id, v.spot.x, v.spot.z, v.spot.yaw, v.spot.color, v.container?.fuel ?? v.spot.fuel), raw);
      // The trunk's fuel record is the tank: siphoning and driving both write it.
      if (v.container?.fuel !== undefined) v.state.fuel = Math.min(v.container.fuel, v.spec.tankL);
      v.pose(this.terrain, 1);
      this.park(v);
    }
  }

  /** The car stops being an obstacle while it moves (the driven car resolves its own collisions). */
  unpark(v: VehicleObject) {
    if (v.collider >= 0) this.colliders.setEnabled(v.collider, false);
  }

  /** Make the car a solid box where it stands, and move its trunk with it. */
  park(v: VehicleObject) {
    if (v.collider >= 0) this.colliders.setEnabled(v.collider, false);
    const s = v.spec;
    const c = Math.abs(Math.cos(v.state.yaw));
    const sn = Math.abs(Math.sin(v.state.yaw));
    // The box hugs the rotated footprint a little inside it, so the gaps at an angled car's corners stay walkable.
    const hx = (c * s.width) / 2 + (sn * s.length) / 2 - 0.08;
    const hz = (sn * s.width) / 2 + (c * s.length) / 2 - 0.08;
    const y = this.terrain.height(v.state.x, v.state.z);
    v.collider = this.colliders.add({ minX: v.state.x - hx, maxX: v.state.x + hx, minY: y, maxY: y + s.height, minZ: v.state.z - hz, maxZ: v.state.z + hz, occludes: false });
    this.syncContainer(v);
  }

  syncContainer(v: VehicleObject) {
    if (!v.container) return;
    const s = v.spec;
    const c = Math.abs(Math.cos(v.state.yaw));
    const sn = Math.abs(Math.sin(v.state.yaw));
    v.container.x = v.state.x;
    v.container.z = v.state.z;
    v.container.y = this.terrain.height(v.state.x, v.state.z) + 0.8;
    v.container.hx = (c * s.width) / 2 + (sn * s.length) / 2;
    v.container.hz = (sn * s.width) / 2 + (c * s.length) / 2;
    v.container.fuel = v.state.fuel;
    v.container.name = s.name;
  }

  nearest(x: number, z: number, range: number) {
    let best: VehicleObject | null = null;
    let bd = range;
    for (const v of this.list) {
      const d = v.distanceTo(x, z);
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    return best;
  }

  /** Shadows and visibility by distance, as for zombies. */
  updateDetail(px: number, pz: number) {
    for (const v of this.list) {
      const d = Math.hypot(v.state.x - px, v.state.z - pz);
      v.root.visible = d < 160;
      const near = d < 45;
      if (v.body.castShadow !== near) {
        v.body.castShadow = near;
        for (const w of v.wheels) w.mesh.castShadow = near;
      }
    }
  }
}

/**
 * Push the moving car out of anything solid. Returns the closing speed of the hit (m/s along the
 * contact normal, 0 when nothing was hit) after taking that part of the velocity out.
 */
export function resolveVehicle(v: VehicleObject, colliders: ColliderWorld, groundY: number): number {
  let px = 0;
  let pz = 0;
  for (const c of v.hitCircles()) {
    const p = { x: c.x, z: c.z };
    if (colliders.resolveCylinder(p, c.r, groundY + 0.05, 1.4)) {
      const dx = p.x - c.x;
      const dz = p.z - c.z;
      if (Math.abs(dx) > Math.abs(px)) px = dx;
      if (Math.abs(dz) > Math.abs(pz)) pz = dz;
    }
  }
  const len = Math.hypot(px, pz);
  if (len < 1e-5) return 0;
  v.state.x += px;
  v.state.z += pz;
  const nx = px / len;
  const nz = pz / len;
  const fx = Math.sin(v.state.yaw);
  const fz = Math.cos(v.state.yaw);
  const vx = fx * v.state.speed;
  const vz = fz * v.state.speed;
  const closing = -(vx * nx + vz * nz);
  if (closing <= 0) return 0;
  // Lose the speed into the wall, with a small bounce, and keep what slides along it.
  const bx = vx + nx * closing * 1.2;
  const bz = vz + nz * closing * 1.2;
  v.state.speed = bx * fx + bz * fz;
  return closing;
}
