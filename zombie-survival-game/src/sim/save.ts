/**
 * The save file: everything about a run that the world seed can't rebuild.
 * Engine-agnostic and plain JSON. The town, its buildings, computers' files
 * and network layout all come back from the seed; this holds what changed.
 *
 * Versioned: `migrate` upgrades older files step by step, and `validate`
 * refuses anything malformed with a message a player can act on.
 */
import type { BarrierWorld } from "./barriers";
import type { BodyState } from "./body";
import type { ComputerPhase } from "./computer";
import type { ItemStack } from "./items";
import type { PowerWorld } from "./power";

export const SAVE_VERSION = 1;

export type Vec3 = [number, number, number];

/** Shown in the load menu without parsing the whole file. */
export interface SaveMeta {
  version: number;
  worldSeed: number;
  /** Real time it was written (ISO 8601). */
  savedAt: string;
  day: number;
  /** Minutes since midnight. */
  timeOfDay: number;
  location: string | null;
  survivedMinutes: number;
  kills: number;
  health: number;
}

export interface SavedZombie {
  seed: number;
  pos: Vec3;
  yaw: number;
  state: "idle" | "wander" | "investigate" | "chase" | "down" | "dead";
  hp: number;
  awareness: number;
  target: Vec3;
  stateTimer: number;
  lastSeen: number;
  deadTime: number;
  downTimer: number;
  breach: number | null;
  clamber: { start: Vec3; from: Vec3; to: Vec3; t: number; dur: number; peak: number; id: number } | null;
}

/** A shell session, minus its machine definition (regenerated from the seed). */
export interface SavedComputer {
  phase: ComputerPhase;
  user: string | null;
  pendingUser: string | null;
  cwd: string;
  failedLogins: number;
  /** Real milliseconds of login lockout left (lockouts use real time, which restarts with the page). */
  lockedForMs: number;
  history: string[];
  screen: string[];
  battery: number | null;
  /** Hostname of the machine an ssh session is open on, and that session. */
  remote: SavedComputer | null;
  remoteHost: string | null;
  ssh: { ip: string; host: string; user: string; stage: "hostkey" | "password"; tries: number } | null;
  knownHosts: string[];
}

export interface SaveData {
  version: number;
  worldSeed: number;
  meta: SaveMeta;
  /** Game minutes since the start of day 1. */
  minutes: number;
  /** Positions of the game's own random streams. */
  rng: { game: number };
  player: {
    pos: Vec3;
    yaw: number;
    pitch: number;
    bodyYaw: number;
    crouching: boolean;
    body: BodyState;
    inventory: ItemStack[];
    equippedUid: number | null;
    flashlight: boolean;
  };
  kills: number;
  respawnTimer: number;
  /** The next item stack uid, so new stacks never collide with loaded ones. */
  nextUid: number;
  zombies: SavedZombie[];
  /** Town containers by id: null items = never opened (rolled on first look). */
  containers: { id: number; items: ItemStack[] | null; fuel?: number }[];
  /** Piles you dropped on the ground. */
  ground: { id: number; pos: Vec3; items: ItemStack[] }[];
  computers: { id: number; state: SavedComputer }[];
  power: {
    world: PowerWorld;
    /** Where placed portable generators stand. */
    portables: { id: string; pos: Vec3 }[];
    nextGenId: number;
  };
  barriers: BarrierWorld;
}

export class SaveError extends Error {}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isVec = (v: unknown): v is Vec3 => Array.isArray(v) && v.length === 3 && v.every(isNum);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Bring an older save up to the current version. Each step takes the
 * previous version's shape to the next; there is only version 1 so far.
 */
export function migrate(raw: unknown): unknown {
  if (!isObj(raw) || !isNum(raw.version)) throw new SaveError("This file isn't a save from this game.");
  if (raw.version > SAVE_VERSION) throw new SaveError("This save comes from a newer version of the game.");
  // Future: if (raw.version === 1) raw = v1to2(raw); ...
  return raw;
}

/** Check the shape of a (migrated) save. Throws SaveError naming what's wrong. */
export function validate(raw: unknown, worldSeed: number): SaveData {
  const bad = (what: string): never => {
    throw new SaveError(`This save is damaged (${what}) and can't be loaded.`);
  };
  if (!isObj(raw)) return bad("not an object");
  if (raw.version !== SAVE_VERSION) bad("wrong version");
  if (raw.worldSeed !== worldSeed) throw new SaveError("This save belongs to a different world.");
  if (!isNum(raw.minutes) || raw.minutes < 0) bad("clock");
  if (!isObj(raw.rng) || !isNum(raw.rng.game)) bad("random state");
  const p = raw.player;
  if (!isObj(p) || !isVec(p.pos) || !isNum(p.yaw) || !isObj(p.body) || !Array.isArray(p.inventory)) bad("player");
  const body = (p as Record<string, unknown>).body as Record<string, unknown>;
  if (!isNum(body.blood) || !isNum(body.health) || !Array.isArray(body.wounds) || !isObj(body.infection)) bad("body");
  for (const s of (p as { inventory: unknown[] }).inventory) {
    if (!isObj(s) || !isNum(s.uid) || typeof s.id !== "string" || !isNum(s.count)) bad("inventory");
  }
  if (!isNum(raw.nextUid)) bad("item counter");
  if (!Array.isArray(raw.zombies)) bad("zombies");
  for (const z of raw.zombies as unknown[]) {
    if (!isObj(z) || !isNum(z.seed) || !isVec(z.pos) || typeof z.state !== "string" || !isNum(z.hp)) bad("zombie");
  }
  if (!Array.isArray(raw.containers) || !Array.isArray(raw.ground) || !Array.isArray(raw.computers)) bad("world objects");
  const power = raw.power;
  if (!isObj(power) || !isObj(power.world) || !Array.isArray(power.portables) || !isNum(power.nextGenId)) bad("power");
  const pw = (power as Record<string, unknown>).world as Record<string, unknown>;
  if (!isNum(pw.gridFailsAt) || !isObj(pw.circuits) || !Array.isArray(pw.generators)) bad("power");
  if (!isObj(raw.barriers) || !Array.isArray(raw.barriers.barriers)) bad("doors and windows");
  return raw as unknown as SaveData;
}

/** Text for storage. */
export function serialise(data: SaveData): string {
  return JSON.stringify(data);
}

/** Parse, migrate and validate stored text. */
export function deserialise(text: string, worldSeed: number): SaveData {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SaveError("This save is damaged (not readable) and can't be loaded.");
  }
  return validate(migrate(raw), worldSeed);
}

/** Keep the last lines of a terminal so a save doesn't carry thousands of them. */
export const trimScreen = (lines: string[], keep = 200) => (lines.length > keep ? lines.slice(-keep) : lines.slice());
