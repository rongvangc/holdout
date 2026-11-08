import { CELL_FLOOR, CELL_YARD, type Interior, type Room } from '../base/interior';
import { DESIGN_LIMITS, STRUCTS, type StructId } from '../data/structures';
import { payProjects } from './build';
import { addStock, log, newId } from './state';
import type { GameState, Site, StockDelta } from './types';

export interface Layer {
  floor: number;
  outdoor: boolean;
}

const neighbours = (c: number, w: number, h: number) => {
  const x = c % w;
  const y = Math.floor(c / w);
  const out: number[] = [];
  if (x > 0) out.push(c - 1);
  if (x < w - 1) out.push(c + 1);
  if (y > 0) out.push(c - w);
  if (y < h - 1) out.push(c + w);
  return out;
};

/** Split a cell set into 4-connected groups. */
export function components(cells: number[], w: number, h: number): number[][] {
  const left = new Set(cells);
  const groups: number[][] = [];
  for (const start of cells) {
    if (!left.has(start)) continue;
    left.delete(start);
    const g = [start];
    for (let i = 0; i < g.length; i++) {
      for (const n of neighbours(g[i], w, h)) {
        if (left.has(n)) {
          left.delete(n);
          g.push(n);
        }
      }
    }
    groups.push(g);
  }
  return groups;
}

const inLayer = (r: Room, l: Layer) => r.outdoor === l.outdoor && (l.outdoor || r.floor === l.floor);
const cellKind = (l: Layer) => (l.outdoor ? CELL_YARD : CELL_FLOOR);
/** Ruộng là đất trống nên khoảnh được lớn hơn sân trong thành phố. */
const maxArea = (l: Layer, site?: Site) =>
  l.outdoor ? (site?.kind === 'field' ? DESIGN_LIMITS.maxRoomField : DESIGN_LIMITS.maxRoomOutdoor) : DESIGN_LIMITS.maxRoomIndoor;

function busy(site: Site, r: Room): string | null {
  if (r.module) return `Phòng "${roomName(r)}" đang có công trình — tháo dỡ trước`;
  if (site.projects.some((p) => p.roomId === r.id && p.kind === 'module')) return `Phòng "${roomName(r)}" đang được xây`;
  return null;
}

export const roomName = (r: Room) => r.name ?? `${r.outdoor ? 'Sân' : `T${r.floor + 1}`} ${Math.round(r.area)}m²`;

function setCells(it: Interior, r: Room, cells: number[]): void {
  r.cells = cells;
  r.area = cells.length * it.cellSize * it.cellSize;
}

function dropPartition(s: GameState, site: Site, roomId: string): void {
  for (const p of site.projects.filter((x) => x.kind === 'partition' && x.roomId === roomId)) {
    if (p.paid) addStock(s, site, p.cost, 1);
  }
  site.projects = site.projects.filter((x) => !(x.kind === 'partition' && x.roomId === roomId));
}

/** New/changed indoor rooms need partitions built before anything can go in them. */
function needPartition(s: GameState, site: Site, r: Room): void {
  if (r.outdoor) return;
  dropPartition(s, site, r.id);
  r.walled = false;
  const n = r.cells.length;
  site.projects.push({
    id: newId(s, 'p'),
    kind: 'partition',
    roomId: r.id,
    label: `Dựng vách ngăn: ${roomName(r)}`,
    workTotal: 600 + n * DESIGN_LIMITS.partitionSecPerCell,
    progress: 0,
    cost: { wood: Math.ceil(n * DESIGN_LIMITS.partitionWoodPerCell) },
    paid: false,
  });
  payProjects(s, site);
}

