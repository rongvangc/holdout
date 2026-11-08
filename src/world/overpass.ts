export interface OsmNode {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

export interface OsmWay {
  type: 'way';
  id: number;
  nodes: number[];
  geometry: { lat: number; lon: number }[];
  tags?: Record<string, string>;
}

export type OsmElement = OsmNode | OsmWay;

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

/**
 * Snap the requested point to a ~500 m grid before it leaves the device,
 * so the exact spot a player picks (often their home) is never sent out.
 */
export function snapForPrivacy(lat: number, lon: number): [number, number] {
  const q = 0.005;
  return [Math.round(lat / q) * q, Math.round(lon / q) * q];
}

export function buildQuery(lat: number, lon: number, radius: number): string {
  const a = `(around:${Math.round(radius)},${lat.toFixed(5)},${lon.toFixed(5)})`;
  return `[out:json][timeout:90];
(
  way["building"]${a};
  way["highway"]["highway"!~"^(proposed|construction|platform|bus_stop|elevator)$"]${a};
  node["amenity"]${a};
  node["shop"]${a};
  way["landuse"]${a};
  way["leisure"~"^(park|garden|pitch)$"]${a};
  way["natural"="water"]${a};
  way["waterway"~"^(river|canal|stream)$"]${a};
);
out geom;`;
}

export async function fetchOsm(
  lat: number,
  lon: number,
  radius: number,
  signal?: AbortSignal,
): Promise<OsmElement[]> {
  const body = 'data=' + encodeURIComponent(buildQuery(lat, lon, radius));
  let lastErr: unknown;
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal,
      });
      if (!res.ok) throw new Error(`Overpass ${res.status}`);
      const json = (await res.json()) as { elements?: OsmElement[] };
      if (!Array.isArray(json.elements)) throw new Error('Overpass: phản hồi không hợp lệ');
      return json.elements;
    } catch (e) {
      if (signal?.aborted) throw e;
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Không tải được dữ liệu OSM');
}
