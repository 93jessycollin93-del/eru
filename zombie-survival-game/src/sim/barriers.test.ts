import { describe, expect, it } from "vitest";
import {
  addBoard,
  attackSlots,
  boardCost,
  breakGlass,
  canBoard,
  clearGlass,
  climbCut,
  closeDoor,
  colliderEnabled,
  coreStrength,
  createBarrierWorld,
  effectiveLocked,
  hitBarrier,
  integrityLabel,
  keypadEnter,
  lockCommand,
  navCost,
  occludes,
  openDoor,
  pushOpen,
  removeBoard,
  setLockPower,
  struckMaterial,
  tickBarrier,
  toggleBolt,
  vaultSeconds,
  zombieAccess,
  zombieClimbSeconds,
  type Barrier,
  type BarrierSeed,
} from "./barriers";
import { mulberry32 } from "./rng";
import { ACCESS, BARRICADE, BARRIER, BARRIER_START, NAV_COST } from "./tuning";

const SEEDS: Record<string, BarrierSeed> = {
  hollow: { kind: "door", build: "hollow", role: "interior", width: 1.0, sill: 0, pushSide: 1 },
  solid: { kind: "door", build: "solid", role: "house-front", width: 1.2, sill: 0, pushSide: 1 },
  glassDoor: { kind: "door", build: "glass", role: "shopfront", width: 2.0, sill: 0, pushSide: -1 },
  front: {
    kind: "door",
    build: "steel",
    role: "police-front",
    width: 2.0,
    sill: 0,
    pushSide: -1,
    electronic: { controller: "cpd-acs", name: "front", mode: "maglock", pin: null },
  },
  armory: {
    kind: "door",
    build: "steel",
    role: "armory",
    width: 1.0,
    sill: 0,
    pushSide: -1,
    electronic: { controller: "cpd-acs", name: "armory", mode: "strike", pin: "4821" },
  },
  pane: { kind: "window", build: "pane", role: "window", width: 1.3, sill: 1.0, pushSide: -1, house: true },
  display: { kind: "window", build: "display", role: "window", width: 4.5, sill: 0.5, pushSide: -1 },
};

/** A barrier in a known state: closed, latched, nothing broken. */
function make(name: keyof typeof SEEDS, patch: Partial<Barrier> = {}): Barrier {
  // createBarrierWorld with an rng that always rolls high gives the "closed and intact" case for every role.
  const b = createBarrierWorld([SEEDS[name]], () => 0.999).barriers[0];
  b.bolted = false;
  if (b.electronic) b.electronic.commanded = name === "front" ? "unlocked" : "locked";
  return Object.assign(b, patch);
}

const hitsToBreak = (b: Barrier, dmg: number, from: 1 | -1, until: (b: Barrier) => boolean) => {
  let n = 0;
  while (!until(b) && n < 10000) {
    hitBarrier(b, dmg, from);
    n++;
  }
  return n;
};

