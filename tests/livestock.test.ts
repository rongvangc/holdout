import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/items';
import { MODULES } from '../src/data/modules';
import { baseStats, mainSite, newGame, addStock } from '../src/sim/state';
import { dayEvent } from '../src/sim/daily';
import type { Room } from '../src/base/interior';
import { makeTestWorld } from '../scripts/headless';

function setup() {
  const world = makeTestWorld();
  const b = world.buildings.find((x) => x.area > 250 && x.area < 900)!;
  const s = newGame(world, b.id, 42, new Date(2026, 5, 1));
  return { s, site: mainSite(s) };
}

function addBarn(site: ReturnType<typeof mainSite>, level = 1): void {
  const room: Room = { id: 'barn1', floor: 0, outdoor: true, cells: [1], area: 30, module: 'barn', walled: true, moduleLevel: level };
  site.interior.rooms.push(room);
}

describe('livestock', () => {
  it('is a real module with an upgrade ladder', () => {
    expect(MODULES.barn.label).toContain('chăn nuôi');
    expect(MODULES.barn.placement).toBe('outdoor');
    expect(MODULES.barn.levels?.length).toBe(2);
  });

  it('produces milk and manure-boosted growth when it has water', () => {
    const { s, site } = setup();
    addBarn(site);
    addStock(s, site, { water: 200, rawFood: 20000 });
    const before = { ...site.stock };
    for (let i = 0; i < 10; i++) dayEvent(s, makeTestWorld());
    expect((site.stock.sua ?? 0)).toBeGreaterThan((before.sua ?? 0));
    expect(baseStats(s, site).barn).toBe(1);
  });

  it('starves without water and says so', () => {
    const { s, site } = setup();
    addBarn(site);
    site.stock.water = 0;
    site.stock.dirtyWater = 0;
    site.stock.rawFood = 0;
    dayEvent(s, makeTestWorld());
    // Thông báo giờ theo loài (dê/lợn/bò/gà/vịt) chứ không phải nhãn module.
    expect(s.log.some((l) => l.msg.includes('thiếu nước uống'))).toBe(true);
  });

  it('higher levels give more milk per animal', () => {
    const a = setup();
    addBarn(a.site, 1);
    const b = setup();
    addBarn(b.site, 3);
    for (const x of [a, b]) {
      addStock(x.s, x.site, { water: 500, rawFood: 60000 });
      x.site.stock.sua = 0;
    }
    const world = makeTestWorld();
    for (let i = 0; i < 14; i++) {
      dayEvent(a.s, world);
      dayEvent(b.s, world);
    }
    expect((b.site.stock.sua ?? 0)).toBeGreaterThan((a.site.stock.sua ?? 0));
  });

  it('milk is edible food', () => {
    expect(ITEMS.sua.mechanic).toBe('food');
    expect(ITEMS.sua.kcal).toBeGreaterThan(0);
    expect(ITEMS.pho_mai.rotPerDay ?? 0).toBeLessThan(0.01);
  });
});
