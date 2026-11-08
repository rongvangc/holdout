import { useSyncExternalStore } from 'react';

/**
 * Help text that works without a mouse.
 *
 * 70 tooltips in this UI lived in `title=` attributes, which never appear on a
 * touch screen — so on mobile every explanation was simply missing. This store
 * backs a single global "Giải thích" switch: when it is on, the same text renders
 * as a visible line under the thing it explains, and `title` keeps working for
 * desktop hover.
 */
const KEY = 'holdout:hints';

const read = (): boolean => {
  try {
    return globalThis.localStorage?.getItem(KEY) === '1';
  } catch {
    return false;
  }
};

let on = read();
const listeners = new Set<() => void>();

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const snapshot = () => on;

export function toggleHints(): void {
  on = !on;
  try {
    globalThis.localStorage?.setItem(KEY, on ? '1' : '0');
  } catch {
    /* private mode: keep the in-memory value */
  }
  for (const fn of listeners) fn();
}

export const hintsEnabled = () => on;

/** Re-renders the caller whenever the switch changes. */
export function useHints(): boolean {
  // Server snapshot returns the same value instead of a hard false: the store is a
  // module singleton, so a server render (and the server-side tests) see the real state.
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/**
 * Renders the explanation inline when the switch is on.
 * `className` lets each caller style it for its context (row, chip, panel).
 */
export function Hint({ text, className = 'hint-line' }: { text?: string | null; className?: string }) {
  const show = useHints();
  if (!show || !text) return null;
  return <span className={className}>{text}</span>;
}
