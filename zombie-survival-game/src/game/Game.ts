import * as THREE from "three";
import { AudioSystem } from "./audio";
import { Player } from "./entities/player";
import { makeHeldItem } from "./entities/humanoid";
import { Zombie, type NoiseEvent } from "./entities/zombie";
import { Input } from "./input";
import { FISTS, ITEMS, makeStack, rollLoot, stackWeight, type ItemDef, type ItemStack } from "../sim/items";
import { mulberry32, pick, range } from "../sim/rng";
import {
  BODY_PART_NAMES,
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
import { MELEE, FIREARM, ZOMBIE, meleeDamage, shotSpread, visibilityRange } from "../sim/tuning";
import { boot, complete, createComputerState, isSecretInput, prompt as shellPrompt, submit } from "../sim/computer";
import { COUNTY, TOWN, gameDate } from "../sim/computerContent";
import type { GameStatus, HudMessage, HudState } from "./types";
import { ColliderWorld } from "./world/colliders";
import { Environment } from "./world/environment";
import { PostFX, type Quality } from "./render/postfx";
import { SkyDome } from "./render/sky";
import { CctvSystem } from "./render/cctv";
import type { NetworkSpec, NetworkView } from "../sim/network";
import { blockBox, createNavGrid, findPath, type NavGrid } from "../sim/nav";
import { TextureLibrary } from "./render/textures";
import { Terrain } from "./world/terrain";
import { generateTown, type ComputerSpot, type LootContainer, type TownData } from "./world/town";
import { generateVegetation } from "./world/vegetation";

const WORLD_SEED = 1987;
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
  private gridWasOn = true;
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
    // Navigation grid over the town: anything at body height blocks walking.
    this.nav = createNavGrid(-135, -135, 270, 270, 0.25);
    for (const box of this.colliders.boxes) {
      if (box.minY < 1.2 && box.maxY > 0.35) blockBox(this.nav, box, 0.3);
    }
  }

  destroy() {
    this.renderer.setAnimationLoop(null);
    this.input.destroy();
    window.removeEventListener("resize", this.resize);
    document.removeEventListener("pointerlockchange", this.onLockChange);
    document.removeEventListener("pointerlockerror", this.onLockError);
    this.canvas.removeEventListener("click", this.onCanvasClick);
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.renderer.dispose();
  }

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
    for (const z of this.zombies) {
      this.scene.remove(z.model.root);
      z.model.dispose();
    }
    this.zombies = [];
    for (const [, obj] of this.groundPiles) this.scene.remove(obj);
    this.groundPiles.clear();
    this.town.containers = this.town.containers.filter((c) => c.table !== "ground");
    for (const c of this.town.containers) c.items = null;

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
    this.gridWasOn = true;
    for (const c of this.town.computers) c.state = createComputerState(c.state.def, c.initialBattery);

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
    return this.inventoryOpen || !!this.container || !!this.computerSpot || !!this.reading;
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
    return this.gridOn() || this.onUps(spec);
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
    return this.minutes < (this.town.facts.powerOffDay - 1) * 1440 + 6 * 60;
  }

  private computerPowered(c: ComputerSpot) {
    if (c.kind === "laptop") return (c.state.battery ?? 0) > 0;
    return this.gridOn() || this.onUps(this.networkOf(c));
  }

  /** True while a building's UPS is still carrying its load after the grid failed. */
  private onUps(spec: NetworkSpec | undefined) {
    if (!spec || spec.upsMinutes <= 0) return false;
    const gridOffAt = (this.town.facts.powerOffDay - 1) * 1440 + 6 * 60;
    return this.minutes - gridOffAt < spec.upsMinutes;
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
    if (!pile) {
      pile = {
        id: 100000 + this.messageId++,
        name: "Ground",
        table: "ground",
        x: p.x,
        y: p.y + 0.1,
        z: p.z,
        hx: 0.3,
        hz: 0.3,
        items: [],
      };
      this.town.containers.push(pile);
      const bag = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.22, 0.35),
        new THREE.MeshStandardMaterial({ color: "#3d4134", roughness: 1 }),
      );
      bag.position.set(p.x, p.y + 0.11, p.z);
      bag.rotation.y = Math.random() * Math.PI;
      bag.castShadow = true;
      this.scene.add(bag);
      this.groundPiles.set(pile.id, bag);
    }
    pile.items!.push(stack);
    this.emitHud();
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

    const swinging = this.swingTime > 0;
    if (controlling) p.update(dt, this.input, this.colliders, this.terrain, swinging);
    else p.update(dt, NO_INPUT, this.colliders, this.terrain, swinging);
    p.overweight = this.carryWeight() > MAX_WEIGHT;

    this.updateCombat(dt);

    // Close the loot window if you get dragged away from it.
    if (this.container && this.distanceToContainer(this.container) > INTERACT_RANGE + 1) this.closeUi();
    if (this.computerSpot && this.distanceToContainer(this.computerSpot) > INTERACT_RANGE + 1) this.closeUi();
    this.updateElectricity(dt);
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

  private updateElectricity(dt: number) {
    const grid = this.gridOn();
    if (this.gridWasOn && !grid) {
      this.message("Somewhere a transformer bangs. The power is out across town.", "warn");
    }
    this.gridWasOn = grid;
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
    const dark = this.env.daylight(this.minutes % 1440) < 0.35;
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

    if (input.wasPressed("KeyF")) {
      this.flashlightOn = !this.flashlightOn;
      this.audio.dryFire();
    }
    if (input.wasPressed("KeyR")) this.startReload();
    if (input.wasPressed("KeyZ")) this.trySleep();
    if (input.wasPressed("KeyB")) this.treatWound();
    if (input.wasPressed("KeyE")) {
      const target = this.nearestInteractable();
      if (target?.type === "computer") this.useComputer(target.computer);
      else if (target?.type === "container") this.openContainer(target.container);
    }
    if (input.wasPressed("Escape") || input.wasPressed("KeyP")) this.pause();

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
      .filter(({ to }) => {
        const d = to.length();
        return d <= reach && d > 0.001 && to.normalize().dot(fwd) >= MELEE.arcCos;
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
    const wallT = this.colliders.raycast(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, 150);

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
    const z = new Zombie(pos, this.rng);
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
        return findPath(this.nav, from.x, from.z, to.x, to.z, 9000);
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
      .filter((z) => z.hunting && z.pos.distanceTo(p.pos) < reach)
      .sort((a, b) => Number(b.attacking) - Number(a.attacking) || a.pos.distanceToSquared(p.pos) - b.pos.distanceToSquared(p.pos));
    this.attackers = new Set(close.slice(0, ZOMBIE.maxAttackers));
  }

  private updateZombies(dt: number) {
    const p = this.player;
    this.assignAttackers();
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
      if (z.alive && d < 30) near.push(z);
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

  private nearestContainer(): LootContainer | null {
    const p = this.player;
    const fwd = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw));
    let best: LootContainer | null = null;
    let bestScore = Infinity;
    for (const c of this.town.containers) {
      const d = this.distanceToContainer(c);
      if (d > INTERACT_RANGE) continue;
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
    | null {
    const container = this.nearestContainer();
    let computer: ComputerSpot | null = null;
    let best = INTERACT_RANGE;
    for (const c of this.town.computers) {
      const d = this.distanceToContainer(c);
      if (d < best) {
        best = d;
        computer = c;
      }
    }
    // Computers sit on desks next to containers; prefer the computer when it's as close.
    if (computer && (!container || best <= this.distanceToContainer(container) + 0.3)) return { type: "computer", computer };
    return container ? { type: "container", container } : null;
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
      prompt: !target ? null : target.type === "computer" ? `Use ${target.computer.kind === "laptop" ? "laptop" : "computer"}` : `Search ${target.container.name}`,
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
