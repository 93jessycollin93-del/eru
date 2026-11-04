import { describe, expect, it } from "vitest";
import { crash, engineNoise, hitPedestrian, loadVehicle, rollVehicle, saveVehicle, startEngine, stepVehicle, VEHICLES, type DriveInput, type VehicleState } from "./vehicle";

const car = (over: Partial<VehicleState> = {}): VehicleState => ({
  ...rollVehicle(1, 0, 0, 0, "#555", 40),
  kind: "sedan",
  fuel: 40,
  battery: 90,
  engine: 100,
  tyres: 100,
  body: 100,
  keys: true,
  running: true,
  ...over,
});
const go = (v: VehicleState, input: Partial<DriveInput>, seconds: number, dt = 1 / 60) => {
  const full: DriveInput = { throttle: 0, reverse: 0, steer: 0, handbrake: false, ...input };
  let fuel = 0;
  for (let t = 0; t < seconds; t += dt) fuel += stepVehicle(v, VEHICLES[v.kind], full, dt).fuelUsed;
  return fuel;
};
const kmh = (ms: number) => ms * 3.6;

describe("driving", () => {
  it("gets a family sedan from 0 to 100 km/h in a believable 8 to 13 seconds", () => {
    const v = car();
    let t = 0;
    while (kmh(v.speed) < 100 && t < 30) {
      go(v, { throttle: 1 }, 0.1);
      t += 0.1;
    }
    expect(t).toBeGreaterThan(8);
    expect(t).toBeLessThan(13);
  });

  it("tops out near its real top speed, and a worn engine is slower to get there", () => {
    const v = car({ fuel: 1000 }); // flat out for a minute and a half drains any real tank
    go(v, { throttle: 1 }, 90);
    expect(kmh(v.speed)).toBeGreaterThan(170);
    expect(kmh(v.speed)).toBeLessThanOrEqual(kmh(VEHICLES.sedan.topSpeed) + 1);
    const tired = car({ engine: 30 });
    const fresh = car();
    go(tired, { throttle: 1 }, 8);
    go(fresh, { throttle: 1 }, 8);
    expect(tired.speed).toBeLessThan(fresh.speed * 0.85);
  });

  it("stops from 50 km/h in about the distance a real car does, longer on worn tyres and grass", () => {
    const stop = (over: Partial<VehicleState>, surface: "road" | "grass" = "road") => {
      const v = car({ speed: 50 / 3.6, ...over });
      let z = 0;
      for (let i = 0; i < 2000 && v.speed > 0; i++) {
        stepVehicle(v, VEHICLES.sedan, { throttle: 0, reverse: 1, steer: 0, handbrake: false }, 1 / 60, surface);
        z = v.z;
      }
      return z;
    };
    const dry = stop({});
    expect(dry).toBeGreaterThan(9);
    expect(dry).toBeLessThan(16);
    expect(stop({ tyres: 10 })).toBeGreaterThan(dry);
    expect(stop({}, "grass")).toBeGreaterThan(dry * 1.4);
  });

  it("brakes with S while rolling forward and only reverses once stopped, slowly", () => {
    const v = car({ speed: 10 });
    go(v, { reverse: 1 }, 0.5);
    expect(v.speed).toBeGreaterThan(0);
    expect(v.speed).toBeLessThan(10);
    go(v, { reverse: 1 }, 10);
    expect(v.speed).toBeLessThan(0);
    expect(-v.speed).toBeLessThanOrEqual(VEHICLES.sedan.reverseTop + 0.1);
  });

  it("turns a circle close to its real turning radius at walking pace, steering right turns right", () => {
    const v = car();
    go(v, { throttle: 0.05 }, 3);
    const speed = v.speed;
    const yaw0 = v.yaw;
    go(v, { throttle: 0.05, steer: 1 }, 1.5);
    const before = { x: v.x, z: v.z, yaw: v.yaw };
    go(v, { throttle: 0.05, steer: 1 }, 1);
    const turned = Math.abs(v.yaw - before.yaw);
    const radius = (Math.max(speed, v.speed) * 1) / turned;
    expect(radius).toBeGreaterThan(4);
    expect(radius).toBeLessThan(7.5);
    // Forward is (sin yaw, cos yaw) and right is (-cos yaw, sin yaw): turning right lowers yaw.
    expect(v.yaw).toBeLessThan(yaw0);
  });

  it("slides wide instead of turning on the spot when you yank the wheel at speed", () => {
    const v = car({ speed: 30 });
    let slid = false;
    for (let i = 0; i < 60; i++) slid = stepVehicle(v, VEHICLES.sedan, { throttle: 1, reverse: 0, steer: 1, handbrake: false }, 1 / 60).sliding || slid;
    expect(slid).toBe(true);
  });

  it("burns fuel on the game clock: a few litres to cross town, and the engine dies when the tank runs dry", () => {
    const v = car();
    let used = 0;
    while (v.z < 300) used += go(v, { throttle: 0.3 }, 0.5);
    expect(used).toBeGreaterThan(1);
    expect(used).toBeLessThan(8);
    const dry = car({ fuel: 0.02 });
    let stalled = false;
    for (let i = 0; i < 600 && !stalled; i++) stalled = stepVehicle(dry, VEHICLES.sedan, { throttle: 1, reverse: 0, steer: 0, handbrake: false }, 1 / 60).stalled;
    expect(stalled).toBe(true);
    expect(dry.running).toBe(false);
    expect(engineNoise(dry)).toBe(0);
  });
});

