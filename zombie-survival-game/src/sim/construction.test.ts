import { describe, expect, it } from "vitest";
import { ITEMS } from "./items";
import {
  ASSEMBLIES,
  COPPER_KG_PER_M,
  LAYERS,
  OUTLET_SPACING,
  STUD_SPACING,
  breached,
  exposedLayer,
  frameWall,
  harnessTotals,
  hitBay,
  makeBay,
  pullCable,
  runsThrough,
  salvageFor,
  wallThickness,
  wireBuilding,
  type Plan,
} from "./construction";

/** A typical small house: a living room with a kitchen corner at the front, a bedroom behind. */
const house: Plan = {
  height: 2.6,
  panel: { x: -4.8, z: 0.5 },
  rooms: [
    { id: "living", kind: "living", x0: -5, z0: 0, x1: 1, z1: 5, doors: [{ x: 0, z: 5, w: 0.9 }, { x: -2, z: 0, w: 0.8 }] },
    { id: "kitchen", kind: "kitchen", x0: 1, z0: 0, x1: 5, z1: 5, doors: [{ x: 1, z: 2.5, w: 0.9 }] },
    { id: "bed", kind: "bedroom", x0: -5, z0: -4, x1: 5, z1: 0, doors: [{ x: -2, z: 0, w: 0.8 }] },
  ],
};

describe("walls as real assemblies", () => {
  it("builds a frame wall about 13 cm thick and a brick one about 22 cm, outside to inside", () => {
    expect(wallThickness("wood_frame")).toBeGreaterThan(0.11);
    expect(wallThickness("wood_frame")).toBeLessThan(0.14);
    expect(wallThickness("brick_veneer")).toBeGreaterThan(0.2);
    expect(ASSEMBLIES.wood_frame[0]).toBe("siding");
    expect(ASSEMBLIES.wood_frame[ASSEMBLIES.wood_frame.length - 1]).toBe("drywall");
  });

  it("breaks layer by layer from the side you hit, carrying force only through what gives", () => {
    const bay = makeBay("wood_frame");
    expect(hitBay(bay, 20, "in").broke).toEqual([]);
    expect(exposedLayer(bay, "in")!.id).toBe("drywall");
    const r = hitBay(bay, 20, "in");
    expect(r.broke).toEqual(["drywall", "insulation"]);
    expect(exposedLayer(bay, "in")!.id).toBe("studs");
    // The outside is still untouched.
    expect(exposedLayer(bay, "out")!.id).toBe("siding");
    hitBay(bay, 1000, "in");
    expect(breached(bay)).toBe(true);
  });

  it("makes brick and block far harder to get through than a frame wall", () => {
    const total = (c: Parameters<typeof makeBay>[0]) => makeBay(c).layers.reduce((a, l) => a + l.hp, 0);
    expect(total("brick_veneer")).toBeGreaterThan(total("wood_frame") * 2);
    expect(total("block")).toBeGreaterThan(total("brick_veneer"));
    expect(total("partition")).toBeLessThan(total("wood_frame"));
  });

  it("only ever leaves things that exist as items", () => {
    for (const l of Object.values(LAYERS)) for (const [id] of l.salvage) expect(ITEMS[id], id).toBeDefined();
  });

  it("leaves planks and nails from studs, nothing but dust from drywall", () => {
    const items = salvageFor(["drywall", "insulation", "studs"]);
    expect(items.find((s) => s.id === "plank")!.count).toBe(3);
    expect(items.find((s) => s.id === "nails")!.count).toBe(12);
    expect(salvageFor(["drywall"])).toEqual([]);
  });
});

describe("framing", () => {
  it("puts studs at 16-inch centres and frames openings with kings, jacks, a header and cripples", () => {
    const plain = frameWall(4, 2.6, []);
    expect(plain.studs.length).toBe(Math.floor(4 / STUD_SPACING) + 2);
    expect(plain.plateLength).toBeCloseTo(12);
    const withWindow = frameWall(4, 2.6, [{ c: 2, w: 1.2, b: 0.9, t: 2.1 }]);
    expect(withWindow.studs.length).toBeLessThan(plain.studs.length);
    expect(withWindow.kings).toBe(2);
    expect(withWindow.jacks).toBe(2);
    expect(withWindow.cripples).toBeGreaterThan(0);
    expect(withWindow.headerLength).toBeGreaterThan(2.4);
  });
});

