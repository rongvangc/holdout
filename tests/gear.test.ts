import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/items';
import { CATS } from '../src/data/categories';
import { newGame, mainSite } from '../src/sim/state';
import { equip, survivorWeapon, survivorArmor, packCapacity, slotFor, returnGear, issueGear, canField } from '../src/sim/gear';
import { ammoFor } from '../src/sim/equipment';
import { availableGear as availableGearList } from '../src/sim/gear';
import { makeTestWorld } from '../scripts/headless';

function setup() {
  const world = makeTestWorld();
  const b = world.buildings.find((x) => x.area > 250 && x.area < 900)!;
  const s = newGame(world, b.id, 42, new Date(2026, 5, 1));
  return { s, site: mainSite(s), v: s.survivors[0] };
}

describe('gear slots', () => {
  it('classifies weapons, armour, helmets and packs', () => {
    expect(slotFor('wpn_machete')).toBe('weapon');
    expect(slotFor('vest_alice')).toBe('body');
    expect(slotFor('helm_m1')).toBe('head');
    expect(slotFor('pack_backpack')).toBe('pack');
    expect(slotFor('wood')).toBeNull();
  });

  it('every loot entry points at a real item', () => {
    for (const [cat, def] of Object.entries(CATS)) {
      for (const [id] of def.loot) expect(ITEMS[id], `${cat} → ${id}`).toBeDefined();
    }
  });

  it('every weapon class the recipe builder knows is produced by the derivation', () => {
    const blades = Object.values(ITEMS).filter((d) => d.mechanic === 'weapon_blade' || d.mechanic === 'weapon_blunt');
    expect(blades.every((d) => !!d.cls)).toBe(true);
  });
});

describe('equip / unequip', () => {
  it('reserves one unit from stock and returns it on unequip', () => {
    const { site, v } = setup();
    site.stock.wpn_machete = 2;
    expect(equip(site, v, 'weapon', 'wpn_machete')).toBeNull();
    expect(site.stock.wpn_machete).toBe(1);
    expect(v.gear?.weapon).toBe('wpn_machete');
    equip(site, v, 'weapon', null);
    expect(site.stock.wpn_machete).toBe(2);
    expect(v.gear?.weapon).toBeUndefined();
  });

  it('refuses an item from another slot or an empty stock', () => {
    const { site, v } = setup();
    site.stock.wpn_machete = 1;
    expect(equip(site, v, 'head', 'wpn_machete')).toContain('không dùng cho');
    expect(equip(site, v, 'weapon', 'helm_m1')).toContain('không dùng cho');
    expect(equip(site, v, 'body', 'vest_alice')).not.toBeNull(); // 0 trong kho
  });

  it('swap returns the old item to stock', () => {
    const { site, v } = setup();
    site.stock.wpn_machete = 1;
    site.stock['blnt_police-baton'] = 1;
    equip(site, v, 'weapon', 'wpn_machete');
    equip(site, v, 'weapon', 'blnt_police-baton');
    expect(site.stock.wpn_machete).toBe(1);
    expect(site.stock['blnt_police-baton']).toBe(0);
    expect(v.gear?.weapon).toBe('blnt_police-baton');
  });
});

describe('per-survivor effects', () => {
  it('only the person holding a weapon gets its bonus', () => {
    const { s, site, v } = setup();
    site.stock.wpn_machete = 1;
    equip(site, v, 'weapon', 'wpn_machete');
    const other = s.survivors[1];
    expect(survivorWeapon(site, v)).not.toBeNull();
    expect(survivorWeapon(site, other)).toBeNull();
  });

  it('a firearm is dead weight without ammunition', () => {
    const { site, v } = setup();
    const gun = Object.keys(ITEMS).find((id) => ITEMS[id].mechanic === 'firearm')!;
    site.stock[gun] = 1;
    equip(site, v, 'weapon', gun);
    expect(canField(site, gun)).toBe(false);
    expect(survivorWeapon(site, v)).toBeNull();
    // Nạp loại đạn khớp khẩu súng này mới dùng được.
    site.stock[ammoFor(gun)!] = 5;
    expect(canField(site, gun)).toBe(true);
    expect(survivorWeapon(site, v)?.ammo).toBe(ammoFor(gun));
  });

  it('armour adds up but is capped, and nobody else benefits', () => {
    const { s, site, v } = setup();
    site.stock.vest_alice = 1;
    site.stock.helm_m1 = 1;
    equip(site, v, 'body', 'vest_alice');
    equip(site, v, 'head', 'helm_m1');
    expect(survivorArmor(v)).toBeGreaterThan(0);
    expect(survivorArmor(v)).toBeLessThanOrEqual(0.45);
    expect(survivorArmor(s.survivors[1])).toBe(0);
  });

  it('a pack increases that person’s carry weight', () => {
    const { site, v } = setup();
    expect(packCapacity(v)).toBe(0);
    site.stock.pack_backpack = 1;
    equip(site, v, 'pack', 'pack_backpack');
    expect(packCapacity(v)).toBeGreaterThan(0);
  });

  it('auto-issue hands the best gear to the best fighter, not to everyone', () => {
    const { s, site } = setup();
    site.stock.wpn_machete = 1;
    site.stock.wpn_crowbar = 1;
    const people = s.survivors.slice(0, 5);
    issueGear(site, people);
    const armed = people.filter((p) => p.gear?.weapon);
    expect(armed).toHaveLength(2);
    expect(site.stock.wpn_machete).toBe(0);
    // Người mạnh nhất nhận món mạnh nhất.
    const best = [...people].sort((a, b) => b.xp.melee - a.xp.melee)[0];
    expect(best.gear?.weapon).toBeDefined();
  });

  it('available gear lists only what the site can actually issue, best first', () => {
    const { site } = setup();
    site.stock.wpn_machete = 1;
    site.stock.wpn_crowbar = 1;
    site.stock.helm_m1 = 1;
    const weapons = availableGearList(site, 'weapon');
    expect(weapons).toHaveLength(2);
    expect(weapons[0]).not.toBe(weapons[1]);
    expect(availableGearList(site, 'head')).toEqual(['helm_m1']);
    site.stock.wpn_machete = 0;
    expect(availableGearList(site, 'weapon')).toHaveLength(1);
  });

  it('returning gear puts everything back in the warehouse', () => {
    const { site, v } = setup();
    site.stock.pack_backpack = 1;
    equip(site, v, 'pack', 'pack_backpack');
    const back = returnGear(site, v);
    expect(back).toEqual(['pack_backpack']);
    expect(site.stock.pack_backpack).toBe(1);
    expect(v.gear).toEqual({});
  });
});
