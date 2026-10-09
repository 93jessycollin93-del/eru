export type ItemCategory = "food" | "drink" | "medical" | "melee" | "firearm" | "ammo" | "tool" | "note";

export interface ItemDef {
  id: string;
  name: string;
  category: ItemCategory;
  /** kg per unit */
  weight: number;
  description: string;
  stackable?: boolean;
  hunger?: number;
  thirst?: number;
  /** What a medical item does when used. */
  medical?: "bandage" | "firstAid" | "painkillers";
  heal?: number;
  /** Melee / firearm damage per hit. */
  damage?: number;
  /** Seconds between attacks. */
  attackInterval?: number;
  /** Melee reach in metres. */
  reach?: number;
  stamina?: number;
  magSize?: number;
  ammo?: string;
  /** Radius in metres that zombies can hear this weapon from. */
  noise?: number;
}

export const ITEMS: Record<string, ItemDef> = {
  canned_beans: {
    id: "canned_beans",
    name: "Canned Beans",
    category: "food",
    weight: 0.4,
    hunger: 35,
    thirst: -5,
    description: "Cold, but filling.",
  },
  crisps: {
    id: "crisps",
    name: "Bag of Crisps",
    category: "food",
    weight: 0.15,
    hunger: 12,
    thirst: -4,
    description: "Salty. Makes you thirsty.",
  },
  cereal_bar: {
    id: "cereal_bar",
    name: "Cereal Bar",
    category: "food",
    weight: 0.1,
    hunger: 15,
    description: "Light and easy to carry.",
  },
  water_bottle: {
    id: "water_bottle",
    name: "Water Bottle",
    category: "drink",
    weight: 0.5,
    thirst: 45,
    description: "Clean drinking water.",
  },
  soda: {
    id: "soda",
    name: "Can of Soda",
    category: "drink",
    weight: 0.35,
    thirst: 25,
    hunger: 5,
    description: "Flat, warm, still wet.",
  },
  bandage: {
    id: "bandage",
    name: "Bandage",
    category: "medical",
    weight: 0.1,
    medical: "bandage",
    description: "Wrap one wound to stop it bleeding and help it heal.",
  },
  first_aid_kit: {
    id: "first_aid_kit",
    name: "First Aid Kit",
    category: "medical",
    weight: 0.6,
    medical: "firstAid",
    heal: 25,
    description: "Dresses every open wound and treats trauma.",
  },
  painkillers: {
    id: "painkillers",
    name: "Painkillers",
    category: "medical",
    weight: 0.05,
    medical: "painkillers",
    description: "Dulls pain for a few hours. Steadies your aim.",
  },
  kitchen_knife: {
    id: "kitchen_knife",
    name: "Kitchen Knife",
    category: "melee",
    weight: 0.3,
    damage: 28,
    attackInterval: 0.45,
    reach: 1.5,
    stamina: 6,
    noise: 3,
    description: "Fast, short reach.",
  },
  baseball_bat: {
    id: "baseball_bat",
    name: "Baseball Bat",
    category: "melee",
    weight: 1.1,
    damage: 40,
    attackInterval: 0.75,
    reach: 2.0,
    stamina: 12,
    noise: 4,
    description: "Reliable. Pushes them back.",
  },
  fire_axe: {
    id: "fire_axe",
    name: "Fire Axe",
    category: "melee",
    weight: 2.2,
    damage: 70,
    attackInterval: 1.05,
    reach: 2.1,
    stamina: 18,
    noise: 4,
    description: "Heavy and slow, but it ends things.",
  },
  pistol: {
    id: "pistol",
    name: "9mm Pistol",
    category: "firearm",
    weight: 0.9,
    damage: 45,
    attackInterval: 0.22,
    magSize: 15,
    ammo: "ammo_9mm",
    noise: 55,
    description: "Loud. Every zombie nearby will hear it.",
  },
  note: {
    id: "note",
    name: "Note",
    category: "note",
    weight: 0.01,
    description: "A scrap of paper with writing on it.",
  },
  ammo_9mm: {
    id: "ammo_9mm",
    name: "9mm Rounds",
    category: "ammo",
    weight: 0.012,
    stackable: true,
    description: "Pistol ammunition.",
  },
};

