import { describe, expect, it } from 'vitest';
import { CROPS, TEND_H_PER_M2_DAY } from '../src/sim/data';
import { handleStrangers } from '../src/sim/lifecycle';
import { addStock, mainSite, newGame } from '../src/sim/state';
import { makeSurvivor } from '../src/sim/survivors';
import { makeTestWorld } from '../scripts/headless';
import { makeRng } from '../src/core/rng';

function setup() {
  const world = makeTestWorld();
  const b = world.buildings.find((x) => x.area > 250 && x.area < 900)!;
  const s = newGame(world, b.id, 42, new Date(2026, 5, 1));
  return { s, site: mainSite(s) };
}

describe('crop economy', () => {
  it('yields stay in the range real farming achieves (kcal/m²/day)', () => {
    const rauPerDay = CROPS.rau.kcalPerM2 / CROPS.rau.days;
    const khoaiPerDay = CROPS.khoai.kcalPerM2 / CROPS.khoai.days;
    // Rau: 2–6 kcal/m²/ngày là mức vườn thật; 78 từng làm 1 nông dân nuôi 92 người.
    expect(rauPerDay).toBeGreaterThan(1.5);
    expect(rauPerDay).toBeLessThan(8);
    // Khoai là cây lương thực: 8–16 kcal/m²/ngày.
    expect(khoaiPerDay).toBeGreaterThan(7);
    expect(khoaiPerDay).toBeLessThan(18);
    // Chu kỳ quay vòng được trong một ván 120 ngày.
    expect(CROPS.rau.days * 4).toBeLessThanOrEqual(120);
    expect(CROPS.khoai.days).toBeLessThanOrEqual(120);
  });

  it('one farmer feeds a household, not a village', () => {
    const khoaiPerHour = (1 / TEND_H_PER_M2_DAY) * (CROPS.khoai.kcalPerM2 / CROPS.khoai.days);
    const peoplePerFarmer = (khoaiPerHour * 8) / 2250;
    expect(peoplePerFarmer).toBeGreaterThan(4);
    expect(peoplePerFarmer).toBeLessThan(25);
  });

  it('tending a big field is a day of work, not a week', () => {
    expect(3400 * TEND_H_PER_M2_DAY).toBeLessThanOrEqual(12);
  });
});

describe('population is limited by supply', () => {
  const strangers = (n: number) => Array.from({ length: n }, (_, i) => makeSurvivor(makeRng(i + 1), `sx${i}`, 2));

  it('refuses newcomers when the larder is nearly empty', () => {
    const { s, site } = setup();
    for (const v of s.survivors) v.status = 'dead'; // chỉ còn nhóm mới
    s.survivors = [];
    addStock(s, site, { food: 0, rawFood: 0, meals: 0 });
    site.stock.food = 2000; // dưới 1 ngày
    handleStrangers(s, strangers(3), 'ở cổng', site.id);
    expect(s.survivors.filter((v) => v.status === 'alive' && v.siteId === site.id).length).toBe(0);
  });

  it('accepts only as many as the larder can carry', () => {
    const { s, site } = setup();
    const before = s.survivors.filter((v) => v.status === 'alive').length;
    site.stock.food = 2250 * before * 24; // 24 ngày cho số người hiện có
    s.laws.strangers = 'accept';
    handleStrangers(s, strangers(8), 'ở cổng', site.id);
    const joined = s.survivors.filter((v) => v.status === 'alive').length - before;
    expect(joined).toBeGreaterThan(0);
    expect(joined).toBeLessThan(8);
  });
});
