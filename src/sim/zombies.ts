import { range, weighted, type Rng } from '../core/rng';
import type { World } from '../world/types';
import { ZOMBIES, type ZombieType } from './data';
import type { GameState } from './types';

/** Cell danger after patrols: a fully cleared cell keeps 40% (stragglers wander back in). */
export const effectiveDanger = (s: GameState, world: World, cell: string) =>
  (world.cells[cell]?.danger ?? 2) * (1 - 0.6 * (s.cellClear[cell] ?? 0));

/** Zombie density over time: grows as the infected spread, slowly falls as bodies rot. */
export function densityMult(day: number, horde: boolean, tempC = 28): number {
  const spread = 1 + 1.6 * (1 - Math.exp(-day / 25));
  const rot = Math.max(0.55, 1 - Math.max(0, day - 60) / 400);
  const heat = tempC >= 32 ? 0.92 : 1; // tropical heat rots them faster
  return spread * rot * heat * (horde ? 2 : 1);
}

/** Unsearched containers still decay (weather, other survivors) — endless-mode tuned. */
export const lootFactor = (day: number) => Math.max(0.2, 1 - 0.012 * (day - 1));

export function zombieType(rng: Rng, day: number, night: boolean): ZombieType {
  const k = Math.min(1, (day - 1) / 60);
  const items = (Object.keys(ZOMBIES) as ZombieType[])
    .filter((z) => z !== 'stalker' || night)
    .map((z) => [z, ZOMBIES[z].w0 + (ZOMBIES[z].w1 - ZOMBIES[z].w0) * k] as const);
  return weighted(rng, items);
}

export function meanBite(day: number): number {
  const k = Math.min(1, (day - 1) / 60);
  let w = 0;
  let b = 0;
  for (const z of Object.values(ZOMBIES)) {
    const wt = z.w0 + (z.w1 - z.w0) * k;
    w += wt;
    b += wt * z.bite;
  }
  return b / w;
}

/** Encounter rate per minute outside (design doc §7.1, plus group size and mode). */
export function encounterRate(opts: {
  danger: number;
  density: number;
  heat: number;
  night: boolean;
  members: number;
  mode: 'walk' | 'sneak' | 'car';
  travelling: boolean;
}): number {
  const { danger, density, heat, night, members, mode, travelling } = opts;
  let r = 0.008 * danger * density * (1 + heat / 100) * (night ? 1.8 : 1) * (1 + 0.12 * (members - 1));
  if (mode === 'sneak') r *= 0.55;
  if (mode === 'car' && travelling) r *= 0.25;
  return r;
}

export function poisson(rng: Rng, mean: number): number {
  if (mean <= 0) return 0;
  if (mean > 30) return Math.max(0, Math.round(mean + Math.sqrt(mean) * (range(rng, -1, 1) + range(rng, -1, 1))));
  const L = Math.exp(-mean);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= range(rng, 0, 1);
  } while (p > L);
  return k - 1;
}
