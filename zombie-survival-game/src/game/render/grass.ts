import * as THREE from "three";
import { mulberry32 } from "../../sim/rng";
import { TERRAIN_SEGMENTS, TOWN_RADIUS, WORLD_HALF, type Terrain } from "../world/terrain";
import type { Rect } from "../world/town";

/**
 * Grass: tens of thousands of blades in one draw call, with no per-frame work on the CPU.
 *
 * The blades live in a square tile that wraps round the camera in the vertex shader: each blade has a
 * fixed spot in the world (its offset, repeating every tile), so nothing swims as you move, and the
 * GPU only ever draws the tile you're standing in. Three small baked textures tell each blade about
 * its spot: the ground's height, its colour (so grass matches the ground it grows from, and is short
 * on lawns and thin on dirt), and a mask that keeps it off roads, pavements and floors.
 *
 * Blades bend in the wind, lean away from whoever walks through them, shrink to nothing at the
 * tile's edge, and take the ground's lighting and shadows.
 */

const WORLD = WORLD_HALF * 2;
const MASK_SIZE = 1024;
const COLOR_SIZE = 256;

/** Blades drawn and the width of the square of them round the camera, by quality. */
const SETTINGS = {
  high: { blades: 90_000, tile: 50 },
  medium: { blades: 48_000, tile: 42 },
  low: { blades: 16_000, tile: 28 },
} as const;

export class GrassField {
  readonly mesh: THREE.Mesh;
  private geometry: THREE.InstancedBufferGeometry;
  private full: THREE.MeshStandardMaterial;
  private cheap: THREE.MeshLambertMaterial;
  private uniforms = {
    uCam: { value: new THREE.Vector3() },
    uPush: { value: new THREE.Vector3(0, -100, 0) },
    uTime: { value: 0 },
    uTile: { value: SETTINGS.high.tile as number },
    uWind: { value: 1 },
    uHeight: { value: null as THREE.Texture | null },
    uMask: { value: null as THREE.Texture | null },
    uGround: { value: null as THREE.Texture | null },
  };

  constructor(terrain: Terrain, occupied: Rect[], quality: keyof typeof SETTINGS) {
    this.uniforms.uHeight.value = bakeHeight(terrain);
    this.uniforms.uMask.value = bakeMask(occupied);
    this.uniforms.uGround.value = bakeGround(terrain);

    // One blade: a tapering strip, three triangles. x across, y from root (0) to tip (1).
    const blade = new THREE.BufferGeometry();
    blade.setAttribute("position", new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, -0.32, 0.5, 0, 0.32, 0.5, 0, 0, 1, 0], 3));
    blade.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4]);

    const max = SETTINGS.high.blades;
    const rng = mulberry32(31337);
    const offset = new Float32Array(max * 2);
    const rnd = new Float32Array(max * 4);
    for (let i = 0; i < max; i++) {
      // Spread over the whole world: any tile-sized window of it holds an even scatter.
      offset[i * 2] = rng() * WORLD;
      offset[i * 2 + 1] = rng() * WORLD;
      rnd[i * 4] = 0.55 + rng() * 0.9; // height
      rnd[i * 4 + 1] = rng() * Math.PI * 2; // which way it faces
      rnd[i * 4 + 2] = rng(); // lean and wind phase
      rnd[i * 4 + 3] = 0.8 + rng() * 0.4; // tint
    }
    this.geometry = new THREE.InstancedBufferGeometry();
    this.geometry.index = blade.index;
    this.geometry.setAttribute("position", blade.attributes.position);
    this.geometry.setAttribute("offset", new THREE.InstancedBufferAttribute(offset, 2));
    this.geometry.setAttribute("rnd", new THREE.InstancedBufferAttribute(rnd, 4));

    // Two materials, one shader patch: the full PBR one takes the sky's light with everything else;
    // the plain diffuse one is for Low quality, where the sky isn't an environment map and every
    // fragment has to be cheap.
    this.full = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
    this.cheap = new THREE.MeshLambertMaterial({ color: "#ffffff", side: THREE.DoubleSide });
    const patch = (shader: THREE.WebGLProgramParametersWithUniforms) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          /* glsl */ `#include <common>
          attribute vec2 offset;
          attribute vec4 rnd;
          uniform vec3 uCam, uPush;
          uniform float uTime, uTile, uWind;
          uniform sampler2D uHeight, uMask, uGround;
          varying vec3 vGrass;`,
        )
        // Lit like the ground it stands on: blades facing away from the sun shouldn't go black.
        .replace("#include <beginnormal_vertex>", "vec3 objectNormal = vec3(0.0, 1.0, 0.0);")
        .replace(
          "#include <begin_vertex>",
          /* glsl */ `
          // This blade's place in the world: its offset, wrapped into the tile round the camera.
          vec2 cell = mod(offset - uCam.xz, uTile) - 0.5 * uTile;
          vec2 wxz = uCam.xz + cell;
          vec2 uv01 = wxz / ${WORLD.toFixed(1)} + 0.5;
          vec4 ground = texture2D(uGround, uv01);
          float mask = texture2D(uMask, uv01).r;
          // Height texels sit on the ground mesh's vertices.
          float gy = texture2D(uHeight, uv01 * ${(TERRAIN_SEGMENTS / (TERRAIN_SEGMENTS + 1)).toFixed(6)} + ${(0.5 / (TERRAIN_SEGMENTS + 1)).toFixed(6)}).r;
          float edge = 1.0 - smoothstep(uTile * 0.34, uTile * 0.5, length(cell));
          float grow = rnd.x * ground.a * edge * smoothstep(0.5, 0.85, mask);
          float t = position.y;
          float h = 0.62 * grow;
          float width = 0.075 * (0.6 + 0.4 * rnd.w) * step(0.02, grow);
          float cs = cos(rnd.y);
          float sn = sin(rnd.y);
          vec3 local = vec3(position.x * width * cs, t * h, position.x * width * sn);
          // Each blade leans its own way; gusts roll across the field; the wind bends tips most.
          vec2 lean = vec2(sn, -cs) * (rnd.z - 0.5) * 0.5;
          float gust = sin(uTime * 0.9 + wxz.x * 0.11 + wxz.y * 0.07) * 0.5 + 0.5;
          vec2 wind = vec2(0.9, 0.45) * (0.05 + 0.2 * gust) * uWind + vec2(sin(uTime * 3.3 + rnd.z * 40.0), cos(uTime * 2.7 + rnd.z * 31.0)) * 0.035 * uWind;
          local.xz += (lean + wind) * t * t * h * 1.6;
          // Trodden down round whoever is walking through it.
          vec2 away = wxz - uPush.xz;
          float near = 1.0 - smoothstep(0.25, 1.0, length(away));
          local.xz += normalize(away + vec2(0.0001)) * near * 0.3 * t;
          local.y *= 1.0 - 0.6 * near;
          vec3 transformed = vec3(wxz.x, gy - 0.02, wxz.y) + local;
          // Dark at the root where blades shade each other, the ground's colour brightening to the tip.
          // Mown lawn is the ground's own colour: its tufts only add texture.
          float wild = smoothstep(0.35, 0.9, ground.a);
          vGrass = ground.rgb * mix(0.6 + 0.25 * t, 0.5 + 0.95 * t, wild) * mix(1.0, rnd.w, 0.3 + 0.7 * wild);`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vGrass;")
        .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb *= vGrass;")
        // Both faces take the upward normal: no dark backs.
        .replace("#include <normal_fragment_begin>", "#include <normal_fragment_begin>\nnormal = normalize(vNormal);\nnonPerturbedNormal = normal;");
    };

    this.full.onBeforeCompile = patch;
    this.cheap.onBeforeCompile = patch;
    this.mesh = new THREE.Mesh(this.geometry, quality === "low" ? this.cheap : this.full);
    // Blades are placed by the shader: the mesh has no meaningful bounds to cull by.
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    this.setQuality(quality);
  }

  setQuality(quality: keyof typeof SETTINGS) {
    const s = SETTINGS[quality];
    this.geometry.instanceCount = s.blades;
    this.uniforms.uTile.value = s.tile;
    this.mesh.material = quality === "low" ? this.cheap : this.full;
  }

  /** camera: where the eye is. walker: whose feet flatten the grass. */
  update(camera: THREE.Vector3, walker: THREE.Vector3, dt: number, wind = 1) {
    this.uniforms.uCam.value.copy(camera);
    this.uniforms.uPush.value.copy(walker);
    this.uniforms.uTime.value += dt;
    this.uniforms.uWind.value = wind;
  }
}

