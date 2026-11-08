// Seeded, serializable RNG (mulberry32) so a save + seed replays deterministically.
export interface Rng {
  state: number;
}

export function makeRng(seed: number): Rng {
  return { state: seed >>> 0 || 1 };
}

export function next(r: Rng): number {
  let t = (r.state = (r.state + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const range = (r: Rng, a: number, b: number) => a + next(r) * (b - a);
export const int = (r: Rng, a: number, b: number) => Math.floor(range(r, a, b + 1));
export const chance = (r: Rng, p: number) => next(r) < p;

export function pick<T>(r: Rng, arr: readonly T[]): T {
  return arr[Math.floor(next(r) * arr.length)];
}

export function weighted<T>(r: Rng, items: readonly (readonly [T, number])[]): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let x = next(r) * total;
  for (const [v, w] of items) {
    x -= w;
    if (x <= 0) return v;
  }
  return items[items.length - 1][0];
}

/** Time until next Poisson event; Infinity when rate is 0. */
export function expSample(r: Rng, ratePerSec: number): number {
  if (ratePerSec <= 0) return Infinity;
  return -Math.log(1 - next(r)) / ratePerSec;
}

export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
