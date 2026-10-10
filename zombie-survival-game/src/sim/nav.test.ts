import { describe, expect, it } from "vitest";
import { blockBox, cellsInBox, createNavGrid, findPath, gridLineClear, setCellCost, toCell, type NavGrid } from "./nav";

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

// Costed cells, built the way the game does it: walls inflated by 0.3 m on a 0.25 m grid,
// with a door or window charged on a one-cell strip along the wall's centre line.
const CELL = 0.25;

/** A wall along z = 0 across a 20 m square, with openings given as [x0, x1]. */
function gappedWall(openings: [number, number][]) {
  const g = createNavGrid(-10, -10, 20, 20, CELL);
  const edges = [-10, ...openings.flat(), 10];
  for (let i = 0; i < edges.length; i += 2) blockBox(g, { minX: edges[i], maxX: edges[i + 1], minZ: -0.1, maxZ: 0.1 }, 0.3);
  return g;
}

/** The one-cell strip across an opening on the wall line z = w. */
const strip = (g: NavGrid, x0: number, x1: number, w = 0) =>
  cellsInBox(g, { minX: x0, maxX: x1, minZ: w - g.cell / 2, maxZ: w + g.cell / 2 });

/** The path has a waypoint in the wall opening centred on x. */
const via = (path: [number, number][], x: number) => path.some(([px, pz]) => Math.abs(px - x) < 0.75 && Math.abs(pz) < 0.75);

/** Every cell the path (from start) passes through, sampled finely. */
function cellsTouched(g: NavGrid, start: [number, number], path: [number, number][]) {
  const out = new Set<number>();
  let prev = start;
  for (const p of path) {
    const n = Math.ceil(Math.hypot(p[0] - prev[0], p[1] - prev[1]) / (g.cell / 8)) + 1;
    // Off-grid sample offsets so no sample lands exactly on a cell corner.
    for (let k = 0; k < n; k++) {
      const t = (k + 0.37) / n;
      const [cx, cz] = toCell(g, prev[0] + (p[0] - prev[0]) * t, prev[1] + (p[1] - prev[1]) * t);
      out.add(cz * g.width + cx);
    }
    prev = p;
  }
  return out;
}

describe("costed cells", () => {
  const A: [number, number] = [0, -3];
  const B: [number, number] = [0, 3];
  const route = (g: NavGrid) => findPath(g, A[0], A[1], B[0], B[1])!;

  it("charges a costed one-cell strip once", () => {
    // Door at x = 0, free gap at x = 3.5.
    const g = gappedWall([[-0.6, 0.6], [2.9, 4.1]]);
    const door = strip(g, -0.6, 0.6);
    setCellCost(g, door, 255);
    const detourCells = (length(A, route(g)) - 6) / CELL;
    expect(via(route(g), 3.5)).toBe(true);
    // The cheapest door cost that sends the route round by the gap should match the detour
    // (grid paths run up to ~8% longer than the smoothed line). Charging the strip twice
    // would halve it.
    let flip = 0;
    for (; flip <= 40; flip++) {
      setCellCost(g, door, flip);
      if (via(route(g), 3.5)) break;
    }
    expect(flip).toBeGreaterThanOrEqual(Math.floor(detourCells));
    expect(flip).toBeLessThanOrEqual(Math.ceil(detourCells * 1.15));
  });

  it("detours ~2 m round a door costing 12, but goes through rather than detour ~6 m", () => {
    const near = gappedWall([[-0.6, 0.6], [1.9, 3.1]]);
    setCellCost(near, strip(near, -0.6, 0.6), 12);
    const short = route(near);
    expect(via(short, 2.5)).toBe(true);
    expect(via(short, 0)).toBe(false);
    expect(length(A, short) - 6).toBeLessThan(2.2);

    const far = gappedWall([[-0.6, 0.6], [4.4, 5.6]]);
    setCellCost(far, strip(far, -0.6, 0.6), 12);
    const through = route(far);
    expect(via(through, 0)).toBe(true);
    expect(via(through, 5)).toBe(false);
  });

  it("flips the route when a cost changes, without rebuilding the grid", () => {
    const g = gappedWall([[-0.6, 0.6], [4.4, 5.6]]);
    const door = strip(g, -0.6, 0.6);
    setCellCost(g, door, 12);
    expect(via(route(g), 0)).toBe(true);
    setCellCost(g, door, 40);
    expect(via(route(g), 5)).toBe(true);
    setCellCost(g, door, 12);
    expect(via(route(g), 0)).toBe(true);
  });

  it("setCellCost rounds and clamps to a byte", () => {
    const g = createNavGrid(0, 0, 1, 1, CELL);
    setCellCost(g, [0], 7.6);
    setCellCost(g, [1], -3);
    setCellCost(g, [2], 300);
    expect([...g.cost.slice(0, 3)]).toEqual([8, 0, 255]);
  });

  it("makes the cell where the route crosses a costed strip a waypoint", () => {
    const g = gappedWall([[-1, 1]]);
    const door = strip(g, -1, 1);
    const nearStrip = (path: [number, number][]) => path.some(([, z]) => Math.abs(z) <= CELL);
    const free = findPath(g, -1.5, -4, 1.5, 4)!;
    expect(nearStrip(free)).toBe(false);
    setCellCost(g, door, 4);
    const costed = findPath(g, -1.5, -4, 1.5, 4)!;
    expect(nearStrip(costed)).toBe(true);
    expect(length([-1.5, -4], costed)).toBeLessThan(length([-1.5, -4], free) + 0.1);
  });

  it("never smooths a path through a window the route went round", () => {
    // A shopfront: one opening, window glass over x < 1 and a free doorway beside it.
    const g = gappedWall([[-3, 3]]);
    const glass = strip(g, -3, 1);
    setCellCost(g, glass, 40);
    const start: [number, number] = [-2, -3];
    const path = findPath(g, start[0], start[1], -2, 3)!;
    expect(path.some(([x, z]) => x > 0.75 && Math.abs(z) < 0.75)).toBe(true);
    const touched = cellsTouched(g, start, path);
    expect(glass.filter((i) => touched.has(i))).toEqual([]);
  });

  it("finds a way into a closed room through costed openings within the game's budget", () => {
    // 10 x 10 m room whose only ways in are a west door (36) and a north window (28).
    const g = createNavGrid(-30, -30, 60, 60, CELL);
    const t = 0.1;
    const walls = [
      { minX: -5 - t, maxX: 5 + t, minZ: -5 - t, maxZ: -5 + t },
      { minX: 5 - t, maxX: 5 + t, minZ: -5 - t, maxZ: 5 + t },
      { minX: -5 - t, maxX: -5 + t, minZ: -5 - t, maxZ: -0.6 },
      { minX: -5 - t, maxX: -5 + t, minZ: 0.6, maxZ: 5 + t },
      { minX: -5 - t, maxX: -0.6, minZ: 5 - t, maxZ: 5 + t },
      { minX: 0.6, maxX: 5 + t, minZ: 5 - t, maxZ: 5 + t },
    ];
    for (const w of walls) blockBox(g, w, 0.3);
    setCellCost(g, cellsInBox(g, { minX: -5 - CELL / 2, maxX: -5 + CELL / 2, minZ: -0.6, maxZ: 0.6 }), 36);
    setCellCost(g, cellsInBox(g, { minX: -0.6, maxX: 0.6, minZ: 5 - CELL / 2, maxZ: 5 + CELL / 2 }), 28);
    const nearWest = ([x, z]: [number, number]) => Math.abs(x + 5) < 0.75 && Math.abs(z) < 0.75;
    const nearNorth = ([x, z]: [number, number]) => Math.abs(x) < 0.75 && Math.abs(z - 5) < 0.75;

    const fromWest = findPath(g, -20, 0, 1, 1.5, 9000)!;
    expect(fromWest).not.toBeNull();
    expect(fromWest.some(nearWest)).toBe(true);
    expect(fromWest[fromWest.length - 1]).toEqual([1, 1.5]);

    // Equally far from both openings, so it takes the cheaper window.
    const fromNorthWest = findPath(g, -14.1, 14.1, 1, 1.5, 9000)!;
    expect(fromNorthWest).not.toBeNull();
    expect(fromNorthWest.some(nearNorth)).toBe(true);
  });
});

