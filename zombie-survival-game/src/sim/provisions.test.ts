import { describe, expect, it } from "vitest";
import { ageFresh, freshAtFind, freshStage, fridgeTemp, mealEffect, spoilRate } from "./freshness";
import { craft, GAS_CANISTER_MINUTES, missingFor, RECIPES } from "./crafting";
import { makeStack, type ItemStack } from "./items";
import { createBody, moodles, poisonFood, updateBody } from "./body";

const recipe = (id: string) => RECIPES.find((r) => r.id === id)!;
const env = { ambientTemp: 18, exertion: 0, threats: 0 };

describe("food going off", () => {
  it("keeps about six times longer in a 4 °C fridge than on a 20 °C counter", () => {
    expect(1 / spoilRate(4)).toBeGreaterThan(5);
    expect(1 / spoilRate(4)).toBeLessThan(7);
  });

  it("nearly stops spoiling when frozen", () => {
    expect(spoilRate(-10)).toBeLessThan(0.05);
  });

  it("rots raw chicken left out overnight but not in a running fridge", () => {
    const night = 10 * 60;
    expect(freshStage(ageFresh(1, 8, 20, night))).toBe("rotten");
    expect(freshStage(ageFresh(1, 8, 4, night))).toBe("fresh");
  });

  it("warms a fridge toward the room over a day once the power goes, and cools it again when power returns", () => {
    let t = 4;
    for (let h = 0; h < 4; h++) t = fridgeTemp(t, 18, false, 60);
    expect(t).toBeGreaterThan(5);
    expect(t).toBeLessThan(8);
    for (let h = 0; h < 44; h++) t = fridgeTemp(t, 18, false, 60);
    expect(t).toBeGreaterThan(15);
    for (let h = 0; h < 8; h++) t = fridgeTemp(t, 18, true, 60);
    expect(t).toBeLessThan(5);
  });

  it("finds milk in a dead fridge spoiled days after the grid failed, but fresh in one that still runs", () => {
    const day = 1440;
    expect(freshStage(freshAtFind(40, true, 3 * day, 0, 18))).toBe("fresh");
    expect(["spoiled", "rotten"]).toContain(freshStage(freshAtFind(40, true, 5 * day, 3 * day, 18)));
  });

  it("feeds you less and risks poisoning as food turns, and raw meat is risky however fresh", () => {
    expect(mealEffect(undefined)).toEqual({ nourish: 1, poisonChance: 0, poisonSeverity: 0 });
    expect(mealEffect(0.2).nourish).toBeLessThan(mealEffect(0.9).nourish);
    expect(mealEffect(0.05).poisonChance).toBeGreaterThan(mealEffect(0.4).poisonChance);
    expect(mealEffect(1, true).poisonChance).toBeGreaterThan(0.3);
  });
});

describe("cooking and crafting", () => {
  it("says exactly what's missing instead of just refusing", () => {
    expect(missingFor(recipe("cook_chicken"), [], { kitchenStove: false })).toEqual(["Raw Chicken", "Cooking Pot", "heat (a powered kitchen or a camping stove)"]);
    const inv = [makeStack("raw_chicken"), makeStack("cooking_pot"), makeStack("camping_stove")];
    expect(missingFor(recipe("cook_chicken"), inv, { kitchenStove: false })).toEqual(["gas for the stove"]);
  });

  it("cooks on a powered kitchen stove without touching your gas", () => {
    const inv = [makeStack("raw_chicken"), makeStack("cooking_pot")];
    const r = craft(recipe("cook_chicken"), inv, { kitchenStove: true });
    expect(r.heat).toBe("kitchen");
    expect(r.output.id).toBe("cooked_chicken");
    expect(r.inventory.map((s) => s.id)).toEqual(["cooking_pot"]);
  });

  it("burns gas by the minute on a camping stove, opening a canister only when the fitted one runs dry", () => {
    const stove = makeStack("camping_stove");
    stove.charge = 10;
    const inv: ItemStack[] = [makeStack("raw_chicken"), makeStack("cooking_pot"), stove, makeStack("gas_canister", 2)];
    const r = craft(recipe("cook_chicken"), inv, { kitchenStove: false });
    expect(r.heat).toBe("stove");
    expect(r.inventory.find((s) => s.id === "gas_canister")!.count).toBe(1);
    expect(r.inventory.find((s) => s.id === "camping_stove")!.charge).toBe(10 + GAS_CANISTER_MINUTES - 20);
    expect(inv.find((s) => s.id === "gas_canister")!.count).toBe(2); // the input inventory is untouched
  });

  it("uses the stalest meat first and cooked food keeps its age: cooking doesn't un-spoil it", () => {
    const old = makeStack("raw_chicken");
    old.fresh = 0.2;
    const newer = makeStack("raw_chicken");
    newer.fresh = 0.9;
    const r = craft(recipe("cook_chicken"), [newer, old, makeStack("cooking_pot")], { kitchenStove: true });
    expect(r.output.fresh).toBe(0.2);
    expect(r.inventory.find((s) => s.id === "raw_chicken")!.fresh).toBe(0.9);
  });

  it("tears two rags into a bandage with no tools or heat", () => {
    const r = craft(recipe("rag_bandage"), [makeStack("rag", 3)], { kitchenStove: false });
    expect(r.output.id).toBe("bandage");
    expect(r.inventory[0].count).toBe(1);
  });
});

describe("food poisoning", () => {
  it("dehydrates you for hours, shows as a moodle, and passes", () => {
    const b = createBody();
    poisonFood(b, 0.6);
    expect(moodles(b).some((m) => m.id === "foodpoison")).toBe(true);
    const sick = createBody();
    poisonFood(sick, 0.6);
    const well = createBody();
    for (let i = 0; i < 60; i++) {
      updateBody(sick, 1, 10, env);
      updateBody(well, 1, 10, env);
    }
    expect(sick.thirst).toBeLessThan(well.thirst - 10);
    for (let i = 0; i < 300; i++) updateBody(sick, 1, 10, env);
    expect(sick.foodPoison!.minutes).toBe(0);
    expect(moodles(sick).some((m) => m.id === "foodpoison")).toBe(false);
  });

  it("loads an older save with no food-poisoning field", () => {
    const b = createBody();
    delete b.foodPoison;
    expect(() => updateBody(b, 1, 10, env)).not.toThrow();
    poisonFood(b, 0.3);
    expect(b.foodPoison!.minutes).toBeGreaterThan(0);
  });
});
