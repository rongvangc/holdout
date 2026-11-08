import { canPlace, type Room } from '../base/interior';
import { fortifyCost, MODULES, type ModuleId } from '../data/modules';
import { RECIPE_BY_ID, STATION_LABEL, type Recipe } from '../data/recipes';
import type { SkillId } from './data';
import { dist } from '../world/geo';
import { addStock, alert, baseStats, canAfford, log, newId, take } from './state';
import { itemLabel as ITEMS_LABEL, type Stock } from '../data/items';
import { conditionOf, repairCost, restoreWeapon } from './equipment';
import type { GameState, Project, Site, StockDelta } from './types';

// Parts are fabricated at a workshop and carried, so one anywhere unlocks tier 2.
export const hasWorkshop = (s: GameState) => s.sites.some((x) => baseStats(s, x).workshop);

/** Groundwater rule: a dug well this close to a latrine is a hygiene problem. */
export const WELL_LATRINE_MIN_M = 10;

function roomCentroid(site: Site, r: Room): [number, number] {
  const it = site.interior;
  let sx = 0;
  let sy = 0;
  for (const c of r.cells) {
    sx += c % it.w;
    sy += Math.floor(c / it.w);
  }
  return [
    it.origin[0] + (sx / r.cells.length + 0.5) * it.cellSize,
    it.origin[1] + (sy / r.cells.length + 0.5) * it.cellSize,
  ];
}

export function queueModule(s: GameState, site: Site, roomId: string, module: ModuleId): string | null {
  const room = site.interior.rooms.find((r) => r.id === roomId);
  if (!room) return 'Không có phòng này';
  if (room.module) return 'Phòng đã có công trình';
  if (room.walled === false) return 'Đang chờ dựng vách ngăn';
  if (site.projects.some((p) => p.roomId === roomId)) return 'Phòng đang được xây';
  if (room.outdoor && room.cells.some((c) => site.interior.structures?.[c])) return 'Dọn công trình trên khoảnh này trước';
  const def = MODULES[module];
  const why = canPlace(site.interior, room, def);
  if (why) return why;
  if (module === 'well' || module === 'latrine') {
    const other: ModuleId = module === 'well' ? 'latrine' : 'well';
    const here = roomCentroid(site, room);
    const clash = site.interior.rooms.some(
      (r) =>
        (r.module === other || site.projects.some((p) => p.roomId === r.id && p.module === other)) &&
        dist(roomCentroid(site, r), here) < WELL_LATRINE_MIN_M,
    );
    if (clash) {
      return module === 'well'
        ? `Giếng phải cách nhà vệ sinh tối thiểu ${WELL_LATRINE_MIN_M} m`
        : `Nhà vệ sinh phải cách giếng tối thiểu ${WELL_LATRINE_MIN_M} m`;
    }
  }
  if (def.needsWorkshop && !hasWorkshop(s)) return 'Cần Bàn thợ (ở bất kỳ điểm nào) trước';
  if (def.maxPerSite) {
    const built = site.interior.rooms.filter((r) => r.module === module).length;
    const queued = site.projects.filter((p) => p.kind === 'module' && p.module === module).length;
    if (built + queued >= def.maxPerSite) return `Tối đa ${def.maxPerSite} ${def.label.toLowerCase()} mỗi điểm`;
  }
  site.projects.push({
    id: newId(s, 'p'),
    kind: 'module',
    roomId,
    module,
    label: `${def.label} (${room.outdoor ? 'sân' : `tầng ${room.floor + 1}`}, ${Math.round(room.area)} m²)`,
    workTotal: def.workSec(room.area),
    progress: 0,
    cost: def.cost(room.area),
    paid: false,
  });
  payProjects(s, site);
  return null;
}

export function queueDefense(s: GameState, site: Site, kind: 'fortify' | 'fence'): string | null {
  if (site.projects.some((p) => p.kind === kind)) return 'Đang có hạng mục này';
  const cur = site[kind];
  const perimeter = kind === 'fortify' ? site.interior.perimeter : site.interior.yardPerimeter;
  if (!perimeter) return kind === 'fortify' ? 'Không có nhà để gia cố' : 'Không có sân để rào';
  const repair = cur.level > 0 && cur.hp < 100;
  const level = repair ? cur.level : cur.level + 1;
  if (!repair && level > 3) return 'Đã tối đa';
  if (!repair && level >= 2 && !hasWorkshop(s)) return 'Cần Bàn thợ cho cấp 2+';
  const base = fortifyCost(level, perimeter);
  // Open land gets bamboo, wire and sharpened stakes, not brick and steel.
  const open = kind === 'fence' && site.kind === 'field' ? 0.4 : 1;
  const k = (repair ? ((100 - cur.hp) / 100) * 0.5 : 1) * open;
  const name = kind === 'fortify' ? 'Gia cố cửa/cửa sổ' : open < 1 ? 'Hàng rào tre/dây thép' : 'Tường rào';
  site.projects.push({
    id: newId(s, 'p'),
    kind,
    level,
    label: repair ? `Sửa ${name.toLowerCase()} cấp ${level}` : `${name} cấp ${level} (chu vi ${perimeter} m)`,
    workTotal: Math.max(600, Math.round(base.workSec * k)),
    progress: 0,
    cost: Object.fromEntries(Object.entries(base.cost).map(([i, v]) => [i, Math.ceil((v ?? 0) * k)])),
    paid: false,
  });
  payProjects(s, site);
  return null;
}

