import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/items';
import { RECIPES, RECIPE_BY_ID, resolveInputs, STAPLE_TAG } from '../src/data/recipes';
import { regionStaple, regionStapleAlt, STAPLE_IDS } from '../src/data/staples';
import { queueCraft, stationLevel } from '../src/sim/build';
import { newGame } from '../src/sim/state';
import { makeTestWorld } from '../scripts/headless';

function setup(latitude?: number) {
  const world = makeTestWorld();
  const b = world.buildings.filter((x) => x.area > 250 && x.area < 900)[0];
  const s = newGame(world, b.id, 77, new Date(2026, 5, 1));
  if (latitude !== undefined) s.latitude = latitude;
  return { s, site: s.sites[0] };
}

describe('staples follow the climate', () => {
  it('tropics get rice, temperate gets wheat, cold gets potatoes', () => {
    expect(regionStaple(10)).toBe('gao'); // Hà Nội
    expect(regionStaple(-20)).toBe('gao'); // southern tropics
    expect(regionStaple(40)).toBe('lua_mi'); // Madrid
    expect(regionStaple(55)).toBe('khoai_tay'); // Moscow
    expect(regionStapleAlt(10)).toBe('san');
    expect(regionStapleAlt(55)).toBe('lua_mi');
  });

  it('every staple is a real item with kcal and a spoilage rate', () => {
    for (const id of STAPLE_IDS) {
      const def = ITEMS[id];
      expect(def, id).toBeDefined();
      if (id === 'rawFood') continue; // legacy bucket counts itself in kcal
      expect(def.kcal ?? 0, id).toBeGreaterThan(0);
      expect(def.rotPerDay ?? 0, id).toBeGreaterThan(0);
    }
  });

  it('potatoes are heavy for their calories — the trade is real', () => {
    const rice = ITEMS.gao.kcal! / ITEMS.gao.kgPerUnit;
    const potato = ITEMS.khoai_tay.kcal! / ITEMS.khoai_tay.kgPerUnit;
    expect(potato).toBeLessThan(rice / 3);
    expect(ITEMS.khoai_tay.rotPerDay!).toBeGreaterThan(ITEMS.gao.rotPerDay!);
  });
});

describe('@staple in recipes', () => {
  it('cooking recipes ask for a staple, not for one specific grain', () => {
    const meals = RECIPE_BY_ID['r_meals'];
    expect(meals.in.some(([id]) => id === STAPLE_TAG)).toBe(true);
    // No cooking recipe should still hard-code the old bucket.
    const hardCoded = RECIPES.filter((r) => r.station === 'kitchen' && r.in.some(([id]) => id === 'rawFood'));
    expect(hardCoded.map((r) => r.id)).toEqual([]);
  });

  it('resolves to whichever starch the site actually has', () => {
    const { s, site } = setup(10);
    site.stock.gao = 0;
    site.stock.khoai_tay = 50; // 38.500 kcal, more than any rice stock
    const [item] = resolveInputs(RECIPE_BY_ID['r_meals'], site.stock, s.latitude);
    expect(item[0]).toBe('khoai_tay');
  });

  it('falls back to the region so the error message names the right food', () => {
    const cold = setup(55);
    const [item] = resolveInputs(RECIPE_BY_ID['r_meals'], {}, cold.s.latitude);
    expect(item[0]).toBe('khoai_tay');
  });

  it('staple amounts are kcal, so potatoes are measured in the kilos they need', () => {
    const { s } = setup(55);
    const [item] = resolveInputs(RECIPE_BY_ID['r_meals'], { khoai_tay: 100 }, s.latitude);
    // 3000 kcal of potatoes at 770 kcal/kg
    expect(item[1]).toBeCloseTo(3000 / 770, 3);
  });

  it('a cold-climate colony can cook with potatoes', () => {
    const { s, site } = setup(55);
    for (const id of STAPLE_IDS) site.stock[id] = 0; // empty the pantry first
    site.stock.khoai_tay = 20; // 15.400 kcal
    site.stock.water = 50;
    site.stock.wood = 20;
    const room = site.interior.rooms[0];
    room.module = 'kitchen';
    room.moduleLevel = 1;
    expect(stationLevel(site, 'kitchen')).toBe(1);
    expect(queueCraft(s, site, 'r_meals')).toBeNull();
    const p = site.projects[site.projects.length - 1];
    expect(p.cost.khoai_tay).toBeDefined();
    expect(p.cost.gao).toBeUndefined();
  });
});
