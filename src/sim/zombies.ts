import { range, weighted, type Rng } from '../core/rng';
import { gridDistance } from 'h3-js';
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

/**
 * Loại zombie của một lần gặp — có tiến hoá theo vùng:
 * danger cao (đ đô đông dân) -> brute/bloater xuất hiện sớm và nhiều hơn;
 * ô từng bị người chơi dọn sạch -> thế hệ quay lại nghiêng về loại khoé.
 * (stalker vẫn chỉ ban đêm; trọng số w0->w1 theo ngày giữ nguyên.)
 */
export function zombieType(rng: Rng, day: number, night: boolean, danger = 2, cleared = 0): ZombieType {
  const k = Math.min(1, (day - 1) / 60);
  const evoDanger = 1 + 1.5 * Math.max(0, danger - 1);
  const evoBack = 1 + 0.5 * Math.max(0, Math.max(0, cleared));
  const boost = (z: ZombieType): number => {
    let w = ZOMBIES[z].w0 + (ZOMBIES[z].w1 - ZOMBIES[z].w0) * k;
    if (z === 'brute' || z === 'bloater') w *= Math.max(evoDanger, evoBack);
    if (z === 'runner') w *= evoBack;
    return w;
  };
  const items = (Object.keys(ZOMBIES) as ZombieType[])
    .filter((z) => z !== 'stalker' || night)
    .map((z) => [z, boost(z)] as const);
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

/** Kích thước một bầy mới: to dần theo ngày, theo danger của ô sinh. */
export function hordeSize(rng: Rng, day: number, danger: number): number {
  return Math.round((10 + 0.9 * day) * (0.8 + 0.2 * Math.max(1, danger)) * range(rng, 0.9, 1.1));
}

/**
 * Bầy trườn 1 ô về đích: chọn trong lân cận ô gần đích hơn,
 * có jitter nhỏ cho tự nhiên (vẫn deterministic qua rng).
 */
export function nextHordeCell(cell: string, target: string, candidates: string[], rng: Rng): string {
  let best = cell;
  let bestScore = Infinity;
  for (const c of candidates) {
    if (c === cell) continue;
    const score = gridDistance(c, target) + range(rng, 0, 0.6);
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}
