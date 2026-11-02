/**
 * What a person looks like: body, face, hair, clothes, gear and the state
 * they're in. A pure function of (seed, role), so a saved zombie comes back as
 * the same person and nothing about looks is ever saved. Every facet draws from
 * its own stream (deriveSeed), so editing one table never reshuffles another,
 * and nothing here touches the zombie's gameplay stream (zombies.ts).
 *
 * Engine-agnostic: the browser renderer turns an Appearance into shader
 * parameters and geometry parts; Unreal would drive modular meshes with it.
 */
import type { BodyPart } from "./body";
import { deriveSeed, mulberry32, range } from "./rng";
import {
  FACES_PER_SEX,
  GARMENTS,
  GREY_HAIR,
  HAIR_COLORS,
  HAIR_STYLES,
  IRIS_COLORS,
  LIVING_ONLY_GEAR,
  PALETTES,
  PLAYER_GEAR_RULES,
  PLAYER_HIKEPACK_KG,
  PLAYER_PACK_KG,
  ROLES,
  SITE_ROLES,
  SKIN_TONES,
  type Build,
  type GarmentDef,
  type GarmentId,
  type GearId,
  type HairStyle,
  type HeadId,
  type PaletteId,
  type PatternId,
  type RoleId,
  type Sex,
  type SpawnSite,
  type Weighted,
} from "./appearanceData";

export * from "./appearanceData";

export interface GarmentPick {
  id: GarmentId;
  color: string;
  /** Second colour for patterns (plaid lines, stripes, ringer trim, camo blotches). */
  color2: string;
  pattern: PatternId;
  /** Outer worn open down the front. */
  open: boolean;
}

export interface WoundMark {
  part: BodyPart;
  /** 0..1 along the part (shoulder → wrist, hip → ankle, chin → crown, waist → neck). */
  along: number;
  /** 0..1 around it, 0 = front, 0.25 = the body's left side. */
  around: number;
  /** Radius in metres. */
  size: number;
  kind: "bite" | "laceration";
}

export interface Appearance {
  role: RoleId;
  sex: Sex;
  build: Build;
  age: number;
  /** Living skin tone; the renderer greys and mottles it for the dead. */
  skin: string;
  face: {
    /** Painted face: 0..FACES_PER_SEX-1 men, then women. */
    index: number;
    iris: string;
    /** 0 clean-shaven .. 0.35 stubble .. 1 full beard. */
    beard: number;
    /** Age lines 0..1. */
    lines: number;
  };
  hair: { style: HairStyle; color: string };
  top: GarmentPick;
  outer: GarmentPick | null;
  bottom: GarmentPick;
  feet: GarmentPick;
  head: { id: HeadId; color: string } | null;
  /** Unique and sorted. */
  gear: GearId[];
  marks: { badge: "none" | "gold" | "silver"; backText: "none" | "police" | "sheriff"; nameTape: boolean; patch: boolean };
  condition: {
    grime: number;
    blood: number;
    /** 0 fresh and wet .. 1 dried brown. */
    bloodAge: number;
    tears: number;
    /** 0 living .. 1 long dead (pallor, veins, sunken eyes). */
    decay: number;
    /** Recently turned: wet blood, bloodshot eyes, little decay. The fresh dead are the runners. */
    fresh: boolean;
    wounds: WoundMark[];
  };
  /** How the dead move: favour one leg, stoop, how high the arms come up. */
  gait: { limp: number; hunch: number; reach: number };
  /** Feeds the shader's noise so two people in the same clothes don't wear them identically. */
  patternSeed: number;
}

/** Facet streams. Append new facets at the end; never renumber. */
const S = { role: 1, body: 2, face: 3, hair: 4, top: 5, outer: 6, bottom: 7, feet: 8, head: 9, gear: 10, marks: 11, condition: 12, gait: 13, pattern: 14, colors: 15 } as const;
const stream = (seed: number, salt: number) => mulberry32(deriveSeed(seed, salt));

export function weighted<T>(rng: () => number, list: Weighted<T>): T {
  let total = 0;
  for (const [, w] of list) total += w;
  let x = rng() * total;
  for (const [v, w] of list) {
    x -= w;
    if (x < 0) return v;
  }
  return list[list.length - 1][0];
}

const pickFrom = <T,>(rng: () => number, list: readonly T[]): T => list[Math.floor(rng() * list.length)];

/** Who someone at a spawn site was. Pure: draws only from the seed's role stream. */
export function chooseRole(seed: number, site: SpawnSite): RoleId {
  return weighted(stream(seed, S.role), SITE_ROLES[site]);
}

