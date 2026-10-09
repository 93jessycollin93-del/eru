import * as THREE from "three";
import { createComputerState, type ComputerState } from "../../sim/computer";
import { houseLaptop, policeComputer, storeComputer, type TownFacts } from "../../sim/computerContent";
import { makeStack, type ItemStack } from "../../sim/items";
import { mulberry32, pick, range } from "../../sim/rng";
import { MeshBuilder } from "./builder";
import type { ColliderWorld } from "./colliders";
import { WORLD_HALF, type Terrain } from "./terrain";

export interface LootContainer {
  id: number;
  name: string;
  table: string;
  x: number;
  y: number;
  z: number;
  /** Half extents of its footprint, for "am I close enough" checks. */
  hx: number;
  hz: number;
  /** Rolled the first time it is opened. */
  items: ItemStack[] | null;
  /** Placed items added to the roll (notes, supply caches). */
  preset?: ItemStack[];
}

export interface ComputerSpot {
  id: number;
  /** Where you stand to use it. */
  x: number;
  y: number;
  z: number;
  hx: number;
  hz: number;
  kind: "desktop" | "laptop";
  address: string;
  /** The machine itself (filesystem, session, battery). */
  state: ComputerState;
  initialBattery: number | null;
  screen: THREE.Mesh;
}

export interface Building {
  address: string;
  type: BuildingType;
  rect: Rect;
  containers: LootContainer[];
  computer?: ComputerSpot;
}

export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface TownData {
  group: THREE.Group;
  containers: LootContainer[];
  /** Places inside buildings and on streets where zombies like to gather. */
  spawnPoints: THREE.Vector3[];
  /** Roads and building lots, so vegetation can avoid them. */
  occupied: Rect[];
  playerSpawn: THREE.Vector3;
  buildings: Building[];
  computers: ComputerSpot[];
  facts: TownFacts;
  /** Street lamp bulbs: glow at night while the grid is up. */
  lampMaterial: THREE.MeshStandardMaterial;
}

export type BuildingType = "house" | "store" | "hardware" | "police";

const WALL_COLORS = ["#c9c2b0", "#b8ad8f", "#9a5b45", "#8c9396", "#c4b48a", "#a7a28f", "#7f8a7a"];
const ROOF_COLORS = ["#3b3a38", "#4a3a32", "#2f3437", "#45403a"];
const CAR_COLORS = ["#5b6770", "#6d4a3a", "#3e4d3f", "#8b8a83", "#2f3a4a", "#7a3b33"];
const WALL_H = 3.0;
const WALL_T = 0.25;
const ROAD_HALF = 4;
const SIDEWALK = 2;

interface Opening {
  c: number;
  w: number;
  b: number;
  t: number;
}

