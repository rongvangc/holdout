import { chance } from '../core/rng';
import { ITEMS, itemLabel, type ItemId } from '../data/items';
import type { GameState, Site } from './types';

/**
 * Equipment is auto-issued from the site stock, not slotted per survivor.
 * The rationale: this sim tracks a community, not a party — what matters is
 * "the group has two crowbars and a vest", not which named person holds them.
 */
export const WEAPON_MECHANICS = new Set(['weapon_blade', 'weapon_blunt', 'firearm']);
export const ARMOR_MECHANICS = new Set(['armor_soft', 'armor_plate', 'helmet', 'mask', 'vest']);

/** Mitigation above this stops mattering — you cannot armour away a horde. */
export const MITIGATION_CAP = 0.45;

export interface WeaponPick {
  id: ItemId;
  mitigation: number;
  biteMult: number;
  durability: number;
  noise: number;
  isFirearm: boolean;
}

const stockOf = (site: Site, id: ItemId) => site.stock[id] ?? 0;

/** The best weapon the site can field, preferring reach and low noise on ties. */
export function bestWeapon(site: Site): WeaponPick | null {
  let best: WeaponPick | null = null;
  for (const [id, def] of Object.entries(ITEMS)) {
    if (!def.mechanic || !WEAPON_MECHANICS.has(def.mechanic)) continue;
    if (stockOf(site, id) < 1) continue;
    const mit = def.mitigation ?? 0;
    if (!best || mit > best.mitigation) {
      best = {
        id,
        mitigation: mit,
        biteMult: def.biteMult ?? 1,
        durability: Math.max(20, def.durability ?? 60),
        noise: def.noise ?? 0,
        isFirearm: def.mechanic === 'firearm',
      };
    }
  }
  return best;
}

export type ArmorSlotName = 'body' | 'head' | 'vest';

/**
 * Best body / head / vest the site owns. Armour stacks multiplicatively, then the
 * total is capped, so a plate carrier plus a helmet is strong but not immunity.
 */
export function armorMitigation(site: Site): number {
  const best: Record<ArmorSlotName, number> = { body: 0, head: 0, vest: 0 };
  for (const [id, def] of Object.entries(ITEMS)) {
    const m = def.mitigation ?? 0;
    if (!def.mechanic || !ARMOR_MECHANICS.has(def.mechanic) || m <= 0) continue;
    if (stockOf(site, id) < 1) continue;
    const slot: ArmorSlotName = def.mechanic === 'helmet' || def.mechanic === 'mask' ? 'head' : def.mechanic === 'vest' ? 'vest' : 'body';
    best[slot] = Math.max(best[slot], m);
  }
  const product = (1 - best.body) * (1 - best.head) * (1 - best.vest);
  return Math.min(MITIGATION_CAP, 1 - product);
}

/** Flat defence a weapon adds to a night guard (the sim's guard term is ~8 + 2*melee). */
export const weaponDefense = (w: WeaponPick | null): number => (w ? Math.round(w.mitigation * 40) : 0);

/**
 * Wear a weapon down by `fights` fights: each fight has a 1/durability chance of
 * breaking it. Broken weapons leave the stock — a broken machete is scrap, not a machete.
 */
export function wearWeapon(s: GameState, site: Site, w: WeaponPick, fights: number): boolean {
  const breakChance = 1 - Math.pow(1 - 1 / w.durability, Math.max(1, fights));
  if (!chance(s.rng, breakChance)) return false;
  site.stock[w.id] = Math.max(0, (site.stock[w.id] ?? 0) - 1);
  return true;
}

/** One line for the expedition report. */
export const describeWeapon = (w: WeaponPick | null): string =>
  w ? `${itemLabel(w.id)} (−${Math.round(w.mitigation * 100)}% sát thương)` : 'tay không';
