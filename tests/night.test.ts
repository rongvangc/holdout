import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/items';
import { hasLight, planExpedition } from '../src/sim/expedition';
import { newGame } from '../src/sim/state';
import { HOUR } from '../src/core/time';
import { makeTestWorld } from '../scripts/headless';

const light = () =>
  Object.entries(ITEMS).find(([, d]) => /flashlight|lantern|headlamp|torch/i.test(d.label))?.[0] ?? '';

function setup(night: boolean) {
  const world = makeTestWorld();
  const b = world.buildings.filter((x) => x.area > 250 && x.area < 900)[0];
  const s = newGame(world, b.id, 7, new Date(2026, 5, 1));
  // 23:00 is night; 12:00 is day.
  s.t = Math.floor(s.t / 86400) * 86400 + (night ? 23 : 12) * HOUR;
  return { s, site: s.sites[0], world, base: b.id };
}

describe('night is dangerous', () => {
  it('knows whether the party carries a light', () => {
    const id = light();
    expect(id).not.toBe('');
    expect(hasLight({ [id]: 1 })).toBe(true);
    expect(hasLight({})).toBe(false);
  });

  it('searches slower and loots less at night without a light', () => {
    const night = setup(true);
    const day = setup(false);
    const target = night.world.buildings.filter((x) => x.containers > 3 && x.id !== night.base)[0];
    const dayTarget = day.world.buildings.find((x) => x.id === target.id)!;
    const { s, world } = night;
    const nightPlan = planExpedition(s, world, { kind: 'loot', fromSite: s.sites[0].id, target: { type: 'building', id: target.id }, mode: 'walk', members: [s.survivors[0].id], containers: 4 } as never);
    const dayPlan = planExpedition(day.s, day.world, { kind: 'loot', fromSite: day.s.sites[0].id, target: { type: 'building', id: dayTarget.id }, mode: 'walk', members: [day.s.survivors[0].id], containers: 4 } as never);
    expect(nightPlan.nightLoot).toBe(0.6);
    expect(dayPlan.nightLoot).toBe(1);
    // Đêm mò mẫm lâu hơn ban ngày.
    expect(nightPlan.searchSec).toBeGreaterThan(dayPlan.searchSec);
  });

  it('a light restores what the dark took away', () => {
    const { s, site, world, base } = setup(true);
    const target = world.buildings.filter((x) => x.containers > 3 && x.id !== base)[0];
    const id = light();
    site.stock[id] = 1;
    const plan = planExpedition(s, world, {
      kind: 'loot',
      fromSite: site.id,
      target: { type: 'building', id: target.id },
      mode: 'walk',
      members: [s.survivors[0].id],
      containers: 4,
      cargo: { [id]: 1 },
    } as never);
    expect(plan.nightLoot).toBe(1);
  });
});