const ROLE_IDS = Object.keys(ROLES) as RoleId[];
/** A role id from a save; anything unknown (a newer build's role) becomes a civilian. */
export const resolveRole = (id: unknown): RoleId => (ROLE_IDS.includes(id as RoleId) ? (id as RoleId) : "civilian");

/** The player's own look (the "survivor" role copies it, so a turned player is recognisably you). */
export const PLAYER_LOOK = {
  sex: "m" as Sex,
  build: "average" as Build,
  age: 34,
  skin: "#c49a78",
  face: { index: 2, iris: "#4a2e1a", beard: 0.3, lines: 0.1 },
  hair: { style: "short" as HairStyle, color: "#3b2e24" },
  top: { id: "henley" as GarmentId, color: "#5a5a52", color2: "#5a5a52", pattern: "heather" as PatternId, open: false },
  outer: { id: "field_jacket" as GarmentId, color: "#5a6148", color2: "#5a6148", pattern: "plain" as PatternId, open: true },
  bottom: { id: "jeans" as GarmentId, color: "#3e4a5c", color2: "#3e4a5c", pattern: "plain" as PatternId, open: false },
  feet: { id: "boots" as GarmentId, color: "#3a3128", color2: "#3a3128", pattern: "plain" as PatternId, open: false },
};

function pickGarment(seed: number, slot: number, options: Weighted<GarmentId>, sex: Sex, override?: { palette: PaletteId; chance: number }): GarmentPick {
  const rng = stream(seed, slot);
  const fits = options.filter(([id]) => {
    const g: GarmentDef = GARMENTS[id];
    return !g.sex || g.sex === sex;
  });
  const id = weighted(rng, fits.length ? fits : options);
  const g: GarmentDef = GARMENTS[id];
  const crng = stream(seed, S.colors * 100 + slot);
  const palette = override && crng() < override.chance ? override.palette : pickFrom(rng, g.palettes);
  const colors = PALETTES[palette];
  const color = pickFrom(rng, colors);
  const pattern = weighted(rng, g.patterns);
  // Second colour: a contrasting one from the same family, or dark/off-white trim.
  let color2 = color;
  if (pattern === "camo") color2 = "#2e2e1e";
  else if (pattern !== "plain" && pattern !== "heather") {
    const others = colors.filter((c) => c !== color);
    color2 = others.length && rng() < 0.6 ? pickFrom(rng, others) : pickFrom(rng, rng() < 0.5 ? PALETTES.dark : PALETTES.dirty_white);
  }
  const open = g.open !== undefined && rng() < g.open;
  return { id, color, color2, pattern, open };
}

/** Relative luminance of a hex colour. */
export function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

/** Perceived lightness, CIE L* (0 black .. 100 white). */
export function lightness(hex: string) {
  const y = luminance(hex);
  return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y;
}

/**
 * `fresh`: recently turned (pass the zombie's runner flag: the fresh dead are
 * the fast ones, and their wet blood and red eyes give them away).
 */
