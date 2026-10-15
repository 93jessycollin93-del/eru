import { describe, expect, it } from "vitest";
import { deriveSeed, mulberry32 } from "./rng";

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

describe("deriveSeed", () => {
  it("is a fixed uint32 function of seed and salt", () => {
    const v = [deriveSeed(0, 0), deriveSeed(1, 1), deriveSeed(42, 7), deriveSeed(4294967295, 3)];
    for (const x of v) expect(Number.isInteger(x) && x >= 0 && x < 2 ** 32).toBe(true);
    expect(v).toMatchInlineSnapshot(`
      [
        0,
        920564995,
        215254286,
        3834300474,
      ]
    `);
  });

  it("different salts give unrelated streams", () => {
    const a = mulberry32(deriveSeed(99, 1));
    const b = mulberry32(deriveSeed(99, 2));
    let same = 0;
    for (let i = 0; i < 100; i++) if (Math.abs(a() - b()) < 0.01) same++;
    expect(same).toBeLessThan(6);
    const salts = new Set(Array.from({ length: 64 }, (_, i) => deriveSeed(12345, i)));
    expect(salts.size).toBe(64);
  });
});
