/**
 * Doors, windows and barricades. Engine-agnostic and serialisable.
 *
 * Every opening in the town is a Barrier: a door (leaf + latch, deadbolt or
 * electric lock) or a window (a pane of glass). Boards can be nailed over
 * either, on one side. A barrier is a stack of layers that are broken in the
 * order a real attacker meets them:
 *
 *   boards on the striker's side → the core (glass or the closed door) → boards on the far side
 *
 * A door holds until the damage on its core reaches the weaker of the leaf and
 * what keeps it shut (latch, deadbolt, maglock or strike), then bursts off its
 * hinges for good.
 *
 * Sides: +1 is the side the spec normal points to (the street for exterior
 * walls, the main room for partitions); -1 is the protected room, where the
 * thumbturn, the push-to-exit button and the lever are.
 */
import type { BodyPart } from "./body";
import { ACCESS, BARRICADE, BARRIER, BARRIER_NOISE, BARRIER_START, DOOR, NAV_COST, WINDOW } from "./tuning";

export type BarrierKind = "door" | "window";
export type DoorBuild = "hollow" | "solid" | "glass" | "steel";
export type WindowBuild = "pane" | "display";
export type BarrierRole = "house-front" | "interior" | "shopfront" | "police-front" | "armory" | "window";
/** +1 = the spec normal's side (street / main room); -1 = the protected room (thumbturn, egress, default board side). */
export type Side = 1 | -1;
/** maglock fails safe (releases without power); strike fails secure (stays locked). */
export type LockMode = "maglock" | "strike";
export type ZombieAccess = "passable" | "pushable" | "climbable" | "blocking";
export type HitMaterial = "wood" | "glass" | "steel";

export interface BarrierSeed {
  kind: BarrierKind;
  build: DoorBuild | WindowBuild;
  role: BarrierRole;
  width: number;
  /** Sill height; 0 for doors. */
  sill: number;
  /** The side the leaf swings away from (where you push it open). */
  pushSide: Side;
  electronic?: { controller: string; name: string; mode: LockMode; pin: string | null };
  /** Only houses start with windows boarded from inside. */
  house?: boolean;
}

export interface Board {
  hp: number;
}

export interface ElectronicLock {
  controller: string;
  name: string;
  mode: LockMode;
  /** What the controller was last told; restored when power comes back. */
  commanded: "locked" | "unlocked";
  /** Controller power (mains, UPS or generator). */
  powered: boolean;
  /** Seconds left of a momentary release (keypad code or `door pulse`). */
  pulseLeft: number;
  pin: string | null;
  wrongTries: number;
  lockoutLeft: number;
}

export interface Barrier {
  /** Equals its index in the world and its BarrierSpec id. */
  id: number;
  kind: BarrierKind;
  build: DoorBuild | WindowBuild;
  role: BarrierRole;
  width: number;
  sill: number;
  pushSide: Side;
  /** Door leaf swung open (the angle is client-only). */
  open: boolean;
  /** Spring latch (maglock doors have none: the magnet holds them). */
  latch: boolean;
  /** Deadbolt thrown (thumbturn on side -1). */
  bolted: boolean;
  electronic: ElectronicLock | null;
  /** "none" for wood and steel doors. */
  glass: "intact" | "broken" | "cleared" | "none";
  /** Damage on the core (door or glass). */
  damage: number;
  /** Burst: permanently open, can't be closed or locked again. */
  broken: boolean;
  boards: Board[];
  boardSide: Side;
}

export interface BarrierWorld {
  barriers: Barrier[];
}

export interface HitResult {
  layer: "board" | "glass" | "door" | "none";
  boardTorn: boolean;
  glassBroke: boolean;
  burst: boolean;
  /** A latchless door struck from the side it swings away from just swings open. */
  opened: boolean;
  /** Radius in metres zombies hear this blow from. */
  noise: number;
}

// --------------------------------------------------------------------- setup