export function payProjects(s: GameState, site: Site): void {
  for (const p of site.projects) {
    if (p.paid || !canAfford(site, p.cost)) continue;
    addStock(s, site, p.cost, -1);
    p.paid = true;
  }
}

export function cancelProject(s: GameState, site: Site, id: string): void {
  const p = site.projects.find((x) => x.id === id);
  if (!p) return;
  if (p.paid) addStock(s, site, p.cost, 0.8);
  site.projects = site.projects.filter((x) => x !== p);
}

export function demolish(s: GameState, site: Site, roomId: string): void {
  const room = site.interior.rooms.find((r) => r.id === roomId);
  if (!room?.module) return;
  const refund = Object.fromEntries(
    Object.entries(MODULES[room.module].cost(room.area))
      .filter(([, v]) => (v ?? 0) > 0)
      .map(([k, v]) => [k, (v ?? 0) * 0.4]),
  ) as StockDelta;
  addStock(s, site, MODULES[room.module].cost(room.area), 0.4);
  log(s, `Tháo dỡ ${MODULES[room.module].label} ở ${site.name}.`, 'info', refund);
  room.module = undefined;
  delete site.plots[roomId];
}

/** Level of a station at this site (0 = not built). Highest wins across rooms. */
export function stationLevel(site: Site, module: ModuleId): number {
  let lvl = 0;
  for (const r of site.interior.rooms) if (r.module === module) lvl = Math.max(lvl, r.moduleLevel ?? 1);
  for (const p of site.projects) if (p.kind === 'module' && p.module === module && (p.level ?? 1) > lvl) lvl = p.level ?? 1;
  return lvl;
}

/** Every level a station can reach, 1-based (1 = the built level, then each upgrade). */
export function maxStationLevel(module: ModuleId): number {
  return 1 + (MODULES[module].levels?.length ?? 0);
}

/**
 * Queue a craft. Crafting reuses the build queue wholesale: the same site pays the
 * inputs, the same priority arrows reorder it, the same workers advance it — only
 * the skill applied and the completion effect differ.
 */
export function queueCraft(s: GameState, site: Site, recipeId: string): string | null {
  const r: Recipe | undefined = RECIPE_BY_ID[recipeId];
  if (!r) return 'Không có công thức này';
  const lvl = stationLevel(site, r.station);
  if (lvl < r.level) {
    return lvl === 0
      ? `Cần ${STATION_LABEL(r.station)}`
      : `${STATION_LABEL(r.station)} phải lên cấp ${r.level} (đang cấp ${lvl})`;
  }
  if (r.upgradeFrom && (site.stock[r.upgradeFrom] ?? 0) < 1) return 'Không có món gốc để nâng cấp';
  if (!canAfford(site, Object.fromEntries(r.in) as StockDelta)) return `Thiếu vật tư: ${fmtCostShort(Object.fromEntries(r.in))}`;
  site.projects.push({
    id: newId(s, 'p'),
    kind: 'craft',
    recipe: r.id,
    label: `Chế ${ITEMS_LABEL(r.out)} ×${r.qty}${r.upgradeFrom ? ` (từ ${ITEMS_LABEL(r.upgradeFrom)})` : ''}`,
    workTotal: r.workSec,
    progress: 0,
    cost: Object.fromEntries(r.in) as StockDelta,
    paid: false,
  });
  return null;
}

/**
 * Repair the site's worn weapons at the forge (level 2 unlocks the bench that can).
 * Cost scales with how far the stack has worn down; done through the same queue.
 */
export function queueRepair(s: GameState, site: Site, weaponId: string): string | null {
  if (stationLevel(site, 'forge') < 2) return 'Cần lò rèn cấp 2 để sửa vũ khí';
  if ((site.stock[weaponId] ?? 0) < 1) return 'Không có món này trong kho';
  const cond = conditionOf(site, weaponId);
  if (cond >= 0.98) return 'Món này còn mới';
  const cost = repairCost({ id: weaponId, mitigation: 0, biteMult: 1, durability: 60, noise: 0, isFirearm: false, ammo: null, condition: cond });
  const delta = { scrap: cost.scrap, charcoal: cost.charcoal } as StockDelta;
  if (!canAfford(site, delta)) return `Thiếu vật tư: ${fmtCostShort(delta)}`;
  if (site.projects.some((p) => p.kind === 'repair' && p.recipe === weaponId)) return 'Đang sửa món này rồi';
  site.projects.push({
    id: newId(s, 'p'),
    kind: 'repair',
    recipe: weaponId,
    label: `Sửa ${ITEMS_LABEL(weaponId)} (${Math.round((1 - cond) * 100)}% mòn)`,
    workTotal: 1800,
    progress: 0,
    cost: delta,
    paid: false,
  });
  return null;
}

