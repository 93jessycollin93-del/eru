import * as THREE from "three";
import { AudioSystem } from "./audio";
import { Player } from "./entities/player";
import { makeHeldItem } from "./entities/humanoid";
import { Zombie, type NoiseEvent } from "./entities/zombie";
import { Input } from "./input";
import { FISTS, ITEMS, makeStack, rollLoot, stackWeight, type ItemDef, type ItemStack } from "./items";
import { mulberry32, pick, range } from "./rng";
import type { GameStatus, HudMessage, HudState } from "./types";
import { ColliderWorld } from "./world/colliders";
import { Environment } from "./world/environment";
import { Terrain } from "./world/terrain";
import { generateTown, type LootContainer, type TownData } from "./world/town";
import { generateVegetation } from "./world/vegetation";

const WORLD_SEED = 1987;
/** In-game minutes that pass per real second. A full day takes 24 minutes. */
const TIME_SCALE = 1;
const START_MINUTES = 7 * 60 + 30;
const MAX_WEIGHT = 20;
const INTERACT_RANGE = 1.9;
const RELOAD_SECONDS = 1.8;
const ZOMBIE_ACTIVE_RANGE = 140;

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
  private swingResolved = true;
  private reloadTimer = 0;

  private flashlight: THREE.SpotLight;
  private flashlightOn = false;
  private muzzle: THREE.PointLight;
  private muzzleTimer = 0;
  private rng = mulberry32(WORLD_SEED + 7);

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
    this.terrain = new Terrain(rng);
    this.scene.add(this.terrain.mesh);
    this.town = generateTown(rng, this.terrain, this.colliders);
    this.scene.add(this.town.group);
    this.scene.add(generateVegetation(rng, this.terrain, this.colliders, this.town.occupied));
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
  };

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

  toggleInventory() {
    if (this.status !== "playing") return;
    if (this.inventoryOpen || this.container) this.closeUi();
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
        p.hunger = clamp(p.hunger + (def.hunger ?? 0));
        p.thirst = clamp(p.thirst + (def.thirst ?? 0));
        this.audio.eat();
        this.message(`${def.category === "food" ? "Ate" : "Drank"} ${def.name}.`, "good");
        this.consume(stack);
        break;
      case "medical":
        p.health = clamp(p.health + (def.heal ?? 0));
        if (def.stopsBleeding && p.bleeding) {
          p.bleeding = false;
          this.message("The bleeding has stopped.", "good");
        } else this.message(`Used ${def.name}.`, "good");
        this.consume(stack);
        break;
      case "melee":
      case "firearm":
        this.setEquipped(this.equippedUid === uid ? null : uid);
        break;
      default:
        break;
    }
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
    if (!isLocked && this.status === "playing" && !this.inventoryOpen && !this.container) this.pause();
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
    if (this.status === "playing" && !this.locked && !this.inventoryOpen && !this.container) this.requestLock();
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

    this.renderer.render(this.scene, this.camera);

    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.1;
      this.emitHud();
    }
    this.input.endFrame();
  };

  private update(dt: number) {
    const p = this.player;
    const controlling = this.locked && !this.inventoryOpen && !this.container;
    const gameMinutes = dt * TIME_SCALE;
    this.minutes += gameMinutes;

    // Keys that work even with menus open
    if (this.input.wasPressed("Tab") || this.input.wasPressed("KeyI")) this.toggleInventory();
    if ((this.inventoryOpen || this.container) && this.input.wasPressed("Escape")) this.closeUi(false);

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

    const death = p.updateStats(dt, gameMinutes);
    if (death) this.die(death);

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

  private handleActions(dt: number) {
    const input = this.input;
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);

    if (input.wasPressed("KeyF")) {
      this.flashlightOn = !this.flashlightOn;
      this.audio.dryFire();
    }
    if (input.wasPressed("KeyR")) this.startReload();
    if (input.wasPressed("KeyE")) {
      const c = this.nearestContainer();
      if (c) this.openContainer(c);
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
    if (p.stamina < (weapon.stamina ?? 5) * 0.4) {
      this.message("Too tired to swing.", "warn");
      this.attackCooldown = 0.6;
      return;
    }
    p.stamina = Math.max(0, p.stamina - (weapon.stamina ?? 5));
    this.swingDuration = (weapon.attackInterval ?? 0.6) * 0.9;
    this.swingTime = 0.0001;
    this.swingResolved = false;
    this.attackCooldown = weapon.attackInterval ?? 0.6;
    this.audio.swing();
  }

  private updateCombat(dt: number) {
    const p = this.player;
    if (this.swingTime > 0) {
      this.swingTime += dt;
      const t = this.swingTime / this.swingDuration;
      p.attackAnim = Math.min(1, t);
      if (!this.swingResolved && t >= 0.45) {
        this.swingResolved = true;
        this.resolveMelee(this.weaponDef());
      }
      if (t >= 1) {
        this.swingTime = 0;
        p.attackAnim = 0;
      }
    }

    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) this.finishReload();
    }
  }

  private resolveMelee(weapon: ItemDef) {
    const p = this.player;
    const fwd = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw));
    const reach = (weapon.reach ?? 1.3) + 0.35;
    let best: Zombie | null = null;
    let bestDist = Infinity;
    for (const z of this.zombies) {
      if (!z.alive) continue;
      const to = z.pos.clone().sub(p.pos).setY(0);
      const d = to.length();
      if (d > reach || d < 0.001) continue;
      if (to.normalize().dot(fwd) < 0.35) continue;
      if (d < bestDist) {
        best = z;
        bestDist = d;
      }
    }
    if (!best) return;
    const tired = p.stamina < 15 ? 0.6 : 1;
    const crit = Math.random() < 0.12;
    const dmg = (weapon.damage ?? 10) * tired * (crit ? 2.2 : 1);
    const knock = weapon.id === "baseball_bat" ? 4 : weapon.id === "fire_axe" ? 3 : weapon.id === "fists" ? 2 : 1.2;
    this.audio.hit();
    this.noises.push({ pos: p.pos.clone(), radius: weapon.noise ?? 3, ttl: 0.4 });
    if (best.hit(dmg, p.pos, knock)) this.onZombieKilled();
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
    this.noises.push({ pos: p.pos.clone(), radius: weapon.noise ?? 50, ttl: 0.5 });
    p.pitch += 0.025; // recoil

    const hand = new THREE.Vector3();
    p.model.hand.getWorldPosition(hand);
    this.muzzle.position.copy(hand);
    this.muzzle.intensity = 40;
    this.muzzleTimer = 0.05;

    // Shoot from the camera through the crosshair, with spread when not aiming.
    const spread = p.aiming ? 0.008 : 0.06;
    const dir = new THREE.Vector3();
    this.camera.updateMatrixWorld();
    this.camera.getWorldDirection(dir);
    dir.x += (Math.random() - 0.5) * spread;
    dir.y += (Math.random() - 0.5) * spread;
    dir.z += (Math.random() - 0.5) * spread;
    dir.normalize();
    const origin = this.camera.position.clone();
    // Ignore anything between the camera and the player.
    const chest = p.pos.clone().setY(p.pos.y + 1.3);
    const tMin = Math.max(0, chest.clone().sub(origin).dot(dir) - 0.3);
    const wallT = this.colliders.raycast(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, 150);

    let hitZombie: Zombie | null = null;
    let hitT = wallT;
    let headshot = false;
    const tmp = new THREE.Vector3();
    for (const z of this.zombies) {
      if (!z.alive || z.pos.distanceTo(p.pos) > 120) continue;
      const parts: [number, number, boolean][] = [
        [1.66, 0.17, true],
        [1.2, 0.3, false],
        [0.55, 0.28, false],
      ];
      for (const [h, r, head] of parts) {
        tmp.set(z.pos.x, z.pos.y + h, z.pos.z);
        const t = raySphere(origin, dir, tmp, r);
        if (t !== null && t > tMin && t < hitT) {
          hitT = t;
          hitZombie = z;
          headshot = head;
        }
      }
    }
    if (hitZombie) {
      const dmg = headshot ? 200 : weapon.damage ?? 40;
      this.audio.hit();
      if (hitZombie.hit(dmg, p.pos, 1.5)) {
        this.onZombieKilled();
        if (headshot) this.message("Headshot.", "good");
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
    let visibility = 9 + daylight * 26;
    if (p.crouching) visibility *= 0.55;
    if (this.flashlightOn && daylight < 0.5) visibility = Math.max(visibility, 30);
    return {
      dt,
      playerPos: p.pos,
      playerAlive: this.status === "playing",
      visibility,
      footstepRadius: p.footstepRadius,
      noises: this.noises,
      colliders: this.colliders,
      terrain: this.terrain,
      onAttack: (z: Zombie) => this.onZombieAttack(z),
    };
  }

  private updateZombies(dt: number) {
    const p = this.player;
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
    const dmg = range(Math.random, 8, 16);
    p.health -= dmg;
    this.damageFlash = 1;
    this.audio.hurt();
    if (!p.bleeding && Math.random() < 0.3) {
      p.bleeding = true;
      this.message("You're bleeding. Use a bandage.", "danger");
    }
    // Being grabbed slows you down.
    p.speed *= 0.3;
    if (p.health <= 0) this.die(p.bleeding ? "Torn apart by the infected" : "Bitten to death");
    void z;
  }

  private die(cause: string) {
    if (this.status === "dead") return;
    this.player.health = 0;
    this.status = "dead";
    this.causeOfDeath = cause;
    this.inventoryOpen = false;
    this.container = null;
    this.releaseLock();
    this.emitHud();
  }

  // -------------------------------------------------------------- looting

  private distanceToContainer(c: LootContainer) {
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

  private openContainer(c: LootContainer) {
    if (c.items === null) c.items = rollLoot(c.table, Math.random);
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
    const prompt =
      this.status === "playing" && !this.container && !this.inventoryOpen && this.terrain
        ? this.nearestContainer()
        : null;
    const containerItems = this.container?.items ?? null;
    this.onHud({
      status: this.status,
      locked: this.locked,
      health: Math.max(0, p.health),
      hunger: p.hunger,
      thirst: p.thirst,
      stamina: p.stamina,
      bleeding: p.bleeding,
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
      prompt: prompt ? `Search ${prompt.name}` : null,
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

const clamp = (v: number) => Math.max(0, Math.min(100, v));

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