describe("strength", () => {
  it("is the weaker of the leaf and what holds it shut", () => {
    expect(coreStrength(make("hollow"), 1)).toBe(120);
    expect(coreStrength(make("solid"), 1)).toBe(300);
    expect(coreStrength(make("solid", { bolted: true }), 1)).toBe(900);
    expect(coreStrength(make("glassDoor"), 1)).toBe(260);
    expect(coreStrength(make("glassDoor", { bolted: true }), 1)).toBe(260);
    expect(coreStrength(make("armory"), 1)).toBe(2400);
    const front = make("front");
    front.electronic!.commanded = "locked";
    expect(coreStrength(front, 1)).toBe(1500);
  });

  it("bursts at exactly ceil(strength / zombie blow) hits", () => {
    const d = BARRIER.zombieDamage;
    const burst = (b: Barrier) => b.broken;
    expect(hitsToBreak(make("hollow"), d, 1, burst)).toBe(15);
    expect(hitsToBreak(make("solid"), d, 1, burst)).toBe(38);
    expect(hitsToBreak(make("solid", { bolted: true }), d, 1, burst)).toBe(113);
    expect(hitsToBreak(make("glassDoor"), d, 1, burst)).toBe(33);
    expect(hitsToBreak(make("armory"), d, 1, burst)).toBe(300);
  });

  it("a burst door is open for good, unbolted, and its glass is gone", () => {
    const b = make("glassDoor", { bolted: true });
    hitsToBreak(b, 50, 1, (x) => x.broken);
    expect(b).toMatchObject({ open: true, broken: true, bolted: false, glass: "broken" });
    expect(closeDoor(b)).toMatch(/hinges/);
    expect(zombieAccess(b, 1)).toBe("passable");
  });

  it("throwing the deadbolt mid-siege raises the threshold without undoing the damage", () => {
    const b = make("solid");
    for (let i = 0; i < 30; i++) hitBarrier(b, 8, 1);
    expect(b.broken).toBe(false);
    toggleBolt(b, -1);
    for (let i = 0; i < 70; i++) hitBarrier(b, 8, 1);
    expect(b.broken).toBe(false);
    expect(hitsToBreak(b, 8, 1, (x) => x.broken)).toBe(13); // 900 - 100*8 = 100 → 13 blows
  });
});

describe("board order", () => {
  it("boards on the striker's side are torn last-in first-out before the door is touched", () => {
    const b = make("solid");
    addBoard(b, 1);
    addBoard(b, 1);
    b.boards[0].hp = 299; // mark the first board
    const r = hitBarrier(b, 300, 1);
    expect(r).toMatchObject({ layer: "board", boardTorn: true });
    expect(b.boards).toHaveLength(1);
    expect(b.boards[0].hp).toBe(299);
    expect(b.damage).toBe(0);
    hitBarrier(b, 300, 1);
    expect(b.boards).toHaveLength(0);
    expect(b.damage).toBe(0);
    expect(hitBarrier(b, 8, 1).layer).toBe("door");
    expect(b.damage).toBe(8);
  });

  it("boards nailed inside are reached only after the door gives, and keep it blocking", () => {
    const b = make("solid");
    addBoard(b, -1);
    addBoard(b, -1);
    expect(hitBarrier(b, 8, 1).layer).toBe("door");
    hitsToBreak(b, 8, 1, (x) => x.broken);
    expect(b.boards).toHaveLength(2);
    expect(zombieAccess(b, 1)).toBe("blocking");
    expect(colliderEnabled(b)).toBe(true);
    expect(hitBarrier(b, 8, 1).layer).toBe("board");
    hitsToBreak(b, 8, 1, (x) => x.boards.length === 0);
    expect(zombieAccess(b, 1)).toBe("passable");
    expect(colliderEnabled(b)).toBe(false);
  });

  it("boards inside a window fall after the glass breaks: the shattering is your warning", () => {
    const b = make("pane");
    addBoard(b, -1);
    const first = hitBarrier(b, 8, 1);
    expect(first.layer).toBe("glass");
    hitsToBreak(b, 8, 1, (x) => x.glass === "broken");
    expect(hitBarrier(b, 8, 1).layer).toBe("board");
  });
});

describe("window glass", () => {
  it("a pane breaks on the third blow, then it can be climbed until boarded", () => {
    const b = make("pane");
    expect(zombieAccess(b, 1)).toBe("blocking");
    expect(hitBarrier(b, 8, 1).glassBroke).toBe(false);
    expect(hitBarrier(b, 8, 1).glassBroke).toBe(false);
    const r = hitBarrier(b, 8, 1);
    expect(r).toMatchObject({ layer: "glass", glassBroke: true, noise: 20 });
    expect(zombieAccess(b, 1)).toBe("climbable");
    expect(zombieAccess(b, -1)).toBe("climbable");
    addBoard(b, -1);
    expect(zombieAccess(b, 1)).toBe("blocking");
  });

  it("glass doesn't block sight; three boards do", () => {
    const b = make("pane");
    expect(occludes(b)).toBe(false);
    expect(colliderEnabled(b)).toBe(true);
    addBoard(b, -1);
    addBoard(b, -1);
    expect(occludes(b)).toBe(false);
    addBoard(b, -1);
    expect(occludes(b)).toBe(true);
  });

  it("climb times scale with the sill", () => {
    expect(vaultSeconds(make("pane"))).toBeCloseTo(2.0, 5);
    expect(vaultSeconds(make("display"))).toBeCloseTo(1.55, 5);
    expect(zombieClimbSeconds(make("pane"))).toBeCloseTo(3.0, 5);
    expect(zombieClimbSeconds(make("display"))).toBeCloseTo(2.3, 5);
  });
});

