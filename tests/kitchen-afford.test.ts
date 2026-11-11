import { describe, expect, it } from 'vitest';
import { canAfford, newGame } from '../src/sim/state';
import { RECIPE_BY_ID, resolveInputs } from '../src/data/recipes';
import { makeTestWorld } from '../scripts/headless';

/**
 * Regression: KitchenPanel asked canAfford() with the raw recipe inputs, so every
 * dish built on the '@staple' tag looked unaffordable (stock['@staple'] is 0) and the
 * cook button was disabled forever. The engine could cook; the player could not.
 */
function setup() {
  const world = makeTestWorld();
  const b = world.buildings.filter((x) => x.area > 250 && x.area < 900)[0];
  const s = newGame(world, b.id, 7, new Date(2026, 5, 1));
  return { s, site: s.sites[0] };
}

describe('cooking affordability', () => {
  it('raw inputs always look unaffordable — that was the bug', () => {
    const { s, site } = setup();
    const rice = RECIPE_BY_ID.rd_com;
    expect(site.stock.gao ?? 0).toBeGreaterThan(0);
    expect(canAfford(site, Object.fromEntries(rice.in))).toBe(false);
    void s;
  });

  it('resolved inputs are affordable with the colony food at hand', () => {
    const { s, site } = setup();
    for (const id of ['rd_com', 'r_meals']) {
      const r = RECIPE_BY_ID[id];
      const resolved = resolveInputs(r, site.stock, s.latitude);
      expect(resolved.some(([k]) => k === '@staple'), `${id} still has the tag`).toBe(false);
      expect(canAfford(site, Object.fromEntries(resolved)), `${id} should be cookable`).toBe(true);
    }
  });
});
