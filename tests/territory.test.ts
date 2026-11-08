import { describe, expect, it } from 'vitest';
import { DAY, HOUR, nextClock, timeOfDay } from '../src/core/time';
import { setCommute } from '../src/sim/commute';
import { advanceTo } from '../src/sim/engine';
import { launchExpedition } from '../src/sim/expedition';
import { mainSite, newGame, rebindWorld } from '../src/sim/state';
import { effectiveDanger } from '../src/sim/zombies';
import { buildWorld } from '../src/world/generate';
import { syntheticOsm } from '../src/world/synthetic';
import { makeTestWorld } from '../scripts/headless';

function setup() {
  const world = makeTestWorld();
  const baseB = world.buildings.filter((b) => b.area > 250 && b.area < 900)[0];
  const s = newGame(world, baseB.id, 42, new Date(2026, 5, 1));
  for (const v of s.survivors) {
    v.hp = 100;
    v.xp.stealth = 5000;
    v.xp.melee = 5000;
  }
  return { world, s };
}

function claimField(s: ReturnType<typeof setup>['s'], world: ReturnType<typeof setup>['world'], members: string[]) {
  const green = [...world.greens].sort((a, b) => b.area - a.area)[0];
  expect(launchExpedition(s, world, { fromSite: mainSite(s).id, members, target: { type: 'green', id: green.id }, mode: 'walk', cargo: { water: 10 } })).toBeNull();
  advanceTo(s, world, s.t + 6 * HOUR);
  return s.sites.find((x) => x.kind === 'field')!;
}

describe('territory', () => {
  it('patrols thin out zombies in a cell, and they drift back daily', () => {
    const { world, s } = setup();
    const base = mainSite(s);
    const before = effectiveDanger(s, world, base.cell);
    const team = s.survivors.slice(0, 3).map((v) => v.id);
    expect(launchExpedition(s, world, { fromSite: base.id, members: team, target: { type: 'building', id: base.sourceId }, mode: 'walk', patrol: true })).toBeNull();
    advanceTo(s, world, s.t + 3 * HOUR);
    const clear = s.cellClear[base.cell];
    expect(clear).toBeGreaterThan(0.1);
    expect(effectiveDanger(s, world, base.cell)).toBeLessThan(before);
    advanceTo(s, world, s.t + 2 * DAY);
    expect(s.cellClear[base.cell] ?? 0).toBeLessThan(clear);
  });

  it('runs a recurring convoy route on schedule', () => {
    const { world, s } = setup();
    const [a, b, c, d] = s.survivors.map((v) => v.id);
    const field = claimField(s, world, [a, b]);
    const base = mainSite(s);
    void c;
    void d;
    s.routes.push({ id: 'r1', from: base.id, to: field.id, cargo: { books: 1 }, crew: 1, everyDays: 1, nextDay: 1 });
    const fieldBooks = field.stock.books;
    advanceTo(s, world, nextClock(s.t, 0) + 12 * HOUR);
    expect(s.routes[0].nextDay).toBeGreaterThan(1);
    expect(field.stock.books).toBeGreaterThan(fieldBooks);
  });

  it('commuters work at the field by day and sleep at home', () => {
    const { world, s } = setup();
    const [a, b, c] = s.survivors.map((v) => v.id);
    const field = claimField(s, world, [a, b]);
    const base = mainSite(s);
    expect(setCommute(s, world, c, field.id)).toBeNull();
    const v = s.survivors.find((x) => x.id === c)!;
    const seen = new Set<string>();
    for (let i = 0; i < 48; i++) {
      advanceTo(s, world, s.t + HOUR);
      if (v.status !== 'alive') break;
      const tod = timeOfDay(s.t);
      if (tod > 11 * HOUR && tod < 15 * HOUR) seen.add(`day:${v.siteId}`);
      if (tod > 22 * HOUR || tod < 5 * HOUR) seen.add(`night:${v.siteId}`);
    }
    if (v.status === 'alive') {
      expect(seen.has(`day:${field.id}`)).toBe(true);
      expect(seen.has(`night:${base.id}`)).toBe(true);
    }
  });

  it('keeps sites when the map is expanded', () => {
    const { world, s } = setup();
    const base = mainSite(s);
    const bigger = buildWorld(syntheticOsm(world.center, 1800, 3), world.center, 1800, 'synthetic');
    bigger.key = 'bigger';
    expect(bigger.buildings.length).toBeGreaterThan(world.buildings.length);
    expect(rebindWorld(s, bigger)).toEqual([]);
    const b = bigger.buildings.find((x) => x.id === base.sourceId)!;
    expect(base.node).toBe(b.node);
    expect(s.worldKey).toBe('bigger');
  });
});
