/**
 * Survivor body simulation.
 *
 * Engine-agnostic: no rendering, DOM or framework imports. All randomness
 * comes from an injected rng, and all state lives in a plain serialisable
 * object so it can be saved, sent over a network, or ported to another engine.
 *
 * Time comes in two flavours:
 *  - realSeconds: wall-clock seconds of play (bleeding, stamina, panic feel
 *    urgent, so they run in real time)
 *  - gameMinutes: in-game clock minutes (hunger, thirst, fatigue, healing and
 *    infection run on the world clock, and speed up while sleeping)
 */

export type BodyPart = "head" | "torso" | "leftArm" | "rightArm" | "leftLeg" | "rightLeg";
export type WoundKind = "scratch" | "laceration" | "bite" | "gunshot";

export const BODY_PARTS: BodyPart[] = ["head", "torso", "leftArm", "rightArm", "leftLeg", "rightLeg"];

export const BODY_PART_NAMES: Record<BodyPart, string> = {
  head: "Head and neck",
  torso: "Torso",
  leftArm: "Left arm",
  rightArm: "Right arm",
  leftLeg: "Left leg",
  rightLeg: "Right leg",
};

export interface Wound {
  id: number;
  part: BodyPart;
  kind: WoundKind;
  /** 1 when fresh, heals towards 0. */
  severity: number;
  /** Millilitres of blood lost per real second while untreated. */
  bleedRate: number;
  bandaged: boolean;
}

export interface BodyState {
  /** Total blood in ml. A healthy adult has about 5000 ml. */
  blood: number;
  /** Tissue health 0..100, damaged by trauma and starvation. */
  health: number;
  /** 100 = full, 0 = starving. */
  hunger: number;
  /** 100 = hydrated, 0 = dehydrated. */
  thirst: number;
  stamina: number;
  /** 0 = rested, 100 = can't stay awake. */
  fatigue: number;
  /** Core temperature in °C. */
  bodyTemp: number;
  /** 0..100, rises around zombies. */
  panic: number;
  wounds: Wound[];
  /** Knox infection. Hidden from the player until symptoms show. */
  infection: { infected: boolean; progress: number } ;
  /** Game minutes of painkiller effect left. */
  painkillers: number;
  asleep: boolean;
  nextWoundId: number;
}

export interface BodyEnvironment {
  /** Air temperature in °C where the survivor is. */
  ambientTemp: number;
  /** 0 = resting, 1 = sprinting. */
  exertion: number;
  /** Zombies that are actively hunting the survivor nearby. */
  threats: number;
}

export interface Moodle {
  id: string;
  label: string;
  /** 1 (mild) .. 4 (critical) */
  level: number;
  tone: "good" | "warn" | "danger";
  detail: string;
}

/** Blood level where the survivor dies. Losing ~40% of blood is fatal. */
const FATAL_BLOOD = 3000;
const FULL_BLOOD = 5000;
/** In-game minutes from infection to death: about 2.5 in-game days. */
const INFECTION_MINUTES = 60 * 60;

const WOUND_PROFILE: Record<WoundKind, { bleed: number; trauma: number; pain: number; healMinutes: number; clots: boolean }> = {
  scratch: { bleed: 3, trauma: 3, pain: 8, healMinutes: 6 * 60, clots: true },
  laceration: { bleed: 9, trauma: 8, pain: 20, healMinutes: 24 * 60, clots: false },
  bite: { bleed: 12, trauma: 14, pain: 30, healMinutes: 36 * 60, clots: false },
  gunshot: { bleed: 18, trauma: 30, pain: 40, healMinutes: 48 * 60, clots: false },
};

/** Chance each wound type passes on the infection (Project Zomboid defaults). */
const INFECTION_CHANCE: Record<WoundKind, number> = {
  scratch: 0.07,
  laceration: 0.25,
  bite: 1,
  gunshot: 0,
};

export function createBody(): BodyState {
  return {
    blood: FULL_BLOOD,
    health: 100,
    hunger: 80,
    thirst: 75,
    stamina: 100,
    fatigue: 15,
    bodyTemp: 37,
    panic: 0,
    wounds: [],
    infection: { infected: false, progress: 0 },
    painkillers: 0,
    asleep: false,
    nextWoundId: 1,
  };
}

// ------------------------------------------------------------------ derived

export const bloodPercent = (b: BodyState) =>
  Math.max(0, Math.min(100, ((b.blood - FATAL_BLOOD) / (FULL_BLOOD - FATAL_BLOOD)) * 100));

