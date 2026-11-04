/**
 * Horde nights, heat and gamestage: the pressure that makes preparing worth it.
 *
 * Every seventh night, from 22:00 to 04:00, the dead converge on wherever you are, in waves, and keep
 * coming however well you hide; barricades, light, power and noise discipline all get tested at once.
 * Between those nights, your own activity builds "heat" where it happens: gunshots, hammering, a
 * generator running, lit windows after dark. Heat cools off over a couple of hours; let an area get
 * hot enough and a few of the dead come to see what it was. Gamestage (days survived, plus how much
 * killing you've done) sets how big both get, so the threat grows with you.
 *
 * Pure rules: the client spawns, the rules say when, where and how many.
 */

export const HORDE_EVERY_DAYS = 7;
/** Horde night runs from 22:00 on the horde day to 04:00 the next morning (game minutes past midnight). */
export const HORDE_FROM = 22 * 60;
export const HORDE_UNTIL = 4 * 60;

export const dayOf = (minutes: number) => Math.floor(minutes / 1440) + 1;

/** The horde day this minute belongs to while a horde night is on (the night of day 7 runs into day 8), else null. */
export function hordeNight(minutes: number): number | null {
  const day = dayOf(minutes);
  const t = minutes % 1440;
  if (t >= HORDE_FROM && day % HORDE_EVERY_DAYS === 0) return day;
  if (t < HORDE_UNTIL && (day - 1) % HORDE_EVERY_DAYS === 0 && day > 1) return day - 1;
  return null;
}

/** Whole days until the next horde night starts: 0 means tonight (or now). */
export function daysToHorde(minutes: number): number {
  if (hordeNight(minutes) !== null) return 0;
  const day = dayOf(minutes);
  const next = Math.ceil(day / HORDE_EVERY_DAYS) * HORDE_EVERY_DAYS;
  return next - day;
}

/** How dangerous the world is for you right now: days survived, plus a little for every 20 kills. */
export function gamestage(minutes: number, kills: number): number {
  return dayOf(minutes) - 1 + Math.floor(kills / 20);
}

export interface HordePlan {
  /** Dead that come over the whole night. */
  total: number;
  /** How many arrive together. */
  group: number;
  /** Real seconds between groups (a horde night is six game hours, six real minutes). */
  interval: number;
  /** Most horde dead alive at once, so the client never drowns. */
  maxAlive: number;
}

export function hordePlan(stage: number): HordePlan {
  return {
    total: Math.min(90, 12 + stage * 3),
    group: Math.min(8, 3 + Math.floor(stage / 7)),
    interval: Math.max(12, 24 - Math.floor(stage / 7) * 2),
    maxAlive: Math.min(45, 18 + stage),
  };
}

/** What the clock panel says. */
export function hordeLabel(minutes: number): { text: string; level: "calm" | "soon" | "tonight" | "now" } {
  if (hordeNight(minutes) !== null) return { text: "Horde night", level: "now" };
  const d = daysToHorde(minutes);
  if (d === 0) return { text: "Horde tonight, 22:00", level: "tonight" };
  if (d === 1) return { text: "Horde tomorrow night", level: "soon" };
  return { text: `Horde night in ${d} days`, level: "calm" };
}

// ------------------------------------------------------------------ heat

/** Heat is kept per square of this many metres. */
export const HEAT_CELL = 48;
/** Heat halves every this many game minutes once the activity stops. */
export const HEAT_HALF_LIFE = 120;
/** A square this hot draws scouts. */
export const HEAT_SCOUTS_AT = 50;
/** Game minutes before heat can draw scouts again. */
export const HEAT_COOLDOWN = 60;

export interface HeatCell {
  heat: number;
  /** Where the latest activity in this square was: where scouts head. */
  x: number;
  z: number;
}

export interface HeatState {
  cells: Record<string, HeatCell>;
  cooldown: number;
}

export const createHeat = (): HeatState => ({ cells: {}, cooldown: 0 });

const cellKey = (x: number, z: number) => `${Math.floor(x / HEAT_CELL)},${Math.floor(z / HEAT_CELL)}`;

/** Heat from a one-off noise heard this far away: quiet things add none, a gunshot about 7. */
export const noiseHeat = (radius: number) => Math.max(0, radius - 10) * 0.15;

export function addHeat(h: HeatState, x: number, z: number, amount: number) {
  if (amount <= 0) return;
  const k = cellKey(x, z);
  const c = (h.cells[k] ??= { heat: 0, x, z });
  c.heat = Math.min(100, c.heat + amount);
  c.x = x;
  c.z = z;
}

export function coolHeat(h: HeatState, gameMinutes: number) {
  const f = Math.pow(0.5, gameMinutes / HEAT_HALF_LIFE);
  for (const [k, c] of Object.entries(h.cells)) {
    c.heat *= f;
    if (c.heat < 0.5) delete h.cells[k];
  }
  h.cooldown = Math.max(0, h.cooldown - gameMinutes);
}

export const heatAt = (h: HeatState, x: number, z: number) => h.cells[cellKey(x, z)]?.heat ?? 0;

/**
 * If an area is hot enough and heat isn't cooling down from the last scouts, the square they should
 * investigate. Taking it halves that square's heat and starts the cooldown, so one burst of noise
 * brings one group, not a stream.
 */
export function takeScoutTarget(h: HeatState): HeatCell | null {
  if (h.cooldown > 0) return null;
  let best: HeatCell | null = null;
  for (const c of Object.values(h.cells)) if (c.heat >= HEAT_SCOUTS_AT && (!best || c.heat > best.heat)) best = c;
  if (!best) return null;
  best.heat /= 2;
  h.cooldown = HEAT_COOLDOWN;
  return { ...best };
}

export const scoutCount = (stage: number) => Math.min(6, 2 + Math.floor(stage / 10));

/** A saved heat state from any source, made safe (old saves have none). */
export function loadHeat(raw: unknown): HeatState {
  const h = createHeat();
  if (!raw || typeof raw !== "object") return h;
  const r = raw as { cells?: unknown; cooldown?: unknown };
  if (typeof r.cooldown === "number" && Number.isFinite(r.cooldown)) h.cooldown = Math.max(0, r.cooldown);
  if (r.cells && typeof r.cells === "object") {
    for (const [k, c] of Object.entries(r.cells as Record<string, unknown>)) {
      const v = c as Partial<HeatCell> | null;
      if (v && [v.heat, v.x, v.z].every((n) => typeof n === "number" && Number.isFinite(n))) h.cells[k] = { heat: Math.min(100, Math.max(0, v.heat!)), x: v.x!, z: v.z! };
    }
  }
  return h;
}
