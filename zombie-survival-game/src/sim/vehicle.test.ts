import { describe, expect, it } from "vitest";
import {
  FLAT,
  NO_WHEEL,
  TEMP_DAMAGE,
  ageVehicle,
  breakIn,
  claw,
  crash,
  doRepair,
  engineNoise,
  hitPedestrian,
  jumpStart,
  keysFit,
  keysText,
  loadVehicle,
  repairOptions,
  rollVehicle,
  saveVehicle,
  startEngine,
  stepVehicle,
  VEHICLES,
  type DriveInput,
  type VehicleState,
} from "./vehicle";
import { makeStack } from "./items";

const car = (over: Partial<VehicleState> = {}): VehicleState => ({
  ...rollVehicle(1, 0, 0, 0, "#5b6770", 40),
  kind: "sedan",
  fuel: 40,
  battery: 90,
  hasBattery: true,
  engine: 100,
  tyres: [100, 100, 100, 100],
  body: 100,
  tank: 100,
  radiator: 100,
  coolant: 100,
  windows: 100,
  temp: 90,
  keys: true,
  locked: false,
  running: true,
  ...over,
});
const go = (v: VehicleState, input: Partial<DriveInput>, seconds: number, dt = 1 / 60, surface: "road" | "grass" = "road") => {
  const full: DriveInput = { throttle: 0, reverse: 0, steer: 0, handbrake: false, ...input };
  let fuel = 0;
  for (let t = 0; t < seconds; t += dt) fuel += stepVehicle(v, VEHICLES[v.kind], full, dt, surface).fuelUsed;
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
    const v = car({ fuel: 1000 });
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
      for (let i = 0; i < 2000 && v.speed > 0; i++) stepVehicle(v, VEHICLES.sedan, { throttle: 0, reverse: 1, steer: 0, handbrake: false }, 1 / 60, surface);
      return v.z;
    };
    const dry = stop({});
    expect(dry).toBeGreaterThan(9);
    expect(dry).toBeLessThan(16);
    expect(stop({ tyres: [15, 15, 15, 15] })).toBeGreaterThan(dry);
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
    expect(v.gear).toBe(-1);
  });

  it("turns a circle close to its real turning radius at walking pace, steering right turns right", () => {
    const v = car();
    go(v, { throttle: 0.05 }, 3);
    const speed = v.speed;
    const yaw0 = v.yaw;
    go(v, { throttle: 0.05, steer: 1 }, 1.5);
    const before = v.yaw;
    go(v, { throttle: 0.05, steer: 1 }, 1);
    const radius = Math.max(speed, v.speed) / Math.abs(v.yaw - before);
    expect(radius).toBeGreaterThan(4);
    expect(radius).toBeLessThan(7.5);
    expect(v.yaw).toBeLessThan(yaw0);
  });

  it("slides wide instead of turning on the spot when you yank the wheel at speed", () => {
    const v = car({ speed: 30 });
    let slid = false;
    for (let i = 0; i < 60; i++) slid = stepVehicle(v, VEHICLES.sedan, { throttle: 1, reverse: 0, steer: 1, handbrake: false }, 1 / 60).sliding || slid;
    expect(slid).toBe(true);
  });

  it("shifts up through five gears as it gathers speed, the revs dropping at each change", () => {
    const v = car({ fuel: 1000 });
    const gears = new Set<number>();
    let drops = 0;
    let lastRpm = 0;
    for (let i = 0; i < 60 * 40; i++) {
      const r = stepVehicle(v, VEHICLES.sedan, { throttle: 1, reverse: 0, steer: 0, handbrake: false }, 1 / 60);
      gears.add(v.gear);
      if (r.shifted && v.rpm < lastRpm) drops++;
      lastRpm = v.rpm;
    }
    expect([1, 2, 3, 4, 5].every((g) => gears.has(g))).toBe(true);
    expect(drops).toBeGreaterThanOrEqual(4);
  });

  it("burns fuel on the game clock: a few litres to cross town, and the engine dies when the tank runs dry", () => {
    const v = car();
    let used = 0;
    while (v.z < 300) used += go(v, { throttle: 0.3 }, 0.5);
    expect(used).toBeGreaterThan(1);
    expect(used).toBeLessThan(8);
    const dry = car({ fuel: 0.02 });
    let stalled = null;
    for (let i = 0; i < 600 && !stalled; i++) stalled = stepVehicle(dry, VEHICLES.sedan, { throttle: 1, reverse: 0, steer: 0, handbrake: false }, 1 / 60).stalled;
    expect(stalled).toBe("fuel");
    expect(dry.running).toBe(false);
    expect(engineNoise(dry)).toBe(0);
  });
});