export const isBleeding = (b: BodyState) => b.wounds.some((w) => !w.bandaged && w.bleedRate > 0.05);

export function pain(b: BodyState): number {
  let p = 0;
  for (const w of b.wounds) p += WOUND_PROFILE[w.kind].pain * w.severity * (w.bandaged ? 0.6 : 1);
  if (b.painkillers > 0) p *= 0.35;
  return Math.min(100, p);
}

/** Infection stage the player can feel: 0 none, 1 queasy, 2 nauseous, 3 fever, 4 dying. */
export function infectionStage(b: BodyState): number {
  if (!b.infection.infected) return 0;
  const t = b.infection.progress;
  return t < 0.2 ? 0 : t < 0.45 ? 1 : t < 0.7 ? 2 : t < 0.9 ? 3 : 4;
}

/** Multiplier on movement speed from leg wounds, exhaustion and blood loss. */
export function mobility(b: BodyState): number {
  let m = 1;
  for (const w of b.wounds) {
    if (w.part === "leftLeg" || w.part === "rightLeg") m -= 0.18 * w.severity * (b.painkillers > 0 ? 0.5 : 1);
  }
  if (bloodPercent(b) < 40) m -= 0.2;
  if (b.fatigue > 85) m -= 0.1;
  return Math.max(0.45, m);
}

/** Extra weapon sway / spread from pain, panic, fatigue and cold. 1 = steady. */
export function aimSway(b: BodyState): number {
  let armPain = 0;
  for (const w of b.wounds) if (w.part === "leftArm" || w.part === "rightArm") armPain += w.severity;
  return 1 + pain(b) / 60 + b.panic / 80 + Math.max(0, b.fatigue - 60) / 60 + armPain * 0.4 + (b.bodyTemp < 35.5 ? 0.6 : 0);
}

/** Melee damage multiplier from arm wounds and exhaustion. */
export function strength(b: BodyState): number {
  let s = 1;
  for (const w of b.wounds) if (w.part === "rightArm" || w.part === "leftArm") s -= 0.15 * w.severity;
  if (b.stamina < 15) s *= 0.6;
  return Math.max(0.4, s);
}

/** Highest stamina the survivor can recover to right now. */
export function maxStamina(b: BodyState): number {
  let m = 100;
  if (b.fatigue > 70) m -= (b.fatigue - 70) * 1.5;
  if (b.hunger < 15) m -= 20;
  if (b.thirst < 15) m -= 25;
  if (bloodPercent(b) < 50) m -= 25;
  return Math.max(25, m);
}

// ------------------------------------------------------------------ update

/**
 * Advance the body. Returns a cause of death if the survivor died.
 */
