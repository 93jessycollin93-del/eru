import * as THREE from "three";

/**
 * Character geometry. One "kit" per body (sex × build): the lofted, skinned
 * body plus every optional piece (hoods, caps, long hair, packs, belts,
 * holsters, slung weapons), all in one set of vertex attributes, each piece
 * recorded as an index range. A character's geometry shares the kit's
 * attributes (one GPU upload per body) and has its own small index buffer
 * listing just the pieces it wears, so it still draws in one call and only
 * skins what it shows. Pieces are real geometry so they cast shadows and
 * ambient occlusion like the body does.
 */

// ----------------------------------------------------------------- skeleton

export const BONES = [
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

export type BoneName = (typeof BONES)[number][0];
export const BI = Object.fromEntries(BONES.map((b, i) => [b[0], i])) as Record<BoneName, number>;

/** Zones, read by the shader (keep in sync with humanoidShader.ts). */
export const Z = {
  ARM: 0,
  TORSO: 1,
  LEG: 2,
  SHOE: 3,
  HEAD: 4,
  SKIN: 5,
  EYE: 7,
  HAIR: 8,
  HEADWEAR: 9,
  HOOD: 10,
  GEAR: 11,
  LEATHER: 12,
  /** Polymer and steel. limbT: 0 black polymer, 0.5 steel, 1 brass/badge. */
  HARD: 13,
  /** limbT: 0 bare wood, 1 painted red (fire axe). */
  WOOD: 14,
} as const;

export interface BuildShape {
  shoulder: number;
  hip: number;
  girth: number;
  chest: number;
}

export const SHAPES: Record<string, BuildShape> = {
  "m-slim": { shoulder: 1.0, hip: 0.95, girth: 0.88, chest: 1.0 },
  "m-average": { shoulder: 1.05, hip: 1.0, girth: 1.0, chest: 1.05 },
  "m-heavy": { shoulder: 1.08, hip: 1.1, girth: 1.28, chest: 1.12 },
  "f-slim": { shoulder: 0.88, hip: 1.05, girth: 0.86, chest: 1.0 },
  "f-average": { shoulder: 0.9, hip: 1.1, girth: 0.96, chest: 1.06 },
  "f-heavy": { shoulder: 0.94, hip: 1.18, girth: 1.22, chest: 1.12 },
};

export function restPositions(shape: BuildShape): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  BONES.forEach(([name, parent, off], i) => {
    const o = new THREE.Vector3(...off);
    if (name.startsWith("shoulder")) o.x *= shape.shoulder;
    if (name.startsWith("thigh")) o.x *= shape.hip;
    out[i] = parent < 0 ? o : o.add(out[parent]);
  });
  return out;
}

/** Centre of the head in rest space (all bodies share the spine heights). */
export const HEAD_CENTRE = new THREE.Vector3(0, 0.95 + 0.12 + 0.18 + 0.2 + 0.08 + 0.095, 0.01);
/** Eye centres relative to the head centre (x is mirrored). */
export const EYE_OFFSET = new THREE.Vector3(0.033, 0.005, 0.083);

// ----------------------------------------------------------------- builder

type Weights = [[number, number], [number, number]];

class GeoBuilder {
  pos: number[] = [];
  skinIdx: number[] = [];
  skinW: number[] = [];
  zone: number[] = [];
  limbT: number[] = [];
  index: number[] = [];
  /** Groups of coincident vertices whose normals are averaged (ellipsoid seams and poles), so no lighting seam shows. */
  welds: number[][] = [];

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

