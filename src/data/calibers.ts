import type { ItemDef } from './items';

/**
 * Cartridge per weapon family, applied as a data field so ammunition lookup does
 * not depend on a name regex at fight time. The catalogue carries no calibre, and
 * guessing from labels meant an unknown gun silently fired 9×18.
 */
const CALIBRE_RULES: [RegExp, string][] = [
  [/toz|aa-12|saiga|ks-23|mossberg|remington ?870|shotgun|double ?barrel|mts-255|frolov/i, '12-ga'],
  [/aks|ak-?74|akm|ak-?47|sks|rpk|tabuk|psl/i, '7.62x39'],
  [/dragunov|svd|sv-?98|mosin|m14|m24|30-06|garand|springfield/i, '30-06'],
  [/vss|val\b|9a-91|sr-3|9x39/i, '9x39'],
  [/p90|five-?seven|5-?7x28/i, '5.7x28'],
  [/tt\b|tokarev|7-?62x25/i, '7.62x25'],
  [/colt|1911|45 ?acp|usp|m1911/i, '45-acp'],
  [/\.22|22 ?lr|toz-?8|small ?game/i, '22-lr'],
  [/pm\b|makarov|pmm|aps\b|mp-?654|9x18|pb\b/i, '9x18'],
];

/** Fallback round for a gun nobody has classified. */
export const GENERIC_CALIBRE = '9x18';

export function calibreFor(name: string): string {
  for (const [re, cal] of CALIBRE_RULES) if (re.test(name)) return cal;
  return GENERIC_CALIBRE;
}

/** Ammo id/label → cartridge. The miner wrote junk here ("acp-ammo", "ga-ammo"). */
const AMMO_CALIBRE: [RegExp, string][] = [
  [/12-?ga|12 ?gauge/i, '12-ga'],
  [/30-?06/i, '30-06'],
  [/9x39/i, '9x39'],
  [/9x18/i, '9x18'],
  [/7-?62x39|62x39/i, '7.62x39'],
  [/7-?62x25/i, '7.62x25'],
  [/5[.,-]?7x28|7x28/i, '5.7x28'],
  [/32 ?acp/i, '32-acp'],
  [/25 ?acp/i, '25-acp'],
  [/45 ?acp/i, '45-acp'],
  [/22 ?lr|lr-ammo/i, '22-lr'],
];

/** Bulk containers hold a mix, so any gun can feed on them. */
const MIXED_AMMO = /ammo[-_ ]?can|ammo[-_ ]?belt|magazine|loose[-_ ]rounds|box of/i;

/**
 * Normalise ammunition and give every firearm a cartridge. Ammo previously kept
 * the miner's slug ("acp-ammo"), so nothing could match a gun by calibre.
 */
export function withDerivedCaliber(items: Record<string, ItemDef>): Record<string, ItemDef> {
  for (const [id, def] of Object.entries(items)) {
    if (def.mechanic === 'ammo') {
      const label = `${def.label} ${id}`;
      if (MIXED_AMMO.test(label)) {
        def.caliber = 'mixed';
        continue;
      }
      const hit = AMMO_CALIBRE.find(([re]) => re.test(label));
      def.caliber = hit ? hit[1] : 'mixed';
      continue;
    }
    if (def.mechanic !== 'firearm') continue;
    def.caliber = calibreFor(`${def.label} ${def.subtype ?? ''} ${id}`);
  }
  return items;
}

/**
 * Ammo that fits a cartridge: exact matches first, mixed bulk boxes last so a gun
 * feeds on its own round before cracking open a generic can.
 */
export function ammoOptions(items: Record<string, ItemDef>, calibre: string): string[] {
  const exact: string[] = [];
  const mixed: string[] = [];
  for (const [id, d] of Object.entries(items)) {
    if (d.mechanic !== 'ammo') continue;
    if (d.caliber === calibre) exact.push(id);
    else if (d.caliber === 'mixed') mixed.push(id);
  }
  const byBulk = (a: string, b: string) => (items[a]?.kgPerUnit ?? 1) - (items[b]?.kgPerUnit ?? 1) || a.localeCompare(b);
  return [...exact.sort(byBulk), ...mixed.sort(byBulk)];
}
