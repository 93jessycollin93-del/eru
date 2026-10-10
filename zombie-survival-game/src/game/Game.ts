import * as THREE from "three";
import { AudioSystem } from "./audio";
import { Player } from "./entities/player";
import { makeHeldItem } from "./entities/humanoid";
import { Zombie, type NoiseEvent } from "./entities/zombie";
import { Input } from "./input";
import { FISTS, ITEMS, makeStack, peekNextUid, rollLoot, setNextUid, stackWeight, type ItemDef, type ItemStack } from "../sim/items";
import { SAVE_VERSION, SaveError, deserialise, serialise, type SaveData, type SaveMeta } from "../sim/save";
import { SaveStore, type SlotId } from "./saveStore";
import { mulberry32, pick, range } from "../sim/rng";
import {
  BODY_PART_NAMES,
  addWound,
  aimSway,
  bandage,
  bloodPercent,
  eat,
  heal,
  isBleeding,
  moodles,
  pain,
  spendStamina,
  strength,
  takePainkillers,
  updateBody,
  zombieHit,
} from "../sim/body";
import { airTemperature } from "../sim/climate";
import { BARRICADE, BARRIER, BARRIER_NOISE, DOOR, MELEE, FIREARM, WINDOW, ZOMBIE, meleeDamage, shotSpread, visibilityRange } from "../sim/tuning";
import {
  attackSlots,
  boardCost,
  canBoard,
  climbCut,
  effectiveLocked,
  integrityLabel,
  navCost,
  struckMaterial,
  type HitMaterial,
  type HitResult,
  type Side,
} from "../sim/barriers";
import { boot, complete, createComputerState, isSecretInput, restoreComputer, saveComputer, prompt as shellPrompt, submit } from "../sim/computer";
import { COUNTY, TOWN, gameDate } from "../sim/computerContent";
import type { GameStatus, HudMessage, HudState } from "./types";
import { ColliderWorld, type RayHit } from "./world/colliders";
import { BarrierSystem } from "./world/barrierSystem";
import { Environment } from "./world/environment";
import { PostFX, type Quality } from "./render/postfx";
import { SkyDome } from "./render/sky";
import { CctvSystem } from "./render/cctv";
import { Electricity, type GeneratorObject } from "./electricity";
import { refuel, resetBreaker, startGenerator } from "../sim/power";
import type { AccessView, NetworkSpec, NetworkView } from "../sim/network";
import { blockBox, createNavGrid, findPath, type NavGrid } from "../sim/nav";
import { TextureLibrary } from "./render/textures";
import { Terrain } from "./world/terrain";
import { generateTown, type Building, type ComputerSpot, type LootContainer, type TownData } from "./world/town";
import { generateVegetation } from "./world/vegetation";

