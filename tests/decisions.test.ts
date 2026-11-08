import { describe, expect, it } from 'vitest';
import { decide, MAX_DECISIONS } from '../src/ui/alerts';
import { newGame } from '../src/sim/state';
import { makeTestWorld } from '../scripts/headless';

function setup() {
  const world = makeTestWorld();
  const b = world.buildings.filter((x) => x.area > 250 && x.area < 900)[0];
  const s = newGame(world, b.id, 31, new Date(2026, 5, 1));
  return { s, site: s.sites[0] };
}

describe('Cần quyết định', () => {
  it('a fresh game is not drowning in warnings', () => {
    const { s, site } = setup();
    const list = decide(s, site);
    expect(list.length).toBeLessThanOrEqual(MAX_DECISIONS);
    // Starting stock is 4+ days of food, so food is not an emergency yet.
    expect(list.map((d) => d.id)).not.toContain('food');
  });

  it('never returns more than three rows', () => {
    const { s, site } = setup();
    site.stock.food = 0;
    site.stock.meals = 0;
    site.stock.rawFood = 0;
    site.stock.water = 0;
    site.stock.beds = 0;
    site.fortify.level = 0;
    site.fence.level = 0;
    for (const v of s.survivors) {
      v.bleed = 2;
      v.sickDays = 3;
    }
    site.projects.push({ id: 'p1', kind: 'module', label: 'x', workTotal: 10, progress: 0, cost: {}, paid: false });
    const list = decide(s, site);
    expect(list.length).toBe(MAX_DECISIONS);
    // Worst news first.
    expect(list.every((d, i) => i === 0 || d.level !== 'bad' || list[i - 1].level === 'bad')).toBe(true);
  });

  it('food shortage points at the kitchen (R1)', () => {
    const { s, site } = setup();
    site.stock.food = 0;
    site.stock.meals = 0;
    site.stock.rawFood = 1000;
    const food = decide(s, site).find((d) => d.id === 'food');
    expect(food).toBeDefined();
    expect(food!.tab).toBe('base');
    expect(food!.panel).toBe('kitchen');
  });

  it('water shortage points at the map', () => {
    const { s, site } = setup();
    site.stock.water = 0;
    const water = decide(s, site).find((d) => d.id === 'water');
    expect(water?.tab).toBe('map');
  });

  it('bleeding and sepsis outrank everything else', () => {
    const { s, site } = setup();
    for (const v of s.survivors) v.bleed = 3;
    site.stock.food = 0;
    site.stock.meals = 0;
    site.stock.rawFood = 0;
    const ids = decide(s, site).map((d) => d.id);
    expect(ids[0]).toBe('bleed');
    expect(ids).toContain('food');
  });

  it('an empty site says so instead of dividing by zero', () => {
    const { s, site } = setup();
    for (const v of s.survivors) {
      v.status = 'gone';
    }
    const list = decide(s, site);
    expect(list.length).toBe(1);
    expect(list[0].id).toBe('empty');
    expect(list[0].text).not.toMatch(/NaN/);
  });

  it('every row has a destination — no dead-end warnings', () => {
    const { s, site } = setup();
    site.stock.food = 0;
    for (const v of s.survivors) v.sickDays = 2;
    for (const d of decide(s, site)) {
      expect(['base', 'people', 'map', 'laws', 'log']).toContain(d.tab);
      expect(d.action.length).toBeGreaterThan(0);
    }
  });
});
