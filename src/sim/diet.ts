import { ITEMS, type FoodFx, type ItemId } from '../data/items';
import type { Site } from './types';

/**
 * Food psychology, kept as pure functions so the rules are testable without running
 * a day of simulation.
 */

/** Names that mean "vegetable or fruit" — the vitamin C carriers. */
const VEG = /apple|lemon|lime|banana|cabbage|potato|tomato|carrot|onion|greens|vegetable|fruit|orange|garlic|cucumber|pumpkin|corn|bean|pea|mushroom|berry|salad|rau|củ|quả/i;

export const isVegetable = (label: string): boolean => VEG.test(label);

/** Nine identical meals in a row (≈3 days) is what people call bored of eating. */
export const MONOTONY_MEALS = 9;
export const isMonotone = (dietLog: string[] | undefined): boolean => {
  const last = (dietLog ?? []).slice(-MONOTONY_MEALS);
  return last.length === MONOTONY_MEALS && last.every((x) => x === last[0]);
};

/** Below this morale the community is merely unhappy; at 0 nothing is left. */
export const MONOTONY_MORALE = -3;

/** Days without any vegetable before scurvy starts. */
export const SCURVY_DAYS = 25;
/** HP lost per day while scorbutic, per person. */
export const SCURVY_HP = 0.25;

/**
 * Rot speed for stored food: 1 = normal. A locked store halves it; a cellar is
 * better, and a deep cellar better still.
 */
export function rotFactor(cellarLevel: number, hasStorage: boolean): number {
  if (cellarLevel >= 3) return 0.25;
  if (cellarLevel === 2) return 0.35;
  if (cellarLevel >= 1) return 0.5;
  return hasStorage ? 0.5 : 1;
}

/** Everything edible, heaviest kcal per kg first, so a party eats the tins first. */
export function edibleStock(site: Site): { id: ItemId; def: (typeof ITEMS)[string] }[] {
  return (Object.entries(ITEMS) as [string, (typeof ITEMS)[string]][])
    .filter(([id, d]) => (d.kcal ?? 0) > 0 && (d.mechanic === 'food' || d.mechanic === 'comfort') && (site.stock[id] ?? 0) > 0)
    .sort(([, a], [, b]) => (b.kcal ?? 0) / Math.max(0.01, b.kgPerUnit) - (a.kcal ?? 0) / Math.max(0.01, a.kgPerUnit))
    .map(([id, def]) => ({ id, def }));
}

/** Append to the bounded meal log. */
export const pushMeal = (site: Site, kind: string): void => {
  site.dietLog = [...(site.dietLog ?? []), kind].slice(-12);
};

/** Caps keep a single meal from acting like a medkit. */
export const FX_CAPS = { heal: 15, fatigue: 20, water: 500, cureDays: 1 };

export interface FxTarget {
  hp: number;
  fatigue: number;
  water: number;
  sickDays: number;
  morale: number;
}

/**
 * Apply a dish's effects to whoever ate it. Pure, so the rules are testable and
 * the same numbers are used wherever food is eaten (home or on the road).
 */
export function applyFoodFx(target: FxTarget, fx: FoodFx | undefined, maxWater = 3200): void {
  if (!fx) return;
  if (fx.heal) target.hp = Math.min(100, target.hp + Math.min(FX_CAPS.heal, fx.heal));
  if (fx.fatigue) target.fatigue = Math.max(0, target.fatigue - Math.min(FX_CAPS.fatigue, fx.fatigue));
  if (fx.water) target.water = Math.min(maxWater, target.water + Math.min(FX_CAPS.water, fx.water));
  if (fx.cureDays && target.sickDays > 0) target.sickDays = Math.max(0, target.sickDays - Math.min(FX_CAPS.cureDays, fx.cureDays));
}

/** "hồi 8 HP · đỡ 15 mệt · +200 ml · mau khỏi" — for tooltips. */
export function foodFxLabel(fx: FoodFx | undefined): string {
  if (!fx) return '';
  const bits: string[] = [];
  if (fx.heal) bits.push(`hồi ${fx.heal} HP`);
  if (fx.fatigue) bits.push(`đỡ ${fx.fatigue} mệt`);
  if (fx.water) bits.push(`+${fx.water} ml nước`);
  if (fx.cureDays) bits.push(`mau khỏi ${fx.cureDays} ngày`);
  if (fx.vitamin) bits.push('đủ vitamin C');
  if (fx.travel) bits.push('mang đi viễn chinh được');
  return bits.join(' · ');
}
