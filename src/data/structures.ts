import type { Stock } from './items';

export type StructId = 'wall' | 'barricade' | 'spikes' | 'tower' | 'gate';

export interface StructDef {
  label: string;
  icon: string;
  color: string;
  workSec: number; // per cell
  cost: Partial<Stock>; // per cell
  defense: number; // per cell, added to static defense (capped per site)
  spikes?: number; // per cell, removed from raid strength before the fight
  maxPerSite?: number;
  desc: string;
}

export const STRUCTS: Record<StructId, StructDef> = {
  wall: {
    label: 'Tường gạch/tôn',
    icon: '█',
    color: '#8a8a80',
    workSec: 1800,
    cost: { wood: 2, scrap: 2 },
    defense: 0.8,
    desc: 'Chặn đường zombie. Chắc nhưng tốn sắt.',
  },
  barricade: {
    label: 'Chướng ngại',
    icon: '▚',
    color: '#8a6a40',
    workSec: 600,
    cost: { wood: 1 },
    defense: 0.35,
    desc: 'Bàn ghế, xe hỏng, bao cát. Rẻ, dựng nhanh.',
  },
  spikes: {
    label: 'Bẫy chông',
    icon: '⋀',
    color: '#a05040',
    workSec: 900,
    cost: { wood: 1, scrap: 0.5 },
    defense: 0,
    spikes: 0.6,
    desc: 'Làm yếu đợt tập kích trước khi tới tường.',
  },
  gate: {
    label: 'Cổng',
    icon: '▥',
    color: '#b09060',
    workSec: 2400,
    cost: { wood: 4, scrap: 3 },
    defense: 0.6,
    maxPerSite: 6,
    desc: 'Lối ra vào chắc chắn, có khoá.',
  },
  tower: {
    label: 'Chòi gác',
    icon: '⌂',
    color: '#c06050',
    workSec: 3600,
    cost: { wood: 6, scrap: 2 },
    defense: 3,
    maxPerSite: 4,
    desc: 'Nhìn xa, phát hiện sớm. Tối đa 4 chòi mỗi điểm.',
  },
};

/** Limits that keep free building from becoming unlimited. */
export const DESIGN_LIMITS = {
  structFraction: 0.5, // at most half of open land can carry structures
  structDefenseCap: 60, // per site
  spikesCap: 25, // max raid strength removed by traps
  maxRoomIndoor: 150, // m²
  maxRoomOutdoor: 800, // m²
  /** Đất trống (ruộng) thì làm được vườn lớn hơn sân trong thành phố. */
  maxRoomField: 5000,
  partitionSecPerCell: 120,
  partitionWoodPerCell: 0.5,
};

export function structureEffects(structures: Record<number, StructId> | undefined): { defense: number; spikes: number; counts: Partial<Record<StructId, number>> } {
  let defense = 0;
  let spikes = 0;
  const counts: Partial<Record<StructId, number>> = {};
  for (const id of Object.values(structures ?? {})) {
    const d = STRUCTS[id];
    defense += d.defense;
    spikes += d.spikes ?? 0;
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return {
    defense: Math.min(DESIGN_LIMITS.structDefenseCap, defense),
    spikes: Math.min(DESIGN_LIMITS.spikesCap, spikes),
    counts,
  };
}
