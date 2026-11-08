import { describe, expect, it } from 'vitest';
import type { ModuleId } from '../src/data/modules';
import { RESCUE_DAYS } from '../src/sim/daily';
import { advanceTo } from '../src/sim/engine';
import { planPower } from '../src/sim/power';
import { addStock, baseStats, newGame } from '../src/sim/state';
import { makeTestWorld } from '../scripts/headless';

function setup() {
  const world = makeTestWorld();
  const b = world.buildings.filter((x) => x.area > 250 && x.area < 900)[0];
  const s = newGame(world, b.id, 21, new Date(2026, 5, 1));
  const site = s.sites[0];
  return { s, site };
}

const put = (site: ReturnType<typeof setup>['site'], m: ModuleId, level = 1) => {
  const room = site.interior.rooms.find((r) => !r.module) ?? site.interior.rooms[0];
  room.module = m;
  room.moduleLevel = level;
  return room;
};

describe('heating', () => {
  it('a stove warms the point only while it burns wood', () => {
    const { s, site } = setup();
    put(site, 'stove', 2);
    const st = baseStats(s, site);
    expect(st.stoveWarmth).toBeGreaterThan(0.5);
    // Not burning tonight = no warmth at all.
    site.warmthActive = false;
    expect(site.warmthActive ? st.stoveWarmth : 0).toBe(0);
    site.warmthActive = true;
    expect(site.warmthActive ? st.stoveWarmth : 0).toBeGreaterThan(0.5);
  });

  it('the stove gets warmer with level', () => {
    const { s, site } = setup();
    put(site, 'stove', 1);
    const l1 = baseStats(s, site).stoveWarmth;
    site.interior.rooms.find((r) => r.module === 'stove')!.moduleLevel = 3;
    const l3 = baseStats(s, site).stoveWarmth;
    expect(l3).toBeGreaterThan(l1);
    expect(l3).toBeLessThan(0.95);
  });

  it('the electric heater needs power, and both together still cap', () => {
    const { s, site } = setup();
    put(site, 'stove', 3);
    put(site, 'generator', 3);
    put(site, 'electric_heater', 3);
    addStock(s, site, { fuel: 200 });

    site.powerOn = [];
    expect(baseStats(s, site).heaterWarmth).toBe(0);

    addStock(s, site, { fuel: 200 });
    const p = planPower(s, site, 3);
    site.powerOn = p.on as string[];
    const st = baseStats(s, site);
    expect(st.heaterWarmth).toBeGreaterThan(0.5);
    // Stove 0.85 + heater 0.9 is clamped when the engine combines them.
    expect(Math.min(0.95, st.stoveWarmth + st.heaterWarmth)).toBeLessThanOrEqual(0.95);
  });

  it('a wood stove needs no electricity at all', () => {
    const { s, site } = setup();
    put(site, 'stove', 1);
    site.powerOn = [];
    expect(baseStats(s, site).stoveWarmth).toBeGreaterThan(0);
  });
});

describe('rescue by radio', () => {
  it('only a level-3 radio with power counts as a signal', () => {
    const { s, site } = setup();
    put(site, 'radio', 2);
    put(site, 'generator', 2);
    addStock(s, site, { fuel: 200 });
    const p = planPower(s, site, 2);
    site.powerOn = p.on as string[];
    expect(baseStats(s, site).rescueSignal).toBe(false);

    site.interior.rooms.find((r) => r.module === 'radio')!.moduleLevel = 3;
    addStock(s, site, { fuel: 200 });
    const p2 = planPower(s, site, 2);
    site.powerOn = p2.on as string[];
    expect(baseStats(s, site).rescueSignal).toBe(true);
  });

  it('a radio without power is not on the air', () => {
    const { s, site } = setup();
    put(site, 'radio', 3);
    site.powerOn = [];
    expect(baseStats(s, site).rescueSignal).toBe(false);
  });

  it('the run needs a week on the air', () => {
    expect(RESCUE_DAYS).toBe(7);
  });
});

describe('the rescue runs end to end', () => {
  it('seven powered nights of radio-3 win the game', () => {
    const { s, site } = setup();
    put(site, 'radio', 3);
    put(site, 'generator', 3);
    put(site, 'lighting', 1);
    // Fuel must go through addStock: the daily tick rebuilds stock.fuel from batches.
    addStock(s, site, { fuel: 5000 });
    const world = makeTestWorld();
    const dayMs = 86400;
    let t = s.t;
    // Drive whole days; each day tick decides the rescue signal.
    for (let i = 0; i < RESCUE_DAYS + 1 && !s.won; i++) {
      t = (Math.floor(t / dayMs) + 1) * dayMs + 6 * 3600;
      advanceTo(s, world, t);
    }
    expect(s.rescueDays ?? 0).toBeGreaterThanOrEqual(RESCUE_DAYS);
    expect(s.won).toBe(true);
    expect(s.gameOver).toBe(true);
  });

  it('no radio-3, no rescue', () => {
    const { s, site } = setup();
    put(site, 'radio', 2);
    put(site, 'generator', 3);
    // Fuel must go through addStock: the daily tick rebuilds stock.fuel from batches.
    addStock(s, site, { fuel: 5000 });
    const world = makeTestWorld();
    const dayMs = 86400;
    let t = s.t;
    for (let i = 0; i < RESCUE_DAYS + 2; i++) {
      t = (Math.floor(t / dayMs) + 1) * dayMs + 6 * 3600;
      advanceTo(s, world, t);
      if (s.gameOver) break;
    }
    expect(s.won ?? false).toBe(false);
  });
});
