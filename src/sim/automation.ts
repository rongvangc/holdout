import { ITEMS, type ItemId } from '../data/items';
import { FARM_M2_PER_WORKER } from './data';
import { RECIPES } from '../data/recipes';
import type { World } from '../world/types';
import { queueCraft, queueModule, stationLevel } from './build';
import { launchExpedition, planExpedition } from './expedition';
import { baseStats, log, present, canAfford } from './state';
import type { GameState, Site } from './types';
import { canPlace } from '../base/interior';

/**
 * Ba công tắc tự động cho người chơi (mặc định TẮT).
 *
 * Bot đã tự làm ba việc này từ lâu; người chơi thì phải bấm tay và hay quên —
 * quên chế vật tư lõi thì không xây được gì, quên lập đội lục soát thì chết đói.
 * Cùng một logic, đặt trong sim để cả hai dùng chung.
 */
export interface AutoSettings {
  /** Tự chế vật tư lõi còn thiếu (than, chỉ, ván, đinh, lưỡi, bản lề…). */
  craftCore: boolean;
  /** Tự lập đội lục soát khi có người rảnh và còn nhà chưa vét. */
  loot: boolean;
  /** Tự xây thêm vườn khi kho lương thực cạn. */
  garden: boolean;
}

export const DEFAULT_AUTO: AutoSettings = { craftCore: false, loot: false, garden: false };

/** Mức cần có của vật tư lõi. Dưới mức này thì chế thêm. */
const CORE_TARGETS: [ItemId, number][] = [
  ['plank', 6],
  ['nail', 10],
  ['thread', 8],
  ['rope', 4],
  ['handle', 3],
  ['blade', 2],
  ['tool_head', 2],
  ['hinge', 4],
  ['plate', 2],
];

/** Một hạng mục mỗi lượt để không chiếm hết hàng đợi của người chơi. */
export function autoCraftCore(s: GameState, site: Site): string | null {
  for (const [id, want] of CORE_TARGETS) {
    if ((site.stock[id] ?? 0) >= want) continue;
    const recipe = RECIPES.find((r) => r.out === id);
    if (!recipe) continue;
    if (stationLevel(site, recipe.station) < recipe.level) continue;
    if (!canAfford(site, Object.fromEntries(recipe.in))) continue;
    const why = queueCraft(s, site, recipe.id);
    if (!why) return id;
  }
  return null;
}

/**
 * Tự lập đội lục soát: chỉ đi khi có ít nhất 2 người rảnh khoẻ, còn nhà chưa vét
 * trong bán kính, và nguy cơ bị cắn dưới 25% (giống điều kiện bot dùng).
 */
