import { describe, expect, it } from "vitest";
import { createBody, spendStamina, updateBody } from "./body";
import { FISTS, ITEMS } from "./items";
import {
  BARRICADE,
  BARRIER,
  BARRIER_NOISE,
  DOOR,
  FOOTSTEPS,
  MOVE,
  NAV_COST,
  SENSES,
  STAMINA,
  WINDOW,
  ZOMBIE,
  meleeDamage,
  shotSpread,
  sightRate,
  visibilityRange,
} from "./tuning";

const env = (exertion: number) => ({ ambientTemp: 15, exertion, threats: 0 });

describe("stamina targets", () => {
  it("a full bar sprints for 10-13 seconds", () => {
    const b = createBody();
    let t = 0;
    while (b.stamina > 0 && t < 30) {
      updateBody(b, 0.1, 0.1, env(1));
      t += 0.1;
    }
    expect(t).toBeGreaterThanOrEqual(10);
    expect(t).toBeLessThanOrEqual(13);
    expect(b.winded).toBe(true);
  });

  it("winded lasts 3-5 seconds of rest before you can sprint again", () => {
    const b = createBody();
    spendStamina(b, 200);
    let t = 0;
    while (b.winded && t < 20) {
      updateBody(b, 0.1, 0.1, env(0));
      t += 0.1;
    }
    expect(t).toBeGreaterThanOrEqual(3);
    expect(t).toBeLessThanOrEqual(5);
  });

  it("stamina waits before regenerating", () => {
    const b = createBody();
    spendStamina(b, 50);
    updateBody(b, STAMINA.regenDelay * 0.5, 0, env(0));
    expect(b.stamina).toBe(50);
  });
});

describe("movement targets", () => {
  const median = (r: readonly [number, number]) => (r[0] + r[1]) / 2;
  it("jogging escapes a typical zombie but not a runner; sprinting escapes runners", () => {
    expect(MOVE.jog).toBeGreaterThan(ZOMBIE.chaseSpeed[1]);
    expect(MOVE.jog).toBeLessThan(ZOMBIE.runnerSpeed[0]);
    expect(MOVE.sprint).toBeGreaterThan(ZOMBIE.runnerSpeed[1]);
    expect(median(ZOMBIE.chaseSpeed) / MOVE.jog).toBeGreaterThan(0.7);
  });

  it("gaits are ordered by noise", () => {
    expect(FOOTSTEPS.crouch).toBeLessThan(FOOTSTEPS.walk);
    expect(FOOTSTEPS.walk).toBeLessThan(FOOTSTEPS.jog);
    expect(FOOTSTEPS.jog).toBeLessThan(FOOTSTEPS.sprint);
    expect(ITEMS.pistol.noise).toBeGreaterThanOrEqual(SENSES.gunshotRadius);
  });
});

describe("detection targets", () => {
  const base = { facingCos: 1, lineOfSight: true, moving: false, sprinting: false, crouching: false };
  const timeToNotice = (rate: number) => (rate === 0 ? Infinity : 1 / rate);

  it("standing still in daylight at 25 m takes 1.5-4 s to notice", () => {
    const t = timeToNotice(sightRate({ ...base, distance: 25, visibility: visibilityRange(1, false, false) }));
    expect(t).toBeGreaterThan(1.5);
    expect(t).toBeLessThan(4);
  });

  it("running at 8 m is noticed almost immediately", () => {
    const t = timeToNotice(sightRate({ ...base, distance: 8, visibility: 35, moving: true, sprinting: true }));
    expect(t).toBeLessThan(0.3);
  });

  it("crouched at night 12 m away you are invisible; a flashlight gives you away", () => {
    expect(sightRate({ ...base, distance: 12, visibility: visibilityRange(0, false, true), crouching: true })).toBe(0);
    expect(sightRate({ ...base, distance: 12, visibility: visibilityRange(0, true, false) })).toBeGreaterThan(0);
  });

  it("zombies can't see behind them, but catch movement at the edge of vision", () => {
    expect(sightRate({ ...base, distance: 6, visibility: 35, facingCos: -0.8, moving: true })).toBe(0);
    const side = sightRate({ ...base, distance: 6, visibility: 35, facingCos: 0, moving: true });
    const front = sightRate({ ...base, distance: 6, visibility: 35, facingCos: 1, moving: true });
    expect(side).toBeGreaterThan(0);
    expect(side).toBeLessThan(front / 2);
  });

  it("walls block sight", () => {
    expect(sightRate({ ...base, distance: 5, visibility: 35, lineOfSight: false })).toBe(0);
  });
});