/** Ground height at every vertex of the terrain mesh, as a half-float texture (linear filtering is core in WebGL2). */
function bakeHeight(terrain: Terrain): THREE.DataTexture {
  const n = TERRAIN_SEGMENTS + 1;
  const data = new Uint16Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = -WORLD_HALF + (i / TERRAIN_SEGMENTS) * WORLD;
      const z = -WORLD_HALF + (j / TERRAIN_SEGMENTS) * WORLD;
      data[j * n + i] = THREE.DataUtils.toHalfFloat(terrain.height(x, z));
    }
  }
  const tex = new THREE.DataTexture(data, n, n, THREE.RedFormat, THREE.HalfFloatType);
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** The ground's colour, with how tall grass grows there in alpha: short on town lawns, sparse on dirt. */
function bakeGround(terrain: Terrain): THREE.DataTexture {
  const n = COLOR_SIZE;
  const data = new Uint8Array(n * n * 4);
  const c = new THREE.Color();
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = -WORLD_HALF + ((i + 0.5) / n) * WORLD;
      const z = -WORLD_HALF + ((j + 0.5) / n) * WORLD;
      const bare = terrain.colorAt(x, z, c);
      const d = Math.hypot(x, z);
      // Lawns in town were mown not long ago; outside it the grass has had all summer.
      const wild = Math.min(1, Math.max(0, (d - TOWN_RADIUS + 15) / 40));
      const height = (0.2 + 0.8 * wild) * (1 - bare * 0.85);
      // The texture is read as plain numbers (no colour-space decode), so store linear values.
      data.set([c.r * 255, c.g * 255, c.b * 255, height * 255].map((v) => Math.max(0, Math.min(255, Math.round(v)))), (j * n + i) * 4);
    }
  }
  const tex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** White where grass may grow, black on roads, pavements and inside buildings. */
function bakeMask(occupied: Rect[]): THREE.DataTexture {
  const n = MASK_SIZE;
  const data = new Uint8Array(n * n).fill(255);
  const px = (v: number) => ((v + WORLD_HALF) / WORLD) * n;
  // A margin, so blades don't poke through walls or lie across kerbs.
  const margin = 0.45;
  for (const r of occupied) {
    const x0 = Math.max(0, Math.floor(px(r.minX - margin)));
    const x1 = Math.min(n - 1, Math.ceil(px(r.maxX + margin)));
    const z0 = Math.max(0, Math.floor(px(r.minZ - margin)));
    const z1 = Math.min(n - 1, Math.ceil(px(r.maxZ + margin)));
    for (let j = z0; j <= z1; j++) data.fill(0, j * n + x0, j * n + x1 + 1);
  }
  const tex = new THREE.DataTexture(data, n, n, THREE.RedFormat, THREE.UnsignedByteType);
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