describe("the wiring harness", () => {
  const h = wireBuilding(house);

  it("gives every room a ceiling light and a switch by its door", () => {
    for (const r of house.rooms) {
      expect(h.devices.some((d) => d.kind === "light" && d.room === r.id)).toBe(true);
      const sw = h.devices.find((d) => d.kind === "switch" && d.room === r.id)!;
      expect(sw.y).toBeCloseTo(1.2);
      const door = r.doors[0];
      expect(Math.hypot(sw.x - door.x, sw.z - door.z)).toBeLessThan(1);
    }
  });

  it("spaces receptacles so no point on a wall is more than 1.83 m from one, and keeps them clear of doors", () => {
    for (const r of house.rooms) {
      const perim = 2 * (r.x1 - r.x0 + (r.z1 - r.z0));
      const outlets = h.devices.filter((d) => d.kind === "outlet" && d.room === r.id);
      expect(outlets.length).toBeGreaterThanOrEqual(Math.ceil(perim / OUTLET_SPACING));
      for (const o of outlets) for (const d of r.doors) expect(Math.hypot(o.x - d.x, o.z - d.z)).toBeGreaterThan(d.w / 2 + 0.3);
    }
  });

  it("runs a kitchen on two 20 A counter circuits in 12 AWG plus a dedicated fridge circuit, and the rest on 15 A 14 AWG", () => {
    const k = h.circuits.filter((c) => c.rooms.includes("kitchen") && c.load === "appliances");
    expect(k.length).toBe(3);
    expect(k.every((c) => c.amps === 20 && c.gauge === 12)).toBe(true);
    expect(h.devices.some((d) => d.kind === "fridge")).toBe(true);
    const others = h.circuits.filter((c) => !c.rooms.includes("kitchen") || c.load === "lights");
    expect(others.every((c) => (c.amps === 15 ? c.gauge === 14 : c.gauge === 12))).toBe(true);
  });

  it("is the same harness every time for the same house, so only what's been cut needs saving", () => {
    expect(wireBuilding(house)).toEqual(h);
  });

  it("holds a realistic amount of cable and copper for a small house", () => {
    const t = harnessTotals(h);
    expect(t.metres).toBeGreaterThan(40);
    expect(t.metres).toBeLessThan(250);
    expect(t.copperKg).toBeCloseTo(
      h.runs.reduce((a, r) => a + r.length * COPPER_KG_PER_M[h.circuits.find((c) => c.id === r.circuit)!.gauge], 0),
      1,
    );
    expect(COPPER_KG_PER_M[14]).toBeCloseTo(0.0559, 3);
  });
});

describe("salvaging the wiring", () => {
  const h = wireBuilding(house);
  // The bedroom's back wall, one bay wide.
  const bay = { x0: -1, z0: -4, x1: 0.22, z1: -4 };

  it("finds the cable that crosses an opened bay and pulls copper out of it", () => {
    const through = runsThrough(h, bay.x0, bay.z0, bay.x1, bay.z1);
    expect(through.length).toBeGreaterThan(0);
    const got = pullCable(h, bay.x0, bay.z0, bay.x1, bay.z1, () => false, new Set());
    expect(got.metres).toBeGreaterThan(0);
    expect(got.copperKg).toBeGreaterThan(0);
    expect(got.circuitsCut.length).toBeGreaterThan(0);
    expect(got.shock).toBe(0);
  });

  it("bites if you cut a live circuit, and not once the breaker's off", () => {
    expect(pullCable(h, bay.x0, bay.z0, bay.x1, bay.z1, () => true, new Set()).shock).toBeGreaterThan(0);
    const first = pullCable(h, bay.x0, bay.z0, bay.x1, bay.z1, () => false, new Set());
    expect(pullCable(h, bay.x0, bay.z0, bay.x1, bay.z1, () => true, new Set(first.circuitsCut)).shock).toBe(0);
  });
});
