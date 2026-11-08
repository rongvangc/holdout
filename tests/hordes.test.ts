import { describe, expect, it } from 'vitest';
import { gridDisk, gridDistance, latLngToCell } from 'h3-js';
import { makeRng } from '../src/core/rng';
import { HOUR } from '../src/core/time';
import { advanceTo } from '../src/sim/engine';
import { baseStats, mainSite, newGame } from '../src/sim/state';
import { hordeSize, nextHordeCell, zombieType } from '../src/sim/zombies';
import { hordeTargetCell, periStretch, startDecoy } from '../src/sim/daily';
import { makeTestWorld } from '../scripts/headless';

function setup() {
  const world = makeTestWorld();
  const baseB = world.buildings.filter((b) => b.area > 250 && b.area < 900)[0];
  const s = newGame(world, baseB.id, 42, new Date(2026, 5, 1));
  const site = mainSite(s);
  return { world, s, site };
}

describe('tiến hoá theo vùng — zombieType', () => {
  it('ô nguy hiểm cô cao + từng dọn sạch -> brute/bloater nhiều hơn rõ rệt', () => {
    const rng = makeRng(7);
    const city = { brute: 0, bloater: 0, walker: 0 };
    const rural = { brute: 0, bloater: 0, walker: 0 };
    for (let i = 0; i < 600; i++) {
      const a = zombieType(rng, 30, false, 6, 1);
      const b = zombieType(rng, 30, false, 1, 0);
      if (a === 'brute' || a === 'bloater') city.brute++;
      if (a === 'walker') city.walker++;
      if (b === 'brute' || b === 'bloater') rural.brute++;
      if (b === 'walker') rural.walker++;
    }
    expect(city.brute + city.bloater).toBeGreaterThan((rural.brute + rural.bloater) * 2);
    expect(city.walker).toBeLessThan(rural.walker);
  });

  it('stalker vẫn chỉ xuất hiện ban đêm', () => {
    const rng = makeRng(3);
    for (let i = 0; i < 50; i++) expect(zombieType(rng, 40, false, 6, 1)).not.toBe('stalker');
  });
});

describe('hordeSize', () => {
  it('tăng theo ngày + danger, trong tầm hợp lý', () => {
    const rng = makeRng(5);
    const early = hordeSize(rng, 12, 2);
    const late = hordeSize(rng, 60, 4);
    expect(early).toBeGreaterThanOrEqual(12);
    expect(early).toBeLessThanOrEqual(45);
    expect(late).toBeGreaterThan(early);
    expect(late).toBeLessThanOrEqual(120);
  });
});

describe('nextHordeCell — trườn về đích', () => {
  it('chọn trong lân cận ô gần đích hơn ô hiện tại', () => {
    const A = latLngToCell(21.028, 105.83, 9);
    const B = latLngToCell(21.042, 105.85, 9);
    const d0 = gridDistance(A, B);
    expect(d0).toBeGreaterThan(1);
    const rng = makeRng(1);
    for (let i = 0; i < 12; i++) {
      const next = nextHordeCell(A, B, gridDisk(A, 1), rng);
      expect(gridDistance(next, B)).toBeLessThan(d0);
    }
  });
});

describe('periStretch — chu vi dàn mỏng', () => {
  it('không phòng thủ nào -> 0.55 (sàn), phủ kín -> 1', () => {
    const { s, site } = setup();
    site.interior.perimeter = 200;
    site.interior.yardPerimeter = 0;
    site.fortify = { level: 0, hp: 100 };
    site.fence = { level: 0, hp: 100 };
    expect(periStretch(site, baseStats(s, site))).toBeCloseTo(0.55);
    site.fortify = { level: 5, hp: 100 };
    expect(periStretch(site, baseStats(s, site))).toBeCloseTo(1);
  });

  it('phần phủ một phần -> hệ số giữa 0.55 và 1', () => {
    const { s, site } = setup();
    site.interior.perimeter = 500;
    site.interior.yardPerimeter = 0;
    site.fortify = { level: 2, hp: 100 };
    site.fence = { level: 0, hp: 100 };
    const f = periStretch(site, baseStats(s, site));
    expect(f).toBeGreaterThan(0.55);
    expect(f).toBeLessThan(1);
  });
});

describe('mồi ồn — startDecoy', () => {
  it('trừ 2L xăng, đặt decoy 6 giờ, hordeTargetCell chọn decoy trong bán kính', () => {
    const { s, site } = setup();
    site.stock.fuel = 10;
    const cell = site.cell;
    const ok = startDecoy(s, site.id, cell);
    expect(ok).toBeNull();
    expect(site.stock.fuel).toBe(8);
    expect(s.decoy?.cell).toBe(cell);
    expect((s.decoy?.until ?? 0) - s.t).toBeCloseTo(6 * HOUR);
    // Chọn đích cho bầy: decoy còn hiệu lực và gần -> về decoy, không về site
    const near = s.decoy!.cell;
    expect(hordeTargetCell(s, near)).toBe(near);
  });

  it('hết xăng -> báo lỗi, không đặt decoy', () => {
    const { s, site } = setup();
    site.stock.fuel = 1;
    const err = startDecoy(s, site.id, site.cell);
    expect(err).toMatch(/xăng/);
    expect(s.decoy).toBeNull();
  });
});

describe('Tích hợp: bầy tới nơi -> siege qua engine', () => {
  it('bầy sát điểm -> event siege -> giải quyết (thắng/thua), bầy rời map', () => {
    const world = makeTestWorld();
    const baseB = world.buildings.filter((b) => b.area > 250 && b.area < 900)[0];
    const s = newGame(world, baseB.id, 42, new Date(2026, 5, 1));
    const site = mainSite(s);
    const adj = gridDisk(site.cell, 1).filter((c) => c !== site.cell && world.cells[c])[0];
    expect(baseStats(s, site).population).toBeGreaterThanOrEqual(3);
    // Phòng thủ cổ chắc để thấy nhánh THẮNG.
    site.fortify = { level: 5, hp: 100 };
    site.fence = { level: 5, hp: 100 };
    for (const v of s.survivors) v.task = { kind: 'guard' } as never;
    s.hordes = [{ id: 'h1', cell: adj, size: 40 }];
    const repelled0 = s.stats.raidsRepelled;
    const lost0 = s.stats.raidsLost;
    advanceTo(s, world, s.t + 16 * HOUR);
    expect(s.stats.raidsRepelled > repelled0 || s.stats.raidsLost > lost0).toBe(true);
    expect(s.hordes).toHaveLength(0);
  });
});