export function updateBody(b: BodyState, realSeconds: number, gameMinutes: number, env: BodyEnvironment): string | null {
  // Nutrition. Sleeping slows hunger and thirst.
  const sleepFactor = b.asleep ? 0.5 : 1;
  const queasy = infectionStage(b) >= 1 ? 0.6 : 1;
  b.hunger = clamp(b.hunger - gameMinutes * 0.045 * sleepFactor * queasy, 0, 100);
  b.thirst = clamp(b.thirst - gameMinutes * (0.07 + env.exertion * 0.08) * sleepFactor * (b.bodyTemp > 38 ? 1.6 : 1), 0, 100);

  // Fatigue builds over ~18 hours awake and clears in ~7 hours of sleep.
  if (b.asleep) b.fatigue = clamp(b.fatigue - gameMinutes * 0.24, 0, 100);
  else b.fatigue = clamp(b.fatigue + gameMinutes * (0.09 + env.exertion * 0.05), 0, 100);

  // Stamina (real time)
  const cap = maxStamina(b);
  if (env.exertion > 0.5) b.stamina = Math.max(0, b.stamina - realSeconds * 14 * env.exertion);
  else if (b.stamina < cap) b.stamina = Math.min(cap, b.stamina + realSeconds * (env.exertion > 0 ? 6 : 11) * (pain(b) > 50 ? 0.6 : 1));
  else b.stamina = Math.max(cap, b.stamina - realSeconds * 5);

  // Wounds: bleed in real time, heal on the game clock.
  for (const w of b.wounds) {
    const prof = WOUND_PROFILE[w.kind];
    if (!w.bandaged && w.bleedRate > 0) {
      b.blood -= w.bleedRate * realSeconds;
      // Scratches clot within about a minute; deeper wounds barely slow.
      w.bleedRate *= Math.pow(prof.clots ? 0.96 : 0.9985, realSeconds);
      if (w.bleedRate < 0.05) w.bleedRate = 0;
    }
    const healRate = (w.bandaged ? 1 : 0.35) * (b.hunger > 25 && b.thirst > 25 ? 1 : 0.2) * (b.asleep ? 1.5 : 1);
    w.severity -= (gameMinutes / prof.healMinutes) * healRate;
  }
  b.wounds = b.wounds.filter((w) => w.severity > 0);

  // Blood regenerates when fed, hydrated and not bleeding.
  if (!isBleeding(b) && b.hunger > 30 && b.thirst > 30 && b.blood < FULL_BLOOD) {
    b.blood = Math.min(FULL_BLOOD, b.blood + gameMinutes * 1.6);
  }

  // Tissue health
  if (b.hunger <= 0) b.health -= gameMinutes * 0.08;
  if (b.thirst <= 0) b.health -= gameMinutes * 0.2;
  if (b.bodyTemp < 34) b.health -= gameMinutes * 0.15;
  if (b.bodyTemp > 40) b.health -= gameMinutes * 0.1;
  if (b.hunger > 40 && b.thirst > 40 && b.health < 100 && !b.infection.infected) {
    b.health = Math.min(100, b.health + gameMinutes * 0.06 * (b.asleep ? 2 : 1));
  }

  // Knox infection: incubates silently, then fever, then death.
  if (b.infection.infected) {
    b.infection.progress = Math.min(1, b.infection.progress + gameMinutes / INFECTION_MINUTES);
    if (b.infection.progress > 0.7) b.health -= gameMinutes * 0.12;
  }

  // Body temperature drifts towards an equilibrium set by air, effort and illness.
  const insulation = 0.5; // ordinary clothes; real clothing comes with Inventory 2.0
  let target = 37 + env.exertion * 0.7 - Math.max(0, 20 - env.ambientTemp) * (1 - insulation) * 0.11;
  target += Math.max(0, env.ambientTemp - 30) * 0.08;
  const stage = infectionStage(b);
  if (stage >= 2) target += stage === 2 ? 1.2 : 2.4;
  b.bodyTemp += (target - b.bodyTemp) * Math.min(1, gameMinutes * 0.01);

  // Panic follows nearby hunting zombies and fades when it's quiet.
  if (env.threats > 0) b.panic = clamp(b.panic + realSeconds * (6 + env.threats * 4), 0, 100);
  else b.panic = clamp(b.panic - realSeconds * 4, 0, 100);

  b.painkillers = Math.max(0, b.painkillers - gameMinutes);

  // Death
  if (b.blood <= FATAL_BLOOD) return "Bled out";
  if (b.health <= 0) {
    if (b.infection.infected && b.infection.progress > 0.7) return "The infection took you";
    if (b.thirst <= 0) return "Died of dehydration";
    if (b.hunger <= 0) return "Starved to death";
    if (b.bodyTemp < 34) return "Froze to death";
    return "Succumbed to your injuries";
  }
  if (b.infection.infected && b.infection.progress >= 1) return "The infection took you";
  return null;
}

// ------------------------------------------------------------------ events

/** Where a zombie's hit lands. Arms come up to defend, so they're hit most. */
function pickHitPart(rng: () => number): BodyPart {
  const r = rng();
  if (r < 0.2) return "leftArm";
  if (r < 0.42) return "rightArm";
  if (r < 0.66) return "torso";
  if (r < 0.76) return "leftLeg";
  if (r < 0.86) return "rightLeg";
  return "head";
}

/** A zombie connected. Returns the wound that was inflicted. */
export function zombieHit(b: BodyState, rng: () => number): Wound {
  const r = rng();
  const kind: WoundKind = r < 0.58 ? "scratch" : r < 0.88 ? "laceration" : "bite";
  const part = pickHitPart(rng);
  const w = addWound(b, part, kind, rng);
  if (!b.infection.infected && rng() < INFECTION_CHANCE[kind]) b.infection.infected = true;
  // Being grabbed wakes you up.
  b.asleep = false;
  b.panic = Math.min(100, b.panic + 25);
  return w;
}

export function addWound(b: BodyState, part: BodyPart, kind: WoundKind, rng: () => number): Wound {
  const prof = WOUND_PROFILE[kind];
  const w: Wound = {
    id: b.nextWoundId++,
    part,
    kind,
    severity: 1,
    bleedRate: prof.bleed * (0.7 + rng() * 0.6) * (part === "head" ? 1.3 : 1),
    bandaged: false,
  };
  b.wounds.push(w);
  b.health -= prof.trauma * (part === "head" ? 1.8 : part === "torso" ? 1.2 : 1);
  return w;
}

