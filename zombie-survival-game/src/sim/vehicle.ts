/**
 * Vehicles: what a car is, how it drives, starts, burns fuel and breaks.
 *
 * Physics is a bicycle model: engine power limited by tyre grip, aerodynamic drag, rolling
 * resistance, brakes, and steering whose lock tightens at low speed and eases off at high speed,
 * with lateral grip capping how hard you can turn (exceed it and the car slides wide). Every number
 * comes from the spec sheet of a real kind of car: mass, power, drag area, wheelbase, turning circle.
 *
 * Cars in town have sat for days: batteries run down, a few keys were left in ignitions, tanks were
 * mostly drained in the evacuation. Starting one is cranking against all that. Fuel burns on the
 * game clock, like a generator's does, because a trip across town takes twenty game minutes.
 *
 * Pure rules, no rendering: the client feeds input and draws the result.
 */

import { mulberry32 } from "./rng";

export type VehicleKind = "sedan" | "hatchback" | "pickup" | "van";

export interface VehicleSpec {
  kind: VehicleKind;
  name: string;
  massKg: number;
  /** Body size in metres. */
  length: number;
  width: number;
  height: number;
  wheelBase: number;
  wheelRadius: number;
  powerKw: number;
  /** Top speed in m/s (where the governor or gearing stops it). */
  topSpeed: number;
  reverseTop: number;
  /** Drag coefficient times frontal area, m². */
  cdA: number;
  tankL: number;
  /** Kerb-to-kerb turning radius, m. */
  turnRadius: number;
}

export const VEHICLES: Record<VehicleKind, VehicleSpec> = {
  sedan: { kind: "sedan", name: "Sedan", massKg: 1380, length: 4.6, width: 1.8, height: 1.45, wheelBase: 2.7, wheelRadius: 0.32, powerKw: 110, topSpeed: 52, reverseTop: 6, cdA: 0.66, tankL: 55, turnRadius: 5.5 },
  hatchback: { kind: "hatchback", name: "Hatchback", massKg: 1150, length: 4.0, width: 1.75, height: 1.5, wheelBase: 2.5, wheelRadius: 0.3, powerKw: 78, topSpeed: 47, reverseTop: 6, cdA: 0.68, tankL: 45, turnRadius: 5.1 },
  pickup: { kind: "pickup", name: "Pickup", massKg: 2050, length: 5.3, width: 1.9, height: 1.8, wheelBase: 3.2, wheelRadius: 0.38, powerKw: 160, topSpeed: 48, reverseTop: 6, cdA: 1.05, tankL: 80, turnRadius: 6.4 },
  van: { kind: "van", name: "Van", massKg: 2100, length: 4.9, width: 1.95, height: 2.0, wheelBase: 3.0, wheelRadius: 0.34, powerKw: 100, topSpeed: 42, reverseTop: 5, cdA: 1.25, tankL: 70, turnRadius: 5.9 },
};

export interface VehicleState {
  /** The car's id is its trunk container's id: the two are the same car. */
  id: number;
  kind: VehicleKind;
  color: string;
  x: number;
  z: number;
  /** Facing: forward is (sin yaw, cos yaw), as for the player. */
  yaw: number;
  /** Signed forward speed, m/s (negative is reversing). */
  speed: number;
  /** Smoothed steering, -1 (left) to 1 (right). */
  steer: number;
  /** Litres in the tank. */
  fuel: number;
  /** Battery charge, 0–100. Below 15 the starter only clicks. */
  battery: number;
  /** Condition 0–100 of the engine, tyres and body. */
  engine: number;
  tyres: number;
  body: number;
  running: boolean;
  keys: boolean;
  hotwired: boolean;
  headlights: boolean;
  /** 0–1, for sound and noise. */
  rpm: number;
}

