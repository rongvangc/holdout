import { ammoOptions } from '../data/calibers';
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

/**
 * Which cartridge a gun eats. The catalog has no per-gun calibre field (innawoods
 * stores only `year`), so this is a keyword table over known family names.
 * A gun with no ammo in the armoury is simply not fielded.
 */
const AMMO_RULES: [RegExp, ItemId][] = [
  [/toz|aa-12|saiga|ks-23|mossberg|remington ?870|shotgun|double ?barrel/i, 'ammo_12-ga-ammo'],
  [/aks|ak-?74|akm|ak-?47|sks|rpk|dragunov|svd|tabuk/i, 'ammo_7-62x39-ammo'],
  [/mosin|m14|m24|psl|sv-?98|30-06|garand|springfield/i, 'ammo_30-06-ammo'],
  [/vss|val\b|9a-91|sr-3|9x39/i, 'ammo_9x39-ammo'],
  [/pm\b|makarov|pmm|aps\b|mp-?654|9x18/i, 'ammo_9x18-ammo'],
  [/p90|five-?seven|5-?7x28/i, 'ammo_5-7x28-ammo'],
  [/tt\b|tokarev|7-62x25/i, 'ammo_7-62x39-ammo'],
  [/colt|1911|45 ?acp|usp|m1911/i, 'ammo_45-acp-ammo'],
  [/\.22|22 ?lr|toz-?8|small ?game/i, 'ammo_22-lr-ammo'],
];

/** Generic cartridge for guns whose family the keyword table does not know. */
const GENERIC_AMMO: ItemId = 'ammo_9x18-ammo';

export const ammoFor = (weapon: ItemId): ItemId | null => {
  // `caliber` is now a data field (see data/calibers.ts) — no more name guessing.
  const calibre = ITEMS[weapon]?.caliber;
  if (calibre) {
    const best = ammoOptions(ITEMS, calibre).find((id) => id in ITEMS);
    if (best) return best;
  }
  const name = itemLabel(weapon);
  for (const [re, ammo] of AMMO_RULES) if (re.test(name) && ammo in ITEMS) return ammo;
  return GENERIC_AMMO in ITEMS ? GENERIC_AMMO : null;
};

export interface WeaponPick {
  id: ItemId;
  mitigation: number;
  biteMult: number;
  durability: number;
  noise: number;
  isFirearm: boolean;
  ammo: ItemId | null;
  /** 0..1 — 1 is factory-fresh, 0 means the next fight breaks it. */
  condition: number;
}

const stockOf = (site: Site, id: ItemId) => site.stock[id] ?? 0;

/** Current condition of a stack (defaults to new). */
export const conditionOf = (site: Site, id: ItemId): number => {
  const c = site.condition?.[id];
  return c === undefined ? 1 : Math.max(0, Math.min(1, c));
};

const setCondition = (site: Site, id: ItemId, v: number): void => {
  site.condition ??= {};
  site.condition[id] = Math.max(0, Math.min(1, v));
};

/**
 * The best weapon the site can actually field: firearms only when the matching
 * cartridge is in stock, and a worn weapon counts for less than a fresh one.
 */
export function bestWeapon(site: Site): WeaponPick | null {
  let best: WeaponPick | null = null;
  for (const [id, def] of Object.entries(ITEMS)) {
    if (!def.mechanic || !WEAPON_MECHANICS.has(def.mechanic)) continue;
    if (stockOf(site, id) < 1) continue;
    const isFirearm = def.mechanic === 'firearm';
    const ammo = isFirearm ? ammoFor(id) : null;
    if (isFirearm && (!ammo || stockOf(site, ammo) < 1)) continue;
    const condition = conditionOf(site, id);
    // A beaten-up blade still works, just not as well.
    const effective = (def.mitigation ?? 0) * (0.55 + 0.45 * condition);
    if (!best || effective > best.mitigation) {
      best = {
        id,
        mitigation: effective,
        biteMult: def.biteMult ?? 1,
        durability: Math.max(20, def.durability ?? 60),
        noise: def.noise ?? 0,
        isFirearm,
        ammo,
        condition,
      };
    }
  }
  return best;
}

type ArmorSlotName = 'body' | 'head' | 'vest';

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

export const repairCost = (w: WeaponPick): { scrap: number; wood: number } => {
  const missing = 1 - w.condition;
  return { scrap: Math.max(1, Math.round(missing * 4)), wood: missing > 0.5 ? 1 : 0 };
};

export const needsRepair = (w: WeaponPick | null): boolean => !!w && w.condition < 0.98;

/**
 * Spend a weapon's condition on `fights` fights. Firearms also spend ammo.
 * When condition bottoms out the weapon is gone (one unit leaves stock, the rest
 * of the stack is still fine) and what is left of it becomes scrap.
 */
export function wearWeapon(_s: GameState, site: Site, w: WeaponPick, fights: number): { broke: boolean; ammoUsed: number } {
  let ammoUsed = 0;
  if (w.isFirearm && w.ammo) {
    const want = Math.max(1, fights);
    const got = Math.min(stockOf(site, w.ammo), want);
    site.stock[w.ammo] = stockOf(site, w.ammo) - got;
    ammoUsed = got;
    if (got === 0) return { broke: false, ammoUsed: 0 };
  }
  const wear = fights / w.durability;
  const next = conditionOf(site, w.id) - wear;
  if (next > 0) {
    setCondition(site, w.id, next);
    return { broke: false, ammoUsed };
  }
  // Broken: one unit leaves the stock, leftovers become scrap.
  const units = stockOf(site, w.id);
  site.stock[w.id] = Math.max(0, units - 1);
  setCondition(site, w.id, 1);
  site.stock.scrap = stockOf(site, 'scrap') + 1;
  return { broke: true, ammoUsed };
}

/** Repair a worn stack back to full at the forge. */
export function restoreWeapon(site: Site, id: ItemId): void {
  setCondition(site, id, 1);
}

/** One line for the expedition report. */
export const describeWeapon = (w: WeaponPick | null): string =>
  w
    ? `${itemLabel(w.id)} (−${Math.round(w.mitigation * 100)}% sát thương${w.condition < 0.7 ? ', đã cũ' : ''})`
    : 'tay không';

/** Tools and cookware wear out on the job; until now they were free forever. */
const TOOL_MECHANICS = new Set(['tool', 'cookware', 'camping']);

export interface ToolPick {
  id: ItemId;
  durability: number;
  condition: number;
}

/** The sturdiest tool the site owns, or null. */
export function bestTool(site: Site): ToolPick | null {
  let best: ToolPick | null = null;
  for (const [id, def] of Object.entries(ITEMS)) {
    if (!def.mechanic || !TOOL_MECHANICS.has(def.mechanic)) continue;
    if (stockOf(site, id) < 1) continue;
    const durability = Math.max(10, def.durability ?? 60);
    if (!best || durability > best.durability) best = { id, durability, condition: conditionOf(site, id) };
  }
  return best;
}

/**
 * Charge one job to the best tool. A tool with no durability in the catalogue
 * (pots, blankets) is not tracked and never breaks.
 */
export function wearTool(site: Site, jobs = 1): { broke: boolean; id: ItemId | null } {
  const tool = bestTool(site);
  if (!tool) return { broke: false, id: null };
  const next = conditionOf(site, tool.id) - jobs / tool.durability;
  if (next > 0) {
    setCondition(site, tool.id, next);
    return { broke: false, id: tool.id };
  }
  site.stock[tool.id] = Math.max(0, stockOf(site, tool.id) - 1);
  setCondition(site, tool.id, 1);
  return { broke: true, id: tool.id };
}
