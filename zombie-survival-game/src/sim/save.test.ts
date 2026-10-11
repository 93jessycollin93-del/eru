import { describe, expect, it } from "vitest";
import { createBarrierWorld } from "./barriers";
import { createBody } from "./body";
import { createComputerState, restoreComputer, saveComputer, submit, type ComputerContext } from "./computer";
import { policeComputer, type TownFacts } from "./computerContent";
import { makeStack } from "./items";
import { mulberry32 } from "./rng";
import { SAVE_VERSION, SaveError, deserialise, migrate, serialise, townFingerprint, validate, type SaveData } from "./save";

const SEED = 1987;

function sample(): SaveData {
  const meta = { version: SAVE_VERSION, worldSeed: SEED, savedAt: "2026-10-10T12:00:00.000Z", day: 2, timeOfDay: 600, location: "52 Main Street · House", survivedMinutes: 2000, kills: 3, health: 88 };
  return {
    version: SAVE_VERSION,
    worldSeed: SEED,
    meta,
    minutes: 2000,
    rng: { game: 123456 },
    player: { pos: [1, 0, 2], yaw: 0.5, pitch: -0.1, bodyYaw: 0.4, crouching: true, body: createBody(), inventory: [makeStack("hammer"), makeStack("nails", 12)], equippedUid: null, flashlight: false },
    kills: 3,
    respawnTimer: 12,
    nextUid: 99,
    zombies: [
      { seed: 42, pos: [5, 0, 5], yaw: 1, state: "chase", hp: 60, awareness: 1.2, target: [1, 0, 2], stateTimer: 3, lastSeen: 0.4, deadTime: 0, downTimer: 0, breach: 20, clamber: null },
    ],
    containers: [{ id: 3, items: [makeStack("water_bottle")] }, { id: 9, items: null, fuel: 1.5 }],
    ground: [{ id: 100002, pos: [3, 0.1, 4], items: [makeStack("plank", 2)] }],
    computers: [],
    power: { world: { gridFailsAt: 4680, circuits: {}, generators: [] }, portables: [], nextGenId: 3 },
    barriers: createBarrierWorld(
      [{ kind: "door", build: "solid", role: "house-front", width: 1.2, sill: 0, pushSide: 1 }],
      mulberry32(1),
    ),
  };
}

describe("save file", () => {
  it("round-trips: serialise → deserialise → serialise is identical", () => {
    const d = sample();
    const text = serialise(d);
    const back = deserialise(text, SEED);
    expect(back).toEqual(JSON.parse(text));
    expect(serialise(back)).toBe(text);
  });

  it("refuses another world's save, a newer version and junk, with messages a player can act on", () => {
    const d = sample();
    expect(() => deserialise(serialise(d), 7)).toThrow(/different world/);
    expect(() => migrate({ ...d, version: SAVE_VERSION + 1 })).toThrow(/newer version/);
    expect(() => deserialise("{not json", SEED)).toThrow(SaveError);
    expect(() => deserialise("[]", SEED)).toThrow(/isn't a save/);
  });

  it("names the damaged part", () => {
    const broken = (patch: (d: Record<string, unknown>) => void) => {
      const d = JSON.parse(serialise(sample()));
      patch(d);
      return () => validate(d, SEED);
    };
    expect(broken((d) => delete d.minutes)).toThrow(/clock/);
    expect(broken((d) => ((d.player as Record<string, unknown>).pos = [1, 2]))).toThrow(/player/);
    expect(broken((d) => ((d.player as { body: Record<string, unknown> }).body.blood = "lots"))).toThrow(/body/);
    expect(broken((d) => ((d.zombies as unknown[])[0] = { seed: "x" }))).toThrow(/zombie/);
    expect(broken((d) => ((d.power as Record<string, unknown>).world = {}))).toThrow(/power/);
    expect(broken((d) => (d.barriers = {}))).toThrow(/doors and windows/);
    expect(broken((d) => ((d.barriers as { barriers: unknown[] }).barriers[0] = undefined))).toThrow(/doors and windows/);
  });

  it("refuses a save made on a different town (a game update moved doors or boxes)", () => {
    const town = townFingerprint(["door:solid:house-front", "3:kitchen"]);
    expect(town).toMatch(/^[0-9a-f]{8}$/);
    expect(townFingerprint(["door:solid:house-front", "3:kitchen"])).toBe(town);
    expect(townFingerprint(["door:solid:house-front", "3:bedroom"])).not.toBe(town);
    expect(townFingerprint(["ab", "c"])).not.toBe(townFingerprint(["a", "bc"]));
    const d = { ...sample(), town };
    expect(deserialise(serialise(d), SEED, town).town).toBe(town);
    expect(() => deserialise(serialise(d), SEED, "00000000")).toThrow(/town changed/);
    // The earliest saves carry no fingerprint: they load.
    expect(() => deserialise(serialise(sample()), SEED, town)).not.toThrow();
  });
});

describe("shell sessions", () => {
  const facts: TownFacts = { policeAddress: "1 Main Street", stashAddress: "2 Oak Avenue", powerOffDay: 4 };
  const g = policeComputer(facts, mulberry32(7));
  const ctx = (nowMs: number): ComputerContext => ({ nowMs, dateText: "Fri Oct 23 07:42", uptimeMinutes: 10 });

  it("a logged-in session comes back where it was, minus the machine definition", () => {
    const s = createComputerState(g.def, null);
    s.phase = "login";
    submit(s, g.def.users[0].name, ctx(0));
    submit(s, g.def.users[0].password!, ctx(0));
    submit(s, "cd reports", ctx(0));
    const saved = JSON.parse(JSON.stringify(saveComputer(s, 0)));
    expect(saved.def).toBeUndefined();
    const back = restoreComputer(g.def, saved, 0, () => undefined);
    expect(back.phase).toBe("shell");
    expect(back.user).toBe(s.user);
    expect(back.cwd).toBe(s.cwd);
    expect(back.screen).toEqual(s.screen);
    expect(back.history).toEqual(s.history);
  });

  it("a login lockout is kept as time left, since real time restarts with the page", () => {
    const s = createComputerState(g.def, null);
    s.lockedUntil = 50_000;
    const saved = saveComputer(s, 30_000);
    expect(saved.lockedForMs).toBe(20_000);
    const back = restoreComputer(g.def, saved, 1_000, () => undefined);
    expect(back.lockedUntil).toBe(21_000);
  });

  it("an open ssh session is rebuilt on the remote machine, or dropped if it's gone", () => {
    const s = createComputerState(g.def, null);
    const remote = createComputerState(g.def, null);
    remote.remoteHost = "cpd-files";
    remote.phase = "shell";
    remote.user = "dispatch";
    s.remote = remote;
    s.phase = "shell";
    const saved = saveComputer(s, 0);
    const kept = restoreComputer(g.def, saved, 0, (h) => (h === "cpd-files" ? g.def : undefined));
    expect(kept.remote?.remoteHost).toBe("cpd-files");
    expect(kept.remote?.user).toBe("dispatch");
    const dropped = restoreComputer(g.def, saved, 0, () => undefined);
    expect(dropped.remote).toBe(null);
  });
});
