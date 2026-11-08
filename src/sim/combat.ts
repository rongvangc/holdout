import { ITEMS } from '../data/items';
import { ZOMBIES, type ZombieType } from './data';
import type { Site, Survivor } from './types';
import { MITIGATION_CAP } from './equipment';
import { survivorWeapon } from './gear';
import { skill } from './survivors';

/**
 * Combat resolution shared by night raids and expeditions.
 *
 * Two phases instead of one roll:
 *   1. Kill: how much of the wave the party puts down before it closes.
 *      Driven by weapon `dmg`, the zombie's natural `armor` and weapon `pierce`.
 *   2. Contact: whatever survived reaches you. Damage and bites are shaped by
 *      the zombie type: `bypass` ignores part of the victim's armour, and a
 *      helmet with a mask (bloater) or a hard plate (brute) cancels some of it.
 *
 * Reach (`biteMult`) and speed interact: fast zombies (runner/stalker) close the
 * distance, so reach matters much less against them.
 */

export interface ZombieContact {
  dmg: number;
  biteChance: number;
  /** Extra heat when it is allowed to scream. */
  heat: number;
}

/** How hard one fighter's weapon hits this zombie (standard blow = 3). */
export function strikePower(site: Site, v: Survivor, type: ZombieType): number {
  const z = ZOMBIES[type];
  const weapon = survivorWeapon(site, v);
  const dmg = weapon ? (ITEMS[weapon.id]?.dmg ?? 3) : 1.4;
  const pierce = weapon ? (ITEMS[weapon.id]?.pierce ?? 0.05) : 0.05;
  // Natural armour only stops what the weapon cannot pierce.
  const effectiveArmor = z.armor * (1 - pierce);
  return (dmg * (1 - effectiveArmor)) / z.hp;
}

/**
 * Share of one zombie a party of `members` can put down before it reaches them.
 * 1.0 = it never lands a blow; 0 = it walks straight through.
 */
export function killShare(site: Site, members: Survivor[], type: ZombieType): number {
  if (!members.length) return 0;
  const meleeAvg = members.reduce((a, m) => a + skill(m, 'melee'), 0) / members.length;
  const power = members.reduce((sum, m) => sum + strikePower(site, m, type), 0);
  // After the first fighter, extra hands help less (they get in each other's way).
  const crowd = 1 + 0.55 * Math.log2(Math.max(1, members.length));
  const skillBonus = 1 + 0.06 * meleeAvg;
  return Math.max(0, Math.min(0.95, (power * crowd * skillBonus) / 1.6));
}

/** The victim's armour against this zombie, after the zombie's bypass. */
export function armourAgainst(v: Survivor, type: ZombieType): number {
  const z = ZOMBIES[type];
  const bodyId = v.gear?.body;
  const headId = v.gear?.head;
  const body = bodyId ? (ITEMS[bodyId]?.mitigation ?? 0) : 0;
  const head = headId ? (ITEMS[headId]?.mitigation ?? 0) : 0;
  const raw = 1 - (1 - body) * (1 - head);
  // A mask blunts a bloater's bile; a hard plate blunts a brute's smash.
  let bypass = z.bypass;
  if (type === 'bloater' && headId && ITEMS[headId]?.mechanic === 'mask') bypass *= 0.35;
  if (type === 'brute' && bodyId && ITEMS[bodyId]?.mechanic === 'armor_plate') bypass *= 0.3;
  return Math.min(MITIGATION_CAP, raw * (1 - bypass));
}

/** Reach only helps against zombies that have to walk into it. */
export function reachFactor(site: Site, v: Survivor, type: ZombieType): number {
  const z = ZOMBIES[type];
  const weapon = survivorWeapon(site, v);
  const reach = weapon?.biteMult ?? 1;
  if (!z.fast) return reach;
  // A runner closes the gap: keep only a third of the reach benefit.
  return 1 - (1 - reach) / 3;
}

/** The blow this zombie lands on one victim, and how likely it bites. */
export function contactOf(site: Site, victim: Survivor, type: ZombieType, roll: number): ZombieContact {
  const z = ZOMBIES[type];
  if (!z) return { dmg: 0, biteChance: 0, heat: 0 };
  const armour = armourAgainst(victim, type);
  return {
    dmg: roll * (1 - armour),
    biteChance: z.bite * reachFactor(site, victim, type),
    heat: z.screams ? 8 : 0,
  };
}

/** Expected damage per round for the preview/report line. */
export function expectedContact(site: Site, type: ZombieType, members: Survivor[]): number {
  if (!members.length) return 0;
  const share = killShare(site, members, type);
  const avg = members.reduce((a, m) => a + armourAgainst(m, type), 0) / members.length;
  return ZOMBIES[type].dmg * (1 - avg) * (1 - share);
}