describe("pushable doors", () => {
  it("a released maglock door swings open from its push side and holds at latch strength from the other", () => {
    const b = make("front");
    expect(effectiveLocked(b)).toBe(false);
    expect(zombieAccess(b, -1)).toBe("pushable");
    expect(zombieAccess(b, 1)).toBe("blocking");
    expect(coreStrength(b, 1)).toBe(300);
    expect(pushOpen(b, 1)).toBe(false);
    expect(pushOpen(b, -1)).toBe(true);
    expect(b.open).toBe(true);
    expect(navCost(make("front"))).toBe(NAV_COST.pushDoor);
  });

  it("a blow from the push side just swings it open instead of bursting it", () => {
    const b = make("front");
    const r = hitBarrier(b, 8, -1);
    expect(r).toMatchObject({ opened: true, burst: false });
    expect(b.broken).toBe(false);
  });

  it("latched doors are never pushable", () => {
    for (const n of ["hollow", "solid", "glassDoor", "armory"] as const) {
      expect(zombieAccess(make(n), 1)).toBe("blocking");
      expect(zombieAccess(make(n), -1)).toBe("blocking");
    }
  });
});

describe("electronic locks", () => {
  it("maglocks fail safe and strikes fail secure", () => {
    for (const mode of ["maglock", "strike"] as const) {
      for (const powered of [true, false]) {
        for (const commanded of ["locked", "unlocked"] as const) {
          for (const pulse of [0, 3]) {
            const b = make(mode === "maglock" ? "front" : "armory");
            Object.assign(b.electronic!, { powered, commanded, pulseLeft: pulse });
            const expected = powered ? commanded === "locked" && pulse === 0 : mode === "strike";
            expect(effectiveLocked(b), `${mode} powered=${powered} ${commanded} pulse=${pulse}`).toBe(expected);
          }
        }
      }
    }
  });

  it("reports locks letting go and biting as power comes and goes", () => {
    const front = make("front");
    lockCommand(front, "lock");
    expect(setLockPower(front, false)).toBe("released");
    expect(setLockPower(front, false)).toBe(null);
    expect(setLockPower(front, true)).toBe("engaged");

    const armory = make("armory");
    expect(setLockPower(armory, false)).toBe(null); // stays locked
    lockCommand(armory, "unlock");
    expect(setLockPower(armory, true)).toBe(null);
    expect(lockCommand(armory, "unlock")).toBe("unlocked");
    expect(setLockPower(armory, false)).toBe("engaged");
  });

  it("restores the last commanded state when power returns", () => {
    const front = make("front");
    lockCommand(front, "lock");
    setLockPower(front, false);
    expect(effectiveLocked(front)).toBe(false);
    setLockPower(front, true);
    expect(effectiveLocked(front)).toBe(true);
  });

  it("the secure side always gets out", () => {
    for (const n of ["front", "armory"] as const) {
      for (const powered of [true, false]) {
        const b = make(n);
        lockCommand(b, "lock");
        setLockPower(b, powered);
        expect(openDoor(b, -1)).toBe(null);
        expect(b.open).toBe(true);
      }
    }
  });

  it("locked doors refuse from outside", () => {
    const b = make("armory");
    expect(openDoor(b, 1)).toBe("Locked.");
    lockCommand(b, "pulse");
    expect(openDoor(b, 1)).toBe(null);
  });

  it("an open door commanded locked locks once closed", () => {
    const b = make("front");
    openDoor(b, 1);
    expect(lockCommand(b, "lock")).toBe("will lock when closed");
    closeDoor(b);
    expect(effectiveLocked(b)).toBe(true);
    expect(openDoor(b, 1)).toBe("Locked.");
  });

  it("an unpowered controller takes no commands", () => {
    const b = make("armory");
    setLockPower(b, false);
    expect(lockCommand(b, "unlock")).toBe("no response");
    expect(b.electronic!.commanded).toBe("locked");
  });
});

