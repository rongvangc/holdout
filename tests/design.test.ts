import { describe, expect, it } from 'vitest';
import { CELL_FLOOR, CELL_YARD } from '../src/base/interior';
import { DESIGN_LIMITS } from '../src/data/structures';
import { advanceTo } from '../src/sim/engine';
import { clearCells, components, mergeRooms, paintRoom, placeStructures, removeStructures, structCapacity } from '../src/sim/design';
import { queueModule } from '../src/sim/build';
import { baseStats, mainSite, newGame } from '../src/sim/state';
import { makeTestWorld } from '../scripts/headless';

function setup() {
  const world = makeTestWorld();
  const baseB = world.buildings.filter((b) => b.area > 250 && b.area < 900)[0];
  const s = newGame(world, baseB.id, 42, new Date(2026, 5, 1));
  const site = mainSite(s);
  site.stock.wood = 500;
  site.stock.scrap = 500;
  return { world, s, site };
}

const cellsOf = (kinds: number[], k: number) => kinds.map((x, i) => (x === k ? i : -1)).filter((i) => i >= 0);

describe('free design', () => {
  it('paints a new indoor room that needs partitions before use', () => {
    const { s, site } = setup();
    const it2 = site.interior;
    const floor = cellsOf(it2.kinds, CELL_FLOOR);
    const pick = components(floor, it2.w, it2.h)[0].slice(0, 4);
    const before = it2.rooms.length;
    expect(paintRoom(s, site, { floor: 0, outdoor: false }, pick, 'Kho súng')).toBeNull();
    const r = it2.rooms.find((x) => x.name === 'Kho súng')!;
    expect(r.cells.sort()).toEqual([...pick].sort());
    expect(r.walled).toBe(false);
    expect(it2.rooms.length).toBeGreaterThanOrEqual(before);
    // No cell may belong to two rooms on the same floor.
    const seen = new Set<number>();
    for (const x of it2.rooms.filter((q) => !q.outdoor && q.floor === 0)) for (const c of x.cells) {
      expect(seen.has(c)).toBe(false);
      seen.add(c);
    }
    expect(queueModule(s, site, r.id, 'storage')).toMatch(/vách/);
  });

  it('refuses rooms that are too big, split, or over a built module', () => {
    const { s, site } = setup();
    const it2 = site.interior;
    const floor = cellsOf(it2.kinds, CELL_FLOOR);
    const huge = floor.slice(0, Math.ceil(DESIGN_LIMITS.maxRoomIndoor / (it2.cellSize * it2.cellSize)) + 5);
    expect(paintRoom(s, site, { floor: 0, outdoor: false }, huge)).toMatch(/Tối đa|liền/);
    const room = it2.rooms.find((r) => !r.outdoor && r.floor === 0)!;
    room.module = 'kitchen';
    expect(paintRoom(s, site, { floor: 0, outdoor: false }, [room.cells[0]])).toMatch(/tháo dỡ/);
  });

  it('merges adjacent rooms and clears cells into corridor', () => {
    const { s, site } = setup();
    const it2 = site.interior;
    const rooms = it2.rooms.filter((r) => !r.outdoor && r.floor === 0);
    const [a, b] = rooms.flatMap((x) => rooms.map((y) => [x, y] as const)).find(([x, y]) => x !== y && mergeable(x.cells, y.cells, it2.w))!;
    const total = a.cells.length + b.cells.length;
    if (total * it2.cellSize ** 2 <= DESIGN_LIMITS.maxRoomIndoor) {
      expect(mergeRooms(s, site, a.id, b.id)).toBeNull();
      expect(a.cells.length).toBe(total);
    }
    const cell = a.cells[0];
    expect(clearCells(s, site, { floor: 0, outdoor: false }, [cell])).toBeNull();
    expect(it2.rooms.some((r) => r.cells.includes(cell) && !r.outdoor && r.floor === 0)).toBe(false);
  });

  it('places structures within limits, builds them, and they add capped defense', () => {
    const { world, s, site } = setup();
    const it2 = site.interior;
    const yard = cellsOf(it2.kinds, CELL_YARD);
    const before = baseStats(s, site).defenseStatic;
    expect(placeStructures(s, site, 'barricade', yard.slice(0, 6))).toBeNull();
    expect(placeStructures(s, site, 'tower', yard.slice(10, 20))).toMatch(/Tối đa 4/);
    const cap = structCapacity(site);
    expect(placeStructures(s, site, 'wall', yard.slice(30, 30 + cap.max + 5))).toMatch(/giới hạn/);
    advanceTo(s, world, s.t + 2 * 86400);
    expect(Object.keys(it2.structures ?? {}).length).toBeGreaterThan(0);
    expect(baseStats(s, site).defenseStatic).toBeGreaterThan(before);
    const wood = site.stock.wood;
    expect(removeStructures(s, site, yard.slice(0, 6))).toBeNull();
    expect(site.stock.wood).toBeGreaterThan(wood);
  });
});

function mergeable(a: number[], b: number[], w: number) {
  const bs = new Set(b);
  return a.some((c) => bs.has(c + 1) || bs.has(c - 1) || bs.has(c + w) || bs.has(c - w));
}
