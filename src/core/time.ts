export const MIN = 60;
export const HOUR = 3600;
export const DAY = 86400;
export const DAWN = 6 * HOUR;
export const DUSK = 18.5 * HOUR;

export const dayOf = (t: number) => Math.floor(t / DAY) + 1;
export const timeOfDay = (t: number) => ((t % DAY) + DAY) % DAY;
export const isNight = (t: number) => {
  const s = timeOfDay(t);
  return s < DAWN || s >= DUSK;
};
export const startOfDay = (t: number) => Math.floor(t / DAY) * DAY;

/** Next absolute time at which the clock reads `secOfDay`, strictly after t. */
export function nextClock(t: number, secOfDay: number): number {
  const base = startOfDay(t) + secOfDay;
  return base > t ? base : base + DAY;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function fmtClock(t: number): string {
  const s = timeOfDay(t);
  return `${pad(Math.floor(s / HOUR))}:${pad(Math.floor((s % HOUR) / MIN))}`;
}

export function fmtDuration(sec: number): string {
  if (!isFinite(sec)) return '∞';
  if (sec < MIN) return `${Math.round(sec)}s`;
  if (sec < HOUR) return `${Math.round(sec / MIN)}p`;
  const h = Math.floor(sec / HOUR);
  const m = Math.round((sec % HOUR) / MIN);
  return m ? `${h}h${pad(m)}` : `${h}h`;
}

/** Day-of-year (1..365) for a game day given the real-world start day-of-year. */
export const dayOfYear = (startDoy: number, day: number) => ((startDoy - 1 + day - 1) % 365) + 1;
export const monthOf = (doy: number) => Math.min(12, Math.floor((doy - 1) / 30.42) + 1);
