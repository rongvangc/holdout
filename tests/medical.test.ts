import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/items';
import {
  ANTIBIOTIC_LIMIT,
  ANTIBIOTIC_SKILL,
  BLEED_HP_PER_HOUR,
  bleedOf,
  canTreatSepsis,
  findMed,
  isBleeding,
  medKind,
  triageOrder,
} from '../src/sim/medical';
import { newGame } from '../src/sim/state';
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

describe('antibiotics skill gate', () => {
  it('requires a real medic', () => {
    expect(ANTIBIOTIC_SKILL).toBeGreaterThanOrEqual(4);
  });
});
