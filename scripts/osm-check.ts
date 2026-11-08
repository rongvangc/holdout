// Usage: npx vite-node scripts/osm-check.ts -- <lat> <lon> <radius>
// Fetches real OSM data and prints what the world generator makes of it (M0 data-quality check).
import { CATS } from '../src/data/categories';
import { buildWorld } from '../src/world/generate';
import { fetchOsm, snapForPrivacy } from '../src/world/overpass';

const [lat0, lon0, r] = process.argv.slice(2).filter((a: string) => /^-?[\d.]+$/.test(a)).map(Number);
const [lat, lon] = snapForPrivacy(lat0 ?? 21.028, lon0 ?? 105.852);
const radius = r || 800;
const t0 = Date.now();
const els = await fetchOsm(lat, lon, radius);
const t1 = Date.now();
const w = buildWorld(els, [lon, lat], radius, 'osm');
const t2 = Date.now();
const cats: Record<string, number> = {};
for (const b of w.buildings) cats[CATS[b.cat].label] = (cats[CATS[b.cat].label] ?? 0) + 1;
console.log(`(${lat}, ${lon}) r=${radius}m  fetch ${t1 - t0}ms  build ${t2 - t1}ms  elements=${els.length}`);
console.log(`buildings=${w.buildings.length} roadNodes=${w.graph.nodes.length} cells=${Object.keys(w.cells).length} water=${w.waterPoints.length} green=${w.greenArea}m²`);
console.log('score', JSON.stringify({ ...w.score, notes: undefined }));
console.log(w.score.notes.join('\n'));
console.log(Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join('  '));
console.log(`JSON size ${(JSON.stringify(w).length / 1e6).toFixed(2)} MB`);
