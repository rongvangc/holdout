import { describe, expect, it } from 'vitest';
import { TECHS, TECH_BY_ID, TECH_FOR_RECIPE } from '../src/data/research';
import { RECIPES } from '../src/data/recipes';
import { canStart, isTechDone, recipeUnlocked, researchBonus, startResearch, tickResearch } from '../src/sim/research';
import { addStock, mainSite, newGame } from '../src/sim/state';
import { advanceTo } from '../src/sim/engine';
import { makeTestWorld } from '../scripts/headless';

function setup(seed = 7, shelf = true) {
  const world = makeTestWorld();
  const b = world.buildings.find((x) => x.area > 250 && x.area < 900)!;
  const s = newGame(world, b.id, seed, new Date(2026, 5, 1));
  s.auto = { craftCore: false, loot: false, garden: false };
  s.autoRoles = false; // để test tự giao vai, không bị autoAssign ghi đè
  const site = mainSite(s);
  if (!shelf) return { s, site, world };
  site.interior.rooms.push({
    id: 'rs',
    floor: 0,
    outdoor: false,
    cells: [site.interior.rooms.length],
    area: 12,
    module: 'bookshelf',
    walled: true,
    moduleLevel: 1,
  });
  return { s, site, world };
}

describe('research data', () => {
  it('mỗi đề tài mở khoá công thức có thật, và điều kiện trước cũng có thật', () => {
    for (const t of TECHS) {
      for (const r of t.unlocks) expect(RECIPES.some((x) => x.id === r), `${t.id} → ${r}`).toBe(true);
      if (t.req) expect(TECH_BY_ID[t.req], `${t.id} cần ${t.req}`).toBeTruthy();
      expect(t.days).toBeGreaterThan(0);
      expect(t.books).toBeGreaterThan(0);
    }
    // Không công thức nào bị hai đề tài tranh nhau.
    const seen = new Set<string>();
    for (const t of TECHS) {
      for (const r of t.unlocks) {
        expect(seen.has(r), `${r} bị mở bởi 2 đề tài`).toBe(false);
        seen.add(r);
      }
    }
    expect(TECH_FOR_RECIPE['r_bot']).toBe('t_mill');
  });

  it('có đủ ba nhánh, mỗi nhánh ≥3 đề tài, và chuỗi điều kiện không vòng', () => {
    for (const branch of ['farm', 'med', 'eng'] as const) {
      expect(TECHS.filter((t) => t.branch === branch).length).toBeGreaterThanOrEqual(3);
    }
    // req phải trỏ về đề tài đứng trước nó trong danh sách (không vòng, không nhảy cóc).
    const seen = new Set<string>();
    for (const t of TECHS) {
      if (t.req) expect(seen.has(t.req), `${t.id} cần ${t.req} nhưng ${t.req} đứng sau`).toBe(true);
      seen.add(t.id);
    }
  });

  it('không phải công thức nào cũng bị khoá — nguyên liệu nền vẫn làm được ngay', () => {
    const gated = new Set(TECHS.flatMap((t) => t.unlocks));
    const base = RECIPES.filter((r) => ['r_plank', 'r_nail', 'r_thread', 'r_rope', 'r_gear', 'r_handle'].includes(r.id));
    expect(base.length).toBeGreaterThanOrEqual(5);
    const s = setup().s;
    for (const r of base) expect(recipeUnlocked(s, r.id), r.id).toBe(true);
    expect(gated.size).toBeGreaterThan(10);
  });
});

