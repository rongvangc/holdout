import type { FeatureCollection } from 'geojson';
import type { StyleSpecification } from 'maplibre-gl';
import { cellToBoundary } from 'h3-js';
import { CATS } from '../data/categories';
import { unproject } from '../world/geo';
import type { World } from '../world/types';

const BLANK: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#0e0e0e' } }],
};

let cached: Promise<string | StyleSpecification> | null = null;

/** OpenFreeMap (free, no key). Falls back to a blank dark style offline. */
export function baseStyle(): Promise<string | StyleSpecification> {
  cached ??= (async () => {
    for (const url of ['https://tiles.openfreemap.org/styles/dark', 'https://tiles.openfreemap.org/styles/positron']) {
      try {
        const r = await fetch(url, { method: 'GET' });
        if (r.ok) return url;
      } catch {
        /* try next */
      }
    }
    return BLANK;
  })();
  return cached;
}

export function buildingsGeoJSON(world: World): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: world.buildings.map((b, idx) => ({
      type: 'Feature',
      id: idx,
      properties: { idx, id: b.id, cat: b.cat, color: CATS[b.cat].color },
      geometry: {
        type: 'Polygon',
        coordinates: [[...b.poly, b.poly[0]].map((p) => unproject(world.center, p))],
      },
    })),
  };
}

export function greensGeoJSON(world: World, owned: Set<string>): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: (world.greens ?? []).map((g) => ({
      type: 'Feature',
      properties: { id: g.id, area: g.area, owned: owned.has(g.id) },
      geometry: {
        type: 'Polygon',
        coordinates: [[...g.poly, g.poly[0]].map((p) => unproject(world.center, p))],
      },
    })),
  };
}

export function waterGeoJSON(world: World): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: world.waterPoints.map((w) => ({
      type: 'Feature',
      properties: { id: w.id },
      geometry: { type: 'Point', coordinates: unproject(world.center, w.pos) },
    })),
  };
}

export function cellsGeoJSON(world: World, heat: Record<string, number>, clear: Record<string, number> = {}): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: Object.values(world.cells).map((c) => ({
      type: 'Feature',
      properties: { danger: c.danger * (1 - 0.6 * (clear[c.id] ?? 0)), heat: heat[c.id] ?? 0, clear: clear[c.id] ?? 0 },
      geometry: {
        type: 'Polygon',
        coordinates: [[...cellToBoundary(c.id, true), cellToBoundary(c.id, true)[0]]],
      },
    })),
  };
}