describe("keypad", () => {
  it("a good code releases the strike for six seconds", () => {
    const b = make("armory");
    expect(keypadEnter(b, "4821")).toBe("granted");
    expect(effectiveLocked(b)).toBe(false);
    expect(tickBarrier(b, ACCESS.pulseSeconds - 0.1)).toBe(false);
    expect(effectiveLocked(b)).toBe(false);
    expect(tickBarrier(b, 0.2)).toBe(true);
    expect(effectiveLocked(b)).toBe(true);
  });

  it("five wrong codes lock it out for a minute", () => {
    const b = make("armory");
    for (let i = 0; i < ACCESS.keypadMaxTries - 1; i++) expect(keypadEnter(b, "0000")).toBe("denied");
    expect(keypadEnter(b, "0000")).toBe("lockout");
    expect(keypadEnter(b, "4821")).toBe("lockout");
    tickBarrier(b, ACCESS.keypadLockoutSec + 0.1);
    expect(keypadEnter(b, "4821")).toBe("granted");
  });

  it("is dark without power, and a dead strike forgets its pulse", () => {
    const b = make("armory");
    keypadEnter(b, "4821");
    setLockPower(b, false);
    expect(effectiveLocked(b)).toBe(true);
    expect(keypadEnter(b, "4821")).toBe("dark");
  });

  it("a door with no reader never grants", () => {
    const b = make("front");
    expect(keypadEnter(b, "")).toBe("denied");
  });
});

describe("door actions", () => {
  it("deadbolts: thumbturn side only, solid and glass doors only, closed only", () => {
    expect(toggleBolt(make("solid"), 1)).toMatch(/key/);
    expect(toggleBolt(make("hollow"), -1)).toMatch(/no deadbolt/);
    expect(toggleBolt(make("armory"), -1)).toMatch(/no deadbolt/);
    expect(toggleBolt(make("solid", { open: true }), -1)).toMatch(/Close/);
    expect(toggleBolt(make("solid", { broken: true, open: true }), -1)).toMatch(/hinges/);
    const b = make("glassDoor");
    expect(toggleBolt(b, -1)).toBe(null);
    expect(b.bolted).toBe(true);
    expect(toggleBolt(b, -1)).toBe(null);
    expect(b.bolted).toBe(false);
  });

  it("a bolted door won't open from outside, and opens from inside in one go", () => {
    const b = make("solid", { bolted: true });
    expect(openDoor(b, 1)).toBe("Locked.");
    expect(openDoor(b, -1)).toBe(null);
    expect(b).toMatchObject({ open: true, bolted: false });
  });

  it("boarded and broken doors don't open", () => {
    const b = make("solid");
    addBoard(b, -1);
    expect(openDoor(b, -1)).toMatch(/boarded/);
    expect(openDoor(make("solid", { broken: true, open: true }), 1)).toMatch(/hinges/);
  });

  it("colliders and sight follow the leaf", () => {
    const b = make("solid");
    expect(colliderEnabled(b)).toBe(true);
    expect(occludes(b)).toBe(true);
    openDoor(b, 1);
    expect(colliderEnabled(b)).toBe(false);
    expect(occludes(b)).toBe(false);
    expect(occludes(make("glassDoor"))).toBe(false);
  });

  it("what a blow lands on", () => {
    expect(struckMaterial(make("armory"), 1)).toBe("steel");
    expect(struckMaterial(make("glassDoor"), 1)).toBe("glass");
    expect(struckMaterial(make("pane"), 1)).toBe("glass");
    const b = make("armory");
    addBoard(b, 1);
    expect(struckMaterial(b, 1)).toBe("wood");
    expect(struckMaterial(b, -1)).toBe("steel");
    expect(struckMaterial(make("solid", { open: true }), 1)).toBe(null);
  });

  it("attack slots follow the width", () => {
    expect(attackSlots(make("hollow"))).toBe(1);
    expect(attackSlots(make("solid"))).toBe(2);
    expect(attackSlots(make("glassDoor"))).toBe(3);
    expect(attackSlots(make("display"))).toBe(3);
  });
});

