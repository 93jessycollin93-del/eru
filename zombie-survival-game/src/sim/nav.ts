/**
 * Navigation grid and A* pathfinding. Engine-agnostic.
 *
 * The walkable area is a uniform grid; blocked cells are inflated by the agent
 * radius when built. Doors and windows are open cells with an extra cost, so a
 * route goes through one only when that beats walking round. Paths are
 * 8-connected (no corner cutting) and then string-pulled into straight segments.
 */

export interface NavGrid {
  /** World coordinate of cell (0,0)'s corner. */
  originX: number;
  originZ: number;
  cell: number;
  width: number;
  height: number;
  /** 1 = blocked. */
  blocked: Uint8Array;
  /** Extra cost (in cells) of entering each cell; 0 = free. Rewritten only when a door or window changes state. */
  cost: Uint8Array;
}

export interface Box2 {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function createNavGrid(originX: number, originZ: number, sizeX: number, sizeZ: number, cell: number): NavGrid {
  const width = Math.ceil(sizeX / cell);
  const height = Math.ceil(sizeZ / cell);
  return { originX, originZ, cell, width, height, blocked: new Uint8Array(width * height), cost: new Uint8Array(width * height) };
}

/**
 * Mark a box (inflated by radius) as blocked. A cell counts as blocked when its
 * centre is inside, so narrow doorways stay open.
 */
export function blockBox(g: NavGrid, b: Box2, radius: number) {
  const x0 = Math.max(0, Math.ceil((b.minX - radius - g.originX) / g.cell - 0.5));
  const x1 = Math.min(g.width - 1, Math.floor((b.maxX + radius - g.originX) / g.cell - 0.5));
  const z0 = Math.max(0, Math.ceil((b.minZ - radius - g.originZ) / g.cell - 0.5));
  const z1 = Math.min(g.height - 1, Math.floor((b.maxZ + radius - g.originZ) / g.cell - 0.5));
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) g.blocked[z * g.width + x] = 1;
}

/**
 * Indices of the cells whose centre lies in the box, half-open (min <= centre < max),
 * clamped to the grid. The half-open bounds mean `{min: w - cell/2, max: w + cell/2}`
 * holds exactly one cell centre for any coordinate w, so that box (on the wall's centre
 * line, spanning the opening) is the one-cell strip a door or window is charged on.
 */
export function cellsInBox(g: NavGrid, b: Box2): number[] {
  // First index whose centre is >= v. Nudged down a hair so float noise can't flip a bound
  // that lands exactly on a centre, which is where both strip edges sit when the wall line
  // falls on a cell boundary.
  const first = (v: number, origin: number) => Math.ceil((v - origin) / g.cell - 0.5 - 1e-6);
  const x0 = Math.max(0, first(b.minX, g.originX));
  const x1 = Math.min(g.width, first(b.maxX, g.originX)) - 1;
  const z0 = Math.max(0, first(b.minZ, g.originZ));
  const z1 = Math.min(g.height, first(b.maxZ, g.originZ)) - 1;
  const out: number[] = [];
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) out.push(z * g.width + x);
  return out;
}

/** Set the extra traversal cost of cells, rounded and clamped to 0..255. */
export function setCellCost(g: NavGrid, cells: readonly number[], cost: number) {
  const c = Math.min(255, Math.max(0, Math.round(cost)));
  for (const i of cells) g.cost[i] = c;
}

export const toCell = (g: NavGrid, x: number, z: number): [number, number] => [
  Math.floor((x - g.originX) / g.cell),
  Math.floor((z - g.originZ) / g.cell),
];

export const cellCenter = (g: NavGrid, cx: number, cz: number): [number, number] => [
  g.originX + (cx + 0.5) * g.cell,
  g.originZ + (cz + 0.5) * g.cell,
];

export const inGrid = (g: NavGrid, cx: number, cz: number) => cx >= 0 && cz >= 0 && cx < g.width && cz < g.height;

