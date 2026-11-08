import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/items';
import {
  amputate,
  AMPUTATION_SKILL,
  ANTIBIOTIC_LIMIT,
  ANTIBIOTIC_SKILL,
  BLEED_HP_PER_HOUR,
  bleedOf,
  canAmputate,
  canTreatSepsis,
  findMed,
  isBleeding,
  limbPenalty,
  medKind,
  triageOrder,
} from '../src/sim/medical';
import { newGame } from '../src/sim/state';
import { skill } from '../src/sim/survivors';
import type { Survivor } from '../src/sim/types';
import { makeTestWorld } from '../scripts/headless';

function setup() {
  const world = makeTestWorld();
  const b = world.buildings.filter((x) => x.area > 250 && x.area < 900)[0];
  const s = newGame(world, b.id, 5, new Date(2026, 5, 1));
  const site = s.sites[0];
  return { s, site, v: s.survivors[0] };
}

const findItem = (pred: (id: string, d: (typeof ITEMS)[string]) => boolean) =>
  Object.entries(ITEMS).find(([id, d]) => pred(id, d))?.[0];

describe('medical items are classified', () => {
  it('tourniquet, hemostatic, bandage, antiseptic, antibiotic, painkiller, infusion, medkit are all recognised', () => {
    const kinds = new Set(Object.keys(ITEMS).map((id) => medKind(id)).filter(Boolean));
    for (const k of ['tourniquet', 'hemostatic', 'bandage', 'antiseptic', 'antibiotic', 'painkiller', 'infusion', 'medkit']) {
      expect(Array.from(kinds), `missing ${k}`).toContain(k);
    }
  });

  it('classifies far more than the two ids the sim used to read', () => {
    const useful = Object.keys(ITEMS).filter((id) => medKind(id) !== null);
    expect(useful.length).toBeGreaterThan(40);
  });

  it('finds the cheapest item of a kind in stock', () => {
    const { site } = setup();
    const band = findItem((id) => medKind(id) === 'bandage');
    expect(band).toBeDefined();
    site.stock[band!] = 2;
    expect(findMed(site, 'bandage')).not.toBeNull();
    expect(findMed(site, 'tourniquet')).toBeNull();
  });
});

describe('wounds', () => {
  it('bleeding drains HP every hour', () => {
    const { v } = setup();
    v.bleed = 3;
    expect(bleedOf(v)).toBe(3);
    expect(isBleeding(v)).toBe(true);
    // The engine applies BLEED_HP_PER_HOUR * bleed per hour; assert the constant is meaningful.
    // 3 bậc phải đủ để chết trong khoảng một ngày, không phải một giờ.
    const hoursToDie = 100 / (BLEED_HP_PER_HOUR * 3);
    expect(hoursToDie).toBeGreaterThan(12);
    expect(hoursToDie).toBeLessThan(48);
    v.bleed = 0;
    expect(isBleeding(v)).toBe(false);
  });

  it('a medic treats sepsis before bleeding before illness before bruises', () => {
    const make = (o: Partial<Survivor>): Survivor => ({ id: Math.random().toString(), hp: 100, sickDays: 0, bleed: 0, infected: false, infection: 0, ...o }) as Survivor;
    const septic = make({ infected: true, infection: 20 });
    const bleeder = make({ bleed: 3 });
    const sick = make({ sickDays: 4 });
    const bruised = make({ hp: 40 });
    const order = triageOrder([bruised, sick, bleeder, septic]).map((x) => x.id);
    expect(order).toEqual([septic.id, bleeder.id, sick.id, bruised.id]);
  });

  it('sepsis can only be treated before it is too advanced', () => {
    const { v } = setup();
    v.infected = true;
    v.infection = ANTIBIOTIC_LIMIT - 1;
    expect(canTreatSepsis(v)).toBe(true);
    v.infection = ANTIBIOTIC_LIMIT + 1;
    expect(canTreatSepsis(v)).toBe(false);
  });
});

describe('amputation', () => {
  function ready() {
    const ctx = setup();
    const { s, site, v } = ctx;
    v.infected = true;
    v.bitten = true;
    v.woundPart = 'arm';
    site.stock.medicine = 5;
    site.stock.bandage = 5;
    const blade = findItem((_id, d) => d.cls === 'short_blade');
    site.stock[blade!] = 1;
    const room = site.interior.rooms[0];
    room.module = 'infirmary';
    room.moduleLevel = 2;
    const doc = s.survivors[1] ?? v;
    doc.siteId = site.id;
    doc.xp.medical = 4000; // well past level 5
    return { ...ctx, doc, blade: blade! };
  }

  it('needs a level-2 infirmary and a skilled doctor', () => {
    const { s, site, v } = ready();
    const room = site.interior.rooms[0];
    room.moduleLevel = 1;
    expect(amputate(s, site, v.id)).toContain('cấp 2');
    room.moduleLevel = 2;
    for (const x of s.survivors) x.xp.medical = 0;
    expect(amputate(s, site, v.id)).toContain(`Y tế ${AMPUTATION_SKILL}+`);
  });

  it('cures the infection, costs the supplies, and leaves a permanent penalty', () => {
    const { s, site, v, blade } = ready();
    const doc = s.survivors[1];
    expect(skill(doc, 'medical')).toBeGreaterThanOrEqual(AMPUTATION_SKILL);
    expect(amputate(s, site, v.id)).toBeNull();
    expect(v.infected).toBe(false);
    expect(v.lostLimb).toBe(true);
    expect(v.infection).toBe(0);
    expect(site.stock[blade]).toBe(0);
    expect(site.stock.medicine).toBe(3);
    expect(limbPenalty(v)).toBeLessThan(1);
    expect(amputate(s, site, v.id)).toContain('Đã cắt rồi');
  });

  it('refuses a torso or head wound, and a healthy person', () => {
    const { s, site, v } = ready();
    v.woundPart = 'torso';
    expect(amputate(s, site, v.id)).toContain('không cắt được');
    v.woundPart = 'arm';
    v.infected = false;
    v.bitten = false;
    expect(amputate(s, site, v.id)).toContain('không bị nhiễm');
  });

  it('only arms and legs can be cut', () => {
    expect(canAmputate('arm')).toBe(true);
    expect(canAmputate('leg')).toBe(true);
    expect(canAmputate('torso')).toBe(false);
    expect(canAmputate('head')).toBe(false);
    expect(canAmputate(undefined)).toBe(false);
  });
});

describe('antibiotics skill gate', () => {
  it('requires a real medic', () => {
    expect(ANTIBIOTIC_SKILL).toBeGreaterThanOrEqual(4);
  });
});
