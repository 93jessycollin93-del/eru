/**
 * Who a zombie is, as far as the rules care: how tall (hit volumes scale with
 * it), how fast it shambles and chases, and whether it's a runner. A pure
 * function of the zombie's seed, so a saved zombie comes back the same.
 * What it looks like is in appearance.ts, on separate streams.
 */
import { mulberry32, range } from "./rng";
import { ZOMBIE } from "./tuning";

export interface ZombieTraits {
  height: number;
  walkSpeed: number;
  chaseSpeed: number;
  runner: boolean;
}

export function rollZombieTraits(seed: number): ZombieTraits {
  const rng = mulberry32(seed);
  // The first builds rolled the zombie's look from this stream before its
  // speeds. Those draws stay, so every seed keeps its height, speeds and
  // runner flag, and zombies in older saves come back identical.
  for (let i = 0; i < 7; i++) rng(); // build, skin, shirt, pants, hair colour, sex, sleeve
  if (rng() >= 0.15) rng(); // hair amount: a second draw unless bald
  rng(); // grime
  rng(); // blood
  const height = range(rng, ...ZOMBIE.height);
  const walkSpeed = range(rng, ...ZOMBIE.wanderSpeed);
  const runner = rng() < ZOMBIE.runnerChance;
  const chaseSpeed = runner ? range(rng, ...ZOMBIE.runnerSpeed) : range(rng, ...ZOMBIE.chaseSpeed);
  return { height, walkSpeed, chaseSpeed, runner };
}
