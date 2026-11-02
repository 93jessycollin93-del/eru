import * as THREE from "three";
import {
  defaultLoads,
  gridUp,
  stepPower,
  type CircuitStatus,
  type Generator,
  type LoadKind,
  type PowerEvent,
  type PowerWorld,
} from "../sim/power";
import type { NoiseEvent } from "./entities/zombie";
import type { Building, TownData } from "./world/town";

/** A generator that exists in the world: standby units are part of a building, portables are placed by the player. */
export interface GeneratorObject {
  gen: Generator;
  mesh: THREE.Object3D | null;
  x: number;
  y: number;
  z: number;
  hx: number;
  hz: number;
}

const LIGHT_POOL = 4;
/** How far a lit window draws zombies at night (m). */
const LIGHT_LURE_RADIUS = 16;

/**
 * Runtime side of building electricity: owns the PowerWorld, steps it, and
 * turns its state into lights, noise and generator objects.
 */
export class Electricity {
  world!: PowerWorld;
  status: Record<string, CircuitStatus> = {};
  generators: GeneratorObject[] = [];
  private lights: THREE.PointLight[] = [];
  private noiseTimer = 0;
  private lureTimer = 0;
  private lightTimer = 0;
  private nextGenId = 1;

  constructor(
    private scene: THREE.Scene,
    private town: TownData,
  ) {
    for (let i = 0; i < LIGHT_POOL; i++) {
      const l = new THREE.PointLight("#ffd9a8", 0, 14, 1.4);
      l.castShadow = false;
      this.lights.push(l);
      scene.add(l);
    }
  }

  /** Fresh world for a new game. */
  reset(rng: () => number, gridFailsAt: number) {
    for (const g of this.generators) if (g.mesh) this.scene.remove(g.mesh);
    this.generators = [];
    this.world = { gridFailsAt, circuits: {}, generators: [] };
    for (const b of this.town.buildings) {
      // A few houses and shops still have their lights on from the night everyone left.
      const lightsOn = b.type === "police" || rng() < (b.type === "house" ? 0.22 : 0.35);
      const loads = defaultLoads(b.type, lightsOn);
      let ups = null;
      if (b.network && b.network.upsMinutes > 0) {
        const critical = loads.filter((l) => l.critical).reduce((s, l) => s + l.watts, 0);
        const capacityWh = (b.network.upsMinutes / 60) * critical;
        ups = { capacityWh, chargeWh: capacityWh, chargeW: 300 };
      }
      this.world.circuits[b.address] = { buildingId: b.address, loads, ups };
      if (b.standby) {
        const gen: Generator = {
          id: `standby-${this.nextGenId++}`,
          name: "Standby Generator (8 kW)",
          ratedW: 8000,
          tankL: 40,
          fuelL: 0, // drained for the evacuation convoy
          running: false,
          tripped: false,
          autoStart: true,
          buildingId: b.address,
          portable: false,
          noiseRadius: 40,
        };
        this.world.generators.push(gen);
        this.generators.push({ gen, mesh: null, x: b.standby.x, y: b.standby.y, z: b.standby.z, hx: 0.6, hz: 0.9 });
      }
    }
    this.status = {};
  }

  /** The power world plus where portable generators stand (standby units come back with their building). */
  toSave(): { world: PowerWorld; portables: { id: string; pos: [number, number, number] }[]; nextGenId: number } {
    return {
      world: this.world,
      portables: this.generators
        .filter((g) => g.gen.portable && g.mesh)
        .map((g) => ({ id: g.gen.id, pos: [g.mesh!.position.x, g.mesh!.position.y, g.mesh!.position.z] as [number, number, number] })),
      nextGenId: this.nextGenId,
    };
  }

  /** Replace the power world with a saved one and rebuild the generator objects around it. */
  restore(data: { world: PowerWorld; portables: { id: string; pos: [number, number, number] }[]; nextGenId: number }) {
    for (const g of this.generators) if (g.mesh) this.scene.remove(g.mesh);
    this.generators = [];
    this.world = data.world;
    // Standby units were created in building order (see reset), so the k-th one belongs to the k-th building that has one.
    const standby = this.world.generators.filter((g) => !g.portable);
    let k = 0;
    for (const b of this.town.buildings) {
      if (!b.standby) continue;
      const gen = standby[k++];
      if (gen) this.generators.push({ gen, mesh: null, x: b.standby.x, y: b.standby.y, z: b.standby.z, hx: 0.6, hz: 0.9 });
    }
    for (const p of data.portables) {
      const gen = this.world.generators.find((g) => g.id === p.id);
      if (!gen) continue;
      const mesh = makePortableMesh();
      mesh.position.set(p.pos[0], p.pos[1], p.pos[2]);
      this.scene.add(mesh);
      this.generators.push({ gen, mesh, x: p.pos[0], y: p.pos[1] + 0.25, z: p.pos[2], hx: 0.35, hz: 0.3 });
    }
    this.nextGenId = data.nextGenId;
    this.status = {};
  }

  gridUp(minute: number) {
    return gridUp(this.world, minute);
  }

  statusOf(b: Building | undefined): CircuitStatus | undefined {
    return b ? this.status[b.address] : undefined;
  }

  powered(b: Building | undefined, kind: LoadKind): boolean {
    return !!this.statusOf(b)?.powered.has(kind);
  }

  circuitOf(b: Building) {
    return this.world.circuits[b.address];
  }