  /**
   * Ellipsoid around a centre, bound to one bone (optionally blended with a
   * second below a height). `keep(n)` drops triangles whose corners all fail
   * it (open shells: a hood's face opening, a cap's underside).
   */
  ellipsoid(
    center: THREE.Vector3,
    radii: THREE.Vector3,
    lat: number,
    lon: number,
    bone: number,
    zone: number,
    shape?: (p: THREE.Vector3, n: THREE.Vector3) => void,
    blend?: { bone: number; belowY: number; range: number },
    keep?: (n: THREE.Vector3) => boolean,
    t?: (n: THREE.Vector3) => number,
  ) {
    const base = this.pos.length / 3;
    const kept: boolean[] = [];
    for (let i = 0; i <= lat; i++) {
      const v = i / lat;
      const phi = v * Math.PI;
      for (let j = 0; j <= lon; j++) {
        // Start at the back, so the wrap-around seam sits behind (under the hair), not down the face.
        const theta = (j / lon) * Math.PI * 2 + Math.PI;
        const n = new THREE.Vector3(Math.sin(phi) * Math.sin(theta), Math.cos(phi), Math.sin(phi) * Math.cos(theta));
        kept.push(keep ? keep(n) : true);
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
        this.vertex(p, b, w, zone, t ? t(n) : 1 - v);
      }
    }
    for (let i = 0; i < lat; i++) {
      for (let j = 0; j < lon; j++) {
        const a = i * (lon + 1) + j;
        const b = a + lon + 1;
        if (!kept[a] && !kept[b] && !kept[a + 1] && !kept[b + 1]) continue;
        this.index.push(base + a, base + b, base + a + 1, base + a + 1, base + b, base + b + 1);
      }
    }
    const weld = (b0: number) => {
      for (let i = 1; i < lat; i++) this.welds.push([b0 + i * (lon + 1), b0 + i * (lon + 1) + lon]);
      this.welds.push(Array.from({ length: lon + 1 }, (_, j) => b0 + j));
      this.welds.push(Array.from({ length: lon + 1 }, (_, j) => b0 + lat * (lon + 1) + j));
    };
    weld(base);
    if (!keep) return;
    // An open shell (long hair, a raised hood, a cap) is seen from inside through its opening.
    // The material is single-sided, so give it a lining: the same vertices again (their own,
    // or averaging would cancel the normals to zero) wound the other way, facing in.
    const lining = this.pos.length / 3;
    const count = (lat + 1) * (lon + 1);
    for (let i = 0; i < count; i++) {
      const s = base + i;
      this.pos.push(this.pos[s * 3], this.pos[s * 3 + 1], this.pos[s * 3 + 2]);
      this.skinIdx.push(...this.skinIdx.slice(s * 4, s * 4 + 4));
      this.skinW.push(...this.skinW.slice(s * 4, s * 4 + 4));
      this.zone.push(this.zone[s]);
      this.limbT.push(this.limbT[s]);
    }
    for (let i = 0; i < lat; i++) {
      for (let j = 0; j < lon; j++) {
        const a = i * (lon + 1) + j;
        const b = a + lon + 1;
        if (!kept[a] && !kept[b] && !kept[a + 1] && !kept[b + 1]) continue;
        this.index.push(lining + a, lining + a + 1, lining + b, lining + a + 1, lining + b + 1, lining + b);
      }
    }
    weld(lining);
  }

