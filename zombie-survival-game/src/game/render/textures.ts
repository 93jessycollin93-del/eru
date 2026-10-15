import * as THREE from "three";
import { createNoise4D } from "simplex-noise";
import { mulberry32 } from "../../sim/rng";

/**
 * Procedural surface textures (albedo detail, normal and roughness maps).
 * Albedo is greyscale around ~0.85 so it multiplies the material colour
 * without shifting it. Generated once at startup on a canvas.
 */
export type Surface = "plaster" | "concrete" | "brick" | "asphalt" | "wood" | "roof" | "metal" | "ground" | "fabric";

export interface SurfaceMaps {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
  /** World metres covered by one repeat of the texture. */
  tile: number;
}

const SIZE = 256;

type Noise4 = (x: number, y: number, z: number, w: number) => number;

type Sampler = (u: number, v: number) => { a: number; h: number; r: number };

export class TextureLibrary {
  private cache = new Map<Surface, SurfaceMaps>();
  private n1: Noise4;
  private n2: Noise4;
  private maxAniso: number;

  constructor(renderer: THREE.WebGLRenderer) {
    const rng = mulberry32(4242);
    this.n1 = createNoise4D(rng);
    this.n2 = createNoise4D(rng);
    this.maxAniso = renderer.capabilities.getMaxAnisotropy();
  }

  get(surface: Surface): SurfaceMaps {
    let maps = this.cache.get(surface);
    if (!maps) {
      maps = this.build(surface);
      this.cache.set(surface, maps);
    }
    return maps;
  }

  /** Fractal noise that tiles seamlessly over the unit square. */
  private fbm(u: number, v: number, freq: number, octaves: number, noise = this.n1): number {
    // Sample on a torus so the texture wraps without seams.
    let sum = 0;
    let amp = 1;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      const a = u * Math.PI * 2;
      const b = v * Math.PI * 2;
      const r = freq / (Math.PI * 2);
      const x = Math.cos(a) * r + o * 17.3;
      const y = Math.sin(a) * r;
      const z = Math.cos(b) * r + o * 5.1;
      const w = Math.sin(b) * r;
      sum += amp * noise(x, y, z, w);
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / norm; // roughly -1..1
  }

