import type { BuildingCat } from '../world/types';
import { ITEMS, type ItemId } from './items';

/**
 * Gear the world actually hands out.
 *
 * The static tables in `categories.ts` cover bulk loot (food, wood, scrap) with
 * tuned amounts. This module covers the other 600 catalogue items: what a given
 * kind of building would plausibly hold. Without it 558 items were unobtainable
 * and looting never produced a coat, a vest or a spare magazine.
 */

/** Which mechanics a building type can yield, and up to which tier. */
const POOLS: Partial<Record<BuildingCat, { mech: string[]; maxTier: number; weight: number }[]>> = {
  house: [
    { mech: ['clothes', 'boots', 'gloves'], maxTier: 2, weight: 30 },
    { mech: ['container', 'backpack'], maxTier: 2, weight: 14 },
    { mech: ['weapon_blade'], maxTier: 1, weight: 12 },
    { mech: ['medicine', 'bandage'], maxTier: 1, weight: 10 },
    { mech: ['cookware'], maxTier: 2, weight: 8 },
    { mech: ['tool'], maxTier: 1, weight: 8 },
    { mech: ['misc', 'fire', 'camping'], maxTier: 2, weight: 18 },
  ],
  apartment: [
    { mech: ['clothes', 'boots', 'gloves'], maxTier: 2, weight: 30 },
    { mech: ['container', 'backpack'], maxTier: 2, weight: 12 },
    { mech: ['weapon_blade'], maxTier: 1, weight: 10 },
    { mech: ['medicine'], maxTier: 1, weight: 10 },
    { mech: ['electronic'], maxTier: 2, weight: 8 },
    { mech: ['misc', 'fire'], maxTier: 2, weight: 14 },
  ],
  shop: [
    { mech: ['clothes', 'boots', 'gloves'], maxTier: 2, weight: 22 },
    { mech: ['food', 'drink'], maxTier: 1, weight: 20 },
    { mech: ['hygiene', 'medicine'], maxTier: 1, weight: 14 },
    { mech: ['container', 'backpack'], maxTier: 1, weight: 10 },
    { mech: ['drink'], maxTier: 2, weight: 16 },
    { mech: ['misc', 'fire'], maxTier: 1, weight: 10 },
  ],
  supermarket: [
    { mech: ['food', 'drink'], maxTier: 1, weight: 40 },
    { mech: ['cookware'], maxTier: 2, weight: 10 },
    { mech: ['hygiene'], maxTier: 1, weight: 8 },
  ],
  market: [
    { mech: ['food', 'drink'], maxTier: 1, weight: 34 },
    { mech: ['cookware'], maxTier: 1, weight: 12 },
    { mech: ['weapon_blade'], maxTier: 1, weight: 8 },
  ],
  pharmacy: [
    { mech: ['medicine', 'bandage', 'injection'], maxTier: 2, weight: 40 },
    { mech: ['hygiene'], maxTier: 1, weight: 12 },
  ],
  clinic: [
    { mech: ['medicine', 'bandage', 'injection', 'medkit'], maxTier: 2, weight: 34 },
    { mech: ['mask', 'gloves'], maxTier: 2, weight: 14 },
  ],
  hospital: [
    { mech: ['medicine', 'bandage', 'injection', 'medkit'], maxTier: 3, weight: 34 },
    { mech: ['mask', 'gloves', 'clothes'], maxTier: 2, weight: 18 },
  ],
  school: [
    { mech: ['clothes', 'boots'], maxTier: 1, weight: 18 },
    { mech: ['container', 'backpack'], maxTier: 1, weight: 16 },
    { mech: ['tool', 'cookware'], maxTier: 1, weight: 10 },
  ],
  police: [
    { mech: ['weapon_blade', 'weapon_blunt'], maxTier: 2, weight: 26 },
    { mech: ['vest', 'armor_plate', 'armor_soft'], maxTier: 2, weight: 22 },
    { mech: ['helmet', 'mask'], maxTier: 2, weight: 18 },
    { mech: ['backpack', 'container'], maxTier: 2, weight: 12 },
    { mech: ['ammo'], maxTier: 2, weight: 10 },
    { mech: ['firearm'], maxTier: 2, weight: 6 },
    { mech: ['misc', 'fire'], maxTier: 2, weight: 12 },
  ],
  fuel: [
    { mech: ['tool'], maxTier: 1, weight: 20 },
    { mech: ['electronic'], maxTier: 1, weight: 12 },
    { mech: ['clothes', 'boots'], maxTier: 1, weight: 10 },
  ],
  hardware: [
    { mech: ['tool'], maxTier: 2, weight: 30 },
    { mech: ['weapon_blunt', 'weapon_blade'], maxTier: 1, weight: 20 },
    { mech: ['clothes', 'boots', 'gloves'], maxTier: 2, weight: 16 },
    { mech: ['electronic'], maxTier: 1, weight: 8 },
    { mech: ['material'], maxTier: 1, weight: 10 },
    { mech: ['misc', 'fire'], maxTier: 2, weight: 12 },
  ],
  car_repair: [
    { mech: ['tool'], maxTier: 2, weight: 30 },
    { mech: ['clothes', 'gloves'], maxTier: 1, weight: 14 },
    { mech: ['electronic'], maxTier: 1, weight: 10 },
  ],
  industrial: [
    { mech: ['tool'], maxTier: 3, weight: 28 },
    { mech: ['weapon_blunt', 'weapon_blade'], maxTier: 2, weight: 18 },
    { mech: ['clothes', 'boots', 'gloves'], maxTier: 2, weight: 16 },
    { mech: ['helmet'], maxTier: 2, weight: 10 },
  ],
  office: [
    { mech: ['clothes', 'boots'], maxTier: 2, weight: 22 },
    { mech: ['electronic'], maxTier: 2, weight: 14 },
    { mech: ['container', 'backpack'], maxTier: 1, weight: 10 },
  ],
  religious: [
    { mech: ['clothes'], maxTier: 1, weight: 20 },
    { mech: ['cookware'], maxTier: 1, weight: 12 },
    { mech: ['medicine'], maxTier: 1, weight: 8 },
  ],
  generic: [
    { mech: ['clothes', 'boots', 'gloves'], maxTier: 2, weight: 16 },
    { mech: ['tool', 'cookware', 'camping'], maxTier: 2, weight: 12 },
    { mech: ['container'], maxTier: 1, weight: 8 },
    { mech: ['misc', 'fire'], maxTier: 3, weight: 12 },
  ],
};

