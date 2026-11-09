import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/items';
import { arrive } from '../src/sim/commute';
import { newGame } from '../src/sim/state';
import { makeTestWorld } from '../scripts/headless';
import type { GameState } from '../src/sim/types';

/**
 * A commuter used to walk to work empty-handed while a rifle sat in the store:
 * the death was not the result of any decision. They now fight like an
 * expedition does — weapon first, then armour.
 */
function setup(weaponId?: string): { s: GameState; home: string; work: string } {
  const world = makeTestWorld();
  const b = world.buildings.filter((x) => x.area > 250 && x.area < 900)[0];
  const s = newGame(world, b.id, 7, new Date(2026, 5, 1));
  const site = s.sites[0];
  const v = s.survivors[0];
  if (weaponId) {
    site.stock[weaponId] = 1;
    v.gear = { ...(v.gear ?? {}), weapon: weaponId };
  }
  // A dangerous commute: five minutes each way through a hot cell.
  v.commute = { home: site.id, work: site.id, sec: 300, danger: 14 };
  return { s, home: site.id, work: site.id };
}

const strongest = Object.entries(ITEMS)
  .filter(([, d]) => d.mechanic === 'weapon_blade')
  .sort((a, b) => (b[1].dmg ?? 0) - (a[1].dmg ?? 0))[0]?.[0];

function damageOver(homework: ReturnType<typeof setup>, trips = 80): { hp: number; deaths: number } {
  const { s, work } = homework;
  const v = s.survivors[0];
  let hp = 0;
  let deaths = 0;
  for (let i = 0; i < trips; i++) {
    if (v.status !== 'alive') { deaths++; v.status = 'alive'; }
    v.hp = 100;
    arrive(s, v, work, 300);
    if (v.status !== 'alive') deaths++;
    else hp += 100 - Math.max(0, v.hp);
  }
  return { hp, deaths };
}

describe('a commuter uses what the colony gave them', () => {
  it('a good blade means less blood on the way to work', () => {
    expect(strongest).toBeTruthy();
    const unarmed = damageOver(setup());
    const armed = damageOver(setup(strongest!));
    expect(armed.hp).toBeLessThan(unarmed.hp);
    expect(armed.deaths).toBeLessThanOrEqual(unarmed.deaths);
  });

  it('the weapon wears from the walk, not just from expeditions', () => {
    const p = setup(strongest!);
    const v = p.s.survivors[0];
    v.commute = { home: p.home, work: p.work, sec: 600, danger: 20 };
    for (let i = 0; i < 6; i++) {
      v.hp = 100;
      v.status = 'alive';
      v.siteId = p.home;
      arrive(p.s, v, p.work, 600);
    }
    expect(p.s.sites[0].condition?.[strongest!] ?? 1).toBeLessThan(1);
  });
});