const WORLD_SEED = 1987;
/** Real seconds between autosaves (only when nothing is hunting you and no menu is open). */
const AUTOSAVE_SECONDS = 120;
/** Doors and windows start the same way every game (their own stream, so nothing else shifts). */
const BARRIER_SEED = WORLD_SEED + 31;
/** In-game minutes that pass per real second. A full day takes 24 minutes. */
const TIME_SCALE = 1;
const START_MINUTES = 7 * 60 + 30;
const MAX_WEIGHT = 20;
const INTERACT_RANGE = 1.9;
const RELOAD_SECONDS = 1.8;
const ZOMBIE_ACTIVE_RANGE = 140;
/** How much faster the clock runs while you sleep. */
const SLEEP_TIME_SCALE = 30;

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(70, 1, 0.1, 600);
  private clock = new THREE.Clock();
  private input: Input;
  private audio = new AudioSystem();
  private env: Environment;

  private terrain!: Terrain;
  private colliders = new ColliderWorld();
  private town!: TownData;
  private player = new Player();
  private zombies: Zombie[] = [];
  private noises: NoiseEvent[] = [];
  private groundPiles = new Map<number, THREE.Object3D>();

  private status: GameStatus = "loading";
  private locked = false;
  private freeMouse = false;
  private inventoryOpen = false;
  private container: LootContainer | null = null;

  private inventory: ItemStack[] = [];
  private equippedUid: number | null = null;
  private heldMesh: THREE.Object3D | null = null;

  private minutes = START_MINUTES;
  private kills = 0;
  private messages: HudMessage[] = [];
  private messageId = 1;
  private hudTimer = 0;
  private respawnTimer = 30;
  private damageFlash = 0;
  private causeOfDeath = "";
  private menuAngle = 0;

  private attackCooldown = 0;
  private swingTime = 0;
  private swingDuration = 0;
  private swingHits = new Set<Zombie>();
  private hitStop = 0;
  /** Zombies currently allowed to attack (only a few at once). */
  private attackers = new Set<Zombie>();
  private nav!: NavGrid;
  /** Path searches left this frame (they're the most expensive AI step). */
  private pathBudget = 0;
  private reloadTimer = 0;

  private flashlight: THREE.SpotLight;
  private flashlightOn = false;
  private muzzle: THREE.PointLight;
  private muzzleTimer = 0;
  private rng = mulberry32(WORLD_SEED + 7);
  private sheltered = false;
  private shelterTimer = 0;
  private airTemp = 10;
  private turned = false;
  private computerSpot: ComputerSpot | null = null;
  private computerOpenedAt = 0;
  private reading: { title: string; text: string } | null = null;
  private elec!: Electricity;
  private generatorPanel: GeneratorObject | null = null;
  private batteryTimer = 0;
  private location: string | null = null;
  private textures: TextureLibrary;
  private post: PostFX;
  private sky = new SkyDome();
  private quality: Quality;
  private qualityChosen: boolean;
  private perfTime = 0;
  private perfFrames = 0;
  private perfChecked = false;
  private cctv: CctvSystem;
  private cctvOpen = false;
  private barriers!: BarrierSystem;
  /** Zombies with a place to swing at the barrier they're pounding on. */
  private breachers = new Set<Zombie>();
  /** Timed work in progress (boarding up, breaking glass...): you stand still until it's done. */
  private action: TimedAction | null = null;
  private keypadId: number | null = null;
  private keypadEntry = "";
  private keypadStatus: KeypadStatus = "idle";
  private swungAtBarrier = false;
  /** Buildings with a door controller on their network. */
  private controllers: { hostname: string; building: Building }[] = [];
  private rayHit: RayHit = { box: null };
  /** Car tanks as the town was generated, for a new game. */
  private initialFuel = new Map<number, number>();
  private saves = new SaveStore();
  private saveList: { slot: SlotId; meta: SaveMeta }[] = [];
  private autosaveTimer = AUTOSAVE_SECONDS;
  private saving = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private onHud: (hud: HudState) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.input = new Input(canvas);
    this.env = new Environment(this.scene);
    this.textures = new TextureLibrary(this.renderer);
    this.scene.add(this.sky.mesh);
    const saved = loadQuality();
    this.qualityChosen = saved !== null;
    this.quality = saved ?? "high";
    this.post = new PostFX(this.renderer, this.scene, this.camera, this.quality);
    this.cctv = new CctvSystem(this.renderer, this.scene);

    this.flashlight = new THREE.SpotLight("#fff4d6", 0, 45, 0.45, 0.5, 1);
    this.scene.add(this.flashlight, this.flashlight.target);
    this.muzzle = new THREE.PointLight("#ffcf7a", 0, 14, 2);
    this.scene.add(this.muzzle);

    this.scene.add(this.player.model.root);
    this.player.model.root.visible = false;

    window.addEventListener("resize", this.resize);
    document.addEventListener("visibilitychange", this.onVisibility);
    document.addEventListener("pointerlockchange", this.onLockChange);
    document.addEventListener("pointerlockerror", this.onLockError);
    canvas.addEventListener("click", this.onCanvasClick);
    this.resize();
    this.emitHud();

    // Let the loading screen paint before the (synchronous) world build.
    setTimeout(() => {
      this.buildWorld();
      this.status = "menu";
      this.emitHud();
      this.renderer.setAnimationLoop(this.loop);
    }, 30);
  }

  // ---------------------------------------------------------------- setup

  private buildWorld() {
    const rng = mulberry32(WORLD_SEED);
    this.terrain = new Terrain(rng, this.textures);
    this.scene.add(this.terrain.mesh);
    this.town = generateTown(rng, this.terrain, this.colliders, this.textures);
    this.scene.add(this.town.group);
    this.scene.add(generateVegetation(rng, this.terrain, this.colliders, this.town.occupied));
    for (const b of this.town.buildings) {
      if (b.network && b.cameraMounts) this.cctv.setup(b.network, b.cameraMounts);
    }
    this.elec = new Electricity(this.scene, this.town);
    this.elec.reset(this.rng, (this.town.facts.powerOffDay - 1) * 1440 + 6 * 60);
    // Navigation grid over the town: anything at body height blocks walking.
    this.nav = createNavGrid(-135, -135, 270, 270, 0.25);
    for (const box of this.colliders.boxes) {
      // Window sills are crossings with a cost (charged by the barrier system), not walls.
      if (box.barrierId !== undefined) continue;
      if (box.minY < 1.2 && box.maxY > 0.35) blockBox(this.nav, box, 0.3);
    }
    // Doors and windows add their own colliders after the nav build.
    this.barriers = new BarrierSystem(this.town, this.colliders, this.nav, this.textures);
    this.scene.add(this.barriers.group);
    for (const o of this.barriers.seeThrough) this.post.excludeFromAO(o);
    this.barriers.reset(mulberry32(BARRIER_SEED));
    for (const b of this.town.buildings) {
      const acs = b.network?.hosts.find((h) => h.kind === "controller");
      if (acs) this.controllers.push({ hostname: acs.hostname, building: b });
    }
    for (const c of this.town.containers) if (c.fuel !== undefined) this.initialFuel.set(c.id, c.fuel);
    void this.refreshSaves();
  }

  destroy() {
    this.renderer.setAnimationLoop(null);
    this.input.destroy();
    window.removeEventListener("resize", this.resize);
    document.removeEventListener("visibilitychange", this.onVisibility);
    document.removeEventListener("pointerlockchange", this.onLockChange);
    document.removeEventListener("pointerlockerror", this.onLockError);
    this.canvas.removeEventListener("click", this.onCanvasClick);
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.renderer.dispose();
  }

  /** Leaving the tab (or closing it) saves the run, unless something is hunting you. */
  private onVisibility = () => {
    if (document.visibilityState !== "hidden") return;
    if ((this.status === "playing" || this.status === "paused") && !this.zombies.some((z) => z.hunting)) void this.saveGame("auto", true);
  };

  private resize = () => {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.post?.setSize(w, h, this.renderer.getPixelRatio());
  };

  /** Graphics quality: "high" adds ambient occlusion and bloom. */
  setQuality(q: Quality) {
    this.quality = q;
    this.qualityChosen = true;
    this.post.setQuality(q);
    try {
      localStorage.setItem(QUALITY_KEY, q);
    } catch {
      // Storage unavailable; the choice lasts for this session only.
    }
    this.emitHud();
  }

  // ------------------------------------------------------- public controls

  start() {
    if (this.status === "loading") return;
    this.audio.init();
    this.resetRun();
    this.inventory = [makeStack("water_bottle"), makeStack("cereal_bar"), makeStack("bandage")];

    const spawn = this.town.playerSpawn;
    for (let i = 0; i < 80; i++) {
      const p = pick(this.rng, this.town.spawnPoints);
      const pos = new THREE.Vector3(p.x + range(this.rng, -3, 3), 0, p.z + range(this.rng, -3, 3));
      if (pos.distanceTo(spawn) < 45) continue;
      this.spawnZombie(pos);
    }
    // A few stragglers in the woods along the highway.
    for (let i = 0; i < 12; i++) {
      const x = range(this.rng, -280, 280);
      const z = range(this.rng, -40, 40);
      if (Math.abs(x - spawn.x) < 50) continue;
      this.spawnZombie(new THREE.Vector3(x, 0, z));
    }

    this.status = "playing";
    this.message("Day 1. Find food, water and something to fight with. The town is east.", "info");
    this.message("Gunshots carry. Crouch (C) to stay quiet.", "warn");
    this.requestLock();
    this.emitHud();
  }

  /** The town as it was generated, with nobody in it: shared by a new game and by loading a save. */
  private resetRun() {
    for (const z of this.zombies) {
      this.scene.remove(z.model.root);
      z.model.dispose();
    }
    this.zombies = [];
    for (const [, obj] of this.groundPiles) this.scene.remove(obj);
    this.groundPiles.clear();
    this.town.containers = this.town.containers.filter((c) => c.table !== "ground");
    for (const c of this.town.containers) {
      c.items = null;
      // Cars get their fuel back (siphoned tanks used to stay empty into the next game).
      if (this.initialFuel.has(c.id)) c.fuel = this.initialFuel.get(c.id);
    }

    this.player.reset(this.town.playerSpawn);
    this.player.model.root.visible = true;
    this.inventory = [makeStack("water_bottle"), makeStack("cereal_bar"), makeStack("bandage")];
    this.setEquipped(null);
    this.minutes = START_MINUTES;
    this.kills = 0;
    this.messages = [];
    this.noises = [];
    this.damageFlash = 0;
    this.flashlightOn = false;
    this.inventoryOpen = false;
    this.container = null;
    this.reloadTimer = 0;
    this.swingTime = 0;
    this.turned = false;
    this.sheltered = false;
    this.computerSpot = null;
    this.reading = null;
    this.cctvOpen = false;
    this.generatorPanel = null;
    this.elec.reset(this.rng, (this.town.facts.powerOffDay - 1) * 1440 + 6 * 60);
    this.generatorPanel = null;
    for (const c of this.town.computers) c.state = createComputerState(c.state.def, c.initialBattery);
    this.barriers.reset(mulberry32(BARRIER_SEED));
    this.breachers.clear();
    this.action = null;
    this.keypadId = null;
    this.causeOfDeath = "";
    this.respawnTimer = 30;
    this.autosaveTimer = AUTOSAVE_SECONDS;
  }

  resume() {
    if (this.status === "playing" && !this.locked) {
      this.requestLock();
      return;
    }
    if (this.status !== "paused") return;
    this.status = "playing";
    this.audio.resume();
    this.requestLock();
    this.emitHud();
  }

  pause() {
    if (this.status !== "playing") return;
    this.status = "paused";
    this.input.reset();
    this.audio.suspend();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.emitHud();
  }

  private uiOpen() {
    return this.inventoryOpen || !!this.container || !!this.computerSpot || !!this.reading || !!this.generatorPanel || this.keypadId !== null;
  }

  toggleInventory() {
    if (this.status !== "playing") return;
    if (this.computerSpot) return; // Tab completes in the terminal
    if (this.uiOpen()) this.closeUi();
    else {
      this.inventoryOpen = true;
      this.releaseLock();
    }
    this.emitHud();
  }

  /** gesture: the call comes from a click or key press that may capture the mouse. */
  closeUi(gesture = true) {
    this.inventoryOpen = false;
    this.container = null;
    this.computerSpot = null;
    this.reading = null;
    this.cctvOpen = false;
    this.generatorPanel = null;
    this.keypadId = null;
    this.input.reset();
    if (this.status === "playing" && gesture) this.requestLock();
    this.emitHud();
  }

  useItem(uid: number) {
    const stack = this.inventory.find((s) => s.uid === uid);
    if (!stack) return;
    const def = ITEMS[stack.id];
    const p = this.player;
    switch (def.category) {
      case "food":
      case "drink":
        eat(p.body, def.hunger ?? 0, def.thirst ?? 0);
        this.audio.eat();
        this.message(`${def.category === "food" ? "Ate" : "Drank"} ${def.name}.`, "good");
        this.consume(stack);
        break;
      case "medical":
        if (def.medical === "painkillers") {
          takePainkillers(p.body);
          this.message("You swallow a couple of painkillers.", "good");
          this.consume(stack);
        } else if (def.medical === "firstAid") {
          let treated = 0;
          while (bandage(p.body)) treated++;
          heal(p.body, def.heal ?? 0);
          this.message(treated ? `Dressed ${treated} wound${treated === 1 ? "" : "s"}.` : "You patch yourself up.", "good");
          this.consume(stack);
        } else {
          this.treatWound();
          return;
        }
        break;
      case "melee":
      case "firearm":
        this.setEquipped(this.equippedUid === uid ? null : uid);
        break;
      case "tool":
        if (def.generator) {
          const p = this.player;
          const pos = p.pos.clone().add(new THREE.Vector3(Math.sin(p.bodyYaw) * 1.2, 0, Math.cos(p.bodyYaw) * 1.2));
          pos.y = this.terrain.height(pos.x, pos.z);
          this.elec.placePortable(pos, def.generator.ratedW, def.generator.tankL, Math.min(stack.fuel ?? 0, def.generator.tankL), def.generator.noise);
          this.inventory = this.inventory.filter((s) => s !== stack);
          this.message("You set the generator down. Press E on it to connect, fuel and start it.", "info");
        }
        break;
      case "note":
        this.reading = { title: stack.title ?? "Note", text: stack.text ?? "" };
        this.inventoryOpen = false;
        this.container = null;
        break;
      default:
        break;
    }
    this.emitHud();
  }

  // ------------------------------------------------------------ computers

  private computerContext() {
    const day = Math.floor(this.minutes / 1440) + 1;
    const c = this.computerSpot;
    return {
      nowMs: performance.now(),
      dateText: gameDate(day, this.minutes % 1440),
      uptimeMinutes: this.minutes - this.computerOpenedAt + 37,
      network: c ? this.networkView(c) : undefined,
      access: c ? this.accessView(c) : undefined,
    };
  }

  /** Live door state for the access controller on this computer's LAN, if there is one. */
  private accessView(c: ComputerSpot): AccessView | undefined {
    const spec = this.networkOf(c);
    const host = spec?.hosts.find((h) => h.kind === "controller");
    const ctl = host && this.controllers.find((x) => x.hostname === host.hostname);
    if (!host || !ctl) return undefined;
    return {
      controller: host.hostname,
      doors: () =>
        this.barriers.accessRows(host.hostname).map((r) => ({ ...r, label: host.access?.doors.find((d) => d.name === r.name)?.label ?? r.name })),
      power: () => {
        const st = this.elec.statusOf(ctl.building);
        const ups = this.elec.circuitOf(ctl.building).ups;
        return { source: st?.source === "ups" ? "ups" : "mains", upsPercent: ups ? (ups.chargeWh / ups.capacityWh) * 100 : null };
      },
    };
  }

  private networkOf(c: ComputerSpot): NetworkSpec | undefined {
    return this.town.buildings.find((b) => b.computer === c)?.network;
  }

  /**
   * Which devices have power. Workstations and home/shop routers run off the
   * grid; servers, recorders and cameras on a UPS outlast it for a few hours.
   */
  private deviceUp(spec: NetworkSpec, ip: string, self?: ComputerSpot): boolean {
    if (self?.state.def.net?.ip === ip) return this.computerPowered(self);
    const host = spec.hosts.find((h) => h.ip === ip);
    if (!host) return false;
    const b = this.town.buildings.find((bb) => bb.network === spec);
    if (host.kind === "computer") return this.elec.powered(b, "computer");
    if (host.kind === "tv") return this.elec.powered(b, "appliances");
    return this.elec.powered(b, "network");
  }

  private networkView(c: ComputerSpot): NetworkView | undefined {
    const spec = this.networkOf(c);
    if (!spec || !c.state.def.net) return undefined;
    return { spec, selfIp: c.state.def.net.ip, isUp: (ip) => this.deviceUp(spec, ip, c) };
  }

  /** The camera viewer's canvas for a channel (the viewer mounts it directly). */
  cctvCanvas(channel: number): HTMLCanvasElement | null {
    return this.cctv.channels.find((ch) => ch.channel === channel)?.canvas ?? null;
  }

  closeCctv() {
    this.cctvOpen = false;
    this.emitHud();
  }

  /** Is the town grid still live? It fails at 06:00 on the power-off day. */
  private gridOn() {
    return this.elec.gridUp(this.minutes);
  }

  private computerPowered(c: ComputerSpot) {
    if (c.kind === "laptop") return (c.state.battery ?? 0) > 0;
    return this.elec.powered(this.town.buildings.find((b) => b.computer === c), "computer");
  }

  /** The building whose footprint contains the point; `inset` shrinks it (0.45 m = properly inside, past the wall line). */
  private buildingObj(x: number, z: number, inset = 0) {
    return this.town.buildings.find((b) => x > b.rect.minX + inset && x < b.rect.maxX - inset && z > b.rect.minZ + inset && z < b.rect.maxZ - inset);
  }

  // ------------------------------------------------------------ generators

  private openGenerator(g: GeneratorObject) {
    this.generatorPanel = g;
    this.inventoryOpen = false;
    this.container = null;
    this.releaseLock();
    this.emitHud();
  }

  private fuelCan() {
    return this.inventory.find((s) => s.id === "jerry_can" && (s.fuel ?? 0) > 0.05);
  }

  /** Buttons on the generator panel. */
  generatorAction(action: "start" | "stop" | "refuel" | "reset" | "connect" | "disconnect" | "pickup") {
    const obj = this.generatorPanel;
    if (!obj) return;
    const g = obj.gen;
    switch (action) {
      case "start": {
        const why = startGenerator(g);
        if (why) this.message(why, "warn");
        else this.message("It coughs, catches, and roars to life.", "info");
        break;
      }
      case "stop":
        g.running = false;
        this.message("The engine winds down.", "info");
        break;
      case "refuel": {
        const can = this.fuelCan();
        if (!can) {
          this.message("You have no fuel.", "warn");
          break;
        }
        const added = refuel(g, can.fuel ?? 0);
        can.fuel = Math.round(((can.fuel ?? 0) - added) * 10) / 10;
        this.message(added > 0 ? `You pour in ${added.toFixed(1)} L.` : "The tank is already full.", "info");
        break;
      }
      case "reset": {
        const why = resetBreaker(this.elec.world, g);
        this.message(why ?? "Breaker reset.", why ? "warn" : "good");
        break;
      }
      case "connect": {
        const b = this.elec.buildingInReach(obj.x, obj.z);
        if (!b) {
          this.message("No building close enough to run a cable to.", "warn");
          break;
        }
        if (this.elec.world.generators.some((o) => o !== g && o.buildingId === b.address)) {
          this.message(`${b.address} already has a generator connected.`, "warn");
          break;
        }
        g.buildingId = b.address;
        this.message(`You run the cable into ${b.address} and plug it into the panel.`, "good");
        break;
      }
      case "disconnect":
        g.buildingId = null;
        this.message("Cable unplugged.", "info");
        break;
      case "pickup": {
        if (g.running) {
          this.message("Turn it off first.", "warn");
          break;
        }
        const def = ITEMS.portable_generator;
        if (this.carryWeight() + def.weight + g.fuelL * 0.74 > MAX_WEIGHT * 1.5) {
          this.message("Too heavy to carry with everything else you have.", "warn");
          break;
        }
        this.elec.removePortable(obj);
        this.addToInventory({ ...makeStack("portable_generator"), fuel: g.fuelL });
        this.generatorPanel = null;
        this.closeUi(true);
        return;
      }
    }
    this.emitHud();
  }

  /** Siphon fuel from the car you're searching into a jerry can. */
  siphonFuel() {
    const car = this.container;
    if (!car || car.table !== "car") return;
    const can = this.inventory.find((s) => s.id === "jerry_can" && (s.fuel ?? 0) < (ITEMS.jerry_can.fuelCapacity ?? 20) - 0.05);
    if (!can) {
      this.message("You need a jerry can with room in it.", "warn");
      return;
    }
    if (!car.fuel) {
      this.message("The tank is dry.", "warn");
      return;
    }
    const take = Math.min(car.fuel, (ITEMS.jerry_can.fuelCapacity ?? 20) - (can.fuel ?? 0));
    car.fuel = Math.round((car.fuel - take) * 10) / 10;
    can.fuel = Math.round(((can.fuel ?? 0) + take) * 10) / 10;
    this.message(`You siphon ${take.toFixed(1)} L. It tastes awful.`, "good");
    this.emitHud();
  }

  // ------------------------------------------------- doors and windows

  private barrierTarget() {
    const p = this.player;
    const aim = this.aimed();
    const aimedAt = aim?.barrier !== undefined ? this.barriers.target(aim.barrier, p.pos, INTERACT_RANGE) : null;
    return aimedAt ?? this.barriers.nearest(p.pos, p.yaw, INTERACT_RANGE);
  }

  /** Distance and stereo pan from the listener to a point. */
  private hear(at: THREE.Vector3): [number, number] {
    const p = this.player;
    const to = new THREE.Vector3(at.x - p.pos.x, 0, at.z - p.pos.z);
    const d = to.length();
    const right = new THREE.Vector3(-Math.cos(p.yaw), 0, Math.sin(p.yaw));
    return [d, d > 0.01 ? to.normalize().dot(right) : 0];
  }

  /** Where a noise you make at a door or window comes from: just your side of it (not inside the building). */
  private atYourSide(id: number) {
    return this.barriers.approach(id, this.barriers.sideOf(id, this.player.pos), 0.6);
  }

  /** An electric lock biting or letting go. */
  private lockSound(id: number) {
    const at = this.barriers.centre(id);
    const [d, pan] = this.hear(at);
    this.audio.lockClunk(d, pan);
    this.noises.push({ pos: at.clone(), radius: BARRIER_NOISE.lockClunk, ttl: 0.4 });
  }

  private countItem(id: string) {
    return this.inventory.filter((s) => s.id === id).reduce((n, s) => n + s.count, 0);
  }

  private takeItems(id: string, count: number) {
    for (const s of this.inventory.filter((st) => st.id === id)) {
      const take = Math.min(count, s.count);
      s.count -= take;
      count -= take;
      if (count <= 0) break;
    }
    this.inventory = this.inventory.filter((s) => s.count > 0);
    if (this.equippedUid !== null && !this.equippedStack()) this.setEquipped(null);
  }

  private startAction(a: Omit<TimedAction, "t" | "nextBeat" | "heldAtStart">) {
    const heldAtStart = MOVE_KEYS.filter((k) => this.input.isDown(k));
    this.action = { ...a, t: 0, nextBeat: (a.every ?? 0) * 0.5, heldAtStart };
    this.emitHud();
  }

  private updateAction(dt: number) {
    const a = this.action!;
    const input = this.input;
    if (a.hold && !input.isDown(a.hold)) return this.cancelAction(null);
    // Moving off cancels; a key you were already holding when you started doesn't (you were walking up to it).
    if (MOVE_KEYS.some((k) => input.isDown(k) && !a.heldAtStart.includes(k))) return this.cancelAction(null);
    a.heldAtStart = a.heldAtStart.filter((k) => input.isDown(k));
    a.t += dt;
    if (a.every && a.beat) {
      while (a.t >= a.nextBeat && a.nextBeat < a.dur) {
        a.beat();
        a.nextBeat += a.every;
      }
    }
    if (a.t >= a.dur) {
      this.action = null;
      a.done();
      if (a.repeat && a.hold && input.isDown(a.hold)) a.repeat();
      this.emitHud();
    }
  }

  private cancelAction(why: string | null) {
    this.action = null;
    if (why) this.message(why, "warn");
    this.emitHud();
  }

  /** Nobody standing where the leaf closes. */
  private doorObstructed(id: number) {
    const box = this.barriers.doorBox(id);
    const inside = (pos: THREE.Vector3, r: number) =>
      pos.x > box.minX - r && pos.x < box.maxX + r && pos.z > box.minZ - r && pos.z < box.maxZ + r;
    return inside(this.player.pos, 0.3) || this.zombies.some((z) => z.alive && inside(z.pos, z.radius * 0.8));
  }

  /** E on a door or window. */
  private useBarrier(id: number, side: Side) {
    const b = this.barriers.barrier(id);
    const at = this.barriers.closestPoint(id, this.player.pos);
    if (b.boards.length && (b.kind === "window" || !b.open || b.broken)) {
      this.message(`It's boarded up${b.boardSide === side ? "" : " from the other side"}.`, "info");
      return;
    }
    if (b.kind === "door") {
      if (b.broken) {
        this.message("Smashed off its hinges.", "info");
      } else if (b.open) {
        if (this.doorObstructed(id)) {
          this.message("Something's in the way.", "warn");
          return;
        }
        this.barriers.close(id);
        const [d, pan] = this.hear(at);
        this.audio.doorThud(d, pan);
        this.noises.push({ pos: this.atYourSide(id), radius: BARRIER_NOISE.doorClose, ttl: 0.4 });
      } else if (side === -1 && b.bolted) {
        this.startAction({
          label: "Unbolting",
          dur: DOOR.unboltSeconds,
          done: () => {
            this.audio.lockClunk(0, 0);
            this.openDoorNow(id, side);
          },
        });
      } else {
        this.openDoorNow(id, side);
      }
      return;
    }
    if (b.glass === "intact") {
      this.startAction({ label: "Breaking the glass", dur: WINDOW.breakSeconds, done: () => this.smashWindow(id) });
      return;
    }
    this.climbThrough(id, side);
  }

  private openDoorNow(id: number, side: Side) {
    const why = this.barriers.open(id, side);
    const at = this.barriers.closestPoint(id, this.player.pos);
    if (why) {
      if (why === "Locked.") {
        const b = this.barriers.barrier(id);
        const keypad = !!this.barriers.specs[id].keypad;
        const text = !b.electronic
          ? b.bolted
            ? "Locked. Deadbolted from inside."
            : why
          : !keypad
            ? "Locked. Something electric holds it shut."
            : b.electronic.powered
              ? "Locked. The keypad's light is red."
              : "Locked. The keypad by the door is dark.";
        this.message(text, "info");
        this.audio.doorBang(0, 0, b.build === "steel" ? "steel" : "wood");
      } else this.message(why, "info");
      return;
    }
    const [d, pan] = this.hear(at);
    this.audio.doorCreak(d, pan);
    this.noises.push({ pos: this.atYourSide(id), radius: BARRIER_NOISE.doorOpen, ttl: 0.4 });
  }

  private smashWindow(id: number) {
    if (!this.barriers.breakGlass(id)) return;
    const at = this.barriers.closestPoint(id, this.player.pos).setY(0);
    const [d, pan] = this.hear(at);
    this.audio.glassBreak(d, pan);
    this.noises.push({ pos: this.atYourSide(id), radius: BARRIER_NOISE.glassBreak, ttl: 0.5 });
    if (d < 2.5) this.player.addShake(0.15);
  }

  private climbThrough(id: number, side: Side) {
    const p = this.player;
    const t = this.barriers.traversal(id, side, p.pos);
    if (!t) {
      this.message("Something's blocking the other side.", "warn");
      return;
    }
    const cut = climbCut(this.barriers.barrier(id), Math.random);
    p.traverse(t.from, t.to, t.dur, t.peak);
    this.audio.climb(0, 0);
    this.noises.push({ pos: this.barriers.centre(id).clone(), radius: BARRIER_NOISE.climb, ttl: 0.5 });
    if (cut) {
      addWound(p.body, cut, "laceration", Math.random);
      this.damageFlash = 0.6;
      this.audio.hurt();
      this.message(`You slice your ${BODY_PART_NAMES[cut].toLowerCase()} on the broken glass.`, "danger");
    }
  }

  /** Q: the deadbolt on a door, or clearing shards out of a broken window. */
  private altBarrier(id: number, side: Side) {
    const b = this.barriers.barrier(id);
    if (b.kind === "door") {
      const was = b.bolted;
      const why = this.barriers.bolt(id, side);
      if (why) {
        this.message(why, "info");
        return;
      }
      this.audio.lockClunk(0, 0);
      this.noises.push({ pos: this.atYourSide(id), radius: BARRIER_NOISE.bolt, ttl: 0.3 });
      this.message(was ? "You draw the deadbolt." : "You throw the deadbolt.", "info");
      return;
    }
    if (b.glass === "intact") {
      this.message("The sash is painted shut. You'd have to break the glass.", "info");
    } else if (b.glass === "broken") {
      if (b.boards.length && b.boardSide === side) {
        this.message("The boards are in the way.", "info");
        return;
      }
      const at = this.barriers.centre(id);
      this.startAction({
        label: "Clearing the shards",
        dur: WINDOW.clearSeconds,
        every: 0.6,
        beat: () => {
          const [d, pan] = this.hear(at);
          this.audio.doorBang(d, pan, "glass");
          this.noises.push({ pos: this.atYourSide(id), radius: BARRIER_NOISE.clearGlass, ttl: 0.3 });
        },
        done: () => {
          if (this.barriers.clear(id)) this.message("You knock the last shards out of the frame.", "info");
        },
      });
    }
  }

  /** Hold H: nail a board across the door or window from your side. */
  private startBoarding(id: number, side: Side) {
    const b = this.barriers.barrier(id);
    if (!this.countItem("hammer")) {
      this.message("You need a hammer to board it up.", "warn");
      return;
    }
    const why = canBoard(b, side);
    if (why) {
      this.message(why, "info");
      return;
    }
    const cost = boardCost(b);
    if (this.countItem("plank") < cost.planks || this.countItem("nails") < cost.nails) {
      this.message(`You need ${cost.planks} plank${cost.planks > 1 ? "s" : ""} and ${cost.nails} nails for each board.`, "warn");
      return;
    }
    const max = BARRICADE.maxBoards[b.kind];
    const at = this.barriers.closestPoint(id, this.player.pos).setY(1.2);
    this.startAction({
      label: `Boarding up (${b.boards.length + 1}/${max})`,
      dur: cost.seconds,
      hold: "KeyH",
      every: BARRICADE.hammerInterval,
      beat: () => {
        const [d, pan] = this.hear(at);
        this.audio.hammer(d, pan);
        this.noises.push({ pos: this.atYourSide(id), radius: BARRIER_NOISE.hammer, ttl: 0.3 });
      },
      done: () => {
        // Things may have changed while you worked.
        if (canBoard(b, side) || this.countItem("plank") < cost.planks || this.countItem("nails") < cost.nails) return;
        this.takeItems("plank", cost.planks);
        this.takeItems("nails", cost.nails);
        this.barriers.board(id, side);
        this.message(b.boards.length >= max ? "Boarded up solid." : `Board nailed (${b.boards.length}/${max}). Keep holding H for another.`, "good");
      },
      repeat: () => {
        if (!canBoard(b, side) && this.countItem("plank") >= cost.planks && this.countItem("nails") >= cost.nails) this.startBoarding(id, side);
      },
    });
  }

  /** Shift+H: pry the outermost board off from the side it's nailed on. */
  private startPrying(id: number, side: Side) {
    const b = this.barriers.barrier(id);
    if (!b.boards.length) {
      this.message("There are no boards to pry off.", "info");
      return;
    }
    if (b.boardSide !== side) {
      this.message("The boards are nailed on from the other side.", "info");
      return;
    }
    if (!this.countItem("hammer")) {
      this.message("You need a hammer's claw to pry boards off.", "warn");
      return;
    }
    const at = this.barriers.closestPoint(id, this.player.pos).setY(1.2);
    this.startAction({
      label: "Prying off a board",
      dur: BARRICADE.prySeconds,
      hold: "KeyH",
      every: 1,
      beat: () => {
        const [d, pan] = this.hear(at);
        this.audio.pry(d, pan);
        this.noises.push({ pos: this.atYourSide(id), radius: BARRIER_NOISE.pry, ttl: 0.3 });
      },
      done: () => {
        const got = this.barriers.pry(id, side);
        if (!got) return;
        this.addToInventory(makeStack("plank", got.planks));
        this.message(`You pry the board off: ${got.planks} plank${got.planks > 1 ? "s" : ""}. The nails are bent and useless.`, "info");
      },
      repeat: () => {
        if (b.boards.length && b.boardSide === side) this.startPrying(id, side);
      },
    });
  }

  private openKeypad(id: number) {
    const e = this.barriers.barrier(id).electronic;
    if (!e?.powered) {
      this.message("The keypad is dark. No power.", "info");
      return;
    }
    this.keypadId = id;
    this.keypadEntry = "";
    this.keypadStatus = "idle";
    this.inventoryOpen = false;
    this.container = null;
    this.releaseLock();
    this.emitHud();
  }

  /** A key on the door keypad: a digit, "C" to clear or "#" to enter. */
  keypadPress(key: string) {
    const id = this.keypadId;
    if (id === null) return;
    const b = this.barriers.barrier(id);
    if (!b.electronic?.powered) {
      this.keypadStatus = "dark";
    } else if (key === "C") {
      this.keypadEntry = "";
      this.keypadStatus = "idle";
      this.audio.keypadBeep(true);
    } else if (key === "#") {
      const r = this.barriers.keypad(id, this.keypadEntry);
      this.keypadEntry = "";
      this.keypadStatus = r;
      this.audio.keypadBeep(r === "granted");
      this.noises.push({ pos: this.player.pos.clone(), radius: BARRIER_NOISE.keypad, ttl: 0.3 });
      if (r === "granted") {
        this.lockSound(id);
        this.message("The strike clicks. You have a few seconds.", "good");
        this.closeUi(true);
        return;
      }
      if (r === "lockout") this.message("The keypad flashes red and stops responding.", "warn");
    } else if (/^[0-9]$/.test(key) && this.keypadEntry.length < 8) {
      if (b.electronic.lockoutLeft > 0) this.keypadStatus = "lockout";
      else {
        this.keypadEntry += key;
        this.keypadStatus = "idle";
        this.audio.keypadBeep(true);
      }
    }
    this.emitHud();
  }

  private useComputer(c: ComputerSpot) {
    if (!this.computerPowered(c)) {
      this.message(c.kind === "laptop" ? "The laptop's battery is dead." : "The screen stays black. There's no power.", "warn");
      return;
    }
    if (c.state.phase === "off") {
      boot(c.state, this.computerContext());
      this.computerOpenedAt = this.minutes;
    }
    this.computerSpot = c;
    this.inventoryOpen = false;
    this.container = null;
    this.releaseLock();
    this.emitHud();
  }

  computerSubmit(line: string) {
    const c = this.computerSpot;
    if (!c) return;
    submit(c.state, line, this.computerContext());
    for (const fx of c.state.effects.splice(0)) {
      if (fx.type === "cctv") {
        this.cctvOpen = true;
        const spec = this.networkOf(c);
        const day = Math.floor(this.minutes / 1440) + 1;
        if (spec) this.cctv.renderAll((ip) => this.deviceUp(spec, ip), this.env.daylight(this.minutes % 1440), `${gameDate(day, this.minutes % 1440)}:00`);
      } else if (fx.type === "door") {
        const id = this.barriers.command(fx.controller, fx.door, fx.action);
        if (id !== null) this.lockSound(id);
      }
    }
    // Keyboard clatter carries a little.
    this.noises.push({ pos: this.player.pos.clone(), radius: 2.5, ttl: 0.4 });
    if (c.state.phase === "off") {
      this.message(`${c.state.def.hostname} powers off.`, "info");
      this.closeUi(true);
      return;
    }
    this.emitHud();
  }

  computerComplete(line: string): string {
    const c = this.computerSpot;
    if (!c) return line;
    const out = complete(c.state, line);
    this.emitHud();
    return out;
  }

  /** Bandage a wound (the worst one if no id is given) using a bandage or first aid kit. */
  treatWound(woundId?: number) {
    const p = this.player;
    const supply =
      this.inventory.find((s) => ITEMS[s.id].medical === "bandage") ??
      this.inventory.find((s) => ITEMS[s.id].medical === "firstAid");
    if (!supply) {
      this.message("You have nothing to bandage it with.", "warn");
      return;
    }
    const w = bandage(p.body, woundId);
    if (!w) {
      this.message("You have no open wounds.", "info");
      return;
    }
    this.message(`Bandaged the ${w.kind} on your ${BODY_PART_NAMES[w.part].toLowerCase()}.`, "good");
    this.consume(supply);
    this.emitHud();
  }

  dropItem(uid: number) {
    const idx = this.inventory.findIndex((s) => s.uid === uid);
    if (idx < 0) return;
    const [stack] = this.inventory.splice(idx, 1);
    if (this.equippedUid === uid) this.setEquipped(null);
    // Drop onto an existing pile at your feet, or start a new one.
    const p = this.player.pos;
    let pile = this.town.containers.find((c) => c.table === "ground" && Math.hypot(c.x - p.x, c.z - p.z) < 1.5);
    if (!pile) pile = this.makePile(100000 + this.messageId++, p.x, p.y + 0.1, p.z);
    pile.items!.push(stack);
    this.emitHud();
  }

  /** A pile of dropped things on the ground (a loot container with a bag mesh). */
  private makePile(id: number, x: number, y: number, z: number): LootContainer {
    const pile: LootContainer = { id, name: "Ground", table: "ground", x, y, z, hx: 0.3, hz: 0.3, items: [] };
    this.town.containers.push(pile);
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.22, 0.35), new THREE.MeshStandardMaterial({ color: "#3d4134", roughness: 1 }));
    bag.position.set(x, y + 0.01, z);
    bag.rotation.y = (id * 2.399) % Math.PI;
    bag.castShadow = true;
    this.scene.add(bag);
    this.groundPiles.set(id, bag);
    return pile;
  }

  takeFromContainer(uid: number) {
    const c = this.container;
    if (!c?.items) return;
    const idx = c.items.findIndex((s) => s.uid === uid);
    if (idx < 0) return;
    const stack = c.items[idx];
    if (this.carryWeight() + stackWeight(stack) > MAX_WEIGHT * 1.5) {
      this.message("You can't carry any more.", "warn");
      return;
    }
    c.items.splice(idx, 1);
    this.addToInventory(stack);
    this.audio.pickup();
    this.cleanupPile(c);
    this.emitHud();
  }

  takeAll() {
    const c = this.container;
    if (!c?.items) return;
    for (const s of [...c.items]) this.takeFromContainer(s.uid);
  }

  putInContainer(uid: number) {
    const c = this.container;
    if (!c?.items) return;
    const idx = this.inventory.findIndex((s) => s.uid === uid);
    if (idx < 0) return;
    const [stack] = this.inventory.splice(idx, 1);
    if (this.equippedUid === uid) this.setEquipped(null);
    c.items.push(stack);
    this.emitHud();
  }

  // --------------------------------------------------------- save and load

  /** Everything about this run that the world seed can't rebuild. */
  private toSave(): SaveData {
    const p = this.player;
    const nowMs = performance.now();
    const meta: SaveMeta = {
      version: SAVE_VERSION,
      worldSeed: WORLD_SEED,
      savedAt: new Date().toISOString(),
      day: Math.floor(this.minutes / 1440) + 1,
      timeOfDay: this.minutes % 1440,
      location: this.location,
      survivedMinutes: this.minutes - START_MINUTES,
      kills: this.kills,
      health: p.body.health,
    };
    return {
      version: SAVE_VERSION,
      worldSeed: WORLD_SEED,
      meta,
      minutes: this.minutes,
      rng: { game: this.rng.state() },
      player: {
        pos: [p.pos.x, p.pos.y, p.pos.z],
        yaw: p.yaw,
        pitch: p.pitch,
        bodyYaw: p.bodyYaw,
        crouching: p.crouching,
        body: p.body,
        inventory: this.inventory,
        equippedUid: this.equippedUid,
        flashlight: this.flashlightOn,
      },
      kills: this.kills,
      respawnTimer: this.respawnTimer,
      nextUid: peekNextUid(),
      zombies: this.zombies.map((z) => z.toSave()),
      containers: this.town.containers
        .filter((c) => c.table !== "ground" && (c.items !== null || c.fuel !== this.initialFuel.get(c.id)))
        .map((c) => ({ id: c.id, items: c.items, ...(c.fuel !== undefined ? { fuel: c.fuel } : {}) })),
      ground: this.town.containers.filter((c) => c.table === "ground" && c.items?.length).map((c) => ({ id: c.id, pos: [c.x, c.y, c.z], items: c.items! })),
      computers: this.town.computers.map((c) => ({ id: c.id, state: saveComputer(c.state, nowMs) })),
      power: this.elec.toSave(),
      barriers: this.barriers.world,
    };
  }

  /** Rebuild a run from a save on top of the freshly generated town. */
  private applySave(d: SaveData) {
    this.resetRun();
    const nowMs = performance.now();
    this.minutes = d.minutes;
    this.rng.setState(d.rng.game);
    const p = this.player;
    p.reset(this.town.playerSpawn);
    p.pos.set(d.player.pos[0], d.player.pos[1], d.player.pos[2]);
    p.yaw = d.player.yaw;
    p.pitch = d.player.pitch;
    p.bodyYaw = d.player.bodyYaw;
    p.crouching = d.player.crouching;
    p.body = d.player.body;
    p.model.root.visible = true;
    setNextUid(d.nextUid);
    this.inventory = d.player.inventory;
    this.setEquipped(this.inventory.some((s) => s.uid === d.player.equippedUid) ? d.player.equippedUid : null);
    this.flashlightOn = d.player.flashlight;
    this.kills = d.kills;
    this.respawnTimer = d.respawnTimer;

    const byId = new Map(this.town.containers.map((c) => [c.id, c]));
    for (const c of d.containers) {
      const target = byId.get(c.id);
      if (!target) continue;
      target.items = c.items;
      if (c.fuel !== undefined) target.fuel = c.fuel;
    }
    for (const g of d.ground) {
      const pile = this.makePile(g.id, g.pos[0], g.pos[1], g.pos[2]);
      pile.items = g.items;
      this.messageId = Math.max(this.messageId, g.id - 100000 + 1);
    }
    for (const sc of d.computers) {
      const c = this.town.computers.find((x) => x.id === sc.id);
      if (!c) continue;
      const spec = this.networkOf(c);
      c.state = restoreComputer(c.state.def, sc.state, nowMs, (host) => spec?.hosts.find((h) => h.hostname === host)?.def);
    }
    this.elec.restore(d.power);
    this.barriers.world = d.barriers;
    this.barriers.syncAll();
    for (const zs of d.zombies) {
      const z = Zombie.fromSave(zs);
      this.zombies.push(z);
      this.scene.add(z.model.root);
    }
  }

  /** Write the run to a slot. Quiet saves (autosave) only speak up when they fail. */
  async saveGame(slot: SlotId, quiet = false) {
    if ((this.status !== "playing" && this.status !== "paused") || this.saving) return;
    this.saving = true;
    try {
      const data = this.toSave();
      await this.saves.write({ slot, meta: data.meta, data: serialise(data) });
      if (!quiet) this.message(slot === "auto" ? "Autosaved." : `Saved to slot ${slot}.`, "good");
      await this.refreshSaves();
    } catch {
      this.message("Couldn't save: the browser refused to store it (storage full or blocked).", "danger");
    } finally {
      this.saving = false;
    }
  }

  async loadGame(slot: SlotId) {
    if (this.status === "loading") return;
    const rec = await this.saves.read(slot);
    if (!rec) {
      this.message("That slot is empty.", "warn");
      return;
    }
    let data: SaveData;
    try {
      data = deserialise(rec.data, WORLD_SEED);
    } catch (e) {
      this.message(e instanceof SaveError ? e.message : "This save is damaged and can't be loaded.", "danger");
      this.emitHud();
      return;
    }
    this.audio.init();
    this.applySave(data);
    this.status = "playing";
    this.message(`Day ${data.meta.day}. You pick up where you left off.`, "info");
    this.requestLock();
    this.emitHud();
  }

  async deleteSave(slot: SlotId) {
    await this.saves.remove(slot);
    await this.refreshSaves();
  }

  private async refreshSaves() {
    this.saveList = await this.saves.list();
    this.emitHud();
  }

  // --------------------------------------------------------- pointer lock

  private lastRequestWasGesture = false;

  private requestLock(gesture = true) {
    this.lastRequestWasGesture = gesture;
    if (this.freeMouse) {
      this.locked = true;
      this.input.capturing = true;
      return;
    }
    try {
      const result = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      if (result && typeof result.catch === "function") result.catch(() => this.onLockError());
    } catch {
      this.onLockError();
    }
  }

  private releaseLock() {
    this.locked = false;
    this.input.capturing = false;
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  private onLockChange = () => {
    const isLocked = document.pointerLockElement === this.canvas;
    this.locked = isLocked;
    this.input.capturing = isLocked;
    if (!isLocked && this.status === "playing" && !this.uiOpen()) this.pause();
    this.emitHud();
  };

  private lockFailures = 0;
  private onLockError = () => {
    // Pointer lock can be refused (embedded frames, no user gesture). After
    // two refused clicks we fall back to free-mouse look so the game stays playable.
    if (this.lastRequestWasGesture) this.lockFailures++;
    if (this.lockFailures >= 2 && !this.freeMouse) {
      this.freeMouse = true;
      this.message("Mouse capture isn't available here, so the cursor stays free.", "warn");
    }
    if (this.freeMouse && this.status === "playing") {
      this.locked = true;
      this.input.capturing = true;
    } else {
      this.locked = false;
      this.input.capturing = false;
    }
    this.emitHud();
  };

  private onCanvasClick = () => {
    if (this.status === "playing" && !this.locked && !this.uiOpen()) this.requestLock();
  };

  // ------------------------------------------------------------ main loop

  private loop = () => {
    const dt = Math.min(this.clock.getDelta(), 1 / 20);

    if (this.status === "menu" || this.status === "loading") {
      this.menuAngle += dt * 0.04;
      const r = 70;
      this.camera.position.set(Math.cos(this.menuAngle) * r, 28, Math.sin(this.menuAngle) * r);
      this.camera.lookAt(0, 0, 0);
      this.env.update(17.6 * 60, new THREE.Vector3(0, 0, 0));
    } else if (this.status === "playing") {
      this.update(dt);
    } else if (this.status === "dead") {
      for (const z of this.zombies) z.update(this.zombieContext(dt));
      this.player.model.fall(1);
    }

    const day = this.env.daylight(this.status === "menu" || this.status === "loading" ? 17.6 * 60 : this.minutes % 1440);
    this.sky.update(this.env.skyColor, this.env.sunDir, day, this.camera);
    this.post.render(dt, this.status === "playing" ? bloodPercent(this.player.body) : 100);
    this.watchPerformance(dt);

    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.1;
      this.emitHud();
    }
    this.input.endFrame();
  };

  private update(dt: number) {
    const p = this.player;
    const asleep = p.body.asleep;
    const controlling = this.locked && !this.uiOpen() && !asleep;
    const gameMinutes = dt * TIME_SCALE * (asleep ? SLEEP_TIME_SCALE : 1);
    this.minutes += gameMinutes;
    if (asleep && this.input.wasPressed("KeyZ")) this.wake("You get up.");

    // Keys that work even with menus open
    if (this.input.wasPressed("Tab") || this.input.wasPressed("KeyI")) this.toggleInventory();
    if (this.uiOpen() && !this.cctvOpen && this.input.wasPressed("Escape")) this.closeUi(false);

    if (controlling) {
      this.handleActions(dt);
    } else {
      this.input.mouseDX = this.input.mouseDY = 0;
    }
    if (this.action) {
      if (controlling) this.updateAction(dt);
      else this.cancelAction(null);
    }

    const swinging = this.swingTime > 0;
    // Busy hands: you can look around but not walk off mid-job.
    if (controlling && !this.action) p.update(dt, this.input, this.colliders, this.terrain, swinging);
    else if (controlling) p.update(dt, lookOnly(this.input), this.colliders, this.terrain, swinging);
    else p.update(dt, NO_INPUT, this.colliders, this.terrain, swinging);
    for (const id of this.barriers.update(dt)) this.lockSound(id);
    p.overweight = this.carryWeight() > MAX_WEIGHT;

    this.updateCombat(dt);

    // Close the loot window if you get dragged away from it.
    if (this.container && this.distanceToContainer(this.container) > INTERACT_RANGE + 1) this.closeUi();
    if (this.computerSpot && this.distanceToContainer(this.computerSpot) > INTERACT_RANGE + 1) this.closeUi();
    this.updateElectricity(dt, gameMinutes);
    if (this.generatorPanel && this.distanceToContainer(this.generatorPanel) > INTERACT_RANGE + 1) this.closeUi();
    if (this.cctvOpen && this.computerSpot) {
      const spec = this.networkOf(this.computerSpot);
      const day = Math.floor(this.minutes / 1440) + 1;
      if (spec) {
        this.cctv.update(dt, (ip) => this.deviceUp(spec, ip), this.env.daylight(this.minutes % 1440), `${gameDate(day, this.minutes % 1440)}:${String(Math.floor((this.minutes * 60) % 60)).padStart(2, "0")}`);
      }
    }
    this.location = this.buildingAt(p.pos.x, p.pos.z);

    // Shelter check: is there a roof overhead?
    this.shelterTimer -= dt;
    if (this.shelterTimer <= 0) {
      this.shelterTimer = 0.5;
      this.sheltered = this.colliders.raycast(p.pos.x, p.pos.y + 1.7, p.pos.z, 0, 1, 0, 6) < 6;
    }
    const day = Math.floor(this.minutes / 1440) + 1;
    this.airTemp = airTemperature(this.minutes % 1440, day, this.sheltered);
    const threats = this.zombies.filter((z) => z.hunting && z.pos.distanceTo(p.pos) < 25).length;
    const death = updateBody(p.body, dt, gameMinutes, { ambientTemp: this.airTemp, exertion: p.exertion, threats });
    if (death) this.die(death);
    if (asleep) {
      if (p.body.fatigue < 3) this.wake("You wake up rested.");
      else if (threats > 0) this.wake("Something is coming. You jolt awake.");
    }

    this.updateZombies(dt);
    this.noises = this.noises.filter((n) => (n.ttl -= dt) > 0);

    // Autosave in quiet moments: never mid-fight, mid-climb, mid-job or with a menu open.
    this.autosaveTimer -= dt;
    if (this.autosaveTimer <= 0 && !this.zombies.some((z) => z.hunting) && !this.uiOpen() && !p.traversing && !this.action) {
      this.autosaveTimer = AUTOSAVE_SECONDS;
      void this.saveGame("auto", true);
    }

    const daylight = this.env.daylight(this.minutes % 1440);
    this.env.update(this.minutes % 1440, p.pos);
    this.updateFlashlight(daylight);
    p.updateCamera(this.camera, this.colliders, dt);

    this.damageFlash = Math.max(0, this.damageFlash - dt * 2);
    if (this.muzzleTimer > 0) {
      this.muzzleTimer -= dt;
      if (this.muzzleTimer <= 0) this.muzzle.intensity = 0;
    }
    const now = performance.now();
    this.messages = this.messages.filter((m) => (m as HudMessage & { until: number }).until > now);
  }

  /** If the first seconds of play run slowly on High, drop to Low once. */
  private watchPerformance(dt: number) {
    if (this.perfChecked || this.status !== "playing" || this.qualityChosen || this.quality === "low") return;
    this.perfTime += dt;
    this.perfFrames++;
    if (this.perfTime > 8) {
      this.perfChecked = true;
      const fps = this.perfFrames / this.perfTime;
      if (fps < 32) {
        this.quality = "low";
        this.post.setQuality("low");
        this.message("Graphics set to Low for smoother play. You can change this in the pause menu.", "info");
      }
    }
  }

  private updateElectricity(dt: number, gameMinutes: number) {
    const dark = this.env.daylight(this.minutes % 1440) < 0.35;
    const events = this.elec.step(dt, this.minutes, gameMinutes, this.player.pos, dark, this.noises);
    for (const e of events) {
      if (e.type === "gridDown") this.message("Somewhere a transformer bangs. The power is out across town.", "warn");
      if (e.type === "generatorAutoStarted") this.message("In the distance, a big engine rumbles to life.", "info");
      if (e.type === "generatorTripped") this.message("A generator's breaker trips: too much load.", "warn");
      if (e.type === "generatorOutOfFuel") this.message("A generator sputters and dies. Out of fuel.", "warn");
    }
    const grid = this.gridOn();
    this.audio.setHum(this.elec.humLevel(this.player.pos));
    // Door controllers: maglocks let go and strikes stay shut when their power dies.
    for (const c of this.controllers) {
      for (const ch of this.barriers.setControllerPower(c.hostname, this.elec.powered(c.building, "network"))) {
        this.lockSound(ch.id);
        const name = this.barriers.barrier(ch.id).electronic?.name;
        if (this.barriers.centre(ch.id).distanceTo(this.player.pos) < 40 && ch.change === "released") {
          this.message(`A heavy clunk from the ${name === "front" ? "entrance" : `${name} door`}.`, "info");
        }
      }
    }
    // Laptops recharge wherever their house has power.
    for (const comp of this.town.computers) {
      if (comp.kind !== "laptop" || comp.state.battery === null || comp.state.battery >= 100) continue;
      const b = this.town.buildings.find((bb) => bb.computer === comp);
      if (this.elec.powered(b, "charger")) comp.state.battery = Math.min(100, comp.state.battery + gameMinutes * 0.8);
    }
    // Desktops die when their power does (grid, or UPS once it runs flat).
    for (const comp of this.town.computers) {
      if (comp.kind === "desktop" && comp.state.phase !== "off" && !this.computerPowered(comp)) {
        comp.state.phase = "off";
        comp.state.remote = null;
        if (comp === this.computerSpot) {
          this.message("The screen goes black. No power.", "warn");
          this.closeUi(false);
        }
      }
    }
    // Laptop in use drains its battery: about 1% every 8 seconds.
    const c = this.computerSpot;
    if (c?.kind === "laptop" && c.state.battery !== null) {
      this.batteryTimer += dt;
      if (this.batteryTimer > 8) {
        this.batteryTimer = 0;
        c.state.battery = Math.max(0, c.state.battery - 1);
        if (c.state.battery === 0) {
          c.state.phase = "off";
          this.message("The laptop dies. Battery empty.", "warn");
          this.closeUi(false);
        }
      }
    }
    // Screens that are on glow (and can be seen from outside at night).
    for (const comp of this.town.computers) {
      const on = comp.state.phase !== "off" && this.computerPowered(comp);
      (comp.screen.material as THREE.MeshStandardMaterial).emissiveIntensity = on ? (comp === c ? 1.1 : 0.7) : 0;
    }
    // Street lamps light up after dusk while the grid is live.
    this.town.lampMaterial.emissiveIntensity = grid && dark ? 2.2 : 0;
  }

  private buildingAt(x: number, z: number): string | null {
    for (const b of this.town.buildings) {
      if (x > b.rect.minX && x < b.rect.maxX && z > b.rect.minZ && z < b.rect.maxZ) {
        const label = b.type === "house" ? "House" : b.type === "store" ? "Grocery" : b.type === "hardware" ? "Hardware store" : "Police station";
        return `${b.address} · ${label}`;
      }
    }
    return null;
  }

  private handleActions(dt: number) {
    const input = this.input;
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (input.wasPressed("Escape") || input.wasPressed("KeyP")) {
      this.pause();
      return;
    }
    if (this.player.traversing || this.action) return;

    if (input.wasPressed("KeyF")) {
      this.flashlightOn = !this.flashlightOn;
      this.audio.dryFire();
    }
    if (input.wasPressed("KeyR")) this.startReload();
    if (input.wasPressed("KeyZ")) this.trySleep();
    if (input.wasPressed("KeyB")) this.treatWound();
    if (input.wasPressed("KeyL")) {
      const b = this.buildingObj(this.player.pos.x, this.player.pos.z);
      if (!b) this.message("There's no light switch out here.", "info");
      else if (!this.elec.statusOf(b) || this.elec.statusOf(b)!.source === "none" || this.elec.statusOf(b)!.source === "ups") {
        const on = this.elec.toggleLights(b);
        this.message(on ? "You flick the switch. Nothing happens. No power." : "You flick the switch off.", "info");
      } else {
        const on = this.elec.toggleLights(b);
        this.message(on ? "Lights on. Anything outside can see them." : "Lights off.", "info");
      }
    }
    if (input.wasPressed("KeyE")) {
      const target = this.nearestInteractable();
      if (target?.type === "generator") this.openGenerator(target.generator);
      else if (target?.type === "computer") this.useComputer(target.computer);
      else if (target?.type === "container") this.openContainer(target.container);
      else if (target?.type === "barrier") this.useBarrier(target.id, target.side);
      else if (target?.type === "keypad") this.openKeypad(target.id);
    }
    if (input.wasPressed("KeyQ")) {
      const t = this.barrierTarget();
      if (t) this.altBarrier(t.id, t.side);
    }
    if (input.wasPressed("KeyH")) {
      const t = this.barrierTarget();
      if (!t) this.message("There's no door or window here to board up.", "info");
      else if (input.isDown("ShiftLeft") || input.isDown("ShiftRight")) this.startPrying(t.id, t.side);
      else this.startBoarding(t.id, t.side);
    }

    const hotbar = this.hotbar();
    for (let i = 0; i < 5; i++) {
      if (input.wasPressed(`Digit${i + 1}`) && hotbar[i]) {
        this.setEquipped(this.equippedUid === hotbar[i].uid ? null : hotbar[i].uid);
      }
    }
    if (input.wasPressed("Digit0") || input.wasPressed("Backquote")) this.setEquipped(null);

    const weapon = this.weaponDef();
    if (weapon.category === "firearm") {
      if (input.leftPressed) this.fire(weapon);
    } else if (input.leftDown && this.attackCooldown === 0 && this.swingTime === 0) {
      this.startSwing(weapon);
    }
  }

  // --------------------------------------------------------------- combat

  private weaponDef(): ItemDef {
    const stack = this.equippedStack();
    return stack ? ITEMS[stack.id] : FISTS;
  }

  private equippedStack(): ItemStack | undefined {
    return this.equippedUid === null ? undefined : this.inventory.find((s) => s.uid === this.equippedUid);
  }

  private setEquipped(uid: number | null) {
    this.equippedUid = uid;
    this.reloadTimer = 0;
    if (this.heldMesh) this.player.model.hand.remove(this.heldMesh);
    const stack = this.equippedStack();
    this.heldMesh = stack ? makeHeldItem(stack.id) : null;
    if (this.heldMesh) this.player.model.hand.add(this.heldMesh);
  }

  private startSwing(weapon: ItemDef) {
    const p = this.player;
    const cost = weapon.stamina ?? 5;
    if (p.body.stamina < cost * 0.4) {
      this.message("Too tired to swing.", "warn");
      this.attackCooldown = 0.6;
      return;
    }
    spendStamina(p.body, cost);
    this.swingDuration = (weapon.attackInterval ?? 0.6) * 0.9;
    this.swingTime = 0.0001;
    this.swingHits.clear();
    this.swungAtBarrier = false;
    this.attackCooldown = weapon.attackInterval ?? 0.6;
    this.audio.swing();
  }

  private updateCombat(dt: number) {
    const p = this.player;
    if (this.swingTime > 0) {
      if (this.hitStop > 0) {
        // Impact freeze: hold the swing for a beat so the hit lands with weight.
        this.hitStop -= dt;
      } else {
        this.swingTime += dt;
        const t = this.swingTime / this.swingDuration;
        p.attackAnim = Math.min(1, t);
        if (t >= MELEE.activeFrom && t <= MELEE.activeTo) this.sweepMelee(this.weaponDef());
        if (t >= 1) {
          this.swingTime = 0;
          p.attackAnim = 0;
        }
      }
    }

    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) this.finishReload();
    }
  }

  /** Check the swing arc this frame; heavy weapons can catch more than one zombie. */
  private sweepMelee(weapon: ItemDef) {
    const p = this.player;
    const maxTargets = weapon.sweep ?? 1;
    if (this.swingHits.size >= maxTargets) return;
    const fwd = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw));
    const reach = (weapon.reach ?? 1.3) + ZOMBIE.radius;
    const candidates = this.zombies
      .filter((z) => z.alive && !this.swingHits.has(z))
      .map((z) => ({ z, to: z.pos.clone().sub(p.pos).setY(0) }))
      .filter(({ z, to }) => {
        const d = to.length();
        return d <= reach && d > 0.001 && to.normalize().dot(fwd) >= MELEE.arcCos && this.clearReach(p.pos, z.pos);
      })
      .sort((a, b) => a.z.pos.distanceToSquared(p.pos) - b.z.pos.distanceToSquared(p.pos));
    for (const { z } of candidates) {
      if (this.swingHits.size >= maxTargets) break;
      const first = this.swingHits.size === 0;
      this.swingHits.add(z);
      const crit = Math.random() < MELEE.critChance;
      const dmg = meleeDamage(weapon.damage ?? 10, strength(p.body), crit, z.isDown);
      const knockdown = !z.isDown && Math.random() < (weapon.knockdown ?? 0);
      if (first) {
        this.hitStop = MELEE.hitStop;
        this.audio.hit();
        p.addShake(0.12);
        this.noises.push({ pos: p.pos.clone(), radius: weapon.noise ?? 3, ttl: 0.4 });
      }
      if (z.hit(dmg, p.pos, weapon.knockback ?? 1.5, knockdown)) this.onZombieKilled();
    }
    // Nothing to hit but the door or window in front of you: hit that, once per swing.
    if (this.swingHits.size === 0 && !this.swungAtBarrier) {
      const reachB = (weapon.reach ?? 1.3) + 0.35;
      const t = this.colliders.raycast(p.pos.x, p.pos.y + 1.1, p.pos.z, fwd.x, 0, fwd.z, reachB, false, this.rayHit);
      const id = this.rayHit.box?.barrierId;
      if (id !== undefined && t < reachB) {
        this.swungAtBarrier = true;
        this.strikeBarrier(id, weapon);
      }
    }
  }

  /** A melee blow (or a kick, unarmed) on a door, window or board. */
  private strikeBarrier(id: number, weapon: ItemDef) {
    const p = this.player;
    const side = this.barriers.sideOf(id, p.pos);
    const mat = struckMaterial(this.barriers.barrier(id), side);
    if (!mat) return;
    const base = this.equippedStack() ? (weapon.damage ?? 10) * strength(p.body) : BARRIER.kickDamage;
    const r = this.barriers.hit(id, base * BARRIER.playerFactor[mat], side);
    this.hitStop = MELEE.hitStop;
    p.addShake(mat === "steel" ? 0.22 : 0.12);
    this.barrierEffects(id, r, mat, p.pos, side, false);
    if (mat === "steel" && r.layer === "door" && Math.random() < 0.3) this.message("The steel barely dents. You'll need another way in.", "info");
  }

  /**
   * Can an arm or a blade get from a to b at chest height? Closed doors, glass
   * and boards stop it; an empty window frame doesn't.
   */
  private clearReach(a: THREE.Vector3, b: THREE.Vector3): boolean {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const total = Math.hypot(dx, dz);
    if (total < 1e-3) return true;
    const ux = dx / total;
    const uz = dz / total;
    // Chest height above the ground, not above a body mid-climb (that ray would pass over the window head).
    const y = Math.max(this.terrain.height(a.x, a.z), this.terrain.height(b.x, b.z)) + 1.15;
    let ox = a.x;
    let oz = a.z;
    let left = total;
    for (let i = 0; i < 3; i++) {
      const t = this.colliders.raycast(ox, y, oz, ux, 0, uz, left, false, this.rayHit);
      if (t >= left - 0.05) return true;
      const id = this.rayHit.box?.barrierId;
      if (id === undefined || !this.barriers.reachThrough(id)) return false;
      ox += ux * (t + 0.3);
      oz += uz * (t + 0.3);
      left -= t + 0.3;
      if (left <= 0) return true;
    }
    return false;
  }

  private fire(weapon: ItemDef) {
    const stack = this.equippedStack();
    if (!stack || this.attackCooldown > 0 || this.reloadTimer > 0) return;
    if (!stack.loaded) {
      this.audio.dryFire();
      this.attackCooldown = 0.25;
      if (this.ammoCount(weapon.ammo!) > 0) this.startReload();
      else this.message("Out of ammo.", "warn");
      return;
    }
    stack.loaded--;
    this.attackCooldown = weapon.attackInterval ?? 0.25;
    this.audio.gunshot();
    const p = this.player;
    this.noises.push({ pos: p.pos.clone(), radius: weapon.noise ?? 60, ttl: 0.5 });

    const hand = new THREE.Vector3();
    p.model.hand.getWorldPosition(hand);
    this.muzzle.position.copy(hand);
    this.muzzle.intensity = 40;
    this.muzzleTimer = 0.05;

    // Shoot from the camera through the crosshair. Spread depends on how far
    // you've aimed in, how fast you're moving, and the state of your body.
    const spread = shotSpread(p.aimProgress, p.speed, aimSway(p.body));
    const dir = new THREE.Vector3();
    this.camera.updateMatrixWorld();
    this.camera.getWorldDirection(dir);
    // Uniform within a cone rather than a square.
    const ang = Math.random() * Math.PI * 2;
    const rad = Math.sqrt(Math.random()) * spread;
    const up = new THREE.Vector3(0, 1, 0);
    const side = new THREE.Vector3().crossVectors(dir, up).normalize();
    const upv = new THREE.Vector3().crossVectors(side, dir).normalize();
    dir.addScaledVector(side, Math.cos(ang) * rad).addScaledVector(upv, Math.sin(ang) * rad).normalize();
    p.addRecoil();
    p.addShake(0.06);
    const origin = this.camera.position.clone();
    // Ignore anything between the camera and the player.
    const chest = p.pos.clone().setY(p.pos.y + 1.3);
    const tMin = Math.max(0, chest.clone().sub(origin).dot(dir) - 0.3);
    const wallT = this.colliders.raycast(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, 150, false, undefined, true);

    let hitZombie: Zombie | null = null;
    let hitT = wallT;
    let part: "head" | "body" | "legs" = "body";
    const tmp = new THREE.Vector3();
    for (const z of this.zombies) {
      if (!z.alive || z.pos.distanceTo(p.pos) > 120) continue;
      // A downed zombie lies flat; test a low body instead.
      // Hit volumes follow the body's proportions, scaled by this zombie's height.
      const k = z.model.root.scale.y;
      const parts: [number, number, "head" | "body" | "legs"][] = z.isDown
        ? [[0.2, 0.35, "body"]]
        : [
            [1.62, 0.12, "head"],
            [1.3, 0.2, "body"],
            [1.05, 0.2, "body"],
            [0.65, 0.17, "legs"],
            [0.3, 0.14, "legs"],
          ];
      for (const [h, r, which] of parts) {
        tmp.set(z.pos.x, z.pos.y + h * k, z.pos.z);
        const t = raySphere(origin, dir, tmp, r * k);
        if (t !== null && t > tMin && t < hitT) {
          hitT = t;
          hitZombie = z;
          part = which;
        }
      }
    }
    this.shatterAlong(origin, dir, hitT);
    if (hitZombie) {
      const base = weapon.damage ?? 40;
      const dmg = part === "head" ? FIREARM.headshotDamage : part === "legs" ? base * FIREARM.legDamageFactor : base;
      this.audio.hit();
      if (hitZombie.hit(dmg, p.pos, 1.5)) {
        this.onZombieKilled();
        if (part === "head") this.message("Headshot.", "good");
      }
    }
  }

  /** A bullet breaks the first intact pane it passes through before it hits. */
  private shatterAlong(o: THREE.Vector3, d: THREE.Vector3, maxT: number) {
    let start = 0;
    for (let i = 0; i < 4 && start < maxT; i++) {
      const t = this.colliders.raycast(o.x + d.x * start, o.y + d.y * start, o.z + d.z * start, d.x, d.y, d.z, maxT - start, false, this.rayHit);
      const box = this.rayHit.box;
      if (!box?.glass || box.barrierId === undefined || start + t >= maxT) return;
      if (this.barriers.barrier(box.barrierId).glass === "intact") {
        this.smashWindow(box.barrierId);
        return;
      }
      start += t + 0.3;
    }
  }

  private ammoCount(ammoId: string) {
    return this.inventory.filter((s) => s.id === ammoId).reduce((n, s) => n + s.count, 0);
  }

  private startReload() {
    const stack = this.equippedStack();
    if (!stack || this.reloadTimer > 0) return;
    const def = ITEMS[stack.id];
    if (def.category !== "firearm") return;
    if ((stack.loaded ?? 0) >= (def.magSize ?? 0)) return;
    if (this.ammoCount(def.ammo!) === 0) {
      this.message(`No ${ITEMS[def.ammo!].name} to load.`, "warn");
      return;
    }
    this.reloadTimer = RELOAD_SECONDS;
    this.audio.reload();
  }

  private finishReload() {
    const stack = this.equippedStack();
    if (!stack) return;
    const def = ITEMS[stack.id];
    let need = (def.magSize ?? 0) - (stack.loaded ?? 0);
    for (const ammo of this.inventory.filter((s) => s.id === def.ammo)) {
      const take = Math.min(need, ammo.count);
      ammo.count -= take;
      need -= take;
      stack.loaded = (stack.loaded ?? 0) + take;
      if (need <= 0) break;
    }
    this.inventory = this.inventory.filter((s) => s.count > 0);
  }

  private onZombieKilled() {
    this.kills++;
  }

  // -------------------------------------------------------------- zombies

  private spawnZombie(pos: THREE.Vector3) {
    pos.y = this.terrain.height(pos.x, pos.z);
    const z = new Zombie(pos, Math.floor(this.rng() * 4294967296));
    this.zombies.push(z);
    this.scene.add(z.model.root);
    return z;
  }

  private zombieContext(dt: number) {
    const p = this.player;
    const daylight = this.env.daylight(this.minutes % 1440);
    return {
      dt,
      playerPos: p.pos,
      playerVel: p.vel,
      playerAlive: this.status === "playing",
      playerMoving: p.speed > 0.5,
      playerSprinting: p.sprinting,
      playerCrouching: p.crouching,
      visibility: visibilityRange(daylight, this.flashlightOn, p.crouching),
      footstepRadius: p.footstepRadius,
      noises: this.noises,
      colliders: this.colliders,
      terrain: this.terrain,
      canAttack: (z: Zombie) => this.attackers.has(z),
      onAttack: (z: Zombie) => this.onZombieAttack(z),
      findPath: (from: THREE.Vector3, to: THREE.Vector3) => {
        if (this.pathBudget <= 0) return undefined;
        this.pathBudget--;
        // A target inside a building it isn't in: make for the best way in. Searching the
        // whole block instead is slow (crossing costs are invisible to the A* heuristic).
        const inside = this.buildingObj(to.x, to.z, 0.45);
        if (inside && inside !== this.buildingObj(from.x, from.z)) {
          const siege = this.siegePath(from, inside);
          if (siege) return siege;
        }
        return findPath(this.nav, from.x, from.z, to.x, to.z, 9000) ?? (inside ? this.siegePath(from, inside) : null);
      },
      barrierContact: (z: Zombie, id: number) => this.barriers.access(id, this.barriers.sideOf(id, z.pos)),
      barrierPoint: (id: number, from: THREE.Vector3) => this.barriers.closestPoint(id, from),
      barrierBetween: (z: Zombie) => {
        const dx = p.pos.x - z.pos.x;
        const dz = p.pos.z - z.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 1e-3) return null;
        const t = this.colliders.raycast(z.pos.x, z.pos.y + 1.15, z.pos.z, dx / d, 0, dz / d, d, false, this.rayHit);
        const id = this.rayHit.box?.barrierId;
        return t < d - 0.05 && id !== undefined ? { id, dist: t } : null;
      },
      canBreach: (z: Zombie) => this.breachers.has(z),
      playerSameSide: (z: Zombie, id: number) => this.barriers.sideOf(id, z.pos) === this.barriers.sideOf(id, p.pos),
      onBarrierHit: (z: Zombie, id: number) => this.zombieHitsBarrier(z, id),
      onBarrierPush: (z: Zombie, id: number) => {
        const side = this.barriers.sideOf(id, z.pos);
        if (!this.barriers.push(id, side)) return;
        // A body shoving a door open is about as loud as one slamming.
        const at = this.barriers.closestPoint(id, z.pos);
        this.noises.push({ pos: at.clone(), radius: BARRIER_NOISE.doorClose, ttl: 0.4 });
        const [d, pan] = this.hear(at);
        this.audio.doorCreak(d, pan);
      },
      clamberPoints: (z: Zombie, id: number) => {
        const t = this.barriers.traversal(id, this.barriers.sideOf(id, z.pos), z.pos, true);
        if (!t) return null;
        const at = this.barriers.centre(id);
        this.noises.push({ pos: at.clone(), radius: BARRIER_NOISE.climb, ttl: 0.4 });
        const [d, pan] = this.hear(at);
        this.audio.climb(d, pan);
        return t;
      },
      onNotice: (z: Zombie) => {
        // A groan as it commits: your cue that you've been seen.
        const to = z.pos.clone().sub(p.pos);
        const right = new THREE.Vector3(-Math.cos(p.yaw), 0, Math.sin(p.yaw));
        this.audio.groan(to.length(), to.normalize().dot(right), true);
      },
    };
  }

  /** Hand out attack slots: the closest few hunting zombies, keeping ones already mid-swing. */
  private assignAttackers() {
    const p = this.player;
    const reach = ZOMBIE.attackRange + 0.7;
    const close = this.zombies
      .filter((z) => z.hunting && !z.clamber && z.pos.distanceTo(p.pos) < reach && this.clearReach(z.pos, p.pos))
      .sort((a, b) => Number(b.attacking) - Number(a.attacking) || a.pos.distanceToSquared(p.pos) - b.pos.distanceToSquared(p.pos));
    this.attackers = new Set(close.slice(0, ZOMBIE.maxAttackers));
  }

  /** The closest few zombies at each barrier get to swing at it; the rest crowd behind. */
  private assignBreachers() {
    this.breachers.clear();
    const groups = new Map<number, Zombie[]>();
    for (const z of this.zombies) {
      if (!z.alive || z.breach === null) continue;
      let list = groups.get(z.breach);
      if (!list) groups.set(z.breach, (list = []));
      list.push(z);
    }
    for (const [id, list] of groups) {
      const c = this.barriers.centre(id);
      list.sort((a, b) => a.pos.distanceToSquared(c) - b.pos.distanceToSquared(c));
      for (const z of list.slice(0, attackSlots(this.barriers.barrier(id)))) this.breachers.add(z);
    }
  }

  /** A zombie's blow on a door, window or board. */
  private zombieHitsBarrier(z: Zombie, id: number) {
    const side = this.barriers.sideOf(id, z.pos);
    const mat = struckMaterial(this.barriers.barrier(id), side) ?? "wood";
    const r = this.barriers.hit(id, BARRIER.zombieDamage, side);
    this.barrierEffects(id, r, mat, z.pos, side, true);
    const p = this.player;
    if (p.body.asleep && this.barriers.centre(id).distanceTo(p.pos) < BARRIER.wakeRadius) {
      this.wake(`Something is pounding on the ${this.barriers.barrier(id).kind}.`);
    }
  }

  /**
   * Sound, noise and messages for a blow on a barrier. Zombie blows lure others
   * to just past the barrier, so newcomers path through it and join in.
   */
  private barrierEffects(id: number, r: HitResult, mat: HitMaterial, source: THREE.Vector3, side: Side, byZombie: boolean) {
    if (r.layer === "none") return;
    const b = this.barriers.barrier(id);
    const at = this.barriers.closestPoint(id, source).setY(1.1);
    const [d, pan] = this.hear(at);
    if (r.burst) this.audio.doorBurst(d, pan);
    else if (r.glassBroke) this.audio.glassBreak(d, pan);
    else if (r.boardTorn) this.audio.boardTear(d, pan);
    else if (r.opened) this.audio.doorCreak(d, pan);
    else this.audio.doorBang(d, pan, mat);
    this.noises.push({
      pos: byZombie ? at.clone().setY(0) : this.barriers.approach(id, side, 0.6),
      radius: r.noise,
      ttl: 0.5,
      ...(byZombie ? { lure: this.barriers.approach(id, (-side) as Side, 1.0), barrierId: id } : {}),
    });
    if (d < 25) {
      const what = b.kind === "door" ? "door" : "window";
      if (r.burst) this.message(byZombie ? `The ${what} bursts open!` : "The door gives way.", byZombie ? "danger" : "good");
      else if (r.boardTorn) this.message(`A board splinters off the ${what}.`, byZombie ? "warn" : "info");
      else if (r.glassBroke && byZombie) this.message("Glass shatters nearby.", "warn");
    }
  }

  /**
   * The way into a building from outside: to the opening that's closest once
   * its crossing cost is counted (an open door beats a boarded window next to
   * it), then through it.
   */
  private siegePath(from: THREE.Vector3, b: Building): [number, number][] | null {
    let best = -1;
    let bestD = Infinity;
    for (const s of this.barriers.specs) {
      if (s.building !== b.address || s.role === "interior" || s.role === "armory" || !this.barriers.crossable(s.id, 1)) continue;
      const d = Math.hypot(s.cx + s.nx * 0.8 - from.x, s.cz + s.nz * 0.8 - from.z) + navCost(this.barriers.barrier(s.id)) * this.nav.cell;
      if (d < bestD) {
        bestD = d;
        best = s.id;
      }
    }
    if (best < 0) return null;
    const a = this.barriers.approach(best, 1, 0.8);
    const path = findPath(this.nav, from.x, from.z, a.x, a.z, 9000);
    if (!path) return null;
    const inside = this.barriers.approach(best, -1, 0.6);
    return [...path, [inside.x, inside.z]];
  }

  private updateZombies(dt: number) {
    const p = this.player;
    this.assignAttackers();
    this.assignBreachers();
    this.pathBudget = 2;
    const ctx = this.zombieContext(dt);
    const near: Zombie[] = [];
    for (const z of this.zombies) {
      const d = z.pos.distanceTo(p.pos);
      z.model.root.visible = d < 115;
      z.model.setShadows(d < 40);
      if (d > ZOMBIE_ACTIVE_RANGE && z.alive) continue;
      const wasHunting = z.hunting;
      z.update(ctx);
      if (z.alive && d < 30 && !z.clamber) near.push(z);
      // A zombie that spots you draws its neighbours in.
      if (!wasHunting && z.hunting) {
        for (const other of this.zombies) {
          if (other !== z && other.alive && other.pos.distanceTo(z.pos) < 10) other.alert(p.pos);
        }
      }
      if (z.alive && z.wantsToGroan(dt) && d < 35) {
        const to = z.pos.clone().sub(p.pos);
        const right = new THREE.Vector3(-Math.cos(p.yaw), 0, Math.sin(p.yaw));
        this.audio.groan(d, to.normalize().dot(right), z.hunting);
      }
    }

    // Keep zombies from overlapping each other and the player.
    for (let i = 0; i < near.length; i++) {
      const a = near[i];
      for (let j = i + 1; j < near.length; j++) separate(a.pos, near[j].pos, a.radius + near[j].radius, 0.5);
      separate(p.pos, a.pos, a.radius + 0.35, 0.15);
    }

    // Corpses fade away after a while.
    const corpses = this.zombies.filter((z) => !z.alive);
    for (const z of corpses) {
      if (z.deadTime > 240 || (corpses.length > 40 && z.deadTime > 20)) {
        this.scene.remove(z.model.root);
        z.model.dispose();
        this.zombies.splice(this.zombies.indexOf(z), 1);
      }
    }

    // Slowly repopulate, out of sight.
    this.respawnTimer -= dt;
    if (this.respawnTimer <= 0) {
      this.respawnTimer = 25;
      const day = Math.floor(this.minutes / 1440) + 1;
      const cap = Math.min(140, 85 + day * 10);
      const alive = this.zombies.filter((z) => z.alive).length;
      for (let tries = 0; tries < 6 && alive < cap; tries++) {
        const sp = pick(this.rng, this.town.spawnPoints);
        if (sp.distanceTo(p.pos) < 60) continue;
        // Your fortress doesn't fill up while you're away: nothing appears inside a sealed building.
        const inside = this.buildingObj(sp.x, sp.z);
        if (inside && this.barriers.sealed(inside.address)) continue;
        if (this.colliders.lineOfSight(sp.x, 1.6, sp.z, p.pos.x, p.pos.y + 1.6, p.pos.z) && sp.distanceTo(p.pos) < 100) continue;
        this.spawnZombie(sp.clone().add(new THREE.Vector3(range(this.rng, -2, 2), 0, range(this.rng, -2, 2))));
        break;
      }
    }
  }

  private onZombieAttack(z: Zombie) {
    if (this.status !== "playing") return;
    const p = this.player;
    const w = zombieHit(p.body, Math.random);
    if (this.action) this.cancelAction("Interrupted!");
    this.damageFlash = 1;
    this.audio.hurt();
    const where = BODY_PART_NAMES[w.part].toLowerCase();
    if (w.kind === "bite") this.message(`Bitten on the ${where}.`, "danger");
    else if (w.kind === "laceration") this.message(`A deep gash on your ${where}. You're bleeding.`, "danger");
    else this.message(`Scratched on the ${where}.`, "warn");
    // Being grabbed slows you down.
    p.slow(0.3);
    p.addShake(0.5);
    void z;
  }

  private trySleep() {
    const p = this.player;
    if (this.zombies.some((z) => z.hunting && z.pos.distanceTo(p.pos) < 40)) {
      this.message("You can't sleep with them this close.", "warn");
      return;
    }
    if (p.body.fatigue < 30) {
      this.message("You're not tired enough to sleep.", "info");
      return;
    }
    if (isBleeding(p.body)) {
      this.message("You need to stop the bleeding first.", "warn");
      return;
    }
    p.body.asleep = true;
    p.crouching = true;
    void this.saveGame("auto", true);
    this.message(this.sheltered ? "You lie down and close your eyes." : "You curl up in the open. Not the safest place.", "info");
  }

  private wake(reason: string) {
    this.player.body.asleep = false;
    this.player.crouching = false;
    this.message(reason, reason.startsWith("Something") ? "danger" : "info");
  }

  private die(cause: string) {
    if (this.status === "dead") return;
    this.status = "dead";
    // Project Zomboid rules: the infected come back.
    this.turned = cause === "The infection took you";
    if (this.turned) {
      const corpse = this.spawnZombie(this.player.pos.clone());
      corpse.yaw = this.player.bodyYaw;
      this.player.model.root.visible = false;
    }
    this.causeOfDeath = cause;
    // Permadeath: the run's autosave dies with you. Your own save slots are kept.
    void this.deleteSave("auto");
    this.action = null;
    this.keypadId = null;
    this.inventoryOpen = false;
    this.container = null;
    this.releaseLock();
    this.emitHud();
  }

  // -------------------------------------------------------------- looting

  private distanceToContainer(c: { x: number; y: number; z: number; hx: number; hz: number }) {
    const p = this.player.pos;
    const dx = Math.max(0, Math.abs(p.x - c.x) - c.hx);
    const dz = Math.max(0, Math.abs(p.z - c.z) - c.hz);
    return Math.abs(p.y + 1 - c.y) > 2.2 ? Infinity : Math.hypot(dx, dz);
  }

  /** No wall or closed door between you and it (no looting through walls). */
  private inReach(c: { x: number; y: number; z: number }) {
    const p = this.player.pos;
    const ox = p.x;
    const oy = p.y + 1.2;
    const oz = p.z;
    const dx = c.x - ox;
    const dy = Math.max(c.y, 0.3) - oy;
    const dz = c.z - oz;
    const total = Math.hypot(dx, dy, dz);
    if (total < 0.3) return true;
    const [ux, uy, uz] = [dx / total, dy / total, dz / total];
    // Walls and closed doors stop a hand, and so do glass and boards; furniture (and the thing itself) doesn't.
    let start = 0;
    const end = total - 0.25;
    for (let i = 0; i < 6 && start < end; i++) {
      const t = this.colliders.raycast(ox + ux * start, oy + uy * start, oz + uz * start, ux, uy, uz, end - start, false, this.rayHit);
      const box = this.rayHit.box;
      if (!box || start + t >= end) return true;
      if (box.occludes) return false;
      if (box.barrierId !== undefined && !this.barriers.reachThrough(box.barrierId)) return false;
      start += t + 0.05;
    }
    return true;
  }

  private nearestContainer(): LootContainer | null {
    const p = this.player;
    const fwd = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw));
    let best: LootContainer | null = null;
    let bestScore = Infinity;
    for (const c of this.town.containers) {
      const d = this.distanceToContainer(c);
      if (d > INTERACT_RANGE || !this.inReach(c)) continue;
      const to = new THREE.Vector3(c.x - p.pos.x, 0, c.z - p.pos.z).normalize();
      // Prefer what you're looking at.
      const score = d - to.dot(fwd) * 0.8;
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }
    return best;
  }

  /** The container or computer you'd interact with by pressing E. */
  private nearestInteractable():
    | { type: "container"; container: LootContainer }
    | { type: "computer"; computer: ComputerSpot }
    | { type: "generator"; generator: GeneratorObject }
    | { type: "barrier"; id: number; side: Side }
    | { type: "keypad"; id: number }
    | null {
    for (const g of this.elec.generators) {
      if (this.distanceToContainer(g) < INTERACT_RANGE) return { type: "generator", generator: g };
    }
    const p = this.player;
    const container = this.nearestContainer();
    let computer: ComputerSpot | null = null;
    let best = INTERACT_RANGE;
    for (const c of this.town.computers) {
      const d = this.distanceToContainer(c);
      if (d < best && this.inReach(c)) {
        best = d;
        computer = c;
      }
    }
    // Computers sit on desks next to containers; prefer the computer when it's as close.
    const thing =
      computer && (!container || best <= this.distanceToContainer(container) + 0.3)
        ? ({ type: "computer", computer } as const)
        : container
          ? ({ type: "container", container } as const)
          : null;
    // What the crosshair rests on wins (a window above a kitchen counter, the counter below it).
    const aim = this.aimed();
    if (aim?.barrier !== undefined) {
      const t = this.barriers.target(aim.barrier, p.pos, INTERACT_RANGE);
      if (t) return { type: "barrier", id: t.id, side: t.side };
    }
    if (aim?.container && this.distanceToContainer(aim.container) <= INTERACT_RANGE && this.inReach(aim.container)) {
      return { type: "container", container: aim.container };
    }
    // Otherwise whatever you face most squarely: distance minus how directly you face it.
    const fwd = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw));
    let choice: ReturnType<Game["nearestInteractable"]> = thing;
    let bestScore = Infinity;
    if (thing) {
      const c = thing.type === "computer" ? thing.computer : thing.container;
      const to = new THREE.Vector3(c.x - p.pos.x, 0, c.z - p.pos.z).normalize();
      bestScore = this.distanceToContainer(c) - to.dot(fwd) * 0.8;
    }
    const bt = this.barriers.nearest(p.pos, p.yaw, INTERACT_RANGE);
    if (bt) {
      const bp = this.barriers.closestPoint(bt.id, p.pos);
      const tb = new THREE.Vector3(bp.x - p.pos.x, 0, bp.z - p.pos.z);
      const score = bt.dist - (tb.lengthSq() > 1e-6 ? tb.normalize().dot(fwd) : 1) * 0.8;
      if (score < bestScore) {
        choice = { type: "barrier", id: bt.id, side: bt.side };
        bestScore = score;
      }
    }
    const kp = this.barriers.nearestKeypad(p.pos, p.yaw, 1.3);
    if (kp && kp.score < bestScore) choice = { type: "keypad", id: kp.id };
    return choice;
  }

  /** What the crosshair rests on within reach: a door or window, or a container. */
  private aimed(): { barrier?: number; container?: LootContainer } | null {
    const p = this.player;
    this.camera.updateMatrixWorld();
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const o = this.camera.position;
    // Start level with the player, not at the camera behind their shoulder.
    const tMin = Math.max(0, (p.pos.x - o.x) * dir.x + (p.pos.y + 1.3 - o.y) * dir.y + (p.pos.z - o.z) * dir.z - 0.3);
    const sx = o.x + dir.x * tMin;
    const sy = o.y + dir.y * tMin;
    const sz = o.z + dir.z * tMin;
    const t = this.colliders.raycast(sx, sy, sz, dir.x, dir.y, dir.z, INTERACT_RANGE + 1.5, false, this.rayHit);
    const box = this.rayHit.box;
    if (!box) return null;
    const hx = sx + dir.x * t;
    const hy = sy + dir.y * t;
    const hz = sz + dir.z * t;
    if (Math.hypot(hx - p.pos.x, hz - p.pos.z) > INTERACT_RANGE + 0.3) return null;
    if (box.barrierId !== undefined) return { barrier: box.barrierId };
    // Walls block sight; containers never do, so a ray that stopped on an occluder isn't on a container.
    if (box.occludes) return null;
    const c = this.town.containers.find((k) => Math.abs(hx - k.x) <= k.hx + 0.05 && Math.abs(hz - k.z) <= k.hz + 0.05 && hy <= k.y + 1.3);
    return c ? { container: c } : null;
  }

  /** What E, Q and H would do to a door or window right now. */
  private barrierPrompt(id: number, side: Side): { main: string; alts: { key: string; label: string }[] } {
    const b = this.barriers.barrier(id);
    const alts: { key: string; label: string }[] = [];
    let main: string;
    const boarded = b.boards.length > 0 && (b.kind === "window" || !b.open || b.broken);
    if (b.kind === "door") {
      if (boarded) main = "Boarded door";
      else if (b.broken) main = "Smashed door";
      else if (b.open) main = "Close door";
      else if (side === 1 && (b.bolted || effectiveLocked(b))) main = "Try the door (locked)";
      else main = side === -1 && b.bolted ? "Unbolt and open" : "Open door";
      if ((b.build === "solid" || b.build === "glass") && !b.open && !b.broken && side === -1) {
        alts.push({ key: "Q", label: b.bolted ? "Draw deadbolt" : "Throw deadbolt" });
      }
    } else {
      main = boarded ? "Boarded window" : b.glass === "intact" ? "Break the glass" : "Climb through";
      if (b.glass === "broken" && !(b.boards.length && b.boardSide === side)) alts.push({ key: "Q", label: "Clear shards" });
    }
    if (this.countItem("hammer")) {
      if (!canBoard(b, side)) {
        const c = boardCost(b);
        const enough = this.countItem("plank") >= c.planks && this.countItem("nails") >= c.nails;
        alts.push({
          key: "H",
          label: `Board up: ${c.planks} plank${c.planks > 1 ? "s" : ""}, ${c.nails} nails (${b.boards.length}/${BARRICADE.maxBoards[b.kind]})${enough ? "" : " · need more"}`,
        });
      }
      if (b.boards.length && b.boardSide === side) alts.push({ key: "Shift+H", label: "Pry off a board" });
    }
    return { main, alts };
  }

  private barrierView(id: number): NonNullable<HudState["barrier"]> {
    const b = this.barriers.barrier(id);
    let label: string;
    if (b.kind === "door") {
      const name = { hollow: "Interior door", solid: "Wooden door", glass: "Glass door", steel: "Steel door" }[b.build as "hollow"];
      const state = b.broken
        ? "smashed"
        : b.open
          ? "open"
          : b.electronic
            ? effectiveLocked(b)
              ? b.electronic.mode === "maglock"
                ? "maglocked"
                : "locked"
              : "unlocked"
            : b.bolted
              ? "deadbolted"
              : "latched";
      label = `${name} · ${state}`;
    } else {
      label = `${b.build === "display" ? "Shop window" : "Window"} · ${b.glass === "intact" ? "glass intact" : b.glass === "broken" ? "broken glass" : "empty frame"}`;
    }
    const holds = b.boards.length > 0 || (b.kind === "window" ? b.glass === "intact" : !b.open && !b.broken);
    return { label, boards: b.boards.length, maxBoards: BARRICADE.maxBoards[b.kind], integrity: holds ? integrityLabel(b) : null };
  }

  private openContainer(c: LootContainer) {
    if (c.items === null) c.items = [...rollLoot(c.table, Math.random), ...(c.preset ?? [])];
    this.container = c;
    this.inventoryOpen = false;
    this.releaseLock();
    this.audio.pickup();
    this.emitHud();
  }

  private cleanupPile(c: LootContainer) {
    if (c.table !== "ground" || (c.items && c.items.length > 0)) return;
    const mesh = this.groundPiles.get(c.id);
    if (mesh) this.scene.remove(mesh);
    this.groundPiles.delete(c.id);
    this.town.containers.splice(this.town.containers.indexOf(c), 1);
    this.container = null;
    this.requestLock(false);
  }

  private addToInventory(stack: ItemStack) {
    const def = ITEMS[stack.id];
    if (def.stackable) {
      const existing = this.inventory.find((s) => s.id === stack.id);
      if (existing) {
        existing.count += stack.count;
        return;
      }
    }
    this.inventory.push(stack);
  }

  private consume(stack: ItemStack) {
    stack.count--;
    if (stack.count <= 0) this.inventory = this.inventory.filter((s) => s !== stack);
  }

  private carryWeight() {
    return this.inventory.reduce((w, s) => w + stackWeight(s), 0);
  }

  private hotbar() {
    return this.inventory.filter((s) => ["melee", "firearm"].includes(ITEMS[s.id].category)).slice(0, 5);
  }

  // ----------------------------------------------------------------- misc

  private updateFlashlight(daylight: number) {
    const p = this.player;
    this.flashlight.intensity = this.flashlightOn ? 60 + (1 - daylight) * 90 : 0;
    const look = new THREE.Vector3();
    this.camera.getWorldDirection(look);
    this.flashlight.position.set(p.pos.x, p.pos.y + (p.crouching ? 1.1 : 1.45), p.pos.z).addScaledVector(look, 0.3);
    this.flashlight.target.position.copy(this.flashlight.position).addScaledVector(look, 10);
  }

  private generatorView(obj: GeneratorObject) {
    const g = obj.gen;
    const circuit = g.buildingId ? this.elec.world.circuits[g.buildingId] : undefined;
    const st = g.buildingId ? this.elec.status[g.buildingId] : undefined;
    const load = circuit && st?.source === "generator" ? st.demandW : 0;
    return {
      name: g.name,
      running: g.running,
      tripped: g.tripped,
      fuelL: g.fuelL,
      tankL: g.tankL,
      ratedW: g.ratedW,
      loadW: load,
      connectedTo: g.buildingId,
      portable: g.portable,
      autoStart: g.autoStart,
      inReach: g.portable ? this.elec.buildingInReach(obj.x, obj.z)?.address ?? null : null,
      canRefuel: !!this.fuelCan() && g.fuelL < g.tankL - 0.05,
      fuelCarried: this.inventory.filter((s) => s.id === "jerry_can").reduce((n, s) => n + (s.fuel ?? 0), 0),
    };
  }

  private message(text: string, tone: HudMessage["tone"]) {
    const m = { id: this.messageId++, text, tone, until: performance.now() + 6000 };
    this.messages = [...this.messages.slice(-4), m];
    this.emitHud();
  }

  private emitHud() {
    const p = this.player;
    const weapon = this.status === "loading" ? FISTS : this.weaponDef();
    const stack = this.equippedStack();
    const target = this.status === "playing" && !this.uiOpen() && this.terrain ? this.nearestInteractable() : null;
    const comp = this.computerSpot;
    const containerItems = this.container?.items ?? null;
    this.onHud({
      status: this.status,
      locked: this.locked,
      health: Math.max(0, p.body.health),
      blood: bloodPercent(p.body),
      hunger: p.body.hunger,
      thirst: p.body.thirst,
      stamina: p.body.stamina,
      bleeding: isBleeding(p.body),
      bodyTemp: p.body.bodyTemp,
      airTemp: this.airTemp,
      sheltered: this.sheltered,
      fatigue: p.body.fatigue,
      pain: pain(p.body),
      asleep: p.body.asleep,
      moodles: moodles(p.body),
      wounds: p.body.wounds.map((w) => ({
        id: w.id,
        part: w.part,
        partName: BODY_PART_NAMES[w.part],
        kind: w.kind,
        severity: w.severity,
        bleeding: !w.bandaged && w.bleedRate > 0.05,
        bandaged: w.bandaged,
      })),
      canBandage: this.inventory.some((s) => ITEMS[s.id].medical === "bandage" || ITEMS[s.id].medical === "firstAid"),
      turned: this.turned,
      crouching: p.crouching,
      aiming: p.aiming,
      noise: Math.min(1, p.footstepRadius / 15),
      hunted: this.zombies.some((z) => z.hunting),
      day: Math.floor(this.minutes / 1440) + 1,
      timeOfDay: this.minutes % 1440,
      equippedUid: this.equippedUid,
      equipped: {
        name: weapon.name,
        loaded: stack?.loaded,
        magSize: weapon.magSize,
        reserve: weapon.ammo ? this.ammoCount(weapon.ammo) : undefined,
        reloading: this.reloadTimer > 0,
      },
      hotbar: this.hotbar().map((s, i) => ({ slot: i + 1, name: ITEMS[s.id].name, active: s.uid === this.equippedUid })),
      prompt: !target
        ? null
        : target.type === "generator"
          ? `Inspect ${target.generator.gen.portable ? "generator" : "standby generator"}`
          : target.type === "computer"
            ? `Use ${target.computer.kind === "laptop" ? "laptop" : "computer"}`
            : target.type === "barrier"
              ? this.barrierPrompt(target.id, target.side).main
              : target.type === "keypad"
                ? "Use keypad"
                : `Search ${target.container.name}`,
      altPrompts: target?.type === "barrier" ? this.barrierPrompt(target.id, target.side).alts : [],
      barrier: target?.type === "barrier" ? this.barrierView(target.id) : null,
      action: this.action ? { label: this.action.label, progress: Math.min(1, this.action.t / this.action.dur) } : null,
      keypad:
        this.keypadId !== null
          ? {
              label: this.barriers.barrier(this.keypadId).electronic?.name === "armory" ? "ARMORY" : (this.barriers.barrier(this.keypadId).electronic?.name ?? "").toUpperCase(),
              entered: this.keypadEntry.length,
              status: this.keypadStatus,
              lockout: Math.ceil(this.barriers.barrier(this.keypadId).electronic?.lockoutLeft ?? 0),
            }
          : null,
      computer: comp
        ? {
            hostname: comp.state.def.hostname,
            kind: comp.kind,
            lines: [...comp.state.screen],
            prompt: shellPrompt(comp.state),
            battery: comp.state.battery,
            password: isSecretInput(comp.state),
          }
        : null,
      reading: this.reading,
      generator: this.generatorPanel ? this.generatorView(this.generatorPanel) : null,
      power: (() => {
        if (!this.town || !this.elec) return null;
        const b = this.buildingObj(this.player.pos.x, this.player.pos.z);
        const st = this.elec?.statusOf(b);
        return b && st ? st.source : null;
      })(),
      containerFuel: this.container?.table === "car" ? this.container.fuel ?? 0 : null,
      cctv:
        this.cctvOpen && this.computerSpot
          ? { nvr: this.cctv.nvrName, channels: this.cctv.channels.map((ch) => ({ channel: ch.channel, label: ch.label, online: ch.online })) }
          : null,
      location: this.location,
      gridOn: this.terrain ? this.gridOn() : true,
      townName: `${TOWN}, ${COUNTY}`,
      quality: this.quality,
      inventory: this.inventory.map((s) => ({ ...s })),
      carryWeight: this.carryWeight(),
      maxWeight: MAX_WEIGHT,
      inventoryOpen: this.inventoryOpen,
      container:
        this.container && containerItems
          ? { id: this.container.id, name: this.container.name, items: containerItems.map((s) => ({ ...s })) }
          : null,
      messages: this.messages,
      kills: this.kills,
      flashlight: this.flashlightOn,
      damageFlash: this.damageFlash,
      crosshair: weapon.category === "firearm" || p.aiming,
      freeMouse: this.freeMouse,
      survivedMinutes: this.minutes - START_MINUTES,
      causeOfDeath: this.causeOfDeath,
      saves: this.saveList.map((s) => ({ slot: s.slot, ...s.meta })),
      savesPersistent: this.saves.persistent,
    });
  }
}