describe("tyres", () => {
  it("drags the car toward a flat and caps it near 40 km/h", () => {
    const v = car({ tyres: [FLAT, 100, 100, 100], fuel: 100 });
    go(v, { throttle: 1 }, 20);
    expect(kmh(v.speed)).toBeLessThan(42);
    // Pulled left: left turns raise yaw.
    expect(v.yaw).toBeGreaterThan(0.05);
  });

  it("leaves a car with a wheel off crawling on its hub", () => {
    const v = car({ tyres: [100, 100, NO_WHEEL, 100] });
    go(v, { throttle: 1 }, 10);
    expect(kmh(v.speed)).toBeLessThan(10);
  });
});

describe("heat, leaks and the battery", () => {
  it("holds 90 °C with a sound radiator, cooks a holed one dry, wears the engine, and seizes", () => {
    const ok = car();
    ageVehicle(ok, 120, 15, 0.5);
    expect(ok.temp).toBeGreaterThan(85);
    expect(ok.temp).toBeLessThan(TEMP_DAMAGE);
    const holed = car({ radiator: 15, coolant: 60 });
    let seized = null;
    let minutes = 0;
    while (!seized && minutes < 600) {
      seized = ageVehicle(holed, 1, 15, 0.5);
      minutes++;
    }
    // A holed radiator can't shed heat: it cooks the engine before the coolant has even run out.
    expect(holed.coolant).toBeLessThan(50);
    expect(seized).toBe("seized");
    expect(holed.running).toBe(false);
    expect(holed.engine).toBeLessThanOrEqual(8);
  });

  it("drips fuel from a holed tank even while parked, and not from a sound one", () => {
    const holed = car({ running: false, tank: 10, fuel: 20 });
    const sound = car({ running: false, fuel: 20 });
    ageVehicle(holed, 600);
    ageVehicle(sound, 600);
    expect(holed.fuel).toBeLessThan(10);
    expect(sound.fuel).toBe(20);
  });

  it("flattens the battery with headlights left on, unless the engine's running", () => {
    const off = car({ running: false, headlights: true, battery: 60 });
    const on = car({ headlights: true, battery: 60 });
    ageVehicle(off, 90);
    ageVehicle(on, 90);
    expect(off.battery).toBeLessThan(15);
    expect(on.battery).toBe(60);
    ageVehicle(off, 60);
    expect(off.headlights).toBe(false);
  });
});