function blank(seed: BarrierSeed, id: number): Barrier {
  const e = seed.electronic;
  return {
    id,
    kind: seed.kind,
    build: seed.build,
    role: seed.role,
    width: seed.width,
    sill: seed.sill,
    pushSide: seed.pushSide,
    open: false,
    // Maglock doors have no latch; every other door does.
    latch: seed.kind === "door" && e?.mode !== "maglock",
    bolted: false,
    electronic: e
      ? { controller: e.controller, name: e.name, mode: e.mode, commanded: "locked", powered: true, pulseLeft: 0, pin: e.pin, wrongTries: 0, lockoutLeft: 0 }
      : null,
    glass: seed.kind === "window" || seed.build === "glass" ? "intact" : "none",
    damage: 0,
    broken: false,
    boards: [],
    boardSide: -1,
  };
}

/**
 * The town as people left it. Draws exactly two numbers per barrier, so a
 * change to one probability never reshuffles the others.
 */
export function createBarrierWorld(seeds: readonly BarrierSeed[], rng: () => number): BarrierWorld {
  const barriers = seeds.map((seed, id) => {
    const b = blank(seed, id);
    const r1 = rng();
    const r2 = rng();
    switch (seed.role) {
      case "house-front": {
        const s = BARRIER_START.houseFront;
        if (r1 < s.open) b.open = true;
        else if (r1 >= s.open + s.latched) b.bolted = true;
        break;
      }
      case "interior":
        b.open = r1 < BARRIER_START.interior.open;
        break;
      case "shopfront": {
        const s = BARRIER_START.shopfront;
        if (r1 < s.broken) {
          b.broken = b.open = true;
          if (b.glass !== "none") b.glass = "broken";
        } else if (r1 >= s.broken + s.latched) b.bolted = true;
        break;
      }
      case "police-front":
        // "Left open for returning units": the maglock is commanded unlocked.
        if (b.electronic) b.electronic.commanded = "unlocked";
        break;
      case "armory":
        break;
      case "window":
        if (r1 < BARRIER_START.windowBroken[seed.build as WindowBuild]) b.glass = "broken";
        if (seed.house && r2 < BARRIER_START.houseWindowPreBoarded) {
          for (let i = 0; i < BARRIER_START.preBoards; i++) b.boards.push({ hp: BARRICADE.boardHp });
          b.boardSide = -1;
        }
        break;
    }
    return b;
  });
  return { barriers };
}

// ------------------------------------------------------ strength and access

/** Whether the electric lock is holding right now. */
export function effectiveLocked(b: Barrier): boolean {
  const e = b.electronic;
  if (!e) return false;
  if (!e.powered) return e.mode === "strike";
  return e.commanded === "locked" && e.pulseLeft <= 0;
}

/** What keeps a closed door shut, as seen from one side. */
function hold(b: Barrier, from: Side): number {
  const e = b.electronic;
  if (e && effectiveLocked(b)) return DOOR.hold[e.mode];
  if (b.bolted) return DOOR.hold.deadbolt;
  if (b.latch) return DOOR.hold.latch;
  // No latch: it swings open from the push side; the stop holds it from the other.
  return from === b.pushSide ? 0 : DOOR.hold.latch;
}

/** Damage the core takes before it gives: glass for a window, the closed door otherwise. */
export function coreStrength(b: Barrier, from: Side): number {
  if (b.kind === "window") return b.glass === "intact" ? WINDOW.glassHp[b.build as WindowBuild] : 0;
  if (b.broken || b.open) return 0;
  return Math.min(DOOR.leaf[b.build as DoorBuild], hold(b, from));
}

/** How a zombie arriving from one side gets past (zombies never use handles). */
export function zombieAccess(b: Barrier, from: Side): ZombieAccess {
  if (b.kind === "window") return b.boards.length || b.glass === "intact" ? "blocking" : "climbable";
  if (b.boards.length) return "blocking";
  if (b.broken || b.open) return "passable";
  return !b.latch && !b.bolted && !effectiveLocked(b) && from === b.pushSide ? "pushable" : "blocking";
}

