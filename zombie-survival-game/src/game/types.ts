import type { BodyPart, Moodle, WoundKind } from "../sim/body";
import type { ItemStack } from "../sim/items";

export type GameStatus = "menu" | "loading" | "playing" | "paused" | "dead";

export interface HudMessage {
  id: number;
  text: string;
  tone: "info" | "warn" | "danger" | "good";
}

export interface ContainerView {
  id: number;
  name: string;
  items: ItemStack[];
}

export interface WoundView {
  id: number;
  part: BodyPart;
  partName: string;
  kind: WoundKind;
  severity: number;
  bleeding: boolean;
  bandaged: boolean;
}

export interface HudState {
  status: GameStatus;
  /** True while the pointer is captured and the player is actively controlling. */
  locked: boolean;
  health: number;
  /** 0..100: 100 is a full 5 litres, 0 is fatal blood loss. */
  blood: number;
  hunger: number;
  thirst: number;
  stamina: number;
  bleeding: boolean;
  bodyTemp: number;
  airTemp: number;
  sheltered: boolean;
  fatigue: number;
  pain: number;
  asleep: boolean;
  moodles: Moodle[];
  wounds: WoundView[];
  canBandage: boolean;
  /** Died of the infection and came back. */
  turned: boolean;
  crouching: boolean;
  aiming: boolean;
  /** 0..1 how much noise the player is making. */
  noise: number;
  /** Whether any zombie is currently chasing the player. */
  hunted: boolean;
  day: number;
  /** Minutes since midnight, 0..1440 */
  timeOfDay: number;
  equippedUid: number | null;
  equipped: { name: string; loaded?: number; magSize?: number; reserve?: number; reloading: boolean };
  hotbar: { slot: number; name: string; active: boolean }[];
  prompt: string | null;
  /** Other actions on what you're looking at, e.g. Q to throw a deadbolt. */
  altPrompts: { key: string; label: string }[];
  /** The door or window you're looking at. */
  barrier: { label: string; boards: number; maxBoards: number; integrity: "Holding" | "Cracked" | "Splintering" | null } | null;
  /** Timed work in progress (boarding up, breaking glass). */
  action: { label: string; progress: number } | null;
  /** Door keypad in use: digits entered so far (shown masked) and the last result. */
  keypad: { label: string; entered: number; status: "idle" | "granted" | "denied" | "lockout" | "dark"; lockout: number } | null;
  computer: {
    hostname: string;
    kind: "desktop" | "laptop";
    lines: string[];
    prompt: string;
    battery: number | null;
    /** Hide typed characters. */
    password: boolean;
  } | null;
  reading: { title: string; text: string } | null;
  generator: {
    name: string;
    running: boolean;
    tripped: boolean;
    fuelL: number;
    tankL: number;
    ratedW: number;
    loadW: number;
    connectedTo: string | null;
    portable: boolean;
    autoStart: boolean;
    inReach: string | null;
    canRefuel: boolean;
    fuelCarried: number;
  } | null;
  /** Power source of the building you're in. */
  power: "grid" | "generator" | "ups" | "none" | null;
  /** Litres left in the car being searched. */
  containerFuel: number | null;
  /** Camera viewer opened from a terminal. */
  cctv: { nvr: string; channels: { channel: number; label: string; online: boolean }[] } | null;
  /** Street address when inside a building. */
  location: string | null;
  gridOn: boolean;
  townName: string;
  quality: "low" | "high";
  inventory: ItemStack[];
  carryWeight: number;
  maxWeight: number;
  inventoryOpen: boolean;
  container: ContainerView | null;
  messages: HudMessage[];
  kills: number;
  flashlight: boolean;
  /** 0..1 red flash when hurt. */
  damageFlash: number;
  crosshair: boolean;
  /** Pointer lock failed, so the game runs with a free cursor. */
  freeMouse: boolean;
  /** Survival stats summary for the death screen. */
  survivedMinutes: number;
  causeOfDeath: string;
}
