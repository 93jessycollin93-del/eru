import { describe, expect, it } from "vitest";
import {
  addWound,
  bandage,
  bloodPercent,
  createBody,
  infectionStage,
  isBleeding,
  moodles,
  updateBody,
  zombieHit,
  type BodyEnvironment,
  type BodyState,
} from "./body";
import { airTemperature } from "./climate";
import { mulberry32 } from "./rng";

const calm: BodyEnvironment = { ambientTemp: 15, exertion: 0, threats: 0 };

/** Run the body for a number of real seconds at 1 game minute per second. */
function run(b: BodyState, seconds: number, env = calm, gameMinutesPerSecond = 1): string | null {
  for (let t = 0; t < seconds; t++) {
    const death = updateBody(b, 1, gameMinutesPerSecond, env);
    if (death) return death;
  }
  return null;
}

describe("bleeding", () => {
  it("an untreated laceration bleeds out within a few minutes", () => {
    const b = createBody();
    addWound(b, "leftArm", "laceration", () => 0.5);
    let died: string | null = null;
    let seconds = 0;
    while (!died && seconds < 600) {
      died = updateBody(b, 1, 1, calm);
      seconds++;
    }
    expect(died).toBe("Bled out");
    expect(seconds).toBeGreaterThan(120);
    expect(seconds).toBeLessThan(480);
  });

  it("a bandage stops the bleeding", () => {
    const b = createBody();
    addWound(b, "leftArm", "laceration", () => 0.5);
    run(b, 30);
    expect(isBleeding(b)).toBe(true);
    bandage(b);
    expect(isBleeding(b)).toBe(false);
    const blood = b.blood;
    run(b, 30);
    expect(b.blood).toBeGreaterThanOrEqual(blood);
  });

  it("a scratch clots by itself", () => {
    const b = createBody();
    addWound(b, "rightArm", "scratch", () => 0.5);
    expect(run(b, 300)).toBeNull();
    expect(isBleeding(b)).toBe(false);
    expect(bloodPercent(b)).toBeGreaterThan(80);
  });

  it("lost blood regenerates once fed and treated", () => {
    const b = createBody();
    b.blood = 4000;
    run(b, 120);
    expect(b.blood).toBeGreaterThan(4100);
  });
});

describe("zombie infection", () => {
  it("a bite always infects", () => {
    const b = createBody();
    // rng sequence: kind roll 0.95 = bite
    let i = 0;
    const seq = [0.95, 0.5, 0.5, 0.5];
    zombieHit(b, () => seq[i++ % seq.length]);
    expect(b.wounds[0].kind).toBe("bite");
    expect(b.infection.infected).toBe(true);
  });

  it("is silent at first, then shows symptoms, then kills", () => {
    const b = createBody();
    b.infection.infected = true;
    expect(infectionStage(b)).toBe(0);
    expect(moodles(b).some((m) => m.id === "queasy")).toBe(false);
    // Keep fed and watered so only the infection can kill.
    let died: string | null = null;
    let hours = 0;
    while (!died && hours < 100) {
      b.hunger = 100;
      b.thirst = 100;
      died = run(b, 60);
      hours++;
      if (hours === 20) expect(infectionStage(b)).toBeGreaterThanOrEqual(1);
    }
    expect(died).toBe("The infection took you");
    expect(hours).toBeGreaterThan(40);
    expect(hours).toBeLessThanOrEqual(61);
  });

  it("is deterministic for a given seed", () => {
    const a = createBody();
    const b = createBody();
    const ra = mulberry32(42);
    const rb = mulberry32(42);
    for (let i = 0; i < 20; i++) {
      zombieHit(a, ra);
      zombieHit(b, rb);
    }
    expect(a.wounds.map((w) => w.kind + w.part)).toEqual(b.wounds.map((w) => w.kind + w.part));
    expect(a.infection.infected).toBe(b.infection.infected);
  });
});

describe("needs", () => {
  it("starving and dehydration eventually kill", () => {
    const b = createBody();
    const died = run(b, 60 * 60 * 4, calm);
    expect(died).toBe("Died of dehydration");
  });

  it("thirst runs out faster than hunger", () => {
    const b = createBody();
    b.hunger = b.thirst = 100;
    run(b, 600);
    expect(100 - b.thirst).toBeGreaterThan(100 - b.hunger);
  });

  it("sleep clears fatigue", () => {
    const b = createBody();
    b.fatigue = 90;
    b.asleep = true;
    run(b, 60, calm, 30); // 30 game hours at sleep speed is plenty
    expect(b.fatigue).toBeLessThan(5);
  });
});

describe("temperature", () => {
  it("nights are cold and shelter helps", () => {
    const outside = airTemperature(4 * 60, 1, false);
    const inside = airTemperature(4 * 60, 1, true);
    const afternoon = airTemperature(15 * 60, 1, false);
    expect(outside).toBeLessThan(5);
    expect(inside).toBeGreaterThan(outside + 5);
    expect(afternoon).toBeGreaterThan(outside + 8);
  });

  it("a night outdoors chills you but does not kill on its own", () => {
    const b = createBody();
    const env = { ...calm, ambientTemp: 3 };
    expect(run(b, 8 * 60, env)).toBeNull();
    expect(b.bodyTemp).toBeLessThan(36.3);
    expect(b.bodyTemp).toBeGreaterThan(35);
  });
});
