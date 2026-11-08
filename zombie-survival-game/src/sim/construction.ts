/**
 * Construction: what a building's walls are made of, the frame inside them, and the wiring that
 * runs through that frame.
 *
 * Every wall is an assembly of real layers, outside to inside: vinyl siding over plywood sheathing
 * over 2×4 studs with fibreglass in the cavities, behind half-inch drywall; or brick veneer in front
 * of the same frame; or concrete block for shops. Walls are worked in bays the width of a drywall
 * sheet (1.22 m): break a bay layer by layer and what's inside is there to take: the studs (planks
 * and nails), the cable (copper inside a PVC jacket), the steel boxes.
 *
 * The wiring is a harness generated from the house's own plan, the way an electrician would run it
 * (NEC rules of thumb): a light and a switch by the door in every room, receptacles so no point
 * along a wall is more than 1.83 m from one, two 20 A small-appliance circuits and a dedicated fridge
 * circuit in a kitchen, 14 AWG on 15 A circuits and 12 AWG on 20 A, home runs from the panel along
 * the walls at receptacle height. It conforms to the frame like a stiff harness clipped into place:
 * every run lies in a known wall at a known height, so a broken bay knows exactly which cables
 * cross it, which circuits die when they're cut, and whether cutting one bites.
 *
 * Pure rules: plans in, frames, harnesses and salvage out.
 */

import { makeStack, type ItemStack } from "./items";
import type { LoadKind } from "./power";

// ------------------------------------------------------------------ layers and assemblies

export type LayerId = "siding" | "brick" | "sheathing" | "studs" | "insulation" | "drywall" | "block" | "plaster";

export interface LayerSpec {
  id: LayerId;
  name: string;
  /** Thickness in metres. */
  thickness: number;
  /** Damage it takes to break through one bay (1.22 m wide, full height). */
  hp: number;
  /** What breaking or stripping one bay of it leaves you, per bay. */
  salvage: [itemId: string, count: number][];
}

export const LAYERS: Record<LayerId, LayerSpec> = {
  siding: { id: "siding", name: "vinyl siding", thickness: 0.01, hp: 25, salvage: [["plastic_scrap", 2]] },
  brick: { id: "brick", name: "brick veneer", thickness: 0.09, hp: 420, salvage: [["brick", 6]] },
  sheathing: { id: "sheathing", name: "plywood sheathing", thickness: 0.012, hp: 70, salvage: [["plank", 1]] },
  // A bay holds three 2×4 studs at 406 mm centres; each comes out as a plank with its nails.
  studs: { id: "studs", name: "2×4 studs", thickness: 0.089, hp: 140, salvage: [["plank", 3], ["nails", 12]] },
  insulation: { id: "insulation", name: "fibreglass insulation", thickness: 0.089, hp: 5, salvage: [["insulation", 1]] },
  drywall: { id: "drywall", name: "drywall", thickness: 0.0127, hp: 30, salvage: [] },
  block: { id: "block", name: "concrete block", thickness: 0.19, hp: 700, salvage: [["scrap_metal", 1]] },
  plaster: { id: "plaster", name: "plaster", thickness: 0.015, hp: 25, salvage: [] },
};

export type Construction = "wood_frame" | "brick_veneer" | "block" | "partition";

/**
 * Layers from outside in. Insulation shares the stud cavity (it's listed after the studs so you meet
 * it as you pull them, and it adds no thickness of its own).
 */
export const ASSEMBLIES: Record<Construction, LayerId[]> = {
  wood_frame: ["siding", "sheathing", "studs", "insulation", "drywall"],
  brick_veneer: ["brick", "sheathing", "studs", "insulation", "drywall"],
  block: ["block", "plaster"],
  // Interior walls: drywall both sides of the frame, no insulation.
  partition: ["drywall", "studs", "drywall"],
};

export const wallThickness = (c: Construction) => ASSEMBLIES[c].reduce((t, l) => t + (l === "insulation" ? 0 : LAYERS[l].thickness), 0);

/** One bay of one wall: its layers' remaining strength, outside first. */
export interface Bay {
  layers: { id: LayerId; hp: number }[];
}

export const BAY_WIDTH = 1.22;

