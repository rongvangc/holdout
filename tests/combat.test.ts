import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/items';
import { ZOMBIES } from '../src/sim/data';
import { armourAgainst, contactOf, killShare, reachFactor, strikePower } from '../src/sim/combat';
import { equip } from '../src/sim/gear';
import { mainSite, newGame } from '../src/sim/state';
import { makeTestWorld } from '../scripts/headless';

function setup() {
  const world = makeTestWorld();
  const b = world.buildings.find((x) => x.area > 250 && x.area < 900)!;
  const s = newGame(world, b.id, 42, new Date(2026, 5, 1));
  return { s, site: mainSite(s), v: s.survivors[0] };
}

describe('weapon stats', () => {
  it('every weapon has damage and penetration, and forms differ', () => {
    const weapons = Object.entries(ITEMS).filter(([, d]) => (d.mechanic ?? '').startsWith('weapon') || d.mechanic === 'firearm');
    expect(weapons.every(([, d]) => (d.dmg ?? 0) > 0 && d.pierce !== undefined)).toBe(true);
    const knife = ITEMS['wpn_small-knife'];
    const axe = ITEMS['wpn_axe'];
    const gun = ITEMS['gun_sks'];
    expect(axe.dmg).toBeGreaterThan(knife.dmg!);
    expect(axe.pierce).toBeGreaterThan(knife.pierce!);
    expect(gun.dmg).toBeGreaterThan(axe.dmg!);
  });
});

describe('zombie interaction', () => {
  it('natural armour only stops what the weapon cannot pierce', () => {
    const { site, v } = setup();
    site.stock['wpn_small-knife'] = 1;
    equip(site, v, 'weapon', 'wpn_small-knife');
    const vsBrute = strikePower(site, v, 'brute');
    const vsWalker = strikePower(site, v, 'walker');
    expect(vsWalker).toBeGreaterThan(vsBrute);

    site.stock['wpn_fire-axe'] = 1;
    equip(site, v, 'weapon', 'wpn_fire-axe');
    expect(strikePower(site, v, 'brute')).toBeGreaterThan(vsBrute);
  });

  it('a bigger party kills more of a wave, and a knife kills less than a rifle', () => {
    const { s, site } = setup();
    const one = killShare(site, [s.survivors[0]], 'walker');
    const four = killShare(site, s.survivors.slice(0, 4), 'walker');
    expect(four).toBeGreaterThan(one);
    expect(killShare(site, s.survivors.slice(0, 4), 'brute')).toBeLessThan(four);
  });

  it('bloater bile ignores soft armour unless a mask is worn', () => {
    const { site, v } = setup();
    site.stock.vest_alice = 1;
    equip(site, v, 'body', 'vest_alice');
    const withoutMask = armourAgainst(v, 'bloater');
    const mask = Object.keys(ITEMS).find((id) => ITEMS[id].mechanic === 'mask')!;
    site.stock[mask] = 1;
    equip(site, v, 'head', mask);
    expect(armourAgainst(v, 'bloater')).toBeGreaterThan(withoutMask);
  });

  it('a brute smash needs a hard plate to blunt', () => {
    const { site, v } = setup();
    const soft = Object.keys(ITEMS).find((id) => ITEMS[id].mechanic === 'armor_soft')!;
    const plate = Object.keys(ITEMS).find((id) => ITEMS[id].mechanic === 'armor_plate')!;
    site.stock[soft] = 1;
    equip(site, v, 'body', soft);
    const softArmour = armourAgainst(v, 'brute');
    site.stock[plate] = 1;
    equip(site, v, 'body', plate);
    expect(armourAgainst(v, 'brute')).toBeGreaterThan(softArmour);
  });

  it('reach is cut against fast zombies', () => {
    const { site, v } = setup();
    site.stock.wpn_spear = 1;
    equip(site, v, 'weapon', 'wpn_spear');
    const walker = reachFactor(site, v, 'walker');
    const runner = reachFactor(site, v, 'runner');
    expect(walker).toBeLessThan(1);
    expect(runner).toBeGreaterThan(walker);
  });

  it('screamers add heat when they get to act', () => {
    const { site, v } = setup();
    expect(contactOf(site, v, 'screamer', 8).heat).toBe(8);
    expect(contactOf(site, v, 'walker', 8).heat).toBe(0);
  });

  it('every zombie type exposes the stats combat reads', () => {
    for (const z of Object.values(ZOMBIES)) {
      expect(z.hp).toBeGreaterThan(0);
      expect(z.armor).toBeGreaterThanOrEqual(0);
      expect(z.bypass).toBeGreaterThanOrEqual(0);
    }
  });
});