export interface DriveInput {
  /** W: 0–1. Brakes when rolling backwards. */
  throttle: number;
  /** S: 0–1. Brakes when rolling forwards, reverses once stopped. */
  reverse: number;
  /** A/D: -1 (left) to 1 (right). */
  steer: number;
  handbrake: boolean;
}

export type Surface = "road" | "grass";

const G = 9.81;
const AIR = 1.2;
/** Energy in a litre of petrol, J, and how much of it a car engine turns into motion. */
const PETROL_J_PER_L = 34.2e6;
const ENGINE_EFFICIENCY = 0.25;
/** An idling engine still burns this many watts' worth of fuel. */
const IDLE_W = 3000;
/**
 * Share of peak engine power that reaches the wheels, averaged over the gears: drivetrain losses
 * (about 15%) and the engine spending most of its time off its peak (about 35%).
 */
const AT_WHEELS = 0.55;
/** Share of the car's weight on the driven wheels. */
const DRIVEN_SHARE = 0.55;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** A worn engine makes less power; a wrecked one none. */
export const engineFactor = (engine: number) => (engine <= 0 ? 0 : 0.35 + 0.65 * Math.min(100, engine) / 100);

/** Tyre grip coefficient: tarmac beats grass, worn tyres lose some of it. */
export const grip = (tyres: number, surface: Surface) => (surface === "road" ? 0.9 : 0.55) * (0.6 + 0.4 * clamp(tyres, 0, 100) / 100);

export interface StepResult {
  /** Litres burned this step. */
  fuelUsed: number;
  /** Share of full power in use. */
  power: number;
  /** The engine died this step because the tank ran dry. */
  stalled: boolean;
  /** Turning harder than the tyres can hold: the car runs wide (and squeals). */
  sliding: boolean;
  braking: boolean;
}

/**
 * Advance a car by dt real seconds. `clock` is game seconds per real second, for fuel and charging
 * (60 at the game's normal pace). Collisions are the client's job: it moves the car back out of
 * whatever it hit and calls `crash`.
 */
