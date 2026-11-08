import { describe, expect, it } from 'vitest';
import { newGame, mainSite, autoAssign } from '../src/sim/state';
import { makeTestWorld } from '../scripts/headless';
import type { Room } from '../src/base/interior';
import type { GameState } from '../src/sim/types';

function setup(keep: number, opts: { garden?: number; herb?: number; filter?: boolean } = {}) {
  const world = makeTestWorld();
  const b = world.buildings.find((x) => x.area > 250 && x.area < 900)!;
  const s = newGame(world, b.id, 1, new Date(2026, 5, 1));
  const base = mainSite(s);
  while (s.survivors.filter((v) => v.status === 'alive').length > keep) s.survivors.pop();
  let i = 0;
  const add = (module: Room['module'], area: number) => {
    const room: Room = { id: `r${i++}`, floor: 0, outdoor: true, cells: [i], area, module, walled: true, moduleLevel: 1 };
    base.interior.rooms.push(room);
    if (module === 'garden' || module === 'herb_garden') base.plots[room.id] = { roomId: room.id, crop: null, growth: 0, tendedToday: 0, plantedDay: 0 };
  };
  if (opts.garden) add('garden', opts.garden);
  if (opts.herb) add('herb_garden', opts.herb);
  if (opts.filter) add('filter', 4);
  autoAssign(s);
  return { s, base };
}

const roles = (s: GameState) => s.survivors.filter((v) => v.status === 'alive').map((v) => v.role);
const count = (list: string[], role: string) => list.filter((r) => r === role).length;

describe('auto-assign priorities', () => {
  it('never leaves the water role empty when the site can treat water', () => {
    for (const keep of [3, 4, 5]) {
      const { s } = setup(keep, { garden: 740, filter: true });
      expect(count(roles(s), 'water'), `${keep} người`).toBeGreaterThanOrEqual(1);
    }
  });

  it('gives a real garden a farmer once there are enough hands', () => {
    const { s } = setup(5, { garden: 740, filter: true });
    expect(count(roles(s), 'farmer')).toBeGreaterThanOrEqual(1);
  });

  it('does not waste a full-time farmer on a tiny herb plot', () => {
    const { s } = setup(6, { herb: 8, filter: true });
    expect(count(roles(s), 'farmer')).toBe(0);
  });

  it('on a field, farmers get people but never everyone', () => {
    const world = makeTestWorld();
    const b = world.buildings.find((x) => x.area > 250 && x.area < 900)!;
    const s = newGame(world, b.id, 1, new Date(2026, 5, 1));
    const base = mainSite(s);
    s.sites.push({ ...base, id: 'fld', kind: 'field', name: 'Ruộng', interior: JSON.parse(JSON.stringify(base.interior)), plots: {} } as never);
    const field = s.sites[1];
    const room: Room = { id: 'g', floor: 0, outdoor: true, cells: [1], area: 1200, module: 'garden', walled: true, moduleLevel: 1 };
    field.interior.rooms.push(room);
    field.plots[room.id] = { roomId: room.id, crop: null, growth: 0, tendedToday: 0, plantedDay: 0 };
    for (const v of s.survivors.slice(0, 4)) v.siteId = 'fld';
    autoAssign(s, field);
    const list = s.survivors.filter((v) => v.siteId === 'fld').map((v) => v.role);
    expect(count(list, 'farmer')).toBeGreaterThanOrEqual(1);
    expect(count(list, 'farmer')).toBeLessThan(list.length); // vẫn còn người cho vai khác
  });

  it('leaves one person free for urgent work', () => {
    const { s } = setup(6, { garden: 740, filter: true });
    const list = roles(s);
    expect(list.filter((r) => r === 'idle').length).toBeLessThanOrEqual(1);
    expect(list.length).toBe(s.survivors.filter((v) => v.status === 'alive').length);
  });
});
