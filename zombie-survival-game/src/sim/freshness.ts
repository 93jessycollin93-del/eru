/**
 * Food that goes off.
 *
 * Each perishable stack carries `fresh`, 1 when bought and 0 when rotten, and loses it at a rate set
 * by its item's life at room temperature and by how warm it is kept. Microbial spoilage roughly
 * triples per 10 °C (Q10 ≈ 3), so a 4 °C fridge makes food last about six times longer than a
 * 20 °C kitchen, and a fridge that loses power warms toward the room over the next day: the grid
 * failing is a deadline on everything in it.
 */

export type FreshStage = "fresh" | "stale" | "spoiled" | "rotten";

export const FRIDGE_C = 4;
/** Closed and unpowered, a stocked fridge drifts toward room temperature with about this time constant. */
export const FRIDGE_WARM_TAU_H = 24;
/** Powered again, the compressor pulls it back down within a few hours. */
export const FRIDGE_COOL_TAU_H = 2;
const Q10 = 3;

/** Spoilage speed relative to 20 °C. Below freezing it all but stops. */
export function spoilRate(tempC: number): number {
  if (tempC <= -2) return 0.02;
  return Math.pow(Q10, (tempC - 20) / 10);
}

/** Freshness after `minutes` at `tempC`, for an item that rots in `lifeH` hours at 20 °C. */
export function ageFresh(fresh: number, lifeH: number, tempC: number, minutes: number): number {
  return Math.max(0, fresh - (minutes / 60 / lifeH) * spoilRate(tempC));
}

export function freshStage(fresh: number): FreshStage {
  if (fresh >= 0.6) return "fresh";
  if (fresh >= 0.3) return "stale";
  if (fresh >= 0.1) return "spoiled";
  return "rotten";
}

/** A fridge's air one step later: toward 4 °C while it runs, toward the room when it doesn't. */
export function fridgeTemp(current: number, roomC: number, powered: boolean, minutes: number): number {
  const target = powered ? FRIDGE_C : roomC;
  const tau = (powered ? FRIDGE_COOL_TAU_H : FRIDGE_WARM_TAU_H) * 60;
  return target + (current - target) * Math.exp(-minutes / tau);
}

export interface MealEffect {
  /** Share of the food's hunger and thirst value that does you any good. */
  nourish: number;
  /** Chance this mouthful gives you food poisoning. */
  poisonChance: number;
  /** How bad it is if it does, 0..1. */
  poisonSeverity: number;
}

const BY_STAGE: Record<FreshStage, MealEffect> = {
  fresh: { nourish: 1, poisonChance: 0, poisonSeverity: 0 },
  stale: { nourish: 0.8, poisonChance: 0.05, poisonSeverity: 0.3 },
  spoiled: { nourish: 0.5, poisonChance: 0.45, poisonSeverity: 0.6 },
  rotten: { nourish: 0.25, poisonChance: 0.9, poisonSeverity: 1 },
};

/**
 * What eating something does. Non-perishables (`fresh` undefined) are always fine. Raw meat carries
 * its own risk however fresh it is: cooking is the cure, and cooking spoiled meat still leaves it
 * spoiled (the toxins stay).
 */
export function mealEffect(fresh: number | undefined, raw = false): MealEffect {
  const base = fresh === undefined ? BY_STAGE.fresh : BY_STAGE[freshStage(fresh)];
  if (!raw) return base;
  return { nourish: base.nourish, poisonChance: Math.max(base.poisonChance, 0.35), poisonSeverity: Math.max(base.poisonSeverity, 0.6) };
}

/** Freshness of food that has sat since the outbreak began: in a fridge until the grid failed, then at room temperature. */
export function freshAtFind(lifeH: number, inFridge: boolean, sinceMinutes: number, gridFailedMinutesAgo: number, roomC: number): number {
  if (!inFridge) return ageFresh(1, lifeH, roomC, sinceMinutes);
  const cold = Math.max(0, sinceMinutes - Math.max(0, gridFailedMinutesAgo));
  let f = ageFresh(1, lifeH, FRIDGE_C, cold);
  // After the power went: integrate the warming curve in hour steps.
  let t = FRIDGE_C;
  for (let m = 0; m < Math.min(sinceMinutes, Math.max(0, gridFailedMinutesAgo)); m += 60) {
    const step = Math.min(60, gridFailedMinutesAgo - m);
    t = fridgeTemp(t, roomC, false, step);
    f = ageFresh(f, lifeH, t, step);
  }
  return f;
}
