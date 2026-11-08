import { describe, expect, it } from 'vitest';
import { ITEMS, normalizeStock } from '../src/data/items';
import { MODULES } from '../src/data/modules';
import { RECIPES, RECIPE_BY_ID, recipesFor } from '../src/data/recipes';
import { applyBuildWork, maxStationLevel, queueCraft, queueModule, stationLevel, upgradeModule } from '../src/sim/build';
import { newGame } from '../src/sim/state';
import { makeTestWorld } from '../scripts/headless';

function setup() {
  const world = makeTestWorld();
  const b = world.buildings.filter((x) => x.area > 250 && x.area < 900)[0];
  const s = newGame(world, b.id, 42, new Date(2026, 5, 1));
  const site = s.sites[0];
  site.stock.wood = 800;
  site.stock.scrap = 800;
  site.stock.cloth = 400;
  site.stock.stone = 400;
  site.stock.clay = 200;
  site.stock.tools = 5;
  site.stock.parts = 20;
  site.stock.salt = 20;
  site.stock.rawFood = 50000;
  site.stock.water = 300;
  site.stock.plate = 40;
  site.stock.gear = 20;
  site.stock.wire = 40;
  site.stock.stone = 400;
  return { s, site };
}

/** Put a station on a room without going through the build queue. */
function install(site: ReturnType<typeof setup>['site'], module: keyof typeof MODULES, level = 1) {
  const room = site.interior.rooms.find((r) => !r.module && !r.outdoor) ?? site.interior.rooms[0];
  room.module = module as never;
  room.moduleLevel = level;
  return room;
}

describe('craft data', () => {
  it('every recipe points at real items, a real station and a reachable level', () => {
    for (const r of RECIPES) {
      expect(ITEMS[r.out], `output ${r.out}`).toBeDefined();
      expect(MODULES[r.station], `station ${r.station}`).toBeDefined();
      expect(r.level).toBeGreaterThanOrEqual(1);
      expect(r.level).toBeLessThanOrEqual(maxStationLevel(r.station));
      for (const [id, n] of r.in) {
        expect(ITEMS[id], `input ${id} of ${r.id}`).toBeDefined();
        expect(n).toBeGreaterThan(0);
      }
      // One route per item, except staples that several methods legitimately make
      // (cooked meals, preserved food) and the upgrade pairs.
      const routes = RECIPES.filter((x) => x.out === r.out).length;
      const staple = ['meals', 'food', 'water'].includes(r.out);
      expect(routes).toBeLessThanOrEqual(staple ? 4 : 2);
    }
  });

  it('station level gates the recipe list', () => {
    expect(recipesFor('forge', 0)).toHaveLength(0);
    expect(recipesFor('forge', 1).length).toBeGreaterThan(0);
    expect(recipesFor('forge', 2).length).toBeGreaterThan(recipesFor('forge', 1).length);
    // A level-2 recipe must not appear at level 1.
    const lvl2 = RECIPES.filter((r) => r.station === 'forge' && r.level === 2);
    expect(lvl2.length).toBeGreaterThan(0);
    for (const r of lvl2) expect(recipesFor('forge', 1).map((x) => x.id)).not.toContain(r.id);
  });
});

