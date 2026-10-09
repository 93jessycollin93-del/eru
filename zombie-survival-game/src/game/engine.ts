import type {
  Bullet,
  GameStatus,
  HudState,
  Particle,
  Pickup,
  Player,
  Vec,
  Zombie,
  ZombieKind,
} from "./types";

const HIGH_SCORE_KEY = "zombie-survival:high-score";
const INTERMISSION_SECONDS = 4;
const BULLET_SPEED = 900;
const FIRE_INTERVAL = 0.12;
const RELOAD_SECONDS = 1.3;

const ZOMBIE_STATS: Record<
  ZombieKind,
  { hp: number; speed: number; radius: number; damage: number; score: number; color: string }
> = {
  walker: { hp: 3, speed: 55, radius: 14, damage: 10, score: 10, color: "#5f7d4a" },
  runner: { hp: 2, speed: 125, radius: 11, damage: 8, score: 20, color: "#8a9a3b" },
  brute: { hp: 14, speed: 38, radius: 24, damage: 25, score: 60, color: "#4a5e3a" },
};

const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
const rand = (min: number, max: number) => min + Math.random() * (max - min);

function readHighScore(): number {
  try {
    return Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeHighScore(score: number) {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(score));
  } catch {
    // Storage unavailable (private mode etc.) — high score just won't persist.
  }
}

export class Game {
  private ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private rafId = 0;
  private lastTime = 0;
  private hudTimer = 0;

  private status: GameStatus = "menu";
  private player!: Player;
  private zombies: Zombie[] = [];
  private bullets: Bullet[] = [];
  private pickups: Pickup[] = [];
  private particles: Particle[] = [];
  private decals: { pos: Vec; r: number; alpha: number }[] = [];

  private wave = 0;
  private toSpawn = 0;
  private spawnTimer = 0;
  private intermission = 0;
  private score = 0;
  private kills = 0;
  private highScore = readHighScore();
  private nextId = 1;
  private shake = 0;

