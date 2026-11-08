import { ITEMS, type ItemId } from '../data/items';
import type { Survivor } from './types';

/**
 * Medical layer.
 *
 * The simulation used to have two medical facts: "sick" and "bitten". This file
 * gives wounds their own state (bleeding, contamination, sepsis) and makes the 70
 * catalogue medical items actually do something, by classifying them once here
 * instead of tagging 647 generated entries.
 */

export type WoundPart = 'arm' | 'leg' | 'torso' | 'head';

/** What a medical item is good at. First match wins. */
export type MedKind = 'tourniquet' | 'hemostatic' | 'bandage' | 'antiseptic' | 'antibiotic' | 'painkiller' | 'infusion' | 'medkit';

const MED_RULES: [RegExp, MedKind][] = [
  [/tourniquet|garrote/i, 'tourniquet'],
  [/celox|quickclot|hemostatic|chitosan/i, 'hemostatic'],
  [/bandage|plaster|band-aid|cotton ?wool|dressing|gauze/i, 'bandage'],
  [/alcohol|antiseptic|iodine|chlorhexidine|peroxide/i, 'antiseptic'],
  [/penicillin|tetracycl|doxycycl|amoxicill|ampicill|antibiotic|ciproflox|azithromy|kháng sinh/i, 'antibiotic'],
  [/painkiller|analgesic|morphine|ibuprofen|paracetamol|ketorolac|nimesulide|aspirin/i, 'painkiller'],
  [/infusion|saline|sodium chloride|sterofundin|blood ?bag|plasma|iv\b/i, 'infusion'],
  [/medkit|medical ?bag|ifak|afak|first ?aid/i, 'medkit'],
];

/** Classify a catalogue medical item. Returns null for bandages/meds that do nothing new. */
export function medKind(id: ItemId): MedKind | null {
  const def = ITEMS[id];
  if (!def) return null;
  if (!['medicine', 'bandage', 'injection', 'medkit', 'hygiene'].includes(def.mechanic ?? '')) return null;
  for (const [re, kind] of MED_RULES) if (re.test(def.label)) return kind;
  return def.mechanic === 'bandage' ? 'bandage' : def.mechanic === 'medkit' ? 'medkit' : null;
}

/** Best available item of each kind, cheapest first so the good stuff is kept. */
export function findMed(site: { stock: Record<string, number> }, kind: MedKind): ItemId | null {
  const candidates = Object.entries(ITEMS)
    .filter(([id]) => (site.stock[id] ?? 0) >= 1 && medKind(id) === kind)
    .sort(([, a], [, b]) => a.kgPerUnit - b.kgPerUnit || (a.tier ?? 1) - (b.tier ?? 1));
  return candidates.length ? candidates[0][0] : null;
}

export const BLEED_MAX = 3;
/** HP lost per hour per bleed step. 3 steps is ~3.6 HP/h: a day to die, not an hour. */
export const BLEED_HP_PER_HOUR = 1.2;
/** Chance a dirty wound turns septic, per day. */
export const WOUND_SEPSIS_CHANCE = 0.12;
/** Chance after the wound has been cleaned with antiseptic. */
export const CLEAN_SEPSIS_CHANCE = 0.03;
/** Antibiotics stop working once sepsis is this advanced. */
export const ANTIBIOTIC_LIMIT = 60;
export const ANTIBIOTIC_RELIEF = 40;
/** Medical skill needed to administer antibiotics properly. */
export const ANTIBIOTIC_SKILL = 4;
export const PART_LABEL: Record<WoundPart, string> = {
  arm: 'tay',
  leg: 'chân',
  torso: 'thân',
  head: 'đầu',
};

/** Wound rolls in order of how much they hurt right now. */
export function bleedOf(v: Survivor): number {
  return Math.max(0, Math.min(BLEED_MAX, v.bleed ?? 0));
}

export const isBleeding = (v: Survivor): boolean => bleedOf(v) > 0;
export const isSeptic = (v: Survivor): boolean => v.infected;
export const canTreatSepsis = (v: Survivor): boolean => v.infected && (v.infection ?? 0) < ANTIBIOTIC_LIMIT;

/**
 * Treatment priority for a medic: the person who will die soonest first.
 * Sepsis beats bleeding beats illness beats bruises, because sepsis is the only
 * one with a deadline you cannot extend.
 */
export function triageOrder(patients: Survivor[]): Survivor[] {
  const score = (p: Survivor): number => {
    if (canTreatSepsis(p)) return 1000 - (p.infection ?? 0);
    if (isBleeding(p)) return 800 + bleedOf(p) * 50;
    if (p.sickDays > 0) return 500 - p.sickDays;
    return 100 - p.hp;
  };
  return [...patients].sort((a, b) => score(b) - score(a));
}

/** Roll a wound when someone takes a hard hit in a fight. */
export function rollWound(severity: number, rngPick: <T>(arr: readonly T[]) => T): { part: WoundPart; bleed: number } {
  const part = rngPick(['arm', 'leg', 'torso', 'head'] as const);
  const bleed = severity >= 25 ? 3 : severity >= 12 ? 2 : 1;
  return { part, bleed: part === 'head' || part === 'torso' ? Math.min(BLEED_MAX, bleed + 1) : bleed };
}