describe("cuts", () => {
  it("climbing over shards cuts about 40% of the time; cleared or intact glass never", () => {
    const rng = mulberry32(99);
    const b = make("pane", { glass: "broken" });
    let cuts = 0;
    let arms = 0;
    for (let i = 0; i < 1000; i++) {
      const part = climbCut(b, rng);
      if (part) {
        cuts++;
        if (part.endsWith("Arm")) arms++;
      }
    }
    expect(cuts / 1000).toBeGreaterThan(0.36);
    expect(cuts / 1000).toBeLessThan(0.44);
    expect(arms / cuts).toBeGreaterThan(0.6);
    expect(arms / cuts).toBeLessThan(0.8);
    for (let i = 0; i < 200; i++) {
      expect(climbCut(make("pane"), rng)).toBe(null);
      expect(climbCut(make("pane", { glass: "cleared" }), rng)).toBe(null);
    }
  });

  it("break then clear", () => {
    const b = make("pane");
    expect(clearGlass(b)).toBe(false);
    expect(breakGlass(b)).toBe(true);
    expect(breakGlass(b)).toBe(false);
    expect(clearGlass(b)).toBe(true);
    expect(b.glass).toBe("cleared");
  });
});

describe("boards", () => {
  it("costs: a full barricade is display 6/24/48 s, window 3/12/24 s, door 4/16/32 s", () => {
    const full = (n: keyof typeof SEEDS) => {
      const b = make(n);
      const c = boardCost(b);
      const k = BARRICADE.maxBoards[b.kind];
      return [c.planks * k, c.nails * k, c.seconds * k];
    };
    expect(full("display")).toEqual([6, 24, 48]);
    expect(full("pane")).toEqual([3, 12, 24]);
    expect(full("solid")).toEqual([4, 16, 32]);
  });

  it("are capped, stay on one side, and come off only from that side", () => {
    const b = make("pane");
    expect(addBoard(b, -1)).toBe(true);
    expect(canBoard(b, 1)).toMatch(/other side/);
    expect(addBoard(b, 1)).toBe(false);
    addBoard(b, -1);
    addBoard(b, -1);
    expect(canBoard(b, -1)).toMatch(/more boards/);
    expect(removeBoard(b, 1)).toBe(null);
    expect(removeBoard(b, -1)).toEqual({ planks: 1 });
    expect(b.boards).toHaveLength(2);
    expect(removeBoard(make("display", { boards: [{ hp: 300 }], boardSide: 1 }), 1)).toEqual({ planks: 2 });
  });

  it("an open door can't be boarded, a smashed one can", () => {
    expect(canBoard(make("solid", { open: true }), -1)).toMatch(/Close/);
    const b = make("solid", { open: true, broken: true });
    expect(canBoard(b, -1)).toBe(null);
    addBoard(b, -1);
    expect(colliderEnabled(b)).toBe(true);
    expect(zombieAccess(b, 1)).toBe("blocking");
  });

  it("integrity reads Holding, Cracked, Splintering", () => {
    const b = make("solid");
    expect(integrityLabel(b)).toBe("Holding");
    b.damage = 150;
    expect(integrityLabel(b)).toBe("Cracked");
    b.damage = 250;
    expect(integrityLabel(b)).toBe("Splintering");
  });
});

