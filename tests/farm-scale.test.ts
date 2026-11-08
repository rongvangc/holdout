import { describe, expect, it } from 'vitest';
import { CROPS, FARM_M2_PER_WORKER, TEND_H_PER_M2_DAY } from '../src/sim/data';
import { DESIGN_LIMITS } from '../src/data/structures';
import { newGame, mainSite, autoAssign } from '../src/sim/state';
import { autoGarden } from '../src/sim/automation';
import { makeTestWorld } from '../scripts/headless';
import { queueModule } from '../src/sim/build';
import type { Room } from '../src/base/interior';

const WORKDAY_H = 10; // một ngày công thực tế

function setup() {
  const world = makeTestWorld();
  const b = world.buildings.find((x) => x.area > 250 && x.area < 900)!;
  const s = newGame(world, b.id, 42, new Date(2026, 5, 1));
  return { s, site: mainSite(s) };
}

const addGarden = (site: ReturnType<typeof mainSite>, area: number): Room => {
  const room: Room = { id: `g${site.interior.rooms.length}`, floor: 0, outdoor: true, cells: [site.interior.rooms.length], area, module: 'garden', walled: true, moduleLevel: 1 };
  site.interior.rooms.push(room);
  site.plots[room.id] = { roomId: room.id, crop: null, growth: 0, tendedToday: 0, plantedDay: 0 };
  return room;
};

describe('quy mô canh tác khớp nhau ở mọi nơi', () => {
  it('một người làm nông vừa một ngày công, không hơn', () => {
    const hours = FARM_M2_PER_WORKER * TEND_H_PER_M2_DAY;
    expect(hours).toBeGreaterThan(WORKDAY_H * 0.6);
    expect(hours).toBeLessThanOrEqual(WORKDAY_H);
  });

  it('số nông dân được chia = diện tích / 1.200 m²', () => {
    const { s, site } = setup();
    addGarden(site, 1200);
    autoAssign(s);
    const farmers = s.survivors.filter((v) => v.status === 'alive' && v.role === 'farmer').length;
    expect(farmers).toBeGreaterThanOrEqual(1);
    expect(farmers).toBeLessThanOrEqual(2);

    addGarden(site, 1200); // tổng 2.400 m²
    autoAssign(s);
    const farmers2 = s.survivors.filter((v) => v.status === 'alive' && v.role === 'farmer').length;
    expect(farmers2).toBeGreaterThan(farmers);
  });

  it('tự mở vườn cũng dùng đúng hằng số đó', () => {
    const { s, site } = setup();
    addGarden(site, 1200);
    for (const v of s.survivors) v.role = 'idle';
    site.stock.food = 2250 * 5;
    expect(autoGarden(s, site)).toBeNull(); // 1.200 m² đã đủ sức 0 nông dân… và không có nông dân
    s.survivors[0].role = 'farmer';
    // 1 nông dân ↔ 1.200 m²: đã đủ, không mở thêm
    expect(autoGarden(s, site)).toBeNull();
    s.survivors[1].role = 'farmer'; // 2 nông dân ↔ 2.400 m²
    expect(autoGarden(s, site)).not.toBeNull();
  });

  it('khoảnh ruộng nằm trong giới hạn làm tay', () => {
    expect(DESIGN_LIMITS.maxRoomField).toBeLessThanOrEqual(2000);
    expect(DESIGN_LIMITS.maxRoomField).toBeGreaterThan(DESIGN_LIMITS.maxRoomOutdoor);
  });

  it('một nông dân nuôi được vài người, không phải cả làng', () => {
    const kcalPerDay = FARM_M2_PER_WORKER * (CROPS.khoai.kcalPerM2 / CROPS.khoai.days);
    const people = kcalPerDay / 2250;
    expect(people).toBeGreaterThan(3);
    expect(people).toBeLessThan(10);
  });
});

describe('người chơi không bị bẫy khoảnh quá lớn', () => {
  it('không đặt được vườn trên khoảnh lớn hơn hạn mức làm tay', () => {
    const { s, site } = setup();
    const world = makeTestWorld();
    void world;
    const big: Room = { id: 'big', floor: 0, outdoor: true, cells: [1], area: 2000, walled: true };
    site.interior.rooms.push(big);
    const err = queueModule(s, site, 'big', 'garden');
    expect(err).toContain('tối đa 300 m²');
    const ok: Room = { id: 'ok', floor: 0, outdoor: true, cells: [2], area: 300, walled: true };
    site.interior.rooms.push(ok);
    expect(queueModule(s, site, 'ok', 'garden')).toBeNull();
  });
});