  /** Flip a building's lights. Returns the new state. */
  toggleLights(b: Building): boolean {
    const light = this.circuitOf(b).loads.find((l) => l.kind === "lights");
    if (!light) return false;
    light.on = !light.on;
    return light.on;
  }

  /**
   * Advance power, place interior lights near the player, and make noise:
   * running generators are loud, and lit windows draw zombies at night.
   */
  step(dt: number, minute: number, gameMinutes: number, player: THREE.Vector3, dark: boolean, noises: NoiseEvent[]): PowerEvent[] {
    const { status, events } = stepPower(this.world, minute, gameMinutes);
    this.status = status;

    this.noiseTimer -= dt;
    if (this.noiseTimer <= 0) {
      this.noiseTimer = 1.5;
      for (const g of this.generators) {
        if (g.gen.running) noises.push({ pos: new THREE.Vector3(g.x, g.y, g.z), radius: g.gen.noiseRadius, ttl: 0.4 });
      }
    }

    const litNearby = (range: number) =>
      this.town.buildings
        .filter((b) => this.powered(b, "lights"))
        .map((b) => ({ b, c: new THREE.Vector3((b.rect.minX + b.rect.maxX) / 2, 2.5, (b.rect.minZ + b.rect.maxZ) / 2) }))
        .filter(({ c }) => c.distanceTo(player) < range);

    if (dark) {
      this.lureTimer -= dt;
      if (this.lureTimer <= 0) {
        this.lureTimer = 3;
        for (const { c } of litNearby(90)) noises.push({ pos: c.clone().setY(0), radius: LIGHT_LURE_RADIUS, ttl: 0.4 });
      }
    }

    this.lightTimer -= dt;
    if (this.lightTimer <= 0) {
      this.lightTimer = 0.4;
      const lit = dark ? litNearby(55).sort((a, b) => a.c.distanceTo(player) - b.c.distanceTo(player)).slice(0, LIGHT_POOL) : [];
      this.lights.forEach((l, i) => {
        const target = lit[i];
        if (target) {
          l.position.copy(target.c);
          l.intensity = 14;
        } else {
          l.intensity = 0;
        }
      });
    }
    return events;
  }

  /** Put a portable generator down in front of the player. */
  placePortable(pos: THREE.Vector3, ratedW: number, tankL: number, fuelL: number, noise: number): GeneratorObject {
    const gen: Generator = {
      id: `portable-${this.nextGenId++}`,
      name: `Portable Generator (${ratedW / 1000} kW)`,
      ratedW,
      tankL,
      fuelL,
      running: false,
      tripped: false,
      autoStart: false,
      buildingId: null,
      portable: true,
      noiseRadius: noise,
    };
    this.world.generators.push(gen);
    const mesh = makePortableMesh();
    mesh.position.copy(pos);
    this.scene.add(mesh);
    const obj = { gen, mesh, x: pos.x, y: pos.y + 0.25, z: pos.z, hx: 0.35, hz: 0.3 };
    this.generators.push(obj);
    return obj;
  }

  removePortable(obj: GeneratorObject) {
    if (obj.mesh) this.scene.remove(obj.mesh);
    this.generators = this.generators.filter((g) => g !== obj);
    this.world.generators = this.world.generators.filter((g) => g !== obj.gen);
  }

  /** The building whose walls are within cable reach of a spot. */
  buildingInReach(x: number, z: number, reach = 8): Building | null {
    let best: Building | null = null;
    let bestD = reach;
    for (const b of this.town.buildings) {
      const dx = Math.max(0, b.rect.minX - x, x - b.rect.maxX);
      const dz = Math.max(0, b.rect.minZ - z, z - b.rect.maxZ);
      const d = Math.hypot(dx, dz);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  /** 0..1 how loud the nearest running generator is where the player stands. */
  humLevel(player: THREE.Vector3): number {
    let level = 0;
    for (const g of this.generators) {
      if (!g.gen.running) continue;
      const d = Math.hypot(g.x - player.x, g.z - player.z);
      level = Math.max(level, Math.max(0, 1 - d / (g.gen.noiseRadius * 0.9)));
    }
    return level;
  }
}

function makePortableMesh(): THREE.Object3D {
  const g = new THREE.Group();
  const add = (w: number, h: number, d: number, x: number, y: number, z: number, color: string, metal = 0.2) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: metal }));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  };
  // Tube frame, engine block, red tank, control panel.
  add(0.6, 0.03, 0.03, 0, 0.02, 0.2, "#202020", 0.6);
  add(0.6, 0.03, 0.03, 0, 0.02, -0.2, "#202020", 0.6);
  add(0.03, 0.45, 0.03, 0.29, 0.24, 0.2, "#202020", 0.6);
  add(0.03, 0.45, 0.03, -0.29, 0.24, 0.2, "#202020", 0.6);
  add(0.03, 0.45, 0.03, 0.29, 0.24, -0.2, "#202020", 0.6);
  add(0.03, 0.45, 0.03, -0.29, 0.24, -0.2, "#202020", 0.6);
  add(0.36, 0.26, 0.3, -0.05, 0.17, 0, "#3a3a3a", 0.4);
  add(0.42, 0.13, 0.32, 0, 0.4, 0, "#a32a20", 0.3);
  add(0.12, 0.16, 0.02, 0.2, 0.2, 0.19, "#1b1b1b", 0.2);
  return g;
}
