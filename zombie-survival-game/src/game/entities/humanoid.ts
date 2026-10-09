import * as THREE from "three";

/**
 * Procedural skinned human: a 19-bone skeleton and a smooth body generated
 * from lofted cross-sections, skinned to the bones, with clothing, hair, dirt
 * and blood drawn by a shader from per-character uniforms. One draw call per
 * character. Animation is procedural (see animate()).
 */

export interface HumanoidColors {
  skin: string;
  shirt: string;
  pants: string;
  shoes?: string;
  hair?: string;
}

export interface HumanoidLook {
  build?: "slim" | "average" | "heavy";
  sex?: "m" | "f";
  /** 0 = sleeveless .. 1 = long sleeves. */
  sleeve?: number;
  /** 0 = bald .. 1 = full hair. */
  hair?: number;
  grime?: number;
  blood?: number;
  /** Height multiplier around 1. */
  height?: number;
  zombie?: boolean;
}

// ----------------------------------------------------------------- skeleton

const BONES = [
  ["hips", -1, [0, 0.95, 0]],
  ["spine", 0, [0, 0.12, 0]],
  ["chest", 1, [0, 0.18, 0]],
  ["neck", 2, [0, 0.2, 0]],
  ["head", 3, [0, 0.08, 0]],
  ["shoulderL", 2, [-0.12, 0.15, 0]],
  ["upperArmL", 5, [-0.075, 0, 0]],
  ["forearmL", 6, [0, -0.28, 0]],
  ["handL", 7, [0, -0.25, 0]],
  ["shoulderR", 2, [0.12, 0.15, 0]],
  ["upperArmR", 9, [0.075, 0, 0]],
  ["forearmR", 10, [0, -0.28, 0]],
  ["handR", 11, [0, -0.25, 0]],
  ["thighL", 0, [-0.095, -0.04, 0]],
  ["shinL", 13, [0, -0.43, 0]],
  ["footL", 14, [0, -0.42, 0]],
  ["thighR", 0, [0.095, -0.04, 0]],
  ["shinR", 16, [0, -0.43, 0]],
  ["footR", 17, [0, -0.42, 0]],
] as const;

type BoneName = (typeof BONES)[number][0];
const BI = Object.fromEntries(BONES.map((b, i) => [b[0], i])) as Record<BoneName, number>;

/** Clothing zones, read by the shader. */
const Z_ARM = 0;
const Z_TORSO = 1;
const Z_LEG = 2;
const Z_SHOE = 3;
const Z_HEAD = 4;
const Z_SKIN = 5;

interface BuildShape {
  shoulder: number;
  hip: number;
  girth: number;
  chest: number;
}

const SHAPES: Record<string, BuildShape> = {
  "m-slim": { shoulder: 1.0, hip: 0.95, girth: 0.88, chest: 1.0 },
  "m-average": { shoulder: 1.05, hip: 1.0, girth: 1.0, chest: 1.05 },
  "m-heavy": { shoulder: 1.08, hip: 1.1, girth: 1.28, chest: 1.12 },
  "f-slim": { shoulder: 0.88, hip: 1.05, girth: 0.86, chest: 1.0 },
  "f-average": { shoulder: 0.9, hip: 1.1, girth: 0.96, chest: 1.06 },
  "f-heavy": { shoulder: 0.94, hip: 1.18, girth: 1.22, chest: 1.12 },
};

function restPositions(shape: BuildShape): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  BONES.forEach(([name, parent, off], i) => {
    const o = new THREE.Vector3(...off);
    if (name.startsWith("shoulder")) o.x *= shape.shoulder;
    if (name.startsWith("thigh")) o.x *= shape.hip;
    out[i] = parent < 0 ? o : o.add(out[parent]);
  });
  return out;
}

// ----------------------------------------------------------------- geometry

type Weights = [[number, number], [number, number]];

class GeoBuilder {
  pos: number[] = [];
  skinIdx: number[] = [];
  skinW: number[] = [];
  zone: number[] = [];
  limbT: number[] = [];
  index: number[] = [];

