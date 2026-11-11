import { describe, expect, it } from 'vitest';
import { decide } from '../src/ui/alerts';
import { newGame } from '../src/sim/state';
import { makeTestWorld } from '../scripts/headless';

function setup() {
  const world = makeTestWorld();
  const b = world.buildings.filter((x) => x.area > 250 && x.area < 900)[0];
  const s = newGame(world, b.id, 7, new Date(2026, 5, 1));
  const site = s.sites[0];
  const room = site.interior.rooms[0];
  room.module = 'water_tank';
  room.moduleLevel = 1;
  room.area = 20;
  return { s, site };
}

describe('a stalled well explains itself', () => {
  it('says the tank is full and the pump stopped, when clean water is low', () => {
    const { s, site } = setup();
    site.stock.dirtyWater = 5000; // bể đầy
    site.stock.water = 0;
    const row = decide(s, site).find((d) => d.id === 'water');
    expect(row).toBeTruthy();
    expect(row!.level).toBe('bad');
    expect(row!.text).toContain('bể đầy nước bẩn');
    expect(row!.text).toContain('giếng ngừng bơm');
  });

  it('stays quiet while there is still drinking water', () => {
    const { s, site } = setup();
    site.stock.dirtyWater = 5000;
    site.stock.water = 500;
    const row = decide(s, site).find((d) => d.id === 'water');
    expect(row?.text ?? '').not.toContain('bể đầy');
  });
});
