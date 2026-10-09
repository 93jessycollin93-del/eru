export type Vec = { x: number; y: number };

export type ZombieKind = "walker" | "runner" | "brute";

export interface Zombie {
  id: number;
  kind: ZombieKind;
  pos: Vec;
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  damage: number;
  attackCooldown: number;
  hitFlash: number;
}

export interface Bullet {
  pos: Vec;
  vel: Vec;
  life: number;
}

export type PickupKind = "health" | "ammo";

export interface Pickup {
  kind: PickupKind;
  pos: Vec;
  life: number;
}

export interface Particle {
  pos: Vec;
  vel: Vec;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface Player {
  pos: Vec;
  angle: number;
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  mag: number;
  magSize: number;
  reserve: number;
  reloadTimer: number;
  fireCooldown: number;
  hurtFlash: number;
}

export type GameStatus = "menu" | "playing" | "paused" | "over";

export interface HudState {
  status: GameStatus;
  hp: number;
  maxHp: number;
  mag: number;
  magSize: number;
  reserve: number;
  reloading: boolean;
  wave: number;
  zombiesLeft: number;
  score: number;
  kills: number;
  highScore: number;
  intermission: number;
}
