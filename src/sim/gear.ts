import { ITEMS, itemLabel, type ItemId } from '../data/items';
import type { Site, Survivor } from './types';
import {
  ARMOR_MECHANICS,
  MITIGATION_CAP,
  WEAPON_MECHANICS,
  ammoFor,
  conditionOf,
  type WeaponPick,
} from './equipment';

/**
 * Per-survivor equipment. The community owns the gear (it lives in the site
 * stock); issuing it to a person reserves one unit so the same crowbar cannot
 * arm five people. Slots are deliberately few: weapon, body armour, head, pack.
 */
export type GearSlot = 'weapon' | 'body' | 'head' | 'pack';

export const GEAR_SLOTS: GearSlot[] = ['weapon', 'body', 'head', 'pack'];

export const SLOT_LABEL: Record<GearSlot, string> = {
  weapon: 'Vũ khí',
  body: 'Giáp thân',
  head: 'Mũ',
  pack: 'Ba lô',
};

const PACK_MECHANICS = new Set(['backpack', 'container']);
const BODY_MECHANICS = new Set(['armor_soft', 'armor_plate', 'vest']);

/** Which slot an item belongs in, or null when it is not wearable gear. */
export function slotFor(id: ItemId): GearSlot | null {
  const def = ITEMS[id];
  const mech = def?.mechanic;
  if (!mech) return null;
  if (WEAPON_MECHANICS.has(mech)) return 'weapon';
  if (BODY_MECHANICS.has(mech)) return 'body';
  if (ARMOR_MECHANICS.has(mech)) return mech === 'helmet' || mech === 'mask' ? 'head' : 'body';
  if (PACK_MECHANICS.has(mech)) return 'pack';
  return null;
}

/** How good an item is in its slot — used for sorting and for auto-issue. */
export function gearScore(id: ItemId): number {
  const def = ITEMS[id];
  if (!def) return 0;
  const slot = slotFor(id);
  if (slot === 'pack') return def.capacity ?? 0;
  return def.mitigation ?? 0;
}

export const gearLabel = (id: ItemId): string => {
  const def = ITEMS[id];
  const slot = slotFor(id);
  if (!def) return id;
  if (slot === 'pack') return `${def.label} (+${Math.round(def.capacity ?? 26)} kg)`;
  if (slot === 'weapon') return `${def.label} (−${Math.round((def.mitigation ?? 0) * 100)}% dmg)`;
  return `${def.label} (−${Math.round((def.mitigation ?? 0) * 100)}% dmg)`;
};

const stockOf = (site: Site, id: ItemId) => site.stock[id] ?? 0;

/** Free units of a slot the site could issue — best first. */
export function availableGear(site: Site, slot: GearSlot): ItemId[] {
  return (Object.keys(ITEMS) as ItemId[])
    .filter((id) => slotFor(id) === slot && stockOf(site, id) >= 1)
    .sort((a, b) => gearScore(b) - gearScore(a) || itemLabel(a).localeCompare(itemLabel(b)));
}

/** Does the site hold ammunition for this weapon? */
export function canField(site: Site, weapon: ItemId | undefined | null): boolean {
  if (!weapon) return false;
  const def = ITEMS[weapon];
  if (!def) return false;
  if (def.mechanic !== 'firearm') return true;
  const ammo = ammoFor(weapon);
  return !!ammo && stockOf(site, ammo) >= 1;
}

/** Put a returned item back into stock (gear always comes back as one unit). */
function giveBack(site: Site, id: ItemId): void {
  site.stock[id] = stockOf(site, id) + 1;
}

function takeOne(site: Site, id: ItemId): boolean {
  if (stockOf(site, id) < 1) return false;
  site.stock[id] = stockOf(site, id) - 1;
  return true;
}

/**
 * Move an item from the site stock into a survivor's slot. Passing null (or an
 * item that does not fit the slot) unequips. Returns an error message, or null.
 */