/** Remove cells from rooms; leftovers that fall apart become separate rooms, empty ones vanish. */
function carve(s: GameState, site: Site, l: Layer, cells: Set<number>): void {
  const it = site.interior;
  for (const r of it.rooms.filter((x) => inLayer(x, l) && x.cells.some((c) => cells.has(c)))) {
    const rest = r.cells.filter((c) => !cells.has(c));
    const parts = components(rest, it.w, it.h).sort((a, b) => b.length - a.length);
    if (!parts.length) {
      it.rooms = it.rooms.filter((x) => x !== r);
      delete site.plots[r.id];
      dropPartition(s, site, r.id);
      continue;
    }
    setCells(it, r, parts[0]);
    for (const p of parts.slice(1)) {
      const nr: Room = { id: newId(s, 'rm'), floor: r.floor, outdoor: r.outdoor, cells: [], area: 0, walled: r.walled };
      setCells(it, nr, p);
      it.rooms.push(nr);
      needPartition(s, site, nr);
    }
  }
}

function affected(site: Site, l: Layer, cells: Set<number>): string | null {
  for (const r of site.interior.rooms) {
    if (!inLayer(r, l) || !r.cells.some((c) => cells.has(c))) continue;
    const why = busy(site, r);
    if (why) return why;
  }
  return null;
}

function validCells(site: Site, l: Layer, cells: number[]): number[] {
  const it = site.interior;
  const k = cellKind(l);
  const st = it.structures ?? {};
  return [...new Set(cells)].filter((c) => it.kinds[c] === k && !(l.outdoor && st[c]));
}

export function paintRoom(s: GameState, site: Site, l: Layer, cells: number[], name?: string): string | null {
  const it = site.interior;
  const valid = validCells(site, l, cells);
  if (!valid.length) return l.outdoor ? 'Chỉ vẽ được trên đất trống ngoài sân' : 'Chỉ vẽ được bên trong toà nhà';
  if (components(valid, it.w, it.h).length > 1) return 'Phòng phải liền một khối';
  const area = valid.length * it.cellSize * it.cellSize;
  if (area > maxArea(l, site)) return `Tối đa ${maxArea(l, site)} m² mỗi ${l.outdoor ? 'khoảnh' : 'phòng'}`;
  const set = new Set(valid);
  const why = affected(site, l, set);
  if (why) return why;
  carve(s, site, l, set);
  const r: Room = { id: newId(s, 'rm'), floor: l.outdoor ? 0 : l.floor, outdoor: l.outdoor, cells: [], area: 0, name, walled: true };
  setCells(it, r, valid);
  it.rooms.push(r);
  needPartition(s, site, r);
  log(s, `${site.name}: vẽ ${l.outdoor ? 'khoảnh đất' : 'phòng'} mới ${Math.round(area)} m².`);
  return null;
}

export function clearCells(s: GameState, site: Site, l: Layer, cells: number[]): string | null {
  const set = new Set(validCells(site, l, cells));
  if (!set.size) return 'Không có ô nào hợp lệ';
  const why = affected(site, l, set);
  if (why) return why;
  carve(s, site, l, set);
  return null;
}

export function mergeRooms(s: GameState, site: Site, aId: string, bId: string): string | null {
  const it = site.interior;
  const a = it.rooms.find((r) => r.id === aId);
  const b = it.rooms.find((r) => r.id === bId);
  if (!a || !b || a === b) return 'Chọn hai phòng khác nhau';
  if (a.outdoor !== b.outdoor || a.floor !== b.floor) return 'Hai phòng phải cùng tầng';
  const why = busy(site, a) ?? busy(site, b);
  if (why) return why;
  const bs = new Set(b.cells);
  if (!a.cells.some((c) => neighbours(c, it.w, it.h).some((n) => bs.has(n)))) return 'Hai phòng phải sát nhau';
  const l: Layer = { floor: a.floor, outdoor: a.outdoor };
  if ((a.cells.length + b.cells.length) * it.cellSize * it.cellSize > maxArea(l, site)) return `Tối đa ${maxArea(l, site)} m²`;
  setCells(it, a, [...a.cells, ...b.cells]);
  a.walled = (a.walled ?? true) && (b.walled ?? true);
  it.rooms = it.rooms.filter((r) => r !== b);
  dropPartition(s, site, b.id);
  delete site.plots[b.id];
  return null;
}