/** Worn weapons the site could repair right now. */
export function repairableWeapons(site: Site): { id: string; condition: number }[] {
  const out: { id: string; condition: number }[] = [];
  for (const [id, n] of Object.entries(site.stock)) {
    if (!(n > 0)) continue;
    const c = site.condition?.[id];
    if (c !== undefined && c < 0.98) out.push({ id, condition: c });
  }
  return out.sort((a, b) => a.condition - b.condition);
}

/** Skill a worker applies to this project. */
export function projectSkill(p: Project): SkillId {
  if (p.kind === 'repair') return 'crafting';
  if (p.kind === 'craft') return RECIPE_BY_ID[p.recipe ?? '']?.skill ?? 'crafting';
  return 'construction';
}

/**
 * Queue the next level of a station already standing in `roomId`.
 * Reuses the build queue: same payment gate, same priority arrows, same workers.
 */
export function upgradeModule(s: GameState, site: Site, roomId: string): string | null {
  const room = site.interior.rooms.find((r) => r.id === roomId);
  if (!room?.module) return 'Phòng này chưa có công trình';
  const def = MODULES[room.module];
  if (!def.levels?.length) return `${def.label} không nâng cấp được`;
  const cur = room.moduleLevel ?? 1;
  if (cur >= maxStationLevel(room.module)) return `${def.label} đã ở cấp tối đa`;
  if (site.projects.some((p) => p.roomId === roomId)) return 'Phòng đang được xây';
  const next = def.levels[cur - 1];
  if (!next) return 'Không có cấp tiếp theo';
  if (!canAfford(site, next.cost)) return `Thiếu vật tư: ${fmtCostShort(next.cost)}`;
  site.projects.push({
    id: newId(s, 'p'),
    kind: 'module',
    roomId,
    module: room.module,
    level: cur + 1,
    label: `${def.label} → cấp ${cur + 1} (${room.outdoor ? 'sân' : `tầng ${room.floor + 1}`})`,
    workTotal: next.workSec,
    progress: 0,
    cost: next.cost,
    paid: false,
  });
  return null;
}

/** "20 sắt, 12 gạch" — short list for error messages. */
export function fmtCostShort(c: Partial<Stock>): string {
  return Object.entries(c)
    .filter(([, v]) => Number(v ?? 0) > 0)
    .map(([k, v]) => `${Math.round(Number(v ?? 0) * 10) / 10} ${k}`)
    .join(', ');
}

export const activeProject = (site: Site): Project | undefined => site.projects.find((p) => p.paid);

/** Reorder the build queue — builders always take the first paid project. */
export function moveProject(site: Site, id: string, dir: -1 | 1): void {
  const i = site.projects.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= site.projects.length) return;
  const [p] = site.projects.splice(i, 1);
  site.projects.splice(j, 0, p);
}

export function applyBuildWork(s: GameState, site: Site, p: Project, sec: number): void {
  p.progress += sec;
  if (p.progress < p.workTotal) return;
  site.projects = site.projects.filter((x) => x !== p);
  if (p.kind === 'craft') {
    const rec = RECIPE_BY_ID[p.recipe ?? ''];
    if (rec) {
      if (rec.upgradeFrom) take(site, rec.upgradeFrom, 1);
      addStock(s, site, { [rec.out]: rec.qty } as StockDelta);
      log(s, `${site.name}: chế xong ${ITEMS_LABEL(rec.out)} ×${rec.qty}.`, 'good');
    }
  } else if (p.kind === 'module') {
    const room = site.interior.rooms.find((r) => r.id === p.roomId)!;
    const upgrading = !!room.module && (p.level ?? 1) > (room.moduleLevel ?? 1);
    room.module = p.module;
    room.moduleLevel = p.level ?? 1;
    if (upgrading) {
      alert(s, `${site.name}: ${MODULES[p.module!].label} lên cấp ${room.moduleLevel}.`, 'good');
      return;
    }
    if (p.module === 'garden' || p.module === 'herb_garden') site.plots[room.id] = { roomId: room.id, crop: null, growth: 0, tendedToday: 0, plantedDay: 0 };
  } else if (p.kind === 'partition') {
    const room = site.interior.rooms.find((r) => r.id === p.roomId);
    if (room) room.walled = true;
  } else if (p.kind === 'repair') {
    const id = p.recipe;
    if (id) restoreWeapon(site, id);
    log(s, `${site.name}: sửa xong ${ITEMS_LABEL(p.recipe ?? '')}.`, 'good');
  } else if (p.kind === 'structure') {
    site.interior.structures ??= {};
    for (const c of p.cells ?? []) site.interior.structures[c] = p.struct!;
  } else {
    site[p.kind] = { level: p.level!, hp: 100 };
  }
  alert(s, `${site.name}: hoàn thành ${p.label}.`, 'good');
}
