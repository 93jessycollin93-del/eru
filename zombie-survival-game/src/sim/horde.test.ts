import { describe, expect, it } from "vitest";
import {
  addHeat,
  coolHeat,
  createHeat,
  daysToHorde,
  gamestage,
  heatAt,
  hordeLabel,
  hordeNight,
  hordePlan,
  loadHeat,
  noiseHeat,
  takeScoutTarget,
} from "./horde";

const at = (day: number, h: number, m = 0) => (day - 1) * 1440 + h * 60 + m;

describe("horde nights", () => {
  it("come on the night of every seventh day, 22:00 until 04:00 the next morning", () => {
    expect(hordeNight(at(7, 21, 59))).toBeNull();
    expect(hordeNight(at(7, 22))).toBe(7);
    expect(hordeNight(at(8, 3, 59))).toBe(7);
    expect(hordeNight(at(8, 4))).toBeNull();
    expect(hordeNight(at(14, 23))).toBe(14);
    expect(hordeNight(at(1, 2))).toBeNull(); // the first morning is not the end of a horde night
  });

  it("counts down the days, and says so plainly", () => {
    expect(daysToHorde(at(1, 8))).toBe(6);
    expect(daysToHorde(at(6, 12))).toBe(1);
    expect(daysToHorde(at(7, 8))).toBe(0);
    expect(daysToHorde(at(8, 6))).toBe(6);
    expect(hordeLabel(at(1, 8)).text).toBe("Horde night in 6 days");
    expect(hordeLabel(at(6, 8)).level).toBe("soon");
    expect(hordeLabel(at(7, 8)).level).toBe("tonight");
    expect(hordeLabel(at(7, 23)).level).toBe("now");
  });

  it("grows with how long you've survived and how much you've killed, within limits the client can carry", () => {
    expect(gamestage(at(1, 8), 0)).toBe(0);
    expect(gamestage(at(8, 8), 40)).toBe(9);
    const first = hordePlan(gamestage(at(7, 22), 10));
    const later = hordePlan(gamestage(at(28, 22), 200));
    expect(later.total).toBeGreaterThan(first.total);
    expect(later.group).toBeGreaterThan(first.group);
    expect(later.interval).toBeLessThan(first.interval);
    const extreme = hordePlan(1000);
    expect(extreme.total).toBeLessThanOrEqual(90);
    expect(extreme.maxAlive).toBeLessThanOrEqual(45);
    expect(extreme.interval).toBeGreaterThanOrEqual(12);
  });
});

describe("heat", () => {
  it("builds where you're loud: a gunshot counts, a footstep doesn't", () => {
    expect(noiseHeat(2.5)).toBe(0);
    expect(noiseHeat(60)).toBeGreaterThan(5);
    const h = createHeat();
    addHeat(h, 10, 10, noiseHeat(60));
    expect(heatAt(h, 12, 12)).toBeGreaterThan(5);
    expect(heatAt(h, 200, 200)).toBe(0);
  });

  it("cools by half in two game hours and is forgotten when cold", () => {
    const h = createHeat();
    addHeat(h, 0, 0, 40);
    coolHeat(h, 120);
    expect(heatAt(h, 0, 0)).toBeCloseTo(20, 5);
    coolHeat(h, 1440);
    expect(Object.keys(h.cells)).toHaveLength(0);
  });

  it("sends one group of scouts to the latest noise in a hot area, then cools off before sending more", () => {
    const h = createHeat();
    for (let i = 0; i < 8; i++) addHeat(h, 30 + i, 40, noiseHeat(60));
    const t = takeScoutTarget(h)!;
    expect(t).not.toBeNull();
    expect(t.x).toBe(37);
    expect(takeScoutTarget(h)).toBeNull(); // cooling down, and the area's heat was halved
    coolHeat(h, 61);
    for (let i = 0; i < 8; i++) addHeat(h, 30, 40, noiseHeat(60));
    expect(takeScoutTarget(h)).not.toBeNull();
  });

  it("loads any old or damaged save as safe heat", () => {
    expect(loadHeat(undefined)).toEqual({ cells: {}, cooldown: 0 });
    const h = loadHeat({ cooldown: -5, cells: { "0,0": { heat: 500, x: 1, z: 2 }, bad: { heat: "x" } } });
    expect(h.cooldown).toBe(0);
    expect(h.cells["0,0"].heat).toBe(100);
    expect(h.cells.bad).toBeUndefined();
  });
});
