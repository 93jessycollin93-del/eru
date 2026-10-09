import { describe, expect, it } from "vitest";
import { blockBox, createNavGrid, findPath, gridLineClear, toCell } from "./nav";

/** A 40 m square with a 20 m wall across the middle, open at both ends. */
function wallGrid() {
  const g = createNavGrid(-20, -20, 40, 40, 0.5);
  blockBox(g, { minX: -10, maxX: 10, minZ: -0.25, maxZ: 0.25 }, 0.35);
  return g;
}

const length = (start: [number, number], pts: [number, number][]) => {
  let d = 0;
  let prev = start;
  for (const p of pts) {
    d += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    prev = p;
  }
  return d;
};

describe("pathfinding", () => {
  it("goes around a wall instead of through it", () => {
    const g = wallGrid();
    const path = findPath(g, 0, -5, 0, 5)!;
    expect(path).not.toBeNull();
    // Must pass an end of the wall (|x| > 10).
    expect(path.some(([x]) => Math.abs(x) > 10)).toBe(true);
    // And be near-optimal: about 2 * sqrt(10.6^2 + 5^2) ≈ 23.4 m.
    expect(length([0, -5], path)).toBeLessThan(26);
    expect(path[path.length - 1]).toEqual([0, 5]);
  });

  it("string-pulls open ground into a single straight segment", () => {
    const g = createNavGrid(-20, -20, 40, 40, 0.5);
    const path = findPath(g, -15, -15, 15, 12)!;
    expect(path).toHaveLength(1);
  });

  it("uses a doorway in a wall", () => {
    const g = createNavGrid(-20, -20, 40, 40, 0.5);
    // Wall across the whole map with a 1.6 m door at x = 4.
    blockBox(g, { minX: -20, maxX: 3.2, minZ: -0.2, maxZ: 0.2 }, 0.35);
    blockBox(g, { minX: 4.8, maxX: 20, minZ: -0.2, maxZ: 0.2 }, 0.35);
    const path = findPath(g, 0, -6, 0, 6)!;
    expect(path).not.toBeNull();
    expect(path.some(([x, z]) => Math.abs(z) < 1.5 && x > 3 && x < 5)).toBe(true);
  });

  it("returns null when the goal is sealed off", () => {
    const g = createNavGrid(-20, -20, 40, 40, 0.5);
    blockBox(g, { minX: 4, maxX: 10, minZ: 4, maxZ: 4.4 }, 0);
    blockBox(g, { minX: 4, maxX: 10, minZ: 9.6, maxZ: 10 }, 0);
    blockBox(g, { minX: 4, maxX: 4.4, minZ: 4, maxZ: 10 }, 0);
    blockBox(g, { minX: 9.6, maxX: 10, minZ: 4, maxZ: 10 }, 0);
    expect(findPath(g, -10, -10, 7, 7)).toBeNull();
  });

  it("line of sight on the grid respects walls", () => {
    const g = wallGrid();
    const a = toCell(g, 0, -5);
    const b = toCell(g, 0, 5);
    expect(gridLineClear(g, a[0], a[1], b[0], b[1])).toBe(false);
    const c = toCell(g, 15, -5);
    const d = toCell(g, 15, 5);
    expect(gridLineClear(g, c[0], c[1], d[0], d[1])).toBe(true);
  });
});
