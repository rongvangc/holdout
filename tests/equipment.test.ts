import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/items';
import { armorMitigation, bestWeapon, MITIGATION_CAP, weaponDefense, wearWeapon } from '../src/sim/equipment';
import { newGame } from '../src/sim/state';
import { makeTestWorld } from '../scripts/headless';

function setup() {
  const world = makeTestWorld();
  const b = world.buildings.filter((x) => x.area > 250 && x.area < 900)[0];
  const s = newGame(world, b.id, 7, new Date(2026, 5, 1));
  return { s, site: s.sites[0] };
}

const firstOf = (pred: (_id: string, def: (typeof ITEMS)[string]) => boolean) =>
  Object.entries(ITEMS).find(([id, def]) => pred(id, def))?.[0] as string;

describe('equipment', () => {
  it('picks the strongest weapon in stock and ignores empty ones', () => {
    const { site } = setup();
    expect(bestWeapon(site)).toBeNull();
    const club = firstOf((_id, d) => d.mechanic === 'weapon_blunt' && (d.mitigation ?? 0) > 0);
    const crowbar = firstOf((_id, d) => d.cls === 'crowbar' && (d.mechanic ?? '').startsWith('weapon_'));
    site.stock[club] = 1;
    expect(bestWeapon(site)!.id).toBe(club);
    site.stock[crowbar] = 1;
    const best = bestWeapon(site)!;
    expect(best.mitigation).toBeGreaterThanOrEqual(ITEMS[club].mitigation!);
    site.stock[club] = 0;
    site.stock[crowbar] = 0;
    expect(bestWeapon(site)).toBeNull();
  });

  it('stacks armour across slots but caps the total', () => {
    const { site } = setup();
    expect(armorMitigation(site)).toBe(0);
    for (const [aid, def] of Object.entries(ITEMS)) {
      if (def.mechanic && ['armor_soft', 'armor_plate'].includes(def.mechanic) && (def.mitigation ?? 0) > 0) {
        site.stock[aid] = 1;
        break;
      }
    }
    const one = armorMitigation(site);
    expect(one).toBeGreaterThan(0);
    expect(one).toBeLessThanOrEqual(MITIGATION_CAP);
  });

  it('issue the weapon defence bonus guards get', () => {
    const { site } = setup();
    // Any melee weapon with real mitigation: the catalog has no crowbar in Melee.
    const weapon = firstOf((_id, d) => (d.mechanic ?? '').startsWith('weapon_') && (d.mitigation ?? 0) > 0.15);
    site.stock[weapon] = 1;
    expect(weaponDefense(bestWeapon(site))).toBeGreaterThan(0);
    expect(weaponDefense(null)).toBe(0);
  });

  it('breaks weapons over time and removes them from stock', () => {
    const { s, site } = setup();
    const club = firstOf((_id, d) => d.mechanic === 'weapon_blunt' && (d.mitigation ?? 0) > 0);
    site.stock[club] = 1;
    const w = bestWeapon(site)!;
    let broke = 0;
    for (let i = 0; i < 500 && site.stock[club] > 0; i++) {
      if (wearWeapon(s, site, w, 1)) broke++;
      site.stock[club] = Math.max(0, site.stock[club]);
    }
    expect(broke).toBeGreaterThan(0);
    expect(site.stock[club]).toBe(0);
  });
});
