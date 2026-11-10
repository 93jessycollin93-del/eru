import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createNoise2D } from "simplex-noise";
import { mulberry32, range } from "../../sim/rng";
import type { ColliderWorld } from "./colliders";
import { TOWN_RADIUS, WORLD_HALF, type Terrain } from "./terrain";
import type { Rect } from "./town";

const inside = (x: number, z: number, r: Rect, m: number) =>
  x > r.minX - m && x < r.maxX + m && z > r.minZ - m && z < r.maxZ + m;

/** Trees are grouped into square chunks this wide, so whole stands can be culled or swapped for a cheaper model. */
const CHUNK = 75;
/** Chunks whose centre is nearer than this get the detailed trees; farther ones the simple ones. By quality. */
const NEAR = { high: 105, medium: 85, low: 48 } as const;
/** Bushes aren't drawn at all beyond this. */
const BUSH_RANGE = 130;

type Kind = "pine" | "leafy" | "bush";

const TRUNK = new THREE.Color("#4a3a2c");
const PINE_DARK = new THREE.Color("#1c2a1a");
const PINE_LIGHT = new THREE.Color("#3a5230");
const LEAF_DARK = new THREE.Color("#2a3a1c");
const LEAF_LIGHT = new THREE.Color("#5d7236");
const BUSH_DARK = new THREE.Color("#28351c");
const BUSH_LIGHT = new THREE.Color("#4d5f2e");

/**
 * Paint a geometry: `color(position, normal)` per vertex, and `sway` (how much the wind moves it,
 * 0 at the trunk's foot to 1 at branch tips) as a second attribute.
 */
function paint(g: THREE.BufferGeometry, color: (p: THREE.Vector3, n: THREE.Vector3, out: THREE.Color) => void, sway: (p: THREE.Vector3) => number) {
  const pos = g.attributes.position as THREE.BufferAttribute;
  const nor = g.attributes.normal as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const sways = new Float32Array(pos.count);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nor, i);
    color(p, n, c);
    colors.set([c.r, c.g, c.b], i * 3);
    sways[i] = sway(p);
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  g.setAttribute("sway", new THREE.BufferAttribute(sways, 1));
  g.deleteAttribute("uv");
  return g;
}

/** Merging wants every part unindexed; spheres already are. */
const flat = (g: THREE.BufferGeometry) => (g.index ? g.toNonIndexed() : g);

function trunk(radiusTop: number, radiusBottom: number, height: number, sides: number) {
  const g = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, sides, 1, true).translate(0, height / 2, 0);
  return paint(
    g,
    (_p, _n, c) => c.copy(TRUNK),
    (p) => Math.pow(p.y / 10, 2) * 0.5,
  );
}

/**
 * One whorl of pine branches: a ragged, drooping skirt round the trunk, darker underneath and near
 * the trunk, lighter at the tips where the new growth is.
 */
