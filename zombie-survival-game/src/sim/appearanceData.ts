/**
 * Appearance tables: who the people of Coldwater were, what they wore and
 * carried. Data only (exportable to Unreal DataTables). The rules that roll
 * from these tables are in appearance.ts.
 *
 * Colours are albedo: kept between luminance ~0.02 and ~0.7 so nothing is
 * pure black or paper white under the grade.
 */

/** Where a zombie spawned. near_police: the streets round the station (more officers). */
export type SpawnSite = "house" | "store" | "hardware" | "police" | "near_police" | "street" | "woods";
export type RoleId =
  | "civilian"
  | "sleepwear"
  | "office"
  | "store_clerk"
  | "hardware_worker"
  | "tradesman"
  | "police"
  | "hiker"
  | "hunter"
  | "jogger"
  | "survivor";
export type Sex = "m" | "f";
export type Build = "slim" | "average" | "heavy";
export type GarmentSlot = "top" | "outer" | "bottom" | "feet";
export type PatternId = "plain" | "heather" | "stripes" | "plaid" | "camo" | "ringer";
export type Collar = "crew" | "vneck" | "polo" | "button" | "hood" | "zip" | "none";
export type Pockets = "none" | "chest1" | "chest2" | "kangaroo" | "jeans" | "cargo" | "patch";
export type HeadId = "cap" | "police_cap" | "blaze_cap" | "beanie" | "hood_up" | "hard_hat";
export type HairStyle = "bald" | "buzz" | "short" | "medium" | "long" | "ponytail" | "bun" | "balding";
export type GearId =
  | "daypack"
  | "hikepack"
  | "belt"
  | "duty_belt"
  | "holster"
  | "holster_gun"
  | "radio"
  | "tool_belt"
  | "knife_sheath"
  | "knife_sheath_knife"
  | "sling_bat"
  | "sling_axe"
  | "hammer_loop"
  | "glasses"
  | "watch"
  | "lanyard"
  | "gloves";

export type PaletteId =
  | "neutral"
  | "earth"
  | "muted"
  | "bright"
  | "dirty_white"
  | "dark"
  | "denim"
  | "khaki"
  | "pajama"
  | "athletic"
  | "outdoor"
  | "leather"
  | "police_navy"
  | "store_red"
  | "hardware_amber"
  | "hi_vis"
  | "blaze"
  | "camo"
  | "grey";

export const PALETTES: Record<PaletteId, readonly string[]> = {
  neutral: ["#3a3835", "#4d4a44", "#6b665c", "#8a8478", "#2b2a28", "#56524b", "#7a756a"],
  earth: ["#5a4a35", "#6b5a40", "#4a3f2e", "#7a6648", "#3f3a2c", "#5e5240"],
  muted: ["#5a3e34", "#3c4a55", "#4a5a48", "#6d3030", "#3e4a5c", "#5a5070", "#7a6b3a", "#2f4a4a", "#6a4a5a"],
  bright: ["#8a2f24", "#2f5a8a", "#8a7a2a", "#3a7a5a", "#7a3a6a", "#9a5a2a"],
  dirty_white: ["#b8b2a5", "#a8a294", "#c2bcae", "#b0aa9c"],
  dark: ["#1e2228", "#262626", "#2a2620", "#22262e", "#2c2a2e"],
  denim: ["#3b4a63", "#2f3a4f", "#4a5a75", "#5a6b85", "#26303f", "#44506a"],
  khaki: ["#8a7d60", "#7a6e52", "#9a8c6a", "#6b6048", "#5a5440"],
  pajama: ["#5a6a8a", "#7a5a6a", "#6a7a6a", "#8a7a6a", "#4a5a7a", "#8a8a9a"],
  athletic: ["#2a2a2e", "#8a2f24", "#2f4a7a", "#5a5a5e", "#3a6a4a", "#6a2a4a"],
  outdoor: ["#3a4a3a", "#4a3a2a", "#2a3a4a", "#6a2a22", "#3a3a3a", "#5a5a2a", "#2a4a5a"],
  leather: ["#2a1e16", "#3a2a1e", "#1a1614", "#4a3220"],
  police_navy: ["#1e2533"],
  store_red: ["#8a2f24"],
  hardware_amber: ["#9a6a1f"],
  hi_vis: ["#b8c832", "#c87a1e"],
  blaze: ["#c85a1a"],
  camo: ["#4a4a32", "#55503a"],
  grey: ["#5a5a5a", "#6a6a6a", "#4a4a4c", "#7a7a78"],
};