describe("starting a car that sat for days", () => {
  const rng = (v: number) => () => v;

  it("needs keys or a hotwire, a battery that's there and charged, fuel and an engine", () => {
    expect(startEngine(car({ running: false, keys: false }), rng(0)).message).toContain("hotwire");
    expect(startEngine(car({ running: false, hasBattery: false }), rng(0)).message).toContain("no battery");
    expect(startEngine(car({ running: false, battery: 8 }), rng(0)).message).toContain("battery");
    expect(startEngine(car({ running: false, fuel: 0 }), rng(0)).message).toContain("empty");
    expect(startEngine(car({ running: false, engine: 5 }), rng(0)).message).toContain("wrecked");
    const ok = car({ running: false, keys: false, hotwired: true, alarm: true });
    expect(startEngine(ok, rng(0)).ok).toBe(true);
    expect(ok.running).toBe(true);
    expect(ok.alarm).toBe(false);
  });

  it("drains the battery with every crank, so a weak one gives you a few tries", () => {
    const v = car({ running: false, battery: 30 });
    let tries = 0;
    while (!startEngine(v, rng(0.99)).message.includes("dead") && tries < 20) tries++;
    expect(tries).toBeGreaterThan(1);
    expect(tries).toBeLessThan(6);
  });

  it("borrows charge from another car through jumper cables", () => {
    const flat = car({ running: false, battery: 4 });
    const donor = car({ running: false, battery: 80 });
    expect(jumpStart(flat, donor).ok).toBe(true);
    expect(flat.battery).toBeGreaterThanOrEqual(15);
    expect(donor.battery).toBeLessThan(80);
    expect(jumpStart(car({ battery: 2 }), car({ running: false, battery: 20 })).ok).toBe(false);
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
    expect(crash(fast, 16).injury).toBeGreaterThan(20);
    expect(fast.engine).toBeLessThan(100);
  });

  it("takes the radiator and lights in a head-on, and the fuel tank when hit from behind", () => {
    const front = car();
    crash(front, 11, "front");
    expect(front.radiator).toBeLessThan(70);
    expect(front.lights).toBeLessThan(60);
    expect(front.tank).toBe(100);
    const rear = car();
    crash(rear, 11, "rear");
    expect(rear.tank).toBeLessThan(70);
    expect(rear.radiator).toBe(100);
  });

  it("kills a zombie at 30 km/h but only shoves one at walking pace", () => {
    expect(hitPedestrian(1.5).knockdown).toBe(false);
    expect(hitPedestrian(30 / 3.6).damage).toBeGreaterThan(100);
  });

  it("keeps the dead out while the windows hold, longer when they're boarded", () => {
    const glass = car();
    let n = 0;
    while (claw(glass) !== "through" && n < 100) n++;
    const boarded = car({ windows: 70, boarded: true });
    let m = 0;
    while (claw(boarded) !== "through" && m < 100) m++;
    expect(n).toBeGreaterThan(10);
    expect(m).toBeGreaterThan(n);
  });

  it("opens a locked car when you smash a window, and the alarm goes off if it has one", () => {
    const quiet = car({ locked: true, alarm: false });
    expect(breakIn(quiet).alarm).toBe(false);
    expect(quiet.locked).toBe(false);
    expect(quiet.windows).toBeLessThanOrEqual(55);
    expect(breakIn(car({ locked: true, alarm: true })).alarm).toBe(true);
    expect(breakIn(car({ locked: true, alarm: true, hasBattery: false })).alarm).toBe(false);
  });
});

describe("repairs and salvage", () => {
  const inv = (...ids: (string | [string, number])[]) => ids.map((i) => (typeof i === "string" ? makeStack(i) : makeStack(i[0], i[1])));

  it("lists what you could do and says exactly what's missing", () => {
    const v = car({ tyres: [FLAT, 100, 100, 100], radiator: 30, coolant: 20 });
    const opts = repairOptions(v, []);
    const tyre = opts.find((o) => o.id === "tyre:swap:0")!;
    expect(tyre.ok).toBe(false);
    expect(tyre.why).toBe("needs a tyre and a wrench");
    expect(opts.find((o) => o.id === "radiator:patch")!.why).toBe("needs duct tape");
    expect(repairOptions(v, inv("spare_tyre", "wrench")).find((o) => o.id === "tyre:swap:0")!.ok).toBe(true);
    expect(repairOptions(v, inv("spare_tyre", "wrench"), true).every((o) => !o.ok)).toBe(true);
  });

  it("changes a flat for a spare, keeps a worn tyre you take off, and leaves the input untouched", () => {
    const v = car({ tyres: [FLAT, 50, 100, 100] });
    const items = inv("spare_tyre", "spare_tyre", "wrench");
    items[1].charge = 70;
    const r = doRepair(v, "tyre:swap:0", items);
    expect(v.tyres[0]).toBe(90);
    expect(r.gained).toHaveLength(0);
    expect(r.inventory.filter((s) => s.id === "spare_tyre")).toHaveLength(1);
    expect(items).toHaveLength(3);
    const r2 = doRepair(v, "tyre:swap:1", r.inventory);
    expect(v.tyres[1]).toBe(70);
    expect(r2.gained[0].charge).toBe(50);
  });

  it("strips a battery and a wheel from one car to get another going", () => {
    const donor = car({ running: false, battery: 77 });
    const tools = inv("wrench");
    const b = doRepair(donor, "battery:take", tools);
    expect(donor.hasBattery).toBe(false);
    expect(startEngine(donor, () => 0).ok).toBe(false);
    expect(b.gained[0].charge).toBe(77);
    const w = doRepair(donor, "tyre:take:3", tools);
    expect(donor.tyres[3]).toBe(NO_WHEEL);
    const dead = car({ running: false, battery: 3, tyres: [100, 100, NO_WHEEL, 100] });
    const r = doRepair(dead, "battery:swap", [...tools, ...b.gained]);
    expect(dead.battery).toBe(77);
    expect(r.gained[0].charge).toBe(3);
    doRepair(dead, "tyre:fit:2", [...tools, ...w.gained]);
    expect(dead.tyres[2]).toBeGreaterThan(FLAT);
  });

  it("patches leaks with tape, tops up coolant with water, rebuilds an engine, boards up windows", () => {
    const v = car({ tank: 20, radiator: 20, coolant: 10, engine: 30, windows: 10 });
    let items = inv("duct_tape", "duct_tape", "water_bottle", "engine_parts", "wrench", ["plank", 2], ["nails", 10], "hammer");
    for (const id of ["tank:patch", "radiator:patch", "coolant:fill", "engine:repair", "windows:board"]) items = [...doRepair(v, id, items).inventory];
    expect(v.tank).toBeGreaterThanOrEqual(60);
    expect(v.radiator).toBeGreaterThanOrEqual(55);
    expect(v.coolant).toBe(45);
    expect(v.engine).toBe(75);
    expect(v.boarded).toBe(true);
    expect(items.some((s) => s.id === "duct_tape" || s.id === "plank" || s.id === "water_bottle")).toBe(false);
    expect(items.find((s) => s.id === "nails")!.count).toBe(2);
  });

  it("refuses work it can't do", () => {
    expect(() => doRepair(car({ tyres: [FLAT, 100, 100, 100] }), "tyre:swap:0", [])).toThrow();
  });
});

