import * as THREE from "three";
import { createNoise2D } from "simplex-noise";
import type { TextureLibrary } from "../render/textures";

export const WORLD_HALF = 300;
/** Radius around the origin that is kept flat for the town. */
export const TOWN_RADIUS = 120;

const GRASS = new THREE.Color("#4d5a32");
const DRY_GRASS = new THREE.Color("#6f6a3e");
const DIRT = new THREE.Color("#4a3f2e");
/** Quads along each side of the ground mesh. */
export const TERRAIN_SEGMENTS = 220;

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class Terrain {
  readonly mesh: THREE.Mesh;
  private noise: (x: number, y: number) => number;
  private detail: (x: number, y: number) => number;

  constructor(rng: () => number, textures?: TextureLibrary) {
    this.noise = createNoise2D(rng);
    this.detail = createNoise2D(rng);

    const size = WORLD_HALF * 2;
    const segments = TERRAIN_SEGMENTS;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = this.height(x, z);
      pos.setY(i, h);
      this.colorAt(x, z, c);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
    if (textures) {
      // Ground detail repeats every few metres across the whole map.
      const maps = textures.get("ground");
      const repeat = size / maps.tile;
      mat.map = maps.map.clone();
      mat.normalMap = maps.normalMap.clone();
      for (const t of [mat.map, mat.normalMap]) {
        t.repeat.set(repeat, repeat);
        t.needsUpdate = true;
      }
      mat.normalScale.set(1.2, 1.2);
    }
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = true;
  }

  /**
   * The ground's colour at a world position (what the mesh's vertices are painted with), written
   * into `out`. Returns how bare the spot is, 0 (grass) to 1 (dirt): grass grows thin on dirt.
   */
  colorAt(x: number, z: number, out: THREE.Color): number {
    const n = this.detail(x * 0.04, z * 0.04) * 0.5 + 0.5;
    const patch = this.detail(x * 0.012 + 50, z * 0.012) * 0.5 + 0.5;
    out.copy(GRASS).lerp(DRY_GRASS, n * 0.6);
    const bare = patch > 0.72 ? Math.min(1, (patch - 0.72) * 2.5) : 0;
    if (bare > 0) out.lerp(DIRT, bare);
    // Subtle variation so the ground doesn't look flat-shaded.
    const jitter = this.detail(x * 0.6, z * 0.6) * 0.04;
    out.r += jitter;
    out.g += jitter;
    out.b += jitter;
    return bare;
  }

  /** Ground height at a world position. The town area is flat at y = 0. */
  height(x: number, z: number): number {
    const d = Math.hypot(x, z);
    const hills =
      this.noise(x * 0.006, z * 0.006) * 14 +
      this.noise(x * 0.02 + 100, z * 0.02) * 3 +
      Math.max(0, this.noise(x * 0.003 - 40, z * 0.003)) * 22;
    // Hills rise towards the world edge.
    const edge = smoothstep(WORLD_HALF - 80, WORLD_HALF, Math.max(Math.abs(x), Math.abs(z))) * 25;
    return (hills + 6) * smoothstep(TOWN_RADIUS, TOWN_RADIUS + 50, d) + edge;
  }
}