  vertex(p: THREE.Vector3, bones: [number, number], weights: [number, number], zone: number, t: number) {
    this.pos.push(p.x, p.y, p.z);
    this.skinIdx.push(bones[0], bones[1], 0, 0);
    this.skinW.push(weights[0], weights[1], 0, 0);
    this.zone.push(zone);
    this.limbT.push(t);
    return this.pos.length / 3 - 1;
  }

  /**
   * A lofted tube along from→to. profile(t) gives the cross-section radii
   * (side, front); weights(t, p) gives two bones and their weights; tMap maps
   * the local t to the stored limbT (for sleeve and cuff lengths).
   */
  tube(
    from: THREE.Vector3,
    to: THREE.Vector3,
    rings: number,
    around: number,
    profile: (t: number) => [number, number],
    weights: (t: number, p: THREE.Vector3) => Weights,
    zone: number,
    capStart = true,
    capEnd = true,
    tMap: (t: number) => number = (t) => t,
  ) {
    const dir = to.clone().sub(from).normalize();
    let front = new THREE.Vector3(0, 0, 1);
    front.addScaledVector(dir, -front.dot(dir));
    if (front.lengthSq() < 0.01) front = new THREE.Vector3(1, 0, 0);
    front.normalize();
    const side = new THREE.Vector3().crossVectors(front, dir).normalize();
    const base = this.pos.length / 3;
    for (let r = 0; r <= rings; r++) {
      const t = r / rings;
      const c = from.clone().lerp(to, t);
      const [rs, rf] = profile(t);
      for (let a = 0; a < around; a++) {
        const ang = (a / around) * Math.PI * 2;
        const p = c.clone().addScaledVector(side, Math.cos(ang) * rs).addScaledVector(front, Math.sin(ang) * rf);
        const [b, w] = weights(t, p);
        this.vertex(p, b, w, zone, tMap(t));
      }
    }
    for (let r = 0; r < rings; r++) {
      for (let a = 0; a < around; a++) {
        const i0 = base + r * around + a;
        const i1 = base + r * around + ((a + 1) % around);
        const i2 = i0 + around;
        const i3 = i1 + around;
        this.index.push(i0, i1, i2, i1, i3, i2);
      }
    }
    const cap = (ring: number, center: THREE.Vector3, atStart: boolean) => {
      const t = atStart ? 0 : 1;
      const [b, w] = weights(t, center);
      const ci = this.vertex(center, b, w, zone, tMap(t));
      for (let a = 0; a < around; a++) {
        const i0 = base + ring * around + a;
        const i1 = base + ring * around + ((a + 1) % around);
        if (atStart) this.index.push(ci, i1, i0);
        else this.index.push(ci, i0, i1);
      }
    };
    if (capStart) cap(0, from, true);
    if (capEnd) cap(rings, to, false);
  }