describe("starting a car that sat for days", () => {
  const rng = (v: number) => () => v;

  it("needs keys or a hotwire, a battery with charge, fuel and an engine", () => {
    expect(startEngine(car({ running: false, keys: false }), rng(0)).message).toContain("hotwire");
    expect(startEngine(car({ running: false, battery: 8 }), rng(0)).message).toContain("battery");
    expect(startEngine(car({ running: false, fuel: 0 }), rng(0)).message).toContain("empty");
    expect(startEngine(car({ running: false, engine: 5 }), rng(0)).message).toContain("wrecked");
    const ok = car({ running: false, keys: false, hotwired: true });
    expect(startEngine(ok, rng(0)).ok).toBe(true);
    expect(ok.running).toBe(true);
  });

  it("drains the battery with every crank, so a weak one gives you a few tries", () => {
    const v = car({ running: false, battery: 30 });
    let tries = 0;
    while (!startEngine(v, rng(0.99)).message.includes("dead") && tries < 20) tries++;
    expect(tries).toBeGreaterThan(1);
    expect(tries).toBeLessThan(6);
  });

  it("charges the battery back up while it runs", () => {
    const v = car({ battery: 40 });
    go(v, {}, 30);
    expect(v.battery).toBeGreaterThan(40);
  });
});

describe("damage", () => {
  it("shrugs off a bump, dents at town speeds, and hurts the driver above about 30 km/h", () => {
    expect(crash(car(), 1.5)).toEqual({ body: 0, engine: 0, injury: 0 });
    const slow = crash(car(), 6);
    expect(slow.body).toBeGreaterThan(0);
    expect(slow.injury).toBe(0);
    const fast = car();
    const r = crash(fast, 16);
    expect(r.injury).toBeGreaterThan(20);
    expect(fast.engine).toBeLessThan(100);
  });

  it("kills a zombie at 30 km/h but only shoves one at walking pace", () => {
    expect(hitPedestrian(1.5).knockdown).toBe(false);
    expect(hitPedestrian(30 / 3.6).damage).toBeGreaterThan(100);
  });
});

describe("cars in town", () => {
  it("rolls the same car from the same trunk every time, with a mix of kinds and conditions", () => {
    expect(rollVehicle(42, 1, 2, 0, "#fff", 10)).toEqual(rollVehicle(42, 1, 2, 0, "#fff", 10));
    const cars = Array.from({ length: 200 }, (_, i) => rollVehicle(i, 0, 0, 0, "#fff", 10));
    const kinds = new Set(cars.map((c) => c.kind));
    expect(kinds.size).toBe(4);
    const keyed = cars.filter((c) => c.keys).length / cars.length;
    expect(keyed).toBeGreaterThan(0.2);
    expect(keyed).toBeLessThan(0.5);
    expect(cars.some((c) => c.battery < 15)).toBe(true);
  });

  it("saves and reloads a car, and survives a broken save", () => {
    const base = rollVehicle(7, 0, 0, 0, "#fff", 10);
    const moved = { ...base, x: 50, z: -20, yaw: 1.2, fuel: 3.5, hotwired: true };
    const back = loadVehicle(base, JSON.parse(JSON.stringify(saveVehicle(moved))));
    expect([back.x, back.z, back.fuel, back.hotwired, back.running]).toEqual([50, -20, 3.5, true, false]);
    expect(loadVehicle(base, { x: "far", fuel: 1e9 }).fuel).toBe(VEHICLES[base.kind].tankL);
    expect(loadVehicle(base, null)).toEqual(base);
  });
});