function pineTier(y: number, radius: number, height: number, segments: number, rng: () => number) {
  const positions: number[] = [];
  const index: number[] = [];
  const apex = 0;
  positions.push(0, y + height, 0);
  const turn = rng() * Math.PI * 2;
  for (let i = 0; i < segments; i++) {
    const a = turn + (i / segments) * Math.PI * 2;
    // Alternate long and short boughs, each a little different, their tips hanging below the whorl.
    const r = radius * (i % 2 ? 0.72 : 1) * (0.88 + rng() * 0.24);
    positions.push(Math.cos(a) * r, y - height * (0.1 + rng() * 0.12), Math.sin(a) * r);
  }
  const under = segments + 1;
  positions.push(0, y + height * 0.18, 0);
  for (let i = 0; i < segments; i++) {
    const a = 1 + i;
    const b = 1 + ((i + 1) % segments);
    index.push(apex, b, a, under, a, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return paint(
    g,
    (p, _n, c) => {
      const out = Math.min(1, Math.hypot(p.x, p.z) / radius);
      c.copy(PINE_DARK).lerp(PINE_LIGHT, out * out);
      if (p.y < y + height * 0.2 && out < 0.05) c.multiplyScalar(0.5);
    },
    (p) => 0.25 + 0.75 * Math.min(1, Math.hypot(p.x, p.z) / radius) + p.y * 0.04,
  );
}

function pineGeometry(detailed: boolean): THREE.BufferGeometry {
  const rng = mulberry32(detailed ? 811 : 812);
  const parts: THREE.BufferGeometry[] = [flat(trunk(0.06, 0.24, 9.6, detailed ? 7 : 5))];
  const tiers = detailed ? 8 : 3;
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    const y = 1.9 + t * 7.2;
    const radius = (2.25 - t * 1.85) * (detailed ? 1 : 1.04);
    const height = detailed ? 1.9 - t * 0.7 : 3.4 - t * 0.9;
    parts.push(flat(pineTier(y, radius, height, detailed ? 10 : 6, rng)));
  }
  return mergeGeometries(parts, false)!;
}

/** A lump of foliage: a sphere pushed in and out by noise, lit top, shaded belly. */
function blob(radius: number, detail: number, cx: number, cy: number, cz: number, squash: number, rng: () => number, dark: THREE.Color, light: THREE.Color, swayBase: number) {
  const g = new THREE.IcosahedronGeometry(radius, detail);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const nor = g.attributes.normal as THREE.BufferAttribute;
  const seed = rng() * 100;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // The same bump for coincident vertices, so the surface stays closed.
    const n = Math.sin(v.x * 2.3 + seed) * Math.cos(v.y * 2.9 + seed * 1.3) * Math.sin(v.z * 2.1 + seed * 0.7);
    v.multiplyScalar(1 + n * 0.22);
    pos.setXYZ(i, v.x + cx, v.y * squash + cy, v.z + cz);
    // Shade it as a soft ball, not as its facets: foliage has no hard planes.
    v.normalize();
    nor.setXYZ(i, v.x, v.y, v.z);
  }
  const tint = 0.9 + rng() * 0.2;
  return paint(
    g,
    (_p, n, c) => c.copy(dark).lerp(light, Math.max(0, n.y * 0.6 + 0.4)).multiplyScalar(tint),
    (p) => swayBase + Math.hypot(p.x, p.z) * 0.12,
  );
}

function leafyGeometry(detailed: boolean): THREE.BufferGeometry {
  const rng = mulberry32(detailed ? 911 : 912);
  const parts: THREE.BufferGeometry[] = [flat(trunk(0.15, 0.3, 3.6, detailed ? 7 : 5))];
  if (!detailed) {
    parts.push(flat(blob(2.35, 1, 0, 4.7, 0, 0.85, rng, LEAF_DARK, LEAF_LIGHT, 0.6)));
    return mergeGeometries(parts, false)!;
  }
  // Two limbs fork from the trunk into the crown.
  for (const [ax, az] of [
    [0.5, 0.25],
    [-0.4, -0.45],
  ]) {
    const limb = new THREE.CylinderGeometry(0.06, 0.13, 2.2, 5, 1, true).translate(0, 1.1, 0);
    limb.rotateZ(-ax).rotateX(az).translate(0, 2.7, 0);
    parts.push(
      flat(
        paint(
          limb,
          (_p, _n, c) => c.copy(TRUNK),
          (p) => 0.3 + p.y * 0.03,
        ),
      ),
    );
  }
  // The crown: a big heart and smaller clumps round and above it.
  parts.push(flat(blob(1.75, 1, 0, 4.6, 0, 0.9, rng, LEAF_DARK, LEAF_LIGHT, 0.55)));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rng() * 0.6;
    const d = 1.15 + rng() * 0.5;
    parts.push(flat(blob(1.0 + rng() * 0.45, 1, Math.cos(a) * d, 4.1 + rng() * 1.6, Math.sin(a) * d, 0.8, rng, LEAF_DARK, LEAF_LIGHT, 0.7)));
  }
  parts.push(flat(blob(1.1, 1, 0.2, 6.1, -0.1, 0.8, rng, LEAF_DARK, LEAF_LIGHT, 0.9)));
  return mergeGeometries(parts, false)!;
}