export const FISTS: ItemDef = {
  id: "fists",
  name: "Fists",
  category: "melee",
  weight: 0,
  damage: 12,
  attackInterval: 0.55,
  reach: 1.3,
  stamina: 8,
  noise: 2,
  description: "Better than nothing. Barely.",
};

export interface ItemStack {
  /** Unique per stack so React and transfers can address it. */
  uid: number;
  id: string;
  count: number;
  /** Rounds loaded, for firearms. */
  loaded?: number;
  /** Handwritten notes. */
  title?: string;
  text?: string;
}

let nextUid = 1;
export const makeStack = (id: string, count = 1, loaded?: number, note?: { title: string; text: string }): ItemStack => ({
  uid: nextUid++,
  id,
  count,
  loaded,
  ...(note ?? {}),
});

export const stackWeight = (s: ItemStack) => ITEMS[s.id].weight * s.count;

/** Weighted loot tables per container kind. Each roll picks [itemId, min, max]. */
type LootEntry = [string, number, number, number]; // id, weight, min, max

export const LOOT_TABLES: Record<string, { rolls: [number, number]; entries: LootEntry[] }> = {
  kitchen: {
    rolls: [0, 3],
    entries: [
      ["canned_beans", 5, 1, 2],
      ["crisps", 4, 1, 2],
      ["cereal_bar", 3, 1, 2],
      ["water_bottle", 4, 1, 1],
      ["soda", 4, 1, 2],
      ["kitchen_knife", 2, 1, 1],
    ],
  },
  fridge: {
    rolls: [0, 2],
    entries: [
      ["water_bottle", 5, 1, 2],
      ["soda", 5, 1, 2],
    ],
  },
  bedroom: {
    rolls: [0, 2],
    entries: [
      ["bandage", 5, 1, 2],
      ["first_aid_kit", 1, 1, 1],
      ["painkillers", 3, 1, 1],
      ["baseball_bat", 2, 1, 1],
      ["ammo_9mm", 1, 4, 10],
      ["pistol", 0.4, 1, 1],
    ],
  },
  store_shelf: {
    rolls: [1, 4],
    entries: [
      ["canned_beans", 5, 1, 3],
      ["crisps", 5, 1, 3],
      ["cereal_bar", 4, 1, 3],
      ["water_bottle", 5, 1, 2],
      ["soda", 5, 1, 3],
      ["bandage", 2, 1, 2],
      ["painkillers", 2, 1, 1],
    ],
  },
  police_locker: {
    rolls: [1, 3],
    entries: [
      ["pistol", 2, 1, 1],
      ["ammo_9mm", 5, 8, 20],
      ["first_aid_kit", 2, 1, 1],
      ["bandage", 3, 1, 3],
    ],
  },
  hardware_shelf: {
    rolls: [0, 2],
    entries: [
      ["fire_axe", 2, 1, 1],
      ["baseball_bat", 2, 1, 1],
      ["kitchen_knife", 2, 1, 1],
      ["water_bottle", 1, 1, 1],
    ],
  },
  car: {
    rolls: [0, 2],
    entries: [
      ["water_bottle", 3, 1, 1],
      ["soda", 3, 1, 1],
      ["cereal_bar", 3, 1, 2],
      ["bandage", 2, 1, 1],
      ["ammo_9mm", 1, 3, 8],
    ],
  },
};

export function rollLoot(table: string, rng: () => number): ItemStack[] {
  const t = LOOT_TABLES[table];
  if (!t) return [];
  const total = t.entries.reduce((s, e) => s + e[1], 0);
  const rolls = t.rolls[0] + Math.floor(rng() * (t.rolls[1] - t.rolls[0] + 1));
  const out: ItemStack[] = [];
  for (let i = 0; i < rolls; i++) {
    let r = rng() * total;
    for (const [id, w, min, max] of t.entries) {
      r -= w;
      if (r <= 0) {
        const count = min + Math.floor(rng() * (max - min + 1));
        const def = ITEMS[id];
        if (def.stackable) {
          const existing = out.find((s) => s.id === id);
          if (existing) existing.count += count;
          else out.push(makeStack(id, count));
        } else {
          for (let c = 0; c < count; c++) {
            out.push(makeStack(id, 1, def.category === "firearm" ? Math.floor(rng() * (def.magSize ?? 0)) : undefined));
          }
        }
        break;
      }
    }
  }
  return out;
}
