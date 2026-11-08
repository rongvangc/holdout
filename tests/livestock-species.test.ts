import { describe, expect, it } from 'vitest';
import { HERDS, localHerds, herdFor } from '../src/sim/livestock';
import type { World } from '../src/world/types';
import { newGame, mainSite, addStock, baseStats } from '../src/sim/state';
import { dayEvent } from '../src/sim/daily';
import { makeTestWorld } from '../scripts/headless';
import type { Room } from '../src/base/interior';

/** Bản đồ giả: điều khiển được nước / diện tích ruộng / vĩ độ. */
function stubWorld(opts: { water: boolean; farmland: number; lat: number }): World {
  const base = makeTestWorld();
  // Đặt nước/ruộng ngay tại toà nhà sẽ làm căn cứ để khoảng cách = 0.
  const anchor = base.buildings.find((x) => x.area > 250 && x.area < 900)!;
  const at = anchor.centroid;
  const greens = opts.farmland
    ? [{ ...base.greens[0], id: 'g1', area: opts.farmland, centroid: at }]
    : [];
  const waterPoints = opts.water ? [{ ...base.waterPoints[0], id: 'w1', pos: at }] : [];
  return { ...base, greens, waterPoints, center: [opts.lat, 106], greenArea: opts.farmland };
}

function site(world: World) {
  const b = world.buildings.find((x) => x.area > 250 && x.area < 900)!;
  const s = newGame(world, b.id, 42, new Date(2026, 5, 1));
  return { s, site: mainSite(s) };
}

describe('species depend on the map', () => {
  it('near water and open farmland in the north → buffalo and ducks', () => {
    const w = stubWorld({ water: true, farmland: 40_000, lat: 21 });
    expect(localHerds(w, site(w).site)).toEqual({ coop: 'vit', barn: 'trau' });
  });

  it('southern open farmland → cattle, and ducks if there is water', () => {
    const w = stubWorld({ water: true, farmland: 40_000, lat: 10.7 });
    expect(localHerds(w, site(w).site)).toEqual({ coop: 'vit', barn: 'bo' });
  });

  it('paddies without water points → pigs, chickens', () => {
    const w = stubWorld({ water: false, farmland: 10_000, lat: 16 });
    expect(localHerds(w, site(w).site)).toEqual({ coop: 'ga', barn: 'lon' });
  });

  it('a city block with no farmland → goats and chickens', () => {
    const w = stubWorld({ water: false, farmland: 0, lat: 16 });
    expect(localHerds(w, site(w).site)).toEqual({ coop: 'ga', barn: 'de' });
  });

  it('a stored species wins over the map default (existing buildings keep their herd)', () => {
    const w = stubWorld({ water: false, farmland: 0, lat: 16 });
    expect(herdFor(w, site(w).site, 'barn', 'bo')).toBe('bo');
  });
});

describe('herd products', () => {
  const addRoom = (r: Room) => r;

  it('poultry lays eggs, goats and cattle give milk, pigs give meat', () => {
    expect(HERDS.ga.eggs).toBeGreaterThan(0);
    expect(HERDS.vit.eggs).toBeGreaterThan(HERDS.ga.eggs);
    expect(HERDS.de.milk).toBeGreaterThan(0);
    expect(HERDS.bo.milk).toBeGreaterThan(HERDS.de.milk);
    expect(HERDS.lon.meat).toBeGreaterThan(HERDS.ga.meat);
    expect(HERDS.ga.milk).toBe(0);
  });

  it('a coop of ducks produces eggs day after day', () => {
    const w = stubWorld({ water: true, farmland: 0, lat: 16 });
    const { s, site: base } = site(w);
    base.interior.rooms.push(addRoom({ id: 'c1', floor: 0, outdoor: true, cells: [1], area: 20, module: 'coop', walled: true, moduleLevel: 1, herd: 'vit' }));
    addStock(s, base, { water: 400, rawFood: 20000 });
    base.stock.trung = 0;
    for (let i = 0; i < 5; i++) dayEvent(s, w);
    expect(base.stock.trung ?? 0).toBeGreaterThan(5);
  });

  it('a barn of goats gives milk, not eggs', () => {
    const w = stubWorld({ water: false, farmland: 0, lat: 16 });
    const { s, site: base } = site(w);
    base.interior.rooms.push(addRoom({ id: 'b1', floor: 0, outdoor: true, cells: [2], area: 40, module: 'barn', walled: true, moduleLevel: 1, herd: 'de' }));
    addStock(s, base, { water: 400, rawFood: 20000 });
    base.stock.sua = 0;
    base.stock.trung = 0;
    for (let i = 0; i < 5; i++) dayEvent(s, w);
    expect(base.stock.sua ?? 0).toBeGreaterThan(3);
    expect(base.stock.trung ?? 0).toBe(0);
    expect(baseStats(s, base).barn).toBe(1);
  });
});
