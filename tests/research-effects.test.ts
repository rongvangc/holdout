import { describe, expect, it } from 'vitest';
import { newGame } from '../src/sim/state';
import { dayEvent } from '../src/sim/daily';
import { tickResearch } from '../src/sim/research';
import { makeTestWorld } from '../scripts/headless';
import type { GameState } from '../src/sim/types';

/**
 * The passive bonuses used to be tested on their own and wired to nothing: four
 * technologies moved a multiplier that no code ever read. These tests hold the
 * effect to the simulation, not to the function.
 */
function setup(): { s: GameState; site: GameState['sites'][number]; world: ReturnType<typeof makeTestWorld> } {
  const world = makeTestWorld();
  const b = world.buildings.filter((x) => x.area > 250 && x.area < 900)[0];
  const s = newGame(world, b.id, 7, new Date(2026, 5, 1));
  return { s, site: s.sites[0], world };
}

const finish = (s: GameState, id: string) => {
  s.techs = [...(s.techs ?? []), id];
};

describe('finished research changes the simulation', () => {
  it('Preservation slows spoilage of the store', () => {
    const plain = setup();
    const learnt = setup();
    plain.site.stock.rawFood = 1000;
    learnt.site.stock.rawFood = 1000;
    finish(learnt.s, 't_preserve');
    dayEvent(plain.s, plain.world);
    dayEvent(learnt.s, learnt.world);
    expect(learnt.site.stock.rawFood).toBeGreaterThan(plain.site.stock.rawFood);
  });

  it('Selective breeding adds to eggs and milk, not to the counter on a screen', () => {
    const a = setup();
    const c = setup();
    for (const p of [a, c]) {
      const room = p.site.interior.rooms[0];
      room.module = 'coop';
      room.moduleLevel = 1;
      room.area = 60;
      room.herd = 'ga';
    }
    finish(c.s, 't_breed');
    for (let i = 0; i < 20; i++) {
      a.s.t += 86400;
      c.s.t += 86400;
      dayEvent(a.s, a.world);
      dayEvent(c.s, c.world);
    }
    expect(c.site.stock.trung ?? 0).toBeGreaterThan(a.site.stock.trung ?? 0);
  });

  it('research only counts when the colony keeps a researcher at home', () => {
    const { s, site } = setup();
    const shelf = site.interior.rooms[0];
    shelf.module = 'bookshelf';
    shelf.moduleLevel = 1;
    site.stock.books = 10;
    s.research = { tech: 't_mill', progress: 0, siteId: site.id };
    for (const v of s.survivors) v.role = 'idle';
    tickResearch(s);
    expect(s.research?.progress ?? 0).toBe(0);
    s.survivors[0].role = 'researcher';
    s.survivors[0].location = 'base';
    s.survivors[0].siteId = site.id;
    tickResearch(s);
    expect(s.research?.progress ?? 0).toBeGreaterThan(0);
  });
});