export function isBlocked(g: NavGrid, cx: number, cz: number): boolean {
  return !inGrid(g, cx, cz) || g.blocked[cz * g.width + cx] === 1;
}

/** Nearest open cell to (cx, cz) within a small radius, for starts/goals that land in a wall. */
function nearestOpen(g: NavGrid, cx: number, cz: number, maxR = 4): [number, number] | null {
  if (!isBlocked(g, cx, cz)) return [cx, cz];
  for (let r = 1; r <= maxR; r++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        if (!isBlocked(g, cx + dx, cz + dz)) return [cx + dx, cz + dz];
      }
    }
  }
  return null;
}

/** Straight line between two cells crosses no blocked cell (supercover walk). */
export function gridLineClear(g: NavGrid, ax: number, az: number, bx: number, bz: number): boolean {
  let x = ax;
  let z = az;
  const dx = Math.abs(bx - ax);
  const dz = Math.abs(bz - az);
  const sx = bx > ax ? 1 : -1;
  const sz = bz > az ? 1 : -1;
  let err = dx - dz;
  for (let i = 0; i <= dx + dz; i++) {
    if (isBlocked(g, x, z)) return false;
    if (x === bx && z === bz) return true;
    const e2 = 2 * err;
    // Step both axes separately so diagonal moves can't slip between two blocked cells.
    if (e2 > -dz) {
      err -= dz;
      x += sx;
    } else if (e2 < dx) {
      err += dx;
      z += sz;
    }
  }
  return true;
}

/**
 * Sight line for string-pulling: the segment between the two cell centres touches no
 * blocked cell and no costed cell other than its own ends. Unlike gridLineClear's walk,
 * which can skip a cell the line clips by up to half a cell, this visits every cell the
 * segment enters, so a smoothed path can't graze a door or window the route went round.
 */
function pullLineClear(g: NavGrid, ax: number, az: number, bx: number, bz: number): boolean {
  const dx = Math.abs(bx - ax);
  const dz = Math.abs(bz - az);
  const sx = bx > ax ? 1 : -1;
  const sz = bz > az ? 1 : -1;
  let x = ax;
  let z = az;
  for (let ix = 0, iz = 0; ; ) {
    if (isBlocked(g, x, z)) return false;
    if (x === bx && z === bz) return true;
    if ((ix || iz) && g.cost[z * g.width + x] > 0) return false;
    // Step across whichever cell edge the segment reaches first.
    const d = (1 + 2 * ix) * dz - (1 + 2 * iz) * dx;
    if (d < 0) {
      x += sx;
      ix++;
    } else if (d > 0) {
      z += sz;
      iz++;
    } else {
      // Exactly through a corner: same no-corner-cutting rule as the search.
      if (isBlocked(g, x + sx, z) || isBlocked(g, x, z + sz)) return false;
      x += sx;
      z += sz;
      ix++;
      iz++;
    }
  }
}

/** Scratch arrays reused across searches (stamped, so nothing needs clearing). */
interface Workspace {
  stamp: number;
  seen: Uint32Array;
  closed: Uint32Array;
  g: Float32Array;
  came: Int32Array;
}
const workspaces = new WeakMap<NavGrid, Workspace>();
function workspace(g: NavGrid): Workspace {
  let ws = workspaces.get(g);
  if (!ws) {
    const n = g.width * g.height;
    ws = { stamp: 0, seen: new Uint32Array(n), closed: new Uint32Array(n), g: new Float32Array(n), came: new Int32Array(n) };
    workspaces.set(g, ws);
  }
  return ws;
}