describe("combat targets (100 hp zombie, no crits)", () => {
  const hits = (dmg: number) => Math.ceil(ZOMBIE.hp / dmg);
  it("axe 2, bat 3, knife 3, fists 10", () => {
    expect(hits(meleeDamage(ITEMS.fire_axe.damage!, 1, false, false))).toBe(2);
    expect(hits(meleeDamage(ITEMS.baseball_bat.damage!, 1, false, false))).toBe(3);
    expect(hits(meleeDamage(ITEMS.kitchen_knife.damage!, 1, false, false))).toBe(3);
    expect(hits(meleeDamage(FISTS.damage!, 1, false, false))).toBe(10);
  });

  it("a bat swing on a downed zombie nearly kills it", () => {
    expect(meleeDamage(ITEMS.baseball_bat.damage!, 1, false, true)).toBeGreaterThanOrEqual(80);
  });

  it("a full stamina bar gives about 8 bat swings", () => {
    const swings = Math.floor(100 / ITEMS.baseball_bat.stamina!);
    expect(swings).toBeGreaterThanOrEqual(7);
    expect(swings).toBeLessThanOrEqual(9);
  });

  it("aiming tightens the pistol to under 0.5 degrees standing still", () => {
    expect(shotSpread(1, 0, 1)).toBeLessThan((0.5 * Math.PI) / 180);
    expect(shotSpread(0, 3, 1)).toBeGreaterThan(shotSpread(1, 0, 1) * 10);
  });

  it("a pistol body shot does about half a zombie", () => {
    expect(hits(ITEMS.pistol.damage!)).toBe(3);
  });
});

describe("barrier targets", () => {
  const blow = ZOMBIE.attackWindup + ZOMBIE.attackRecovery;
  const siege = (strength: number, zombies: number) => Math.ceil(strength / (BARRIER.zombieDamage * zombies)) * blow;

  it("strength order: hollow < glass door < latched < deadbolt < maglock < strike", () => {
    const s = [
      Math.min(DOOR.leaf.hollow, DOOR.hold.latch),
      Math.min(DOOR.leaf.glass, DOOR.hold.latch),
      Math.min(DOOR.leaf.solid, DOOR.hold.latch),
      Math.min(DOOR.leaf.solid, DOOR.hold.deadbolt),
      Math.min(DOOR.leaf.steel, DOOR.hold.maglock),
      Math.min(DOOR.leaf.steel, DOOR.hold.strike),
    ];
    for (let i = 1; i < s.length; i++) expect(s[i]).toBeGreaterThan(s[i - 1]);
  });

  it("one zombie bursts a latched door in 35-55 s; two take a deadbolted one in 55-80 s", () => {
    expect(siege(DOOR.hold.latch, 1)).toBeGreaterThanOrEqual(35);
    expect(siege(DOOR.hold.latch, 1)).toBeLessThanOrEqual(55);
    expect(siege(DOOR.hold.deadbolt, 2)).toBeGreaterThanOrEqual(55);
    expect(siege(DOOR.hold.deadbolt, 2)).toBeLessThanOrEqual(80);
  });

  it("a kick breaks a pane; a board outlasts a latch; steel shrugs off an axe", () => {
    expect(WINDOW.glassHp.pane).toBeLessThan(BARRIER.kickDamage);
    expect(BARRICADE.boardHp).toBeGreaterThanOrEqual(DOOR.hold.latch);
    const axeHits = Math.ceil(Math.min(DOOR.leaf.steel, DOOR.hold.strike) / (ITEMS.fire_axe.damage! * BARRIER.playerFactor.steel));
    expect(axeHits).toBeGreaterThan(300);
    expect(Math.ceil(DOOR.hold.latch / ITEMS.fire_axe.damage!)).toBe(5);
  });

  it("noise order: opening < climbing < glass tap < board tearing < wood blow < steel blow < hammering < glass breaking < a door bursting < a gunshot", () => {
    const n = BARRIER_NOISE;
    const order = [n.doorOpen, n.climb, n.glassHit, n.boardTear, n.woodHit, n.steelHit, n.hammer, n.glassBreak, n.burst, SENSES.gunshotRadius];
    for (let i = 1; i < order.length; i++) expect(order[i]).toBeGreaterThan(order[i - 1]);
    expect(n.hammer).toBeGreaterThanOrEqual(FOOTSTEPS.sprint);
  });

  it("nav costs stay small enough for the search budget", () => {
    expect(NAV_COST.max).toBeLessThanOrEqual(40);
    expect(NAV_COST.intactWindow).toBeGreaterThan(NAV_COST.closedDoor);
    expect(NAV_COST.brokenWindow).toBeLessThan(NAV_COST.closedDoor);
  });
});