export function rollAppearance(seed: number, role: RoleId, opts: { zombie: boolean; fresh?: boolean }): Appearance {
  const def = ROLES[role];
  const zombie = opts.zombie;
  const fresh = zombie && opts.fresh === true;

  // Body.
  const body = stream(seed, S.body);
  let sex: Sex = body() < def.female ? "f" : "m";
  let build = weighted(body, def.build);
  let age = Math.round(range(body, def.age[0], def.age[1]));
  let skin = weighted(body, SKIN_TONES);

  // Face.
  const fr = stream(seed, S.face);
  let face = {
    index: (sex === "f" ? FACES_PER_SEX : 0) + Math.floor(fr() * FACES_PER_SEX),
    iris: weighted(fr, IRIS_COLORS),
    beard: 0,
    lines: Math.min(1, Math.max(0, (age - 28) / 50 + (fr() - 0.5) * 0.2)),
  };
  if (sex === "m") {
    const kind = weighted(fr, [
      [0, def.beard?.[0] ?? 45],
      [1, def.beard?.[1] ?? 35],
      [2, def.beard?.[2] ?? 20],
    ]);
    face.beard = kind === 0 ? 0 : kind === 1 ? 0.2 + fr() * 0.25 : 0.65 + fr() * 0.35;
    // Stubble keeps coming through after death, or seems to as the skin pulls back.
    if (zombie) face.beard = Math.max(face.beard, 0.15 + fr() * 0.15);
  }

  // Hair.
  const hr = stream(seed, S.hair);
  let styles = HAIR_STYLES[sex];
  if (sex === "m" && age > 40) styles = [...styles, ["balding", (age - 40) * 0.8], ["bald", (age - 40) * 0.3]];
  let hair = {
    style: weighted(hr, styles),
    color: hr() < Math.max(0, (age - 42) / 35) ? pickFrom(hr, GREY_HAIR) : weighted(hr, HAIR_COLORS),
  };

  // Clothes.
  let top = pickGarment(seed, S.top, def.top, sex, def.colors?.top);
  let outer: GarmentPick | null = stream(seed, S.outer * 10)() < def.outer.chance && def.outer.options.length ? pickGarment(seed, S.outer, def.outer.options, sex, def.colors?.outer) : null;
  let bottom = pickGarment(seed, S.bottom, def.bottom, sex, def.colors?.bottom);
  let feet = pickGarment(seed, S.feet, def.feet, sex, def.colors?.feet);
  // Value contrast: people rarely wear a top and trousers of the same lightness, and a
  // silhouette reads by its blocks of light and dark. Try a few of the garment's colours.
  const visible = outer && (GARMENTS[outer.id] as GarmentDef).sleeve !== 0 ? outer : top;
  const gap = (c: string) => Math.abs(lightness(c) - lightness(bottom.color));
  if (gap(visible.color) < 10 && !def.colors) {
    const cr = stream(seed, S.colors * 100 + 99);
    const palettes = (GARMENTS[visible.id] as GarmentDef).palettes;
    let color = visible.color;
    for (let i = 0; i < 4 && gap(color) < 10; i++) {
      const c = pickFrom(cr, PALETTES[pickFrom(cr, palettes)]);
      if (gap(c) > gap(color)) color = c;
    }
    if (visible === outer) outer = { ...outer, color, color2: outer.pattern === "plain" || outer.pattern === "heather" ? color : outer.color2 };
    else top = { ...top, color, color2: top.pattern === "plain" || top.pattern === "heather" ? color : top.color2 };
  }

  // Head.
  const headR = stream(seed, S.head);
  let head: Appearance["head"] = null;
  if (headR() < def.head.chance && def.head.options.length) {
    const hooded = outer !== null && (GARMENTS[outer.id] as GarmentDef).hood === true;
    const options = def.head.options.filter(([id]) => id !== "hood_up" || hooded);
    if (options.length) {
      const id = weighted(headR, options);
      const color =
        id === "hood_up"
          ? outer!.color
          : id === "police_cap"
            ? PALETTES.police_navy[0]
            : id === "blaze_cap"
              ? PALETTES.blaze[0]
              : id === "hard_hat"
                ? pickFrom(headR, ["#b89a2a", "#a8a49a", "#b8642a", "#2f5a8a"])
                : pickFrom(headR, [...PALETTES.dark, ...PALETTES.muted, ...PALETTES.grey, ...PALETTES.outdoor]);
      head = { id, color };
    }
  }

  // Gear.
  const gr = stream(seed, S.gear);
  const gear = new Set<GearId>();
  for (const g of def.gear) if (gr() < g.chance) gear.add(g.id);
  if (gear.has("holster_gun")) gear.add("holster");
  if (gear.has("holster") && !gear.has("duty_belt")) gear.add("belt");
  if (gear.has("duty_belt") || gear.has("tool_belt")) gear.delete("belt");
  if (zombie) for (const g of LIVING_ONLY_GEAR) gear.delete(g);

  // Marks (uniforms).
  const mr = stream(seed, S.marks);
  const marks: Appearance["marks"] = { badge: "none", backText: "none", nameTape: false, patch: false };
  if (role === "police") {
    const sheriff = mr() < 0.15;
    marks.badge = sheriff || mr() < 0.4 ? "gold" : "silver";
    marks.backText = outer?.id === "police_vest" ? (sheriff ? "sheriff" : "police") : "none";
    marks.nameTape = true;
    marks.patch = true;
    if (sheriff) {
      top = { ...top, color: "#8a7b5c", color2: "#8a7b5c" };
      bottom = { ...bottom, color: "#3c3b2d", color2: "#3c3b2d" };
    }
  } else if (role === "store_clerk") {
    marks.nameTape = mr() < 0.7;
  }

  // The player: a fixed identity; only the state they're in varies.
  if (role === "survivor") {
    ({ sex, build, age, skin } = PLAYER_LOOK);
    face = { ...PLAYER_LOOK.face };
    hair = { ...PLAYER_LOOK.hair };
    top = { ...PLAYER_LOOK.top };
    outer = { ...PLAYER_LOOK.outer };
    bottom = { ...PLAYER_LOOK.bottom };
    feet = { ...PLAYER_LOOK.feet };
    head = null;
    gear.clear();
    if (zombie) face.beard = Math.max(face.beard, 0.3);
  }

  // Condition.
  const cr = stream(seed, S.condition);
  const condition: Appearance["condition"] = zombie
    ? {
        grime: range(cr, 0.55, 1),
        blood: range(cr, def.blood[0], def.blood[1]),
        bloodAge: fresh ? range(cr, 0, 0.3) : range(cr, 0.6, 1),
        tears: range(cr, 0.1, 0.6),
        decay: fresh ? range(cr, 0.05, 0.25) : range(cr, 0.3, 1),
        fresh,
        wounds: [],
      }
    : { grime: range(cr, 0.15, 0.3), blood: 0, bloodAge: 1, tears: 0, decay: 0, fresh: false, wounds: [] };
  if (zombie) {
    const count = cr() < 0.35 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const part = weighted<BodyPart>(cr, [
        ["leftArm", 30],
        ["rightArm", 25],
        ["head", 25],
        ["torso", 12],
        ["leftLeg", 4],
        ["rightLeg", 4],
      ]);
      // A bite on the "head" is on the neck: low on the part, to the side.
      const along = part === "head" ? range(cr, 0, 0.15) : range(cr, 0.25, 0.85);
      condition.wounds.push({ part, along, around: cr(), size: range(cr, 0.03, 0.055), kind: cr() < 0.85 ? "bite" : "laceration" });
    }
  }

  // Gait.
  const gtr = stream(seed, S.gait);
  const r = gtr();
  const gait = zombie
    ? {
        limp: gtr() < 0.5 ? (gtr() < 0.5 ? -1 : 1) * range(gtr, 0.3, 0.8) : 0,
        hunch: range(gtr, 0.15, 0.4),
        reach: r < 0.4 ? range(gtr, 0.85, 1) : r < 0.75 ? range(gtr, 0.45, 0.65) : range(gtr, 0, 0.15),
      }
    : { limp: 0, hunch: 0, reach: 0 };

  return {
    role,
    sex,
    build,
    age,
    skin,
    face,
    hair,
    top,
    outer,
    bottom,
    feet,
    head,
    gear: [...gear].sort(),
    marks,
    condition,
    gait,
    patternSeed: stream(seed, S.pattern)() * 100,
  };
}

