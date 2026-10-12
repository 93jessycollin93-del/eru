import * as THREE from "three";
import { GARMENTS, type Appearance, type GarmentDef, type GarmentId, type GearId, type WoundMark } from "../../sim/appearance";
import { BI, HEAD_CENTRE, type PieceId } from "./humanoidGeometry";

/**
 * Turns an engine-agnostic Appearance into what this renderer needs: shader
 * codes and parameters, the geometry pieces to show, and wound positions in
 * rest space. Shader int codes live only here and in humanoidShader.ts.
 */

const code = <T extends string>(ids: readonly T[]) => Object.fromEntries(ids.map((id, i) => [id, i])) as Record<T, number>;

export const PATTERN = code(["plain", "heather", "stripes", "plaid", "camo", "ringer"] as const);
export const COLLAR = code(["crew", "vneck", "polo", "button", "hood", "zip", "none"] as const);
export const POCKETS = code(["none", "chest1", "chest2", "kangaroo", "jeans", "cargo", "patch"] as const);
/** Outer kinds the shader treats specially (others are generic jackets). */
export const OUTER_KIND: Partial<Record<GarmentId, number>> = { puffer: 4, rain_shell: 6, denim_jacket: 5, hi_vis_vest: 11, blaze_vest: 12, apron: 13, police_vest: 14, camo_jacket: 10 };
export const FEET = code(["none", "sneakers", "running_shoes", "dress_shoes", "boots", "work_boots", "duty_boots", "slippers", "socks", "barefoot"] as const);
export const HAIR = code(["bald", "buzz", "short", "medium", "long", "ponytail", "bun", "balding"] as const);
export const HAIR_THICKNESS = [0, 0.002, 0.006, 0.009, 0.009, 0.005, 0.005, 0.005];
/** Decal layers after the faces in the face texture array. */
export const DECAL = { police: 0, sheriff: 1 } as const;

const garment = (id: GarmentId): GarmentDef => GARMENTS[id];

/** Geometry pieces for an appearance (hair and headwear included, plus gear). */
export function piecesFor(app: Appearance): PieceId[] {
  const out: PieceId[] = [];
  const head = app.head?.id;
  const hoodUp = head === "hood_up";
  if (app.outer && garment(app.outer.id).hood && !hoodUp) out.push("hood_down");
  if (hoodUp) out.push("hood_up");
  if (head === "cap" || head === "police_cap" || head === "blaze_cap") out.push("cap");
  if (head === "hard_hat") out.push("hard_hat");
  if (!hoodUp) {
    if (app.hair.style === "long") out.push("hair_long");
    if (app.hair.style === "ponytail") out.push("ponytail");
    if (app.hair.style === "bun" && !out.includes("cap")) out.push("bun");
  }
  const gearPieces: Partial<Record<GearId, PieceId>> = {
    daypack: "daypack",
    hikepack: "hikepack",
    belt: "belt",
    duty_belt: "duty_belt",
    holster: "holster",
    holster_gun: "holster_gun",
    radio: "radio",
    tool_belt: "tool_belt",
    knife_sheath: "knife_sheath",
    knife_sheath_knife: "knife_sheath_knife",
    sling_bat: "sling_bat",
    sling_axe: "sling_axe",
    hammer_loop: "hammer_loop",
  };
  for (const g of app.gear) {
    const p = gearPieces[g];
    if (p) out.push(p);
  }
  return out;
}

/** Strap bitmask for the shader: 1 daypack, 2 hikepack, 4 a weapon sling across the chest. */
export function strapMask(gear: readonly GearId[]) {
  return (gear.includes("daypack") ? 1 : 0) | (gear.includes("hikepack") ? 2 : 0) | (gear.includes("sling_bat") || gear.includes("sling_axe") ? 4 : 0);
}

/** A wound's centre in rest space (xyz) and radius (w). */
export function woundRest(w: WoundMark | undefined, rest: THREE.Vector3[]): THREE.Vector4 {
  if (!w) return new THREE.Vector4(0, -10, 0, 0);
  const ang = w.around * Math.PI * 2;
  const dir = new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang));
  let c: THREE.Vector3;
  let r: number;
  switch (w.part) {
    case "head":
      // On the neck.
      c = new THREE.Vector3(0, HEAD_CENTRE.y - 0.13 + w.along * 0.2, 0);
      r = 0.052;
      break;
    case "torso":
      c = new THREE.Vector3(0, 0.95 + w.along * 0.45, 0);
      r = 0.15;
      dir.z *= 0.8;
      break;
    case "leftArm":
    case "rightArm": {
      const s = w.part === "leftArm" ? "L" : "R";
      const a = rest[BI[`upperArm${s}`]];
      const b = rest[BI[`hand${s}`]];
      c = a.clone().lerp(b, w.along);
      r = 0.055 - w.along * 0.012;
      break;
    }
    default: {
      const s = w.part === "leftLeg" ? "L" : "R";
      const a = rest[BI[`thigh${s}`]];
      const b = rest[BI[`foot${s}`]];
      c = a.clone().lerp(b, w.along);
      r = 0.085 - w.along * 0.03;
    }
  }
  c.addScaledVector(dir, r);
  return new THREE.Vector4(c.x, c.y, c.z, w.size);
}
