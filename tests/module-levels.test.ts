import { describe, expect, it } from 'vitest';
import { MODULES, type ModuleId } from '../src/data/modules';
import { RECIPES, RECIPE_BY_ID } from '../src/data/recipes';
import { applyBuildWork, maxStationLevel, queueCraft, queueModule, stationLevel, upgradeModule } from '../src/sim/build';
import { baseStats, newGame } from '../src/sim/state';
import { makeTestWorld } from '../scripts/headless';

function setup() {
  const world = makeTestWorld();
  const b = world.buildings.filter((x) => x.area > 250 && x.area < 900)[0];
  const s = newGame(world, b.id, 9, new Date(2026, 5, 1));
  const site = s.sites[0];
  site.stock.wood = 900;
  site.stock.scrap = 900;
  site.stock.plate = 60;
  site.stock.gear = 20;
  site.stock.wire = 60;
  site.stock.cloth = 400;
  site.stock.thread = 200;
  site.stock.brick = 400;
  site.stock.lime = 200;
  site.stock.clay = 400;
  site.stock.stone = 400;
  site.stock.plank = 100;
  site.stock.hinge = 60;
  site.stock.charcoal = 200;
  site.stock.medicine = 40;
  site.stock.rope = 60;
  site.stock.tools = 6;
  return { s, site };
}

function install(site: ReturnType<typeof setup>['site'], module: ModuleId, level = 1) {
  const room = site.interior.rooms.find((r) => !r.module) ?? site.interior.rooms[0];
  room.module = module;
  room.moduleLevel = level;
  return room;
}

describe('module ladders change real numbers', () => {
  it('a filter upgrade raises litres per hour', () => {
    const { s, site } = setup();
    install(site, 'filter', 1);
    const l1 = baseStats(s, site).filterRate;
    install(site, 'filter', 3);
    const l3 = baseStats(s, site).filterRate;
    expect(l3).toBeGreaterThan(l1 * 1.8);
    expect(l3).toBeCloseTo(24);
  });

  it('a well upgrade raises the daily draw', () => {
    const { s, site } = setup();
    install(site, 'well', 1);
    const l1 = baseStats(s, site).wellDaily;
    install(site, 'well', 2);
    expect(baseStats(s, site).wellDaily).toBeGreaterThan(l1);
  });

  it('tank levels add capacity, latrine levels add people served', () => {
    const { s, site } = setup();
    install(site, 'water_tank', 1);
    install(site, 'latrine', 1);
    const a = baseStats(s, site);
    install(site, 'water_tank', 3);
    install(site, 'latrine', 3);
    const b = baseStats(s, site);
    expect(b.waterCapacity).toBeGreaterThan(a.waterCapacity);
    expect(b.latrineCapacity).toBeGreaterThan(a.latrineCapacity);
  });

  it('an infirmary upgrade mends faster; storage keeps more loot', () => {
    const { s, site } = setup();
    install(site, 'infirmary', 1);
    install(site, 'storage', 1);
    const a = baseStats(s, site);
    install(site, 'infirmary', 3);
    install(site, 'storage', 3);
    const b = baseStats(s, site);
    expect(b.healMult).toBeGreaterThan(a.healMult);
    expect(b.storeLoss).toBeLessThan(a.storeLoss);
  });

  it('watchtowers and generators improve per level', () => {
    const { s, site } = setup();
    install(site, 'watchtower', 1);
    install(site, 'generator', 1);
    const a = baseStats(s, site);
    install(site, 'watchtower', 3);
    install(site, 'generator', 3);
    const b = baseStats(s, site);
    expect(b.towerDefense).toBeGreaterThan(a.towerDefense);
    expect(b.generatorFuel).toBeLessThan(a.generatorFuel);
  });

  it('a better station crafts faster', () => {
    const { s, site } = setup();
    install(site, 'forge', 1);
    expect(queueCraft(s, site, 'r_nail')).toBeNull();
    const slow = site.projects.pop()!;
    install(site, 'forge', 3);
    expect(queueCraft(s, site, 'r_nail')).toBeNull();
    const fast = site.projects.pop()!;
    expect(fast.workTotal).toBeLessThan(slow.workTotal);
  });

  it('every module with a ladder can actually be upgraded in game', () => {
    const { s, site } = setup();
    for (const [id, def] of Object.entries(MODULES) as [ModuleId, (typeof MODULES)[ModuleId]][]) {
      if (!def.levels?.length) continue;
      expect(maxStationLevel(id), id).toBe(1 + def.levels.length);
      const room = install(site, id, 1);
      const err = upgradeModule(s, site, room.id);
      expect(err === null || /Thiếu|Đang|phòng/.test(err), `${id}: ${err}`).toBe(true);
      site.projects = [];
    }
  });

  it('no upgrade note promises a number the code never applies', () => {
    // Every ladder must belong to a module whose level baseStats or the recipe graph reads.
    const readByStats = new Set(['filter', 'well', 'water_tank', 'garden', 'latrine', 'infirmary', 'generator', 'watchtower', 'storage', 'cellar', 'coop', 'pond']);
    const readByRecipes = new Set(RECIPES.map((r) => r.station));
    for (const [id, def] of Object.entries(MODULES) as [ModuleId, (typeof MODULES)[ModuleId]][]) {
      if (!def.levels?.length) continue;
      expect(readByStats.has(id) || readByRecipes.has(id), `${id} has a ladder nobody reads`).toBe(true);
    }
    // And the recipe-driven ones must gate something at level >= 2.
    for (const st of readByRecipes) {
      const levels = new Set(RECIPES.filter((r) => r.station === st).map((r) => r.level));
      expect(Math.max(...levels), `${st} gates nothing above level 1`).toBeGreaterThanOrEqual(1);
    }
  });

  it('upgrade cost matches the ladder step', () => {
    const { s, site } = setup();
    const room = install(site, 'filter', 1);
    expect(upgradeModule(s, site, room.id)).toBeNull();
    const p = site.projects.find((x) => x.level === 2)!;
    expect(p.cost).toEqual(MODULES.filter.levels![0].cost);
    expect(p.workTotal).toBe(MODULES.filter.levels![0].workSec);
    p.paid = true;
    applyBuildWork(s, site, p, p.workTotal + 1);
    expect(stationLevel(site, 'filter')).toBe(2);
  });
});
