/**
 * Vehicles: what a car is, how it drives, starts, burns fuel, wears, breaks and gets fixed.
 *
 * Physics is a bicycle model: engine power limited by tyre grip, aerodynamic drag, rolling
 * resistance, brakes, and steering whose lock eases off at speed, with lateral grip capping how hard
 * you can turn (exceed it and the car slides wide). Every number comes from a real kind of car.
 *
 * A car is its parts. Four tyres (a flat one drags, pulls the wheel and caps your speed; a missing
 * one leaves you crawling on the rim), a battery (every crank drains it, headlights flatten it, the
 * alternator refills it), an engine (worn ones make less power; overheat it and it wears fast), a
 * radiator and its coolant (a holed radiator leaks, low coolant overheats the engine; water will do
 * in a pinch), a fuel tank (a holed one leaks, parked or not), windows (all that stands between you
 * and the dead once they reach the car) and lights.
 *
 * Cars in town have sat for days: batteries run down, most tanks were drained in the evacuation, a
 * third have keys in the ignition, about half the rest are locked, and some of those have alarms.
 * Keys for some turn up in houses, matched to the car by its plate.
 *
 * Fuel, charge, heat and leaks run on the game clock, like a generator's, because a trip across town
 * takes twenty game minutes. Pure rules, no rendering.
 */

import { mulberry32 } from "./rng";
import { makeStack, type ItemStack } from "./items";

export type VehicleKind = "sedan" | "hatchback" | "pickup" | "van" | "police";

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
  /** What the trunk or load bed holds, kg. */
  trunkKg: number;
}

const SEDAN: VehicleSpec = { kind: "sedan", name: "Sedan", massKg: 1380, length: 4.6, width: 1.8, height: 1.45, wheelBase: 2.7, wheelRadius: 0.32, powerKw: 110, topSpeed: 52, reverseTop: 6, cdA: 0.66, tankL: 55, turnRadius: 5.5, trunkKg: 70 };

export const VEHICLES: Record<VehicleKind, VehicleSpec> = {
  sedan: SEDAN,
  hatchback: { kind: "hatchback", name: "Hatchback", massKg: 1150, length: 4.0, width: 1.75, height: 1.5, wheelBase: 2.5, wheelRadius: 0.3, powerKw: 78, topSpeed: 47, reverseTop: 6, cdA: 0.68, tankL: 45, turnRadius: 5.1, trunkKg: 50 },
  pickup: { kind: "pickup", name: "Pickup", massKg: 2050, length: 5.3, width: 1.9, height: 1.8, wheelBase: 3.2, wheelRadius: 0.38, powerKw: 160, topSpeed: 48, reverseTop: 6, cdA: 1.05, tankL: 80, turnRadius: 6.4, trunkKg: 250 },
  van: { kind: "van", name: "Van", massKg: 2100, length: 4.9, width: 1.95, height: 2.0, wheelBase: 3.0, wheelRadius: 0.34, powerKw: 100, topSpeed: 42, reverseTop: 5, cdA: 1.25, tankL: 70, turnRadius: 5.9, trunkKg: 450 },
  // A police-package sedan: heavier, much more engine, a bigger tank, a siren and a light bar.
  police: { ...SEDAN, kind: "police", name: "Police cruiser", massKg: 1800, length: 5.1, width: 1.9, height: 1.5, wheelBase: 2.95, powerKw: 205, topSpeed: 60, tankL: 72, turnRadius: 6.0, trunkKg: 90 },
};

/** Wheel order everywhere: front left, front right, rear left, rear right (left is the driver's side). */
export const WHEELS = ["front left", "front right", "rear left", "rear right"] as const;
/** A tyre at or below this is flat; -1 means the wheel is off the car. */
export const FLAT = 5;
export const NO_WHEEL = -1;

