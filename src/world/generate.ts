import { latLngToCell } from 'h3-js';
import { CATS } from '../data/categories';
import type { ItemId } from '../data/items';
import { catFromTags, defaultLevels, inferCat, landuseKind, residents, type LanduseKind } from './classify';
import { bbox, centroid, dist, pointInPolygon, polygonArea, project, SpatialHash, unproject } from './geo';
import { buildGraph } from './graph';
import type { OsmElement, OsmNode, OsmWay } from './overpass';
import type { Building, BuildingCat, Green, LonLat, Vec, WaterPoint, World, WorldScore, ZoneCell } from './types';

export const H3_RES = 9;

interface Landuse {
  id: number;
  name?: string;
  kind: LanduseKind;
  poly: Vec[];
  box: [number, number, number, number];
}

const isClosed = (w: OsmWay) => w.nodes.length >= 4 && w.nodes[0] === w.nodes[w.nodes.length - 1];

/** Expected units of each item per container for a category. */
export function expectedPerContainer(cat: BuildingCat): Partial<Record<ItemId, number>> {
  const loot = CATS[cat].loot;
  const total = loot.reduce((s, e) => s + e[1], 0);
  const out: Partial<Record<ItemId, number>> = {};
  for (const [item, w, lo, hi] of loot) out[item] = (out[item] ?? 0) + (w / total) * ((lo + hi) / 2) * 1.5;
  return out;
}

export function buildWorld(
  elements: OsmElement[],
  center: LonLat,
  radius: number,
  source: World['source'],
  onProgress?: (msg: string) => void,
): World {
  const ways = elements.filter((e): e is OsmWay => e.type === 'way' && Array.isArray(e.geometry));
  const pois = elements.filter((e): e is OsmNode => e.type === 'node' && !!e.tags);
  const proj = (g: { lat: number; lon: number }) => project(center, [g.lon, g.lat]);

  onProgress?.('Phân loại khu đất…');
  const landuses: Landuse[] = [];
  let greenArea = 0;
  const waterLines: Vec[][] = [];
  for (const w of ways) {
    const t = w.tags ?? {};
    if (t.natural === 'water' || t.waterway) {
      waterLines.push(w.geometry.map(proj));
      continue;
    }
    if ((t.landuse || t.leisure) && !t.building && isClosed(w)) {
      const poly = w.geometry.map(proj);
      const kind = landuseKind(t);
      if (kind === 'green') greenArea += polygonArea(poly);
      landuses.push({ id: w.id, name: t.name, kind, poly: poly.slice(0, -1), box: bbox(poly) });
    }
  }
  const landuseAt = (p: Vec): LanduseKind => {
    for (const l of landuses) {
      if (l.kind === 'green' || l.kind === 'other') continue;
      if (p[0] < l.box[0] || p[0] > l.box[2] || p[1] < l.box[1] || p[1] > l.box[3]) continue;
      if (pointInPolygon(p, l.poly)) return l.kind;
    }
    return 'other';
  };

  onProgress?.('Dựng mạng lưới đường…');
  const idx = new Map<number, number>();
  const rawNodes: Vec[] = [];
  const edges: [number, number][] = [];
  for (const w of ways) {
    if (!w.tags?.highway) continue;
    let prev = -1;
    w.nodes.forEach((id, i) => {
      let k = idx.get(id);
      if (k === undefined) {
        k = rawNodes.length;
        idx.set(id, k);
        rawNodes.push(proj(w.geometry[i]));
      }
      if (prev >= 0) edges.push([prev, k]);
      prev = k;
    });
  }
  const graph = buildGraph(rawNodes, edges);
  if (graph.nodes.length < 2) throw new Error('Khu vực không có đường đi trong dữ liệu OSM.');
  const nodeHash = new SpatialHash(graph.nodes);

  onProgress?.('Phân loại toà nhà…');
  type Draft = Building & { tagged: boolean };
  const drafts: Draft[] = [];
  for (const w of ways) {
    const t = w.tags ?? {};
    if (!t.building || !isClosed(w)) continue;
    const poly = w.geometry.slice(0, -1).map(proj);
    const area = polygonArea(poly);
    if (area < 20) continue;
    const c = centroid(poly);
    if (Math.hypot(c[0], c[1]) > radius * 1.05) continue;
    const tagCat = catFromTags(t);
    const lvlTag = parseInt(t['building:levels'] ?? '', 10);
    const lvlGuess = Number.isFinite(lvlTag) && lvlTag > 0 ? lvlTag : undefined;
    const cat = tagCat ?? inferCat(area, lvlGuess ?? 2, landuseAt(c));
    drafts.push({
      id: `w${w.id}`,
      cat,
      name: t.name,
      poly: poly.map((p) => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10] as Vec),
      centroid: c,
      area: Math.round(area),
      levels: Math.min(40, lvlGuess ?? defaultLevels(cat, area)),
      containers: 0,
      node: 0,
      cell: '',
      tagged: !!tagCat && t.building !== 'yes',
    });
  }

  // Attach amenity/shop nodes to the building that contains them, or the nearest within 30 m.
  const bHash = new SpatialHash(drafts.map((d) => d.centroid), 40);
  for (const p of pois) {
    const cat = catFromTags(p.tags!);
    if (!cat) continue;
    const pos = proj(p);
    const near = bHash.nearest(pos, 3);
    if (near < 0) continue;
    const d = drafts[near];
    if (!pointInPolygon(pos, d.poly) && dist(pos, d.centroid) > 30) continue;
    // A tagged hospital/school polygon outranks a pharmacy kiosk inside it.
    if (d.tagged && d.cat !== 'house' && d.cat !== 'generic' && d.cat !== 'apartment') continue;
    d.cat = cat;
    d.name = d.name ?? p.tags!.name;
    d.tagged = true;
  }

  onProgress?.('Ước lượng dân số và mật độ zombie…');
  const cells: Record<string, ZoneCell> = {};
  const buildings: Building[] = drafts.map((d) => {
    const { tagged, ...b } = d;
    void tagged;
    const ll = unproject(center, b.centroid);
    const cell = latLngToCell(ll[1], ll[0], H3_RES);
    const z = (cells[cell] ??= { id: cell, pop: 0, danger: 1 });
    z.pop += residents(b.cat, b.area, b.levels);
    const floor = b.area * Math.min(b.levels, 10);
    return {
      ...b,
      centroid: [Math.round(b.centroid[0]), Math.round(b.centroid[1])] as Vec,
      cell,
      node: nodeHash.nearest(b.centroid),
      containers: Math.max(2, Math.min(200, Math.round((floor / 100) * CATS[b.cat].per100))),
    };
  });
  for (const z of Object.values(cells)) {
    z.pop = Math.round(z.pop);
    z.danger = Math.round(Math.min(6, 1 + Math.log2(1 + z.pop / 150)) * 10) / 10;
  }

  onProgress?.('Tìm nguồn nước…');
  const waterPoints: WaterPoint[] = [];
  for (const line of waterLines) {
    for (const p of line) {
      if (Math.hypot(p[0], p[1]) > radius) continue;
      if (waterPoints.some((w) => dist(w.pos, p) < 250)) continue;
      waterPoints.push({ id: `wp${waterPoints.length}`, pos: [Math.round(p[0]), Math.round(p[1])], node: nodeHash.nearest(p) });
      if (waterPoints.length >= 24) break;
    }
  }

  const greens: Green[] = [];
  for (const l of landuses) {
    if (l.kind !== 'green') continue;
    const area = polygonArea(l.poly);
    const c = centroid(l.poly);
    if (area < 150 || Math.hypot(c[0], c[1]) > radius) continue;
    const ll = unproject(center, c);
    greens.push({
      id: `g${l.id}`,
      name: l.name,
      poly: l.poly.map((p) => [Math.round(p[0]), Math.round(p[1])] as Vec),
      area: Math.round(area),
      centroid: [Math.round(c[0]), Math.round(c[1])],
      node: nodeHash.nearest(c),
      cell: latLngToCell(ll[1], ll[0], H3_RES),
    });
    if (greens.length >= 300) break;
  }

  const world: World = {
    key: '',
    source,
    center,
    radius,
    buildings,
    waterPoints,
    greens,
    graph,
    cells,
    greenArea: Math.round(greenArea),
    score: scoreWorld(buildings, waterPoints, cells, greenArea),
  };
  return world;
}

