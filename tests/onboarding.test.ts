import { describe, expect, it } from 'vitest';
import { firstDayGoals, goalProgress, showOnboarding } from '../src/ui/onboarding';
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

  it('stops showing once the basics stand or the first week is over', () => {
    const { s, site } = setup();
    expect(showOnboarding(s, site)).toBe(true);
    const late = setup(14);
    expect(showOnboarding(late.s, late.site)).toBe(false);
  });
});