export interface GarmentDef {
  slot: GarmentSlot;
  /** Tops and outers: 0 sleeveless .. 1 to the wrist. */
  sleeve?: number;
  /** Bottoms: 1 to the ankle .. 0.25 boxer short (0 = hip, 1 = ankle along the leg). */
  leg?: number;
  /** Tops and outers: hem height at rest in metres (0.86 untucked, 0.97 tucked in; outers below the waist). */
  hem?: number;
  /** Visual thickness in metres (vertex offset): 0.002 tee .. 0.025 puffer. */
  thickness: number;
  collar: Collar;
  pockets: Pockets;
  /** A button line down the front. */
  placket?: boolean;
  zip?: boolean;
  hood?: boolean;
  /** Feet: how far up the shin it comes (0 shoe, 0.25 boot). */
  shaft?: number;
  /** Chance an outer is worn open (front unzipped). */
  open?: number;
  /** Only worn by one sex. */
  sex?: Sex;
  palettes: readonly PaletteId[];
  patterns: readonly [PatternId, number][];
  /** Insulation in clo, for the temperature sim and Inventory 2.0. */
  warmth: number;
}

const P = (...p: PaletteId[]) => p;
const plain: [PatternId, number][] = [["plain", 1]];

export const GARMENTS = {
  // ---------------------------------------------------------------- tops
  tshirt: { slot: "top", sleeve: 0.28, hem: 0.86, thickness: 0.002, collar: "crew", pockets: "none", palettes: P("neutral", "muted", "bright", "dirty_white", "dark"), patterns: [["plain", 6], ["heather", 3], ["stripes", 1], ["ringer", 1]], warmth: 0.08 },
  longsleeve: { slot: "top", sleeve: 0.97, hem: 0.86, thickness: 0.003, collar: "crew", pockets: "none", palettes: P("neutral", "muted", "dark", "grey"), patterns: [["plain", 3], ["heather", 2], ["stripes", 1]], warmth: 0.15 },
  henley: { slot: "top", sleeve: 0.97, hem: 0.86, thickness: 0.003, collar: "button", pockets: "none", placket: true, palettes: P("neutral", "earth", "grey"), patterns: [["plain", 2], ["heather", 2]], warmth: 0.16 },
  polo: { slot: "top", sleeve: 0.3, hem: 0.88, thickness: 0.003, collar: "polo", pockets: "none", placket: true, palettes: P("muted", "neutral", "dark", "dirty_white"), patterns: plain, warmth: 0.12 },
  button_shirt: { slot: "top", sleeve: 0.97, hem: 0.97, thickness: 0.003, collar: "button", pockets: "chest1", placket: true, palettes: P("dirty_white", "denim", "muted", "grey"), patterns: [["plain", 4], ["stripes", 1]], warmth: 0.2 },
  flannel: { slot: "top", sleeve: 0.97, hem: 0.86, thickness: 0.005, collar: "button", pockets: "chest2", placket: true, palettes: P("bright", "muted", "outdoor"), patterns: [["plaid", 1]], warmth: 0.3 },
  sweater: { slot: "top", sleeve: 0.97, hem: 0.88, thickness: 0.008, collar: "crew", pockets: "none", palettes: P("earth", "muted", "neutral", "grey"), patterns: [["plain", 3], ["heather", 2]], warmth: 0.35 },
  blouse: { slot: "top", sleeve: 0.6, hem: 0.9, thickness: 0.002, collar: "vneck", pockets: "none", sex: "f", palettes: P("dirty_white", "muted", "pajama"), patterns: plain, warmth: 0.12 },
  tank: { slot: "top", sleeve: 0, hem: 0.86, thickness: 0.002, collar: "crew", pockets: "none", palettes: P("dirty_white", "dark", "grey", "athletic"), patterns: plain, warmth: 0.05 },
  pajama_top: { slot: "top", sleeve: 0.97, hem: 0.84, thickness: 0.003, collar: "button", pockets: "chest1", placket: true, palettes: P("pajama"), patterns: [["plain", 2], ["stripes", 2], ["plaid", 1]], warmth: 0.15 },
  uniform_shirt: { slot: "top", sleeve: 0.97, hem: 0.98, thickness: 0.003, collar: "button", pockets: "chest2", placket: true, palettes: P("police_navy"), patterns: plain, warmth: 0.2 },
  work_shirt: { slot: "top", sleeve: 0.97, hem: 0.95, thickness: 0.004, collar: "button", pockets: "chest2", placket: true, palettes: P("khaki", "denim", "grey"), patterns: plain, warmth: 0.22 },
  athletic_tee: { slot: "top", sleeve: 0.26, hem: 0.86, thickness: 0.002, collar: "crew", pockets: "none", palettes: P("athletic"), patterns: [["plain", 3], ["ringer", 1]], warmth: 0.06 },

  // -------------------------------------------------------------- outers
  hoodie: { slot: "outer", sleeve: 1, hem: 0.84, thickness: 0.012, collar: "hood", pockets: "kangaroo", hood: true, palettes: P("grey", "dark", "muted", "neutral"), patterns: [["plain", 3], ["heather", 2]], warmth: 0.45 },
  zip_hoodie: { slot: "outer", sleeve: 1, hem: 0.84, thickness: 0.011, collar: "hood", pockets: "kangaroo", hood: true, zip: true, open: 0.45, palettes: P("grey", "dark", "muted"), patterns: [["plain", 3], ["heather", 2]], warmth: 0.42 },
  work_jacket: { slot: "outer", sleeve: 1, hem: 0.82, thickness: 0.014, collar: "button", pockets: "chest2", zip: true, open: 0.5, palettes: P("khaki", "earth", "outdoor"), patterns: plain, warmth: 0.55 },
  puffer: { slot: "outer", sleeve: 1, hem: 0.84, thickness: 0.024, collar: "zip", pockets: "none", zip: true, open: 0.3, palettes: P("dark", "outdoor", "muted"), patterns: plain, warmth: 0.9 },
  denim_jacket: { slot: "outer", sleeve: 1, hem: 0.92, thickness: 0.01, collar: "button", pockets: "chest2", placket: true, open: 0.6, palettes: P("denim"), patterns: plain, warmth: 0.4 },
  rain_shell: { slot: "outer", sleeve: 1, hem: 0.8, thickness: 0.01, collar: "zip", pockets: "none", zip: true, hood: true, open: 0.35, palettes: P("outdoor", "bright", "dark"), patterns: plain, warmth: 0.35 },
  fleece: { slot: "outer", sleeve: 1, hem: 0.86, thickness: 0.012, collar: "zip", pockets: "none", zip: true, open: 0.3, palettes: P("outdoor", "grey", "earth"), patterns: plain, warmth: 0.5 },
  cardigan: { slot: "outer", sleeve: 1, hem: 0.8, thickness: 0.009, collar: "vneck", pockets: "patch", placket: true, open: 0.8, palettes: P("earth", "grey", "muted"), patterns: [["plain", 2], ["heather", 1]], warmth: 0.35 },
  field_jacket: { slot: "outer", sleeve: 1, hem: 0.8, thickness: 0.014, collar: "button", pockets: "chest2", zip: true, open: 1, palettes: P("outdoor"), patterns: plain, warmth: 0.55 },
  camo_jacket: { slot: "outer", sleeve: 1, hem: 0.8, thickness: 0.015, collar: "button", pockets: "chest2", zip: true, open: 0.4, palettes: P("camo"), patterns: [["camo", 1]], warmth: 0.6 },
  hi_vis_vest: { slot: "outer", sleeve: 0, hem: 0.86, thickness: 0.006, collar: "vneck", pockets: "none", zip: true, open: 0.5, palettes: P("hi_vis"), patterns: plain, warmth: 0.05 },
  blaze_vest: { slot: "outer", sleeve: 0, hem: 0.86, thickness: 0.006, collar: "vneck", pockets: "none", zip: true, open: 0.4, palettes: P("blaze"), patterns: plain, warmth: 0.05 },
  apron: { slot: "outer", sleeve: 0, hem: 0.62, thickness: 0.004, collar: "none", pockets: "patch", palettes: P("store_red", "hardware_amber", "dark"), patterns: plain, warmth: 0.05 },
  police_vest: { slot: "outer", sleeve: 0, hem: 0.95, thickness: 0.02, collar: "none", pockets: "chest2", palettes: P("police_navy", "dark"), patterns: plain, warmth: 0.15 },

  // -------------------------------------------------------------- bottoms
  jeans: { slot: "bottom", leg: 1, thickness: 0.004, collar: "none", pockets: "jeans", palettes: P("denim"), patterns: plain, warmth: 0.25 },
  chinos: { slot: "bottom", leg: 1, thickness: 0.003, collar: "none", pockets: "jeans", palettes: P("khaki", "neutral", "dark"), patterns: plain, warmth: 0.22 },
  slacks: { slot: "bottom", leg: 1, thickness: 0.003, collar: "none", pockets: "none", palettes: P("dark", "grey", "neutral"), patterns: plain, warmth: 0.22 },
  sweatpants: { slot: "bottom", leg: 1, thickness: 0.006, collar: "none", pockets: "none", palettes: P("grey", "dark", "athletic"), patterns: [["plain", 2], ["heather", 2]], warmth: 0.28 },
  cargo: { slot: "bottom", leg: 1, thickness: 0.006, collar: "none", pockets: "cargo", palettes: P("khaki", "outdoor", "dark"), patterns: plain, warmth: 0.28 },
  leggings: { slot: "bottom", leg: 1, thickness: 0.001, collar: "none", pockets: "none", sex: "f", palettes: P("dark", "athletic"), patterns: plain, warmth: 0.15 },
  shorts: { slot: "bottom", leg: 0.48, thickness: 0.003, collar: "none", pockets: "none", palettes: P("athletic", "khaki", "denim"), patterns: plain, warmth: 0.06 },
  pajama_pants: { slot: "bottom", leg: 1, thickness: 0.004, collar: "none", pockets: "none", palettes: P("pajama"), patterns: [["plain", 2], ["plaid", 2], ["stripes", 1]], warmth: 0.15 },
  boxers: { slot: "bottom", leg: 0.3, thickness: 0.002, collar: "none", pockets: "none", palettes: P("pajama", "grey", "dirty_white"), patterns: [["plain", 2], ["stripes", 1]], warmth: 0.02 },
  work_pants: { slot: "bottom", leg: 1, thickness: 0.006, collar: "none", pockets: "cargo", palettes: P("khaki", "denim", "dark"), patterns: plain, warmth: 0.3 },
  uniform_trousers: { slot: "bottom", leg: 1, thickness: 0.004, collar: "none", pockets: "jeans", palettes: P("police_navy"), patterns: plain, warmth: 0.25 },
  camo_pants: { slot: "bottom", leg: 1, thickness: 0.006, collar: "none", pockets: "cargo", palettes: P("camo"), patterns: [["camo", 1]], warmth: 0.3 },
  hiking_pants: { slot: "bottom", leg: 1, thickness: 0.004, collar: "none", pockets: "cargo", palettes: P("outdoor", "khaki", "grey"), patterns: plain, warmth: 0.25 },

  // ----------------------------------------------------------------- feet
  sneakers: { slot: "feet", shaft: 0, thickness: 0, collar: "none", pockets: "none", palettes: P("dirty_white", "grey", "dark"), patterns: plain, warmth: 0.03 },
  running_shoes: { slot: "feet", shaft: 0, thickness: 0, collar: "none", pockets: "none", palettes: P("athletic", "grey"), patterns: plain, warmth: 0.02 },
  dress_shoes: { slot: "feet", shaft: 0, thickness: 0, collar: "none", pockets: "none", palettes: P("leather"), patterns: plain, warmth: 0.03 },
  boots: { slot: "feet", shaft: 0.18, thickness: 0.004, collar: "none", pockets: "none", palettes: P("leather", "earth"), patterns: plain, warmth: 0.06 },
  work_boots: { slot: "feet", shaft: 0.16, thickness: 0.004, collar: "none", pockets: "none", palettes: P("earth"), patterns: plain, warmth: 0.06 },
  duty_boots: { slot: "feet", shaft: 0.2, thickness: 0.004, collar: "none", pockets: "none", palettes: P("dark"), patterns: plain, warmth: 0.06 },
  slippers: { slot: "feet", shaft: 0, thickness: 0, collar: "none", pockets: "none", palettes: P("pajama", "grey"), patterns: plain, warmth: 0.02 },
  socks: { slot: "feet", shaft: 0.1, thickness: 0, collar: "none", pockets: "none", palettes: P("dirty_white", "grey", "dark"), patterns: plain, warmth: 0.02 },
  barefoot: { slot: "feet", shaft: 0, thickness: 0, collar: "none", pockets: "none", palettes: P("neutral"), patterns: plain, warmth: 0 },
} as const satisfies Record<string, GarmentDef>;