export function makeBay(c: Construction): Bay {
  return { layers: ASSEMBLIES[c].map((id) => ({ id, hp: LAYERS[id].hp })) };
}

/** The layer you're working on from a side ("out" works outside in, "in" inside out). */
export function exposedLayer(bay: Bay, from: "out" | "in"): { id: LayerId; hp: number } | null {
  const order = from === "out" ? bay.layers : [...bay.layers].reverse();
  return order.find((l) => l.hp > 0) ?? null;
}

/** A bay you can walk through: every layer broken. */
export const breached = (bay: Bay) => bay.layers.every((l) => l.hp <= 0);

export interface HitResult {
  /** Layers broken by this hit, in order. */
  broke: LayerId[];
  /** The bay is now open all the way through. */
  breached: boolean;
}

/** Hit a bay from one side. Damage carries into the next layer only from a layer that breaks. */
export function hitBay(bay: Bay, damage: number, from: "out" | "in"): HitResult {
  const broke: LayerId[] = [];
  let left = damage;
  while (left > 0) {
    const l = exposedLayer(bay, from);
    if (!l) break;
    const take = Math.min(l.hp, left);
    l.hp -= take;
    left -= take;
    if (l.hp <= 0) broke.push(l.id);
    else break;
  }
  return { broke, breached: breached(bay) };
}

/** What breaking these layers leaves on the floor. Drywall and plaster are just dust. */
export function salvageFor(layers: LayerId[]): ItemStack[] {
  const out: ItemStack[] = [];
  for (const id of layers) {
    for (const [item, n] of LAYERS[id].salvage) {
      const existing = out.find((s) => s.id === item);
      if (existing) existing.count += n;
      else out.push(makeStack(item, n));
    }
  }
  return out;
}

// ------------------------------------------------------------------ framing

export interface Opening {
  /** Centre along the wall, m from its start. */
  c: number;
  w: number;
  /** Bottom and top heights, m. */
  b: number;
  t: number;
}

export interface Frame {
  /** Positions of full-height studs along the wall, m. */
  studs: number[];
  /** King and jack studs either side of each opening, and cripples above and below. */
  kings: number;
  jacks: number;
  cripples: number;
  /** Doubled 2×6 headers over openings, total length m. */
  headerLength: number;
  /** Bottom plate and doubled top plate, total length m. */
  plateLength: number;
}

export const STUD_SPACING = 0.406;

/** Frame a wall the way a carpenter would: studs at 16-inch centres, openings framed with kings, jacks, headers and cripples. */
export function frameWall(length: number, height: number, openings: Opening[]): Frame {
  const inOpening = (x: number) => openings.some((o) => x > o.c - o.w / 2 - 0.02 && x < o.c + o.w / 2 + 0.02);
  const studs: number[] = [];
  for (let x = 0; x <= length + 1e-6; x += STUD_SPACING) if (!inOpening(x)) studs.push(+x.toFixed(3));
  if (!studs.length || Math.abs(studs[studs.length - 1] - length) > 0.05) studs.push(length);
  let cripples = 0;
  for (const o of openings) {
    const span = Math.floor(o.w / STUD_SPACING);
    cripples += span * ((o.b > 0.05 ? 1 : 0) + (o.t < height - 0.25 ? 1 : 0));
  }
  return {
    studs,
    kings: openings.length * 2,
    jacks: openings.length * 2,
    cripples,
    headerLength: openings.reduce((a, o) => a + (o.w + 0.08) * 2, 0),
    plateLength: length * 3,
  };
}

// ------------------------------------------------------------------ the harness

export type RoomKind = "living" | "kitchen" | "bedroom" | "bath" | "shop" | "office" | "storage";

/** A room as a rectangle in the building's own coordinates, with its doors on its walls. */
export interface PlanRoom {
  id: string;
  kind: RoomKind;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /** Door centres, on the room's walls, with their widths. */
  doors: { x: number; z: number; w: number }[];
}

export interface Plan {
  rooms: PlanRoom[];
  /** Where the breaker panel hangs (on a wall, local coordinates). */
  panel: { x: number; z: number };
  /** Wall and ceiling height, m. */
  height: number;
}

export type DeviceKind = "outlet" | "switch" | "light" | "fridge";