const QUALITY_KEY = "zombie-survival:quality";

function loadQuality(): Quality | null {
  try {
    const v = localStorage.getItem(QUALITY_KEY);
    return v === "high" || v === "low" ? v : null;
  } catch {
    return null;
  }
}

type KeypadStatus = "idle" | "granted" | "denied" | "lockout" | "dark";

/** Work that takes time: you stand still (or keep a key held) until it's done. */
interface TimedAction {
  label: string;
  t: number;
  dur: number;
  /** Letting go of this key stops the work. */
  hold?: string;
  /** Something that happens every `every` seconds while working (a hammer blow). */
  every?: number;
  beat?: () => void;
  nextBeat: number;
  /** Movement keys already down when it started. */
  heldAtStart: string[];
  done: () => void;
  /** Still holding the key when it's done: start the next one. */
  repeat?: () => void;
}

const MOVE_KEYS = ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"];

/** Input that only passes mouse look through (busy hands). */
const lookOnly = (input: Input) =>
  ({ mouseDX: input.mouseDX, mouseDY: input.mouseDY, rightDown: false, isDown: () => false, wasPressed: () => false }) as unknown as Input;

/** Input stand-in used while menus are open: the player stands still. */
const NO_INPUT = {
  mouseDX: 0,
  mouseDY: 0,
  rightDown: false,
  isDown: () => false,
  wasPressed: () => false,
} as unknown as Input;

function separate(a: THREE.Vector3, b: THREE.Vector3, min: number, aShare: number) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  const d = Math.hypot(dx, dz);
  if (d >= min || d < 1e-5) return;
  const push = min - d;
  a.x += (dx / d) * push * aShare;
  a.z += (dz / d) * push * aShare;
  b.x -= (dx / d) * push * (1 - aShare);
  b.z -= (dz / d) * push * (1 - aShare);
}

function raySphere(o: THREE.Vector3, d: THREE.Vector3, c: THREE.Vector3, r: number): number | null {
  const ox = o.x - c.x;
  const oy = o.y - c.y;
  const oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : null;
}