describe('research loop', () => {
  it('cần Kệ sách, rồi cần sách, rồi mới bắt đầu', () => {
    const { s, site } = setup(7, false);
    site.stock.books = 0;
    expect(canStart(s, site, 't_mill')).toContain('Kệ sách');

    const again = setup();
    again.site.stock.books = 0; // ván mới có sẵn 2 cuốn: xoá để đo bước thiếu sách
    expect(canStart(again.s, again.site, 't_mill')).toContain('sách');
    addStock(again.s, again.site, { books: 5 } as never);
    expect(canStart(again.s, again.site, 't_mill')).toBeNull();
    expect(startResearch(again.s, again.site, 't_mill')).toBeNull();
    expect(again.site.stock.books).toBe(3);
    expect(again.s.research?.tech).toBe('t_mill');
  });

  it('từ chối đề tài khi chưa có đề tài trước', () => {
    const { s, site } = setup();
    addStock(s, site, { books: 20 } as never);
    expect(canStart(s, site, 't_preserve')).toContain('Xay xát');
  });

  it('tiến độ chỉ chạy khi có người vai Nghiên cứu', () => {
    const { s, site } = setup();
    addStock(s, site, { books: 5 } as never);
    startResearch(s, site, 't_mill');
    tickResearch(s);
    expect(s.research!.progress).toBe(0);
    const v = s.survivors.find((x) => x.status === 'alive')!;
    v.role = 'researcher';
    v.siteId = site.id;
    v.location = 'base';
    tickResearch(s);
    expect(s.research!.progress).toBeGreaterThan(0);
  });

  it('đọc đủ ngày công thì xong, và mở khoá công thức', () => {
    const { s, site } = setup();
    addStock(s, site, { books: 5 } as never);
    startResearch(s, site, 't_mill');
    expect(recipeUnlocked(s, 'r_bot')).toBe(false);
    for (const v of s.survivors) {
      if (v.status !== 'alive') continue;
      v.role = 'researcher';
      v.siteId = site.id;
      v.location = 'base';
    }
    for (let i = 0; i < 20 && s.research; i++) tickResearch(s);
    expect(s.research).toBeUndefined();
    expect(isTechDone(s, 't_mill')).toBe(true);
    expect(recipeUnlocked(s, 'r_bot')).toBe(true);
    expect(s.log.some((l) => l.msg.includes('Nghiên cứu xong "Xay xát"'))).toBe(true);
  });

  it('kệ sách cấp cao đọc nhanh hơn', () => {
    const run = (level: number) => {
      const { s, site } = setup();
      addStock(s, site, { books: 5 } as never);
      site.interior.rooms.find((r) => r.module === 'bookshelf')!.moduleLevel = level;
      startResearch(s, site, 't_mill');
      const v = s.survivors.find((x) => x.status === 'alive')!;
      v.role = 'researcher';
      v.siteId = site.id;
      v.location = 'base';
      tickResearch(s);
      return s.research!.progress;
    };
    expect(run(3)).toBeGreaterThan(run(1));
  });

  it('hiệu ứng thụ động chỉ có sau khi nghiên cứu', () => {
    const { s } = setup();
    expect(researchBonus(s, 'yield')).toBe(1);
    expect(researchBonus(s, 'rot')).toBe(1);
    expect(researchBonus(s, 'sepsis')).toBe(1);
    s.techs = ['t_breed', 't_preserve', 't_surgery', 't_firstaid'];
    expect(researchBonus(s, 'yield')).toBeCloseTo(1.12);
    expect(researchBonus(s, 'rot')).toBeCloseTo(0.7);
    expect(researchBonus(s, 'infection')).toBeCloseTo(0.7);
    expect(researchBonus(s, 'sepsis')).toBeCloseTo(1.5);
  });

  it('chạy cả ngày trong sim: đề tài tự tiến và tự xong', () => {
    const { s, site, world } = setup();
    addStock(s, site, { books: 5 } as never);
    startResearch(s, site, 't_mill');
    for (const v of s.survivors) {
      if (v.status !== 'alive') continue;
      v.role = 'researcher';
      v.siteId = site.id;
      v.location = 'base';
    }
    for (let d = 0; d < 10 && !isTechDone(s, 't_mill'); d++) advanceTo(s, world, s.t + 86400);
    expect(isTechDone(s, 't_mill')).toBe(true);
  });
});