export function stepVehicle(v: VehicleState, spec: VehicleSpec, input: DriveInput, dt: number, surface: Surface = "road", clock = 60): StepResult {
  const out: StepResult = { fuelUsed: 0, power: 0, stalled: false, sliding: false, braking: false };
  v.steer += clamp(clamp(input.steer, -1, 1) - v.steer, -2.5 * dt, 2.5 * dt);
  const mu = grip(v.tyres, surface);
  const tractionMax = mu * spec.massKg * G * DRIVEN_SHARE;
  const running = v.running && v.fuel > 0 && v.engine > 0;
  const pMax = spec.powerKw * 1000 * engineFactor(v.engine);

  let force = 0;
  if (running) {
    if (input.throttle > 0 && v.speed > -0.5 && v.speed < spec.topSpeed) {
      out.power = input.throttle;
      force = Math.min((pMax * AT_WHEELS * input.throttle) / Math.max(Math.abs(v.speed), 2.5), tractionMax);
    } else if (input.reverse > 0 && v.speed < 0.5 && v.speed > -spec.reverseTop) {
      out.power = 0.4 * input.reverse;
      force = -Math.min((pMax * AT_WHEELS * 0.4 * input.reverse) / Math.max(Math.abs(v.speed), 2.5), tractionMax);
    }
  }
  // Pressing against the direction of travel is braking, not reversing.
  let brake = 0;
  if (input.reverse > 0 && v.speed > 0.5) brake = input.reverse;
  if (input.throttle > 0 && v.speed < -0.5) brake = input.throttle;
  out.braking = brake > 0 || (input.handbrake && Math.abs(v.speed) > 0.3);
  const brakeDecel = brake * mu * G + (input.handbrake ? 0.6 * mu * G : 0);

  const sign = Math.sign(v.speed);
  const drag = 0.5 * AIR * spec.cdA * v.speed * Math.abs(v.speed);
  const crr = (surface === "road" ? 0.015 : 0.06) + ((100 - clamp(v.tyres, 0, 100)) / 100) * 0.02;
  const rolling = Math.abs(v.speed) > 0.05 ? crr * spec.massKg * G * sign : 0;
  v.speed += ((force - drag - rolling) / spec.massKg) * dt;
  // Brakes and resistance slow the car to a stop, never push it backwards.
  const slow = brakeDecel * dt;
  if (Math.abs(v.speed) <= slow || (force === 0 && Math.abs(v.speed) < 0.05)) v.speed = 0;
  else v.speed -= Math.sign(v.speed) * slow;

  // Bicycle-model steering: full lock at walking pace, easing off with speed, capped by grip.
  const maxAngle = Math.atan(spec.wheelBase / spec.turnRadius) / (1 + Math.max(0, Math.abs(v.speed) - 5) / 15);
  let yawRate = (-v.speed / spec.wheelBase) * Math.tan(v.steer * maxAngle);
  const latMax = mu * G * (input.handbrake ? 1.25 : 1);
  if (Math.abs(v.speed * yawRate) > latMax && Math.abs(v.speed) > 0.5) {
    yawRate = (Math.sign(yawRate) * latMax) / Math.abs(v.speed);
    out.sliding = true;
  }
  v.yaw += yawRate * dt;
  v.x += Math.sin(v.yaw) * v.speed * dt;
  v.z += Math.cos(v.yaw) * v.speed * dt;

  if (running) {
    const watts = IDLE_W + out.power * pMax;
    out.fuelUsed = Math.min(v.fuel, (watts * dt * clock) / (ENGINE_EFFICIENCY * PETROL_J_PER_L));
    v.fuel -= out.fuelUsed;
    // The alternator charges the battery while the engine runs.
    v.battery = Math.min(100, v.battery + 0.02 * dt * clock);
    if (v.fuel <= 1e-6) {
      v.fuel = 0;
      v.running = false;
      out.stalled = true;
    }
  }
  v.rpm = v.running ? clamp(0.15 + 0.85 * Math.max(out.power, Math.abs(v.speed) / spec.topSpeed), 0, 1) : 0;
  return out;
}

export type StartResult = { ok: true; message: string } | { ok: false; message: string };

/** Turn the key (or touch the hotwired leads): each crank drains the battery. */
export function startEngine(v: VehicleState, rng: () => number): StartResult {
  if (v.running) return { ok: true, message: "The engine's already running." };
  if (!v.keys && !v.hotwired) return { ok: false, message: "No keys. You'll have to hotwire it." };
  if (v.battery < 15) return { ok: false, message: "The starter just clicks. The battery's dead." };
  v.battery = Math.max(0, v.battery - 4);
  if (v.fuel <= 0) return { ok: false, message: "It cranks and cranks but won't catch. The tank's empty." };
  if (v.engine < 10) return { ok: false, message: "It turns over, grinds and dies. The engine is wrecked." };
  const chance = 0.5 + 0.5 * (v.battery / 100) * (v.engine / 100);
  if (rng() > chance) return { ok: false, message: "It coughs and won't catch. Try again." };
  v.running = true;
  return { ok: true, message: "The engine catches and settles into a rough idle." };
}

/** Game minutes of fiddling under the dash to hotwire a car with a screwdriver. */
export const HOTWIRE_MINUTES = 8;

export interface CrashResult {
  /** Points taken off the body and engine. */
  body: number;
  engine: number;
  /** Health the driver loses (0 below about 30 km/h). */
  injury: number;
}

/** A hit at this closing speed (m/s): damage grows with the energy, so with speed squared. */
export function crash(v: VehicleState, impact: number): CrashResult {
  const s = Math.abs(impact);
  if (s < 2) return { body: 0, engine: 0, injury: 0 };
  const body = Math.min(100, (s - 2) ** 2 * 0.6);
  const engine = body * 0.45;
  const injury = s > 8.5 ? (s - 8.5) * 5 : 0;
  v.body = Math.max(0, v.body - body);
  v.engine = Math.max(0, v.engine - engine);
  if (v.engine <= 0) v.running = false;
  return { body, engine, injury };
}

