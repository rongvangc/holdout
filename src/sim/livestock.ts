import type { Green, WaterPoint, World } from '../world/types';
import type { Site } from './types';

/**
 * Gia súc/gia cầm theo vùng.
 *
 * Cùng một "chuồng" nhưng ở đồng bằng sông nước là vịt, trong phố là gà, trên đất
 * ruộng lớn là bò/trâu, vùng đồi là dê. Loài quyết định sản phẩm: gà/vịt cho trứng,
 * dê/bò cho sữa, lợn/bò cho thịt.
 */
export type HerdKind = 'ga' | 'vit' | 'de' | 'lon' | 'bo' | 'trau';

export type HerdModule = 'coop' | 'barn';

export interface HerdDef {
  label: string;
  module: HerdModule;
  /** Trứng/ngày cho mỗi chuồng (chỉ gia cầm). */
  eggs: number;
  /** Sữa/ngày cho mỗi trại. */
  milk: number;
  /** Thịt mỗi lần mổ. */
  meat: number;
  /** Xác suất mổ mỗi ngày. */
  slaughter: number;
  /** Cám/ngày mỗi đơn vị (bầy hoặc chuồng). */
  feed: number;
  /** Nước/ngày. */
  water: number;
  /** Ồn mỗi ngày. */
  heat: number;
  desc: string;
}

export const HERDS: Record<HerdKind, HerdDef> = {
  ga: {
    label: 'Gà',
    module: 'coop',
    eggs: 4.2,
    milk: 0,
    meat: 1.1,
    slaughter: 0.03,
    feed: 0.5,
    water: 6,
    heat: 0.6,
    desc: 'Dễ nuôi trong phố, ăn tạp. Trứng hằng ngày.',
  },
  vit: {
    label: 'Vịt',
    module: 'coop',
    eggs: 5.4,
    milk: 0,
    meat: 1.6,
    slaughter: 0.035,
    feed: 0.6,
    water: 22,
    heat: 0.9,
    desc: 'Cần nước (sông/hồ gần). Trứng nhiều hơn gà, thịt béo hơn.',
  },
  de: {
    label: 'Dê',
    module: 'barn',
    eggs: 0,
    milk: 3.2,
    meat: 1.4,
    slaughter: 0.02,
    feed: 0.15,
    water: 18,
    heat: 0.8,
    desc: 'Sống bằng cỏ, chịu khô hạn. Sữa mỗi ngày.',
  },
  lon: {
    label: 'Lợn',
    module: 'barn',
    eggs: 0,
    milk: 0.4,
    meat: 2.6,
    slaughter: 0.045,
    feed: 1.8,
    water: 28,
    heat: 1.2,
    desc: 'Ăn cám nhiều nhưng thịt nhiều. Không có sữa đáng kể.',
  },
  bo: {
    label: 'Bò',
    module: 'barn',
    eggs: 0,
    milk: 4.6,
    meat: 3.2,
    slaughter: 0.015,
    feed: 2.2,
    water: 34,
    heat: 1,
    desc: 'Đồng bằng, bãi rộng. Sữa nhiều nhất, thịt nhiều.',
  },
  trau: {
    label: 'Trâu',
    module: 'barn',
    eggs: 0,
    milk: 2.6,
    meat: 4.0,
    slaughter: 0.012,
    feed: 2.4,
    water: 40,
    heat: 1.1,
    desc: 'Ruộng nước, vùng trũng phía Bắc. Kéo cày giỏi, thịt nhiều.',
  },
};

const nearWater = (world: World, site: Site, metres = 400): boolean => {
  const [x, y] = site.centroid;
  return world.waterPoints.some((w: WaterPoint) => Math.hypot(w.pos[0] - x, w.pos[1] - y) <= metres);
};

const farmlandNearby = (world: World, site: Site, metres = 1200): number => {
  const [x, y] = site.centroid;
  return world.greens.reduce((sum, g: Green) => {
    const d = Math.hypot(g.centroid[0] - x, g.centroid[1] - y);
    return d <= metres ? sum + g.area : sum;
  }, 0);
};

/** Latitude decides north/south stock: buffalo in the northern lowlands, cattle south. */
const northern = (world: World): boolean => (world.center?.[0] ?? 16) > 16;

/**
 * Which poultry and which large stock this patch of map actually supports.
 * Everything is a function of local data (water, farmland, latitude), so two
 * bases on the same map can raise different animals.
 */
export function localHerds(world: World, site: Site): { coop: HerdKind; barn: HerdKind } {
  const water = nearWater(world, site);
  const farmland = farmlandNearby(world, site);
  const open = farmland > 20_000; // 2 ha of fields/park within walking distance
  const coop: HerdKind = water ? 'vit' : 'ga';
  let barn: HerdKind;
  if (open) barn = northern(world) && water ? 'trau' : 'bo';
  else if (farmland > 6_000) barn = 'lon';
  else barn = 'de';
  return { coop, barn };
}

/** Species for one module at a site, falling back to the map-local answer. */
export function herdFor(world: World, site: Site, module: HerdModule, stored?: HerdKind): HerdKind {
  if (stored) return stored;
  return localHerds(world, site)[module];
}

/** One line for the UI: "Chuồng gà (Vịt)" reads better than a generic label. */
export const herdLabel = (kind: HerdKind): string => HERDS[kind].label;