/** The barrier's collider stops bodies: a closed or boarded door, and every window (crossing is a climb). */
export function colliderEnabled(b: Barrier): boolean {
  return b.kind === "window" || !b.open || b.boards.length > 0;
}

/** Blocks sight: a closed solid door, or enough boards. */
export function occludes(b: Barrier): boolean {
  if (b.boards.length >= BARRICADE.occludeAt[b.kind]) return true;
  return b.kind === "door" && !b.open && !b.broken && b.build !== "glass";
}

/** Extra path cost of crossing this barrier, in nav cells. */
export function navCost(b: Barrier): number {
  let cost: number;
  if (b.kind === "window") cost = b.glass === "intact" ? NAV_COST.intactWindow : NAV_COST.brokenWindow;
  else if (b.open || b.broken) cost = 0;
  else cost = !b.latch && !b.bolted && !effectiveLocked(b) ? NAV_COST.pushDoor : NAV_COST.closedDoor;
  return Math.min(NAV_COST.max, cost + b.boards.length * NAV_COST.perBoard);
}

/** How many zombies can pound on it at once. */
export function attackSlots(b: Barrier): number {
  return Math.max(1, Math.min(BARRIER.maxSlots, Math.floor(b.width / BARRIER.slotWidth)));
}

/**
 * 0..1 for the HUD: the weakest of the boards and what's behind them. A
 * barrier that no longer stops anything reads 0.
 */
export function integrity(b: Barrier): number {
  let worst = 1;
  for (const board of b.boards) worst = Math.min(worst, board.hp / BARRICADE.boardHp);
  const core = Math.max(coreStrength(b, 1), coreStrength(b, -1));
  if (core > 0) worst = Math.min(worst, 1 - b.damage / core);
  else if (!b.boards.length) worst = 0;
  return Math.max(0, worst);
}

export function integrityLabel(b: Barrier): "Holding" | "Cracked" | "Splintering" {
  const i = integrity(b);
  return i > 0.66 ? "Holding" : i > 0.33 ? "Cracked" : "Splintering";
}

// --------------------------------------------------------------- door actions

/** Open a door from one side. Returns why not, or null. A bolted door opened from inside is unbolted first. */
export function openDoor(b: Barrier, side: Side): string | null {
  if (b.kind !== "door") return "It's a window.";
  if (b.broken) return "Smashed off its hinges.";
  if (b.boards.length) return "It's boarded up.";
  if (b.open) return null;
  if (side === 1 && (b.bolted || effectiveLocked(b))) return "Locked.";
  // From the secure side you always get out: thumbturn, lever or push-to-exit button.
  b.bolted = false;
  b.open = true;
  return null;
}

export function closeDoor(b: Barrier): string | null {
  if (b.kind !== "door") return "It's a window.";
  if (b.broken) return "Smashed off its hinges.";
  b.open = false;
  return null;
}

/** Throw or draw the deadbolt. Only solid and glass doors have one, worked from the thumbturn side. */
export function toggleBolt(b: Barrier, side: Side): string | null {
  if (b.kind !== "door" || (b.build !== "solid" && b.build !== "glass")) return "There's no deadbolt.";
  if (b.broken) return "Smashed off its hinges.";
  if (b.open) return "Close it first.";
  if (side !== -1) return "The deadbolt needs a key from this side.";
  b.bolted = !b.bolted;
  return null;
}

/** A zombie leaning on a latchless door from the side it swings away from. */
export function pushOpen(b: Barrier, from: Side): boolean {
  if (zombieAccess(b, from) !== "pushable") return false;
  b.open = true;
  return true;
}

// --------------------------------------------------------------------- damage

/** Which board on a side takes the next blow: the last one nailed (outermost). */
function boardOn(b: Barrier, side: Side): Board | null {
  return b.boards.length && b.boardSide === side ? b.boards[b.boards.length - 1] : null;
}