function bushGeometry(): THREE.BufferGeometry {
  const rng = mulberry32(1011);
  const parts = [
    blob(0.62, 1, 0, 0.42, 0, 0.75, rng, BUSH_DARK, BUSH_LIGHT, 0.5),
    blob(0.45, 0, 0.45, 0.33, 0.2, 0.75, rng, BUSH_DARK, BUSH_LIGHT, 0.6),
    blob(0.4, 0, -0.35, 0.3, -0.3, 0.8, rng, BUSH_DARK, BUSH_LIGHT, 0.6),
  ].map(flat);
  return mergeGeometries(parts, false)!;
}

interface Chunk {
  cx: number;
  cz: number;
  near: THREE.InstancedMesh[];
  far: THREE.InstancedMesh[];
  bushes: THREE.InstancedMesh[];
}

/** The world's trees and bushes: where they stand never changes; how they're drawn depends on distance. */
export class Vegetation {
  readonly group = new THREE.Group();
  private chunks: Chunk[] = [];
  private wind = { uTime: { value: 0 }, uWind: { value: 1 } };
  private timer = 0;
  private lodAt = new THREE.Vector3(1e9, 0, 0);
  private near: number = NEAR.high;

  constructor(placed: Record<Kind, THREE.Matrix4[]>) {
    // One material for everything that grows: colour comes from the vertices, movement from the wind.
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.wind.uTime;
      shader.uniforms.uWind = this.wind.uWind;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nattribute float sway;\nuniform float uTime;\nuniform float uWind;")
        .replace(
          "#include <begin_vertex>",
          /* glsl */ `#include <begin_vertex>
          #ifdef USE_INSTANCING
            float phase = instanceMatrix[3].x * 0.31 + instanceMatrix[3].z * 0.17;
          #else
            float phase = 0.0;
          #endif
          // A slow lean of the whole tree, with a quicker shiver in the outer branches.
          float lean = sin(uTime * 1.1 + phase) * 0.05 + sin(uTime * 0.37 + phase * 0.6) * 0.04;
          float shiver = sin(uTime * 3.1 + phase * 2.0 + position.y * 1.7 + position.x * 2.3) * 0.02;
          transformed.x += (lean + shiver) * sway * uWind;
          transformed.z += (lean * 0.6 - shiver) * sway * uWind;`,
        );
    };

    const geometry = {
      pine: { near: pineGeometry(true), far: pineGeometry(false) },
      leafy: { near: leafyGeometry(true), far: leafyGeometry(false) },
      bush: bushGeometry(),
    };

    // Sort every plant into its chunk.
    const cells = new Map<string, Record<Kind, THREE.Matrix4[]>>();
    const p = new THREE.Vector3();
    for (const kind of ["pine", "leafy", "bush"] as const) {
      for (const m of placed[kind]) {
        p.setFromMatrixPosition(m);
        const key = `${Math.floor(p.x / CHUNK)},${Math.floor(p.z / CHUNK)}`;
        let cell = cells.get(key);
        if (!cell) cells.set(key, (cell = { pine: [], leafy: [], bush: [] }));
        cell[kind].push(m);
      }
    }

    const tintRng = mulberry32(77);
    const tint = new THREE.Color();
    const instanced = (geo: THREE.BufferGeometry, list: THREE.Matrix4[], shadows: boolean) => {
      const mesh = new THREE.InstancedMesh(geo, material, list.length);
      list.forEach((m, i) => {
        mesh.setMatrixAt(i, m);
        // No two trees quite the same green.
        const v = 0.82 + tintRng() * 0.36;
        mesh.setColorAt(i, tint.setRGB(v * (0.94 + tintRng() * 0.12), v, v * (0.9 + tintRng() * 0.15)));
      });
      mesh.castShadow = shadows;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      this.group.add(mesh);
      return mesh;
    };