describe("cars in town", () => {
  it("rolls the same car from the same trunk every time, with a mix of kinds, plates and conditions", () => {
    expect(rollVehicle(42, 1, 2, 0, "#fff", 10)).toEqual(rollVehicle(42, 1, 2, 0, "#fff", 10));
    const cars = Array.from({ length: 300 }, (_, i) => rollVehicle(i, 0, 0, 0, "#fff", 10));
    expect(new Set(cars.map((c) => c.kind)).size).toBe(4);
    expect(new Set(cars.map((c) => c.plate)).size).toBeGreaterThan(295);
    expect(cars[0].plate).toMatch(/^\d[A-Z]{2}-\d{3}$/);
    const keyed = cars.filter((c) => c.keys).length / cars.length;
    expect(keyed).toBeGreaterThan(0.2);
    expect(keyed).toBeLessThan(0.5);
    expect(cars.some((c) => c.locked && c.alarm)).toBe(true);
    expect(cars.every((c) => !(c.keys && c.locked))).toBe(true);
    expect(cars.some((c) => c.tyres.some((t) => t <= FLAT))).toBe(true);
    const cop = rollVehicle(900, 0, 0, 0, "#e8e6df", 40, "police");
    expect([cop.kind, cop.keys, cop.locked]).toEqual(["police", false, true]);
  });

  it("matches keys found in a house to the one car whose plate they carry", () => {
    const a = rollVehicle(3, 0, 0, 0, "#7a3b33", 0);
    const b = rollVehicle(4, 0, 0, 0, "#7a3b33", 0);
    const keys = makeStack("car_keys", 1, undefined, { title: "Car keys", text: keysText(a) });
    expect(keys.text).toContain("red");
    expect(keysFit(keys, a)).toBe(true);
    expect(keysFit(keys, b)).toBe(false);
  });

  it("saves and reloads a car, upgrades an old one-number tyre save, and survives a broken save", () => {
    const base = rollVehicle(7, 0, 0, 0, "#fff", 10);
    const moved = { ...base, x: 50, z: -20, yaw: 1.2, fuel: 3.5, hotwired: true, tyres: [100, NO_WHEEL, 40, 2] as VehicleState["tyres"], boarded: true };
    const back = loadVehicle(base, JSON.parse(JSON.stringify(saveVehicle(moved))));
    expect([back.x, back.z, back.fuel, back.hotwired, back.running, back.boarded]).toEqual([50, -20, 3.5, true, false, true]);
    expect(back.tyres).toEqual([100, NO_WHEEL, 40, 2]);
    expect(loadVehicle(base, { tyres: 33 }).tyres).toEqual([33, 33, 33, 33]);
    expect(loadVehicle(base, { x: "far", fuel: 1e9 }).fuel).toBe(VEHICLES[base.kind].tankL);
    expect(loadVehicle(base, null)).toEqual(base);
  });
});
