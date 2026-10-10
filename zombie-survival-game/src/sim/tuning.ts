/**
 * Every gameplay number in one place, with the reasoning behind it.
 * Engine-agnostic. Design targets are enforced by tuning.test.ts, so a change
 * here that breaks the intended feel fails the tests.
 *
 * Reference speeds (real humans): walk 1.4 m/s, jog 2.7–3.3 m/s, sprint 6–7 m/s
 * (untrained adult, short burst). Crouch-walking ~1 m/s.
 */

// ------------------------------------------------------------------ movement

export const MOVE = {
  /** Holding Alt: careful walking, nearly silent. */
  walk: 1.4,
  /** Default pace, like DayZ's jog. */
  jog: 3.1,
  sprint: 6.0,
  crouch: 1.15,
  /** Max speed while aiming down sights. */
  aim: 1.7,
  /** Moving backwards or sideways is slower than forwards. */
  backwardFactor: 0.65,
  strafeFactor: 0.85,
  /** m/s² — reaching full sprint takes about 0.7 s, stopping about 0.4 s. */
  accel: 9,
  decel: 14,
  overweightFactor: 0.65,
  jumpVelocity: 4.6,
  gravity: 16,
} as const;

/** Radius (m) zombies hear footsteps from, by gait. */
export const FOOTSTEPS = {
  still: 0,
  crouch: 1.5,
  walk: 3,
  jog: 7,
  sprint: 16,
  landing: 8,
} as const;

// ------------------------------------------------------------------ stamina

export const STAMINA = {
  /** Per second while sprinting: full bar ≈ 11 s of sprint. */
  sprintDrain: 9,
  jumpCost: 10,
  /** Per second, after the recovery delay. */
  regenIdle: 12,
  regenMoving: 7,
  /** Seconds after exertion before stamina starts coming back. */
  regenDelay: 1.2,
  /** Hitting zero leaves you winded: no sprinting or jumping until this much returns. */
  windedRecoverAt: 30,
} as const;

// ------------------------------------------------------------------ zombies

export const ZOMBIE = {
  hp: 100,
  radius: 0.35,
  wanderSpeed: [0.5, 0.95] as const,
  investigateSpeed: 1.25,
  /** Most chase slower than your jog, so you can get away from a single walker... */
  chaseSpeed: [2.0, 2.9] as const,
  /** ...but about one in eight are runners that only a sprint escapes. */
  runnerChance: 0.12,
  runnerSpeed: [4.2, 4.9] as const,
  /** Last stretch before an attack is a lunge. */
  lungeRange: 2.2,
  lungeFactor: 1.35,
  attackRange: 1.15,
  attackWindup: 0.55,
  attackRecovery: 0.6,
  /** At most this many can claw at you at once; the rest crowd behind. */
  maxAttackers: 3,
  /** Seconds a knocked-down zombie stays down. */
  downTime: [2.0, 3.2] as const,
  /** Gives up the chase after this long without seeing or hearing you. */
  loseTrackAfter: 6,
  /** How far ahead it predicts where you went when it loses you (seconds of your velocity). */
  predictSeconds: 2,
} as const;

export const SENSES = {
  /** Sight range in full daylight / dead of night (m). A flashlight at night lifts it. */
  sightDay: 35,
  sightNight: 9,
  sightFlashlight: 32,
  crouchSightFactor: 0.55,
  /** Inside this range a zombie senses you no matter what (smell, touch). */
  instantRange: 2.5,
  /** Cosine of the half-angle of the main view cone (~75° each side). */
  coneCos: 0.25,
  /** Peripheral vision catches movement up close, weakly. */
  peripheralRange: 12,
  peripheralFactor: 0.35,
  /** Awareness gained per second at point blank / at the edge of sight range. */
  rateNear: 3.2,
  rateFar: 0.28,
  movingFactor: 1.6,
  sprintingFactor: 2.2,
  crouchFactor: 0.5,
  /** Awareness lost per second when it can't see you. */
  decay: 0.3,
  /** Above this it stops and turns towards what it noticed. */
  suspicious: 0.35,
  /** Gunshots are heard this far away (m). */
  gunshotRadius: 60,
  /** Hearing a noise adds this much awareness. */
  heardBoost: 0.45,
} as const;