/** The living player's appearance. */
export const PLAYER_APPEARANCE: Appearance = rollAppearance(1, "survivor", { zombie: false });

/**
 * What the player's inventory puts on their body: a holstered pistol, a bat or
 * axe slung on the back, a knife in its sheath, a hammer in a belt loop, and a
 * pack once they're carrying a real load. The stack in hand isn't also on the
 * body, but a second copy of the same weapon is.
 */
export function playerGear(inventory: readonly { uid: number; id: string; count: number }[], equippedUid: number | null, carriedKg: number): GearId[] {
  const gear = new Set<GearId>();
  const spots = new Set<string>();
  for (const rule of PLAYER_GEAR_RULES) {
    if (spots.has(rule.spot)) continue;
    const copies = inventory.filter((s) => s.id === rule.item && s.count > 0);
    if (!copies.length) continue;
    const worn = copies.some((s) => s.uid !== equippedUid) ? rule.stowed : rule.equipped;
    // A weapon in hand leaves its spot free (an axe in hand, the bat goes on the back).
    if (!worn.length) continue;
    spots.add(rule.spot);
    for (const g of worn) gear.add(g);
  }
  // A real load needs a real pack.
  if (carriedKg > PLAYER_HIKEPACK_KG) gear.add("hikepack");
  else if (carriedKg >= PLAYER_PACK_KG) gear.add("daypack");
  return [...gear].sort();
}

export interface SiteRect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * Who you'd find at a spot: the building's trade if it's inside one, the
 * streets round the police station, the rest of town, or the woods beyond.
 * Pure (no random draws), so spawning stays deterministic.
 */
export function siteAt(x: number, z: number, buildings: readonly { type: SpawnSite; rect: SiteRect }[], town: SiteRect, nearPolice = 35): SpawnSite {
  const inRect = (r: SiteRect, m = 0) => x > r.minX - m && x < r.maxX + m && z > r.minZ - m && z < r.maxZ + m;
  const b = buildings.find((b) => inRect(b.rect));
  if (b) return b.type;
  if (!inRect(town)) return "woods";
  if (buildings.some((b) => b.type === "police" && inRect(b.rect, nearPolice))) return "near_police";
  return "street";
}

/** A town's bounds for siteAt: its buildings plus a margin. */
export function townRect(rects: readonly SiteRect[], margin = 20): SiteRect {
  return {
    minX: Math.min(...rects.map((r) => r.minX)) - margin,
    maxX: Math.max(...rects.map((r) => r.maxX)) + margin,
    minZ: Math.min(...rects.map((r) => r.minZ)) - margin,
    maxZ: Math.max(...rects.map((r) => r.maxZ)) + margin,
  };
}
