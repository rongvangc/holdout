import { TECH_BY_ID, TECH_FOR_RECIPE, type TechDef } from '../data/research';
import type { GameState, Site } from './types';
import { log, present } from './state';
import { skill } from './survivors';
import { stationLevel } from './build';

/**
 * Nghiên cứu: một người đọc + sách + thời gian.
 *
 * Mỗi ngày (`dayEvent`) tiến độ tăng theo số người đang giữ vai "Nghiên cứu":
 * `0,75 + 0,05 × kỹ năng Chế tạo`, nhân thêm theo cấp Kệ sách (+15%/cấp trên 1).
 * Không có Kệ sách hoặc không có sách thì không bắt đầu được — buộc người chơi phải
 * đi lục nhà để có sách, thay vì ngồi chờ vật tư.
 */

export const doneTechs = (s: GameState): string[] => s.techs ?? [];
export const isTechDone = (s: GameState, id: string): boolean => doneTechs(s).includes(id);

/** Công thức này đã mở khoá chưa (không có tech ràng buộc = mở sẵn). */
export function recipeUnlocked(s: GameState, recipeId: string): boolean {
  const need = TECH_FOR_RECIPE[recipeId];
  return !need || isTechDone(s, need);
}

/** Công thức bị khoá bởi tech nào (null = mở sẵn). */
export const recipeTech = (recipeId: string): TechDef | null => {
  const id = TECH_FOR_RECIPE[recipeId];
  return id ? (TECH_BY_ID[id] ?? null) : null;
};

export function canStart(s: GameState, site: Site, id: string): string | null {
  const t = TECH_BY_ID[id];
  if (!t) return 'Không có đề tài này';
  if (isTechDone(s, id)) return 'Đã nghiên cứu xong';
  if (s.research) return s.research.tech === id ? 'Đang nghiên cứu đề tài này' : 'Đang làm đề tài khác';
  if (t.req && !isTechDone(s, t.req)) return `Cần "${TECH_BY_ID[t.req]?.label ?? t.req}" trước`;
  if (stationLevel(site, 'bookshelf') < 1) return 'Cần Kệ sách trong căn cứ';
  if ((site.stock.books ?? 0) < t.books) return `Cần ${t.books} cuốn sách (đang có ${Math.floor(site.stock.books ?? 0)})`;
  return null;
}

export function startResearch(s: GameState, site: Site, id: string): string | null {
  const why = canStart(s, site, id);
  if (why) return why;
  const t = TECH_BY_ID[id];
  site.stock.books = Math.max(0, (site.stock.books ?? 0) - t.books);
  s.research = { tech: id, progress: 0, siteId: site.id };
  log(s, `${site.name}: bắt đầu nghiên cứu "${t.label}" (−${t.books} sách). Giao một người vai Nghiên cứu.`, 'info');
  return null;
}

export function abandonResearch(s: GameState): void {
  if (!s.research) return;
  const t = TECH_BY_ID[s.research.tech];
  log(s, `Bỏ đề tài "${t?.label ?? s.research.tech}" — tiến độ ${Math.floor(s.research.progress * 100)}% mất trắng.`, 'bad');
  s.research = undefined;
}

/** Ngày công mỗi ngày của một người. */
const dailyRate = (v: { xp: Record<string, number> }, bookshelf: number): number =>
  (0.75 + 0.05 * skill(v as never, 'crafting')) * (1 + 0.15 * Math.max(0, bookshelf - 1));

export function tickResearch(s: GameState): void {
  const r = s.research;
  if (!r) return;
  const t = TECH_BY_ID[r.tech];
  if (!t) {
    s.research = undefined;
    return;
  }
  const site = s.sites.find((x) => x.id === r.siteId);
  if (!site) {
    s.research = undefined;
    return;
  }
  const workers = present(s, site).filter((v) => v.role === 'researcher' && v.location === 'base' && !v.commute && v.sickDays === 0);
  if (!workers.length) return; // không ai làm thì tiến độ đứng, đề tài không mất
  const shelf = stationLevel(site, 'bookshelf');
  for (const v of workers) r.progress += dailyRate(v, shelf) / t.days;
  if (r.progress >= 1) {
    s.techs = [...new Set([...doneTechs(s), t.id])];
    s.research = undefined;
    const first = t.unlocks.length ? `Mở khoá: ${t.unlocks.length} công thức` : '';
    log(s, `Nghiên cứu xong "${t.label}". ${t.passive?.label ?? first}`.trim(), 'good');
  }
}

/** Hệ số thụ động của các đề tài đã xong. */
export function researchBonus(s: GameState, kind: 'yield' | 'rot' | 'infection' | 'sepsis'): number {
  const done = doneTechs(s);
  const has = (id: string) => done.includes(id);
  switch (kind) {
    case 'yield':
      return has('t_breed') ? 1.12 : 1;
    case 'rot':
      return has('t_preserve') ? 0.7 : 1;
    case 'infection':
      return has('t_firstaid') ? 0.7 : 1;
    case 'sepsis':
      return has('t_surgery') ? 1.5 : 1;
  }
}

/** Trạng thái đề tài + số người đang làm, cho UI. */
export interface ResearchView {
  tech: TechDef | null;
  progress: number;
  workers: number;
  books: number;
  bookshelf: number;
}

export function researchView(s: GameState, site: Site): ResearchView {
  const workers = present(s, site).filter((v) => v.role === 'researcher' && v.location === 'base' && !v.commute).length;
  return {
    tech: s.research ? (TECH_BY_ID[s.research.tech] ?? null) : null,
    progress: s.research?.progress ?? 0,
    workers,
    books: Math.floor(site.stock.books ?? 0),
    bookshelf: stationLevel(site, 'bookshelf'),
  };
}
