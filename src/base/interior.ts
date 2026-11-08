import { int, makeRng, range, type Rng } from '../core/rng';
import type { ModuleId } from '../data/modules';
import type { StructId } from '../data/structures';
import { bbox, pointInPolygon, polygonArea } from '../world/geo';
import type { Vec } from '../world/types';

export const CELL_VOID = 0;
export const CELL_FLOOR = 1;
export const CELL_YARD = 2;

export interface Room {
  id: string;
  floor: number; // 0 = ground; yard rooms are floor 0 + outdoor
  outdoor: boolean;
  cells: number[]; // indices into the w*h grid
  area: number;
  module?: ModuleId;
  name?: string;
  walled?: boolean; // false while a player-drawn room is waiting for its partitions
}

export interface Interior {
  buildingId: string;
  cellSize: number;
  w: number;
  h: number;
  origin: Vec; // local-metre coords of grid cell (0,0)
  floors: number;
  kinds: number[]; // per cell, shared by all floors
  rooms: Room[];
  footprintArea: number;
  yardArea: number;
  perimeter: number;
  yardPerimeter: number;
  structures?: Record<number, StructId>; // yard cell index -> built structure
}

const MAX_FLOORS = 6;
const YARD_PAD = 8;

function perimeterOf(poly: Vec[]): number {
  let p = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    p += Math.hypot(poly[i][0] - poly[j][0], poly[i][1] - poly[j][1]);
  }
  return p;
}

/**
 * OSM only gives a footprint and a level count, so rooms are procedurally partitioned
 * (BSP) inside the real footprint. Yard = free land around it not covered by neighbours.
 * A field (park/farmland polygon) is all yard: no floors, plots only.
 */
export function generateInterior(
  b: { id: string; poly: Vec[]; levels: number },
  neighbours: { id: string; poly: Vec[] }[],
  seed: number,
  field = false,
): Interior {
  const pad = field ? 0 : YARD_PAD;
  const [x0, y0, x1, y1] = bbox(b.poly);
  const span = Math.max(x1 - x0, y1 - y0) + 2 * pad;
  const cellSize = Math.max(2, Math.ceil(span / 44));
  const origin: Vec = [x0 - pad, y0 - pad];
  const w = Math.max(1, Math.ceil((x1 - x0 + 2 * pad) / cellSize));
  const h = Math.max(1, Math.ceil((y1 - y0 + 2 * pad) / cellSize));
  const others = neighbours.filter((n) => n.id !== b.id);

  const kinds = new Array<number>(w * h).fill(CELL_VOID);
  for (let cy = 0; cy < h; cy++) {
    for (let cx = 0; cx < w; cx++) {
      const p: Vec = [origin[0] + (cx + 0.5) * cellSize, origin[1] + (cy + 0.5) * cellSize];
      if (pointInPolygon(p, b.poly)) kinds[cy * w + cx] = field ? CELL_YARD : CELL_FLOOR;
      else if (!field && !others.some((o) => pointInPolygon(p, o.poly))) kinds[cy * w + cx] = CELL_YARD;
    }
  }
  // Tiny shapes can rasterize to nothing; force at least the centre cell.
  if (!kinds.includes(field ? CELL_YARD : CELL_FLOOR)) {
    kinds[Math.floor(h / 2) * w + Math.floor(w / 2)] = field ? CELL_YARD : CELL_FLOOR;
  }

  const floors = field ? 1 : Math.max(1, Math.min(MAX_FLOORS, b.levels));
  const rng = makeRng(seed);
  const rooms: Room[] = [];
  const cellArea = cellSize * cellSize;
  for (let f = 0; f < (field ? 0 : floors); f++) {
    for (const cells of partition(rng, kinds, w, h, CELL_FLOOR, Math.max(30, cellArea * 3), cellSize)) {
      rooms.push({ id: `f${f}r${rooms.length}`, floor: f, outdoor: false, cells, area: cells.length * cellArea });
    }
  }
  for (const cells of partition(rng, kinds, w, h, CELL_YARD, field ? Math.max(200, cellArea * 4) : 50, cellSize)) {
    if (cells.length * cellArea < 6) continue;
    rooms.push({ id: `y${rooms.length}`, floor: 0, outdoor: true, cells, area: cells.length * cellArea });
  }

  const yardCells = kinds.filter((k) => k === CELL_YARD).length;
  const yb = field ? perimeterOf(b.poly) : yardCells ? 2 * (w + h) * cellSize : 0;
  return {
    buildingId: b.id,
    cellSize,
    w,
    h,
    origin,
    floors,
    kinds,
    rooms,
    footprintArea: field ? 0 : Math.round(polygonArea(b.poly)),
    yardArea: yardCells * cellArea,
    perimeter: field ? 0 : Math.round(perimeterOf(b.poly)),
    yardPerimeter: Math.round(yb),
  };
}

/** Recursive split of the grid's bounding rect; leaves become rooms of cells of `kind`. */
function partition(rng: Rng, kinds: number[], w: number, h: number, kind: number, maxArea: number, cs: number): number[][] {
  const out: number[][] = [];
  const cellsIn = (rx0: number, ry0: number, rx1: number, ry1: number) => {
    const c: number[] = [];
    for (let y = ry0; y < ry1; y++) for (let x = rx0; x < rx1; x++) if (kinds[y * w + x] === kind) c.push(y * w + x);
    return c;
  };
  const split = (rx0: number, ry0: number, rx1: number, ry1: number, depth: number) => {
    const cells = cellsIn(rx0, ry0, rx1, ry1);
    if (!cells.length) return;
    const rw = rx1 - rx0;
    const rh = ry1 - ry0;
    const area = cells.length * cs * cs;
    if (area <= maxArea * range(rng, 0.7, 1.3) || depth > 12 || (rw < 3 && rh < 3)) {
      out.push(cells);
      return;
    }
    if (rw >= rh && rw >= 3) {
      const m = rx0 + int(rng, Math.max(1, Math.floor(rw * 0.35)), Math.max(1, Math.ceil(rw * 0.65) - 1));
      split(rx0, ry0, m, ry1, depth + 1);
      split(m, ry0, rx1, ry1, depth + 1);
    } else {
      const m = ry0 + int(rng, Math.max(1, Math.floor(rh * 0.35)), Math.max(1, Math.ceil(rh * 0.65) - 1));
      split(rx0, ry0, rx1, m, depth + 1);
      split(rx0, m, rx1, ry1, depth + 1);
    }
  };
  split(0, 0, w, h, 0);
  return out;
}

export const roomsWith = (it: Interior, m: ModuleId) => it.rooms.filter((r) => r.module === m);

export function canPlace(it: Interior, room: Room, m: { placement: string; minArea: number }): string | null {
  if (room.area < m.minArea) return `Cần tối thiểu ${m.minArea} m²`;
  const top = room.floor === it.floors - 1;
  switch (m.placement) {
    case 'indoor':
      return room.outdoor ? 'Phải ở trong nhà' : null;
    case 'outdoor':
      return room.outdoor ? null : 'Phải ở ngoài sân';
    case 'ground':
      return room.floor === 0 ? null : 'Phải ở tầng trệt hoặc sân';
    case 'top_or_outdoor':
      return room.outdoor || top ? null : 'Phải ở tầng thượng hoặc ngoài sân';
    default:
      return null;
  }
}