    for (const [key, cell] of cells) {
      const [ix, iz] = key.split(",").map(Number);
      const chunk: Chunk = { cx: (ix + 0.5) * CHUNK, cz: (iz + 0.5) * CHUNK, near: [], far: [], bushes: [] };
      for (const kind of ["pine", "leafy"] as const) {
        if (!cell[kind].length) continue;
        chunk.near.push(instanced(geometry[kind].near, cell[kind], true));
        // Distant trees are beyond the shadow map: no need to draw them into it.
        chunk.far.push(instanced(geometry[kind].far, cell[kind], false));
      }
      if (cell.bush.length) chunk.bushes.push(instanced(geometry.bush, cell.bush, true));
      this.chunks.push(chunk);
    }
    this.update(new THREE.Vector3(0, 0, 0), 0, true);
  }

  /** Advance the wind and pick each chunk's level of detail for where the camera is. */
  update(camera: THREE.Vector3, dt: number, force = false) {
    this.wind.uTime.value += dt;
    this.timer -= dt;
    // Five times a second is plenty at walking pace; a jump (loading a save, a fast car) re-sorts at once.
    if (this.timer > 0 && !force && this.lodAt.distanceToSquared(camera) < 400) return;
    this.timer = 0.2;
    this.lodAt.copy(camera);
    for (const c of this.chunks) {
      const d = Math.hypot(c.cx - camera.x, c.cz - camera.z);
      const near = d < this.near;
      for (const m of c.near) m.visible = near;
      for (const m of c.far) m.visible = !near;
      for (const m of c.bushes) m.visible = d < BUSH_RANGE;
    }
  }

  /** How far out trees get their detailed model. */
  setQuality(quality: keyof typeof NEAR) {
    this.near = NEAR[quality];
    this.lodAt.set(1e9, 0, 0);
  }

  /** 0 is still air, 1 a steady breeze, 2 a gale. */
  setWind(strength: number) {
    this.wind.uWind.value = strength;
  }
}

/** Pine forests outside town, scattered deciduous trees and bushes inside it. */
export function generateVegetation(
  rng: () => number,
  terrain: Terrain,
  colliders: ColliderWorld,
  occupied: Rect[],
): Vegetation {
  const density = createNoise2D(rng);
  const pines: THREE.Matrix4[] = [];
  const leafy: THREE.Matrix4[] = [];
  const bushes: THREE.Matrix4[] = [];

  const free = (x: number, z: number, margin: number) => !occupied.some((r) => inside(x, z, r, margin));
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);

  const place = (list: THREE.Matrix4[], x: number, z: number, scale: number, trunkRadius: number) => {
    const y = terrain.height(x, z);
    q.setFromAxisAngle(up, rng() * Math.PI * 2);
    list.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(scale, scale, scale)));
    if (trunkRadius > 0) {
      const r = trunkRadius * scale;
      colliders.add({ minX: x - r, maxX: x + r, minY: y - 1, maxY: y + 6 * scale, minZ: z - r, maxZ: z + r, occludes: true });
    }
  };

  // Placement draws exactly what it always has, so every tree stands where it stood.
  for (let i = 0; i < 9000 && pines.length + leafy.length < 2600; i++) {
    const x = range(rng, -WORLD_HALF + 4, WORLD_HALF - 4);
    const z = range(rng, -WORLD_HALF + 4, WORLD_HALF - 4);
    const d = Math.hypot(x, z);
    const forest = density(x * 0.008, z * 0.008) * 0.5 + 0.5;
    if (d < TOWN_RADIUS + 10) {
      // A few yard trees in town.
      if (rng() > 0.04 || !free(x, z, 3)) continue;
      place(leafy, x, z, range(rng, 0.8, 1.2), 0.25);
      continue;
    }
    if (rng() > forest * forest * 1.6) continue;
    if (!free(x, z, 3)) continue;
    if (rng() < 0.78) place(pines, x, z, range(rng, 0.8, 1.5), 0.22);
    else place(leafy, x, z, range(rng, 0.8, 1.3), 0.25);
  }
  for (let i = 0; i < 1400; i++) {
    const x = range(rng, -WORLD_HALF + 4, WORLD_HALF - 4);
    const z = range(rng, -WORLD_HALF + 4, WORLD_HALF - 4);
    if (!free(x, z, 1)) continue;
    place(bushes, x, z, range(rng, 0.6, 1.3), 0);
  }

  return new Vegetation({ pine: pines, leafy, bush: bushes });
}
