import { describe, expect, it } from "vitest";
import { ancestry, itemOrigin, lineageProblems, LINEAGE, mainLine } from "./lineage";
import { ITEMS } from "./items";

describe("lineage: nothing appears from nowhere", () => {
  it("traces every node back to nature, with no cycles, no unknown causes and no dead ends, and gives every item a lineage", () => {
    expect(lineageProblems(Object.keys(ITEMS))).toEqual([]);
  });

  it("reaches nature from every node", () => {
    for (const n of LINEAGE) expect(ancestry(n.id)[0].kind, n.id).toBe("nature");
  });

  it("explains the fridge by way of pond ice, the ice trade and mechanical refrigeration", () => {
    const chain = ancestry("electric_fridge").map((n) => n.id);
    for (const step of ["ice", "icehouse", "ice_trade", "mechanical_refrigeration", "industrial_refrigeration", "power_grid"]) expect(chain).toContain(step);
    expect(chain.indexOf("ice_trade")).toBeLessThan(chain.indexOf("mechanical_refrigeration"));
    expect(chain[chain.length - 1]).toBe("electric_fridge");
  });

  it("keeps history in order: every node comes after its causes", () => {
    for (const n of LINEAGE) {
      if (n.year === undefined) continue;
      for (const c of n.causes) {
        const cy = LINEAGE.find((x) => x.id === c)!.year;
        if (cy !== undefined) expect(cy, `${c} (${cy}) before ${n.id} (${n.year})`).toBeLessThanOrEqual(n.year);
      }
    }
  });

  it("tells an item's story along its main line, nature first", () => {
    expect(mainLine("electric_fridge").map((n) => n.id)).toEqual(["ice", "icehouse", "ice_trade", "mechanical_refrigeration", "industrial_refrigeration", "electric_fridge"]);
    const o = itemOrigin("water_bottle")!;
    expect(o.line.startsWith("Crude oil → ")).toBe(true);
    expect(o.line.endsWith("PET bottle (1973)")).toBe(true);
    expect(itemOrigin("not_an_item")).toBeNull();
  });
});