export interface Device {
  kind: DeviceKind;
  room: string;
  circuit: string;
  x: number;
  z: number;
  /** Height above the floor, m. */
  y: number;
}

export interface Circuit {
  id: string;
  name: string;
  amps: 15 | 20;
  /** Copper size: 14 AWG on 15 A, 12 AWG on 20 A. */
  gauge: 14 | 12;
  /** What it feeds, in the power model's terms. */
  load: LoadKind;
  rooms: string[];
}

/** A straight length of cable in a wall (or across a ceiling), from one point to another. */
export interface Run {
  circuit: string;
  ax: number;
  az: number;
  ay: number;
  bx: number;
  bz: number;
  by: number;
  length: number;
}

export interface Harness {
  circuits: Circuit[];
  devices: Device[];
  runs: Run[];
}

/** No point along a wall more than 6 ft (1.83 m) from a receptacle: so one every 12 ft (3.66 m). */
export const OUTLET_SPACING = 3.66;
export const OUTLET_HEIGHT = 0.3;
export const SWITCH_HEIGHT = 1.2;
/** Most receptacles a 15 A general circuit is given. */
const OUTLETS_PER_CIRCUIT = 8;

/** Walk a room's perimeter (clockwise from its x0,z0 corner): the point at distance s along it. */
function perimeterPoint(r: PlanRoom, s: number): { x: number; z: number } {
  const w = r.x1 - r.x0;
  const d = r.z1 - r.z0;
  const p = ((s % (2 * (w + d))) + 2 * (w + d)) % (2 * (w + d));
  if (p <= w) return { x: r.x0 + p, z: r.z0 };
  if (p <= w + d) return { x: r.x1, z: r.z0 + (p - w) };
  if (p <= 2 * w + d) return { x: r.x1 - (p - w - d), z: r.z1 };
  return { x: r.x0, z: r.z1 - (p - 2 * w - d) };
}

const nearDoor = (r: PlanRoom, x: number, z: number, pad = 0.45) => r.doors.some((d) => Math.hypot(d.x - x, d.z - z) < d.w / 2 + pad);
const dist = (ax: number, az: number, bx: number, bz: number) => Math.abs(ax - bx) + Math.abs(az - bz);

/**
 * Wire a building from its plan. Deterministic: the same plan always gets the same harness, so it
 * never needs saving, only what's been cut out of it.
 */