export type GarmentId = keyof typeof GARMENTS;

export type Weighted<T> = readonly (readonly [T, number])[];

export interface RoleDef {
  /** Chance of a woman. */
  female: number;
  age: readonly [number, number];
  build: Weighted<Build>;
  top: Weighted<GarmentId>;
  outer: { chance: number; options: Weighted<GarmentId> };
  bottom: Weighted<GarmentId>;
  feet: Weighted<GarmentId>;
  head: { chance: number; options: Weighted<HeadId> };
  gear: readonly { id: GearId; chance: number }[];
  /** Override a slot's colour (uniform shirts, store polos). Chance it applies. */
  colors?: Partial<Record<GarmentSlot, { palette: PaletteId; chance: number }>>;
  /** Range of blood on the clothes for the dead (0..1). */
  blood: readonly [number, number];
  /** Men: clean, stubble, beard weights. */
  beard?: readonly [number, number, number];
}

const BUILDS: Weighted<Build> = [
  ["slim", 30],
  ["average", 50],
  ["heavy", 20],
];

export const ROLES: Record<RoleId, RoleDef> = {
  civilian: {
    female: 0.5,
    age: [16, 85],
    build: BUILDS,
    top: [["tshirt", 30], ["longsleeve", 12], ["flannel", 12], ["polo", 8], ["button_shirt", 8], ["sweater", 10], ["henley", 8], ["blouse", 10]],
    outer: { chance: 0.55, options: [["hoodie", 18], ["zip_hoodie", 12], ["work_jacket", 10], ["puffer", 12], ["denim_jacket", 8], ["rain_shell", 12], ["fleece", 12], ["cardigan", 8], ["field_jacket", 6]] },
    bottom: [["jeans", 55], ["chinos", 15], ["sweatpants", 10], ["cargo", 10], ["leggings", 10]],
    feet: [["sneakers", 40], ["boots", 20], ["dress_shoes", 8], ["work_boots", 12], ["running_shoes", 20]],
    head: { chance: 0.22, options: [["cap", 5], ["beanie", 4], ["hood_up", 3]] },
    gear: [
      { id: "daypack", chance: 0.12 },
      { id: "glasses", chance: 0.22 },
      { id: "watch", chance: 0.3 },
      { id: "belt", chance: 0.35 },
    ],
    blood: [0.35, 0.9],
  },
  sleepwear: {
    female: 0.5,
    age: [16, 90],
    build: BUILDS,
    top: [["pajama_top", 45], ["tank", 20], ["tshirt", 35]],
    outer: { chance: 0.15, options: [["hoodie", 2], ["cardigan", 1]] },
    bottom: [["pajama_pants", 50], ["sweatpants", 25], ["boxers", 25]],
    feet: [["barefoot", 50], ["socks", 20], ["slippers", 30]],
    head: { chance: 0, options: [] },
    gear: [],
    blood: [0.55, 1],
  },
  office: {
    female: 0.5,
    age: [22, 66],
    build: BUILDS,
    top: [["button_shirt", 60], ["blouse", 25], ["polo", 15]],
    outer: { chance: 0.35, options: [["rain_shell", 2], ["puffer", 1], ["cardigan", 1]] },
    bottom: [["slacks", 70], ["chinos", 30]],
    feet: [["dress_shoes", 80], ["sneakers", 20]],
    head: { chance: 0, options: [] },
    gear: [
      { id: "lanyard", chance: 0.6 },
      { id: "glasses", chance: 0.35 },
      { id: "watch", chance: 0.5 },
      { id: "belt", chance: 0.7 },
    ],
    blood: [0.35, 0.85],
  },
  store_clerk: {
    female: 0.55,
    age: [16, 62],
    build: BUILDS,
    top: [["polo", 70], ["tshirt", 30]],
    outer: { chance: 0.45, options: [["apron", 3], ["cardigan", 1]] },
    bottom: [["slacks", 40], ["jeans", 40], ["chinos", 20]],
    feet: [["sneakers", 70], ["dress_shoes", 30]],
    head: { chance: 0.1, options: [["cap", 1]] },
    gear: [
      { id: "lanyard", chance: 0.3 },
      { id: "glasses", chance: 0.2 },
    ],
    colors: { top: { palette: "store_red", chance: 0.7 }, outer: { palette: "store_red", chance: 0.8 } },
    blood: [0.4, 0.95],
  },
  hardware_worker: {
    female: 0.2,
    age: [18, 68],
    build: [["slim", 20], ["average", 50], ["heavy", 30]],
    top: [["work_shirt", 40], ["tshirt", 30], ["polo", 30]],
    outer: { chance: 0.75, options: [["hi_vis_vest", 45], ["apron", 35], ["work_jacket", 20]] },
    bottom: [["work_pants", 45], ["jeans", 35], ["cargo", 20]],
    feet: [["work_boots", 85], ["boots", 15]],
    head: { chance: 0.5, options: [["cap", 1]] },
    gear: [
      { id: "gloves", chance: 0.4 },
      { id: "tool_belt", chance: 0.5 },
      { id: "watch", chance: 0.3 },
    ],
    colors: { top: { palette: "hardware_amber", chance: 0.35 }, outer: { palette: "hardware_amber", chance: 0.5 } },
    blood: [0.35, 0.9],
    beard: [40, 35, 25],
  },
  police: {
    female: 0.15,
    age: [22, 58],
    build: [["slim", 25], ["average", 55], ["heavy", 20]],
    top: [["uniform_shirt", 1]],
    outer: { chance: 0.65, options: [["police_vest", 1]] },
    bottom: [["uniform_trousers", 1]],
    feet: [["duty_boots", 1]],
    head: { chance: 0.25, options: [["police_cap", 1]] },
    gear: [
      { id: "duty_belt", chance: 1 },
      // Always empty on the dead: they drew before they went down. (If the player can see it, it has
      // state: a visible gun would have to be lootable, and corpses can't be searched yet.)
      { id: "holster", chance: 1 },
      { id: "radio", chance: 0.9 },
      { id: "watch", chance: 0.5 },
      { id: "glasses", chance: 0.1 },
    ],
    blood: [0.5, 1],
    beard: [60, 25, 15],
  },
  tradesman: {
    female: 0.08,
    age: [19, 64],
    build: [["slim", 20], ["average", 50], ["heavy", 30]],
    top: [["tshirt", 35], ["flannel", 25], ["work_shirt", 25], ["longsleeve", 15]],
    outer: { chance: 0.8, options: [["hoodie", 35], ["work_jacket", 40], ["hi_vis_vest", 25]] },
    bottom: [["work_pants", 50], ["jeans", 30], ["cargo", 20]],
    feet: [["work_boots", 1]],
    head: { chance: 0.8, options: [["hard_hat", 3], ["cap", 3], ["beanie", 2]] },
    gear: [
      { id: "gloves", chance: 0.5 },
      { id: "tool_belt", chance: 0.45 },
      { id: "watch", chance: 0.3 },
    ],
    blood: [0.35, 0.9],
    beard: [30, 40, 30],
  },
  hiker: {
    female: 0.4,
    age: [18, 70],
    build: [["slim", 45], ["average", 45], ["heavy", 10]],
    top: [["longsleeve", 40], ["tshirt", 30], ["flannel", 30]],
    outer: { chance: 0.8, options: [["rain_shell", 4], ["fleece", 3], ["puffer", 2]] },
    bottom: [["hiking_pants", 55], ["cargo", 30], ["jeans", 15]],
    feet: [["boots", 85], ["running_shoes", 15]],
    head: { chance: 0.6, options: [["beanie", 1], ["cap", 1]] },
    gear: [
      { id: "hikepack", chance: 0.85 },
      { id: "knife_sheath", chance: 0.3 },
      { id: "gloves", chance: 0.2 },
      { id: "watch", chance: 0.5 },
      { id: "belt", chance: 0.4 },
    ],
    blood: [0.3, 0.8],
    beard: [30, 35, 35],
  },
  hunter: {
    female: 0.12,
    age: [18, 75],
    build: [["slim", 20], ["average", 50], ["heavy", 30]],
    top: [["flannel", 60], ["longsleeve", 40]],
    outer: { chance: 0.9, options: [["camo_jacket", 55], ["blaze_vest", 35], ["field_jacket", 10]] },
    bottom: [["camo_pants", 50], ["cargo", 30], ["jeans", 20]],
    feet: [["boots", 100]],
    head: { chance: 0.85, options: [["blaze_cap", 40], ["cap", 30], ["beanie", 15]] },
    gear: [
      { id: "knife_sheath", chance: 0.6 },
      { id: "daypack", chance: 0.25 },
      { id: "belt", chance: 0.8 },
    ],
    blood: [0.35, 0.85],
    beard: [25, 35, 40],
  },
  jogger: {
    female: 0.5,
    age: [16, 60],
    build: [["slim", 70], ["average", 28], ["heavy", 2]],
    top: [["athletic_tee", 50], ["tank", 25], ["longsleeve", 25]],
    outer: { chance: 0.2, options: [["zip_hoodie", 1], ["rain_shell", 1]] },
    bottom: [["shorts", 50], ["leggings", 30], ["sweatpants", 20]],
    feet: [["running_shoes", 1]],
    head: { chance: 0.2, options: [["cap", 1], ["beanie", 1]] },
    gear: [{ id: "watch", chance: 0.6 }],
    blood: [0.3, 0.9],
  },
  // The player: identity comes from PLAYER_APPEARANCE (appearance.ts).
  survivor: {
    female: 0,
    age: [34, 34],
    build: [["average", 1]],
    top: [["henley", 1]],
    outer: { chance: 1, options: [["field_jacket", 1]] },
    bottom: [["jeans", 1]],
    feet: [["boots", 1]],
    head: { chance: 0, options: [] },
    gear: [],
    blood: [0.2, 0.5],
  },
};