export function autoLoot(s: GameState, world: World, site: Site): string | null {
  if (s.expeditions.some((e) => e.fromSite === site.id && e.kind !== 'convoy')) return null;
  // Không ai đi lấy nước là kiểu chết nhanh nhất: ưu tiên hơn lục soát.
  const pop = Math.max(1, present(s, site).length);
  const waterDays = site.stock.water / (pop * 3.3);
  if (waterDays < 3 && world.waterPoints.length) {
    const team0 = present(s, site)
      .filter((v) => v.location === 'base' && !v.commute && v.role !== 'guard' && v.hp > 60 && v.sickDays === 0)
      .sort((a, b) => b.hp - a.hp)
      .slice(0, 3)
      .map((v) => v.id);
    if (team0.length >= 2) {
      const wp = [...world.waterPoints].sort(
        (a, b) => Math.hypot(a.pos[0] - site.centroid[0], a.pos[1] - site.centroid[1]) - Math.hypot(b.pos[0] - site.centroid[0], b.pos[1] - site.centroid[1]),
      )[0];
      const why = launchExpedition(s, world, { fromSite: site.id, members: team0, target: { type: 'water', id: wp.id }, mode: 'walk' });
      if (!why) return wp.id;
    }
  }
  const idle = present(s, site)
    .filter((v) => v.location === 'base' && !v.commute && v.role !== 'guard' && v.hp > 60 && v.sickDays === 0)
    .sort((a, b) => b.hp - a.hp);
  if (idle.length < 2) return null;
  const owned = new Set(s.sites.map((x) => x.sourceId));
  const targets = world.buildings
    .filter((b) => !owned.has(b.id) && b.containers - (s.looted[b.id] ?? 0) > 3)
    .map((b) => ({ b, d: Math.hypot(b.centroid[0] - site.centroid[0], b.centroid[1] - site.centroid[1]) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 4);
  const team = idle.slice(0, Math.min(4, Math.max(2, Math.floor(idle.length / 2)))).map((v) => v.id);
  for (const { b } of targets) {
    const order = { fromSite: site.id, members: team, target: { type: 'building' as const, id: b.id }, mode: 'walk' as const, containers: 40 };
    const plan = planExpedition(s, world, order);
    if (!plan.ok || plan.biteRisk >= 0.25) continue;
    const why = launchExpedition(s, world, order);
    return why ? null : b.id;
  }
  return null;
}

/** Thiếu lương thì mở thêm một khoảnh vườn trên chỗ trống hợp lệ. */
export function autoGarden(s: GameState, site: Site): string | null {
  const st = baseStats(s, site);
  const pop = Math.max(1, st.population);
  const days = (site.stock.food + site.stock.rawFood + site.stock.meals) / (pop * 2250);
  if (days >= 20) return null;
  if (site.projects.some((p) => p.kind === 'module' && p.module === 'garden')) return null;
  // Mở vườn mà không có ai chăm thì chỉ tạo cảnh "vườn bỏ hoang" (đúng lỗi đã gặp).
  const farmers = s.survivors.filter((v) => v.status === 'alive' && v.siteId === site.id && v.location === 'base' && !v.commute && v.role === 'farmer').length;
  const covered = farmers * FARM_M2_PER_WORKER;
  if (farmers === 0 || st.gardenArea + 300 > covered) return null;
  const room = site.interior.rooms.find(
    (r) => !r.module && r.walled !== false && canPlace(site.interior, r, { placement: 'top_or_outdoor', minArea: 20 }) === null,
  );
  if (!room) return null;
  const why = queueModule(s, site, room.id, 'garden');
  if (why) return null;
  log(s, `${site.name}: tự mở thêm vườn (${Math.round(room.area)} m²) vì kho chỉ còn ${days.toFixed(0)} ngày lương.`, 'info');
  return room.id;
}

/** Chạy các công tắc đang bật, mỗi ngày một lượt. */
export function runAuto(s: GameState, world: World): void {
  const auto = s.auto;
  if (!auto) return;
  const sites = s.sites.filter((x) => present(s, x).length > 0);
  if (auto.craftCore) for (const site of sites) autoCraftCore(s, site);
  if (auto.garden) for (const site of sites) autoGarden(s, site);
  if (auto.loot) {
    // Chỉ lập một chuyến mỗi ngày, ưu tiên điểm đông người nhất.
    const main = [...sites].sort((a, b) => present(s, b).length - present(s, a).length)[0];
    if (main) autoLoot(s, world, main);
  }
}

// --- Cảnh báo thiếu lao động ------------------------------------------------

export interface SiteWarning {
  id: string;
  text: string;
  severity: 'warn' | 'bad';
}

/**
 * Những việc đang bị bỏ trống mà người chơi khó thấy: vườn không có nông dân,
 * có trạm nước mà không ai phụ trách, người tay không dù kho có vũ khí.
 */
export function siteWarnings(s: GameState, site: Site): SiteWarning[] {
  const st = baseStats(s, site);
  const out: SiteWarning[] = [];
  const staff = s.survivors.filter((v) => v.status === 'alive' && v.siteId === site.id && v.location === 'base' && !v.commute);
  const roleCount = (role: string) => staff.filter((v) => v.role === role).length;

  const plots = Object.values(site.plots);
  const ripe = plots.filter((p) => p.crop && p.growth >= 1).length;
  const unplanted = plots.filter((p) => !p.crop).length;
  if (st.gardenArea > 0 && roleCount('farmer') === 0 && plots.length > 0) {
    out.push({
      id: 'no-farmer',
      text: `Vườn ${Math.round(st.gardenArea)} m² nhưng không có nông dân — rau sẽ không được gieo/chăm`,
      severity: 'bad',
    });
  } else if (ripe > 0 && roleCount('farmer') === 0) {
    out.push({ id: 'ripe-unattended', text: `${ripe} khoảnh vườn đã chín mà không có ai thu hoạch`, severity: 'warn' });
  }
  if (unplanted > 0 && (site.stock.seeds ?? 0) < unplanted && roleCount('farmer') > 0) {
    out.push({ id: 'no-seeds', text: `Thiếu hạt giống: ${unplanted} khoảnh trống nhưng kho còn ${Math.floor(site.stock.seeds ?? 0)} gói`, severity: 'warn' });
  }
  if ((st.filter || st.well) && roleCount('water') === 0) {
    out.push({
      id: 'no-water-role',
      text: `Có ${st.filter ? 'trạm lọc' : 'giếng'} nhưng không ai phụ trách nước — sẽ hết nước uống`,
      severity: 'bad',
    });
  }
  if (st.kitchen && roleCount('cook') === 0 && (site.stock.rawFood ?? 0) > 2000) {
    out.push({ id: 'no-cook', text: 'Có bếp và gạo sống nhưng không có đầu bếp', severity: 'warn' });
  }
  const armed = staff.filter((v) => v.gear?.weapon).length;
  const weaponsInStock = Object.entries(site.stock).filter(([id, n]) => (n ?? 0) >= 1 && ITEMS[id]?.mechanic && ['weapon_blade', 'weapon_blunt', 'firearm'].includes(ITEMS[id].mechanic!)).length;
  if (weaponsInStock > 0 && armed === 0) {
    out.push({ id: 'unarmed', text: `Kho có ${weaponsInStock} loại vũ khí nhưng không ai được cấp`, severity: 'warn' });
  }
  return out;
}
