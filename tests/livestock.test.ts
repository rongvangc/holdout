import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/items';
import { herdCapacity, herdBudget, startingHerd } from '../src/sim/livestock';
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
    expect(s.log.some((l) => l.msg.includes('thiếu ăn/uống'))).toBe(true);
  });

  it('a bigger barn (higher level) holds more animals', () => {
    expect(herdCapacity(40 * 1.25, 'de')).toBeGreaterThanOrEqual(herdCapacity(40, 'de'));
    expect(herdCapacity(200, 'bo')).toBeLessThan(herdCapacity(200, 'de')); // bò cần nhiều chỗ hơn
  });

  it('milk is edible food', () => {
    expect(ITEMS.sua.mechanic).toBe('food');
    expect(ITEMS.sua.kcal).toBeGreaterThan(0);
    expect(ITEMS.pho_mai.rotPerDay ?? 0).toBeLessThan(0.01);
  });
});

describe('ngân sách chăn nuôi (thu − cám)', () => {
  it('chăn thả trên ruộng thì dê có lãi, nuôi bằng cám trong phố thì lỗ', () => {
    const herd = startingHerd('de', 40);
    herd.adults = 5;
    herd.males = 1;
    herd.lactating = 2;
    const field = herdBudget(herd, 1); // có cỏ
    const city = herdBudget(herd, 0.4); // sân phố
    expect(field.net).toBeGreaterThan(city.net);
    expect(city.net).toBeLessThan(0);
  });

  it('lợn và bò ăn cám thì lỗ nặng — chăn nuôi là nguồn đạm, không phải nguồn calo', () => {
    const pig = startingHerd('lon', 60);
    pig.adults = 5;
    const b = herdBudget(pig, 1);
    expect(b.feed).toBeGreaterThan(b.gain * 5);
    expect(b.proteinServings).toBeGreaterThan(0);
  });

  it('gà cho trứng nhưng vẫn lỗ calo (đúng thực tế)', () => {
    const hens = startingHerd('ga', 40);
    hens.adults = 8;
    hens.males = 1;
    const b = herdBudget(hens, 0.4);
    expect(b.gain).toBeGreaterThan(0);
    expect(b.net).toBeLessThan(0);
  });
});