/** Who you'd meet where. Weights; the dead were whoever was there when it happened. */
export const SITE_ROLES: Record<SpawnSite, Weighted<RoleId>> = {
  house: [["civilian", 55], ["sleepwear", 30], ["office", 8], ["hardware_worker", 1], ["tradesman", 3], ["police", 1], ["hunter", 2]],
  store: [["civilian", 50], ["office", 10], ["store_clerk", 35], ["police", 2], ["jogger", 3]],
  hardware: [["civilian", 35], ["office", 5], ["hardware_worker", 40], ["tradesman", 15], ["police", 2], ["hunter", 3]],
  police: [["civilian", 22], ["office", 8], ["police", 70]],
  near_police: [["civilian", 55], ["office", 10], ["police", 30], ["jogger", 5]],
  street: [["civilian", 57], ["sleepwear", 4], ["office", 12], ["store_clerk", 3], ["hardware_worker", 3], ["tradesman", 5], ["police", 6], ["hiker", 2], ["hunter", 2], ["jogger", 6]],
  woods: [["civilian", 20], ["tradesman", 2], ["police", 1], ["hiker", 35], ["hunter", 30], ["jogger", 12]],
};

/** Living skin tones (the dead are tinted from these by the renderer). */
export const SKIN_TONES: Weighted<string> = [
  ["#f2d0b5", 10],
  ["#e0b393", 18],
  ["#c99a78", 20],
  ["#a8775a", 16],
  ["#8a5a3e", 13],
  ["#6b4430", 12],
  ["#4f3124", 11],
];