/** Weight by tier so a first aid kit is common and a plate carrier is a find. */
const tierWeight = (tier: number) => [3, 1.3, 0.45, 0.15][Math.max(0, Math.min(3, tier - 1))];

const cache = new Map<BuildingCat, [ItemId, number][]>();

/** Deterministic candidate list for a building type: [itemId, weight]. */
export function gearPool(cat: BuildingCat): [ItemId, number][] {
  const hit = cache.get(cat);
  if (hit) return hit;
  const rules = POOLS[cat] ?? POOLS.generic!;
  const out: [ItemId, number][] = [];
  for (const [id, def] of Object.entries(ITEMS)) {
    const mech = def.mechanic;
    if (!mech) continue;
    const tier = def.tier ?? 1;
    for (const rule of rules) {
      if (!rule.mech.includes(mech)) continue;
      if (tier > rule.maxTier) continue;
      const w = rule.weight * tierWeight(tier) * (def.rare ? 0.3 : 1);
      out.push([id, w]);
      break;
    }
  }
  cache.set(cat, out);
  return out;
}

/** True when the catalogue item can be found somewhere in the world. */
export function inAnyPool(id: ItemId): boolean {
  for (const cat of Object.keys(POOLS) as BuildingCat[]) if (gearPool(cat).some(([x]) => x === id)) return true;
  return false;
}

export const POOL_CATS = Object.keys(POOLS) as BuildingCat[];
