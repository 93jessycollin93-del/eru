import { describe, expect, it } from "vitest";
import { mulberry32, pick, range } from "./rng";
import { ZOMBIE } from "./tuning";
import { rollZombieTraits } from "./zombies";

/** The Zombie constructor's draws before the character pass, copied verbatim (palette contents don't matter, only their lengths). */
function legacyTraits(seed: number) {
  const rng = mulberry32(seed);
  const SKINS = [0, 0, 0, 0, 0, 0];
  const HAIR = [0, 0, 0, 0, 0, 0];
  const SHIRTS = [0, 0, 0, 0, 0, 0, 0, 0];
  const PANTS = [0, 0, 0, 0, 0];
  rng(); // r (build)
  pick(rng, SKINS);
  pick(rng, SHIRTS);
  pick(rng, PANTS);
  pick(rng, HAIR);
  void (rng() < 0.42); // sex
  pick(rng, [0.3, 0.5, 0.95, 1]); // sleeve
  void (rng() < 0.15 ? 0 : 0.5 + rng() * 0.5); // hair amount
  void (0.6 + rng() * 0.4); // grime
  void (0.35 + rng() * 0.65); // blood
  const height = 0.93 + rng() * 0.12;
  const walkSpeed = range(rng, ...ZOMBIE.wanderSpeed);
  const runner = rng() < ZOMBIE.runnerChance;
  const chaseSpeed = runner ? range(rng, ...ZOMBIE.runnerSpeed) : range(rng, ...ZOMBIE.chaseSpeed);
  return { height, walkSpeed, chaseSpeed, runner };
}

describe("rollZombieTraits", () => {
  it("gives every seed the height, speeds and runner flag it had before (old saves stay identical)", () => {
    for (let seed = 0; seed < 2000; seed++) expect(rollZombieTraits(seed)).toEqual(legacyTraits(seed));
    for (const seed of [4294967295, 2654435769, 123456789]) expect(rollZombieTraits(seed)).toEqual(legacyTraits(seed));
  });

  it("about one in eight is a runner", () => {
    let runners = 0;
    for (let seed = 0; seed < 20000; seed++) if (rollZombieTraits(seed * 7919).runner) runners++;
    expect(runners / 20000).toBeCloseTo(ZOMBIE.runnerChance, 2);
  });
});
