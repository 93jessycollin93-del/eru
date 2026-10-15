/**
 * Electrical power for buildings. Engine-agnostic and serialisable.
 *
 * Each building has a circuit of loads. Supply is resolved in priority order:
 *   1. the town grid (until it fails)
 *   2. a connected, running generator (if its breaker hasn't tripped)
 *   3. a UPS battery, which only carries critical loads
 * Generators burn fuel in proportion to the load they carry, trip their
 * breaker when overloaded, and run dry. UPS batteries recharge from grid or
 * generator power.
 */

export type LoadKind = "lights" | "network" | "computer" | "appliances" | "charger";

export interface Load {
  kind: LoadKind;
  watts: number;
  /** Kept alive by the UPS when mains power is lost. */
  critical: boolean;
  on: boolean;
}

export interface Ups {
  capacityWh: number;
  chargeWh: number;
  /** Charging rate when mains is available. */
  chargeW: number;
}

export interface Circuit {
  buildingId: string;
  loads: Load[];
  ups: Ups | null;
}

export interface Generator {
  id: string;
  name: string;
  ratedW: number;
  tankL: number;
  fuelL: number;
  running: boolean;
  /** Breaker tripped by overload: no output until reset. */
  tripped: boolean;
  /** Starts by itself when the grid fails (standby units with a transfer switch). */
  autoStart: boolean;
  buildingId: string | null;
  portable: boolean;
  /** Metres its engine can be heard from while running. */
  noiseRadius: number;
}

export type PowerSource = "grid" | "generator" | "ups" | "none";

export interface CircuitStatus {
  source: PowerSource;
  demandW: number;
  powered: Set<LoadKind>;
}

export interface PowerWorld {
  /** Game minute the grid goes down for good. */
  gridFailsAt: number;
  circuits: Record<string, Circuit>;
  generators: Generator[];
}

export interface PowerEvent {
  type: "gridDown" | "generatorTripped" | "generatorOutOfFuel" | "generatorAutoStarted" | "upsEmpty";
  id: string;
}

/**
 * Litres per hour. Modelled on small inverter generators: about 0.3 L/h idling
 * at low load for a 3 kW unit, rising to about 1.4 L/h at full load; bigger
 * units scale with their rating.
 */
export function fuelPerHour(ratedW: number, loadW: number): number {
  const scale = ratedW / 3000;
  return scale * (0.3 + 1.1 * Math.min(1, loadW / ratedW));
}

export const gridUp = (w: PowerWorld, minute: number) => minute < w.gridFailsAt;

export function demand(c: Circuit, criticalOnly = false): number {
  return c.loads.filter((l) => l.on && (!criticalOnly || l.critical)).reduce((s, l) => s + l.watts, 0);
}

export function generatorFor(w: PowerWorld, buildingId: string): Generator | undefined {
  return w.generators.find((g) => g.buildingId === buildingId);
}

/**
 * Advance the power world by gameMinutes ending at `minute`. Returns each
 * circuit's status and anything noteworthy that happened.
 */
