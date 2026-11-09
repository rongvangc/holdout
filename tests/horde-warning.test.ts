import { describe, expect, it } from 'vitest';
import { commuteIntent, hordeNear } from '../src/sim/commute';
import { decide } from '../src/ui/alerts';
import { newGame } from '../src/sim/state';
import { makeTestWorld } from '../scripts/headless';
import { HOUR } from '../src/core/time';

function setup() {
  const world = makeTestWorld();
  const b = world.buildings.filter((x) => x.area > 250 && x.area < 900)[0];
  const s = newGame(world, b.id, 7, new Date(2026, 5, 1));
  const site = s.sites[0];
  // midday: a commuter would normally stay at work
  s.t = Math.floor(s.t / 86400) * 86400 + 10 * HOUR;
  const v = s.survivors[0];
  v.commute = { home: site.id, work: site.id, sec: 600, danger: 3 };
  v.siteId = 'other';
  return { s, site, v, world };
}

describe('a horde at the gate is announced and acted on', () => {
  it('a commuter heads home instead of finishing the shift', () => {
    const { s, site, v } = setup();
    expect(hordeNear(s, site.id)).toBe(false);
    expect(commuteIntent(s, v)).toBeNull(); // no reason to move at 10:00
    s.hordes = [{ id: 'h1', cell: site.cell, size: 60 }];
    expect(hordeNear(s, site.id)).toBe(true);
    v.siteId = 'elsewhere';
    expect(commuteIntent(s, v)).toBe(site.id);
  });

  it('appears in "Cần quyết định" while it is still a few cells away', () => {
    const { s, site } = setup();
    expect(decide(s, site).some((d) => d.id === 'horde-near')).toBe(false);
    s.hordes = [{ id: 'h1', cell: site.cell, size: 41 }];
    const row = decide(s, site).find((d) => d.id === 'horde-near');
    expect(row).toBeTruthy();
    expect(row!.level).toBe('bad');
    expect(row!.text).toContain('41');
    expect(row!.tab).toBe('map');
  });
});