class MinHeap {
  private items: number[] = [];
  private keys: number[] = [];
  get size() {
    return this.items.length;
  }
  push(item: number, key: number) {
    this.items.push(item);
    this.keys.push(key);
    let i = this.items.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p] <= this.keys[i]) break;
      [this.items[p], this.items[i]] = [this.items[i], this.items[p]];
      [this.keys[p], this.keys[i]] = [this.keys[i], this.keys[p]];
      i = p;
    }
  }
  pop(): number {
    const top = this.items[0];
    const lastI = this.items.pop()!;
    const lastK = this.keys.pop()!;
    if (this.items.length) {
      this.items[0] = lastI;
      this.keys[0] = lastK;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < this.items.length && this.keys[l] < this.keys[m]) m = l;
        if (r < this.items.length && this.keys[r] < this.keys[m]) m = r;
        if (m === i) break;
        [this.items[m], this.items[i]] = [this.items[i], this.items[m]];
        [this.keys[m], this.keys[i]] = [this.keys[i], this.keys[m]];
        i = m;
      }
    }
    return top;
  }
}

/**
 * Find a path between two world points. Returns world-space waypoints
 * (excluding the start), or null if there is no path within maxExpansions.
 * Entering a cell costs its step length plus its `cost`.
 */
export function findPath(g: NavGrid, sx: number, sz: number, gx: number, gz: number, maxExpansions = 8000): [number, number][] | null {
  const s0 = toCell(g, sx, sz);
  const g0 = toCell(g, gx, gz);
  const start = nearestOpen(g, s0[0], s0[1]);
  const goal = nearestOpen(g, g0[0], g0[1]);
  if (!start || !goal) return null;
  const W = g.width;
  const startI = start[1] * W + start[0];
  const goalI = goal[1] * W + goal[0];
  if (startI === goalI) return [[gx, gz]];

  const ws = workspace(g);
  const stamp = ++ws.stamp;
  const gOf = (i: number) => (ws.seen[i] === stamp ? ws.g[i] : Infinity);
  const open = new MinHeap();
  const h = (i: number) => {
    const dx = Math.abs((i % W) - goal[0]);
    const dz = Math.abs(Math.floor(i / W) - goal[1]);
    return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
  };
  ws.seen[startI] = stamp;
  ws.g[startI] = 0;
  ws.came[startI] = -1;
  open.push(startI, h(startI));
  let expansions = 0;
  let found = false;
  while (open.size) {
    const cur = open.pop();
    if (cur === goalI) {
      found = true;
      break;
    }
    if (ws.closed[cur] === stamp) continue;
    ws.closed[cur] = stamp;
    if (++expansions > maxExpansions) return null;
    const cx = cur % W;
    const cz = (cur - cx) / W;
    const base = ws.g[cur];
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cx + dx;
        const nz = cz + dz;
        if (isBlocked(g, nx, nz)) continue;
        // No cutting corners past walls.
        if (dx && dz && (isBlocked(g, cx + dx, cz) || isBlocked(g, cx, cz + dz))) continue;
        const ni = nz * W + nx;
        if (ws.closed[ni] === stamp) continue;
        // Costs only add, so the octile heuristic stays admissible.
        const ng = base + (dx && dz ? Math.SQRT2 : 1) + g.cost[ni];
        if (ng < gOf(ni)) {
          ws.seen[ni] = stamp;
          ws.g[ni] = ng;
          ws.came[ni] = cur;
          open.push(ni, ng + h(ni));
        }
      }
    }
  }
  if (!found) return null;
  const came = { get: (i: number) => (ws.came[i] >= 0 ? ws.came[i] : undefined) };

  // Rebuild, then string-pull: keep only the corners we can't see past. Costed cells block
  // sight (bar a line's ends), so the cell where the route crosses a door or window becomes
  // a waypoint and no segment cuts through one the route went round.
  const cells: number[] = [];
  for (let c: number | undefined = goalI; c !== undefined && c !== startI; c = came.get(c)) cells.push(c);
  cells.reverse();
  const out: [number, number][] = [];
  let anchor = startI;
  for (let i = 0; i < cells.length; i++) {
    const next = cells[i + 1];
    if (next === undefined || !pullLineClear(g, anchor % W, Math.floor(anchor / W), next % W, Math.floor(next / W))) {
      const c = cells[i];
      out.push(cellCenter(g, c % W, Math.floor(c / W)));
      anchor = c;
    }
  }
  // Finish exactly at the goal point.
  out[out.length - 1] = [gx, gz];
  return out;
}
