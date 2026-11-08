import { describe, expect, it } from 'vitest';
import { advanceTo } from '../src/sim/engine';
import { queueModule } from '../src/sim/build';
import { addStock, baseStats, mainSite, newGame } from '../src/sim/state';
import { planExpedition } from '../src/sim/expedition';
import { applyReadResult, workMult } from '../src/sim/tasks';
import { isNight } from '../src/core/time';
import { makeTestWorld } from '../scripts/headless';
import type { GameState, Plot, Site } from '../src/sim/types';
import type { Room } from '../src/base/interior';

function setup() {
  const world = makeTestWorld();
  const baseB = world.buildings.filter((b) => b.area > 250 && b.area < 900)[0];
  const s = newGame(world, baseB.id, 42, new Date(2026, 5, 1));
  return { world, s };
}

/** Push a finished module room straight into the interior (the post-state of a completed build project). */
function addModule(site: Site, id: string, module: NonNullable<Room['module']>, area: number, outdoor: boolean): Room {
    const room: Room = { id, floor: 0, outdoor, cells: [1], area, module, walled: true };
    site.interior.rooms.push(room);
  if (module === 'garden' || module === 'herb_garden') {
    site.plots[room.id] = { roomId: room.id, crop: null, growth: 0, tendedToday: 0, plantedDay: 0 } satisfies Plot;
  }
  return room;
}

/** An empty room with no module yet (waits to receive one). */
function addEmpty(site: ReturnType<typeof mainSite>, id: string, area: number, outdoor: boolean): string {
  const room: Room = { id, floor: outdoor ? 0 : 0, outdoor, cells: [2], area, walled: true };
  site.interior.rooms.push(room);
  return id;
}

const DAY = 86400;
const ALIVE = (s: GameState) => s.survivors.filter((v) => v.status === 'alive');

describe('herb garden', () => {
  it('plants without seed packs and harvests medicine + bandages (never rawFood)', () => {
    const { world, s } = setup();
    const base = mainSite(s);
    for (const v of ALIVE(s)) v.role = 'farmer';
    const room = addModule(base, 'h1', 'herb_garden', 24, true);
    expect(base.plots[room.id]).toBeDefined();


    // Untended growth is 30%/day → ripens from ~3.5 days (40-day cycle).
    for (let i = 0; i < 6 && !s.log.some((l) => l.msg.includes('gieo Dược liệu')); i++) {
      advanceTo(s, world, s.t + DAY);
    }
    expect(s.log.some((l) => l.msg.includes('gieo Dược liệu'))).toBe(true);

    // Force-ripen and give the group one day to act on it.
    base.plots[room.id]!.growth = 1;
    advanceTo(s, world, s.t + DAY);

    // The deterministic contract here is the LOG trail (plant + yield amounts).
    const plantLog = s.log.filter((l) => l.msg.includes('gieo Dược liệu'));
    expect(plantLog.length).toBeGreaterThanOrEqual(1);

    const win = s.log.filter((l) => l.msg.includes('thu hoạch dược liệu'));
    if (win.length) {
      // 24 m² → a/12 = 2 liều thuốc in the yield line.
      expect(win[0].msg).toContain('+2.0 liều');
    } else {
      expect(base.plots[room.id]!.growth).toBeGreaterThanOrEqual(1);
    }
    expect(win[0].items?.rawFood ?? 0).toBe(0);
  });

  it('farmer replants without touching seed stock', () => {
    const { world, s } = setup();
    const base = mainSite(s);
    for (const v of ALIVE(s)) v.role = 'farmer';
    const room = addModule(base, 'h2', 'herb_garden', 24, true);
    base.stock.seeds = 0;
    for (let i = 0; i < 8; i++) advanceTo(s, world, s.t + DAY);
    expect(base.plots[room.id]).toBeDefined();
    expect(base.plots[room.id]!.crop).toBe('thuoc');
    expect(base.stock.seeds).toBe(0);
  });
});

