import { describe, expect, it } from "vitest";
import { mulberry32 } from "./rng";

describe("mulberry32", () => {
  it("keeps the exact sequence the town was built with", () => {
    const r = mulberry32(1987);
    expect(Array.from({ length: 5 }, () => r())).toEqual([0.027248888509348035, 0.186082161962986, 0.527114175260067, 0.8069549291394651, 0.37699397234246135]);
    const r2 = mulberry32(2018);
    for (let i = 0; i < 1000; i++) r2();
    expect(r2()).toBe(0.19030366837978363);
  });

  it("continues the same sequence from a saved state", () => {
    const r = mulberry32(42);
    for (let i = 0; i < 37; i++) r();
    const saved = JSON.parse(JSON.stringify(r.state()));
    const expected = Array.from({ length: 20 }, () => r());
    const restored = mulberry32(0);
    restored.setState(saved);
    expect(Array.from({ length: 20 }, () => restored())).toEqual(expected);
  });
});
