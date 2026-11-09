import { describe, expect, it } from 'vitest';
import { currentGoals, firstDayGoals, goalProgress, nextTierGoals, showOnboarding } from '../src/ui/onboarding';
import { newGame } from '../src/sim/state';
import { HOUR } from '../src/core/time';
import { makeTestWorld } from '../scripts/headless';

function setup(day = 0) {
  const world = makeTestWorld();
  const b = world.buildings.filter((x) => x.area > 250 && x.area < 900)[0];
  const s = newGame(world, b.id, 7, new Date(2026, 5, 1));
  if (day) s.t += day * 24 * HOUR;
  return { s, site: s.sites[0] };
}

describe('onboarding checklist', () => {
  it('starts with everything open and explains why each goal matters', () => {
    const { s, site } = setup();
    const goals = firstDayGoals(s, site);
    expect(goals.length).toBeGreaterThanOrEqual(5);
    expect(goals.every((g) => g.why.length > 10)).toBe(true);
    expect(goalProgress(goals).done).toBe(0);
  });

  it('ticks a goal only when the colony really did it', () => {
    const { s, site } = setup();
    const before = firstDayGoals(s, site).find((g) => g.id === 'beds')!;
    expect(before.done).toBe(false);
    // Beds come from the module, not from a flag.
    site.interior.rooms[0].module = 'bedroom';
    site.interior.rooms[0].moduleLevel = 1;
    const after = firstDayGoals(s, site).find((g) => g.id === 'beds');
    expect(after).toBeDefined();
  });

  it('hands over to a second tier instead of going silent after the first week', () => {
    const { s, site } = setup();
    expect(currentGoals(s, site).tier).toBe(1);
    const late = setup(14);
    const second = currentGoals(late.s, late.site);
    // Sandbox without an ending: after the basics the panel keeps naming the next
    // milestone (self-sufficiency, water buffer, a first technology, ten people).
    expect(second.tier).toBe(2);
    expect(second.goals.map((g) => g.id)).toContain('self-food');
    expect(second.goals.some((g) => g.why.length > 10)).toBe(true);
    expect(showOnboarding(late.s, late.site)).toBe(true);
  });

  it('goes quiet only when the open tier is fully met', () => {
    const { s, site } = setup(14);
    expect(nextTierGoals(s, site).every((g) => !g.done)).toBe(true);
    // Satisfy every tier-2 milestone: land that feeds the colony, a water buffer, one
    // technology, a level-2 wall plus a tower, ten people, all three switches.
    const garden = site.interior.rooms[0];
    garden.module = 'garden';
    garden.moduleLevel = 1;
    garden.area = 4000;
    site.stock.water = 4000;
    s.techs = ['t_mill'];
    site.fortify.level = 2;
    const tower = site.interior.rooms[1];
    tower.module = 'watchtower';
    tower.moduleLevel = 1;
    // "Mở điểm thứ hai": thêm một điểm vào lãnh thổ.
    s.sites.push({ ...s.sites[0], id: 'field1', kind: 'field' });
    // Mốc "mười người sống": thêm người vào chính cộng đồng đó.
    while (s.survivors.length < 10) s.survivors.push({ ...s.survivors[0], id: `extra${s.survivors.length}` });
    s.survivors.forEach((v) => (v.status = 'alive'));
    const left = nextTierGoals(s, site).filter((g) => !g.done);
    expect(left.map((g) => g.id)).toEqual([]);
    expect(showOnboarding(s, site)).toBe(false);
  });
});
