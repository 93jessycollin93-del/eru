/** Axis-aligned box used for world collision and line-of-sight checks. */
export interface AABB {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
  /** Blocks sight (walls do, low fences and tables don't). Barriers flip this as they change. */
  occludes: boolean;
  /** false = switched off (an open door); queries skip it. */
  enabled?: boolean;
  /** The door or window this box belongs to (sill, leaf or pane). */
  barrierId?: number;
  /** A glass pane: bullets can pass through (and break it). */
  glass?: boolean;
}

/** Filled in by raycast with the box that was hit, if any. */
export interface RayHit {
  box: AABB | null;
}

const CELL = 8;

/**
 * Uniform grid over the XZ plane so collision and ray queries only test
 * nearby boxes instead of every box in the world.
 */
export class ColliderWorld {
  readonly boxes: AABB[] = [];
  private grid = new Map<string, number[]>();
  private stamp = 0;
  private marks: number[] = [];

  /** Add a box; returns its index for setEnabled. */
  add(box: AABB): number {
    const index = this.boxes.length;
    this.boxes.push(box);
    this.marks.push(0);
    for (let cx = Math.floor(box.minX / CELL); cx <= Math.floor(box.maxX / CELL); cx++) {
      for (let cz = Math.floor(box.minZ / CELL); cz <= Math.floor(box.maxZ / CELL); cz++) {
        const key = `${cx},${cz}`;
        let cell = this.grid.get(key);
        if (!cell) this.grid.set(key, (cell = []));
        cell.push(index);
      }
    }
    return index;
  }

  /** Switch a box on or off (doors opening and closing). */
  setEnabled(index: number, on: boolean) {
    this.boxes[index].enabled = on;
  }

  /** Visit each box overlapping the XZ rectangle once. */
  private query(minX: number, minZ: number, maxX: number, maxZ: number, visit: (b: AABB) => void) {
    this.stamp++;
    for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx++) {
      for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz++) {
        const cell = this.grid.get(`${cx},${cz}`);
        if (!cell) continue;
        for (const i of cell) {
          if (this.marks[i] === this.stamp) continue;
          this.marks[i] = this.stamp;
          const b = this.boxes[i];
          if (b.enabled === false) continue;
          visit(b);
        }
      }
    }
  }

  /**
   * Push a vertical cylinder (character) out of any boxes it overlaps.
   * Mutates pos. Returns true if a collision happened.
   */
  resolveCylinder(pos: { x: number; z: number }, radius: number, feetY: number, height: number): boolean {
    let hit = false;
    // Two passes handle corners where two boxes meet.
    for (let pass = 0; pass < 2; pass++) {
      this.query(pos.x - radius, pos.z - radius, pos.x + radius, pos.z + radius, (b) => {
        if (feetY + height <= b.minY || feetY >= b.maxY - 0.35) return; // step over low things
        const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
        const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
        const dx = pos.x - cx;
        const dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= radius * radius) return;
        hit = true;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          pos.x = cx + (dx / d) * radius;
          pos.z = cz + (dz / d) * radius;
        } else {
          // Centre is inside the box: push out along the shallowest axis.
          const pushes = [
            [b.minX - radius - pos.x, 0],
            [b.maxX + radius - pos.x, 0],
            [0, b.minZ - radius - pos.z],
            [0, b.maxZ + radius - pos.z],
          ];
          pushes.sort((a, c) => Math.abs(a[0] + a[1]) - Math.abs(c[0] + c[1]));
          pos.x += pushes[0][0];
          pos.z += pushes[0][1];
        }
      });
    }
    return hit;
  }

  /** Highest box top under a point that a character standing at feetY could step onto. */
  supportHeight(x: number, z: number, feetY: number): number {
    let best = -Infinity;
    this.query(x, z, x, z, (b) => {
      if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) return;
      if (b.maxY <= feetY + 0.4 && b.maxY > best) best = b.maxY;
    });
    return best;
  }

  /**
   * Distance along a normalised ray to the first box hit, or maxDist.
   * Set occludersOnly to ignore boxes that don't block sight, skipGlass to
   * see through window panes. `out.box` receives the box that was hit.
   */
  raycast(
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    maxDist: number,
    occludersOnly = false,
    out?: RayHit,
    skipGlass = false,
  ): number {
    let best = maxDist;
    if (out) out.box = null;
    const ex = ox + dx * maxDist;
    const ez = oz + dz * maxDist;
    const inv = (v: number) => (Math.abs(v) < 1e-9 ? 1e9 : 1 / v);
    const ix = inv(dx);
    const iy = inv(dy);
    const iz = inv(dz);
    this.query(Math.min(ox, ex), Math.min(oz, ez), Math.max(ox, ex), Math.max(oz, ez), (b) => {
      if (occludersOnly && !b.occludes) return;
      if (skipGlass && b.glass) return;
      let t1 = (b.minX - ox) * ix;
      let t2 = (b.maxX - ox) * ix;
      let tmin = Math.min(t1, t2);
      let tmax = Math.max(t1, t2);
      t1 = (b.minY - oy) * iy;
      t2 = (b.maxY - oy) * iy;
      tmin = Math.max(tmin, Math.min(t1, t2));
      tmax = Math.min(tmax, Math.max(t1, t2));
      t1 = (b.minZ - oz) * iz;
      t2 = (b.maxZ - oz) * iz;
      tmin = Math.max(tmin, Math.min(t1, t2));
      tmax = Math.min(tmax, Math.max(t1, t2));
      if (tmax >= Math.max(tmin, 0) && tmin < best) {
        best = Math.max(0, tmin);
        if (out) out.box = b;
      }
    });
    return best;
  }

  /** True if nothing that blocks sight lies between the two points. */
  lineOfSight(ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean {
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    const d = Math.hypot(dx, dy, dz);
    if (d < 1e-6) return true;
    return this.raycast(ax, ay, az, dx / d, dy / d, dz / d, d, true) >= d - 0.05;
  }
}
