import { chance, int, pick, range, type Rng } from '../core/rng';
import { BACKGROUNDS, FAMILY, GIVEN, SKILLS, TRAITS, type SkillId, type TraitId } from './data';
import type { Survivor } from './types';

const LEVEL_BASE = 100;
const LEVEL_GROWTH = 1.55;
export const MAX_LEVEL = 10;

export function xpForLevel(level: number): number {
  let total = 0;
  for (let l = 1; l <= level; l++) total += LEVEL_BASE * LEVEL_GROWTH ** (l - 1);
  return total;
}

export function levelOf(xp: number): number {
  let l = 0;
  while (l < MAX_LEVEL && xp >= xpForLevel(l + 1)) l++;
  return l;
}

export function skill(s: Survivor, id: SkillId): number {
  const l = levelOf(s.xp[id]);
  return id === 'stealth' && s.traits.includes('quiet') ? l + 2 : l;
}

export const hasTrait = (s: Survivor, t: TraitId) => s.traits.includes(t);

/** Work-speed multiplier: skills are time currency (−4%/level, −5% for construction & crafting). */
export function speed(s: Survivor, id: SkillId | undefined): number {
  let m = 1;
  if (id) {
    const per = id === 'construction' || id === 'crafting' ? 0.05 : 0.04;
    m /= 1 - per * Math.min(MAX_LEVEL, skill(s, id));
    if ((id === 'construction' || id === 'crafting') && hasTrait(s, 'handy')) m *= 1.2;
  }
  if (s.morale < 25) m *= 0.8;
  if (s.sickDays > 0) m *= 0.5;
  if (s.hp < 40) m *= 0.75;
  return m;
}

export function gainXp(s: Survivor, id: SkillId, amount: number): boolean {
  const before = levelOf(s.xp[id]);
  s.xp[id] += amount;
  return levelOf(s.xp[id]) > before;
}

export function makeSurvivor(rng: Rng, id: string, day: number): Survivor {
  const bg = pick(rng, BACKGROUNDS);
  const xp = Object.fromEntries(Object.keys(SKILLS).map((k) => [k, 0])) as Record<SkillId, number>;
  for (const k of Object.keys(xp) as SkillId[]) {
    const lvl = bg.skills[k] ?? (chance(rng, 0.35) ? int(rng, 1, 2) : 0);
    xp[k] = xpForLevel(lvl) + range(rng, 0, 40);
  }
  const traitIds = Object.keys(TRAITS) as TraitId[];
  const traits: TraitId[] = [];
  const nTraits = chance(rng, 0.6) ? 1 : chance(rng, 0.5) ? 2 : 0;
  while (traits.length < nTraits) {
    const t = pick(rng, traitIds);
    if (traits.includes(t)) continue;
    if ((t === 'brave' && traits.includes('coward')) || (t === 'coward' && traits.includes('brave'))) continue;
    traits.push(t);
  }
  return {
    id,
    name: `${pick(rng, FAMILY)} ${pick(rng, GIVEN)}`,
    age: int(rng, 17, 62),
    background: bg.label,
    traits,
    xp,
    role: 'idle',
    hp: range(rng, 70, 100),
    kcal: range(rng, 1400, 2600),
    water: range(rng, 1800, 3000),
    fatigue: range(rng, 10, 50),
    morale: range(rng, 40, 70),
    infection: 0,
    infected: false,
    bitten: false,
    biteKnown: false,
    sickDays: 0,
    treatedToday: false,
    status: 'alive',
    siteId: '',
    location: 'base',
    task: null,
    joinedDay: day,
  };
}

export const isActive = (s: Survivor) => s.status === 'alive';
export const atBase = (s: Survivor) => s.status === 'alive' && s.location === 'base';
