import { describe, expect, it } from "vitest";
import { ITEMS, LOOT_TABLES, makeStack, rollLoot, stackWeight } from "./items";
import { mulberry32 } from "./rng";

/** An rng that plays back a fixed script, so one exact roll can be forced. */
const scripted = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

/** The rng value that lands a weighted pick in the middle of an entry's slice. */
function pickValue(table: string, id: string): number {
  const entries = LOOT_TABLES[table].entries;
  const total = entries.reduce((s, e) => s + e[1], 0);
  let before = 0;
  for (const [eid, w] of entries) {
    if (eid === id) return (before + w / 2) / total;
    before += w;
  }
  throw new Error(`${id} is not in ${table}`);
}

/** Forces exactly one roll of `id` from `table`, with the count rng set to `countR`. */
function rollOne(table: string, id: string, countR: number) {
  const [lo, hi] = LOOT_TABLES[table].rolls;
  const oneRoll = (1 - lo + 0.5) / (hi - lo + 1);
  return rollLoot(table, scripted([oneRoll, pickValue(table, id), countR]));
}

describe("barricade items", () => {
  it("defines the claw hammer as a light melee weapon", () => {
    expect(ITEMS.hammer).toMatchObject({
      name: "Claw Hammer",
      category: "melee",
      weight: 0.6,
      damage: 24,
      attackInterval: 0.55,
      reach: 1.2,
      stamina: 6,
      knockdown: 0.05,
      noise: 3,
    });
    expect(ITEMS.hammer.knockback!).toBeLessThanOrEqual(ITEMS.baseball_bat.knockback!);
    expect(ITEMS.hammer.stackable).toBeFalsy();
  });

  it("defines nails and planks as stackable tools", () => {
    expect(ITEMS.nails).toMatchObject({ name: "Nails", category: "tool", stackable: true, weight: 0.01 });
    expect(ITEMS.plank).toMatchObject({ name: "Plank", category: "tool", stackable: true, weight: 2.6 });
  });

  it("weighs 48 nails at about half a kilo", () => {
    expect(stackWeight(makeStack("nails", 48))).toBeCloseTo(0.48, 5);
  });
});

describe("barricade loot", () => {
  it("one hardware shelf roll gives a single stack of 20-50 nails or 2-4 planks", () => {
    for (const [id, min, max] of [
      ["nails", 20, 50],
      ["plank", 2, 4],
    ] as const) {
      for (const countR of [0, 0.5, 0.9999]) {
        const out = rollOne("hardware_shelf", id, countR);
        expect(out).toHaveLength(1);
        expect(out[0].id).toBe(id);
        expect(out[0].count).toBeGreaterThanOrEqual(min);
        expect(out[0].count).toBeLessThanOrEqual(max);
      }
      expect(rollOne("hardware_shelf", id, 0)[0].count).toBe(min);
      expect(rollOne("hardware_shelf", id, 0.9999)[0].count).toBe(max);
    }
  });

  it("a repeat roll tops nails and planks up only to max, but ammo keeps adding up", () => {
    /** Forces two rolls of `id`, each at the top of its count range. */
    const rollTwiceAtMax = (table: string, id: string) => {
      const [lo, hi] = LOOT_TABLES[table].rolls;
      const pick = pickValue(table, id);
      return rollLoot(table, scripted([(2 - lo + 0.5) / (hi - lo + 1), pick, 0.9999, pick, 0.9999]));
    };
    expect(rollTwiceAtMax("hardware_shelf", "nails")).toMatchObject([{ id: "nails", count: 50 }]);
    expect(rollTwiceAtMax("hardware_shelf", "plank")).toMatchObject([{ id: "plank", count: 4 }]);
    expect(rollTwiceAtMax("police_locker", "ammo_9mm")).toMatchObject([{ id: "ammo_9mm", count: 40 }]);
  });

  it("hardware shelves never split nails or planks across stacks", () => {
    const seen = { nails: 0, plank: 0, hammer: 0 };
    for (let seed = 1; seed <= 2000; seed++) {
      const out = rollLoot("hardware_shelf", mulberry32(seed));
      for (const [id, min, max] of [
        ["nails", 20, 50],
        ["plank", 2, 4],
      ] as const) {
        const stacks = out.filter((s) => s.id === id);
        expect(stacks.length).toBeLessThanOrEqual(1);
        if (stacks[0]) {
          seen[id]++;
          expect(stacks[0].count).toBeGreaterThanOrEqual(min);
          expect(stacks[0].count).toBeLessThanOrEqual(max);
        }
      }
      if (out.some((s) => s.id === "hammer")) seen.hammer++;
    }
    expect(seen.nails).toBeGreaterThan(0);
    expect(seen.plank).toBeGreaterThan(0);
    expect(seen.hammer).toBeGreaterThan(0);
  });

  it("kitchens sometimes turn up a hammer", () => {
    let found = 0;
    for (let seed = 1; seed <= 2000; seed++) {
      const hammers = rollLoot("kitchen", mulberry32(seed)).filter((s) => s.id === "hammer");
      for (const h of hammers) expect(h.count).toBe(1);
      if (hammers.length) found++;
    }
    expect(found).toBeGreaterThan(0);
  });
});
