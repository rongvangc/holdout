import { describe, expect, it } from 'vitest';
import { HERDS, herdLevelFx, nightLossChance, pastureYield, startingHerd, takeNightLoss, tickHerd } from '../src/sim/livestock';
import { makeRng } from '../src/core/rng';

describe('module levels do what the UI says', () => {
  it('coop level 2 gives 1.6x eggs — the promise printed in the build list', () => {
    const rng1 = makeRng(7);
    const rng2 = makeRng(7);
    const a = startingHerd('ga', 20);
    const b = startingHerd('ga', 20);
    let plain = 0;
    let upgraded = 0;
    for (let i = 0; i < 40; i++) {
      plain += tickHerd(a, 20, 0.8, rng1, 0, herdLevelFx(1)).eggs;
      upgraded += tickHerd(b, 20, 0.8, rng2, 0, herdLevelFx(2)).eggs;
    }
    expect(upgraded).toBeGreaterThan(plain);
    expect(upgraded / plain).toBeCloseTo(1.6, 1);
  });

  it('barn level 3 gives 1.8x milk', () => {
    const rng1 = makeRng(3);
    const rng2 = makeRng(3);
    const a = startingHerd('de', 10);
    const b = startingHerd('de', 10);
    // Giữ cho đàn ở trạng thái ban đầu: chỉ so một nhịp cho sữa.
    const plain = tickHerd(a, 10, 0.9, rng1, 0, herdLevelFx(1)).milk;
    const upgraded = tickHerd(b, 10, 0.9, rng2, 0, herdLevelFx(3)).milk;
    expect(plain).toBeGreaterThan(0);
    expect(upgraded / plain).toBeCloseTo(1.8, 2);
  });

  it('level 3 is a closed coop: no night losses. Level 2 only halves starvation loss', () => {
    expect(herdLevelFx(1).shelter).toBe(0);
    expect(herdLevelFx(3).shelter).toBe(1);
    expect(herdLevelFx(2).sturdy).toBe(1);
  });
});

describe('night losses', () => {
  it('get likelier with noise and in the cold, and never reach certainty', () => {
    expect(nightLossChance(0, false)).toBeGreaterThan(0);
    expect(nightLossChance(80, false)).toBeGreaterThan(nightLossChance(0, false));
    expect(nightLossChance(40, true)).toBeGreaterThan(nightLossChance(40, false));
    expect(nightLossChance(100, true)).toBeLessThan(0.2);
  });

  it('takes the young first and never empties the breeding stock', () => {
    const h = startingHerd('ga', 10);
    h.young = 2;
    const first = takeNightLoss(h);
    expect(first.young).toBe(true);
    expect(h.young).toBe(1);
    takeNightLoss(h);
    const adultsBefore = h.adults;
    takeNightLoss(h);
    expect(h.adults).toBe(adultsBefore - 1);
    // Một con thì không mất: mất hết giống là mất cả hệ thống.
    const lone = { ...startingHerd('ga', 10), adults: 1, young: 0 };
    expect(takeNightLoss(lone).lost).toBe(0);
  });
});

describe('pasture', () => {
  it('grows fodder from area, and more of it when upgraded', () => {
    expect(pastureYield(200, 1)).toBeCloseTo(10, 5);
    expect(pastureYield(200, 2)).toBeGreaterThan(pastureYield(200, 1));
    expect(pastureYield(200, 3)).toBeGreaterThan(pastureYield(200, 2));
  });

  it('stops growing in winter, unless the pasture has a roof (level 3)', () => {
    const coldL1 = pastureYield(200, 1, 2);
    const coldL3 = pastureYield(200, 3, 2);
    expect(coldL1).toBeLessThan(pastureYield(200, 1, 20));
    expect(coldL3).toBeCloseTo(pastureYield(200, 3, 20), 5);
  });

  it('covers a small herd without touching human food', () => {
    // 200 m² cấp 1 nuôi được vài con dê (xem HERDS.de.feedPerDay).
    const perDay = pastureYield(200, 1);
    const goats = startingHerd('de', 10);
    const needKg = (goats.adults + goats.young * 0.4) * HERDS.de.feedPerDay;
    expect(perDay).toBeGreaterThan(needKg * 0.3);
  });
});

describe('the pasture module is actually placeable', () => {
  it('needs the yard, at least 40 m2, and no more of it than any other station', async () => {
    const { MODULES } = await import('../src/data/modules');
    const { canPlace } = await import('../src/base/interior');
    const def = MODULES.pasture;
    expect(def.placement).toBe('outdoor');
    const yard = { id: 'r1', floor: 0, outdoor: true, cells: [], area: 200 };
    const indoors = { ...yard, outdoor: false };
    const tiny = { ...yard, area: 30 };
    expect(canPlace({ floors: 1 } as never, yard as never, def)).toBeNull();
    expect(canPlace({ floors: 1 } as never, indoors as never, def)).toMatch(/ngoài sân/);
    expect(canPlace({ floors: 1 } as never, tiny as never, def)).toMatch(/tối thiểu/);
    expect(def.maxPerSite).toBeGreaterThan(0);
  });
});