  /** A hard-edged box (4 vertices per face, so faces shade flat), rotated about y then x, rigid to one bone. */
  box(center: THREE.Vector3, size: THREE.Vector3, bone: number, zone: number, t = 0, rotY = 0, rotX = 0, rotZ = 0) {
    const e = new THREE.Euler(rotX, rotY, rotZ, "YXZ");
    const h = size.clone().multiplyScalar(0.5);
    const faces: [THREE.Vector3, THREE.Vector3, THREE.Vector3][] = [
      [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)],
      [new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1)],
      [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)],
      [new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0)],
      [new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)],
      [new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0)],
    ];
    for (const [n, u, v] of faces) {
      const base = this.pos.length / 3;
      for (const [su, sv] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ]) {
        // Axis-aligned unit n, u, v with u × v = n, so each face winds outward.
        const p = new THREE.Vector3().add(n).addScaledVector(u, su).addScaledVector(v, sv).multiply(h);
        p.applyEuler(e).add(center);
        this.vertex(p, [bone, bone], [1, 0], zone, t);
      }
      this.index.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  /** Start recording a piece's index range. */
  mark() {
    return this.index.length;
  }

  attributes() {
    const position = new THREE.Float32BufferAttribute(this.pos, 3);
    // Normals for the whole kit at once (pieces share no vertices with the body).
    const tmp = new THREE.BufferGeometry();
    tmp.setAttribute("position", position);
    tmp.setIndex(this.index);
    tmp.computeVertexNormals();
    const normal = tmp.getAttribute("normal") as THREE.BufferAttribute;
    const sum = new THREE.Vector3();
    for (const group of this.welds) {
      sum.set(0, 0, 0);
      for (const i of group) sum.add(new THREE.Vector3(normal.getX(i), normal.getY(i), normal.getZ(i)));
      if (sum.lengthSq() < 1e-12) continue;
      sum.normalize();
      for (const i of group) normal.setXYZ(i, sum.x, sum.y, sum.z);
    }
    return {
      position,
      normal,
      skinIndex: new THREE.Uint16BufferAttribute(this.skinIdx, 4),
      skinWeight: new THREE.Float32BufferAttribute(this.skinW, 4),
      zone: new THREE.Float32BufferAttribute(this.zone, 1),
      limbT: new THREE.Float32BufferAttribute(this.limbT, 1),
    };
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

// ----------------------------------------------------------------- pieces

export const PIECES = [
  "hood_down",
  "hood_up",
  "cap",
  "hard_hat",
  "hair_long",
  "ponytail",
  "bun",
  "daypack",
  "hikepack",
  "belt",
  "duty_belt",
  "holster",
  "holster_gun",
  "radio",
  "tool_belt",
  "knife_sheath",
  "knife_sheath_knife",
  "sling_bat",
  "sling_axe",
  "sling_bat_pack",
  "sling_axe_pack",
  "sling_bat_hike",
  "sling_axe_hike",
  "hammer_loop",
] as const;
export type PieceId = (typeof PIECES)[number];

interface Kit {
  attributes: ReturnType<GeoBuilder["attributes"]>;
  /** Full index of the kit (body first, then pieces). */
  index: number[];
  body: [number, number];
  pieces: Record<PieceId, [number, number]>;
  vertexCount: number;
}

const kits = new Map<string, Kit>();

function buildKit(key: string): Kit {
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
  /** Torso half-widths (side, front) at a rest height. */
  const torsoAt = (y: number) => torsoProfile((y - torsoBottom.y) / (torsoTop.y - torsoBottom.y));
  const torsoW = (_t: number, p: THREE.Vector3): Weights => {
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
  };
  gb.tube(torsoBottom, torsoTop, 16, 16, torsoProfile, torsoW, Z.TORSO);

  // Neck and head.
  gb.tube(
    R[BI.neck].clone().setY(R[BI.neck].y - 0.04),
    R[BI.head].clone().add(new THREE.Vector3(0, 0.04, 0)),
    3,
    AR,
    () => [0.05, 0.055],
    segW(BI.head, BI.neck, -1, 0.6),
    Z.SKIN,
  );
  const headC = R[BI.head].clone().add(new THREE.Vector3(0, 0.095, 0.01));
  const headR = new THREE.Vector3(female ? 0.083 : 0.09, 0.115, 0.1);
  gb.ellipsoid(
    headC,
    headR,
    16,
    22,
    BI.head,
    Z.HEAD,
    (p, n) => {
      // Jaw narrows towards the chin; a nose; brow ridge; cheekbones; eye sockets; ears.
      if (n.y < 0) {
        const k = 1 + n.y * 0.28;
        p.x *= k;
        p.z *= 0.92 + 0.08 * k;
      }
      if (n.z > 0.75 && Math.abs(n.x) < 0.18 && n.y > -0.35 && n.y < 0.15) {
        p.z += 0.022 * (1 - Math.abs(n.x) / 0.18) * Math.max(0, 1 - Math.abs(n.y + 0.1) / 0.25);
      }
      if (n.z > 0.6 && n.y > 0.12 && n.y < 0.3) p.z += 0.006;
      // Sockets sit a little in under the brow.
      if (n.z > 0.7 && n.y > -0.05 && n.y < 0.12 && Math.abs(Math.abs(n.x) - 0.36) < 0.16) p.z -= 0.004;
      // Cheekbones.
      if (n.z > 0.45 && n.y < -0.02 && n.y > -0.25 && Math.abs(n.x) > 0.4 && Math.abs(n.x) < 0.8) p.x += Math.sign(n.x) * 0.003;
      if (Math.abs(n.x) > 0.93 && Math.abs(n.y) < 0.18 && n.z < 0.1 && n.z > -0.3) p.x += Math.sign(n.x) * 0.012;
    },
    { bone: BI.neck, belowY: headC.y - 0.07, range: 0.06 },
  );
  // Eyes: wet caps set into the sockets (the shader draws sclera, iris, lids).
  for (const sx of [-1, 1]) {
    const c = headC.clone().add(new THREE.Vector3(EYE_OFFSET.x * sx, EYE_OFFSET.y, EYE_OFFSET.z));
    gb.ellipsoid(c, new THREE.Vector3(0.012, 0.012, 0.012), 6, 8, BI.head, Z.EYE, undefined, undefined, (n) => n.z > -0.2);
  }

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
    gb.tube(sh.clone().setY(sh.y - 0.01), ua.clone().setY(ua.y - 0.03), 3, AR, () => [0.07 * gArm, 0.062 * gArm], () => [[UA, BI.chest], [0.6, 0.4]], Z.TORSO, false, false);
    gb.tube(
      ua.clone().setY(ua.y - 0.03),
      fa,
      6,
      AR,
      (t) => [(0.066 - t * 0.014) * gArm * armScale, (0.062 - t * 0.012) * gArm * armScale],
      segW(UA, BI.chest, FA, 0.15, 0.15),
      Z.ARM,
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
      Z.ARM,
      false,
      true,
      (t) => 0.5 + t * 0.5,
    );
    // Hand: palm and fingers as one rounded mitt, thumb side slightly wider.
    gb.ellipsoid(ha.clone().add(new THREE.Vector3(0, -0.055, 0.008)), new THREE.Vector3(0.04 * armScale, 0.058, 0.024), 6, 8, HA, Z.SKIN, (p, n) => {
      if (n.y < -0.3) p.z += 0.008; // fingers curl forward
    });
  }

  // Legs: thigh, shin (with a calf), shoe. limbT runs 0 (hip) → 1 (ankle) for hems and boot shafts.
  const gLeg = Math.pow(g, 0.6) * (female ? 1.02 : 1);
  for (const s of ["L", "R"] as const) {
    const th = R[BI[`thigh${s}`]];
    const sn = R[BI[`shin${s}`]];
    const ft = R[BI[`foot${s}`]];
    const TH = BI[`thigh${s}`];
    const SH = BI[`shin${s}`];
    const FT = BI[`foot${s}`];
    gb.tube(th.clone().setY(th.y + 0.06), sn, 8, AR, (t) => [(0.092 - t * 0.035) * gLeg, (0.09 - t * 0.03) * gLeg], segW(TH, BI.hips, SH, 0.25, 0.12), Z.LEG, false, false, (t) => t * 0.5);
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
      Z.LEG,
      false,
      true,
      (t) => 0.5 + t * 0.5,
    );
    gb.ellipsoid(ft.clone().add(new THREE.Vector3(0, 0.035, 0.05)), new THREE.Vector3(0.05, 0.045, 0.13), 6, 10, FT, Z.SHOE, (p) => {
      if (p.y < -0.025) p.y = -0.025 - (p.y + 0.025) * 0.15; // flat sole
    });
  }
  const body: [number, number] = [0, gb.mark()];

  // ------------------------------------------------------------ pieces
  const pieces = {} as Record<PieceId, [number, number]>;
  const piece = (id: PieceId, build: () => void) => {
    const start = gb.mark();
    build();
    pieces[id] = [start, gb.mark() - start];
  };
  const [, chestFront] = torsoAt(1.26);
  const backZ = -chestFront; // back of the ribcage
  const waistY = 0.985;
  const [, waistFront] = torsoAt(waistY);
  const hipSide = (y: number) => torsoAt(y)[0];
  /** A band around the torso at height y (belts), `out` metres proud of the body. */
  const band = (y0: number, y1: number, out: number, zone: number) =>
    gb.tube(
      new THREE.Vector3(0, y0, 0),
      new THREE.Vector3(0, y1, 0),
      1,
      18,
      (t) => {
        const [s, f] = torsoAt(y0 + (y1 - y0) * t);
        return [s + out, f + out];
      },
      () => [[BI.hips, BI.hips], [1, 0]],
      zone,
      false,
      false,
    );
  /** A point on the torso surface at height y and angle a (0 front, +π/2 toward +x). */
  const onTorso = (y: number, a: number, out: number) => {
    const [s, f] = torsoAt(y);
    return new THREE.Vector3(Math.sin(a) * (s + out), y, Math.cos(a) * (f + out));
  };

  piece("hood_down", () => {
    // Bunched behind the neck and shoulders.
    gb.ellipsoid(new THREE.Vector3(0, torsoTop.y - 0.015, backZ * 0.55 - 0.035), new THREE.Vector3(0.13, 0.07, 0.065), 6, 12, BI.chest, Z.HOOD, (p, n) => {
      if (n.z > 0.2) p.z -= n.z * 0.03;
    });
  });
  piece("hood_up", () => {
    gb.ellipsoid(
      headC.clone().add(new THREE.Vector3(0, 0.012, -0.012)),
      headR.clone().multiplyScalar(1.17).setY(headR.y * 1.15),
      12,
      18,
      BI.head,
      Z.HOOD,
      (p, n) => {
        // Drape down at the back onto the shoulders.
        if (n.y < -0.3 && n.z < 0.3) p.y -= 0.03 * (-n.y - 0.3);
      },
      { bone: BI.neck, belowY: headC.y - 0.06, range: 0.06 },
      (n) => !(n.z > 0.45 && n.y < 0.62 && n.y > -0.75),
    );
  });
  piece("cap", () => {
    gb.ellipsoid(
      headC.clone().add(new THREE.Vector3(0, 0.03, -0.004)),
      new THREE.Vector3(headR.x + 0.009, 0.092, headR.z + 0.008),
      8,
      18,
      BI.head,
      Z.HEADWEAR,
      undefined,
      undefined,
      (n) => n.y > -0.05,
    );
    // Brim.
    gb.ellipsoid(headC.clone().add(new THREE.Vector3(0, 0.04, headR.z + 0.035)), new THREE.Vector3(0.085, 0.007, 0.065), 4, 14, BI.head, Z.HEADWEAR, (p, n) => {
      p.y -= Math.max(0, n.z) * 0.012; // curved down at the front
      if (n.z < -0.2) p.z += 0.02; // tucked into the crown
    });
  });
  piece("hard_hat", () => {
    // Shell with a ridge down the middle and a brim all round, peak at the front.
    gb.ellipsoid(headC.clone().add(new THREE.Vector3(0, 0.04, 0)), new THREE.Vector3(headR.x + 0.022, 0.1, headR.z + 0.024), 8, 18, BI.head, Z.HEADWEAR, (p, n) => {
      if (Math.abs(n.x) < 0.12 && n.y > 0.2) p.y += 0.006;
    }, undefined, (n) => n.y > -0.02);
    gb.ellipsoid(headC.clone().add(new THREE.Vector3(0, 0.035, 0.012)), new THREE.Vector3(headR.x + 0.045, 0.006, headR.z + 0.06), 3, 18, BI.head, Z.HEADWEAR, (p, n) => {
      if (n.z > 0.3) p.z += n.z * 0.02;
      p.y -= Math.max(0, n.z) * 0.006;
    });
  });
  piece("hair_long", () => {
    gb.ellipsoid(
      headC.clone().add(new THREE.Vector3(0, -0.055, -0.03)),
      new THREE.Vector3(headR.x + 0.012, 0.15, 0.085),
      10,
      16,
      BI.head,
      Z.HAIR,
      (p, n) => {
        if (n.y < 0) p.z -= 0.02 * -n.y; // hangs off the back of the neck
      },
      { bone: BI.chest, belowY: headC.y - 0.1, range: 0.12 },
      (n) => n.z < 0.25 || n.y > 0.55,
    );
  });
  piece("ponytail", () => {
    const from = headC.clone().add(new THREE.Vector3(0, 0.02, -headR.z - 0.005));
    const to = from.clone().add(new THREE.Vector3(0, -0.17, -0.035));
    gb.tube(from, to, 5, 8, (t) => [0.024 * (1 - t * 0.55) + 0.006 * Math.sin(t * Math.PI), 0.02 * (1 - t * 0.5)], (t) => (t < 0.5 ? [[BI.head, BI.neck], [1 - t, t]] : [[BI.neck, BI.chest], [1.5 - t, t - 0.5]]), Z.HAIR, true, true);
  });
  piece("bun", () => {
    gb.ellipsoid(headC.clone().add(new THREE.Vector3(0, 0.055, -headR.z + 0.005)), new THREE.Vector3(0.038, 0.033, 0.035), 6, 10, BI.head, Z.HAIR);
  });
  /**
   * Where a pack's front face rests on this body's back between two heights: a plane through
   * the back at both ends, pushed out past wherever the back bulges in between (the ribcage),
   * so a pack lies against a heavy build instead of floating off its lower back.
   */
  const packRest = (yb: number, yt: number) => {
    const back = (y: number) => -torsoAt(y)[1];
    const zb = back(yb);
    const zt = back(yt);
    let push = 0;
    for (let k = 0; k <= 10; k++) {
      const y = yb + ((yt - yb) * k) / 10;
      push = Math.max(push, zb + ((zt - zb) * k) / 10 - back(y));
    }
    return { mid: (zb + zt) / 2 - push - 0.006, tilt: Math.atan2(zt - zb, yt - yb), ym: (yb + yt) / 2 };
  };
  /** A box hung behind a rest plane: `depth` deep, its centre `along` up the plane from the middle. */
  const packBox = (rest: ReturnType<typeof packRest>, size: THREE.Vector3, along = 0, out = 0, t = 0) => {
    const up = new THREE.Vector3(0, Math.cos(rest.tilt), Math.sin(rest.tilt));
    const back = new THREE.Vector3(0, Math.sin(rest.tilt), -Math.cos(rest.tilt));
    const c = new THREE.Vector3(0, rest.ym, rest.mid).addScaledVector(up, along).addScaledVector(back, out + size.z / 2);
    gb.box(c, size, BI.chest, Z.GEAR, t, 0, rest.tilt);
  };
  const dayRest = packRest(1.01, 1.39);
  const hikeRest = packRest(0.88, 1.44);
  piece("daypack", () => {
    packBox(dayRest, new THREE.Vector3(0.28, 0.38, 0.12));
    packBox(dayRest, new THREE.Vector3(0.22, 0.16, 0.04), -0.09, 0.12); // front pocket
  });
  piece("hikepack", () => {
    packBox(hikeRest, new THREE.Vector3(0.32, 0.56, 0.17));
    packBox(hikeRest, new THREE.Vector3(0.3, 0.06, 0.18), 0.27, -0.005); // lid
    // Bedroll strapped across the top.
    const bz = hikeRest.mid - 0.1;
    gb.tube(new THREE.Vector3(-0.19, 1.5, bz), new THREE.Vector3(0.19, 1.5, bz), 1, 10, () => [0.055, 0.055], () => [[BI.chest, BI.chest], [1, 0]], Z.GEAR, true, true, () => 1);
  });
  piece("belt", () => {
    band(waistY - 0.018, waistY + 0.018, 0.008, Z.LEATHER);
    gb.box(new THREE.Vector3(0, waistY, waistFront + 0.012), new THREE.Vector3(0.05, 0.04, 0.012), BI.hips, Z.HARD, 0.5);
  });
  piece("duty_belt", () => {
    band(waistY - 0.03, waistY + 0.03, 0.02, Z.LEATHER);
    // Mag pouch, cuff case, glove pouch, light.
    const pouch = (a: number, w: number, h: number, d: number, t = 0) => {
      const p = onTorso(waistY, a, 0.04);
      gb.box(p, new THREE.Vector3(w, h, d), BI.hips, Z.LEATHER, t, a);
    };
    pouch(-0.45, 0.07, 0.08, 0.035);
    pouch(-1.2, 0.06, 0.07, 0.04);
    pouch(2.6, 0.075, 0.07, 0.04);
    pouch(-2.4, 0.05, 0.09, 0.04);
    gb.box(onTorso(waistY - 0.03, 0.75, 0.04), new THREE.Vector3(0.035, 0.12, 0.035), BI.hips, Z.HARD, 0, 0.75);
  });
  piece("holster", () => {
    const p = new THREE.Vector3(hipSide(0.92) + 0.03, 0.915, 0.0);
    gb.box(p, new THREE.Vector3(0.045, 0.2, 0.09), BI.hips, Z.LEATHER, 0, 0, 0.1);
    gb.box(p.clone().add(new THREE.Vector3(-0.012, 0.07, 0)), new THREE.Vector3(0.03, 0.06, 0.1), BI.hips, Z.LEATHER, 0, 0, 0.1);
  });
  piece("holster_gun", () => {
    // The grip and back of the slide out of the holster's top.
    const p = new THREE.Vector3(hipSide(0.92) + 0.03, 1.03, -0.025);
    gb.box(p, new THREE.Vector3(0.03, 0.1, 0.045), BI.hips, Z.HARD, 0, 0, -0.35);
    gb.box(p.clone().add(new THREE.Vector3(0.002, -0.03, 0.05)), new THREE.Vector3(0.032, 0.035, 0.08), BI.hips, Z.HARD, 0, 0, 0);
  });
  piece("radio", () => {
    // On the chest surface where it is (10 cm off the centreline the chest curves away), lying
    // along its slope: placed from the deepest point of the chest it hung in the air.
    const surface = (y: number) => {
      const [s, f] = torsoAt(y);
      return f * Math.sqrt(Math.max(0, 1 - (0.1 / s) ** 2));
    };
    const tilt = -Math.atan2(surface(1.25) - surface(1.35), 0.1);
    const p = new THREE.Vector3(-0.1, 1.3, surface(1.3) + 0.0175 + 0.004);
    gb.box(p, new THREE.Vector3(0.06, 0.1, 0.035), BI.chest, Z.HARD, 0, 0, tilt);
    gb.box(p.clone().add(new THREE.Vector3(0.018, 0.09, -Math.sin(-tilt) * 0.09)), new THREE.Vector3(0.008, 0.08, 0.008), BI.chest, Z.HARD, 0, 0, tilt);
  });
  piece("tool_belt", () => {
    band(waistY - 0.025, waistY + 0.025, 0.012, Z.LEATHER);
    // Two nail pouches (no hammer: a visible tool would have to be lootable).
    for (const a of [0.9, -0.9]) {
      const p = onTorso(waistY - 0.08, a, 0.05);
      gb.box(p, new THREE.Vector3(0.12, 0.15, 0.06), BI.hips, Z.LEATHER, 1, a);
      gb.box(p.clone().add(new THREE.Vector3(0, 0.07, 0)).addScaledVector(new THREE.Vector3(Math.sin(a), 0, Math.cos(a)), 0.012), new THREE.Vector3(0.12, 0.012, 0.07), BI.hips, Z.LEATHER, 1, a);
    }
  });
  const sheathAt = new THREE.Vector3(-(hipSide(0.93) + 0.025), 0.9, 0.03);
  piece("knife_sheath", () => {
    gb.box(sheathAt, new THREE.Vector3(0.025, 0.2, 0.05), BI.hips, Z.LEATHER, 0, 0, -0.08);
  });
  piece("knife_sheath_knife", () => {
    // The handle of a knife in the sheath (separate, so an empty sheath can be shown).
    gb.box(sheathAt.clone().add(new THREE.Vector3(-0.011, 0.14, 0)), new THREE.Vector3(0.028, 0.09, 0.03), BI.hips, Z.HARD, 0, 0, -0.08);
  });
  // A slung weapon lies on the back, or on the outside of a pack (through it, otherwise).
  const slingBat = (z: number) => {
    gb.tube(new THREE.Vector3(-0.17, 0.82, z), new THREE.Vector3(0.2, 1.62, z - 0.015), 4, 8, (t) => [0.016 + t * 0.018, 0.016 + t * 0.018], () => [[BI.chest, BI.chest], [1, 0]], Z.WOOD, true, true, () => 0);
  };
  const slingAxe = (z: number) => {
    const a = new THREE.Vector3(0.17, 0.84, z);
    const b = new THREE.Vector3(-0.18, 1.66, z - 0.01);
    gb.tube(a, b, 3, 8, () => [0.018, 0.016], () => [[BI.chest, BI.chest], [1, 0]], Z.WOOD, true, true, () => 1);
    const dir = b.clone().sub(a);
    const ang = Math.atan2(dir.x, dir.y);
    gb.box(b.clone().add(new THREE.Vector3(0.02, -0.06, 0)), new THREE.Vector3(0.24, 0.13, 0.025), BI.chest, Z.HARD, 0.5, 0, 0, -ang);
  };
  const overDay = dayRest.mid - 0.12 - 0.04 - 0.022;
  const overHike = hikeRest.mid - 0.17 - 0.03;
  piece("sling_bat", () => slingBat(backZ - 0.045));
  piece("sling_axe", () => slingAxe(backZ - 0.045));
  piece("sling_bat_pack", () => slingBat(overDay));
  piece("sling_axe_pack", () => slingAxe(overDay));
  piece("sling_bat_hike", () => slingBat(overHike));
  piece("sling_axe_hike", () => slingAxe(overHike));
  piece("hammer_loop", () => {
    const hp = new THREE.Vector3(hipSide(0.95) + 0.02, waistY - 0.04, -0.04);
    gb.tube(hp.clone().add(new THREE.Vector3(0, 0.03, 0)), hp.clone().add(new THREE.Vector3(0, -0.24, 0)), 1, 6, () => [0.013, 0.011], () => [[BI.hips, BI.hips], [1, 0]], Z.WOOD, true, true, () => 0);
    gb.box(hp.clone().add(new THREE.Vector3(0, 0.05, 0)), new THREE.Vector3(0.026, 0.026, 0.1), BI.hips, Z.HARD, 0.5);
  });

  return { attributes: gb.attributes(), index: gb.index, body, pieces, vertexCount: gb.pos.length / 3 };
}

