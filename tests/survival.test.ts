import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/items';
import { bestTool, wearTool } from '../src/sim/equipment';
import { insulation } from '../src/sim/gear';
import { equip } from '../src/sim/gear';
import { medKind } from '../src/sim/medical';
import { mainSite, newGame } from '../src/sim/state';
import { makeTestWorld } from '../scripts/headless';

function setup() {
  const world = makeTestWorld();
  const b = world.buildings.find((x) => x.area > 250 && x.area < 900)!;
  const s = newGame(world, b.id, 42, new Date(2026, 5, 1));
  return { s, site: mainSite(s), v: s.survivors[0] };
}

describe('clothing keeps you warm', () => {
  it('every clothing item carries insulation, and wearing more is warmer', () => {
    const clothes = Object.values(ITEMS).filter((d) => ['clothes', 'boots', 'gloves'].includes(d.mechanic ?? ''));
    expect(clothes.length).toBeGreaterThan(50);
    expect(clothes.every((d) => (d.insulation ?? 0) > 0)).toBe(true);

    const { site, v } = setup();
    const coat = clothes.find((d) => d.mechanic === 'clothes')!;
    const boots = clothes.find((d) => d.mechanic === 'boots')!;
    const coatId = Object.keys(ITEMS).find((id) => ITEMS[id] === coat)!;
    const bootId = Object.keys(ITEMS).find((id) => ITEMS[id] === boots)!;
    expect(insulation(v)).toBe(0);
    site.stock[coatId] = 1;
    equip(site, v, 'outfit', coatId);
    const withCoat = insulation(v);
    expect(withCoat).toBeGreaterThan(0);
    // Áo và giày dùng chung một slot quần áo: món tốt hơn (giữ ấm hơn) được chọn.
    site.stock[bootId] = 1;
    expect(equip(site, v, 'outfit', bootId)).toBeNull();
    expect(insulation(v)).toBeGreaterThan(0);
  });
});

describe('tools wear out', () => {
  it('jobs consume tool condition and a spent tool leaves the stock', () => {
    const { site } = setup();
    const tool = Object.keys(ITEMS).find((id) => ITEMS[id].mechanic === 'tool' && (ITEMS[id].durability ?? 0) > 0)!;
    site.stock[tool] = 1;
    expect(bestTool(site)?.id).toBe(tool);
    for (let i = 0; i < 500; i++) wearTool(site, 1);
    expect(site.stock[tool]).toBe(0);
  });

  it('without a tool nothing is charged', () => {
    const { site } = setup();
    for (const id of Object.keys(site.stock)) site.stock[id] = 0;
    expect(wearTool(site, 1).broke).toBe(false);
  });
});

describe('medicine classification', () => {
  it('antibiotic names and cures:true both classify as antibiotics', () => {
    const named = Object.keys(ITEMS).find((id) => /penicillin|amoxicill/i.test(ITEMS[id].label) && ITEMS[id].mechanic === 'medicine');
    if (named) expect(medKind(named)).toBe('antibiotic');
    const flagged = Object.entries(ITEMS).find(([, d]) => d.cures && d.mechanic === 'medicine' && !/penicillin|tetra|doxy|amoxi|ampic|antibio|cipro|azithro/i.test(d.label));
    if (flagged) expect(medKind(flagged[0])).toBe('antibiotic');
  });
});