export function stepPower(w: PowerWorld, minute: number, gameMinutes: number): { status: Record<string, CircuitStatus>; events: PowerEvent[] } {
  const events: PowerEvent[] = [];
  const hours = gameMinutes / 60;
  const grid = gridUp(w, minute);
  if (!grid && gridUp(w, minute - gameMinutes)) {
    events.push({ type: "gridDown", id: "grid" });
    for (const g of w.generators) {
      if (g.autoStart && g.buildingId && g.fuelL > 0 && !g.running) {
        g.running = true;
        events.push({ type: "generatorAutoStarted", id: g.id });
      }
    }
  }

  const status: Record<string, CircuitStatus> = {};
  for (const c of Object.values(w.circuits)) {
    const need = demand(c);
    const gen = generatorFor(w, c.buildingId);
    let source: PowerSource = "none";
    let powered = new Set<LoadKind>();

    if (grid) {
      source = "grid";
    } else if (gen && gen.running && gen.fuelL > 0) {
      if (need > gen.ratedW && !gen.tripped) {
        gen.tripped = true;
        events.push({ type: "generatorTripped", id: gen.id });
      }
      if (!gen.tripped) source = "generator";
    }

    if (source === "grid" || source === "generator") {
      powered = new Set(c.loads.filter((l) => l.on).map((l) => l.kind));
      if (c.ups) c.ups.chargeWh = Math.min(c.ups.capacityWh, c.ups.chargeWh + c.ups.chargeW * hours);
    } else if (c.ups && c.ups.chargeWh > 0) {
      const crit = demand(c, true);
      if (crit > 0) {
        source = "ups";
        powered = new Set(c.loads.filter((l) => l.on && l.critical).map((l) => l.kind));
        c.ups.chargeWh = Math.max(0, c.ups.chargeWh - crit * hours);
        if (c.ups.chargeWh === 0) events.push({ type: "upsEmpty", id: c.buildingId });
      }
    }
    status[c.buildingId] = { source, demandW: source === "ups" ? demand(c, true) : need, powered };
  }

  // Burn fuel on every running generator, connected or not (an unloaded engine still idles).
  for (const g of w.generators) {
    if (!g.running) continue;
    const circuit = g.buildingId ? w.circuits[g.buildingId] : undefined;
    const load = circuit && !g.tripped && status[circuit.buildingId]?.source === "generator" ? demand(circuit) : 0;
    g.fuelL = Math.max(0, g.fuelL - fuelPerHour(g.ratedW, load) * hours);
    if (g.fuelL === 0) {
      g.running = false;
      events.push({ type: "generatorOutOfFuel", id: g.id });
    }
  }

  return { status, events };
}

/** Try to start a generator. Returns a reason it won't start, or null. */
export function startGenerator(g: Generator): string | null {
  if (g.running) return null;
  if (g.fuelL <= 0) return "The tank is empty.";
  g.running = true;
  return null;
}

export function resetBreaker(w: PowerWorld, g: Generator): string | null {
  if (!g.tripped) return null;
  const c = g.buildingId ? w.circuits[g.buildingId] : undefined;
  if (c && demand(c) > g.ratedW) return `Still too much load: ${Math.round(demand(c))} W on a ${g.ratedW} W generator.`;
  g.tripped = false;
  return null;
}

/** Pour fuel in; returns litres actually added. */
export function refuel(g: Generator, litres: number): number {
  const add = Math.max(0, Math.min(litres, g.tankL - g.fuelL));
  g.fuelL += add;
  return add;
}

/** Typical loads for each kind of building. */
export function defaultLoads(type: "house" | "store" | "hardware" | "police", lightsOn: boolean): Load[] {
  switch (type) {
    case "police":
      return [
        { kind: "lights", watts: 600, critical: false, on: lightsOn },
        { kind: "network", watts: 120, critical: true, on: true }, // server, NVR, cameras, router
        { kind: "computer", watts: 130, critical: true, on: true }, // dispatch console
        { kind: "appliances", watts: 400, critical: false, on: true },
      ];
    case "store":
      return [
        { kind: "lights", watts: 800, critical: false, on: lightsOn },
        { kind: "appliances", watts: 1800, critical: false, on: true }, // chiller cabinets
        { kind: "computer", watts: 150, critical: false, on: true },
        { kind: "network", watts: 20, critical: false, on: true },
      ];
    case "hardware":
      return [
        { kind: "lights", watts: 700, critical: false, on: lightsOn },
        { kind: "computer", watts: 150, critical: false, on: true },
        { kind: "network", watts: 20, critical: false, on: true },
      ];
    default:
      return [
        { kind: "lights", watts: 250, critical: false, on: lightsOn },
        { kind: "appliances", watts: 350, critical: false, on: true }, // fridge, TV
        { kind: "network", watts: 12, critical: false, on: true }, // router
        { kind: "charger", watts: 60, critical: false, on: true }, // laptop charger
      ];
  }
}
