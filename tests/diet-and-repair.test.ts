import { describe, expect, it } from 'vitest';
import { CATS } from '../src/data/categories';
import { ITEMS } from '../src/data/items';
import { RECIPES } from '../src/data/recipes';
import { ammoFor, bestWeapon, conditionOf, needsRepair, wearWeapon } from '../src/sim/equipment';
import { isMonotone, isVegetable, MONOTONY_MEALS, rotFactor, SCURVY_DAYS } from '../src/sim/diet';
import { applyBuildWork, queueRepair, stationLevel } from '../src/sim/build';
import { baseStats, newGame } from '../src/sim/state';
import { makeTestWorld } from '../scripts/headless';

function setup() {
  const world = makeTestWorld();
  const b = world.buildings.filter((x) => x.area > 250 && x.area < 900)[0];
  const s = newGame(world, b.id, 11, new Date(2026, 5, 1));
  const site = s.sites[0];
  site.stock.scrap = 500;
  site.stock.charcoal = 100;
  return { s, site };
}

const find = (pred: (id: string, d: (typeof ITEMS)[string]) => boolean) =>
  Object.entries(ITEMS).find(([id, d]) => pred(id, d))?.[0] as string;

describe('ammunition', () => {
  it('a gun without its cartridge is not fielded', () => {
    const { site } = setup();
    const gun = find((_id, d) => d.mechanic === 'firearm');
    const ammo = ammoFor(gun);
    expect(ammo).toBeTruthy();
    site.stock[gun] = 1;
    site.stock[ammo!] = 0;
    expect(bestWeapon(site)).toBeNull();
    site.stock[ammo!] = 4;
    expect(bestWeapon(site)?.id).toBe(gun);
  });

  it('firing spends cartridges', () => {
    const { s, site } = setup();
    const gun = find((_id, d) => d.mechanic === 'firearm');
    const ammo = ammoFor(gun)!;
    site.stock[gun] = 1;
    site.stock[ammo] = 5;
    const w = bestWeapon(site)!;
    wearWeapon(s, site, w, 2);
    expect(site.stock[ammo]).toBe(3);
  });

  it('every firearm in the catalog resolves to a cartridge that exists', () => {
    let checked = 0;
    for (const [id, d] of Object.entries(ITEMS)) {
      if (d.mechanic !== 'firearm') continue;
      const a = ammoFor(id);
      expect(a, `no ammo rule for ${id} (${d.label})`).toBeTruthy();
      expect(ITEMS[a!]).toBeDefined();
      checked++;
    }
    expect(checked).toBeGreaterThan(5);
  });
});

describe('ammunition is found, never made', () => {
  it('no recipe produces ammo', () => {
    const ammoCr = RECIPES.filter((r) => ITEMS[r.out]?.mechanic === 'ammo');
    expect(ammoCr.map((r) => r.id)).toEqual([]);
  });

  it('every recipe input chain stays free of ammo too', () => {
    for (const r of RECIPES) {
      for (const [id] of r.in) {
        expect(ITEMS[id]?.mechanic, `${r.id} takes ${id}`).not.toBe('ammo');
      }
    }
  });

  it('every cartridge the guns use appears in at least one loot table', () => {
    const lootIds = new Set<string>();
    for (const cat of Object.values(CATS)) for (const [id] of cat.loot) lootIds.add(id);
    const wanted = new Set<string>();
    for (const [id, d] of Object.entries(ITEMS)) {
      if (d.mechanic !== 'firearm') continue;
      const a = ammoFor(id);
      if (a) wanted.add(a);
    }
    expect(wanted.size).toBeGreaterThan(0);
    for (const a of wanted) expect(lootIds.has(a), `${a} is not in any loot table`).toBe(true);
  });
});

describe('wear and repair', () => {
  it('worn weapons hit softer, then break and leave scrap', () => {
    const { s, site } = setup();
    const blade = find((_id, d) => d.mechanic === 'weapon_blade' && (d.durability ?? 0) > 0);
    site.stock[blade] = 1;
    const fresh = bestWeapon(site)!;
    const before = fresh.mitigation;

    wearWeapon(s, site, fresh, Math.floor(fresh.durability * 0.5));
    expect(conditionOf(site, blade)).toBeLessThan(1);
    const worn = bestWeapon(site)!;
    expect(worn.mitigation).toBeLessThan(before);
    expect(needsRepair(worn)).toBe(true);

    const scrapBefore = site.stock.scrap;
    const res = wearWeapon(s, site, worn, worn.durability * 2);
    expect(res.broke).toBe(true);
    expect(site.stock[blade]).toBe(0);
    expect(site.stock.scrap).toBeGreaterThan(scrapBefore);
  });

  it('repair needs a forge at level 2 and restores condition through the queue', () => {
    const { s, site } = setup();
    const blade = find((_id, d) => d.mechanic === 'weapon_blade' && (d.durability ?? 0) > 0);
    site.stock[blade] = 1;
    const w = bestWeapon(site)!;
    wearWeapon(s, site, w, Math.floor(w.durability * 0.6));
    expect(queueRepair(s, site, blade)).toContain('lò rèn cấp 2');

    const room = site.interior.rooms.find((r) => !r.module) ?? site.interior.rooms[0];
    room.module = 'forge';
    room.moduleLevel = 2;
    expect(stationLevel(site, 'forge')).toBe(2);
    expect(queueRepair(s, site, blade)).toBeNull();

    const p = site.projects.find((x) => x.kind === 'repair')!;
    expect(p.recipe).toBe(blade);
    p.paid = true;
    applyBuildWork(s, site, p, p.workTotal + 1);
    expect(conditionOf(site, blade)).toBe(1);
    expect(bestWeapon(site)!.condition).toBe(1);
  });
});

describe('diet rules', () => {
  it('nine identical meals read as monotony, a change clears it', () => {
    expect(isMonotone(Array(MONOTONY_MEALS - 1).fill('meals'))).toBe(false);
    expect(isMonotone(Array(MONOTONY_MEALS).fill('meals'))).toBe(true);
    expect(isMonotone([...Array(MONOTONY_MEALS - 1).fill('meals'), 'food_rice'])).toBe(false);
    expect(isMonotone(undefined)).toBe(false);
  });

  it('knows which foods carry vitamin C', () => {
    expect(isVegetable('Apple')).toBe(true);
    expect(isVegetable('Lemon')).toBe(true);
    expect(isVegetable('Potato')).toBe(true);
    expect(isVegetable('MRE')).toBe(false);
    expect(isVegetable('Tin')).toBe(false);
    expect(SCURVY_DAYS).toBe(25);
  });

  it('a cellar slows rot more than a locked store', () => {
    expect(rotFactor(0, false)).toBe(1);
    expect(rotFactor(0, true)).toBe(0.5);
    expect(rotFactor(1, false)).toBe(0.5);
    expect(rotFactor(2, false)).toBe(0.35);
    expect(rotFactor(3, false)).toBe(0.25);
    expect(rotFactor(3, false)).toBeLessThan(rotFactor(1, false));
  });

  it('the cellar module reports its level to baseStats', () => {
    const { s, site } = setup();
    expect(baseStats(s, site).cellar).toBe(0);
    const room = site.interior.rooms.find((r) => !r.module) ?? site.interior.rooms[0];
    room.module = 'cellar';
    room.moduleLevel = 2;
    expect(baseStats(s, site).cellar).toBe(2);
  });
});
