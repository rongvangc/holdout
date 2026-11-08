import { dist } from './geo';
import type { RoadGraph, Vec } from './types';

/** Keep only the largest connected component so every building can reach every other. */
export function buildGraph(nodes: Vec[], edges: [number, number][]): RoadGraph {
  const adj: number[][] = nodes.map(() => []);
  for (const [a, b] of edges) {
    if (a === b) continue;
    adj[a].push(b);
    adj[b].push(a);
  }
  const comp = new Int32Array(nodes.length).fill(-1);
  let best = -1;
  let bestSize = 0;
  let c = 0;
  for (let s = 0; s < nodes.length; s++) {
    if (comp[s] >= 0) continue;
    let size = 0;
    const stack = [s];
    comp[s] = c;
    while (stack.length) {
      const u = stack.pop()!;
      size++;
      for (const v of adj[u]) {
        if (comp[v] < 0) {
          comp[v] = c;
          stack.push(v);
        }
      }
    }
    if (size > bestSize) {
      bestSize = size;
      best = c;
    }
    c++;
  }
  const remap = new Int32Array(nodes.length).fill(-1);
  const outNodes: Vec[] = [];
  nodes.forEach((p, i) => {
    if (comp[i] === best) {
      remap[i] = outNodes.length;
      outNodes.push([Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]);
    }
  });
  const outAdj: number[][] = outNodes.map(() => []);
  const outW: number[][] = outNodes.map(() => []);
  nodes.forEach((_, i) => {
    const a = remap[i];
    if (a < 0) return;
    for (const j of new Set(adj[i])) {
      const b = remap[j];
      if (b < 0) continue;
      outAdj[a].push(b);
      outW[a].push(Math.round(dist(nodes[i], nodes[j]) * 10) / 10);
    }
  });
  return { nodes: outNodes, adj: outAdj, w: outW };
}

/** A* shortest path length in metres; returns node list too. */
export function shortestPath(g: RoadGraph, from: number, to: number): { length: number; path: number[] } {
  if (from === to) return { length: 0, path: [from] };
  const n = g.nodes.length;
  const gScore = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const target = g.nodes[to];
  // Small binary heap of [f, node].
  const heap: [number, number][] = [];
  const pushH = (f: number, v: number) => {
    heap.push([f, v]);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const popH = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  gScore[from] = 0;
  pushH(dist(g.nodes[from], target), from);
  while (heap.length) {
    const [, u] = popH();
    if (closed[u]) continue;
    if (u === to) break;
    closed[u] = 1;
    const nbrs = g.adj[u];
    const ws = g.w[u];
    for (let k = 0; k < nbrs.length; k++) {
      const v = nbrs[k];
      const ng = gScore[u] + ws[k];
      if (ng < gScore[v]) {
        gScore[v] = ng;
        prev[v] = u;
        pushH(ng + dist(g.nodes[v], target), v);
      }
    }
  }
  if (!isFinite(gScore[to])) return { length: Infinity, path: [] };
  const path: number[] = [];
  for (let v = to; v !== -1; v = prev[v]) path.push(v);
  return { length: gScore[to], path: path.reverse() };
}
