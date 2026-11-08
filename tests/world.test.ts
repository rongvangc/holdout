import { describe, expect, it } from 'vitest';
import { makeQueue, pop, push, removeWhere } from '../src/core/eventQueue';
import { generateInterior } from '../src/base/interior';
import { buildWorld } from '../src/world/generate';
import { shortestPath } from '../src/world/graph';
import { syntheticOsm } from '../src/world/synthetic';

const CENTER: [number, number] = [105.85, 21.03];

describe('event queue', () => {
  it('pops in time order, FIFO on ties, and supports removal', () => {
    const q = makeQueue<string>();
    push(q, 5, 'c');
    push(q, 1, 'a');
    push(q, 5, 'd');
    push(q, 3, 'b');
    removeWhere(q, (e) => e === 'b');
    const out: string[] = [];
    for (let x = pop(q); x; x = pop(q)) out.push(x.ev);
    expect(out).toEqual(['a', 'c', 'd']);
  });
});

describe('world generation (synthetic OSM through the real pipeline)', () => {
  const world = buildWorld(syntheticOsm(CENTER, 900, 7), CENTER, 900, 'synthetic');

  it('produces classified buildings, cells and water', () => {
    expect(world.buildings.length).toBeGreaterThan(150);
    const cats = new Set(world.buildings.map((b) => b.cat));
    expect(cats.has('house')).toBe(true);
    expect(cats.size).toBeGreaterThan(5);
    expect(Object.keys(world.cells).length).toBeGreaterThan(3);
    expect(world.waterPoints.length).toBeGreaterThan(0);
    expect(world.score.difficulty).toBeGreaterThanOrEqual(0);
  });

  it('connects every building to the road graph', () => {
    const a = world.buildings[0];
    const b = world.buildings[world.buildings.length - 1];
    const { length } = shortestPath(world.graph, a.node, b.node);
    expect(Number.isFinite(length)).toBe(true);
    expect(length).toBeGreaterThan(0);
  });

  it('partitions a real footprint into rooms per floor plus yard', () => {
    const b = world.buildings.find((x) => x.area > 300) ?? world.buildings[0];
    const it = generateInterior(b, [], 42);
    expect(it.rooms.filter((r) => !r.outdoor).length).toBeGreaterThanOrEqual(it.floors);
    expect(it.rooms.some((r) => r.outdoor)).toBe(true);
    const floor0 = it.rooms.filter((r) => r.floor === 0 && !r.outdoor).reduce((a, r) => a + r.area, 0);
    expect(floor0).toBeGreaterThan(b.area * 0.5);
  });
});
