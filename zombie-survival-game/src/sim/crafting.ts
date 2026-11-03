/**
 * Cooking and crafting: recipes as data, checked and applied as pure functions on an inventory.
 *
 * Heat is real. A recipe that needs it runs on a kitchen stove only while that kitchen has power,
 * or on a camping stove that burns gas by the minute; canisters are opened as the stove runs dry.
 */
import { ITEMS, makeStack, type ItemStack } from "./items";

export interface Recipe {
  id: string;
  name: string;
  inputs: [string, number][];
  /** Needed but not used up. */
  tools?: string[];
  heat?: boolean;
  /** Game minutes of work. */
  minutes: number;
  output: [string, number];
}

/** Minutes of flame in one butane canister at full burn. */
export const GAS_CANISTER_MINUTES = 90;

export const RECIPES: Recipe[] = [
  { id: "rag_bandage", name: "Bandage from rags", inputs: [["rag", 2]], minutes: 3, output: ["bandage", 1] },
  { id: "cook_chicken", name: "Cook chicken", inputs: [["raw_chicken", 1]], tools: ["cooking_pot"], heat: true, minutes: 20, output: ["cooked_chicken", 1] },
];

export interface CraftContext {
  /** Standing in a kitchen whose stove has power. */
  kitchenStove: boolean;
}

export type HeatSource = "kitchen" | "stove";

const count = (inv: ItemStack[], id: string) => inv.filter((s) => s.id === id).reduce((n, s) => n + s.count, 0);

function stoveMinutes(inv: ItemStack[]): number {
  const stove = inv.find((s) => s.id === "camping_stove");
  if (!stove) return 0;
  return (stove.charge ?? 0) + count(inv, "gas_canister") * GAS_CANISTER_MINUTES;
}

export function heatFor(inv: ItemStack[], ctx: CraftContext, minutes: number): HeatSource | null {
  if (ctx.kitchenStove) return "kitchen";
  return stoveMinutes(inv) >= minutes ? "stove" : null;
}

/** What's missing for a recipe, in words, or an empty list if it can be made now. */
export function missingFor(r: Recipe, inv: ItemStack[], ctx: CraftContext): string[] {
  const out: string[] = [];
  for (const [id, n] of r.inputs) {
    const have = count(inv, id);
    if (have < n) out.push(n > 1 ? `${n - have}× ${ITEMS[id].name}` : ITEMS[id].name);
  }
  for (const id of r.tools ?? []) if (!count(inv, id)) out.push(ITEMS[id].name);
  if (r.heat && !heatFor(inv, ctx, r.minutes)) out.push(inv.some((s) => s.id === "camping_stove") ? "gas for the stove" : "heat (a powered kitchen or a camping stove)");
  return out;
}

export interface CraftResult {
  inventory: ItemStack[];
  output: ItemStack;
  heat: HeatSource | null;
}

/** Make a recipe from an inventory. Uses the stalest perishables first; the output inherits their freshness. */
export function craft(r: Recipe, inventory: ItemStack[], ctx: CraftContext): CraftResult {
  const missing = missingFor(r, inventory, ctx);
  if (missing.length) throw new Error(`can't make ${r.id}: missing ${missing.join(", ")}`);
  const inv = inventory.map((s) => ({ ...s }));
  let fresh: number | undefined;
  for (const [id, n] of r.inputs) {
    let need = n;
    for (const s of inv.filter((x) => x.id === id).sort((a, b) => (a.fresh ?? 1) - (b.fresh ?? 1))) {
      const take = Math.min(need, s.count);
      if (take > 0 && s.fresh !== undefined) fresh = Math.min(fresh ?? 1, s.fresh);
      s.count -= take;
      need -= take;
      if (!need) break;
    }
  }
  const heat = r.heat ? heatFor(inventory, ctx, r.minutes) : null;
  if (heat === "stove") {
    const stove = inv.find((s) => s.id === "camping_stove")!;
    let left = stove.charge ?? 0;
    while (left < r.minutes) {
      const can = inv.find((s) => s.id === "gas_canister" && s.count > 0)!;
      can.count--;
      left += GAS_CANISTER_MINUTES;
    }
    stove.charge = left - r.minutes;
  }
  const [outId, outN] = r.output;
  const output = makeStack(outId, outN);
  if (ITEMS[outId].perish) output.fresh = fresh ?? 1;
  return { inventory: inv.filter((s) => s.count > 0), output, heat };
}