export function scoreWorld(
  buildings: Building[],
  waterPoints: WaterPoint[],
  cells: Record<string, ZoneCell>,
  greenArea: number,
): WorldScore {
  const tot: Partial<Record<ItemId, number>> = {};
  for (const b of buildings) {
    for (const [k, v] of Object.entries(expectedPerContainer(b.cat))) {
      tot[k as ItemId] = (tot[k as ItemId] ?? 0) + v * b.containers;
    }
  }
  const people = 20;
  const food = Math.min(1, ((tot.food ?? 0) + (tot.rawFood ?? 0)) / (people * 2250 * 365));
  const water = Math.min(1, (tot.water ?? 0) / (people * 15 * 180)) * 0.5 + (waterPoints.length ? 0.5 : 0);
  const medical = Math.min(1, (tot.medicine ?? 0) / 1500);
  const materials = Math.min(1, ((tot.wood ?? 0) + (tot.scrap ?? 0)) / 20000);
  const zs = Object.values(cells);
  const danger = zs.length ? zs.reduce((s, z) => s + z.danger, 0) / zs.length : 1;

  const difficulty = Math.round(
    Math.max(0, Math.min(100, (danger - 1) * 14 + (1 - food) * 15 + (1 - water) * 18 + (1 - medical) * 10 + (1 - materials) * 8)),
  );
  const label = difficulty < 30 ? 'Dễ' : difficulty < 45 ? 'Vừa' : difficulty < 60 ? 'Khó' : 'Rất khó';
  const notes: string[] = [];
  if (!waterPoints.length) notes.push('Không có sông/hồ gần — nước chỉ trông vào mưa và giếng.');
  else notes.push(`${waterPoints.length} điểm lấy nước sông/hồ (nước bẩn, cần lọc).`);
  if (danger >= 4.5) notes.push('Mật độ dân cũ rất cao — zombie dày đặc.');
  else if (danger <= 2.5) notes.push('Dân cư thưa — ít zombie.');
  if (food < 0.35) notes.push('Ít nguồn lương thực để lục.');
  if (medical < 0.3) notes.push('Rất ít thuốc men.');
  if (materials < 0.3) notes.push('Thiếu vật liệu xây dựng.');
  if (greenArea > 20000) notes.push(`Có ${Math.round(greenArea / 10000)} ha đất xanh — tiềm năng trồng trọt.`);
  if (buildings.length < 150) notes.push('Dữ liệu OSM khu này thưa — trải nghiệm có thể nghèo nàn.');
  return { difficulty, label, food, water, medical, materials, danger: Math.round(danger * 10) / 10, notes };
}
