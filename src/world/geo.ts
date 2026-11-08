import type { LonLat, Vec } from './types';

const M_PER_DEG_LAT = 110540;
const M_PER_DEG_LON = 111320;

export function project(center: LonLat, p: LonLat): Vec {
  const k = Math.cos((center[1] * Math.PI) / 180);
  return [(p[0] - center[0]) * M_PER_DEG_LON * k, (p[1] - center[1]) * M_PER_DEG_LAT];
}

export function unproject(center: LonLat, v: Vec): LonLat {
  const k = Math.cos((center[1] * Math.PI) / 180);
  return [center[0] + v[0] / (M_PER_DEG_LON * k), center[1] + v[1] / M_PER_DEG_LAT];
}

export function polygonArea(poly: Vec[]): number {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    a += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]);
  }
  return Math.abs(a / 2);
}

export function centroid(poly: Vec[]): Vec {
  let x = 0;
  let y = 0;
  for (const p of poly) {
    x += p[0];
    y += p[1];
  }
  return [x / poly.length, y / poly.length];
}

export function pointInPolygon(p: Vec, poly: Vec[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export const dist = (a: Vec, b: Vec) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function bbox(poly: Vec[]): [number, number, number, number] {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of poly) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return [x0, y0, x1, y1];
}

/** Uniform-grid spatial hash for nearest-point queries. */
export class SpatialHash {
  private cells = new Map<string, number[]>();
  constructor(
    private pts: Vec[],
    private size = 60,
  ) {
    pts.forEach((p, i) => {
      const k = this.key(p[0], p[1]);
      const arr = this.cells.get(k);
      if (arr) arr.push(i);
      else this.cells.set(k, [i]);
    });
  }
  private key(x: number, y: number) {
    return `${Math.floor(x / this.size)},${Math.floor(y / this.size)}`;
  }
  nearest(p: Vec, maxRings = 40): number {
    const cx = Math.floor(p[0] / this.size);
    const cy = Math.floor(p[1] / this.size);
    let best = -1;
    let bestD = Infinity;
    for (let r = 0; r <= maxRings; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          for (const i of this.cells.get(`${cx + dx},${cy + dy}`) ?? []) {
            const d = dist(p, this.pts[i]);
            if (d < bestD) {
              bestD = d;
              best = i;
            }
          }
        }
      }
      // Anything in ring r+1 is at least r*size away.
      if (best >= 0 && bestD <= r * this.size) break;
    }
    return best;
  }
}