export function wireBuilding(plan: Plan): Harness {
  const circuits: Circuit[] = [];
  const devices: Device[] = [];
  const runs: Run[] = [];
  const addCircuit = (c: Omit<Circuit, "gauge">): Circuit => {
    const full = { ...c, gauge: (c.amps === 20 ? 12 : 14) as 14 | 12 };
    circuits.push(full);
    return full;
  };
  const run = (circuit: string, ax: number, az: number, ay: number, bx: number, bz: number, by: number) => {
    const length = dist(ax, az, bx, bz) + Math.abs(ay - by);
    if (length > 1e-6) runs.push({ circuit, ax, az, ay, bx, bz, by, length });
  };
  /** Feed a chain of devices from the panel: a home run to the first, then device to device along the walls. */
  const chain = (circuit: Circuit, chainDevices: Device[]) => {
    let at = { x: plan.panel.x, z: plan.panel.z, y: 1.5 };
    for (const d of chainDevices) {
      // Cable runs at receptacle height through the studs, rising or dropping in a stud bay to the box.
      run(circuit.id, at.x, at.z, at.y, d.x, d.z, OUTLET_HEIGHT);
      if (d.y !== OUTLET_HEIGHT) run(circuit.id, d.x, d.z, OUTLET_HEIGHT, d.x, d.z, d.y);
      at = { x: d.x, z: d.z, y: d.y };
    }
  };

  // Lighting: one 15 A circuit per three rooms; a light in each ceiling, a switch inside each room's first door.
  const lightRooms = plan.rooms;
  for (let i = 0; i < lightRooms.length; i += 3) {
    const group = lightRooms.slice(i, i + 3);
    const c = addCircuit({ id: `L${i / 3 + 1}`, name: `Lights: ${group.map((r) => r.kind).join(", ")}`, amps: 15, load: "lights", rooms: group.map((r) => r.id) });
    const chainDevices: Device[] = [];
    for (const r of group) {
      const door = r.doors[0] ?? { x: r.x0, z: r.z0, w: 0 };
      // Beside the latch side of the door, just inside the room.
      const along = door.z === r.z0 || door.z === r.z1 ? { x: Math.min(r.x1, door.x + door.w / 2 + 0.15), z: door.z } : { x: door.x, z: Math.min(r.z1, door.z + door.w / 2 + 0.15) };
      const sw: Device = { kind: "switch", room: r.id, circuit: c.id, x: along.x, z: along.z, y: SWITCH_HEIGHT };
      const light: Device = { kind: "light", room: r.id, circuit: c.id, x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2, y: plan.height };
      devices.push(sw, light);
      chainDevices.push(sw);
    }
    chain(c, chainDevices);
    // Switch legs up the wall and across the ceiling joists to each fixture.
    for (const r of group) {
      const sw = devices.find((d) => d.kind === "switch" && d.room === r.id)!;
      const light = devices.find((d) => d.kind === "light" && d.room === r.id)!;
      run(c.id, sw.x, sw.z, sw.y, sw.x, sw.z, plan.height);
      run(c.id, sw.x, sw.z, plan.height, light.x, light.z, plan.height);
    }
  }

  // Receptacles round every room's walls, none closer than 0.45 m to a door's edge.
  let general: Circuit | null = null;
  let onGeneral = 0;
  let generalN = 0;
  const generalChain = new Map<string, Device[]>();
  for (const r of plan.rooms) {
    const perim = 2 * (r.x1 - r.x0 + (r.z1 - r.z0));
    const count = Math.max(1, Math.ceil(perim / OUTLET_SPACING));
    const outlets: Device[] = [];
    for (let k = 0; k < count; k++) {
      let s = (k + 0.5) * (perim / count);
      let p = perimeterPoint(r, s);
      for (let tries = 0; tries < 8 && nearDoor(r, p.x, p.z); tries++) {
        s += 0.3;
        p = perimeterPoint(r, s);
      }
      outlets.push({ kind: "outlet", room: r.id, circuit: "", x: p.x, z: p.z, y: OUTLET_HEIGHT });
    }
    if (r.kind === "kitchen") {
      // Counters get two 20 A small-appliance circuits, alternating; the fridge its own.
      const a = addCircuit({ id: `K1-${r.id}`, name: "Kitchen counter A", amps: 20, load: "appliances", rooms: [r.id] });
      const b = addCircuit({ id: `K2-${r.id}`, name: "Kitchen counter B", amps: 20, load: "appliances", rooms: [r.id] });
      outlets.forEach((o, i) => (o.circuit = i % 2 ? b.id : a.id));
      devices.push(...outlets);
      chain(a, outlets.filter((o) => o.circuit === a.id));
      chain(b, outlets.filter((o) => o.circuit === b.id));
      const f = addCircuit({ id: `F-${r.id}`, name: "Fridge", amps: 20, load: "appliances", rooms: [r.id] });
      const spot = perimeterPoint(r, 0.6);
      const fridge: Device = { kind: "fridge", room: r.id, circuit: f.id, x: spot.x, z: spot.z, y: OUTLET_HEIGHT + 0.6 };
      devices.push(fridge);
      chain(f, [fridge]);
      continue;
    }
    for (const o of outlets) {
      if (!general || onGeneral >= OUTLETS_PER_CIRCUIT) {
        generalN++;
        general = addCircuit({ id: `R${generalN}`, name: `Receptacles ${generalN}`, amps: 15, load: "appliances", rooms: [] });
        generalChain.set(general.id, []);
        onGeneral = 0;
      }
      o.circuit = general.id;
      if (!general.rooms.includes(r.id)) general.rooms.push(r.id);
      generalChain.get(general.id)!.push(o);
      devices.push(o);
      onGeneral++;
    }
  }
  for (const c of circuits) if (generalChain.has(c.id)) chain(c, generalChain.get(c.id)!);
  return { circuits, devices, runs };
}

