import { ITEMS, type ItemId } from '../data/items';
import type { GameState, Site, Survivor } from './types';

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
/** Amputation requirements. */
export const AMPUTATION_SKILL = 5;
export const AMPUTATION_MEDICINE = 2;
export const AMPUTATION_REGEN_PENALTY = 0.75; // melee output multiplier afterwards
export const AMPUTATION_CARRY_PENALTY = 15; // kg off carrying capacity

/** Legs and arms can be cut off; a neck or belly wound cannot. */
export const canAmputate = (part: WoundPart | undefined): boolean => part === 'arm' || part === 'leg';

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

/**
 * Amputation: the one way out of a lethal bite.
 *
 * Requires a level-2 infirmary (a place clean enough to cut), a medic with real
 * skill, two doses of medicine, a blade and a bandage. The survivor lives, but the
 * arm or leg is gone for good.
 */
export function amputate(s: GameState, site: Site, victimId: string): string | null {
  const v = s.survivors.find((x) => x.id === victimId);
  if (!v || v.status !== 'alive') return 'Không có người này';
  if (v.lostLimb) return 'Đã cắt rồi';
  if (!v.infected && !v.bitten) return 'Người này không bị nhiễm';
  if (!canAmputate(v.woundPart)) {
    return v.woundPart ? `Vết cắn ở ${PART_LABEL[v.woundPart]} — không cắt được` : 'Chưa xác định vết cắn ở đâu';
  }
  const infirmary = site.interior.rooms.find((r) => r.module === 'infirmary' && (r.moduleLevel ?? 1) >= 2);
  if (!infirmary) return 'Cần Phòng y tế cấp 2';
  const doctor = s.survivors
    .filter((x) => x.status === 'alive' && x.siteId === site.id && x.location === 'base')
    .sort((a, b) => (b.xp.medical ?? 0) - (a.xp.medical ?? 0))[0];
  if (!doctor) return 'Không có ai ở điểm này';
  const docSkill = doctor.xp.medical ?? 0;
  if (docSkill < AMPUTATION_SKILL) return `Cần người có Y tế ${AMPUTATION_SKILL}+ (cao nhất ở đây: ${docSkill})`;
  if ((site.stock.medicine ?? 0) < AMPUTATION_MEDICINE) return `Cần ${AMPUTATION_MEDICINE} liều thuốc`;
  const blade = findBlade(site);
  if (!blade) return 'Cần một con dao/lưỡi trong kho';
  if ((site.stock.bandage ?? 0) < 1) return 'Cần băng gạc';

  site.stock[blade] = Math.max(0, (site.stock[blade] ?? 0) - 1);
  site.stock.medicine -= AMPUTATION_MEDICINE;
  site.stock.bandage -= 1;
  v.infected = false;
  v.bitten = false;
  v.biteKnown = false;
  v.infection = 0;
  v.lostLimb = true;
  v.bleed = 2; // the stump has to be watched for a while
  v.hp = Math.max(1, v.hp - 25);
  v.fatigue = Math.min(100, v.fatigue + 25);
  v.morale = Math.max(0, v.morale - 15);
  return null;
}

/** Cheapest bladed item in the store, used as the surgeon's knife. */
function findBlade(site: Site): ItemId | null {
  const cut = (Object.entries(ITEMS) as [string, (typeof ITEMS)[string]][])
    .filter(([id, d]) => (site.stock[id] ?? 0) >= 1 && d.cls === 'short_blade')
    .sort(([, a], [, b]) => a.kgPerUnit - b.kgPerUnit);
  return cut.length ? cut[0][0] : null;
}

/** Combat strength after a lost limb (0.75) — applied where damage is dealt. */
export const limbPenalty = (v: Survivor): number => (v.lostLimb ? AMPUTATION_REGEN_PENALTY : 1);
/** Carrying capacity lost with a limb. */
export const limbCarryPenalty = (v: Survivor): number => (v.lostLimb ? AMPUTATION_CARRY_PENALTY : 0);