describe("nav cost", () => {
  it("follows the table and is capped", () => {
    expect(navCost(make("solid"))).toBe(NAV_COST.closedDoor);
    expect(navCost(make("solid", { open: true }))).toBe(0);
    expect(navCost(make("solid", { open: true, broken: true }))).toBe(0);
    expect(navCost(make("pane"))).toBe(NAV_COST.intactWindow);
    expect(navCost(make("pane", { glass: "broken" }))).toBe(NAV_COST.brokenWindow);
    const b = make("solid");
    addBoard(b, -1);
    addBoard(b, -1);
    expect(navCost(b)).toBe(NAV_COST.closedDoor + 2 * NAV_COST.perBoard);
    const w = make("pane");
    for (let i = 0; i < 3; i++) addBoard(w, -1);
    expect(navCost(w)).toBe(Math.min(NAV_COST.max, NAV_COST.intactWindow + 3 * NAV_COST.perBoard));
    expect(navCost(w)).toBeLessThanOrEqual(40);
  });
});

describe("createBarrierWorld", () => {
  it("start states match their frequencies", () => {
    const seeds = [SEEDS.solid, SEEDS.hollow, SEEDS.glassDoor, SEEDS.pane, SEEDS.display];
    const n = 10000;
    const rng = mulberry32(5);
    const c = { hOpen: 0, hBolt: 0, iOpen: 0, sBroken: 0, sBolt: 0, pBroken: 0, dBroken: 0, preBoarded: 0 };
    for (let i = 0; i < n; i++) {
      const [h, int, shop, pane, disp] = createBarrierWorld(seeds, rng).barriers;
      if (h.open) c.hOpen++;
      if (h.bolted) c.hBolt++;
      if (int.open) c.iOpen++;
      if (shop.broken) c.sBroken++;
      if (shop.bolted) c.sBolt++;
      if (pane.glass === "broken") c.pBroken++;
      if (disp.glass === "broken") c.dBroken++;
      if (pane.boards.length) c.preBoarded++;
      expect(disp.boards).toHaveLength(0); // shop windows are never pre-boarded
    }
    const near = (count: number, p: number) => expect(Math.abs(count / n - p)).toBeLessThan(0.05 * Math.max(p, 0.2));
    near(c.hOpen, BARRIER_START.houseFront.open);
    near(c.hBolt, BARRIER_START.houseFront.bolted);
    near(c.iOpen, BARRIER_START.interior.open);
    near(c.sBroken, BARRIER_START.shopfront.broken);
    near(c.sBolt, BARRIER_START.shopfront.bolted);
    near(c.pBroken, BARRIER_START.windowBroken.pane);
    near(c.dBroken, BARRIER_START.windowBroken.display);
    near(c.preBoarded, BARRIER_START.houseWindowPreBoarded);
  });

  it("the police front starts unlocked and the armory locked", () => {
    const [front, armory] = createBarrierWorld([SEEDS.front, SEEDS.armory], mulberry32(1)).barriers;
    expect(effectiveLocked(front)).toBe(false);
    expect(front.latch).toBe(false);
    expect(front.open).toBe(false);
    expect(effectiveLocked(armory)).toBe(true);
    expect(armory.latch).toBe(true);
    expect(armory.electronic!.pin).toBe("4821");
  });

  it("ids are indices, and the same seed gives the same world", () => {
    const seeds = Object.values(SEEDS);
    const a = createBarrierWorld(seeds, mulberry32(42));
    const b = createBarrierWorld(seeds, mulberry32(42));
    expect(a.barriers.map((x) => x.id)).toEqual(seeds.map((_, i) => i));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("serialisation", () => {
  it("round-trips through JSON after a scripted sequence", () => {
    const world = createBarrierWorld(Object.values(SEEDS), mulberry32(3));
    const [hollow, solid, glassDoor, front, armory, pane, display] = world.barriers;
    openDoor(hollow, 1);
    closeDoor(hollow);
    hitBarrier(solid, 50, 1);
    addBoard(solid, -1);
    hitBarrier(glassDoor, 500, 1);
    lockCommand(front, "lock");
    setLockPower(front, false);
    keypadEnter(armory, "1111");
    breakGlass(pane);
    addBoard(display, 1);
    hitBarrier(display, 10, 1);
    const copy = JSON.parse(JSON.stringify(world));
    expect(copy).toEqual(world);
  });
});