export const HAIR_COLORS: Weighted<string> = [
  ["#1a1410", 22],
  ["#2b2018", 20],
  ["#3a2a1e", 16],
  ["#5a4430", 14],
  ["#7a5a3a", 10],
  ["#9a7a50", 7],
  ["#b89a6a", 6],
  ["#6a3a22", 5],
];
export const GREY_HAIR: readonly string[] = ["#8a8680", "#a8a49c", "#c8c4bc"];

export const IRIS_COLORS: Weighted<string> = [
  ["#4a2e1a", 40],
  ["#2a1a10", 18],
  ["#6a5a2a", 12],
  ["#4a6a4a", 8],
  ["#4a6a8a", 16],
  ["#6a7078", 6],
];

/** Hair styles by sex. */
export const HAIR_STYLES: Record<Sex, Weighted<HairStyle>> = {
  m: [["short", 55], ["buzz", 20], ["medium", 12], ["long", 3], ["balding", 10]],
  f: [["long", 30], ["ponytail", 25], ["medium", 25], ["bun", 10], ["short", 10]],
};

/** How many painted faces the renderer has per sex (indices 0..n-1 men, n..2n-1 women). */
export const FACES_PER_SEX = 8;

/** Gear the player's inventory puts on the body. First match per body spot wins. */
export const PLAYER_GEAR_RULES: readonly { item: string; stowed: GearId[]; equipped: GearId[]; spot: "hipR" | "hipL" | "back" | "belt" }[] = [
  { item: "pistol", stowed: ["belt", "holster", "holster_gun"], equipped: ["belt", "holster"], spot: "hipR" },
  { item: "fire_axe", stowed: ["sling_axe"], equipped: [], spot: "back" },
  { item: "baseball_bat", stowed: ["sling_bat"], equipped: [], spot: "back" },
  { item: "kitchen_knife", stowed: ["belt", "knife_sheath", "knife_sheath_knife"], equipped: ["belt", "knife_sheath"], spot: "hipL" },
  { item: "hammer", stowed: ["belt", "hammer_loop"], equipped: [], spot: "belt" },
];

/** Carried weight (kg, not counting weapons) at which a pack shows on your back. */
export const PLAYER_PACK_KG = 3;
/** ...and above this, a big framed pack. */
export const PLAYER_HIKEPACK_KG = 12;

/**
 * What finding a piece of gear on a corpse would give. Data only for now:
 * corpse search (ROADMAP session 16) will roll these. Until then the dead
 * never show gear that would hold loot (no holstered guns, no hammers).
 */
export const GEAR_LOOT: Partial<Record<GearId, { item: string; chance: number; count?: readonly [number, number] }>> = {
  holster_gun: { item: "pistol", chance: 1 },
  hammer_loop: { item: "hammer", chance: 1 },
  tool_belt: { item: "nails", chance: 0.7, count: [10, 30] },
  knife_sheath_knife: { item: "kitchen_knife", chance: 1 },
};

/** Gear the dead never show this session (it would have to be lootable). */
export const LIVING_ONLY_GEAR: readonly GearId[] = ["holster_gun", "hammer_loop", "sling_bat", "sling_axe", "knife_sheath_knife"];