/** Bandage a specific wound, or the worst untreated one. Returns the wound treated. */
export function bandage(b: BodyState, woundId?: number): Wound | null {
  const candidates = b.wounds.filter((w) => !w.bandaged);
  const w =
    woundId !== undefined
      ? candidates.find((c) => c.id === woundId)
      : candidates.sort((x, y) => y.bleedRate - x.bleedRate || y.severity - x.severity)[0];
  if (!w) return null;
  w.bandaged = true;
  w.bleedRate = 0;
  return w;
}

export function eat(b: BodyState, hunger: number, thirst: number) {
  b.hunger = clamp(b.hunger + hunger, 0, 100);
  b.thirst = clamp(b.thirst + thirst, 0, 100);
}

export function heal(b: BodyState, amount: number) {
  b.health = clamp(b.health + amount, 0, 100);
}

export function takePainkillers(b: BodyState) {
  b.painkillers = 6 * 60;
}

// ------------------------------------------------------------------ moodles

/** Project Zomboid-style status indicators, most urgent first. */
export function moodles(b: BodyState): Moodle[] {
  const out: Moodle[] = [];
  const add = (id: string, label: string, level: number, detail: string) =>
    out.push({ id, label, level, tone: level >= 3 ? "danger" : "warn", detail });

  if (isBleeding(b)) {
    const rate = b.wounds.filter((w) => !w.bandaged).reduce((s, w) => s + w.bleedRate, 0);
    add("bleeding", "Bleeding", rate > 15 ? 4 : rate > 8 ? 3 : 2, "Bandage your wounds before you bleed out.");
  }
  const bp = bloodPercent(b);
  if (bp < 85) add("blood", bp < 30 ? "Critical blood loss" : bp < 60 ? "Heavy blood loss" : "Blood loss", bp < 30 ? 4 : bp < 60 ? 3 : 2, "Rest, eat and drink to recover blood.");
  const p = pain(b);
  if (p > 10) add("pain", p > 60 ? "Agony" : p > 35 ? "Pain" : "Sore", p > 60 ? 3 : p > 35 ? 2 : 1, "Pain makes your aim shaky. Painkillers help.");
  const stage = infectionStage(b);
  if (stage === 1) add("queasy", "Queasy", 1, "Your stomach is turning. You don't feel hungry.");
  if (stage === 2) add("nauseous", "Nauseous", 2, "You feel sick and feverish.");
  if (stage >= 3) add("fever", stage === 4 ? "Dying" : "High fever", stage === 4 ? 4 : 3, "Your body is burning up.");
  if (b.hunger < 35) add("hunger", b.hunger < 10 ? "Starving" : b.hunger < 20 ? "Very hungry" : "Hungry", b.hunger < 10 ? 4 : b.hunger < 20 ? 3 : 1, "Find something to eat.");
  if (b.thirst < 35) add("thirst", b.thirst < 10 ? "Dehydrated" : b.thirst < 20 ? "Parched" : "Thirsty", b.thirst < 10 ? 4 : b.thirst < 20 ? 3 : 1, "Find something to drink.");
  if (b.bodyTemp < 36.2) add("cold", b.bodyTemp < 34.5 ? "Hypothermic" : b.bodyTemp < 35.5 ? "Freezing" : "Chilly", b.bodyTemp < 34.5 ? 4 : b.bodyTemp < 35.5 ? 3 : 1, "Get indoors and stay out of the night air.");
  if (b.bodyTemp > 38 && stage < 2) add("hot", "Overheated", 2, "Slow down and drink water.");
  if (b.fatigue > 60) add("tired", b.fatigue > 90 ? "Exhausted" : b.fatigue > 75 ? "Very tired" : "Tired", b.fatigue > 90 ? 3 : b.fatigue > 75 ? 2 : 1, "Find somewhere safe to sleep (Z).");
  if (b.panic > 25) add("panic", b.panic > 75 ? "Terrified" : b.panic > 50 ? "Panicked" : "Anxious", b.panic > 75 ? 3 : b.panic > 50 ? 2 : 1, "Panic makes your hands shake.");
  if (b.painkillers > 0) out.push({ id: "painkillers", label: "Painkillers", level: 1, tone: "good", detail: "Pain dulled." });

  return out.sort((x, y) => (y.tone === "good" ? -1 : 0) - (x.tone === "good" ? -1 : 0) || y.level - x.level);
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
