import * as THREE from "three";
import { createNoise2D } from "simplex-noise";

export const WORLD_HALF = 300;
/** Radius around the origin that is kept flat for the town. */
export const TOWN_RADIUS = 120;

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class Terrain {
  readonly mesh: THREE.Mesh;
  private noise: (x: number, y: number) => number;
  private detail: (x: number, y: number) => number;

  constructor(rng: () => number) {
    this.noise = createNoise2D(rng);
    this.detail = createNoise2D(rng);

    const size = WORLD_HALF * 2;
    const segments = 220;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const grass = new THREE.Color("#4d5a32");
    const dryGrass = new THREE.Color("#6f6a3e");
    const dirt = new THREE.Color("#4a3f2e");
    const c = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = this.height(x, z);
      pos.setY(i, h);
      const n = this.detail(x * 0.04, z * 0.04) * 0.5 + 0.5;
      const patch = this.detail(x * 0.012 + 50, z * 0.012) * 0.5 + 0.5;
      c.copy(grass).lerp(dryGrass, n * 0.6);
      if (patch > 0.72) c.lerp(dirt, (patch - 0.72) * 2.5);
      // Subtle variation so the ground doesn't look flat-shaded.
      const jitter = (this.detail(x * 0.6, z * 0.6) * 0.04);
      colors[i * 3] = c.r + jitter;
      colors[i * 3 + 1] = c.g + jitter;
      colors[i * 3 + 2] = c.b + jitter;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    this.mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }),
    );
    this.mesh.receiveShadow = true;
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
