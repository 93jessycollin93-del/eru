import { describe, expect, it, vi } from "vitest";
import {
  FACES_PER_SEX,
  GEAR_LOOT,
  LIVING_ONLY_GEAR,
  lightness,
  siteAt,
  townRect,
  GARMENTS,
  PALETTES,
  PLAYER_APPEARANCE,
  ROLES,
  SITE_ROLES,
  chooseRole,
  playerGear,
  resolveRole,
  rollAppearance,
  type GarmentDef,
  type RoleId,
  type SpawnSite,
} from "./appearance";
import { ITEMS } from "./items";
import { rollZombieTraits } from "./zombies";

const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
};

const ROLE_IDS = Object.keys(ROLES) as RoleId[];

describe("appearance", () => {
  it("is a pure function of seed and role, plain JSON, and never calls Math.random", () => {
    const spy = vi.spyOn(Math, "random");
    for (const role of ROLE_IDS) {
      for (const seed of [1, 99, 123456, 4294967295]) {
        const a = rollAppearance(seed, role, { zombie: true });
        expect(rollAppearance(seed, role, { zombie: true })).toEqual(a);
        expect(JSON.parse(JSON.stringify(a))).toEqual(a);
      }
    }
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("picks roles in the proportions of each site's table", () => {
    for (const site of Object.keys(SITE_ROLES) as SpawnSite[]) {
      const table = SITE_ROLES[site];
      const total = table.reduce((s, [, w]) => s + w, 0);
      const counts = new Map<RoleId, number>();
      const N = 20000;
      for (let i = 0; i < N; i++) {
        const r = chooseRole(i * 2654435761, site);
        counts.set(r, (counts.get(r) ?? 0) + 1);
      }
      for (const [role, w] of table) expect(Math.abs((counts.get(role) ?? 0) / N - w / total)).toBeLessThan(0.015);
    }
  });

  it("keeps who someone was independent of how fast they are", () => {
    let police = 0;
    let runners = 0;
    for (let i = 0; i < 40000 && police < 6000; i++) {
      const seed = i * 7919 + 13;
      if (chooseRole(seed, "police") !== "police") continue;
      police++;
      if (rollZombieTraits(seed).runner) runners++;
    }
    expect(Math.abs(runners / police - 0.12)).toBeLessThan(0.015);
  });

  it("has valid tables: every garment in its slot, colours in range, weights positive", () => {
    for (const [id, g] of Object.entries(GARMENTS) as [string, GarmentDef][]) {
      expect(g.palettes.length, id).toBeGreaterThan(0);
      if (g.slot === "outer" && /vest|apron/.test(id)) expect(g.sleeve, id).toBe(0);
    }
    for (const [name, colors] of Object.entries(PALETTES)) {
      for (const c of colors) {
        expect(c, name).toMatch(/^#[0-9a-f]{6}$/);
        const l = luminance(c);
        expect(l, `${name} ${c}`).toBeGreaterThanOrEqual(0.008);
        expect(l, `${name} ${c}`).toBeLessThanOrEqual(0.7);
      }
    }
    for (const [role, def] of Object.entries(ROLES)) {
      const slots = { top: def.top, outer: def.outer.options, bottom: def.bottom, feet: def.feet };
      for (const [slot, list] of Object.entries(slots)) {
        for (const [id, w] of list) {
          expect(w, `${role} ${id}`).toBeGreaterThan(0);
          expect((GARMENTS[id] as GarmentDef).slot, `${role} ${slot} ${id}`).toBe(slot);
        }
      }
    }
    for (const table of Object.values(SITE_ROLES)) for (const [, w] of table) expect(w).toBeGreaterThan(0);
  });

  it("holds the rules of dress over thousands of people", () => {
    for (const role of ROLE_IDS) {
      for (let i = 0; i < 1200; i++) {
        const seed = i * 2246822519 + 7;
        for (const zombie of [true, false]) {
          const a = rollAppearance(seed, role, { zombie });
          if (a.head?.id === "hood_up") expect((GARMENTS[a.outer!.id] as GarmentDef).hood, role).toBe(true);
          if (a.sex === "f") expect(a.face.beard).toBe(0);
          expect(a.face.index).toBeGreaterThanOrEqual(a.sex === "f" ? FACES_PER_SEX : 0);
          expect(a.face.index).toBeLessThan(a.sex === "f" ? 2 * FACES_PER_SEX : FACES_PER_SEX);
          for (const g of [a.top, a.bottom, a.feet, ...(a.outer ? [a.outer] : [])]) {
            const def = GARMENTS[g.id] as GarmentDef;
            if (def.sex) expect(def.sex, `${role} ${g.id}`).toBe(a.sex);
          }
          if (a.gear.includes("holster_gun")) expect(a.gear).toContain("holster");
          if (a.gear.includes("holster")) expect(a.gear.includes("belt") || a.gear.includes("duty_belt")).toBe(true);
          expect(a.gear).toEqual([...new Set(a.gear)].sort());
          if (role === "sleepwear") expect(a.gear).toEqual([]);
          if (role === "police") {
            expect(a.gear).toContain("duty_belt");
            expect(a.marks.badge).not.toBe("none");
          }
          if (zombie) for (const g of LIVING_ONLY_GEAR) expect(a.gear, `${role} ${g}`).not.toContain(g);
          if (a.age < 16 || a.sex === "f") expect(a.face.beard).toBe(0);
          if (!zombie) {
            expect(a.condition.decay).toBe(0);
            expect(a.condition.wounds).toEqual([]);
            expect(a.gait).toEqual({ limp: 0, hunch: 0, reach: 0 });
          } else {
            expect(a.condition.wounds.length).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it("dresses a crowd of townsfolk differently", () => {
    const combos = new Set<string>();
    const topColors = new Map<string, number>();
    for (let i = 0; i < 1000; i++) {
      const a = rollAppearance(i * 40503 + 1, "civilian", { zombie: true });
      combos.add(`${a.top.id}:${a.top.color}:${a.bottom.id}:${a.outer?.id ?? "-"}`);
      topColors.set(a.top.color, (topColors.get(a.top.color) ?? 0) + 1);
    }
    expect(combos.size).toBeGreaterThan(400);
    expect(Math.max(...topColors.values())).toBeLessThan(200);
  });

  it("the fresh dead (runners) look it: wet blood, little decay", () => {
    for (let i = 0; i < 500; i++) {
      const fresh = rollAppearance(i * 977 + 3, "civilian", { zombie: true, fresh: true });
      const old = rollAppearance(i * 977 + 3, "civilian", { zombie: true, fresh: false });
      expect(fresh.condition.fresh).toBe(true);
      expect(fresh.condition.decay).toBeLessThan(0.3);
      expect(fresh.condition.bloodAge).toBeLessThanOrEqual(0.3);
      expect(old.condition.decay).toBeGreaterThanOrEqual(0.3);
      expect(old.condition.bloodAge).toBeGreaterThanOrEqual(0.6);
      // Same person either way.
      expect(fresh.top).toEqual(old.top);
    }
  });

  it("tops and trousers usually differ in lightness, so silhouettes read", () => {
    let ok = 0;
    const N = 2000;
    for (let i = 0; i < N; i++) {
      const a = rollAppearance(i * 6151 + 11, "civilian", { zombie: true });
      const top = a.outer && a.outer.id !== "apron" ? a.outer : a.top;
      if (Math.abs(lightness(top.color) - lightness(a.bottom.color)) >= 10) ok++;
    }
    expect(ok / N).toBeGreaterThan(0.7);
  });

  it("gear loot hooks only name real items, and loot you could see is never on the dead", () => {
    for (const [id, l] of Object.entries(GEAR_LOOT)) expect(ITEMS[l!.item], id).toBeDefined();
    // Closed pouches and packs can hold loot unseen; anything else shows its contents.
    const closed = ["tool_belt", "daypack", "hikepack"];
    for (const id of Object.keys(GEAR_LOOT)) if (!closed.includes(id)) expect(LIVING_ONLY_GEAR, id).toContain(id);
  });

  it("an unknown role from a newer save becomes a civilian", () => {
    expect(resolveRole("police")).toBe("police");
    expect(resolveRole("astronaut")).toBe("civilian");
    expect(resolveRole(7)).toBe("civilian");
  });

  it("the survivor role is the player, whatever the seed", () => {
    const z = rollAppearance(777, "survivor", { zombie: true });
    expect(z.top).toEqual(PLAYER_APPEARANCE.top);
    expect(z.outer).toEqual(PLAYER_APPEARANCE.outer);
    expect(z.skin).toBe(PLAYER_APPEARANCE.skin);
    expect(z.condition.decay).toBeGreaterThan(0);
    expect(PLAYER_APPEARANCE.condition.decay).toBe(0);
  });
});

describe("playerGear", () => {
  let uid = 0;
  const inv = (...ids: string[]) => ids.map((id) => ({ uid: ++uid, id, count: 1 }));
  const held = (list: { uid: number; id: string }[], id: string) => list.find((s) => s.id === id)!.uid;
  it("puts what you carry on your body", () => {
    expect(playerGear([], null, 0)).toEqual([]);
    expect(playerGear(inv("pistol"), null, 1)).toEqual(["belt", "holster", "holster_gun"]);
    const p = inv("pistol");
    expect(playerGear(p, held(p, "pistol"), 1)).toEqual(["belt", "holster"]);
    expect(playerGear(inv("baseball_bat", "fire_axe"), null, 1)).toEqual(["sling_axe"]);
    const ba = inv("baseball_bat", "fire_axe");
    expect(playerGear(ba, held(ba, "fire_axe"), 1)).toEqual(["sling_bat"]);
    expect(playerGear(inv("kitchen_knife"), null, 0)).toEqual(["belt", "knife_sheath", "knife_sheath_knife"]);
    const k = inv("kitchen_knife");
    expect(playerGear(k, held(k, "kitchen_knife"), 0)).toEqual(["belt", "knife_sheath"]);
    expect(playerGear(inv("hammer"), null, 0)).toEqual(["belt", "hammer_loop"]);
    const h = inv("hammer");
    expect(playerGear(h, held(h, "hammer"), 0)).toEqual([]);
    expect(playerGear(inv("water_bottle"), null, 3.2)).toEqual(["daypack"]);
    expect(playerGear(inv("jerry_can"), null, 14)).toEqual(["hikepack"]);
  });

  it("a second copy of the weapon in hand still shows", () => {
    const two = inv("pistol", "pistol");
    expect(playerGear(two, two[0].uid, 1)).toEqual(["belt", "holster", "holster_gun"]);
    const axes = inv("fire_axe", "fire_axe");
    expect(playerGear(axes, axes[1].uid, 1)).toEqual(["sling_axe"]);
  });

  it("only names items that exist", () => {
    for (const id of ["pistol", "fire_axe", "baseball_bat", "kitchen_knife", "hammer"]) expect(ITEMS[id], id).toBeDefined();
  });
});

describe("siteAt", () => {
  const buildings = [
    { type: "house" as const, rect: { minX: 0, maxX: 10, minZ: 0, maxZ: 10 } },
    { type: "police" as const, rect: { minX: 100, maxX: 120, minZ: 0, maxZ: 20 } },
  ];
  const town = townRect(buildings.map((b) => b.rect));
  it("knows a building, the station's streets, the town and the woods", () => {
    expect(town).toEqual({ minX: -20, maxX: 140, minZ: -20, maxZ: 40 });
    expect(siteAt(5, 5, buildings, town)).toBe("house");
    expect(siteAt(110, 10, buildings, town)).toBe("police");
    expect(siteAt(90, 10, buildings, town)).toBe("near_police");
    expect(siteAt(40, 30, buildings, town)).toBe("street");
    expect(siteAt(-60, 0, buildings, town)).toBe("woods");
  });
  it("the station's streets turn up officers", () => {
    let police = 0;
    for (let i = 0; i < 4000; i++) if (chooseRole(i * 31337 + 1, "near_police") === "police") police++;
    expect(police / 4000).toBeGreaterThan(0.25);
  });
});