export function equip(site: Site, v: Survivor, slot: GearSlot, id: ItemId | null): string | null {
  v.gear ??= {};
  const current = v.gear![slot];
  if (id === current) return null;
  if (id === null || id === undefined) {
    if (current) giveBack(site, current);
    delete v.gear![slot];
    return null;
  }
  if (!(id in ITEMS)) return 'Không có món này';
  if (slotFor(id) !== slot) return `${itemLabel(id)} không dùng cho ${SLOT_LABEL[slot].toLowerCase()}`;
  if (!takeOne(site, id)) return `Kho đã hết ${itemLabel(id)}`;
  if (current) giveBack(site, current);
  v.gear![slot] = id;
  return null;
}

/** Take everything off a survivor and hand it back to a site. */
export function returnGear(site: Site, v: Survivor): ItemId[] {
  const back: ItemId[] = [];
  for (const slot of GEAR_SLOTS) {
    const id = v.gear?.[slot];
    if (!id) continue;
    giveBack(site, id);
    back.push(id);
  }
  v.gear = {};
  return back;
}

/** A deserter walks away with what they were carrying. */
export function forfeitGear(v: Survivor): ItemId[] {
  const lost = GEAR_SLOTS.map((s) => v.gear?.[s]).filter((x): x is ItemId => !!x);
  v.gear = {};
  return lost;
}

/** The weapon a survivor actually swings, or null for bare hands. */
export function survivorWeapon(site: Site, v: Survivor): WeaponPick | null {
  const id = v.gear?.weapon;
  if (!id) return null;
  const def = ITEMS[id];
  if (!def || !canField(site, id)) return null;
  const condition = conditionOf(site, id);
  const isFirearm = def.mechanic === 'firearm';
  return {
    id,
    mitigation: (def.mitigation ?? 0) * (0.55 + 0.45 * condition),
    biteMult: def.biteMult ?? 1,
    durability: Math.max(20, def.durability ?? 60),
    noise: def.noise ?? 0,
    isFirearm,
    ammo: isFirearm ? ammoFor(id) : null,
    condition,
  };
}

/** Damage resisted by this person's own body + head armour, capped. */
export function survivorArmor(v: Survivor): number {
  const body = v.gear?.body ? (ITEMS[v.gear.body]?.mitigation ?? 0) : 0;
  const head = v.gear?.head ? (ITEMS[v.gear.head]?.mitigation ?? 0) : 0;
  return Math.min(MITIGATION_CAP, 1 - (1 - body) * (1 - head));
}

/** Extra kilograms this survivor can haul thanks to their pack. */
export function packCapacity(v: Survivor): number {
  const id = v.gear?.pack;
  const base = id ? (ITEMS[id]?.capacity ?? 26) : 0;
  // A lost limb means fewer hands and a weaker back.
  return Math.max(0, base - (v.lostLimb ? 15 : 0));
}

/** The best weapon among a group, plus the person carrying it. */
export function bestArmed<T extends Survivor>(site: Site, group: T[]): { owner: T; weapon: WeaponPick } | null {
  let best: { owner: T; weapon: WeaponPick } | null = null;
  for (const v of group) {
    const w = survivorWeapon(site, v);
    if (!w) continue;
    if (!best || w.mitigation > best.weapon.mitigation) best = { owner: v, weapon: w };
  }
  return best;
}

/**
 * Hand out the best gear to the people who will use it: guards and the best
 * melee fighters first. Called by the daily auto-assignment.
 */
export function issueGear(site: Site, people: Survivor[]): void {
  if (!people.length) return;
  const rank = (v: Survivor) => (v.task?.kind === 'guard' ? 100 : 0) + v.xp.melee / 100;
  const order = [...people].sort((a, b) => rank(b) - rank(a));

  for (const slot of GEAR_SLOTS) {
    // Slot strength matters more than stock order: re-issue the best available.
    for (const v of order) {
      if (v.gear?.[slot]) continue;
      const pick = availableGear(site, slot)[0];
      if (!pick) break;
      equip(site, v, slot, pick);
    }
    // Whoever holds the weakest item of a slot can still upgrade.
    for (const v of order) {
      const held = v.gear?.[slot];
      const pick = availableGear(site, slot)[0];
      if (!pick) break;
      if (held && gearScore(pick) <= gearScore(held)) break;
      equip(site, v, slot, pick);
    }
  }
}
