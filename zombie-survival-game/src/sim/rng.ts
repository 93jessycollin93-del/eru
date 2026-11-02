/** A seeded random stream whose position can be saved and restored. */
export interface SeededRng {
  (): number;
  /** Where the stream is; feed it to setState to continue the exact same sequence (saves). */
  state(): number;
  setState(state: number): void;
}

/** Small seeded PRNG so the same seed always builds the same world. */
export function mulberry32(seed: number): SeededRng {
  let a = seed >>> 0;
  const next = (() => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }) as SeededRng;
  next.state = () => a;
  next.setState = (s: number) => {
    a = s >>> 0;
  };
  return next;
}

export const range = (rng: () => number, min: number, max: number) => min + rng() * (max - min);
export const pick = <T,>(rng: () => number, list: readonly T[]): T => list[Math.floor(rng() * list.length)];

/**
 * A new seed from a seed and a salt (murmur3 finaliser), so one seed can feed
 * several independent streams: changing what one stream draws never shifts
 * another. Plain uint32 maths, so it ports to C++ as is.
 */
export function deriveSeed(seed: number, salt: number): number {
  let h = (seed ^ Math.imul(salt, 0x9e3779b9)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