  /** Ellipsoid around a centre, bound to one bone (optionally blended with a second below a height). */
  ellipsoid(
    center: THREE.Vector3,
    radii: THREE.Vector3,
    lat: number,
    lon: number,
    bone: number,
    zone: number,
    shape?: (p: THREE.Vector3, n: THREE.Vector3) => void,
    blend?: { bone: number; belowY: number; range: number },
  ) {
    const base = this.pos.length / 3;
    for (let i = 0; i <= lat; i++) {
      const v = i / lat;
      const phi = v * Math.PI;
      for (let j = 0; j <= lon; j++) {
        const theta = (j / lon) * Math.PI * 2;
        const n = new THREE.Vector3(Math.sin(phi) * Math.sin(theta), Math.cos(phi), Math.sin(phi) * Math.cos(theta));
        const p = new THREE.Vector3(n.x * radii.x, n.y * radii.y, n.z * radii.z);
        shape?.(p, n);
        p.add(center);
        let w: [number, number] = [1, 0];
        let b: [number, number] = [bone, bone];
        if (blend && p.y < blend.belowY) {
          const k = Math.min(1, (blend.belowY - p.y) / blend.range) * 0.5;
          b = [bone, blend.bone];
          w = [1 - k, k];
        }
        this.vertex(p, b, w, zone, 1 - v);
      }
    }
    for (let i = 0; i < lat; i++) {
      for (let j = 0; j < lon; j++) {
        const a = base + i * (lon + 1) + j;
        const b = a + lon + 1;
        this.index.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(this.skinIdx, 4));
    g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(this.skinW, 4));
    g.setAttribute("zone", new THREE.Float32BufferAttribute(this.zone, 1));
    g.setAttribute("limbT", new THREE.Float32BufferAttribute(this.limbT, 1));
    g.setIndex(this.index);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

/** Weight to `bone`, easing in from `parent` over the first part of a segment and out to `child` at the end. */
const segW =
  (bone: number, parent: number, child = -1, blendIn = 0.18, blendOut = 0.15) =>
  (t: number): Weights => {
    if (t < blendIn) {
      const k = 0.5 * (1 - t / blendIn);
      return [[bone, parent], [1 - k, k]];
    }
    if (child >= 0 && t > 1 - blendOut) {
      const k = 0.5 * ((t - (1 - blendOut)) / blendOut);
      return [[bone, child], [1 - k, k]];
    }
    return [[bone, parent], [1, 0]];
  };

const templates = new Map<string, THREE.BufferGeometry>();

function buildTemplate(key: string): THREE.BufferGeometry {
  const shape = SHAPES[key];
  const female = key.startsWith("f");
  const R = restPositions(shape);
  const gb = new GeoBuilder();
  const g = shape.girth;
  const AR = 10;

  // Torso: crotch to the base of the neck, weighted hips → spine → chest by height.
  const torsoBottom = new THREE.Vector3(0, 0.8, 0);
  const torsoTop = new THREE.Vector3(0, R[BI.neck].y - 0.02, 0);
  const keys: [number, number, number][] = [
    [0.0, 0.11, 0.09],
    [0.12, 0.165 * shape.hip, 0.11],
    [0.3, (female ? 0.13 : 0.145) * g, 0.1 * g],
    [0.5, 0.155 * g, 0.11 * g],
    [0.7, 0.175 * shape.chest * Math.max(1, g * 0.95), (female ? 0.125 : 0.115) * shape.chest * g],
    [0.88, 0.19 * shape.shoulder, 0.1],
    [1.0, 0.075, 0.07],
  ];
  const torsoProfile = (t: number): [number, number] => {
    for (let i = 0; i < keys.length - 1; i++) {
      const [t0, a0, b0] = keys[i];
      const [t1, a1, b1] = keys[i + 1];
      if (t <= t1) {
        const k = (t - t0) / (t1 - t0);
        const s = k * k * (3 - 2 * k);
        return [a0 + (a1 - a0) * s, b0 + (b1 - b0) * s];
      }
    }
    return [keys[keys.length - 1][1], keys[keys.length - 1][2]];
  };
  gb.tube(
    torsoBottom,
    torsoTop,
    14,
    14,
    torsoProfile,
    (_t, p) => {
      const y = p.y;
      if (y < 0.98) return [[BI.hips, BI.spine], [1, 0]];
      if (y < 1.1) {
        const k = (y - 0.98) / 0.12;
        return [[BI.hips, BI.spine], [1 - k, k]];
      }
      if (y < 1.25) {
        const k = (y - 1.1) / 0.15;
        return [[BI.spine, BI.chest], [1 - k, k]];
      }
      return [[BI.chest, BI.chest], [1, 0]];
    },
    Z_TORSO,
  );

  // Neck and head.
  gb.tube(
    R[BI.neck].clone().setY(R[BI.neck].y - 0.04),
    R[BI.head].clone().add(new THREE.Vector3(0, 0.04, 0)),
    3,
    AR,
    () => [0.05, 0.055],
    segW(BI.head, BI.neck, -1, 0.6),
    Z_SKIN,
  );
  const headC = R[BI.head].clone().add(new THREE.Vector3(0, 0.095, 0.01));
  gb.ellipsoid(
    headC,
    new THREE.Vector3(female ? 0.083 : 0.09, 0.115, 0.1),
    12,
    16,
    BI.head,
    Z_HEAD,
    (p, n) => {
      // Jaw narrows towards the chin; a nose; brow ridge; ears.
      if (n.y < 0) {
        const k = 1 + n.y * 0.28;
        p.x *= k;
        p.z *= 0.92 + 0.08 * k;
      }
      if (n.z > 0.75 && Math.abs(n.x) < 0.18 && n.y > -0.35 && n.y < 0.15) {
        p.z += 0.022 * (1 - Math.abs(n.x) / 0.18) * Math.max(0, 1 - Math.abs(n.y + 0.1) / 0.25);
      }
      if (n.z > 0.6 && n.y > 0.12 && n.y < 0.3) p.z += 0.006;
      if (Math.abs(n.x) > 0.93 && Math.abs(n.y) < 0.18 && n.z < 0.1 && n.z > -0.3) p.x += Math.sign(n.x) * 0.012;
    },
    { bone: BI.neck, belowY: headC.y - 0.07, range: 0.06 },
  );

  // Arms. limbT runs 0 (shoulder) → 1 (wrist) so the shader can cut sleeves.
  const armScale = female ? 0.88 : 1;
  const gArm = Math.sqrt(g);
  for (const s of ["L", "R"] as const) {
    const sh = R[BI[`shoulder${s}`]];
    const ua = R[BI[`upperArm${s}`]];
    const fa = R[BI[`forearm${s}`]];
    const ha = R[BI[`hand${s}`]];
    const UA = BI[`upperArm${s}`];
    const FA = BI[`forearm${s}`];
    const HA = BI[`hand${s}`];
    // Shoulder cap (part of the shirt).
    gb.tube(sh.clone().setY(sh.y - 0.01), ua.clone().setY(ua.y - 0.03), 3, AR, () => [0.07 * gArm, 0.062 * gArm], () => [[UA, BI.chest], [0.6, 0.4]], Z_TORSO, false, false);
    gb.tube(
      ua.clone().setY(ua.y - 0.03),
      fa,
      6,
      AR,
      (t) => [(0.066 - t * 0.014) * gArm * armScale, (0.062 - t * 0.012) * gArm * armScale],
      segW(UA, BI.chest, FA, 0.15, 0.15),
      Z_ARM,
      false,
      false,
      (t) => t * 0.5,
    );
    gb.tube(
      fa,
      ha.clone().setY(ha.y + 0.02),
      6,
      AR,
      (t) => {
        const forearm = Math.sin(Math.min(1, t * 2) * Math.PI) * 0.006; // forearm muscle near the elbow
        return [(0.05 - t * 0.014 + forearm) * armScale, (0.047 - t * 0.016 + forearm) * armScale];
      },
      segW(FA, UA, HA, 0.2, 0.1),
      Z_ARM,
      false,
      true,
      (t) => 0.5 + t * 0.5,
    );
    // Hand: palm and fingers as one rounded mitt, thumb side slightly wider.
    gb.ellipsoid(ha.clone().add(new THREE.Vector3(0, -0.055, 0.008)), new THREE.Vector3(0.04 * armScale, 0.058, 0.024), 6, 8, HA, Z_SKIN, (p, n) => {
      if (n.y < -0.3) p.z += 0.008; // fingers curl forward
    });
  }

  // Legs: thigh, shin (with a calf), shoe.
  const gLeg = Math.pow(g, 0.6) * (female ? 1.02 : 1);
  for (const s of ["L", "R"] as const) {
    const th = R[BI[`thigh${s}`]];
    const sn = R[BI[`shin${s}`]];
    const ft = R[BI[`foot${s}`]];
    const TH = BI[`thigh${s}`];
    const SH = BI[`shin${s}`];
    const FT = BI[`foot${s}`];
    gb.tube(th.clone().setY(th.y + 0.06), sn, 8, AR, (t) => [(0.092 - t * 0.035) * gLeg, (0.09 - t * 0.03) * gLeg], segW(TH, BI.hips, SH, 0.25, 0.12), Z_LEG, false, false);
    gb.tube(
      sn,
      ft.clone().setY(ft.y + 0.07),
      7,
      AR,
      (t) => {
        const calf = Math.sin(Math.min(1, t * 2.2) * Math.PI) * 0.012;
        return [0.055 - t * 0.017 + calf, 0.055 - t * 0.014 + calf * 1.4];
      },
      segW(SH, TH, FT, 0.15, 0.12),
      Z_LEG,
      false,
      true,
    );
    gb.ellipsoid(ft.clone().add(new THREE.Vector3(0, 0.035, 0.05)), new THREE.Vector3(0.05, 0.045, 0.13), 6, 10, FT, Z_SHOE, (p) => {
      if (p.y < -0.025) p.y = -0.025 - (p.y + 0.025) * 0.15; // flat sole
    });
  }

  return gb.build();
}

function template(build: string, sex: string) {
  const key = `${sex}-${build}`;
  let g = templates.get(key);
  if (!g) {
    g = buildTemplate(key);
    templates.set(key, g);
  }
  return g;
}

// ----------------------------------------------------------------- material

function makeMaterial(colors: HumanoidColors, look: Required<HumanoidLook>, headY: number) {
  const mat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.82, metalness: 0 });
  const u = {
    cSkin: { value: new THREE.Color(colors.skin) },
    cTop: { value: new THREE.Color(colors.shirt) },
    cBottom: { value: new THREE.Color(colors.pants) },
    cShoes: { value: new THREE.Color(colors.shoes ?? "#2a2622") },
    cHair: { value: new THREE.Color(colors.hair ?? "#2b2420") },
    uSleeve: { value: look.sleeve },
    uHair: { value: look.hair },
    uGrime: { value: look.grime },
    uBlood: { value: look.blood },
    uSeed: { value: Math.random() * 100 },
    uHeadY: { value: headY },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        attribute float zone;
        attribute float limbT;
        varying float vZone;
        varying float vLimbT;
        varying vec3 vRest;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vZone = zone; vLimbT = limbT; vRest = position;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform vec3 cSkin, cTop, cBottom, cShoes, cHair;
        uniform float uSleeve, uHair, uGrime, uBlood, uSeed, uHeadY;
        varying float vZone;
        varying float vLimbT;
        varying vec3 vRest;
        float hhash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float vnoise(vec3 x) {
          vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(hhash(i), hhash(i + vec3(1,0,0)), f.x), mix(hhash(i + vec3(0,1,0)), hhash(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(hhash(i + vec3(0,0,1)), hhash(i + vec3(1,0,1)), f.x), mix(hhash(i + vec3(0,1,1)), hhash(i + vec3(1,1,1)), f.x), f.y), f.z);
        }`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        int z = int(vZone + 0.5);
        vec3 col = cSkin;
        float cloth = 0.0;
        if (z == 0) { if (vLimbT < uSleeve) { col = cTop; cloth = 1.0; } }
        else if (z == 1) { col = cTop; cloth = 1.0; }
        else if (z == 2) { col = cBottom; cloth = 1.0; }
        else if (z == 3) { col = cShoes; cloth = 0.5; }
        else if (z == 4) {
          vec3 h = vRest - vec3(0.0, uHeadY, 0.0);
          bool hairTop = h.y > 0.035 + (1.0 - uHair) * 0.2;
          bool hairBack = h.z < -0.02 && h.y > -0.04 + (1.0 - uHair) * 0.3;
          if (uHair > 0.01 && (hairTop || hairBack)) col = cHair;
          // Eyebrows, eye sockets and lips.
          if (h.z > 0.07 && h.y > 0.02 && h.y < 0.03 && abs(abs(h.x) - 0.035) < 0.022) col = mix(col, cHair * 0.8, 0.8);
          if (h.z > 0.07 && abs(h.y) < 0.018 && abs(abs(h.x) - 0.035) < 0.018) col *= 0.55;
          if (h.z > 0.075 && h.y < -0.045 && h.y > -0.06 && abs(h.x) < 0.025) col *= 0.75;
        }
        float n1 = vnoise(vRest * 9.0 + uSeed);
        float n2 = vnoise(vRest * 23.0 - uSeed);
        col *= 0.9 + 0.2 * mix(n2, n1, 0.5);
        // Grime gathers low on the body and in patches.
        float grime = smoothstep(0.55, 0.85, n1 + (0.6 - vRest.y) * 0.25) * uGrime;
        col = mix(col, col * vec3(0.42, 0.38, 0.32), grime);
        // Blood: dark red-brown splotches, mostly around the mouth, chest and hands; not on shoes.
        float bzone = z == 3 ? 0.0 : 1.0;
        // On the head, blood stays around the mouth and chin.
        if (z == 4) bzone = smoothstep(-0.02, -0.07, vRest.y - uHeadY) * step(0.03, vRest.z);
        float bmask = smoothstep(0.72, 0.9, vnoise(vRest * 6.0 + uSeed * 1.7) + max(vRest.z, 0.0) * 0.8) * uBlood * bzone;
        col = mix(col, vec3(0.22, 0.03, 0.02), bmask);
        diffuseColor.rgb *= col;`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(0.62, 0.95, cloth);`,
      );
  };
  mat.customProgramCacheKey = () => "humanoid-v1";
  return mat;
}

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
  private material: THREE.MeshStandardMaterial;
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

  constructor(colors: HumanoidColors, look: HumanoidLook = {}) {
    const full: Required<HumanoidLook> = {
      build: look.build ?? "average",
      sex: look.sex ?? "m",
      sleeve: look.sleeve ?? 0.95,
      hair: look.hair ?? 0.8,
      grime: look.grime ?? 0.25,
      blood: look.blood ?? 0,
      height: look.height ?? 1,
      zombie: look.zombie ?? false,
    };
    this.zombie = full.zombie;
    const shape = SHAPES[`${full.sex}-${full.build}`];
    const rest = restPositions(shape);
    const geo = template(full.build, full.sex);

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

    this.material = makeMaterial(colors, full, rest[BI.head].y + 0.095);
    this.mesh = new THREE.SkinnedMesh(geo, this.material);
    this.mesh.add(boneObjs[0]);
    this.mesh.bind(new THREE.Skeleton(boneObjs));
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.body.add(this.mesh);
    this.root.add(this.body);
    this.root.scale.setScalar(full.height);
    this.hipsY = this.bones.hips.position.y;

    this.head = new THREE.Object3D();
    this.head.position.set(0, 0.095, 0.01);
    this.bones.head.add(this.head);
    this.hand.position.set(0, -0.08, 0.02);
    this.bones.handR.add(this.hand);

    // Eyes: dark for the living, pale and cloudy for the dead.
    const eyeMat = new THREE.MeshBasicMaterial({ color: this.zombie ? "#cfcaa0" : "#1a1612" });
    for (const x of [-0.033, 0.033]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.011, 6, 4), eyeMat);
      eye.position.set(x, 0.005, 0.085);
      this.head.add(eye);
    }

    if (this.zombie) {
      this.limp = Math.random() < 0.5 ? (Math.random() < 0.5 ? -1 : 1) * (0.3 + Math.random() * 0.5) : 0;
      this.hunch = 0.15 + Math.random() * 0.25;
      const r = Math.random();
      this.reach = r < 0.4 ? 0.85 + Math.random() * 0.15 : r < 0.75 ? 0.45 + Math.random() * 0.2 : Math.random() * 0.15;
    }
    for (const b of boneObjs) this.pose.set(b, new THREE.Euler());
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
    // Geometry is a shared template; only the material is per character.
    this.material.dispose();
  }
}

/** Simple held-item meshes. */
export function makeHeldItem(id: string): THREE.Object3D | null {
  const g = new THREE.Group();
  const box = (w: number, h: number, d: number, color: string, y: number, z = 0) => {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.2 }),
    );
    m.position.set(0, y, z);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  switch (id) {
    case "pistol":
      box(0.03, 0.11, 0.045, "#1d1d1d", -0.02);
      box(0.032, 0.05, 0.19, "#262626", 0.025, 0.07);
      // Barrel (local +z) points out of the fist along the forearm.
      g.rotation.x = Math.PI / 2;
      return g;
    case "baseball_bat":
      box(0.04, 0.85, 0.04, "#8a6a42", -0.38);
      box(0.065, 0.35, 0.065, "#8a6a42", -0.7);
      g.rotation.x = -Math.PI / 2;
      return g;
    case "fire_axe":
      box(0.04, 0.9, 0.04, "#7a2a20", -0.4);
      box(0.03, 0.18, 0.26, "#9aa0a6", -0.8, 0.1);
      g.rotation.x = -Math.PI / 2;
      return g;
    case "kitchen_knife":
      box(0.025, 0.1, 0.025, "#222", -0.03);
      box(0.012, 0.19, 0.035, "#c0c4c8", -0.16);
      g.rotation.x = -Math.PI / 2;
      return g;
    default:
      return null;
  }
}
