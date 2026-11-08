import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/items';
import { CATS } from '../src/data/categories';
import { RECIPES } from '../src/data/recipes';
import { gearPool, POOL_CATS } from '../src/data/lootPools';

const craftable = new Set(RECIPES.map((r) => r.out));
const staticLoot = new Set<string>();
for (const c of Object.values(CATS)) for (const e of c.loot) staticLoot.add(e[0]);
const pooled = new Set<string>();
for (const cat of POOL_CATS) for (const [id] of gearPool(cat)) pooled.add(id);

describe('catalogue coverage', () => {
  // Cổng chặn data chết: mỗi món phải có đường lấy (chế, loot tĩnh, hoặc pool theo loại nhà).
  it('every item is obtainable somehow', () => {
    const dead = Object.keys(ITEMS).filter((id) => !craftable.has(id) && !staticLoot.has(id) && !pooled.has(id));
    expect(dead, `không lấy được: ${dead.join(', ')}`).toEqual([]);
  });

  it('every building type yields something', () => {
    for (const cat of POOL_CATS) expect(gearPool(cat).length, cat).toBeGreaterThan(0);
  });

  it('rare items are rarer than common ones of the same mechanic', () => {
    const pool = gearPool('police');
    const weightOf = (id: string) => pool.find(([x]) => x === id)?.[1] ?? 0;
    const rares = pool.filter(([id]) => ITEMS[id].rare);
    const commons = pool.filter(([id]) => !ITEMS[id].rare && ITEMS[id].mechanic === 'helmet');
    expect(rares.length).toBeGreaterThan(0);
    if (commons.length && rares.length) {
      const minRare = Math.min(...rares.map(([id]) => weightOf(id)));
      const maxCommon = Math.max(...commons.map(([id]) => weightOf(id)));
      expect(minRare).toBeLessThan(maxCommon);
    }
  });

  it('gear stats needed by the simulation are filled in', () => {
    for (const [id, d] of Object.entries(ITEMS)) {
      if ((d.mechanic ?? '').startsWith('weapon') || d.mechanic === 'firearm') {
        expect(d.dmg, id).toBeGreaterThan(0);
        expect(d.pierce, id).toBeDefined();
      }
      if (['armor_soft', 'armor_plate', 'vest', 'helmet', 'mask'].includes(d.mechanic ?? '')) expect(d.mitigation, id).toBeGreaterThan(0);
      if (['backpack', 'container'].includes(d.mechanic ?? '')) expect(d.capacity, id).toBeGreaterThan(0);
      if (['clothes', 'boots', 'gloves'].includes(d.mechanic ?? '')) expect(d.insulation, id).toBeGreaterThan(0);
    }
  });
});
