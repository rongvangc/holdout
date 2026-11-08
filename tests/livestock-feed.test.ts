import { describe, expect, it } from 'vitest';
import { addStock, mainSite, newGame, present } from '../src/sim/state';
import { dayEvent } from '../src/sim/daily';
import { herdCapacity, startingHerd } from '../src/sim/livestock';
import { makeTestWorld } from '../scripts/headless';
import type { Room } from '../src/base/interior';

function setup(kind: 'ga' | 'de' | 'lon' = 'de', outdoor = true) {
  const world = makeTestWorld();
  const b = world.buildings.find((x) => x.area > 250 && x.area < 900)!;
  const s = newGame(world, b.id, 42, new Date(2026, 5, 1));
  const site = mainSite(s);
  const room: Room = { id: 'b1', floor: 0, outdoor, cells: [1], area: 40, module: kind === 'ga' ? 'coop' : 'barn', walled: true, moduleLevel: 1, herd: kind };
  site.interior.rooms.push(room);
  room.herdState = startingHerd(kind, herdCapacity(room.area, kind));
  return { s, site, room, world };
}

describe('B5 — bầy không bao giờ ăn vào khẩu phần của người', () => {
  it('dưới 10 ngày lương thì không lấy một hạt gạo nào', () => {
    const { s, site, world } = setup('de');
    const people = present(s, site).length;
    site.stock.rawFood = 2250 * people * 4; // chỉ 4 ngày
    site.stock.food = 0;
    site.stock.meals = 0;
    site.stock.water = 0;
    site.stock.dirtyWater = 0; // thiếu cả nước → care thấp, phải có cảnh báo
    const before = site.stock.rawFood;
    dayEvent(s, world);
    // Chỉ được hao do hỏng vụn (2%/ngày), KHÔNG được bị bầy ăn.
    expect(site.stock.rawFood).toBeGreaterThan(before * 0.95);
    expect(s.log.some((l) => l.msg.includes('thiếu ăn/uống'))).toBe(true);
  });

  it('có dư thì ăn đúng phần dư, chừa lại 10 ngày lương', () => {
    const { s, site, world } = setup('de');
    const people = present(s, site).length;
    const reserve = 2250 * people * 10;
    site.stock.rawFood = reserve + 30000;
    addStock(s, site, { water: 2000, dirtyWater: 2000 } as never);
    dayEvent(s, world);
    expect(site.stock.rawFood).toBeGreaterThanOrEqual(reserve - 1);
    expect(site.stock.rawFood).toBeLessThan(reserve + 30000); // đã ăn một ít
  });
});

describe('B6 — nước cho bầy: bẩn trước, nước sạch chỉ khi người còn dư', () => {
  it('uống nước bẩn trước khi đụng nước sạch', () => {
    const { s, site, world } = setup('de');
    site.stock.rawFood = 2250 * 20 * 10 + 50000;
    site.stock.water = 500;
    site.stock.dirtyWater = 500;
    const cleanBefore = site.stock.water;
    dayEvent(s, world);
    expect(site.stock.dirtyWater).toBeLessThan(500);
    expect(site.stock.water).toBe(cleanBefore); // chưa cần nước sạch
  });

  it('không lấy nước sạch khi người dưới 3 ngày', () => {
    const { s, site, world } = setup('de');
    const people = present(s, site).length;
    site.stock.rawFood = 2250 * 20 * 10 + 50000;
    site.stock.water = 3.3 * people * 2; // 2 ngày
    site.stock.dirtyWater = 0;
    const before = site.stock.water;
    dayEvent(s, world);
    expect(site.stock.water).toBe(before);
  });
});

describe('B7 — chăm đủ thì bầy phải khoẻ (care ~1)', () => {
  it('đủ cám + đủ nước → care cao, không mất con', () => {
    const { s, site, room, world } = setup('de');
    const h = room.herdState!;
    const adults = h.adults;
    site.stock.rawFood = 2250 * 20 * 10 + 200000;
    site.stock.water = 5000;
    site.stock.dirtyWater = 5000;
    for (let i = 0; i < 3; i++) dayEvent(s, world);
    // sữa phải được sản xuất đều (care cao), và bầy không bị hao hụt vì đói
    expect(site.stock.sua ?? 0).toBeGreaterThan(0);
    expect(h.adults).toBe(adults);
    expect(s.log.some((l) => l.msg.includes('gầy đi'))).toBe(false);
  });
});