export function kit(bodyKey: string): Kit {
  let k = kits.get(bodyKey);
  if (!k) {
    k = buildKit(bodyKey);
    kits.set(bodyKey, k);
  }
  return k;
}

const geometries = new Map<string, THREE.BufferGeometry>();

/**
 * Geometry for a body wearing these pieces. Cached forever: geometries share
 * their kit's attribute buffers, so disposing one would free the others'.
 */
export function geometryFor(bodyKey: string, pieces: readonly PieceId[]): THREE.BufferGeometry {
  const list = PIECES.filter((p) => pieces.includes(p));
  const key = `${bodyKey}|${list.join("+")}`;
  let geo = geometries.get(key);
  if (geo) return geo;
  const k = kit(bodyKey);
  const ranges = [k.body, ...list.map((p) => k.pieces[p])];
  const count = ranges.reduce((s, [, n]) => s + n, 0);
  const idx = k.vertexCount > 65535 ? new Uint32Array(count) : new Uint16Array(count);
  let o = 0;
  for (const [start, n] of ranges) {
    for (let i = 0; i < n; i++) idx[o++] = k.index[start + i];
  }
  geo = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(k.attributes)) geo.setAttribute(name, attr);
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.2);
  geometries.set(key, geo);
  return geo;
}

/** For tests and the perf harness. */
export function geometryStats() {
  return { kits: kits.size, geometries: geometries.size, kitVertices: [...kits.values()].map((k) => k.vertexCount) };
}
