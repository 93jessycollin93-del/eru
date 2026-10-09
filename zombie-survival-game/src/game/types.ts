import type { ItemStack } from "./items";

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

export interface HudState {
  status: GameStatus;
  /** True while the pointer is captured and the player is actively controlling. */
  locked: boolean;
  health: number;
  hunger: number;
  thirst: number;
  stamina: number;
  bleeding: boolean;
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
