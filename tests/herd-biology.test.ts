import { describe, expect, it } from 'vitest';
import { HERDS, herdCapacity, herdNeeds, startingHerd, tickHerd, estimateMeat } from '../src/sim/livestock';
import { makeRng } from '../src/core/rng';

const rng = () => makeRng(7);

describe('laying rhythm', () => {
  it('chickens lay at their real interval, not a daily fixed number', () => {
    // 5 con mái gà ta: mỗi con 1 quả/1,6 ngày → 10 ngày được ~31 quả (không phải 50).
    const h = { ...startingHerd('ga', 40), adults: 6, males: 1, eggDebt: 0 };
    let eggs = 0;
    for (let d = 0; d < 10; d++) eggs += tickHerd(h, 40, 1, rng()).eggs;
    const hens = h.adults - h.males;
    const expected = (hens / HERDS.ga.eggEvery) * 10;
    expect(eggs).toBeGreaterThan(expected * 0.85);
    expect(eggs).toBeLessThan(expected * 1.15);
  });

  it('ducks out-lay chickens, and large stock lays nothing', () => {
    const duck = HERDS.vit.eggEvery;
    const hen = HERDS.ga.eggEvery;
    expect(duck).toBeLessThan(hen);
    expect(HERDS.bo.eggEvery).toBe(0);
    expect(HERDS.lon.eggEvery).toBe(0);
  });
});

describe('reproduction cycle', () => {
  it('a hen hatches a clutch after incubation, not after a day', () => {
    const h = startingHerd('ga', 60);
    h.pregnant = 1;
    h.dueIn = HERDS.ga.gestationDays; // 21 ngày ấp
    let births = 0;
    for (let d = 0; d < 20; d++) births += tickHerd(h, 60, 1, rng()).births;
    expect(births).toBe(0); // chưa tới ngày nở
    for (let d = 0; d < 4; d++) births += tickHerd(h, 60, 1, rng()).births;
    expect(births).toBeGreaterThan(0);
  });

  it('goats carry for 150 days and cattle for 283, so cattle cannot calve in a 120-day run', () => {
    expect(HERDS.de.gestationDays).toBe(150);
    expect(HERDS.bo.gestationDays).toBe(283);
    expect(HERDS.bo.gestationDays).toBeGreaterThan(120);
  });

  it('pigs farrow a large litter, cattle a single calf', () => {
    expect(HERDS.lon.litter).toBeGreaterThanOrEqual(8);
    expect(HERDS.bo.litter).toBe(1);
    const pig = startingHerd('lon', 60);
    pig.pregnant = 1;
    pig.dueIn = 1;
    const born = tickHerd(pig, 60, 1, rng()).births;
    expect(born).toBeGreaterThanOrEqual(6);
  });

  it('the young need months before they join the breeding herd', () => {
    const h = startingHerd('ga', 60);
    h.young = 5;
    h.youngIn = HERDS.ga.maturityDays; // 150 ngày
    const before = h.adults;
    tickHerd(h, 60, 1, rng());
    expect(h.adults).toBe(before); // vẫn là con non
    h.youngIn = 1;
    tickHerd(h, 60, 1, rng());
    expect(h.adults).toBeGreaterThan(before);
  });

  it('milk only comes from a lactating dam, and runs out', () => {
    const cow = startingHerd('bo', 40);
    cow.lactating = 1;
    cow.lactationIn = 3;
    expect(tickHerd(cow, 40, 1, rng()).milk).toBeGreaterThan(0);
    tickHerd(cow, 40, 1, rng());
    tickHerd(cow, 40, 1, rng());
    const dry = tickHerd(cow, 40, 1, rng());
    expect(dry.milk).toBe(0); // hết kỳ sữa, phải phối lại
  });
});

describe('slaughter and capacity', () => {
  it('butchering yields meat by real weight and keeps breeding stock', () => {
    const h = startingHerd('lon', 60);
    h.adults = 8;
    const tick = tickHerd(h, 60, 1, rng(), 1);
    expect(tick.slaughtered).toBe(1);
    expect(tick.meat).toBeGreaterThan(45); // lợn 90 kg × 72% thịt
    const before = h.adults;
    const keep = tickHerd(h, 60, 1, rng(), 99);
    // Luôn giữ lại ít nhất 2 con giống.
    expect(keep.slaughtered).toBeLessThanOrEqual(Math.max(0, before - 2));
    expect(h.adults).toBeGreaterThanOrEqual(2);
  });

  it('capacity follows area per head, and feed scales with heads', () => {
    expect(herdCapacity(40, 'ga')).toBeGreaterThan(herdCapacity(40, 'bo'));
    const small = startingHerd('de', herdCapacity(20, 'de'));
    const big = { ...small, adults: small.adults * 3 };
    expect(herdNeeds(big).feed).toBeGreaterThan(herdNeeds(small).feed * 2);
  });

  it('an overstocked pen loses animals rather than overflowing forever', () => {
    const h = startingHerd('ga', 6);
    h.adults = 40;
    tickHerd(h, 6, 1, rng());
    expect(h.adults + h.young).toBeLessThanOrEqual(6);
  });

  it('the meat preview matches the butcher yield', () => {
    expect(estimateMeat('bo', 1)).toBeGreaterThan(150);
    expect(estimateMeat('ga', 1)).toBeLessThan(3);
  });
});