/**
 * How fast (per second) a zombie's awareness of the player builds from sight.
 * Returns 0 when it can't see the player at all.
 */
export function sightRate(opts: {
  distance: number;
  visibility: number;
  /** Cosine of the angle between where the zombie faces and the player. */
  facingCos: number;
  lineOfSight: boolean;
  moving: boolean;
  sprinting: boolean;
  crouching: boolean;
}): number {
  const { distance: d, visibility } = opts;
  if (!opts.lineOfSight) return 0;
  if (d <= SENSES.instantRange) return Infinity;
  if (d > visibility) return 0;
  let cone = 1;
  if (opts.facingCos < SENSES.coneCos) {
    if (d > SENSES.peripheralRange || opts.facingCos < -0.3 || !opts.moving) return 0;
    cone = SENSES.peripheralFactor;
  }
  const t = 1 - d / visibility;
  let rate = SENSES.rateFar + (SENSES.rateNear - SENSES.rateFar) * t * t;
  if (opts.sprinting) rate *= SENSES.sprintingFactor;
  else if (opts.moving) rate *= SENSES.movingFactor;
  if (opts.crouching) rate *= SENSES.crouchFactor;
  return rate * cone;
}

/** Sight range right now given light and stance. */
export function visibilityRange(daylight: number, flashlightOn: boolean, crouching: boolean): number {
  let v = SENSES.sightNight + (SENSES.sightDay - SENSES.sightNight) * daylight;
  if (flashlightOn && daylight < 0.5) v = Math.max(v, SENSES.sightFlashlight);
  if (crouching) v *= SENSES.crouchSightFactor;
  return v;
}

// -------------------------------------------------------------------- combat

export const MELEE = {
  /** Fraction of the swing during which it can connect. */
  activeFrom: 0.3,
  activeTo: 0.62,
  /** Cosine of the hit arc half-angle (~60°). */
  arcCos: 0.5,
  critChance: 0.12,
  critMultiplier: 2.2,
  /** Attacks on a zombie lying on the ground. */
  downedMultiplier: 2,
  /** Brief freeze on impact so hits feel solid. */
  hitStop: 0.06,
} as const;

export const FIREARM = {
  /** Base cone (radians) from the hip and when fully aimed. */
  hipSpread: 0.05,
  aimSpread: 0.004,
  /** Extra spread while moving, per m/s. */
  moveSpreadPerMps: 0.008,
  /** Camera kick per shot (radians) and how much of it springs back. */
  recoilPitch: 0.035,
  recoilYaw: 0.01,
  recoilReturn: 0.75,
  recoilRecoverPerSec: 7,
  headshotDamage: 200,
  legDamageFactor: 0.65,
} as const;

/** Damage from one melee hit. */
export function meleeDamage(base: number, strength: number, crit: boolean, targetDown: boolean): number {
  return base * strength * (crit ? MELEE.critMultiplier : 1) * (targetDown ? MELEE.downedMultiplier : 1);
}

/** Bullet spread cone for a shot (radians). aimProgress is 0 (hip) → 1 (fully aimed). */
export function shotSpread(aimProgress: number, speed: number, sway: number): number {
  const base = FIREARM.hipSpread + (FIREARM.aimSpread - FIREARM.hipSpread) * aimProgress;
  const moving = speed * FIREARM.moveSpreadPerMps * (1 - 0.6 * aimProgress);
  return (base + moving) * sway;
}

// ------------------------------------------------- doors, windows, barricades

/**
 * Barriers soak damage into one accumulator against a strength. Zombies land
 * one blow per attack cycle (windup + recovery = 1.15 s), about 7 damage per
 * second each, so the numbers below read directly as "seconds of pounding".
 */
export const BARRIER = {
  /** Damage per zombie blow. */
  zombieDamage: 8,
  /** Each zombie needs this much of the barrier's width to swing at it. */
  slotWidth: 0.6,
  maxSlots: 3,
  /** A zombie engages a barrier its feeler hits within radius + this (m). */
  engageReach: 0.6,
  /** Unarmed against a barrier you kick it. */
  kickDamage: 22,
  /** Your weapon's damage times this, by what you're hitting. Steel shrugs off hand tools. */
  playerFactor: { wood: 1, glass: 1, steel: 0.05 },
  /** A blow this close to a sleeping player wakes them. */
  wakeRadius: 12,
} as const;

