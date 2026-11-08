import type { ItemDef } from './items';

/**
 * Fields the catalog export cannot know, derived from what it does carry.
 *
 * The innawoods catalog only tags weapons with a coarse `subtype` ("Sharp",
 * "Blunt"); the recipe builder keys weapon bills-of-materials on `cls`
 * (short_blade / long_blade / axe / reach / crowbar / blunt / heavy). Without
 * this pass every blade in the catalog was unbuildable, which left 74 of 75
 * weapons unobtainable.
 */
export type WeaponClass = 'short_blade' | 'long_blade' | 'sword' | 'axe' | 'reach' | 'crowbar' | 'blunt' | 'heavy' | 'fist';

const SHORT = /knife|bayonet|kunai|shuriken|cleaver|scalpel|razor|dagger|stiletto|pusher|pen\b/i;
const REACH = /spear|pitchfork|lance|\bfork\b|shovel|hoe\b|rake\b|trident|glaive|halberd|pike\b|staff/i;
const AXE = /axe|hatchet|adze|tomahawk|bardiche|berdysh/i;
const CROWBAR = /crowbar|wrench|nail ?puller|pry ?bar|pincer|bolt ?cutter/i;
const SWORD = /sword|katana|sabre|saber|rapier|scimitar|longsword|wakizashi|machete|kukri|parang|barong|tapanga|falchion|sickle|scythe|billhook|dao\b|golok/i;
const HEAVY = /sledge|maul\b|great ?axe|war ?hammer|halberd|morning ?star|flail/i;

/**
 * Best-effort class for a weapon. Falls back on the subtype so nothing is ever
 * left without a bill of materials.
 */
export function weaponClass(def: ItemDef): WeaponClass | undefined {
  if (def.cls) return def.cls as WeaponClass;
  if (def.mechanic !== 'weapon_blade' && def.mechanic !== 'weapon_blunt') return undefined;
  const name = `${def.label} ${def.subtype ?? ''}`;
  if (HEAVY.test(name)) return 'heavy';
  if (def.mechanic === 'weapon_blunt') return 'blunt';
  if (SHORT.test(name)) return 'short_blade';
  if (REACH.test(name)) return 'reach';
  if (AXE.test(name)) return 'axe';
  if (CROWBAR.test(name)) return 'crowbar';
  if (SWORD.test(name)) return def.tier && def.tier >= 2 ? 'sword' : 'long_blade';
  return 'short_blade';
}

/** Fill `cls` in place for anything the export left blank. */
export function withDerivedWeaponClass(items: Record<string, ItemDef>): Record<string, ItemDef> {
  for (const def of Object.values(items)) {
    if (def.cls) continue;
    const cls = weaponClass(def);
    if (cls) def.cls = cls;
  }
  return items;
}

/**
 * Armour mitigation the catalog export never carried (0 of 145 armour items had
 * one, so `armorMitigation` was always 0 and body armour did nothing). Values are
 * per-item; the sim still caps the combined total at MITIGATION_CAP (0.45).
 */
const ARMOR_BASE: Record<string, number> = {
  armor_soft: 0.06,
  armor_plate: 0.14,
  vest: 0.04,
  helmet: 0.05,
  mask: 0.02,
  gloves: 0.01,
  boots: 0.01,
};

const ARMOR_PER_TIER: Record<string, number> = {
  armor_soft: 0.03,
  armor_plate: 0.05,
  vest: 0.02,
  helmet: 0.03,
  mask: 0.01,
  gloves: 0.005,
  boots: 0.005,
};

/** Fill `mitigation` in place for wearable armour. */
export function withDerivedArmor(items: Record<string, ItemDef>): Record<string, ItemDef> {
  for (const def of Object.values(items)) {
    const mech = def.mechanic;
    if (!mech || !(mech in ARMOR_BASE)) continue;
    if ((def.mitigation ?? 0) > 0) continue;
    const tier = Math.max(1, Math.min(3, def.tier ?? 1));
    const value = ARMOR_BASE[mech] + ARMOR_PER_TIER[mech] * (tier - 1);
    def.mitigation = Math.round(value * 100) / 100;
  }
  return items;
}