describe("cellsInBox", () => {
  // Deliberately awkward origin so cell edges and centres fall on untidy coordinates.
  const g = createNavGrid(-7.3, 2.1, 10, 10, CELL);
  const centre = (i: number, origin: number) => origin + (i + 0.5) * CELL;

  it("a strip one cell thick holds exactly one row on any line", () => {
    const cols = Array.from({ length: g.width }, (_, x) => x).filter((x) => centre(x, g.originX) >= -5 && centre(x, g.originX) < 0);
    // Cell edges (where both strip bounds land on centres), one reached with float noise,
    // a cell centre, then arbitrary lines.
    const lines = [2.1 + 4 * CELL, 6.1, (6.1 * 10 + 1) / 10 - 0.1, 2.1 + 4.5 * CELL, 7.123456, 11.9];
    for (let k = 0; k < 200; k++) lines.push(2.2 + 9.7 * ((k * 0.6180339887) % 1));
    for (const w of lines) {
      const cells = cellsInBox(g, { minX: -5, maxX: 0, minZ: w - CELL / 2, maxZ: w + CELL / 2 });
      const rows = new Set(cells.map((i) => Math.floor(i / g.width)));
      expect(rows.size).toBe(1);
      expect(cells.length).toBe(cols.length);
      const zc = centre([...rows][0], g.originZ);
      expect(Math.abs(zc - w)).toBeLessThanOrEqual(CELL / 2 + 1e-9);
    }
  });

  it("is half-open: a centre on the min edge is in, one on the max edge is out", () => {
    const zc = centre(10, g.originZ);
    const cells = cellsInBox(g, { minX: -7.3, maxX: -7.3 + CELL, minZ: zc, maxZ: zc + CELL });
    expect(cells).toEqual([10 * g.width]);
    expect(cellsInBox(g, { minX: -7.3, maxX: -7.3 + CELL, minZ: zc - CELL, maxZ: zc })).toEqual([9 * g.width]);
  });

  it("clamps to the grid", () => {
    const all = cellsInBox(g, { minX: -100, maxX: 100, minZ: -100, maxZ: 100 });
    expect(all).toHaveLength(g.width * g.height);
    expect(new Set(all).size).toBe(all.length);
    expect(Math.min(...all)).toBe(0);
    expect(Math.max(...all)).toBe(g.width * g.height - 1);
    expect(cellsInBox(g, { minX: -100, maxX: -50, minZ: 0, maxZ: 100 })).toEqual([]);
    // Overhanging the left and bottom edges keeps just the first four columns of the first row.
    expect(cellsInBox(g, { minX: -100, maxX: -7.3 + 4 * CELL, minZ: -100, maxZ: 2.1 + CELL })).toEqual([0, 1, 2, 3]);
  });
});