/**
 * A closed door holds until damage reaches the weaker of its leaf and what
 * keeps it shut. Leaf: a hollow-core interior door caves in fast; a solid
 * exterior door outlasts its latch; steel is effectively unbreakable by hand.
 * Hold: a spring latch tears out of the jamb long before a deadbolt; a 1200 lbf
 * maglock and a heavy-duty strike are stronger still.
 */
export const DOOR = {
  leaf: { hollow: 120, solid: 1400, glass: 260, steel: 3000 },
  hold: { latch: 300, deadbolt: 900, maglock: 1500, strike: 2400 },
  swingSeconds: 0.7,
  /** Radians the leaf swings when opened (95°), and where a burst one ends up hanging. */
  openAngle: 1.66,
  burstAngle: 1.75,
  burstTilt: 0.1,
  /** Turning the thumbturn before opening. */
  unboltSeconds: 0.3,
} as const;

export const WINDOW = {
  /** Annealed 3–4 mm house pane; 6 mm shop plate glass. Three blows break a pane. */
  glassHp: { pane: 20, display: 50 },
  /** Climbing through: 1.0 m sill → 2.0 s, a 0.5 m shop sill → 1.55 s. */
  vaultBase: 1.1,
  vaultPerMetre: 0.9,
  /** Zombies are clumsy: 3.0 s over a house sill, 2.3 s over a shop sill. */
  zombieClimbBase: 1.6,
  zombieClimbPerMetre: 1.4,
  zombiesClimb: true,
  breakSeconds: 0.4,
  clearSeconds: 2.0,
  /** Chance of a laceration climbing over shards you didn't clear. */
  cutChance: 0.4,
  /** Landing spots tried past the wall centre line (m). */
  landing: [0.6, 0.9] as const,
} as const;

export const BARRICADE = {
  maxBoards: { door: 4, window: 3 },
  /** Planks per board = ceil(opening width / plank length). */
  plankLength: 2.4,
  nailsPerPlank: 4,
  secondsPerPlank: 8,
  /** A hammer blow (and its noise) every this many seconds while boarding. */
  hammerInterval: 0.5,
  boardHp: 300,
  prySeconds: 4,
  /** Boards that stop you seeing through. */
  occludeAt: { door: 4, window: 3 },
} as const;

/**
 * Noise radius (m) of barrier sounds. For scale: crouching 1.5, jogging 7,
 * sprinting 16, a generator 30–40, a gunshot 60.
 */
export const BARRIER_NOISE = {
  doorOpen: 2,
  doorClose: 3,
  bolt: 2,
  keypad: 1.5,
  lockClunk: 3,
  climb: 4,
  pry: 6,
  clearGlass: 6,
  glassHit: 8,
  boardTear: 12,
  woodHit: 14,
  steelHit: 16,
  hammer: 18,
  glassBreak: 20,
  burst: 22,
} as const;

/**
 * Extra path cost (in 0.25 m cells) of crossing a barrier, charged once on a
 * one-cell strip. Zombies prefer an open way round unless it is much longer.
 */
export const NAV_COST = { closedDoor: 12, pushDoor: 2, intactWindow: 24, brokenWindow: 8, perBoard: 4, max: 40 } as const;

export const ACCESS = {
  /** A good keypad code or `door pulse` releases the lock this long (s). */
  pulseSeconds: 6,
  keypadMaxTries: 5,
  keypadLockoutSec: 60,
} as const;

/** How doors and windows were left when everyone fled. */
export const BARRIER_START = {
  houseFront: { open: 0.1, latched: 0.5, bolted: 0.4 },
  interior: { open: 0.65 },
  shopfront: { broken: 0.15, latched: 0.25, bolted: 0.6 },
  windowBroken: { pane: 0.06, display: 0.3 },
  /** Some residents boarded windows from inside before leaving. */
  houseWindowPreBoarded: 0.05,
  preBoards: 2,
} as const;
