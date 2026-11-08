import { describe, expect, it } from 'vitest';
import { advanceTo } from '../src/sim/engine';
import { launchExpedition } from '../src/sim/expedition';
import { mainSite, migrate, newGame } from '../src/sim/state';
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

describe('multi-site', () => {
  it('claims a green as a field, then moves cargo and people there by convoy', () => {
    const { world, s } = setup();
    const base = mainSite(s);
    const green = [...world.greens].sort((a, b) => b.area - a.area)[0];
    const [a, b, c, d] = s.survivors.map((v) => v.id);
    const why = launchExpedition(s, world, {
      fromSite: base.id,
      members: [a, b],
      target: { type: 'green', id: green.id },
      mode: 'walk',
      cargo: { water: 10, rawFood: 6000 },
    });
    expect(why).toBeNull();
    // 10 L went as cargo, and the party also packs drinking water for the trip.
    expect(base.stock.water).toBeLessThanOrEqual(70);
    expect(base.stock.water).toBeGreaterThan(60);
    advanceTo(s, world, s.t + 6 * 3600);
    const field = s.sites.find((x) => x.kind === 'field');
    expect(field).toBeDefined();
    expect(field!.sourceId).toBe(green.id);
    expect(s.survivors.filter((v) => v.siteId === field!.id).length).toBeGreaterThan(0);
    expect(field!.interior.rooms.every((r) => r.outdoor)).toBe(true);

    const fieldWater = field!.stock.water;
    const why2 = launchExpedition(s, world, {
      fromSite: base.id,
      members: [c, d],
      target: { type: 'site', id: field!.id },
      mode: 'walk',
      relocate: true,
      cargo: { water: 20 },
    });
    expect(why2).toBeNull();
    advanceTo(s, world, s.t + 6 * 3600);
    expect(field!.stock.water).toBeGreaterThan(fieldWater + 5);
    expect(s.survivors.find((v) => v.id === c)!.siteId).toBe(field!.id);
  });

  it('migrates a v1 single-base save', () => {
    const { s } = setup();
    const site = s.sites[0];
    const v1 = { ...JSON.parse(JSON.stringify(s)), version: 1, baseId: site.sourceId, ...site };
    delete v1.sites;
    for (const v of v1.survivors) delete v.siteId;
    const m = migrate(v1);
    expect(m.version).toBe(2);
    expect(m.sites).toHaveLength(1);
    expect(m.sites[0].stock.food).toBe(site.stock.food);
    expect(m.survivors.every((v) => v.siteId === m.sites[0].id)).toBe(true);
  });
});