export function renameRoom(site: Site, roomId: string, name: string): void {
  const r = site.interior.rooms.find((x) => x.id === roomId);
  if (r) r.name = name.trim().slice(0, 32) || undefined;
}

function pendingStructCells(site: Site): Set<number> {
  return new Set(site.projects.filter((p) => p.kind === 'structure').flatMap((p) => p.cells ?? []));
}

export function structCapacity(site: Site): { used: number; max: number } {
  const it = site.interior;
  const yard = it.kinds.filter((k) => k === CELL_YARD).length;
  const used = Object.keys(it.structures ?? {}).length + pendingStructCells(site).size;
  return { used, max: Math.floor(yard * DESIGN_LIMITS.structFraction) };
}

/** Plan per-cell structures on open land: one project per stroke, paid up front. */
export function placeStructures(s: GameState, site: Site, type: StructId, cells: number[]): string | null {
  const it = site.interior;
  const def = STRUCTS[type];
  const pending = pendingStructCells(site);
  const st = it.structures ?? {};
  const busyRooms = new Set(it.rooms.filter((r) => r.outdoor && (r.module || site.projects.some((p) => p.roomId === r.id))).flatMap((r) => r.cells));
  const valid = [...new Set(cells)].filter((c) => it.kinds[c] === CELL_YARD && !st[c] && !pending.has(c) && !busyRooms.has(c));
  if (!valid.length) return 'Chỉ xây trên ô đất trống (không trùng vườn, giếng… hay công trình khác)';
  const cap = structCapacity(site);
  if (cap.used + valid.length > cap.max) return `Vượt giới hạn: tối đa ${cap.max} ô công trình ngoài trời (đang dùng ${cap.used})`;
  if (def.maxPerSite) {
    const have = Object.values(st).filter((x) => x === type).length + site.projects.filter((p) => p.struct === type).reduce((n, p) => n + (p.cells?.length ?? 0), 0);
    if (have + valid.length > def.maxPerSite) return `Tối đa ${def.maxPerSite} ${def.label.toLowerCase()} mỗi điểm`;
  }
  const cost: StockDelta = Object.fromEntries(Object.entries(def.cost).map(([k, v]) => [k, Math.ceil((v ?? 0) * valid.length * 10) / 10]));
  site.projects.push({
    id: newId(s, 'p'),
    kind: 'structure',
    struct: type,
    cells: valid,
    label: `${def.label} × ${valid.length} ô`,
    workTotal: def.workSec * valid.length,
    progress: 0,
    cost,
    paid: false,
  });
  payProjects(s, site);
  return null;
}

/** Tear down built structures (40% refund) and cancel planned ones on those cells. */
export function removeStructures(s: GameState, site: Site, cells: number[]): string | null {
  const it = site.interior;
  const set = new Set(cells);
  let n = 0;
  for (const c of set) {
    const id = it.structures?.[c];
    if (!id) continue;
    addStock(s, site, STRUCTS[id].cost, 0.4);
    delete it.structures![c];
    n++;
  }
  for (const p of site.projects.filter((x) => x.kind === 'structure')) {
    const keep = (p.cells ?? []).filter((c) => !set.has(c));
    if (keep.length === p.cells?.length) continue;
    const ratio = keep.length / (p.cells?.length ?? 1);
    if (p.paid) addStock(s, site, p.cost, 1 - ratio);
    p.cost = Object.fromEntries(Object.entries(p.cost).map(([k, v]) => [k, (v ?? 0) * ratio]));
    p.workTotal = STRUCTS[p.struct!].workSec * keep.length;
    p.progress = Math.min(p.progress, p.workTotal);
    p.cells = keep;
    p.label = `${STRUCTS[p.struct!].label} × ${keep.length} ô`;
    n++;
  }
  site.projects = site.projects.filter((p) => p.kind !== 'structure' || (p.cells?.length ?? 0) > 0);
  return n ? null : 'Không có công trình nào ở đó';
}