  private sampler(surface: Surface): { fn: Sampler; tile: number } {
    const f = (u: number, v: number, fr: number, oc: number, n?: Noise4) => this.fbm(u, v, fr, oc, n);
    switch (surface) {
      case "plaster":
        return {
          tile: 2.5,
          fn: (u, v) => {
            const base = f(u, v, 6, 5) * 0.06;
            // Vertical grime streaks running down the wall.
            const streak = Math.max(0, f(u * 3, v * 0.3, 4, 3, this.n2)) * 0.22;
            const blotch = Math.max(0, f(u, v, 2, 3, this.n2) - 0.2) * 0.25;
            return { a: 0.9 + base - streak - blotch, h: 0.5 + f(u, v, 24, 3) * 0.5, r: 0.85 + streak * 0.4 };
          },
        };
      case "concrete":
        return {
          tile: 2,
          fn: (u, v) => {
            const base = f(u, v, 5, 5) * 0.08;
            const speck = f(u, v, 64, 2) > 0.55 ? -0.12 : 0;
            const stain = Math.max(0, f(u, v, 2, 3, this.n2) - 0.1) * 0.25;
            // Expansion joints every half tile.
            const joint = Math.min(Math.abs((u * 2) % 1), Math.abs((v * 2) % 1)) < 0.01 ? -0.3 : 0;
            return { a: 0.86 + base + speck - stain + joint, h: 0.5 + f(u, v, 32, 3) * 0.4 + joint, r: 0.92 };
          },
        };
      case "brick": {
        const rows = 15;
        const cols = 4;
        return {
          tile: 1,
          fn: (u, v) => {
            const row = Math.floor(v * rows);
            const off = row % 2 ? 0.5 / cols : 0;
            const cu = ((u + off) * cols) % 1;
            const cv = (v * rows) % 1;
            const mortar = cu < 0.04 || cv < 0.1;
            const brickId = Math.floor((u + off) * cols) * 31 + row * 7;
            const tone = ((Math.sin(brickId * 12.9898) * 43758.5453) % 1 + 1) % 1;
            const grime = Math.max(0, f(u, v, 3, 3, this.n2)) * 0.25;
            if (mortar) return { a: 1.05 - grime, h: 0.15, r: 0.95 };
            return { a: 0.72 + tone * 0.28 + f(u, v, 40, 2) * 0.06 - grime, h: 0.75 + f(u, v, 40, 2) * 0.15, r: 0.85 };
          },
        };
      }
      case "asphalt":
        return {
          tile: 4,
          fn: (u, v) => {
            const grain = f(u, v, 90, 2) * 0.12;
            const patch = f(u, v, 3, 3, this.n2) * 0.1;
            // Cracks: thin dark lines where a ridged noise peaks.
            const ridge = 1 - Math.abs(f(u, v, 3, 4, this.n2));
            const crack = ridge > 0.985 ? -0.3 : 0;
            return { a: 0.85 + grain + patch + crack, h: 0.5 + grain * 2 + crack, r: 0.95 - (crack ? 0 : 0.05) };
          },
        };
      case "wood": {
        const planks = 6;
        return {
          tile: 1.5,
          fn: (u, v) => {
            const p = Math.floor(v * planks);
            const pv = (v * planks) % 1;
            const seam = pv < 0.04;
            const grain = Math.sin((u * 40 + f(u, v, 4, 3) * 4 + p * 3.1) * Math.PI) * 0.06;
            const tone = ((Math.sin(p * 78.233) * 43758.5453) % 1 + 1) % 1;
            const wear = Math.max(0, f(u, v, 2, 3, this.n2)) * 0.2;
            return { a: seam ? 0.55 : 0.78 + tone * 0.18 + grain - wear, h: seam ? 0.1 : 0.6 + grain, r: 0.75 + wear };
          },
        };
      }
      case "roof":
        return {
          tile: 2,
          fn: (u, v) => {
            const rows = 10;
            const cv = (v * rows) % 1;
            const shadow = cv < 0.12 ? -0.25 : 0;
            const tab = Math.floor(u * 8 + Math.floor(v * rows) * 0.5) * 13;
            const tone = ((Math.sin(tab * 4.13) * 43758.5453) % 1 + 1) % 1;
            const moss = Math.max(0, f(u, v, 3, 3, this.n2) - 0.3) * 0.3;
            return { a: 0.8 + tone * 0.15 + f(u, v, 60, 2) * 0.08 + shadow - moss, h: 0.5 + cv * 0.4, r: 0.95 };
          },
        };
      case "metal":
        return {
          tile: 1,
          fn: (u, v) => {
            const brushed = f(u * 0.2, v * 6, 30, 2) * 0.05;
            const scratch = Math.abs(f(u, v, 12, 2, this.n2)) < 0.02 ? 0.15 : 0;
            const rust = Math.max(0, f(u, v, 3, 4, this.n2) - 0.35) * 0.5;
            return { a: 0.85 + brushed + scratch - rust, h: 0.5 + brushed, r: 0.45 + rust + brushed };
          },
        };
      case "ground":
        return {
          tile: 3,
          fn: (u, v) => {
            const clump = f(u, v, 20, 4) * 0.14;
            const blade = f(u * 3, v * 3, 60, 2, this.n2) * 0.08;
            return { a: 0.86 + clump + blade, h: 0.5 + clump * 2 + blade, r: 1 };
          },
        };
      case "fabric":
        return {
          tile: 0.5,
          fn: (u, v) => {
            const weave = (Math.sin(u * Math.PI * 80) * Math.sin(v * Math.PI * 80)) * 0.05;
            const stain = Math.max(0, f(u, v, 2, 3, this.n2) - 0.25) * 0.3;
            return { a: 0.88 + weave - stain, h: 0.5 + weave * 2, r: 1 };
          },
        };
    }
  }

  private build(surface: Surface): SurfaceMaps {
    const { fn, tile } = this.sampler(surface);
    const albedo = new Uint8ClampedArray(SIZE * SIZE * 4);
    const rough = new Uint8ClampedArray(SIZE * SIZE * 4);
    const height = new Float32Array(SIZE * SIZE);
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const s = fn(x / SIZE, y / SIZE);
        const i = y * SIZE + x;
        const a = Math.max(0, Math.min(1, s.a)) * 255;
        albedo.set([a, a, a, 255], i * 4);
        const r = Math.max(0, Math.min(1, s.r)) * 255;
        rough.set([r, r, r, 255], i * 4);
        height[i] = s.h;
      }
    }
    // Normal map from height via central differences (wrapping).
    const normal = new Uint8ClampedArray(SIZE * SIZE * 4);
    const strength = surface === "brick" || surface === "roof" || surface === "wood" ? 4 : 2.5;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const hL = height[y * SIZE + ((x - 1 + SIZE) % SIZE)];
        const hR = height[y * SIZE + ((x + 1) % SIZE)];
        const hD = height[((y - 1 + SIZE) % SIZE) * SIZE + x];
        const hU = height[((y + 1) % SIZE) * SIZE + x];
        let nx = (hL - hR) * strength;
        let ny = (hD - hU) * strength;
        let nz = 1;
        const len = Math.hypot(nx, ny, nz);
        nx /= len;
        ny /= len;
        nz /= len;
        normal.set([(nx * 0.5 + 0.5) * 255, (ny * 0.5 + 0.5) * 255, (nz * 0.5 + 0.5) * 255, 255], (y * SIZE + x) * 4);
      }
    }
    const tex = (data: Uint8ClampedArray, srgb: boolean) => {
      const t = new THREE.DataTexture(new Uint8Array(data), SIZE, SIZE, THREE.RGBAFormat);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.magFilter = THREE.LinearFilter;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.generateMipmaps = true;
      t.anisotropy = Math.min(8, this.maxAniso);
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.needsUpdate = true;
      return t;
    };
    return { map: tex(albedo, true), normalMap: tex(normal, false), roughnessMap: tex(rough, false), tile };
  }
}