/** Running someone down: what it does to them, and to the car. Below walking pace it's a shove. */
export function hitPedestrian(speed: number): { damage: number; carDamage: number; knockdown: boolean } {
  const s = Math.abs(speed);
  if (s < 2.5) return { damage: 0, carDamage: 0, knockdown: false };
  return { damage: s * s * 1.6, carDamage: s * 0.7, knockdown: true };
}

/** How far the engine is heard (m): a rough idle carries 20 m, a car flat out 50. */
export const engineNoise = (v: VehicleState) => (v.running ? 20 + 30 * v.rpm : 0);
export const HORN_NOISE = 75;

const KINDS: [VehicleKind, number][] = [
  ["sedan", 0.4],
  ["hatchback", 0.3],
  ["pickup", 0.15],
  ["van", 0.15],
];

/**
 * A car abandoned in town: its own seeded stream (the trunk's id), so adding cars never moves anything
 * else the town rolls.
 */
export function rollVehicle(id: number, x: number, z: number, yaw: number, color: string, fuel: number): VehicleState {
  const r = mulberry32((id * 2654435761) ^ 0x5eed);
  let k = r();
  let kind: VehicleKind = "sedan";
  for (const [kk, w] of KINDS) {
    if (k < w) {
      kind = kk;
      break;
    }
    k -= w;
  }
  const battery = r() < 0.18 ? Math.round(r() * 12) : Math.round(40 + r() * 60);
  const engine = r() < 0.1 ? Math.round(5 + r() * 25) : Math.round(45 + r() * 55);
  return {
    id,
    kind,
    color,
    x,
    z,
    yaw,
    speed: 0,
    steer: 0,
    fuel: Math.min(fuel, VEHICLES[kind].tankL),
    battery,
    engine,
    tyres: Math.round(45 + r() * 55),
    body: Math.round(50 + r() * 50),
    running: false,
    keys: r() < 0.35,
    hotwired: false,
    headlights: false,
    rpm: 0,
  };
}

const num = (v: unknown, lo: number, hi: number, dflt: number) => (typeof v === "number" && Number.isFinite(v) ? clamp(v, lo, hi) : dflt);

/** Merge a saved car over its freshly rolled self: anything missing or broken keeps the rolled value. */
export function loadVehicle(base: VehicleState, raw: unknown): VehicleState {
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<VehicleState>;
  const spec = VEHICLES[base.kind];
  return {
    ...base,
    x: num(r.x, -5000, 5000, base.x),
    z: num(r.z, -5000, 5000, base.z),
    yaw: num(r.yaw, -1e6, 1e6, base.yaw),
    fuel: num(r.fuel, 0, spec.tankL, base.fuel),
    battery: num(r.battery, 0, 100, base.battery),
    engine: num(r.engine, 0, 100, base.engine),
    tyres: num(r.tyres, 0, 100, base.tyres),
    body: num(r.body, 0, 100, base.body),
    keys: typeof r.keys === "boolean" ? r.keys : base.keys,
    hotwired: typeof r.hotwired === "boolean" ? r.hotwired : base.hotwired,
    headlights: false,
    running: false,
    speed: 0,
    steer: 0,
    rpm: 0,
  };
}

/** The parts of a car worth saving. */
export const saveVehicle = (v: VehicleState) => ({
  id: v.id,
  x: +v.x.toFixed(2),
  z: +v.z.toFixed(2),
  yaw: +v.yaw.toFixed(3),
  fuel: +v.fuel.toFixed(2),
  battery: +v.battery.toFixed(1),
  engine: +v.engine.toFixed(1),
  tyres: +v.tyres.toFixed(1),
  body: +v.body.toFixed(1),
  keys: v.keys,
  hotwired: v.hotwired,
});