  private keys = new Set<string>();
  private mouse: Vec = { x: 0, y: 0 };
  private mouseDown = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private onHud: (hud: HudState) => void,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D not supported");
    this.ctx = ctx;
    this.resize();
    this.resetPlayer();
    this.bind();
    this.rafId = requestAnimationFrame(this.loop);
    this.emitHud();
  }

  // ---------- public controls ----------

  start() {
    this.zombies = [];
    this.bullets = [];
    this.pickups = [];
    this.particles = [];
    this.decals = [];
    this.wave = 0;
    this.score = 0;
    this.kills = 0;
    this.shake = 0;
    this.resetPlayer();
    this.status = "playing";
    this.beginIntermission();
    this.emitHud();
  }

  togglePause() {
    if (this.status === "playing") this.status = "paused";
    else if (this.status === "paused") this.status = "playing";
    this.keys.clear();
    this.mouseDown = false;
    this.emitHud();
  }

  destroy() {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.canvas.removeEventListener("mousemove", this.onMouseMove);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    this.canvas.removeEventListener("contextmenu", this.preventDefault);
  }

  // ---------- setup ----------

  private resetPlayer() {
    this.player = {
      pos: { x: this.width / 2, y: this.height / 2 },
      angle: 0,
      hp: 100,
      maxHp: 100,
      speed: 210,
      radius: 14,
      mag: 12,
      magSize: 12,
      reserve: 60,
      reloadTimer: 0,
      fireCooldown: 0,
      hurtFlash: 0,
    };
  }

  private bind() {
    window.addEventListener("resize", this.resize);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    this.canvas.addEventListener("mousemove", this.onMouseMove);
    this.canvas.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    this.canvas.addEventListener("contextmenu", this.preventDefault);
  }

  private resize = () => {
    this.dpr = window.devicePixelRatio || 1;
    this.width = this.canvas.clientWidth;
    this.height = this.canvas.clientHeight;
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.player) {
      this.player.pos.x = Math.min(this.player.pos.x, this.width);
      this.player.pos.y = Math.min(this.player.pos.y, this.height);
    }
  };

  private onKeyDown = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    if (key === "escape" || key === "p") {
      this.togglePause();
      return;
    }
    if (key === "r") this.reload();
    if ((key === "enter" || key === " ") && (this.status === "menu" || this.status === "over")) {
      this.start();
      return;
    }
    this.keys.add(key);
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) e.preventDefault();
  };

  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
  private onBlur = () => {
    this.keys.clear();
    this.mouseDown = false;
    if (this.status === "playing") this.togglePause();
  };
  private onMouseMove = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 0) this.mouseDown = true;
  };
  private onMouseUp = () => (this.mouseDown = false);
  private preventDefault = (e: Event) => e.preventDefault();

  // ---------- loop ----------

  private loop = (time: number) => {
    const dt = Math.min((time - this.lastTime) / 1000 || 0, 1 / 20);
    this.lastTime = time;

    if (this.status === "playing") this.update(dt);
    this.render();

    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.1;
      this.emitHud();
    }
    this.rafId = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    this.updatePlayer(dt);
    this.updateWaves(dt);
    this.updateBullets(dt);
    this.updateZombies(dt);
    this.updatePickups(dt);
    this.updateParticles(dt);
    this.shake = Math.max(0, this.shake - dt * 30);
  }

  private updatePlayer(dt: number) {
    const p = this.player;
    let dx = 0;
    let dy = 0;
    if (this.keys.has("w") || this.keys.has("arrowup")) dy -= 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) dy += 1;
    if (this.keys.has("a") || this.keys.has("arrowleft")) dx -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) dx += 1;
    const len = Math.hypot(dx, dy);
    if (len > 0) {
      p.pos.x += (dx / len) * p.speed * dt;
      p.pos.y += (dy / len) * p.speed * dt;
    }
    p.pos.x = Math.max(p.radius, Math.min(this.width - p.radius, p.pos.x));
    p.pos.y = Math.max(p.radius, Math.min(this.height - p.radius, p.pos.y));
    p.angle = Math.atan2(this.mouse.y - p.pos.y, this.mouse.x - p.pos.x);

    p.fireCooldown = Math.max(0, p.fireCooldown - dt);
    p.hurtFlash = Math.max(0, p.hurtFlash - dt);

    if (p.reloadTimer > 0) {
      p.reloadTimer -= dt;
      if (p.reloadTimer <= 0) {
        const needed = p.magSize - p.mag;
        const taken = Math.min(needed, p.reserve);
        p.mag += taken;
        p.reserve -= taken;
        p.reloadTimer = 0;
      }
    } else if (this.mouseDown && p.fireCooldown === 0) {
      if (p.mag > 0) this.shoot();
      else this.reload();
    }
  }

  private shoot() {
    const p = this.player;
    p.mag -= 1;
    p.fireCooldown = FIRE_INTERVAL;
    const spread = rand(-0.04, 0.04);
    const a = p.angle + spread;
    const muzzle = { x: p.pos.x + Math.cos(a) * 22, y: p.pos.y + Math.sin(a) * 22 };
    this.bullets.push({
      pos: muzzle,
      vel: { x: Math.cos(a) * BULLET_SPEED, y: Math.sin(a) * BULLET_SPEED },
      life: 1,
    });
    this.burst(muzzle, 4, "#ffd27a", 120, 2, 0.12);
    this.shake = Math.max(this.shake, 2);
  }

  private reload() {
    const p = this.player;
    if (this.status !== "playing" || p.reloadTimer > 0 || p.mag === p.magSize || p.reserve === 0) return;
    p.reloadTimer = RELOAD_SECONDS;
  }

  private updateWaves(dt: number) {
    if (this.intermission > 0) {
      this.intermission -= dt;
      if (this.intermission <= 0) this.startWave();
      return;
    }
    if (this.toSpawn > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnZombie();
        this.toSpawn -= 1;
        this.spawnTimer = Math.max(0.25, 1.4 - this.wave * 0.1) * rand(0.6, 1.2);
      }
    } else if (this.zombies.length === 0) {
      this.beginIntermission();
    }
  }

  private beginIntermission() {
    this.intermission = INTERMISSION_SECONDS;
    if (this.wave > 0) {
      // Reward for clearing a wave.
      this.player.reserve += 12;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 15);
    }
  }

  private startWave() {
    this.wave += 1;
    this.intermission = 0;
    this.toSpawn = 4 + this.wave * 3;
    this.spawnTimer = 0.5;
  }

  private pickKind(): ZombieKind {
    const r = Math.random();
    const bruteChance = this.wave >= 3 ? Math.min(0.2, 0.04 * (this.wave - 2)) : 0;
    const runnerChance = this.wave >= 2 ? Math.min(0.35, 0.08 * (this.wave - 1)) : 0;
    if (r < bruteChance) return "brute";
    if (r < bruteChance + runnerChance) return "runner";
    return "walker";
  }

  private spawnZombie() {
    const kind = this.pickKind();
    const stats = ZOMBIE_STATS[kind];
    const margin = 40;
    let pos: Vec;
    switch (Math.floor(Math.random() * 4)) {
      case 0:
        pos = { x: rand(0, this.width), y: -margin };
        break;
      case 1:
        pos = { x: this.width + margin, y: rand(0, this.height) };
        break;
      case 2:
        pos = { x: rand(0, this.width), y: this.height + margin };
        break;
      default:
        pos = { x: -margin, y: rand(0, this.height) };
    }
    // Zombies get a little tougher and faster each wave.
    const hp = Math.ceil(stats.hp * (1 + (this.wave - 1) * 0.12));
    this.zombies.push({
      id: this.nextId++,
      kind,
      pos,
      hp,
      maxHp: hp,
      speed: stats.speed * (1 + Math.min(0.5, (this.wave - 1) * 0.04)) * rand(0.9, 1.1),
      radius: stats.radius,
      damage: stats.damage,
      attackCooldown: 0,
      hitFlash: 0,
    });
  }

  private updateBullets(dt: number) {
    for (const b of this.bullets) {
      b.pos.x += b.vel.x * dt;
      b.pos.y += b.vel.y * dt;
      b.life -= dt;
      for (const z of this.zombies) {
        if (z.hp > 0 && dist(b.pos, z.pos) < z.radius + 3) {
          b.life = 0;
          z.hp -= 1;
          z.hitFlash = 0.08;
          // Knockback
          const k = z.kind === "brute" ? 3 : 8;
          z.pos.x += (b.vel.x / BULLET_SPEED) * k;
          z.pos.y += (b.vel.y / BULLET_SPEED) * k;
          this.burst(b.pos, 5, "#7a1010", 140, 2.5, 0.4);
          if (z.hp <= 0) this.killZombie(z);
          break;
        }
      }
      if (b.pos.x < -20 || b.pos.y < -20 || b.pos.x > this.width + 20 || b.pos.y > this.height + 20) {
        b.life = 0;
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
  }

  private killZombie(z: Zombie) {
    this.kills += 1;
    this.score += ZOMBIE_STATS[z.kind].score * this.wave;
    this.burst(z.pos, 16, "#6b0d0d", 200, 3.5, 0.7);
    this.decals.push({ pos: { ...z.pos }, r: z.radius * rand(1.1, 1.8), alpha: 0.55 });
    if (this.decals.length > 120) this.decals.shift();

    const roll = Math.random();
    const dropBoost = z.kind === "brute" ? 0.35 : 0;
    if (roll < 0.12 + dropBoost) this.pickups.push({ kind: "ammo", pos: { ...z.pos }, life: 12 });
    else if (roll < 0.18 + dropBoost) this.pickups.push({ kind: "health", pos: { ...z.pos }, life: 12 });
  }

  private updateZombies(dt: number) {
    const p = this.player;
    this.zombies = this.zombies.filter((z) => z.hp > 0);
    for (const z of this.zombies) {
      z.hitFlash = Math.max(0, z.hitFlash - dt);
      z.attackCooldown = Math.max(0, z.attackCooldown - dt);
      const d = dist(z.pos, p.pos);
      if (d > 0.001) {
        z.pos.x += ((p.pos.x - z.pos.x) / d) * z.speed * dt;
        z.pos.y += ((p.pos.y - z.pos.y) / d) * z.speed * dt;
      }
      if (d < z.radius + p.radius && z.attackCooldown === 0) {
        z.attackCooldown = 0.8;
        p.hp -= z.damage;
        p.hurtFlash = 0.25;
        this.shake = Math.max(this.shake, 8);
        this.burst(p.pos, 8, "#b31b1b", 160, 3, 0.4);
        if (p.hp <= 0) {
          p.hp = 0;
          this.gameOver();
          return;
        }
      }
    }
    // Keep zombies from stacking on top of each other.
    for (let i = 0; i < this.zombies.length; i++) {
      for (let j = i + 1; j < this.zombies.length; j++) {
        const a = this.zombies[i];
        const b = this.zombies[j];
        const d = dist(a.pos, b.pos);
        const min = a.radius + b.radius;
        if (d > 0 && d < min) {
          const push = (min - d) / 2;
          const nx = (a.pos.x - b.pos.x) / d;
          const ny = (a.pos.y - b.pos.y) / d;
          a.pos.x += nx * push;
          a.pos.y += ny * push;
          b.pos.x -= nx * push;
          b.pos.y -= ny * push;
        }
      }
    }
  }

  private updatePickups(dt: number) {
    const p = this.player;
    for (const pk of this.pickups) {
      pk.life -= dt;
      if (dist(pk.pos, p.pos) < p.radius + 12) {
        pk.life = 0;
        if (pk.kind === "ammo") p.reserve += 18;
        else p.hp = Math.min(p.maxHp, p.hp + 25);
        this.burst(pk.pos, 10, pk.kind === "ammo" ? "#e8c35a" : "#4ade80", 120, 2.5, 0.5);
      }
    }
    this.pickups = this.pickups.filter((pk) => pk.life > 0);
  }

  private updateParticles(dt: number) {
    for (const pt of this.particles) {
      pt.pos.x += pt.vel.x * dt;
      pt.pos.y += pt.vel.y * dt;
      pt.vel.x *= 0.9;
      pt.vel.y *= 0.9;
      pt.life -= dt;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
  }

  private burst(at: Vec, count: number, color: string, speed: number, size: number, life: number) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(speed * 0.3, speed);
      this.particles.push({
        pos: { ...at },
        vel: { x: Math.cos(a) * s, y: Math.sin(a) * s },
        life,
        maxLife: life,
        color,
        size: rand(size * 0.5, size),
      });
    }
  }

  private gameOver() {
    this.status = "over";
    this.mouseDown = false;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      writeHighScore(this.score);
    }
    this.emitHud();
  }

  private emitHud() {
    const p = this.player;
    this.onHud({
      status: this.status,
      hp: Math.ceil(p.hp),
      maxHp: p.maxHp,
      mag: p.mag,
      magSize: p.magSize,
      reserve: p.reserve,
      reloading: p.reloadTimer > 0,
      wave: this.wave,
      zombiesLeft: this.toSpawn + this.zombies.length,
      score: this.score,
      kills: this.kills,
      highScore: this.highScore,
      intermission: Math.ceil(this.intermission),
    });
  }

  // ---------- rendering ----------

  private render() {
    const ctx = this.ctx;
    const { width: w, height: h } = this;
    ctx.save();
    if (this.shake > 0) ctx.translate(rand(-this.shake, this.shake), rand(-this.shake, this.shake));

    // Ground
    ctx.fillStyle = "#1a1d17";
    ctx.fillRect(-20, -20, w + 40, h + 40);
    ctx.strokeStyle = "rgba(255,255,255,0.025)";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    for (const d of this.decals) {
      ctx.fillStyle = `rgba(90, 8, 8, ${d.alpha})`;
      ctx.beginPath();
      ctx.arc(d.pos.x, d.pos.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const pk of this.pickups) this.drawPickup(pk);
    for (const z of this.zombies) this.drawZombie(z);
    if (this.status !== "menu") this.drawPlayer();

    ctx.fillStyle = "#ffe9a8";
    for (const b of this.bullets) {
      ctx.beginPath();
      ctx.arc(b.pos.x, b.pos.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const pt of this.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.pos.x, pt.pos.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Flashlight darkness around the player
    const c = this.status === "menu" ? { x: w / 2, y: h / 2 } : this.player.pos;
    const grad = ctx.createRadialGradient(c.x, c.y, 120, c.x, c.y, Math.max(w, h) * 0.6);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.72)");
    ctx.fillStyle = grad;
    ctx.fillRect(-20, -20, w + 40, h + 40);

    if (this.player.hurtFlash > 0) {
      ctx.fillStyle = `rgba(180, 0, 0, ${this.player.hurtFlash})`;
      ctx.fillRect(-20, -20, w + 40, h + 40);
    }
    ctx.restore();
  }

  private drawPlayer() {
    const ctx = this.ctx;
    const p = this.player;
    ctx.save();
    ctx.translate(p.pos.x, p.pos.y);
    ctx.rotate(p.angle);
    // Gun
    ctx.fillStyle = "#2b2b2b";
    ctx.fillRect(6, -3, 18, 6);
    // Body
    ctx.fillStyle = "#3b6ea5";
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();
    // Head
    ctx.fillStyle = "#e0b48a";
    ctx.beginPath();
    ctx.arc(2, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (p.reloadTimer > 0) {
      const t = 1 - p.reloadTimer / RELOAD_SECONDS;
      ctx.strokeStyle = "#e8c35a";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, p.radius + 8, -Math.PI / 2, -Math.PI / 2 + t * Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawZombie(z: Zombie) {
    const ctx = this.ctx;
    const stats = ZOMBIE_STATS[z.kind];
    const angle = Math.atan2(this.player.pos.y - z.pos.y, this.player.pos.x - z.pos.x);
    ctx.save();
    ctx.translate(z.pos.x, z.pos.y);
    ctx.rotate(angle);
    // Arms reaching forward
    ctx.fillStyle = z.hitFlash > 0 ? "#ffffff" : stats.color;
    ctx.fillRect(z.radius * 0.3, -z.radius * 0.9, z.radius * 1.1, z.radius * 0.35);
    ctx.fillRect(z.radius * 0.3, z.radius * 0.55, z.radius * 1.1, z.radius * 0.35);
    ctx.beginPath();
    ctx.arc(0, 0, z.radius, 0, Math.PI * 2);
    ctx.fill();
    // Eyes
    ctx.fillStyle = "#ff3b3b";
    ctx.beginPath();
    ctx.arc(z.radius * 0.5, -z.radius * 0.3, z.radius * 0.15, 0, Math.PI * 2);
    ctx.arc(z.radius * 0.5, z.radius * 0.3, z.radius * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (z.hp < z.maxHp) {
      const bw = z.radius * 2;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(z.pos.x - bw / 2, z.pos.y - z.radius - 10, bw, 4);
      ctx.fillStyle = "#c0392b";
      ctx.fillRect(z.pos.x - bw / 2, z.pos.y - z.radius - 10, bw * (z.hp / z.maxHp), 4);
    }
  }

  private drawPickup(pk: Pickup) {
    const ctx = this.ctx;
    // Blink when about to expire
    if (pk.life < 3 && Math.floor(pk.life * 6) % 2 === 0) return;
    const bob = Math.sin(performance.now() / 200) * 2;
    ctx.save();
    ctx.translate(pk.pos.x, pk.pos.y + bob);
    if (pk.kind === "health") {
      ctx.fillStyle = "#f5f5f5";
      ctx.fillRect(-9, -9, 18, 18);
      ctx.fillStyle = "#d62828";
      ctx.fillRect(-2.5, -7, 5, 14);
      ctx.fillRect(-7, -2.5, 14, 5);
    } else {
      ctx.fillStyle = "#6b5b2e";
      ctx.fillRect(-10, -7, 20, 14);
      ctx.fillStyle = "#e8c35a";
      for (let i = -6; i <= 6; i += 4) ctx.fillRect(i - 1, -4, 2, 8);
    }
    ctx.restore();
  }
}