/** What a blow from this side lands on, for weapon effectiveness and sound. */
export function struckMaterial(b: Barrier, from: Side): HitMaterial | null {
  if (boardOn(b, from)) return "wood";
  if (b.kind === "window") return b.glass === "intact" ? "glass" : b.boards.length ? "wood" : null;
  if (!b.open && !b.broken) return b.build === "steel" ? "steel" : b.build === "glass" ? "glass" : "wood";
  return b.boards.length ? "wood" : null;
}

function hitBoard(b: Barrier, board: Board, dmg: number, r: HitResult): HitResult {
  board.hp -= dmg;
  r.layer = "board";
  r.noise = BARRIER_NOISE.woodHit;
  if (board.hp <= 0) {
    b.boards.pop();
    r.boardTorn = true;
    r.noise = Math.max(BARRIER_NOISE.woodHit, BARRIER_NOISE.boardTear);
  }
  return r;
}

/** One blow from a side. Damage does not carry over from one layer to the next. */
export function hitBarrier(b: Barrier, dmg: number, from: Side): HitResult {
  const r: HitResult = { layer: "none", boardTorn: false, glassBroke: false, burst: false, opened: false, noise: 0 };
  const near = boardOn(b, from);
  if (near) return hitBoard(b, near, dmg, r);

  if (b.kind === "window" && b.glass === "intact") {
    r.layer = "glass";
    b.damage += dmg;
    r.noise = BARRIER_NOISE.glassHit;
    if (b.damage >= WINDOW.glassHp[b.build as WindowBuild]) {
      b.glass = "broken";
      b.damage = 0;
      r.glassBroke = true;
      r.noise = BARRIER_NOISE.glassBreak;
    }
    return r;
  }

  if (b.kind === "door" && !b.open && !b.broken) {
    r.layer = "door";
    const strength = coreStrength(b, from);
    if (strength <= 0) {
      // Nothing holds it from this side: the blow swings it open, unless boards across the far side hold the leaf.
      const far = b.boards.length ? b.boards[b.boards.length - 1] : null;
      if (far) return hitBoard(b, far, dmg, r);
      b.open = true;
      r.opened = true;
      r.noise = BARRIER_NOISE.doorOpen;
      return r;
    }
    b.damage += dmg;
    r.noise = b.build === "steel" ? BARRIER_NOISE.steelHit : b.build === "glass" ? BARRIER_NOISE.glassHit : BARRIER_NOISE.woodHit;
    if (b.damage >= strength) {
      b.broken = b.open = true;
      b.bolted = false;
      if (b.glass === "intact") b.glass = "broken";
      r.burst = true;
      r.noise = BARRIER_NOISE.burst;
    }
    return r;
  }

  // The core is gone: whatever was nailed on the far side takes it.
  const far = b.boards.length ? b.boards[b.boards.length - 1] : null;
  return far ? hitBoard(b, far, dmg, r) : r;
}

// -------------------------------------------------------------------- windows

export function breakGlass(b: Barrier): boolean {
  if (b.glass !== "intact") return false;
  b.glass = "broken";
  b.damage = 0;
  return true;
}

/** Knock the shards out of the frame so climbing through is safe. */
export function clearGlass(b: Barrier): boolean {
  if (b.glass !== "broken" || b.kind !== "window") return false;
  b.glass = "cleared";
  return true;
}

/** Climbing over shards: maybe a laceration, mostly on the arms you lean on. */
export function climbCut(b: Barrier, rng: () => number): BodyPart | null {
  if (b.kind !== "window" || b.glass !== "broken") return null;
  if (rng() >= WINDOW.cutChance) return null;
  const arm = rng() < 0.7;
  const left = rng() < 0.5;
  return arm ? (left ? "leftArm" : "rightArm") : left ? "leftLeg" : "rightLeg";
}

export const vaultSeconds = (b: Barrier) => WINDOW.vaultBase + WINDOW.vaultPerMetre * b.sill;
export const zombieClimbSeconds = (b: Barrier) => WINDOW.zombieClimbBase + WINDOW.zombieClimbPerMetre * b.sill;

