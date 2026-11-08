import { describe, expect, it } from 'vitest';
import { decide, MAX_DECISIONS } from '../src/ui/alerts';
import { newGame, mainSite } from '../src/sim/state';
import { makeTestWorld } from '../scripts/headless';
import type { Room } from '../src/base/interior';

function setup() {
  const world = makeTestWorld();
  const b = world.buildings.find((x) => x.area > 250 && x.area < 900)!;
  const s = newGame(world, b.id, 42, new Date(2026, 5, 1));
  return { s, site: mainSite(s) };
}
const add = (site: ReturnType<typeof mainSite>, module: NonNullable<Room['module']>, area: number, outdoor = false) => {
  const room: Room = { id: `r${site.interior.rooms.length}`, floor: 0, outdoor, cells: [site.interior.rooms.length], area, module, walled: true, moduleLevel: 1 };
  site.interior.rooms.push(room);
  if (module === 'garden') site.plots[room.id] = { roomId: room.id, crop: null, growth: 0, tendedToday: 0, plantedDay: 0 };
};

describe('"Cần quyết định" covers silent failures', () => {
  it('surfaces a garden nobody farms', () => {
    const { s, site } = setup();
    add(site, 'garden', 740, true);
    for (const v of s.survivors) {
      v.role = 'idle';
      v.location = 'base';
    }
    const ids = decide(s, site).map((d) => d.id);
    expect(ids).toContain('no-farmer');
  });

  it('surfaces water infrastructure with nobody on water duty', () => {
    const { s, site } = setup();
    add(site, 'filter', 4);
    for (const v of s.survivors) {
      v.role = 'idle';
      v.location = 'base';
    }
    expect(decide(s, site).map((d) => d.id)).toContain('no-water-role');
  });

  it('stays quiet when both jobs are covered', () => {
    const { s, site } = setup();
    add(site, 'garden', 200, true);
    add(site, 'filter', 4);
    const [a, b] = s.survivors;
    a.role = 'farmer';
    b.role = 'water';
    const ids = decide(s, site).map((d) => d.id);
    expect(ids).not.toContain('no-farmer');
    expect(ids).not.toContain('no-water-role');
  });

  it('never shows more than three rows, and bad rows come first', () => {
    const { s, site } = setup();
    add(site, 'garden', 740, true);
    for (const v of s.survivors) {
      v.role = 'idle';
      v.location = 'base';
      v.bleed = 1;
    }
    site.stock.food = 0;
    const list = decide(s, site);
    expect(list.length).toBeLessThanOrEqual(MAX_DECISIONS);
    const firstWarn = list.findIndex((d) => d.level === 'warn');
    if (firstWarn >= 0) expect(list.slice(firstWarn).every((d) => d.level === 'warn')).toBe(true);
  });
});