/** Copper in NM-B cable (two insulated conductors and a bare ground), kg per metre; the rest is PVC. */
export const COPPER_KG_PER_M: Record<14 | 12, number> = {
  // 3 conductors × cross-section × 8960 kg/m³: 14 AWG is 2.08 mm², 12 AWG 3.31 mm².
  14: 3 * 2.08e-6 * 8960,
  12: 3 * 3.31e-6 * 8960,
};
export const JACKET_KG_PER_M = 0.035;

/** Cable crossing a stretch of wall: the runs that pass through it, and how much of each. */
export function runsThrough(h: Harness, x0: number, z0: number, x1: number, z1: number, pad = 0.15): { run: Run; length: number }[] {
  const minX = Math.min(x0, x1) - pad;
  const maxX = Math.max(x0, x1) + pad;
  const minZ = Math.min(z0, z1) - pad;
  const maxZ = Math.max(z0, z1) + pad;
  const out: { run: Run; length: number }[] = [];
  for (const r of h.runs) {
    // Runs are axis-aligned legs; clip the horizontal part to the box and add any vertical part inside it.
    const rx0 = Math.min(r.ax, r.bx);
    const rx1 = Math.max(r.ax, r.bx);
    const rz0 = Math.min(r.az, r.bz);
    const rz1 = Math.max(r.az, r.bz);
    const ox = Math.max(0, Math.min(rx1, maxX) - Math.max(rx0, minX));
    const oz = Math.max(0, Math.min(rz1, maxZ) - Math.max(rz0, minZ));
    const overlapsX = rx1 >= minX && rx0 <= maxX;
    const overlapsZ = rz1 >= minZ && rz0 <= maxZ;
    if (!overlapsX || !overlapsZ) continue;
    const horizontal = (rx1 - rx0 > 1e-6 ? ox : 0) + (rz1 - rz0 > 1e-6 ? oz : 0);
    const vertical = rx1 - rx0 < 1e-6 && rz1 - rz0 < 1e-6 ? Math.abs(r.ay - r.by) : 0;
    const length = horizontal + vertical;
    if (length > 0.01) out.push({ run: r, length });
  }
  return out;
}

export interface CableSalvage {
  /** Metres of cable pulled (a stack of copper_wire, 1 per metre). */
  metres: number;
  copperKg: number;
  circuitsCut: string[];
  /** Cut while live: the jolt you got (0 when the breaker was off or there was no power). */
  shock: number;
}

/**
 * Pull the cable out of an opened stretch of wall. Any circuit that's live when you cut it bites:
 * kill the breaker first. Cut circuits are dead from then on, whatever the power does.
 */
export function pullCable(h: Harness, x0: number, z0: number, x1: number, z1: number, live: (circuit: string) => boolean, alreadyCut: Set<string>): CableSalvage {
  const through = runsThrough(h, x0, z0, x1, z1);
  let metres = 0;
  let copper = 0;
  const cut = new Set<string>();
  for (const { run, length } of through) {
    // A run inside one wall section comes out whole: you pull it to the next box.
    const c = h.circuits.find((cc) => cc.id === run.circuit)!;
    metres += length;
    copper += length * COPPER_KG_PER_M[c.gauge];
    cut.add(run.circuit);
  }
  const circuitsCut = [...cut].filter((c) => !alreadyCut.has(c));
  const shock = circuitsCut.some((c) => live(c)) ? 35 : 0;
  return { metres: +metres.toFixed(2), copperKg: +copper.toFixed(3), circuitsCut, shock };
}

/** Every circuit downstream of a cut is dead: a cut run kills the whole circuit it belongs to. */
export const circuitAlive = (circuit: string, cut: Set<string>) => !cut.has(circuit);

/** Total cable in a building, by gauge, and the copper in it. */
export function harnessTotals(h: Harness): { metres: number; copperKg: number; boxes: number } {
  let metres = 0;
  let copper = 0;
  for (const r of h.runs) {
    const c = h.circuits.find((cc) => cc.id === r.circuit)!;
    metres += r.length;
    copper += r.length * COPPER_KG_PER_M[c.gauge];
  }
  return { metres: +metres.toFixed(1), copperKg: +copper.toFixed(2), boxes: h.devices.filter((d) => d.kind !== "light").length };
}
