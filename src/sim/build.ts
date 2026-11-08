import { canPlace } from '../base/interior';
import { fortifyCost, MODULES, type ModuleId } from '../data/modules';
import { addStock, alert, baseStats, canAfford, log, newId } from './state';
import type { GameState, Project, Site } from './types';

// Parts are fabricated at a workshop and carried, so one anywhere unlocks tier 2.
export const hasWorkshop = (s: GameState) => s.sites.some((x) => baseStats(s, x).workshop);

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
  if (def.needsWorkshop && !hasWorkshop(s)) return 'Cần Bàn thợ (ở bất kỳ điểm nào) trước';
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
  addStock(s, site, MODULES[room.module].cost(room.area), 0.4);
  log(s, `Tháo dỡ ${MODULES[room.module].label} ở ${site.name}.`);
  room.module = undefined;
  delete site.plots[roomId];
}

export const activeProject = (site: Site): Project | undefined => site.projects.find((p) => p.paid);

export function applyBuildWork(s: GameState, site: Site, p: Project, sec: number): void {
  p.progress += sec;
  if (p.progress < p.workTotal) return;
  site.projects = site.projects.filter((x) => x !== p);
  if (p.kind === 'module') {
    const room = site.interior.rooms.find((r) => r.id === p.roomId)!;
    room.module = p.module;
    if (p.module === 'garden') site.plots[room.id] = { roomId: room.id, crop: null, growth: 0, tendedToday: 0, plantedDay: 0 };
  } else if (p.kind === 'partition') {
    const room = site.interior.rooms.find((r) => r.id === p.roomId);
    if (room) room.walled = true;
  } else if (p.kind === 'structure') {
    site.interior.structures ??= {};
    for (const c of p.cells ?? []) site.interior.structures[c] = p.struct!;
  } else {
    site[p.kind] = { level: p.level!, hp: 100 };
  }
  alert(s, `${site.name}: hoàn thành ${p.label}.`, 'good');
}