describe('crafting through the build queue', () => {
  it('refuses to craft without the station, then with it too low', () => {
    const { s, site } = setup();
    expect(queueCraft(s, site, 'r_nail')).toContain('Lò rèn');
    install(site, 'forge', 1);
    const plate = RECIPE_BY_ID['r_plate'];
    expect(plate.level).toBe(2);
    expect(queueCraft(s, site, 'r_plate')).toContain('cấp 2');
    expect(queueCraft(s, site, 'r_nail')).toBeNull();
  });

  it('consumes inputs and produces the output when the work finishes', () => {
    const { s, site } = setup();
    install(site, 'forge', 1);
    const before = site.stock.scrap;
    const nailsBefore = site.stock.nail ?? 0;
    expect(queueCraft(s, site, 'r_nail')).toBeNull();
    const p = site.projects[0];
    p.paid = true;
    site.stock.scrap -= p.cost.scrap ?? 0;
    applyBuildWork(s, site, p, p.workTotal + 1);
    expect(site.stock.nail).toBe(nailsBefore + RECIPE_BY_ID['r_nail'].qty);
    expect(site.stock.scrap).toBeLessThan(before);
    expect(site.projects).toHaveLength(0);
  });

  it('a station can be upgraded, and the upgrade raises stationLevel', () => {
    const { s, site } = setup();
    const room = install(site, 'forge', 1);
    expect(stationLevel(site, 'forge')).toBe(1);

    const err = upgradeModule(s, site, room.id);
    expect(err).toBeNull();
    const p = site.projects.find((x) => x.level === 2)!;
    expect(p).toBeDefined();
    // Nâng cấp trả vật tư ngay (giống queueModule/queueCraft), không chờ nhịp ngày.
    if (!p.paid) {
      for (const [k, v] of Object.entries(p.cost)) site.stock[k] = Math.max(site.stock[k] ?? 0, v ?? 0);
      p.paid = true;
      for (const [k, v] of Object.entries(p.cost)) site.stock[k] -= v ?? 0;
    }
    applyBuildWork(s, site, p, p.workTotal + 1);

    expect(stationLevel(site, 'forge')).toBe(2);
    expect(site.interior.rooms.find((r) => r.id === room.id)!.moduleLevel).toBe(2);
    // And now the level-2 recipe is queueable.
    expect(queueCraft(s, site, 'r_plate')).toBeNull();
  });

  it('refuses to exceed the ladder, and refuses a room with no station', () => {
    const { s, site } = setup();
    const room = install(site, 'forge', maxStationLevel('forge'));
    expect(upgradeModule(s, site, room.id)).toContain('tối đa');
    // Every module has a ladder now; an empty room still has nothing to upgrade.
    expect(Object.values(MODULES).every((m) => (m.levels?.length ?? 0) > 0)).toBe(true);
    const empty = site.interior.rooms.find((r) => !r.module)!;
    expect(upgradeModule(s, site, empty.id)).toContain('chưa có công trình');
  });
});

describe('stock registry', () => {
  it('a site stock covers every registered item and survives unknown ids', () => {
    const { site } = setup();
    const keys = Object.keys(site.stock);
    expect(keys.length).toBeGreaterThan(600);
    expect(site.stock.water).toBeGreaterThan(0);
    expect(site.stock.nail).toBe(0); // new item starts at zero, not undefined
    expect(Number.isFinite(site.stock.battery)).toBe(true);
  });

  it('an old 16-item save loads with the new items added at zero', () => {
    const { s } = setup();
    const legacy = {
      ...s,
      version: 2,
      sites: s.sites.map((site) => ({ ...site, stock: { food: 1000, wood: 50 } })),
    };
    // normalizeStock is what migrate() runs on every site.
    const fixed = normalizeStock(legacy.sites[0].stock);
    expect(fixed.food).toBe(1000);
    expect(fixed.wood).toBe(50);
    expect(fixed.plank).toBe(0);
    expect(fixed.wpn_machete).toBe(0);
    expect(Object.keys(fixed).length).toBe(Object.keys(ITEMS).length);
  });
});

describe('stations are modules', () => {
  it('every station a recipe names is a module with a level ladder', () => {
    const stations = new Set(RECIPES.map((r) => r.station));
    for (const st of stations) {
      const def = MODULES[st];
      expect(def, st).toBeDefined();
      expect(def.levels?.length, `${st} has no levels`).toBeGreaterThan(0);
    }
  });

  it('building a station uses the normal module queue', () => {
    const { s, site } = setup();
    install(site, 'workshop', 1); // forge needs a bench somewhere
    const room = site.interior.rooms.find((r) => r.outdoor && !r.module) ?? site.interior.rooms[0];
    room.outdoor = true;
    room.area = 20;
    expect(queueModule(s, site, room.id, 'forge')).toBeNull();
    expect(site.projects.some((p) => p.kind === 'module' && p.module === 'forge')).toBe(true);
  });
});