// --------------------------------------------------------------------- boards

/** Materials and time for one board (a wide shop window needs two planks per board). */
export function boardCost(b: Barrier): { planks: number; nails: number; seconds: number } {
  const planks = Math.ceil(b.width / BARRICADE.plankLength - 1e-9);
  return { planks, nails: planks * BARRICADE.nailsPerPlank, seconds: planks * BARRICADE.secondsPerPlank };
}

export function canBoard(b: Barrier, side: Side): string | null {
  if (b.kind === "door" && b.open && !b.broken) return "Close it first.";
  if (b.boards.length >= BARRICADE.maxBoards[b.kind]) return "It can't take any more boards.";
  if (b.boards.length && b.boardSide !== side) return "The boards are on the other side.";
  return null;
}

export function addBoard(b: Barrier, side: Side): boolean {
  if (canBoard(b, side)) return false;
  b.boards.push({ hp: BARRICADE.boardHp });
  b.boardSide = side;
  return true;
}

/** Pry the outermost board off from the side it's nailed on. The plank comes back; the nails are bent. */
export function removeBoard(b: Barrier, side: Side): { planks: number } | null {
  if (!b.boards.length || b.boardSide !== side) return null;
  b.boards.pop();
  return { planks: boardCost(b).planks };
}

// ----------------------------------------------------------- electronic locks

/** Controller power changed. Reports a lock that just let go or bit. */
export function setLockPower(b: Barrier, powered: boolean): "released" | "engaged" | null {
  const e = b.electronic;
  if (!e || e.powered === powered) return null;
  const before = effectiveLocked(b);
  e.powered = powered;
  if (!powered) e.pulseLeft = 0;
  const after = effectiveLocked(b);
  return before && !after ? "released" : !before && after ? "engaged" : null;
}

/** A command from the controller's console. Returns a status line. */
export function lockCommand(b: Barrier, action: "lock" | "unlock" | "pulse"): string {
  const e = b.electronic;
  if (!e) return "no electric lock";
  if (!e.powered) return "no response";
  if (action === "pulse") {
    e.pulseLeft = ACCESS.pulseSeconds;
    return `released for ${ACCESS.pulseSeconds} s`;
  }
  e.commanded = action === "lock" ? "locked" : "unlocked";
  e.pulseLeft = 0;
  if (action === "lock" && b.open) return "will lock when closed";
  return e.commanded;
}

export function keypadEnter(b: Barrier, code: string): "granted" | "denied" | "lockout" | "dark" {
  const e = b.electronic;
  if (!e || !e.powered) return "dark";
  if (e.lockoutLeft > 0) return "lockout";
  if (e.pin !== null && code === e.pin) {
    e.wrongTries = 0;
    e.pulseLeft = ACCESS.pulseSeconds;
    return "granted";
  }
  e.wrongTries++;
  if (e.wrongTries >= ACCESS.keypadMaxTries) {
    e.wrongTries = 0;
    e.lockoutLeft = ACCESS.keypadLockoutSec;
    return "lockout";
  }
  return "denied";
}

/** Count down pulses and keypad lockouts (real seconds). Returns true if the lock state changed. */
export function tickBarrier(b: Barrier, dt: number): boolean {
  const e = b.electronic;
  if (!e || (e.pulseLeft <= 0 && e.lockoutLeft <= 0)) return false;
  const before = effectiveLocked(b);
  e.pulseLeft = Math.max(0, e.pulseLeft - dt);
  e.lockoutLeft = Math.max(0, e.lockoutLeft - dt);
  return effectiveLocked(b) !== before;
}

/** One door as its controller reports it. */
export function accessRow(b: Barrier): { name: string; mode: LockMode; commanded: "locked" | "unlocked"; locked: boolean; open: boolean } | null {
  const e = b.electronic;
  if (!e) return null;
  return { name: e.name, mode: e.mode, commanded: e.commanded, locked: effectiveLocked(b), open: b.open };
}