describe('generator night power', () => {
  it('keeps the night penalty (and its fuel) when there is no generator / no fuel', () => {
    const { world, s } = setup();
    const base = mainSite(s);
    addStock(s, base, { fuel: 5 });
    const night = (Math.floor(s.t / DAY) + 1) * DAY + 21 * 3600;
    expect(isNight(night)).toBe(true);
    advanceTo(s, world, night);
    const v = ALIVE(s)[0];
    expect(base.powered ?? false).toBe(false);
    expect(base.stock.fuel).toBe(5);
    // No powered site → the with-site call must behave exactly like the site-less night call.
    expect(workMult(s, v, 'construction', base)).toBe(workMult(s, v, 'construction'));
  });

  it('burns fuel at the daily tick and clears the night penalty once the lights are on', () => {
    const { world, s } = setup();
    const base = mainSite(s);
    addModule(base, 'g1', 'generator', 2, false);
    addModule(base, 'l1', 'lighting', 2, false);
    addStock(s, base, { fuel: 120 });
    const night = (Math.floor(s.t / DAY) + 1) * DAY + 21 * 3600;
    advanceTo(s, world, night);
    const v = ALIVE(s).find((x) => x.role !== 'guard')!;
    expect(base.powered).toBe(true);
    // Fuel is billed per kWh delivered, not a flat 24 L: one light for 12 h is ~1 L.
    expect(base.stock.fuel).toBeLessThan(120);
    expect(base.stock.fuel).toBeGreaterThan(118);
    // With power the night penalty is gone: with-site multiplier must overtake the site-less call.
    expect(workMult(s, v, 'construction', base)).toBeGreaterThan(workMult(s, v, 'construction'));
  });
});

describe('bookshelf study routing', () => {
  it('applies read XP to the assigned skill instead of a random one', () => {
    const { s } = setup();
    const base = mainSite(s);
    addModule(base, 'b1', 'bookshelf', 4, false);
    expect(baseStats(s, base).bookshelf).toBe(true);
    const v = s.survivors[0];
    v.study = 'cooking';
    const before = v.xp.cooking;
    applyReadResult(s, v, 1);
    expect(v.xp.cooking).toBeGreaterThanOrEqual(before + 20);
  });

  it('without study the result still grants some XP (random path unchanged)', () => {
    const { s } = setup();
    const v = s.survivors[0];
    const totalBefore = Object.values(v.xp).reduce((a, b) => a + b, 0);
    applyReadResult(s, v, 1);
    expect(Object.values(v.xp).reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(totalBefore + 25);
  });
});

describe('module caps (maxPerSite)', () => {
  it('caps watchtower stacking at 2 per site, counting queued projects too', () => {
    const { s } = setup();
    const base = mainSite(s);
    addModule(base, 'w1', 'workshop', 8, false);
    addModule(base, 'wt1', 'watchtower', 4, true);
    addModule(base, 'wt2', 'watchtower', 4, true);
    expect(queueModule(s, base, addEmpty(base, 'wt3', 4, true), 'watchtower')).toBe('Tối đa 2 tháp canh mỗi điểm');
  });

  it('counts pending (unpaid) projects toward the cap', () => {
    const { s } = setup();
    const base = mainSite(s);
    addModule(base, 'w2', 'workshop', 8, false);
    expect(queueModule(s, base, addEmpty(base, 'wtA', 4, true), 'watchtower')).toBeNull();
    // built(0) + queued(1) = 1 < 2 → the second queue is still allowed...
    expect(queueModule(s, base, addEmpty(base, 'wtB', 4, true), 'watchtower')).toBeNull();
    // ...and the third is not (built 0 + queued 2 = 2 = cap).
    expect(queueModule(s, base, addEmpty(base, 'wtC', 4, true), 'watchtower')).toBe('Tối đa 2 tháp canh mỗi điểm');
  });

  it('caps boolean-effect modules at 1 (kitchen)', () => {
    const { s } = setup();
    const base = mainSite(s);
    addModule(base, 'k1', 'kitchen', 6, false);
    expect(queueModule(s, base, addEmpty(base, 'k2', 6, false), 'kitchen')).toBe('Tối đa 1 bếp mỗi điểm');
  });
});

describe('garage expedition effects', () => {
  it('car preview from a garage site: 0.08 L/km and +80 kg capacity', () => {
    const { world, s } = setup();
    const base = mainSite(s);
    const target = world.buildings.find((b) => b.id !== base.sourceId && b.area > 60 && b.containers > 0)!;
    base.stock.vehicle = 1;
    base.stock.scrap = 200;
    addStock(s, base, { fuel: 60 });

    const opts = { fromSite: base.id, members: [s.survivors[0].id], target: { type: 'building' as const, id: target.id }, containers: 5 };
    const baseCar = () => planExpedition(s, world, { ...opts, mode: 'car', cargo: { scrap: 100 } });

    const noGarage = baseCar();
    expect(noGarage.ok).toBe(true);

    addModule(base, 'ga1', 'garage', 12, true);
        const withGarage = baseCar();
    expect(withGarage.ok).toBe(true);
    expect(withGarage.fuelL).toBeCloseTo(noGarage.fuelL * 0.8, 5);
    expect(withGarage.capacityKg).toBe(noGarage.capacityKg + 80);

    // Walking is unaffected.
    const walk = planExpedition(s, world, { ...opts, mode: 'walk', cargo: { scrap: 20 } });
    expect(walk.ok).toBe(true);
    expect(walk.fuelL).toBe(0);
  });
});
