import { describe, expect, it } from "vitest";
import { defaultLoads, fuelPerHour, refuel, resetBreaker, startGenerator, stepPower, type Generator, type PowerWorld } from "./power";

function world(): PowerWorld {
  return {
    gridFailsAt: 600,
    circuits: {
      police: { buildingId: "police", loads: defaultLoads("police", true), ups: { capacityWh: 2000, chargeWh: 2000, chargeW: 300 } },
      house: { buildingId: "house", loads: defaultLoads("house", true), ups: null },
    },
    generators: [],
  };
}

const gen = (over: Partial<Generator> = {}): Generator => ({
  id: "g",
  name: "Gen",
  ratedW: 3000,
  tankL: 6,
  fuelL: 6,
  running: false,
  tripped: false,
  autoStart: false,
  buildingId: "house",
  portable: true,
  noiseRadius: 30,
  ...over,
});

describe("grid and UPS", () => {
  it("the grid powers everything until it fails", () => {
    const w = world();
    const { status } = stepPower(w, 300, 1);
    expect(status.house.source).toBe("grid");
    expect(status.police.powered.has("lights")).toBe(true);
  });

  it("after the grid fails the police UPS carries only critical loads for about 8 hours", () => {
    const w = world();
    const { status, events } = stepPower(w, 601, 2);
    expect(events.some((e) => e.type === "gridDown")).toBe(true);
    expect(status.police.source).toBe("ups");
    expect(status.police.powered.has("network")).toBe(true);
    expect(status.police.powered.has("lights")).toBe(false);
    expect(status.house.source).toBe("none");
    let minute = 601;
    let hours = 0;
    while (stepPower(w, ++minute, 1).status.police.source === "ups") hours += 1 / 60;
    expect(hours).toBeGreaterThan(7.5);
    expect(hours).toBeLessThan(8.5);
  });
});

describe("generators", () => {
  it("burn fuel faster under heavier load (3 kW unit: ~0.3 L/h idle, ~1.4 L/h flat out)", () => {
    expect(fuelPerHour(3000, 0)).toBeCloseTo(0.3);
    expect(fuelPerHour(3000, 3000)).toBeCloseTo(1.4);
  });

  it("power a house after the grid fails, and run dry in a realistic time", () => {
    const w = world();
    const g = gen();
    w.generators.push(g);
    expect(startGenerator(g)).toBeNull();
    let minute = 700;
    expect(stepPower(w, minute, 1).status.house.source).toBe("generator");
    // House draws 672 W: 0.3 + 1.1*0.224 ≈ 0.55 L/h → a 6 L tank lasts ~11 h.
    let hours = 0;
    let out = false;
    while (!out && hours < 24) {
      out = stepPower(w, ++minute, 1).events.some((e) => e.type === "generatorOutOfFuel");
      hours += 1 / 60;
    }
    expect(hours).toBeGreaterThan(9);
    expect(hours).toBeLessThan(13);
    expect(stepPower(w, ++minute, 1).status.house.source).toBe("none");
  });

  it("trip their breaker when overloaded and only reset once the load drops", () => {
    const w = world();
    const g = gen({ ratedW: 500, buildingId: "house", running: true });
    w.generators.push(g);
    const { status, events } = stepPower(w, 700, 1);
    expect(events.some((e) => e.type === "generatorTripped")).toBe(true);
    expect(status.house.source).toBe("none");
    expect(resetBreaker(w, g)).toContain("Still too much load");
    for (const l of w.circuits.house.loads) if (l.kind === "lights" || l.kind === "appliances") l.on = false;
    expect(resetBreaker(w, g)).toBeNull();
    expect(stepPower(w, 701, 1).status.house.source).toBe("generator");
  });

  it("standby units start themselves when the grid fails, if they have fuel", () => {
    const w = world();
    const standby = gen({ id: "s", ratedW: 8000, tankL: 40, fuelL: 0, autoStart: true, buildingId: "police", portable: false });
    w.generators.push(standby);
    stepPower(w, 601, 2);
    expect(standby.running).toBe(false);
    const w2 = world();
    const fuelled = gen({ id: "s", ratedW: 8000, tankL: 40, fuelL: 10, autoStart: true, buildingId: "police", portable: false });
    w2.generators.push(fuelled);
    const { status, events } = stepPower(w2, 601, 2);
    expect(events.some((e) => e.type === "generatorAutoStarted")).toBe(true);
    expect(status.police.source).toBe("generator");
    expect(status.police.powered.has("lights")).toBe(true);
  });

  it("refuelling never overfills", () => {
    const g = gen({ fuelL: 5 });
    expect(refuel(g, 10)).toBe(1);
    expect(g.fuelL).toBe(6);
    expect(startGenerator(gen({ fuelL: 0 }))).toBe("The tank is empty.");
  });
});
