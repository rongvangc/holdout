// Binary min-heap keyed by (t, seq). Plain arrays so it serializes into saves as-is.
export interface Queued<E> {
  t: number;
  seq: number;
  ev: E;
}

export interface EventQueue<E> {
  heap: Queued<E>[];
  seq: number;
}

export const makeQueue = <E>(): EventQueue<E> => ({ heap: [], seq: 0 });

const less = <E>(a: Queued<E>, b: Queued<E>) => a.t < b.t || (a.t === b.t && a.seq < b.seq);

export function push<E>(q: EventQueue<E>, t: number, ev: E): void {
  const h = q.heap;
  h.push({ t, seq: q.seq++, ev });
  let i = h.length - 1;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (!less(h[i], h[p])) break;
    [h[i], h[p]] = [h[p], h[i]];
    i = p;
  }
}

export const peek = <E>(q: EventQueue<E>): Queued<E> | undefined => q.heap[0];

export function pop<E>(q: EventQueue<E>): Queued<E> | undefined {
  const h = q.heap;
  if (!h.length) return undefined;
  const top = h[0];
  const last = h.pop()!;
  if (h.length) {
    h[0] = last;
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let m = i;
      if (l < h.length && less(h[l], h[m])) m = l;
      if (r < h.length && less(h[r], h[m])) m = r;
      if (m === i) break;
      [h[i], h[m]] = [h[m], h[i]];
      i = m;
    }
  }
  return top;
}

/** Drop events matching pred (e.g. a dead survivor's pending task). O(n log n), rare. */
export function removeWhere<E>(q: EventQueue<E>, pred: (e: E) => boolean): void {
  const keep = q.heap.filter((x) => !pred(x.ev));
  q.heap = [];
  for (const x of keep.sort((a, b) => (less(a, b) ? -1 : 1))) q.heap.push(x);
}
