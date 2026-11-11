import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HerdPanel } from '../src/ui/HerdPanel';
import { startingHerd } from '../src/sim/livestock';
import { newGame } from '../src/sim/state';
import { makeTestWorld } from '../scripts/headless';
import type { Room } from '../src/base/interior';

function setup() {
  const world = makeTestWorld();
  const b = world.buildings.filter((x) => x.area > 250 && x.area < 900)[0];
  const s = newGame(world, b.id, 7, new Date(2026, 5, 1));
  const site = s.sites[0];
  const room = site.interior.rooms[0] as Room;
  room.module = 'coop';
  room.moduleLevel = 1;
  room.area = 60;
  room.herd = 'ga';
  room.herdState = startingHerd('ga', 20);
  room.herdCare = 0.8;
  room.herdFed = 1;
  room.herdWater = 1;
  return { s, world, site, room };
}

const html = (p: ReturnType<typeof setup>) =>
  renderToStaticMarkup(<HerdPanel s={p.s} world={p.world} site={p.site} room={p.room} />);

describe('herd panel', () => {
  it('shows the species, the flock and its capacity', () => {
    const p = setup();
    const out = html(p);
    expect(out).toContain('Gà');
    expect(out).toContain('lớn');
    expect(out).toMatch(/\d+\/\d+ chỗ/);
  });

  it('turns the hidden mechanics into numbers', () => {
    const out = html(setup());
    expect(out).toContain('Thức ăn');
    expect(out).toContain('kg/ngày');
    expect(out).toContain('Nước');
    expect(out).toContain('Quả'.length ? 'quả/ngày' : '');
    expect(out).toContain('Thịt một con');
    expect(out).toContain('Cám trong kho');
  });

  it('warns when the herd is starving, and says what feeds it', () => {
    const p = setup();
    p.room.herdFed = 0.3;
    const out = html(p);
    expect(out).toContain('Đang đói');
    expect(out).toContain('chưa có ruộng cỏ');
  });

  it('says it is safe at night once the coop is closed (level 3)', () => {
    const p = setup();
    expect(html(p)).toContain('chưa có chuồng kín');
    p.room.moduleLevel = 3;
    expect(html(p)).not.toContain('chưa có chuồng kín');
  });

  it('warns about overcapacity instead of silently letting the flock grow', () => {
    const p = setup();
    // Gà cần 0,25 m²/con: 6 m² chỉ đủ 24 con.
    p.room.area = 6;
    p.room.herdState = startingHerd('ga', 4);
    p.room.herdState.adults = 30;
    p.room.herdState.young = 0;
    expect(html(p)).toContain('Quá chỗ');
  });
});

describe('slaughter button', () => {
  it('is disabled without a butcher and explains what it would yield with one', () => {
    const off = setup();
    expect(html(off)).toContain('Mổ 1 con');
    expect(html(off)).toContain('chưa có Lò mổ');

    const on = setup();
    const b = on.site.interior.rooms[1] as Room;
    b.module = 'butcher';
    b.moduleLevel = 2;
    const out = html(on);
    expect(out).toContain('kg thịt');
    expect(out).toContain('da');
  });
});
