import { describe, expect, it } from 'vitest';
import { dayOf } from '../src/core/time';
import { runBot } from '../scripts/headless';

describe('headless simulation', () => {
  it('runs 60 days deterministically without crashing', () => {
    const a = runBot(60, 5);
    const b = runBot(60, 5);
    expect(dayOf(a.t)).toBeGreaterThanOrEqual(a.gameOver ? 1 : 60);
    expect(JSON.stringify(a.stats)).toBe(JSON.stringify(b.stats));
    expect(a.stats.expeditions).toBeGreaterThan(0);
    expect(a.sites[0].interior.rooms.some((r) => r.module)).toBe(true);
    // State must survive a JSON round-trip (saves).
    expect(() => JSON.parse(JSON.stringify(a))).not.toThrow();
  });
});
