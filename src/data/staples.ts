import type { ItemDef } from './items';

/**
 * Staples, by climate rather than by country.
 *
 * The game shipped with one bucket called `rawFood` ("Gạo/khoai sống") and a note
 * saying Vietnamese homes keep a sack of rice — but the map is OpenStreetMap and
 * can be anywhere on earth. This file replaces that assumption: what you find and
 * grow depends on the latitude you started at, and each staple differs in weight
 * and how fast it spoils, so the choice has consequences.
 *
 * `rawFood` stays as a legacy bucket so old saves and the existing economy keep
 * working; the helpers below treat it as one more staple.
 */
const P = 'icons/innawoods/';

export const STAPLES: Record<string, ItemDef> = {
  gao: {
    label: 'Gạo',
    unit: 'kg',
    kgPerUnit: 1,
    category: 'food',
    mechanic: 'food',
    tier: 0,
    kcal: 3600,
    rotPerDay: 0.02,
    icon: P + 'items/nutrition/rice__285.png',
    desc: 'Lương thực chính ở vùng nóng ẩm. Nhẹ, để được lâu, nấu thành cơm/cháo.',
  },
  lua_mi: {
    label: 'Lúa mì',
    unit: 'kg',
    kgPerUnit: 1,
    category: 'food',
    mechanic: 'food',
    tier: 0,
    kcal: 3400,
    rotPerDay: 0.02,
    icon: P + 'items/nutrition/rice__285.png',
    desc: 'Lương thực vùng ôn đới. Xay thành bột, nướng bánh, nấu cháo.',
  },
  khoai_tay: {
    label: 'Khoai tây',
    unit: 'kg',
    kgPerUnit: 1,
    category: 'food',
    mechanic: 'food',
    tier: 0,
    kcal: 770,
    rotPerDay: 0.06,
    icon: P + 'items/nutrition/buckwheat__723.png',
    desc: 'Nặng và nhiều nước: cùng một kg chỉ bằng 1/5 gạo. Đổi lại trồng được ở đâu cũng sống.',
  },
  ngo: {
    label: 'Ngô',
    unit: 'kg',
    kgPerUnit: 1,
    category: 'food',
    mechanic: 'food',
    tier: 0,
    kcal: 3600,
    rotPerDay: 0.025,
    icon: P + 'items/nutrition/buckwheat__723.png',
    desc: 'Lương thực vùng ấm. Ăn được khi còn non, để khô thì nghiền thành bột.',
  },
  san: {
    label: 'Sắn',
    unit: 'kg',
    kgPerUnit: 1,
    category: 'food',
    mechanic: 'food',
    tier: 0,
    kcal: 1600,
    rotPerDay: 0.12,
    icon: P + 'items/nutrition/buckwheat__723.png',
    desc: 'Cây cứu đói vùng nhiệt đới: nhiều nước, hỏng nhanh, phải chế biến ngay.',
  },
};

export const STAPLE_IDS: string[] = [...Object.keys(STAPLES), 'rawFood'];

/**
 * Which starchy food grows and sits on shelves where you started.
 * Bands are latitude-based on purpose: the world underneath is the real map.
 */
export function regionStaple(latitude: number): string {
  const abs = Math.abs(latitude);
  if (abs < 23.5) return 'gao'; // tropics and subtropics
  if (abs < 45) return 'lua_mi'; // temperate
  return 'khoai_tay'; // cold: potatoes are what actually survives a winter
}

/** The second staple a region also offers, for loot variety. */
export function regionStapleAlt(latitude: number): string {
  const abs = Math.abs(latitude);
  if (abs < 23.5) return 'san';
  if (abs < 45) return 'ngo';
  return 'lua_mi';
}

/**
 * Total bulk calories in a store, across every staple plus the legacy bucket.
 * Every "days of food left" calculation must use this, or a colony living on
 * potatoes looks like it is starving.
 */
export function stapleKcal(stock: Partial<Record<string, number>>): number {
  let sum = 0;
  for (const id of STAPLE_IDS) {
    const n = stock[id] ?? 0;
    if (n <= 0) continue;
    // rawFood's unit is already kcal; real staples are kg and carry kcal per kg.
    sum += id === 'rawFood' ? n : n * (STAPLES[id]?.kcal ?? 0);
  }
  return sum;
}

/** Staples that spoil, for the daily rot pass. */
export const PERISHABLE_STAPLES: string[] = Object.keys(STAPLES);
