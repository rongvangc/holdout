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

/**
 * Damage and penetration per weapon form. `mitigation` stays the defensive side
 * (đỡ đòn / giữ khoảng cách); these two decide how fast a zombie goes down and
 * whether its natural armour matters.
 */
const FORM_ATTACK: Record<string, { dmg: number; pierce: number }> = {
  fist: { dmg: 1.4, pierce: 0.05 },
  short_blade: { dmg: 2.6, pierce: 0.12 },
  blunt: { dmg: 2.9, pierce: 0.18 },
  crowbar: { dmg: 3.2, pierce: 0.3 },
  reach: { dmg: 2.3, pierce: 0.15 },
  axe: { dmg: 3.6, pierce: 0.35 },
  long_blade: { dmg: 3.8, pierce: 0.22 },
  sword: { dmg: 4.0, pierce: 0.26 },
  heavy: { dmg: 5.2, pierce: 0.45 },
};

/** Firearms hit far harder, but they are loud and eat ammunition. */
function firearmAttack(subtype: string, tier: number): { dmg: number; pierce: number } {
  const s = subtype.toLowerCase();
  if (/svd|sniper|bolt|long|marksman/.test(s)) return { dmg: 9.5, pierce: 0.85 };
  if (/shotgun|break|pump|revolv/.test(s)) return { dmg: 7.5, pierce: 0.6 };
  if (/semi-auto|full-auto|ak/.test(s)) return { dmg: 6.2, pierce: 0.7 };
  if (/pm|pistol/.test(s)) return { dmg: 3.4, pierce: 0.5 };
  return { dmg: 5 + tier, pierce: 0.65 };
}

/** Fill `dmg`/`pierce` in place for weapons. */
export function withDerivedAttack(items: Record<string, ItemDef>): Record<string, ItemDef> {
  for (const def of Object.values(items)) {
    if (def.dmg && def.pierce) continue;
    const tier = Math.max(1, Math.min(4, def.tier ?? 1));
    if (def.mechanic === 'firearm') {
      const a = firearmAttack(def.subtype ?? '', tier);
      def.dmg = Math.round(a.dmg * (0.9 + 0.05 * tier) * 10) / 10;
      def.pierce = Math.min(0.95, Math.round((a.pierce + 0.03 * tier) * 100) / 100);
      continue;
    }
    if (def.mechanic !== 'weapon_blade' && def.mechanic !== 'weapon_blunt') continue;
    const form = FORM_ATTACK[def.cls ?? 'short_blade'] ?? FORM_ATTACK.short_blade;
    // Heavier weapons of the same form hit a bit harder; light ones stay quick.
    const weightBonus = Math.min(0.25, Math.max(0, (def.kgPerUnit - 1) * 0.04));
    def.dmg = Math.round(form.dmg * (1 + weightBonus) * 10) / 10;
    def.pierce = Math.round(Math.min(0.9, form.pierce * (1 + weightBonus)) * 100) / 100;
  }
  return items;
}

/**
 * Insulation for clothing. The export carries no warmth value, so it comes from
 * the mechanic: a coat keeps you warmer than gloves, boots less than a jacket.
 * Clothing previously did nothing at all — 68 items of pure decoration.
 */
const INSULATION: Record<string, number> = {
  clothes: 0.35,
  boots: 0.15,
  gloves: 0.08,
  mask: 0.04,
  helmet: 0.02,
};

export function withDerivedInsulation(items: Record<string, ItemDef>): Record<string, ItemDef> {
  for (const def of Object.values(items)) {
    const mech = def.mechanic;
    if (!mech || !(mech in INSULATION)) continue;
    if (def.insulation !== undefined) continue;
    const tier = Math.max(1, Math.min(4, def.tier ?? 1));
    // A heavier garment of the same kind is warmer.
    const weight = Math.min(0.4, Math.max(0, (def.kgPerUnit - 0.8) * 0.08));
    def.insulation = Math.round(Math.min(0.6, INSULATION[mech] * (1 + 0.08 * (tier - 1)) + weight) * 100) / 100;
  }
  return items;
}
