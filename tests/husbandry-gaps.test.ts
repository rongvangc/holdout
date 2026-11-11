import { describe, expect, it } from 'vitest';
import { newGame } from '../src/sim/state';
import { dayEvent, raidEvent } from '../src/sim/daily';
import { slaughterYield, startingHerd } from '../src/sim/livestock';
import { slaughterOne } from '../src/sim/slaughter';
import { makeTestWorld } from '../scripts/headless';
import type { GameState } from '../src/sim/types';

function setup(build: (s: GameState, site: GameState['sites'][number]) => void = () => undefined) {
  const world = makeTestWorld();
  const b = world.buildings.filter((x) => x.area > 250 && x.area < 900)[0];
  const s = newGame(world, b.id, 7, new Date(2026, 5, 1));
  const site = s.sites[0];
  const room = site.interior.rooms[0];
  room.module = 'coop';
  room.moduleLevel = 1;
  room.area = 60;
  room.herd = 'ga';
  room.herdState = startingHerd('ga', 30);
  build(s, site);
  return { s, site, room, world };
}

describe('gap 1: winter reaches the herd', () => {
  it('a cold day gives less than a warm one, unless the coop is closed or heated', () => {
    const run = (temp: number, level: number, warm: boolean) => {
      const { s, site, world } = setup((st, si) => {
        st.weather.tempC = temp;
        si.interior.rooms[0].moduleLevel = level;
        si.warmthActive = warm;
        si.stock.cam = 0;
      });
      for (let i = 0; i < 12; i++) {
        s.t += 86400;
        s.weather.tempC = temp;
        site.interior.rooms[0].moduleLevel = level;
        site.warmthActive = warm;
        dayEvent(s, world);
      }
      return site.stock.trung ?? 0;
    };
    const warm = run(24, 1, false);
    const cold = run(2, 1, false);
    const closed = run(2, 3, false);
    const heated = run(2, 1, true);
    expect(cold).toBeLessThan(warm);
    expect(closed).toBeGreaterThan(cold);
    expect(heated).toBeGreaterThan(cold);
  });
});

describe('gap 2: a raid can take an animal', () => {
  it('losing a night costs livestock, not only stores', () => {
    let lost = 0;
    for (let seed = 0; seed < 12 && !lost; seed++) {
      const { s, site, world } = setup();
      // No defence at all, a big crowd: the raid should break through.
      site.fortify.level = 0;
      site.fence.level = 0;
      const v = s.survivors[0];
      void v;
      for (const r of site.interior.rooms.slice(1, 4)) {
        r.module = 'bedroom';
        r.moduleLevel = 1;
      }
      s.survivors.forEach((x) => { x.role = 'idle'; });
      const room = site.interior.rooms[0];
      const before = room.herdState!.adults + room.herdState!.young;
      // Force the assault directly through the public path used by raids.
      raidEvent(s, world, site.id);
      const after = room.herdState!.adults + room.herdState!.young;
      if (after < before) lost = 1;
    }
    expect(lost).toBe(1);
  });
});

describe('gap 3: the butcher keeps what used to be thrown away', () => {
  it('a slaughter at level 1 gives meat only, higher levels add hide, fat and bone', () => {
    expect(slaughterYield('lon', 0).hide).toBe(0);
    expect(slaughterYield('lon', 1).hide).toBeGreaterThan(0);
    expect(slaughterYield('lon', 1).bone).toBe(0);
    expect(slaughterYield('lon', 3).bone).toBeGreaterThan(0);
    expect(slaughterYield('lon', 3).meat).toBeGreaterThan(slaughterYield('lon', 1).meat);
  });

  it('slaughterOne needs a butcher, keeps breeding stock, and moves the goods', () => {
    const { s, site, room } = setup((_st, si) => {
      si.stock.thit = 0;
      si.stock.da = 0;
    });
    expect(slaughterOne(s, site, room.id)).toContain('Lò mổ');

    const butcher = site.interior.rooms[1];
    butcher.module = 'butcher';
    butcher.moduleLevel = 2;
    const before = room.herdState!.adults + room.herdState!.young;
    expect(slaughterOne(s, site, room.id)).toBeNull();
    expect(room.herdState!.adults + room.herdState!.young).toBe(before - 1);
    expect(site.stock.thit ?? 0).toBeGreaterThan(0);
    expect(site.stock.da ?? 0).toBeGreaterThan(0);
    expect(site.stock.mo ?? 0).toBeGreaterThan(0);
  });

  it('never kills the last animal', () => {
    const { s, site, room } = setup((_st, si) => {
      si.interior.rooms[1].module = 'butcher';
      si.interior.rooms[1].moduleLevel = 1;
    });
    room.herdState!.adults = 1;
    room.herdState!.young = 0;
    expect(slaughterOne(s, site, room.id)).toContain('giống');
  });
});
