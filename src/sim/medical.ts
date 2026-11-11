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
  // `cures: true` trong catalog cũng là kháng sinh, kể cả khi tên không khớp từ khoá.
  if (def.cures && ['medicine', 'injection'].includes(def.mechanic ?? '')) return 'antibiotic';
  return def.mechanic === 'bandage' ? 'bandage' : def.mechanic === 'medkit' ? 'medkit' : null;
}

/** Best available item of each kind, cheapest first so the good stuff is kept. */
export function findMed(site: { stock: Record<string, number> }, kind: MedKind): ItemId | null {
  const candidates = Object.entries(ITEMS)
    .filter(([id]) => (site.stock[id] ?? 0) >= 1 && medKind(id) === kind)
    .sort(([, a], [, b]) => a.kgPerUnit - b.kgPerUnit || (a.tier ?? 1) - (b.tier ?? 1));
  return candidates.length ? candidates[0][0] : null;
}

const BLEED_MAX = 3;
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

/** What a patient needs right now, in the same order the medic triages them. */
export interface Treatment {
  /** Recipe the action consumes: an item id, or the legacy `medicine` dose. */
  item: ItemId | null;
  label: string;
  /** Why it cannot be done, or null when it can. */
  blocked: string | null;
}

/**
 * One call answers both "what does this person need" and "can I do it now",
 * so the UI never has to re-derive the rules and drift from the medic AI.
 */
export function planTreatment(site: { stock: Record<string, number> }, v: Survivor, doctorSkill: number): Treatment | null {
  if (v.status !== 'alive') return null;
  if (v.infected && (v.infection ?? 0) < ANTIBIOTIC_LIMIT) {
    const item = findMed(site as never, 'antibiotic');
    return {
      item,
      label: `kháng sinh (nhiễm ${Math.round(v.infection ?? 0)}%)`,
      blocked: doctorSkill < ANTIBIOTIC_SKILL ? `cần người Y tế ${ANTIBIOTIC_SKILL}+` : item ? null : 'không có kháng sinh',
    };
  }
  if (bleedOf(v) > 0) {
    const item = findMed(site as never, 'tourniquet') ?? findMed(site as never, 'hemostatic') ?? findMed(site as never, 'bandage');
    return { item, label: `cầm máu (${bleedOf(v)}/3)`, blocked: item ? null : 'không có băng/garo' };
  }
  if (v.sickDays > 0) {
    const has = (site.stock.medicine ?? 0) >= 1;
    return { item: has ? 'medicine' : null, label: `thuốc (bệnh ${v.sickDays} ngày)`, blocked: has ? null : 'không có thuốc' };
  }
  if (v.hp < 70) {
    const item = findMed(site as never, 'medkit') ?? findMed(site as never, 'bandage') ?? findMed(site as never, 'infusion');
    return { item, label: `hồi HP (${Math.round(v.hp)}/100)`, blocked: item ? null : 'không có băng/medkit' };
  }
  if (v.woundPart) {
    const item = findMed(site as never, 'antiseptic');
    return { item, label: 'rửa vết thương', blocked: item ? null : 'không có cồn/iodine' };
  }
  return null;
}

/**
 * Treat immediately, consuming the item. The medic AI does the same work on a
 * timer; this is the manual override so a player can spend a dose *now*.
 */
export function treatNow(
  s: { t: number },
  site: { stock: Record<string, number> },
  v: Survivor,
  doctorSkill: number,
): string | null {
  const plan = planTreatment(site, v, doctorSkill);
  if (!plan) return 'Người này không cần gì';
  if (plan.blocked) return `Không làm được: ${plan.blocked}`;
  if (!plan.item) return 'Thiếu vật tư';
  site.stock[plan.item] = Math.max(0, (site.stock[plan.item] ?? 0) - 1);

  if (v.infected && (v.infection ?? 0) < ANTIBIOTIC_LIMIT) {
    v.infection = Math.max(0, (v.infection ?? 0) - ANTIBIOTIC_RELIEF);
    if (v.infection === 0) {
      v.infected = false;
      v.biteKnown = false;
    }
  } else if (bleedOf(v) > 0) {
    const kind = medKind(plan.item);
    const stopped = kind === 'tourniquet' ? 3 : kind === 'hemostatic' ? 2 : 1;
    v.bleed = Math.max(0, bleedOf(v) - stopped);
    if (kind === 'tourniquet') v.fatigue = Math.min(100, v.fatigue + 8);
  } else if (v.sickDays > 0) {
    v.sickDays = 0;
  } else if (v.hp < 70) {
    v.hp = Math.min(100, v.hp + 15);
  } else if (v.woundPart) {
    v.woundCleanedDay = Math.floor(s.t / 86400) + 1;
  }
  v.treatedToday = true;
  return null;
}
