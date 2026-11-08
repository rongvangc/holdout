import { describe, expect, it } from 'vitest';
import { makeRng } from '../src/core/rng';
import { occupancyFor } from '../src/sim/expedition';

/** Chạy 1 config nhiều lần với rng giữ state, đếm tần suất. */
function sample(config: () => { people: number; zombies: number }, trials = 600) {
  let people = 0;
  let zombies = 0;
  let zombiesSum = 0;
  for (let i = 0; i < trials; i++) {
    const r = config();
    if (r.people > 0) people++;
    if (r.zombies > 0) {
      zombies++;
      zombiesSum += r.zombies;
    }
  }
  return { people, zombies, zombiesAvg: zombiesSum / Math.max(1, zombies), trials };
}

const cat = (v: string) => v as never;

describe('occupancyFor — người/zombie trú trong toà nhà', () => {
  it('ngày đầu, nhà dân: hay có người trốn, và người > zombie', () => {
    const rng = makeRng(11);
    const b = { cat: cat('house'), area: 80 };
    const r = sample(() => occupancyFor(rng, b, 1, 1));
    expect(r.people / r.trials).toBeGreaterThan(0.18); // p-người ~0.22+0.12
    expect(r.people).toBeGreaterThan(r.zombies);
  });

  it('khu danger cao (sau bùng phát): zombie trú đông hơn người', () => {
    const rng = makeRng(23);
    const b = { cat: cat('shop'), area: 200 };
    const r = sample(() => occupancyFor(rng, b, 30, 6));
    expect(r.zombies).toBeGreaterThan(r.people);
    expect(r.zombiesAvg).toBeGreaterThanOrEqual(3.5); // đông quanh 1+0.6*6+1
  });

  it('ngày 60 người trốn hiếm hơn ngày 1 (đã bỏ đi hoặc hoá zombie)', () => {
    const b = { cat: cat('house'), area: 80 };
    const rngE = makeRng(31);
    const early = sample(() => occupancyFor(rngE, b, 1, 1));
    const rngL = makeRng(31);
    const late = sample(() => occupancyFor(rngL, b, 60, 3));
    expect(late.people).toBeLessThan(early.people);
  });
});
