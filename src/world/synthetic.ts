import { chance, hashString, int, makeRng, range, weighted, type Rng } from '../core/rng';
import { unproject } from './geo';
import type { OsmElement, OsmWay } from './overpass';
import type { LonLat, Vec } from './types';

/**
 * Fake OSM payload for a grid town. Used offline, in tests and when Overpass is down;
 * it goes through the exact same buildWorld pipeline as real data.
 */
export function syntheticOsm(center: LonLat, radius: number, seed = 1): OsmElement[] {
  const els: OsmElement[] = [];
  let id = 1;
  const ll = (v: Vec) => {
    const [lon, lat] = unproject(center, v);
    return { lat, lon };
  };
  // Way ids are derived from position, not emission order, so growing the radius keeps them.
  const way = (pts: Vec[], tags: Record<string, string>, closed: boolean, wid: number): OsmWay => {
    const ids = pts.map(() => id++);
    const geom = pts.map(ll);
    if (closed) {
      ids.push(ids[0]);
      geom.push(geom[0]);
    }
    return { type: 'way', id: wid, nodes: ids, geometry: geom, tags };
  };

  const step = 110;
  const n = Math.floor(radius / step);
  // Street grid with shared node ids at intersections.
  const nodeId = (i: number, j: number) => 1_000_000 + (i + n) * 1000 + (j + n);
  for (let i = -n; i <= n; i++) {
    for (const horizontal of [true, false]) {
      const ids: number[] = [];
      const geom: { lat: number; lon: number }[] = [];
      for (let j = -n; j <= n; j++) {
        const p: Vec = horizontal ? [j * step, i * step] : [i * step, j * step];
        ids.push(horizontal ? nodeId(j, i) : nodeId(i, j));
        geom.push(ll(p));
      }
      els.push({ type: 'way', id: 800_000_000 + (horizontal ? 0 : 10_000) + i, nodes: ids, geometry: geom, tags: { highway: i % 4 === 0 ? 'secondary' : 'residential' } });
    }
  }

  // River along the south edge.
  const ry = -n * step + 40;
  els.push(way([[-radius, ry], [0, ry - 30], [radius, ry]], { waterway: 'river', name: 'Sông Mô Phỏng' }, false, 900_000_000));
  // Park in one block.
  els.push(way([[step * 2 + 10, step + 10], [step * 3 - 10, step + 10], [step * 3 - 10, step * 2 - 10], [step * 2 + 10, step * 2 - 10]], { leisure: 'park' }, true, 900_000_001));
  // Vacant lot used as an urban vegetable field.
  els.push(way([[-step * 2 + 10, step + 10], [-step + 10, step + 10], [-step + 10, step * 2 - 10], [-step * 2 + 10, step * 2 - 10]], { landuse: 'farmland', name: 'Ruộng rau' }, true, 900_000_002));

  const special: [Record<string, string>, number][] = [
    [{ building: 'yes', shop: 'convenience' }, 8],
    [{ building: 'yes', amenity: 'pharmacy' }, 3],
    [{ building: 'yes', shop: 'supermarket' }, 1.5],
    [{ building: 'yes', amenity: 'marketplace' }, 1],
    [{ building: 'yes', amenity: 'restaurant' }, 6],
    [{ building: 'yes', shop: 'hardware' }, 2],
    [{ building: 'yes', amenity: 'fuel' }, 1],
    [{ building: 'yes', shop: 'car_repair' }, 1.5],
    [{ building: 'school' }, 1],
    [{ building: 'yes', amenity: 'clinic' }, 1],
    [{ building: 'yes', amenity: 'police' }, 0.6],
    [{ building: 'hospital' }, 0.3],
    [{ building: 'warehouse' }, 2],
    [{ building: 'apartments' }, 3],
    [{ building: 'temple' }, 0.8],
  ];

  for (let bx = -n; bx < n; bx++) {
    for (let by = -n; by < n; by++) {
      const x0 = bx * step;
      const y0 = by * step;
      if (Math.hypot(x0 + step / 2, y0 + step / 2) > radius) continue;
      if ((bx === 2 || bx === -2) && by === 1) continue; // park / field
      const rng = makeRng((seed ^ hashString(`${bx},${by}`)) >>> 0);
      const blockId = 100_000_000 + ((bx + 500) * 1000 + (by + 500)) * 20;
      placeBlock(rng, x0, y0, step, (pts, tags, slot) => els.push(way(pts, tags, true, blockId + slot)), special);
    }
  }
  return els;
}

function placeBlock(
  rng: Rng,
  x0: number,
  y0: number,
  step: number,
  emit: (pts: Vec[], tags: Record<string, string>, slot: number) => void,
  special: [Record<string, string>, number][],
) {
  const pad = 12;
  const lot = int(rng, 4, 7);
  const w = (step - 2 * pad) / lot;
  for (const side of [0, 1]) {
    for (let k = 0; k < lot; k++) {
      if (chance(rng, 0.12)) continue;
      const depth = range(rng, 18, 38);
      const bx0 = x0 + pad + k * w + 1;
      const bx1 = bx0 + w - 2;
      const by0 = side === 0 ? y0 + pad : y0 + step - pad - depth;
      const by1 = by0 + depth;
      const tags: Record<string, string> = chance(rng, 0.18)
        ? { ...weighted(rng, special) }
        : { building: chance(rng, 0.5) ? 'house' : 'yes' };
      if (tags.building !== 'yes' || tags.shop || tags.amenity) tags['building:levels'] = String(int(rng, 1, 5));
      emit(
        [
          [bx0, by0],
          [bx1, by0],
          [bx1, by1],
          [bx0, by1],
        ],
        tags,
        side * 10 + k,
      );
    }
  }
}