export interface VehicleState {
  /** The car's id is its trunk container's id: the two are the same car (police cruisers have no searchable trunk). */
  id: number;
  kind: VehicleKind;
  color: string;
  plate: string;
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
  /** A battery is fitted (you can take it out). */
  hasBattery: boolean;
  /** Condition 0–100. */
  engine: number;
  body: number;
  tank: number;
  radiator: number;
  windows: number;
  lights: number;
  /** Per wheel (WHEELS order): tread 0–100, FLAT or below is flat, NO_WHEEL means removed. */
  tyres: [number, number, number, number];
  /** Coolant level, 0–100. */
  coolant: number;
  /** Engine temperature, °C. */
  temp: number;
  /** Windows boarded over with planks: they hold, but you see through gaps. */
  boarded: boolean;
  running: boolean;
  keys: boolean;
  hotwired: boolean;
  locked: boolean;
  /** Has an alarm fitted (it goes off when you break in). */
  alarm: boolean;
  headlights: boolean;
  siren: boolean;
  /** 0 park/neutral, -1 reverse, 1–5 forward gears (automatic). */
  gear: number;
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
/** Where each forward gear tops out, as a share of top speed. */
const GEAR_TOP = [0.24, 0.42, 0.62, 0.82, 1.0];
/** °C: thermostat setting, where damage starts, where the engine seizes. */
export const TEMP_NORMAL = 90;
export const TEMP_DAMAGE = 115;
export const TEMP_SEIZE = 128;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** A worn engine makes less power; a wrecked one none; a cooking one less again. */
export const engineFactor = (engine: number, temp = TEMP_NORMAL) =>
  (engine <= 0 ? 0 : 0.35 + (0.65 * Math.min(100, engine)) / 100) * (temp > TEMP_DAMAGE ? 0.6 : 1);

const isFlat = (t: number) => t <= FLAT;
export const flats = (v: VehicleState) => v.tyres.filter(isFlat).length;
export const missingWheels = (v: VehicleState) => v.tyres.filter((t) => t === NO_WHEEL).length;

/** Tyre grip: tarmac beats grass; worn tread loses some, each flat a lot, a bare rim almost all. */
export function grip(v: VehicleState, surface: Surface) {
  const base = surface === "road" ? 0.9 : 0.55;
  let f = 0;
  for (const t of v.tyres) f += t === NO_WHEEL ? 0.1 : isFlat(t) ? 0.45 : 0.6 + (0.4 * clamp(t, 0, 100)) / 100;
  return base * (f / 4);
}

export interface StepResult {
  /** Litres burned this step. */
  fuelUsed: number;
  /** Share of full power in use. */
  power: number;
  /** The engine died this step: "fuel" (tank dry) or "heat" (seized). */
  stalled: null | "fuel" | "heat";
  /** Turning harder than the tyres can hold: the car runs wide (and squeals). */
  sliding: boolean;
  braking: boolean;
  /** The automatic box changed gear this step. */
  shifted: boolean;
}

/**
 * Advance a car by dt real seconds. `clock` is game seconds per real second, for fuel, charge and
 * heat (60 at the game's normal pace). Collisions are the client's job: it moves the car back out of
 * whatever it hit and calls `crash`.
 */
export function stepVehicle(v: VehicleState, spec: VehicleSpec, input: DriveInput, dt: number, surface: Surface = "road", clock = 60, ambientC = 15): StepResult {
  const out: StepResult = { fuelUsed: 0, power: 0, stalled: null, sliding: false, braking: false, shifted: false };
  // A flat on one side drags the car toward it.
  const leftFlats = (isFlat(v.tyres[0]) ? 1 : 0) + (isFlat(v.tyres[2]) ? 1 : 0);
  const rightFlats = (isFlat(v.tyres[1]) ? 1 : 0) + (isFlat(v.tyres[3]) ? 1 : 0);
  const pull = Math.abs(v.speed) > 1 ? (rightFlats - leftFlats) * 0.15 : 0;
  v.steer += clamp(clamp(input.steer + pull, -1, 1) - v.steer, -2.5 * dt, 2.5 * dt);
  const mu = grip(v, surface);
  const tractionMax = mu * spec.massKg * G * DRIVEN_SHARE;
  const running = v.running && v.fuel > 0 && v.engine > 0;
  const pMax = spec.powerKw * 1000 * engineFactor(v.engine, v.temp);
  // Flats cap you near 40 km/h and a missing wheel at a crawl: past that the rim tears itself apart.
  const top = missingWheels(v) ? 2.5 : flats(v) ? Math.min(spec.topSpeed, 11) : spec.topSpeed;

  let force = 0;
  if (running) {
    if (input.throttle > 0 && v.speed > -0.5 && v.speed < top) {
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
  let crr = surface === "road" ? 0.015 : 0.06;
  for (const t of v.tyres) crr += t === NO_WHEEL ? 0.08 : isFlat(t) ? 0.03 : ((100 - clamp(t, 0, 100)) / 100) * 0.005;
  const rolling = Math.abs(v.speed) > 0.05 ? crr * spec.massKg * G * sign : 0;
  v.speed += ((force - drag - rolling) / spec.massKg) * dt;
  if (v.speed > top && force >= 0) v.speed = Math.max(top, v.speed - 4 * dt);
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

  // Automatic gearbox: picks the gear, which sets the revs you hear.
  const gear0 = v.gear;
  if (!running) v.gear = 0;
  else if (v.speed < -0.2 || (input.reverse > 0 && v.speed < 0.5)) v.gear = -1;
  else if (Math.abs(v.speed) < 0.2 && input.throttle === 0) v.gear = 0;
  else {
    const g = Math.max(1, v.gear);
    const share = Math.abs(v.speed) / (spec.topSpeed * GEAR_TOP[g - 1]);
    if (share > 0.92 && g < 5) v.gear = g + 1;
    else if (g > 1 && Math.abs(v.speed) < spec.topSpeed * GEAR_TOP[g - 2] * 0.55) v.gear = g - 1;
    else v.gear = g;
  }
  out.shifted = gear0 > 0 && v.gear > 0 && gear0 !== v.gear;
  if (!running) v.rpm = 0;
  else if (v.gear <= 0) v.rpm = clamp(0.14 + out.power * 0.5, 0, 1);
  else v.rpm = clamp(0.18 + 0.82 * (Math.abs(v.speed) / (spec.topSpeed * GEAR_TOP[v.gear - 1])) * (0.85 + 0.15 * out.power), 0, 1);

  if (running) {
    const watts = IDLE_W + out.power * pMax;
    out.fuelUsed = Math.min(v.fuel, (watts * dt * clock) / (ENGINE_EFFICIENCY * PETROL_J_PER_L));
    v.fuel -= out.fuelUsed;
    // The alternator charges the battery while the engine runs.
    if (v.hasBattery) v.battery = Math.min(100, v.battery + 0.02 * dt * clock);
  }
  const heat = ageVehicle(v, (dt * clock) / 60, ambientC, out.power);
  if (running && v.fuel <= 1e-6) {
    v.fuel = 0;
    v.running = false;
    out.stalled = "fuel";
  } else if (heat === "seized") out.stalled = "heat";
  return out;
}

/**
 * What happens to a car over time, driven or parked: the engine heats under load and cools when off;
 * a holed radiator loses coolant, a holed tank loses fuel; lights and the siren flatten the battery
 * unless the engine runs; too hot for too long wears the engine out, and past seizing it stops.
 */
export function ageVehicle(v: VehicleState, gameMinutes: number, ambientC = 15, load = 0): null | "seized" {
  const running = v.running && v.engine > 0;
  if (v.tank < 40) v.fuel = Math.max(0, v.fuel - (40 - v.tank) * 0.004 * gameMinutes);
  if (v.radiator < 50) v.coolant = Math.max(0, v.coolant - (50 - v.radiator) * (running ? 0.03 : 0.004) * gameMinutes);
  if (!running && v.hasBattery) {
    const draw = (v.headlights ? 0.6 : 0) + (v.siren ? 0.4 : 0);
    v.battery = Math.max(0, v.battery - draw * gameMinutes);
    if (v.battery <= 0) {
      v.headlights = false;
      v.siren = false;
    }
  }
  if (!v.hasBattery) {
    v.headlights = false;
    v.siren = false;
  }
  // Coolant and a sound radiator hold the thermostat's 90 °C; without them the engine cooks.
  const target = running ? TEMP_NORMAL + load * 12 + Math.max(0, 40 - v.coolant) * 1.6 + Math.max(0, 45 - v.radiator) * 0.9 : ambientC;
  const tau = running ? 4 : 25;
  v.temp += (target - v.temp) * Math.min(1, gameMinutes / tau);
  if (running && v.temp > TEMP_DAMAGE) {
    v.engine = Math.max(0, v.engine - (v.temp - TEMP_DAMAGE) * 0.15 * gameMinutes);
    if (v.temp >= TEMP_SEIZE || v.engine <= 0) {
      v.running = false;
      v.engine = Math.min(v.engine, 8);
      return "seized";
    }
  }
  return null;
}

export type StartResult = { ok: true; message: string } | { ok: false; message: string };

/** Turn the key (or touch the hotwired leads): each crank drains the battery. */
export function startEngine(v: VehicleState, rng: () => number): StartResult {
  if (v.running) return { ok: true, message: "The engine's already running." };
  if (!v.keys && !v.hotwired) return { ok: false, message: "No keys. You'll have to hotwire it." };
  if (!v.hasBattery) return { ok: false, message: "Nothing. There's no battery in it." };
  if (v.battery < 15) return { ok: false, message: "The starter just clicks. The battery's dead." };
  v.battery = Math.max(0, v.battery - 4);
  if (v.fuel <= 0) return { ok: false, message: "It cranks and cranks but won't catch. The tank's empty." };
  if (v.engine < 10) return { ok: false, message: "It turns over, grinds and dies. The engine is wrecked." };
  const chance = 0.5 + 0.5 * (v.battery / 100) * (v.engine / 100);
  if (rng() > chance) return { ok: false, message: "It coughs and won't catch. Try again." };
  v.running = true;
  // Starting it is how you shut an alarm up.
  v.alarm = false;
  return { ok: true, message: v.temp > 60 ? "The engine catches." : "The engine catches and settles into a rough idle." };
}

/** Game minutes of fiddling under the dash to hotwire a car with a screwdriver. */
export const HOTWIRE_MINUTES = 8;

export type CrashSide = "front" | "rear" | "side";

export interface CrashResult {
  /** Points taken off the body and engine. */
  body: number;
  engine: number;
  /** Health the driver loses (0 below about 30 km/h). */
  injury: number;
}

/**
 * A hit at this closing speed (m/s), on this end of the car: damage grows with the energy (speed
 * squared). The front takes the radiator, lights, engine and front tyres with it; the rear, the tank.
 */
export function crash(v: VehicleState, impact: number, side: CrashSide = "front"): CrashResult {
  const s = Math.abs(impact);
  if (s < 2) return { body: 0, engine: 0, injury: 0 };
  const body = Math.min(100, (s - 2) ** 2 * 0.6);
  const engine = side === "front" ? body * 0.45 : side === "side" ? body * 0.1 : body * 0.05;
  const injury = s > 8.5 ? (s - 8.5) * (side === "side" ? 6 : 5) : 0;
  v.body = Math.max(0, v.body - body);
  v.engine = Math.max(0, v.engine - engine);
  v.windows = Math.max(0, v.windows - body * (side === "side" ? 0.9 : 0.4));
  if (side === "front") {
    v.radiator = Math.max(0, v.radiator - body * 0.8);
    v.lights = Math.max(0, v.lights - body * 1.2);
    for (const i of [0, 1]) if (v.tyres[i] > 0) v.tyres[i] = Math.max(0, v.tyres[i] - body * 0.3);
  } else if (side === "rear") {
    v.tank = Math.max(0, v.tank - body * 0.7);
    for (const i of [2, 3]) if (v.tyres[i] > 0) v.tyres[i] = Math.max(0, v.tyres[i] - body * 0.3);
  }
  if (v.engine <= 0) v.running = false;
  return { body, engine, injury };
}

/** Running someone down: what it does to them, and to the car. Below walking pace it's a shove. */
export function hitPedestrian(speed: number): { damage: number; carDamage: number; knockdown: boolean } {
  const s = Math.abs(speed);
  if (s < 2.5) return { damage: 0, carDamage: 0, knockdown: false };
  return { damage: s * s * 1.6, carDamage: s * 0.7, knockdown: true };
}

/** A zombie at a stopped car claws at the glass; once the windows are gone it can reach you. */
export function claw(v: VehicleState): "held" | "cracking" | "through" {
  if (v.windows <= 0) return "through";
  v.windows = Math.max(0, v.windows - (v.boarded ? 3 : 6));
  if (v.windows <= 0) v.boarded = false;
  return v.windows > 45 ? "held" : "cracking";
}

/** Smash a side window to get into a locked car: noisy, and maybe the alarm. */
export function breakIn(v: VehicleState): { alarm: boolean } {
  v.locked = false;
  v.windows = Math.min(v.windows, 55);
  const alarm = v.alarm && v.hasBattery && v.battery > 5;
  return { alarm };
}

/** How far the engine is heard (m): a rough idle carries 20 m, a car flat out 50. */
export const engineNoise = (v: VehicleState) => (v.running ? 20 + 30 * v.rpm : 0);
export const HORN_NOISE = 75;
export const SIREN_NOISE = 140;
export const ALARM_NOISE = 80;
/** Real seconds an alarm wails once set off (unless you get the engine started). */
export const ALARM_SECONDS = 45;

/** Borrow charge from another car's battery through jumper cables. */
export function jumpStart(v: VehicleState, donor: VehicleState): { ok: boolean; message: string } {
  if (!v.hasBattery) return { ok: false, message: "There's no battery in this car to charge." };
  if (!donor.hasBattery || (donor.battery < 35 && !donor.running)) return { ok: false, message: "The other car's battery is too flat to help." };
  const give = donor.running ? 45 : Math.min(30, donor.battery - 15);
  donor.battery = donor.running ? donor.battery : donor.battery - give * 0.8;
  v.battery = Math.min(100, Math.max(v.battery, 20) + give * 0.5);
  return { ok: true, message: "You clamp the cables on and wait. The dash lights flicker awake." };
}

export const JUMP_MINUTES = 4;

// ------------------------------------------------------------------ repairs and salvage

export interface RepairOption {
  id: string;
  label: string;
  /** Game minutes of work. */
  minutes: number;
  ok: boolean;
  /** Why it can't be done yet, in words. */
  why?: string;
}

const has = (inv: ItemStack[], id: string) => inv.some((s) => s.id === id && s.count > 0);
const need = (inv: ItemStack[], id: string, n = 1) => inv.filter((s) => s.id === id).reduce((a, s) => a + s.count, 0) >= n;

/** Everything you could do to this car now, with what's missing for each. */
export function repairOptions(v: VehicleState, inv: ItemStack[], moving = false): RepairOption[] {
  const out: RepairOption[] = [];
  const wrench = has(inv, "wrench");
  const add = (id: string, label: string, minutes: number, missing: string[]) => {
    const why = moving ? "the car has to be stopped" : missing.length ? `needs ${missing.join(" and ")}` : undefined;
    out.push({ id, label, minutes, ok: !why, why });
  };
  v.tyres.forEach((t, i) => {
    if (t === NO_WHEEL) add(`tyre:fit:${i}`, `Fit a wheel (${WHEELS[i]})`, 10, [!has(inv, "spare_tyre") ? "a tyre" : "", !wrench ? "a wrench" : ""].filter(Boolean));
    else if (t < 60) add(`tyre:swap:${i}`, `Change the ${WHEELS[i]} tyre (${t <= FLAT ? "flat" : `${Math.round(t)}% tread`})`, 12, [!has(inv, "spare_tyre") ? "a tyre" : "", !wrench ? "a wrench" : ""].filter(Boolean));
  });
  if (!v.hasBattery) add("battery:fit", "Fit a battery", 6, [!has(inv, "car_battery") ? "a car battery" : "", !wrench ? "a wrench" : ""].filter(Boolean));
  else if (v.battery < 40 && has(inv, "car_battery")) add("battery:swap", `Swap in a fresher battery (this one's at ${Math.round(v.battery)}%)`, 6, wrench ? [] : ["a wrench"]);
  if (v.tank < 60) add("tank:patch", `Patch the fuel tank${v.tank < 40 ? " (it's leaking)" : ""}`, 5, has(inv, "duct_tape") ? [] : ["duct tape"]);
  if (v.radiator < 60) add("radiator:patch", `Patch the radiator${v.radiator < 50 ? " (it's leaking)" : ""}`, 8, has(inv, "duct_tape") ? [] : ["duct tape"]);
  if (v.coolant < 85) add("coolant:fill", `Top up the radiator with water (${Math.round(v.coolant)}%)`, 2, has(inv, "water_bottle") ? [] : ["a bottle of water"]);
  if (v.engine < 80) add("engine:repair", `Rebuild the engine (${Math.round(v.engine)}%)`, 30, [!has(inv, "engine_parts") ? "engine parts" : "", !wrench ? "a wrench" : ""].filter(Boolean));
  if (v.windows < 50 && !v.boarded) add("windows:board", "Board up the broken windows", 10, [!need(inv, "plank", 2) ? "2 planks" : "", !need(inv, "nails", 8) ? "8 nails" : "", !has(inv, "hammer") ? "a hammer" : ""].filter(Boolean));
  // Salvage: strip a car you're not using.
  if (v.hasBattery) add("battery:take", `Take the battery (${Math.round(v.battery)}%)`, 5, wrench ? [] : ["a wrench"]);
  v.tyres.forEach((t, i) => {
    if (t !== NO_WHEEL && t > FLAT) add(`tyre:take:${i}`, `Take the ${WHEELS[i]} wheel (${Math.round(t)}% tread)`, 8, wrench ? [] : ["a wrench"]);
  });
  return out;
}

/** Take n of an item (any stacks). Returns the inventory without them. */
function consume(inv: ItemStack[], id: string, n = 1): ItemStack[] {
  const out = inv.map((s) => ({ ...s }));
  for (const s of out) {
    if (n <= 0) break;
    if (s.id !== id) continue;
    const take = Math.min(n, s.count);
    s.count -= take;
    n -= take;
  }
  return out.filter((s) => s.count > 0);
}

/** The best (highest charge) single item of a kind, taken out of the inventory. */
function takeBest(inv: ItemStack[], id: string): { inv: ItemStack[]; item: ItemStack | null } {
  const cands = inv.filter((s) => s.id === id);
  if (!cands.length) return { inv, item: null };
  const best = cands.reduce((a, b) => ((b.charge ?? 0) > (a.charge ?? 0) ? b : a));
  return { inv: inv.filter((s) => s !== best), item: best };
}

export interface RepairResult {
  inventory: ItemStack[];
  /** Items the work leaves you holding (the old battery, the tyre you took off). */
  gained: ItemStack[];
  message: string;
}

/** Do one repair or salvage job. The input inventory is left untouched. Throws on an id that isn't available. */
export function doRepair(v: VehicleState, id: string, inv: ItemStack[]): RepairResult {
  const opt = repairOptions(v, inv).find((o) => o.id === id);
  if (!opt || !opt.ok) throw new Error(`can't ${id}: ${opt?.why ?? "not available"}`);
  const [what, how, idx] = id.split(":");
  const i = Number(idx);
  let inventory = inv.map((s) => ({ ...s }));
  const gained: ItemStack[] = [];
  let message = "";
  const tyreItem = (tread: number) => {
    const t = makeStack("spare_tyre");
    t.charge = Math.round(tread);
    return t;
  };
  if (what === "tyre") {
    if (how === "take") {
      gained.push(tyreItem(v.tyres[i]));
      v.tyres[i] = NO_WHEEL;
      message = `You jack it up and take the ${WHEELS[i]} wheel off. The car sits on its hub.`;
    } else {
      const { inv: rest, item } = takeBest(inventory, "spare_tyre");
      inventory = rest;
      const old = v.tyres[i];
      v.tyres[i] = item?.charge ?? 90;
      if (how === "swap") {
        if (old > FLAT) gained.push(tyreItem(old));
        message = old > FLAT ? `You swap the ${WHEELS[i]} tyre and keep the old one.` : `You change the ${WHEELS[i]} tyre. The flat one is shredded; you leave it.`;
      } else message = `You bolt a wheel onto the ${WHEELS[i]} hub.`;
    }
  } else if (what === "battery") {
    if (how === "take") {
      const b = makeStack("car_battery");
      b.charge = Math.round(v.battery);
      gained.push(b);
      v.hasBattery = false;
      v.battery = 0;
      v.running = false;
      v.headlights = false;
      v.siren = false;
      message = "You loosen the clamps and lift the battery out. It's heavy.";
    } else {
      const { inv: rest, item } = takeBest(inventory, "car_battery");
      inventory = rest;
      if (how === "swap" && v.hasBattery) {
        const old = makeStack("car_battery");
        old.charge = Math.round(v.battery);
        gained.push(old);
      }
      v.hasBattery = true;
      v.battery = item?.charge ?? 80;
      message = `You fit the battery and tighten the clamps (${Math.round(v.battery)}% charge).`;
    }
  } else if (what === "tank") {
    inventory = consume(inventory, "duct_tape");
    v.tank = Math.max(v.tank, 60);
    message = "You tape over the holes in the tank. It should hold, for a while.";
  } else if (what === "radiator") {
    inventory = consume(inventory, "duct_tape");
    v.radiator = Math.max(v.radiator, 55);
    message = "You wrap tape round the split hoses and the core. It might hold.";
  } else if (what === "coolant") {
    inventory = consume(inventory, "water_bottle");
    gained.push(makeStack("empty_bottle"));
    v.coolant = Math.min(100, v.coolant + 35);
    message = `You pour a bottle of water into the radiator (${Math.round(v.coolant)}%).`;
  } else if (what === "engine") {
    inventory = consume(inventory, "engine_parts");
    v.engine = Math.min(100, v.engine + 45);
    message = `New gaskets, plugs and belts. The engine is at ${Math.round(v.engine)}%.`;
  } else if (what === "windows") {
    inventory = consume(consume(inventory, "plank", 2), "nails", 8);
    v.windows = 70;
    v.boarded = true;
    message = "You nail planks over the empty window frames. You can see out through the gaps.";
  }
  return { inventory, gained, message };
}

// ------------------------------------------------------------------ cars in town

const KINDS: [VehicleKind, number][] = [
  ["sedan", 0.4],
  ["hatchback", 0.3],
  ["pickup", 0.15],
  ["van", 0.15],
];

const PLATE_LETTERS = "ABCDEFGHJKLMNPRSTUVWXYZ";
const plateFor = (r: () => number) => {
  const d = () => Math.floor(r() * 10);
  const l = () => PLATE_LETTERS[Math.floor(r() * PLATE_LETTERS.length)];
  return `${d()}${l()}${l()}-${d()}${d()}${d()}`;
};

/** Names for the town's paint colours, for keys and messages. */
export const COLOR_NAMES: Record<string, string> = {
  "#5b6770": "grey",
  "#6d4a3a": "brown",
  "#3e4d3f": "green",
  "#8b8a83": "silver",
  "#2f3a4a": "navy",
  "#7a3b33": "red",
  "#e8e6df": "white",
  "#16181a": "black and white",
};

/**
 * A car abandoned in town: its own seeded stream (the trunk's id), so adding cars never moves anything
 * else the town rolls. The first draws keep their old order, so cars stay the kind they were.
 */
export function rollVehicle(id: number, x: number, z: number, yaw: number, color: string, fuel: number, kind?: VehicleKind): VehicleState {
  const r = mulberry32((id * 2654435761) ^ 0x5eed);
  let k = r();
  let rolled: VehicleKind = "sedan";
  for (const [kk, w] of KINDS) {
    if (k < w) {
      rolled = kk;
      break;
    }
    k -= w;
  }
  const finalKind = kind ?? rolled;
  const battery = r() < 0.18 ? Math.round(r() * 12) : Math.round(40 + r() * 60);
  const engine = r() < 0.1 ? Math.round(5 + r() * 25) : Math.round(45 + r() * 55);
  const tread = Math.round(45 + r() * 55);
  const body = Math.round(50 + r() * 50);
  const keys = r() < 0.35;
  // Newer draws, after the old ones.
  const tyres = [0, 1, 2, 3].map(() => (r() < 0.07 ? Math.round(r() * FLAT) : Math.round(clamp(tread + (r() - 0.5) * 20, 20, 100)))) as VehicleState["tyres"];
  const locked = !keys && r() < 0.55;
  const alarm = locked && r() < 0.35;
  const tank = r() < 0.08 ? Math.round(10 + r() * 25) : 100;
  const radiator = r() < 0.12 ? Math.round(15 + r() * 30) : Math.round(70 + r() * 30);
  const coolant = radiator < 50 ? Math.round(r() * 40) : Math.round(60 + r() * 40);
  const windows = r() < 0.12 ? Math.round(r() * 45) : 100;
  const plate = plateFor(r);
  return {
    id,
    kind: finalKind,
    color,
    plate,
    x,
    z,
    yaw,
    speed: 0,
    steer: 0,
    fuel: Math.min(fuel, VEHICLES[finalKind].tankL),
    battery,
    hasBattery: true,
    engine,
    body,
    tank,
    radiator,
    windows,
    lights: body < 65 ? Math.round(body) : 100,
    tyres,
    coolant,
    temp: 12,
    boarded: false,
    running: false,
    keys: finalKind === "police" ? false : keys,
    hotwired: false,
    locked: finalKind === "police" ? true : locked,
    alarm: finalKind === "police" ? false : alarm,
    headlights: false,
    siren: false,
    gear: 0,
    rpm: 0,
  };
}

const num = (v: unknown, lo: number, hi: number, dflt: number) => (typeof v === "number" && Number.isFinite(v) ? clamp(v, lo, hi) : dflt);
const bool = (v: unknown, dflt: boolean) => (typeof v === "boolean" ? v : dflt);

/** Merge a saved car over its freshly rolled self: anything missing or broken keeps the rolled value. */
export function loadVehicle(base: VehicleState, raw: unknown): VehicleState {
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const spec = VEHICLES[base.kind];
  // Saves from before per-wheel tyres held one number for all four.
  const tyres: VehicleState["tyres"] = Array.isArray(r.tyres) && r.tyres.length === 4
    ? (r.tyres.map((t, i) => num(t, NO_WHEEL, 100, base.tyres[i])) as VehicleState["tyres"])
    : typeof r.tyres === "number"
      ? (base.tyres.map(() => num(r.tyres, 0, 100, 80)) as VehicleState["tyres"])
      : base.tyres;
  return {
    ...base,
    x: num(r.x, -5000, 5000, base.x),
    z: num(r.z, -5000, 5000, base.z),
    yaw: num(r.yaw, -1e6, 1e6, base.yaw),
    fuel: num(r.fuel, 0, spec.tankL, base.fuel),
    battery: num(r.battery, 0, 100, base.battery),
    hasBattery: bool(r.hasBattery, base.hasBattery),
    engine: num(r.engine, 0, 100, base.engine),
    body: num(r.body, 0, 100, base.body),
    tank: num(r.tank, 0, 100, base.tank),
    radiator: num(r.radiator, 0, 100, base.radiator),
    windows: num(r.windows, 0, 100, base.windows),
    lights: num(r.lights, 0, 100, base.lights),
    coolant: num(r.coolant, 0, 100, base.coolant),
    temp: num(r.temp, -40, 150, base.temp),
    tyres,
    boarded: bool(r.boarded, base.boarded),
    keys: bool(r.keys, base.keys),
    hotwired: bool(r.hotwired, base.hotwired),
    locked: bool(r.locked, base.locked),
    alarm: bool(r.alarm, base.alarm),
    headlights: false,
    siren: false,
    running: false,
    speed: 0,
    steer: 0,
    gear: 0,
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
  hasBattery: v.hasBattery,
  engine: +v.engine.toFixed(1),
  body: +v.body.toFixed(1),
  tank: +v.tank.toFixed(1),
  radiator: +v.radiator.toFixed(1),
  windows: +v.windows.toFixed(1),
  lights: +v.lights.toFixed(1),
  coolant: +v.coolant.toFixed(1),
  temp: +v.temp.toFixed(1),
  tyres: v.tyres.map((t) => +t.toFixed(1)),
  boarded: v.boarded,
  keys: v.keys,
  hotwired: v.hotwired,
  locked: v.locked,
  alarm: v.alarm,
});

/** The words on a car's keys: matched to the car by its plate. */
export const keysText = (v: VehicleState) => `A keyring with a ${COLOR_NAMES[v.color] ?? ""} ${VEHICLES[v.kind].name.toLowerCase()} fob. The tag says ${v.plate}.`.replace("  ", " ");

/** Do these keys fit this car? */
export const keysFit = (stack: ItemStack, v: VehicleState) => stack.id === "car_keys" && !!stack.text?.includes(v.plate);