export function generateTown(rng: () => number, terrain: Terrain, colliders: ColliderWorld): TownData {
  const mb = new MeshBuilder();
  const containers: LootContainer[] = [];
  const spawnPoints: THREE.Vector3[] = [];
  const occupied: Rect[] = [];
  const lots: Rect[] = [];
  let containerId = 1;
  const buildings: Building[] = [];
  const computers: ComputerSpot[] = [];
  const usedAddresses = new Set<string>();
  /** Things to finish once every building exists (computers need town facts). */
  const pendingComputers: { b: Building; spot: Omit<ComputerSpot, "state" | "address" | "initialBattery">; contentType: BuildingType }[] = [];
  const crateBuilders = new Map<Building, () => LootContainer>();

  const asphalt = mb.material("#2c2d2e", { roughness: 0.95 });
  const sidewalk = mb.material("#6e6c66");
  const paint = mb.material("#b9b29a", { roughness: 0.8 });

  // ---------- roads ----------

  const hRoads = [
    { z: 0, x0: -WORLD_HALF, x1: WORLD_HALF, name: "Main Street" },
    { z: -60, x0: -96, x1: 96, name: "Oak Avenue" },
    { z: 60, x0: -96, x1: 96, name: "Elm Street" },
  ];
  const vRoads = [
    { x: -66, z0: -96, z1: 96, name: "Cedar Road" },
    { x: 0, z0: -96, z1: 96, name: "Pine Street" },
    { x: 66, z0: -96, z1: 96, name: "Birch Lane" },
  ];

  const flatPlane = (cx: number, cz: number, w: number, d: number, y: number, mat: string) => {
    const g = new THREE.PlaneGeometry(w, d);
    g.rotateX(-Math.PI / 2);
    g.translate(cx, y, cz);
    mb.add(g, mat);
  };

  // The highway leaves town, so drape it over the terrain.
  {
    const step = 2;
    const verts: number[] = [];
    const idx: number[] = [];
    let i = 0;
    for (let x = -WORLD_HALF; x <= WORLD_HALF; x += step) {
      for (const z of [-ROAD_HALF, ROAD_HALF]) verts.push(x, terrain.height(x, z) + 0.06, z);
      if (i > 0) {
        const a = (i - 1) * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      i++;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(new Array((verts.length / 3) * 2).fill(0), 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    mb.add(g, asphalt);
    for (let x = -WORLD_HALF + 3; x < WORLD_HALF; x += 9) {
      if (rng() < 0.15) continue; // faded paint
      const g2 = new THREE.PlaneGeometry(3, 0.18);
      g2.rotateX(-Math.PI / 2);
      g2.translate(x, terrain.height(x, 0) + 0.08, 0);
      mb.add(g2, paint);
    }
    occupied.push({ minX: -WORLD_HALF, maxX: WORLD_HALF, minZ: -ROAD_HALF - SIDEWALK, maxZ: ROAD_HALF + SIDEWALK });
  }

  for (const r of hRoads.slice(1)) {
    flatPlane((r.x0 + r.x1) / 2, r.z, r.x1 - r.x0, ROAD_HALF * 2, 0.03, asphalt);
    occupied.push({ minX: r.x0, maxX: r.x1, minZ: r.z - ROAD_HALF - SIDEWALK, maxZ: r.z + ROAD_HALF + SIDEWALK });
  }
  for (const r of vRoads) {
    flatPlane(r.x, (r.z0 + r.z1) / 2, ROAD_HALF * 2, r.z1 - r.z0, 0.035, asphalt);
    occupied.push({ minX: r.x - ROAD_HALF - SIDEWALK, maxX: r.x + ROAD_HALF + SIDEWALK, minZ: r.z0, maxZ: r.z1 });
  }
  // Sidewalks inside town
  for (const r of hRoads) {
    const x0 = Math.max(r.x0, -100);
    const x1 = Math.min(r.x1, 100);
    for (const s of [-1, 1]) flatPlane((x0 + x1) / 2, r.z + s * (ROAD_HALF + SIDEWALK / 2), x1 - x0, SIDEWALK, 0.05, sidewalk);
  }
  for (const r of vRoads) {
    for (const s of [-1, 1]) flatPlane(r.x + s * (ROAD_HALF + SIDEWALK / 2), (r.z0 + r.z1) / 2, SIDEWALK, r.z1 - r.z0, 0.055, sidewalk);
  }

  // ---------- buildings ----------

  const overlaps = (a: Rect, list: Rect[], margin: number) =>
    list.some(
      (b) => a.minX - margin < b.maxX && a.maxX + margin > b.minX && a.minZ - margin < b.maxZ && a.maxZ + margin > b.minZ,
    );

  const buildBuilding = (cx: number, cz: number, w: number, d: number, rot: number, type: BuildingType, address: string, rect: Rect) => {
    const m = new THREE.Matrix4().makeRotationY(rot).setPosition(cx, 0, cz);
    const building: Building = { address, type, rect, containers: [] };
    buildings.push(building);
    const wallColor = type === "police" ? "#7d8790" : pick(rng, WALL_COLORS);
    const wallMat = mb.material(wallColor);
    const innerMat = mb.material(type === "house" ? "#b7ae9c" : "#a9aaa5");
    const roofMat = mb.material(pick(rng, ROOF_COLORS));
    const floorMat = mb.material(type === "house" ? "#5e4632" : "#77746c");
    const woodMat = mb.material("#6b4f36");
    const whiteMat = mb.material("#c9c7c0");
    const metalMat = mb.material("#5d6266", { metalness: 0.4, roughness: 0.6 });
    const fabricMat = mb.material(pick(rng, ["#4b5a6b", "#6b4b4b", "#5b6b4b", "#77705f"]));

    const v1 = new THREE.Vector3();
    const v2 = new THREE.Vector3();
    /** Box in building-local coordinates. */
    const box = (
      x0: number,
      y0: number,
      z0: number,
      x1: number,
      y1: number,
      z1: number,
      mat: string,
      collide = true,
      occludes = true,
    ) => {
      const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
      g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      g.applyMatrix4(m);
      mb.add(g, mat);
      if (collide) {
        v1.set(x0, y0, z0).applyMatrix4(m);
        v2.set(x1, y1, z1).applyMatrix4(m);
        colliders.add({
          minX: Math.min(v1.x, v2.x),
          minY: y0,
          minZ: Math.min(v1.z, v2.z),
          maxX: Math.max(v1.x, v2.x),
          maxY: y1,
          maxZ: Math.max(v1.z, v2.z),
          occludes,
        });
      }
    };

    const container = (
      name: string,
      table: string,
      x0: number,
      y0: number,
      z0: number,
      x1: number,
      y1: number,
      z1: number,
      mat: string,
    ) => {
      box(x0, y0, z0, x1, y1, z1, mat, true, false);
      const c = new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2).applyMatrix4(m);
      const ext = new THREE.Vector3((x1 - x0) / 2, 0, (z1 - z0) / 2).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
      const lc: LootContainer = {
        id: containerId++,
        name,
        table,
        x: c.x,
        y: c.y,
        z: c.z,
        hx: Math.abs(ext.x),
        hz: Math.abs(ext.z),
        items: null,
      };
      containers.push(lc);
      building.containers.push(lc);
      return lc;
    };

    /** A computer sitting on a surface at local (lx, top, lz), screen facing local +z. */
    const placeComputer = (kind: "desktop" | "laptop", lx: number, top: number, lz: number) => {
      const dark = mb.material("#1d1f21", { roughness: 0.5 });
      const shell = mb.material(kind === "laptop" ? "#5d6166" : "#2a2c2f", { roughness: 0.45, metalness: 0.2 });
      let sw: number, sh: number, sy: number, sz: number;
      if (kind === "desktop") {
        box(lx - 0.05, top, lz - 0.1, lx + 0.05, top + 0.12, lz - 0.04, shell, false);
        box(lx - 0.28, top + 0.12, lz - 0.12, lx + 0.28, top + 0.47, lz - 0.07, shell, false);
        box(lx - 0.22, top, lz + 0.05, lx + 0.22, top + 0.025, lz + 0.2, dark, false);
        box(lx + 0.38, top, lz - 0.2, lx + 0.58, top + 0.42, lz + 0.2, shell, false);
        [sw, sh, sy, sz] = [0.52, 0.31, top + 0.295, lz - 0.068];
      } else {
        box(lx - 0.17, top, lz - 0.05, lx + 0.17, top + 0.02, lz + 0.19, shell, false);
        box(lx - 0.17, top + 0.02, lz - 0.07, lx + 0.17, top + 0.25, lz - 0.05, shell, false);
        [sw, sh, sy, sz] = [0.3, 0.2, top + 0.135, lz - 0.048];
      }
      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(sw, sh),
        new THREE.MeshStandardMaterial({ color: "#07090a", roughness: 0.25, metalness: 0.1, emissive: "#b8d4d8", emissiveIntensity: 0 }),
      );
      screen.position.set(lx, sy, sz).applyMatrix4(m);
      screen.rotation.y = rot;
      const stand = new THREE.Vector3(lx, top, lz + 0.35).applyMatrix4(m);
      pendingComputers.push({
        b: building,
        contentType: type,
        spot: { id: computers.length + pendingComputers.length + 1, x: stand.x, y: stand.y, z: stand.z, hx: 0.3, hz: 0.3, kind, screen },
      });
    };

    /** Wall running along local X (axis "x") or Z with gaps for doors and windows. */
    const wall = (axis: "x" | "z", fixed: number, from: number, to: number, openings: Opening[], mat: string) => {
      const piece = (a: number, b: number, y0: number, y1: number) => {
        if (b - a < 0.01 || y1 - y0 < 0.01) return;
        if (axis === "x") box(a, y0, fixed - WALL_T / 2, b, y1, fixed + WALL_T / 2, mat);
        else box(fixed - WALL_T / 2, y0, a, fixed + WALL_T / 2, y1, b, mat);
      };
      let cursor = from;
      for (const o of [...openings].sort((p, q) => p.c - q.c)) {
        const o0 = o.c - o.w / 2;
        const o1 = o.c + o.w / 2;
        piece(cursor, o0, 0, WALL_H);
        piece(o0, o1, 0, o.b);
        piece(o0, o1, o.t, WALL_H);
        cursor = o1;
      }
      piece(cursor, to, 0, WALL_H);
    };

    const hw = w / 2;
    const hd = d / 2;
    const door: Opening = { c: range(rng, -hw * 0.4, hw * 0.4), w: type === "house" ? 1.2 : 2.0, b: 0, t: 2.3 };
    const windowsAlong = (len: number, avoid: number | null): Opening[] => {
      const out: Opening[] = [];
      for (let p = -len / 2 + 2; p <= len / 2 - 2; p += 3.2) {
        if (avoid !== null && Math.abs(p - avoid) < 2.0) continue;
        if (rng() < 0.75) out.push({ c: p, w: 1.3, b: 1.0, t: 2.2 });
      }
      return out;
    };

    const frontOpenings =
      type === "store"
        ? [door, ...(door.c > 0 ? [{ c: door.c - 4, w: 4.5, b: 0.5, t: 2.5 }] : [{ c: door.c + 4, w: 4.5, b: 0.5, t: 2.5 }])]
        : [door, ...windowsAlong(w, door.c)];
    // Shells: front/back span the full width, sides fit between them.
    wall("x", hd - WALL_T / 2, -hw, hw, frontOpenings, wallMat);
    wall("x", -hd + WALL_T / 2, -hw, hw, windowsAlong(w, null), wallMat);
    wall("z", -hw + WALL_T / 2, -hd + WALL_T, hd - WALL_T, windowsAlong(d, null).filter(() => type !== "police" || rng() < 0.5), wallMat);
    wall("z", hw - WALL_T / 2, -hd + WALL_T, hd - WALL_T, windowsAlong(d, null), wallMat);

    // Floor (visual only, the town ground is flat) and roof.
    box(-hw + WALL_T, 0.0, -hd + WALL_T, hw - WALL_T, 0.06, hd - WALL_T, floorMat, false);
    box(-hw - 0.3, WALL_H, -hd - 0.3, hw + 0.3, WALL_H + 0.25, hd + 0.3, roofMat, true, true);
    // Light ceiling under the roof so interiors don't read as a black void.
    box(-hw + WALL_T, WALL_H - 0.04, -hd + WALL_T, hw - WALL_T, WALL_H, hd - WALL_T, mb.material("#bdb8aa"), false);
    // Door step and frame lintel trim
    box(door.c - door.w / 2 - 0.1, 0, hd, door.c + door.w / 2 + 0.1, 0.12, hd + 0.6, sidewalk, false);

    const inner = { x0: -hw + WALL_T, x1: hw - WALL_T, z0: -hd + WALL_T, z1: hd - WALL_T };

    if (type === "house") {
      const hasBedroom = d >= 9;
      const partZ = inner.z0 + (inner.z1 - inner.z0) * 0.42;
      if (hasBedroom) {
        const pd = range(rng, inner.x0 + 1.2, inner.x1 - 1.2);
        wall("x", partZ, inner.x0, inner.x1, [{ c: pd, w: 1.0, b: 0, t: 2.2 }], innerMat);
        // Bedroom: bed, wardrobe, nightstand
        const bedLeft = rng() < 0.5;
        const bx0 = bedLeft ? inner.x0 + 0.1 : inner.x1 - 1.5;
        box(bx0, 0, inner.z0 + 0.1, bx0 + 1.4, 0.5, inner.z0 + 2.1, fabricMat, true, false);
        const wx = bedLeft ? inner.x1 - 1.3 : inner.x0 + 0.1;
        container("Wardrobe", "bedroom", wx, 0, inner.z0 + 0.1, wx + 1.2, 2.0, inner.z0 + 0.7, woodMat);
        const nx = bedLeft ? bx0 + 1.5 : bx0 - 0.6;
        container("Nightstand", "bedroom", nx, 0, inner.z0 + 0.1, nx + 0.5, 0.6, inner.z0 + 0.6, woodMat);
        spawnPoints.push(new THREE.Vector3(0, 0, (inner.z0 + partZ) / 2).applyMatrix4(m));
      }
      // Kitchen along one side of the front room
      const front0 = hasBedroom ? partZ + WALL_T / 2 : inner.z0;
      const kLeft = rng() < 0.5;
      const kx0 = kLeft ? inner.x0 : inner.x1 - 0.65;
      const kz0 = front0 + 0.1;
      container("Kitchen Counter", "kitchen", kx0, 0, kz0, kx0 + 0.65, 0.92, kz0 + 2.2, woodMat);
      container("Fridge", "fridge", kx0, 0, kz0 + 2.3, kx0 + 0.7, 1.8, kz0 + 3.0, whiteMat);
      // Table and sofa
      const tz = (front0 + inner.z1) / 2;
      box(-0.7, 0, tz - 0.45, 0.7, 0.75, tz + 0.45, woodMat, true, false);
      if (rng() < 0.55) placeComputer("laptop", 0.15, 0.75, tz);
      // Corner by the front wall where a supply crate can go.
      const crateX = kLeft ? inner.x0 + 0.1 : inner.x1 - 1.0;
      crateBuilders.set(building, () =>
        container("Supply Crate", "supply_cache", crateX, 0, inner.z1 - 0.8, crateX + 0.9, 0.55, inner.z1 - 0.15, mb.material("#4a5236")),
      );
      const sx = kLeft ? inner.x1 - 0.9 : inner.x0;
      box(sx, 0, tz - 1.1, sx + 0.9, 0.8, tz + 1.1, fabricMat, true, false);
      spawnPoints.push(new THREE.Vector3(0, 0, tz).applyMatrix4(m));
    } else if (type === "store" || type === "hardware") {
      const table = type === "store" ? "store_shelf" : "hardware_shelf";
      const rows = type === "store" ? 3 : 2;
      const span = inner.x1 - inner.x0;
      for (let r = 0; r < rows; r++) {
        const x = inner.x0 + (span * (r + 1)) / (rows + 1);
        container(
          type === "store" ? "Store Shelf" : "Tool Shelf",
          table,
          x - 0.45,
          0,
          inner.z0 + 1.5,
          x + 0.45,
          1.7,
          inner.z1 - 3.2,
          metalMat,
        );
      }
      container("Shelf", table, inner.x0, 0, inner.z0 + 0.1, inner.x1, 1.9, inner.z0 + 0.7, metalMat);
      box(inner.x1 - 2.6, 0, inner.z1 - 2.2, inner.x1 - 0.4, 1.0, inner.z1 - 1.5, woodMat, true, false);
      placeComputer("desktop", inner.x1 - 1.6, 1.0, inner.z1 - 1.85);
      // Shop sign over the door
      box(-hw * 0.7, WALL_H - 0.7, hd, hw * 0.7, WALL_H - 0.1, hd + 0.12, mb.material(type === "store" ? "#8a2f24" : "#9a6a1f"), false);
      spawnPoints.push(new THREE.Vector3(0, 0, 0).applyMatrix4(m), new THREE.Vector3(0, 0, inner.z1 - 2).applyMatrix4(m));
    } else if (type === "police") {
      for (let i = 0; i < 4; i++) {
        const x = inner.x0 + 0.3 + i * 0.75;
        container("Police Locker", "police_locker", x, 0, inner.z0 + 0.1, x + 0.65, 1.9, inner.z0 + 0.6, metalMat);
      }
      box(-2, 0, -0.5, 0, 0.78, 0.5, woodMat, true, false);
      placeComputer("desktop", -1.1, 0.78, -0.05);
      box(1.5, 0, -0.5, 3.5, 0.78, 0.5, woodMat, true, false);
      container("Evidence Cabinet", "police_locker", inner.x1 - 0.7, 0, inner.z0 + 0.1, inner.x1 - 0.1, 1.4, inner.z0 + 1.6, metalMat);
      // Blue stripe on the facade
      box(-hw, 2.2, hd, hw, 2.45, hd + 0.05, mb.material("#2c4a7a"), false);
      spawnPoints.push(new THREE.Vector3(0, 0, 1.5).applyMatrix4(m), new THREE.Vector3(0, 0, -2).applyMatrix4(m));
    }
  };

  const required: BuildingType[] = ["police", "store", "hardware", "store", "hardware"];
  const nextType = (): BuildingType => {
    if (required.length) return required.shift()!;
    const r = rng();
    return r < 0.82 ? "house" : r < 0.93 ? "store" : "hardware";
  };
  const sizeFor = (t: BuildingType): [number, number] => {
    switch (t) {
      case "police":
        return [16, 12];
      case "store":
        return [range(rng, 13, 17), range(rng, 11, 14)];
      case "hardware":
        return [range(rng, 12, 15), range(rng, 10, 12)];
      default:
        return [range(rng, 8, 12), range(rng, 8, 11.5)];
    }
  };

  const tryPlace = (
    along: "x" | "z",
    roadPos: number,
    cursor: number,
    side: number,
    type: BuildingType,
    street: string,
  ): number | null => {
    const [w, d] = sizeFor(type);
    const setback = range(rng, 2.5, 6);
    const offset = ROAD_HALF + SIDEWALK + setback + d / 2;
    let cx: number, cz: number, rot: number, rect: Rect;
    if (along === "x") {
      cx = cursor + w / 2;
      cz = roadPos + side * offset;
      rot = side > 0 ? Math.PI : 0;
      rect = { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 };
    } else {
      cz = cursor + w / 2;
      cx = roadPos + side * offset;
      rot = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      rect = { minX: cx - d / 2, maxX: cx + d / 2, minZ: cz - w / 2, maxZ: cz + w / 2 };
    }
    if (Math.hypot(cx, cz) > 112) return null;
    if (overlaps(rect, occupied, 0.5) || overlaps(rect, lots, 2.5)) return null;
    lots.push(rect);
    // Odd numbers on one side of the street, even on the other.
    let n = Math.max(1, Math.round(((along === "x" ? cx : cz) + 110) / 5)) * 2 + (side > 0 ? 1 : 0);
    while (usedAddresses.has(`${n} ${street}`)) n += 2;
    const address = `${n} ${street}`;
    usedAddresses.add(address);
    buildBuilding(cx, cz, w, d, rot, type, address, rect);
    return w;
  };

  for (const r of hRoads) {
    for (const side of [-1, 1]) {
      let cursor = Math.max(r.x0, -100) + range(rng, 0, 6);
      while (cursor < Math.min(r.x1, 100)) {
        const placed = rng() < 0.85 ? tryPlace("x", r.z, cursor, side, nextType(), r.name) : null;
        cursor += (placed ?? 3) + range(rng, 3, 9);
      }
    }
  }
  for (const r of vRoads) {
    for (const side of [-1, 1]) {
      let cursor = r.z0 + range(rng, 0, 6);
      while (cursor < r.z1) {
        const placed = rng() < 0.85 ? tryPlace("z", r.x, cursor, side, nextType(), r.name) : null;
        cursor += (placed ?? 3) + range(rng, 3, 9);
      }
    }
  }
  occupied.push(...lots);

  // ---------- computers, notes and the supply cache ----------

  // Separate stream so tweaking computer content never reshuffles the town layout.
  const crng = mulberry32(Math.floor(rng() * 1e9));
  const police = buildings.find((b) => b.type === "police")!;
  const houses = buildings.filter((b) => b.type === "house" && crateBuilders.has(b));
  const stashHouse = pick(crng, houses);
  const facts: TownFacts = {
    policeAddress: police.address,
    stashAddress: stashHouse.address,
    powerOffDay: 3 + Math.floor(crng() * 3),
  };
  const crate = crateBuilders.get(stashHouse)!();
  crate.preset = [
    makeStack("pistol", 1, 15),
    makeStack("ammo_9mm", 30),
    makeStack("first_aid_kit"),
    makeStack("painkillers"),
    makeStack("canned_beans", 1),
    makeStack("canned_beans", 1),
    makeStack("canned_beans", 1),
    makeStack("water_bottle", 1),
    makeStack("water_bottle", 1),
    makeStack("water_bottle", 1),
  ];

  for (const { b, spot, contentType } of pendingComputers) {
    const gen =
      contentType === "police"
        ? policeComputer(facts, crng)
        : contentType === "store" || contentType === "hardware"
          ? storeComputer(facts, crng, contentType, b.address)
          : houseLaptop(facts, crng, b.address);
    const full: ComputerSpot = { ...spot, address: b.address, initialBattery: gen.battery, state: createComputerState(gen.def, gen.battery) };
    computers.push(full);
    b.computer = full;
    if (gen.note && b.containers.length) {
      const target = pick(crng, b.containers.filter((c) => c.table !== "supply_cache"));
      target.preset = [...(target.preset ?? []), makeStack("note", 1, undefined, { title: gen.note.title, text: gen.note.text })];
    }
  }

  // ---------- street props ----------

  const carBody = (x: number, z: number, yaw: number) => {
    const color = mb.material(pick(rng, CAR_COLORS), { roughness: 0.6, metalness: 0.3 });
    const glass = mb.material("#1c2226", { roughness: 0.2, metalness: 0.5 });
    const tire = mb.material("#151515");
    const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, terrain.height(x, z), z);
    const add = (w: number, h: number, d: number, px: number, py: number, pz: number, mat: string) => {
      const g = new THREE.BoxGeometry(w, h, d);
      g.translate(px, py, pz);
      g.applyMatrix4(m);
      mb.add(g, mat);
    };
    add(1.8, 0.7, 4.3, 0, 0.65, 0, color);
    add(1.6, 0.55, 2.2, 0, 1.27, -0.2, glass);
    add(1.5, 0.08, 2.1, 0, 1.58, -0.2, color);
    for (const [wx, wz] of [
      [-0.85, 1.3],
      [0.85, 1.3],
      [-0.85, -1.3],
      [0.85, -1.3],
    ]) {
      const g = new THREE.CylinderGeometry(0.33, 0.33, 0.25, 10);
      g.rotateZ(Math.PI / 2);
      g.translate(wx, 0.33, wz);
      g.applyMatrix4(m);
      mb.add(g, tire);
    }
    // Collider covers the rotated footprint.
    const hx = Math.abs(Math.cos(yaw)) * 0.9 + Math.abs(Math.sin(yaw)) * 2.15;
    const hz = Math.abs(Math.sin(yaw)) * 0.9 + Math.abs(Math.cos(yaw)) * 2.15;
    const y = terrain.height(x, z);
    colliders.add({ minX: x - hx, maxX: x + hx, minY: y, maxY: y + 1.6, minZ: z - hz, maxZ: z + hz, occludes: false });
    containers.push({ id: containerId++, name: "Car", table: "car", x, y: y + 0.8, z, hx, hz, items: null });
  };

  for (const r of hRoads) {
    for (let x = Math.max(r.x0, -150); x < Math.min(r.x1, 150); x += range(rng, 10, 30)) {
      if (rng() < 0.45) carBody(x, r.z + range(rng, -2.5, 2.5), Math.PI / 2 + range(rng, -0.35, 0.35) + (rng() < 0.5 ? Math.PI : 0));
    }
  }
  for (const r of vRoads) {
    for (let z = r.z0; z < r.z1; z += range(rng, 12, 30)) {
      if (rng() < 0.4) carBody(r.x + range(rng, -2.5, 2.5), z, range(rng, -0.35, 0.35) + (rng() < 0.5 ? Math.PI : 0));
    }
  }

  // Street lamps (dead, of course)
  const poleMat = mb.material("#3a3c3e", { metalness: 0.5, roughness: 0.6 });
  const bulbKey = mb.material("#d8d2b8", { emissive: "#ffcf8a", emissiveIntensity: 0 });
  const lamp = (x: number, z: number) => {
    const g = new THREE.CylinderGeometry(0.07, 0.1, 5.5, 6);
    g.translate(x, 2.75, z);
    mb.add(g, poleMat);
    const head = new THREE.BoxGeometry(0.3, 0.15, 0.9);
    head.translate(x, 5.5, z);
    mb.add(head, poleMat);
    const bulb = new THREE.BoxGeometry(0.22, 0.04, 0.6);
    bulb.translate(x, 5.41, z);
    mb.add(bulb, bulbKey);
    colliders.add({ minX: x - 0.15, maxX: x + 0.15, minY: 0, maxY: 5.5, minZ: z - 0.15, maxZ: z + 0.15, occludes: false });
  };
  for (const r of hRoads) {
    for (let x = Math.max(r.x0, -96); x < Math.min(r.x1, 96); x += 22) lamp(x, r.z + ROAD_HALF + 0.6);
  }
  for (const r of vRoads) {
    for (let z = r.z0; z < r.z1; z += 22) lamp(r.x - ROAD_HALF - 0.6, z);
  }

  for (let i = 0; i < 30; i++) {
    const r = pick(rng, hRoads.slice(1));
    spawnPoints.push(new THREE.Vector3(range(rng, r.x0, r.x1), 0, r.z + range(rng, -3, 3)));
  }
  for (let i = 0; i < 20; i++) {
    const r = pick(rng, vRoads);
    spawnPoints.push(new THREE.Vector3(r.x + range(rng, -3, 3), 0, range(rng, r.z0, r.z1)));
  }

  const group = mb.build();
  for (const c of computers) group.add(c.screen);

  return {
    group,
    buildings,
    computers,
    facts,
    lampMaterial: mb.getMaterial(bulbKey)!,
    containers,
    spawnPoints,
    occupied,
    // Arrive on the highway, just west of town.
    playerSpawn: new THREE.Vector3(-140, terrain.height(-140, 2), 2),
  };
}
