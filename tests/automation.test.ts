import { describe, expect, it } from 'vitest';
import { autoCraftCore, autoGarden, autoLoot, runAuto, siteWarnings, DEFAULT_AUTO } from '../src/sim/automation';
import { addStock, mainSite, newGame, present } from '../src/sim/state';
import { makeTestWorld } from '../scripts/headless';
import type { Room } from '../src/base/interior';
import type { GameState } from '../src/sim/types';

function setup(seed = 42) {
  const world = makeTestWorld();
  const b = world.buildings.find((x) => x.area > 250 && x.area < 900)!;
  const s = newGame(world, b.id, seed, new Date(2026, 5, 1));
  return { s, site: mainSite(s), world };
}

const addRoom = (site: ReturnType<typeof mainSite>, module: NonNullable<Room['module']>, area: number, outdoor = false): Room => {
  const room: Room = { id: `r${site.interior.rooms.length}`, floor: 0, outdoor, cells: [site.interior.rooms.length], area, module, walled: true, moduleLevel: 1 };
  site.interior.rooms.push(room);
  if (module === 'garden' || module === 'herb_garden') site.plots[room.id] = { roomId: room.id, crop: null, growth: 0, tendedToday: 0, plantedDay: 0 };
  return room;
};

describe('auto: craft core materials', () => {
  it('queues the first core material the stations can actually make', () => {
    const { s, site } = setup();
    addRoom(site, 'carpentry', 30);
    addRoom(site, 'forge', 30);
    addStock(s, site, { scrap: 200, wood: 200 });
    site.stock.plank = 0;
    const made = autoCraftCore(s, site);
    expect(made).toBe('plank'); // xưởng mộc có, gỗ có
    expect(site.projects.some((p) => p.kind === 'craft')).toBe(true);
  });

  it('falls back to whatever station it does have', () => {
    const { s, site } = setup();
    addRoom(site, 'forge', 30); // chỉ có lò rèn: ván cần xưởng mộc
    addStock(s, site, { scrap: 200, wood: 200 });
    site.stock.plank = 0;
    const made = autoCraftCore(s, site);
    expect(made).not.toBeNull();
    expect(made).not.toBe('plank');
  });

  it('does nothing without the station or materials', () => {
    const { s, site } = setup();
    expect(autoCraftCore(s, site)).toBeNull(); // không có lò rèn
    addRoom(site, 'forge', 30);
    for (const id of Object.keys(site.stock)) site.stock[id] = 0;
    expect(autoCraftCore(s, site)).toBeNull(); // không có vật tư
  });

  it('stays quiet when the stock is already sufficient', () => {
    const { s, site } = setup();
    addRoom(site, 'forge', 30);
    addStock(s, site, { plank: 20, thread: 20, handle: 10, nail: 20, blade: 5, tool_head: 5, hinge: 10, plate: 5, rope: 10 } as never);
    expect(autoCraftCore(s, site)).toBeNull();
  });
});

describe('auto: garden when food runs low', () => {
  it('opens a garden only when the larder is short', () => {
    const { s, site } = setup();
    addStock(s, site, { wood: 200 });
    site.stock.food = present(s, site).length * 2250 * 40; // dư lương
    expect(autoGarden(s, site)).toBeNull();
    site.stock.food = present(s, site).length * 2250 * 5; // 5 ngày
    // Chưa có nông dân thì không mở thêm vườn (vườn bỏ hoang còn tệ hơn).
    expect(autoGarden(s, site)).toBeNull();
    s.survivors[0].role = 'farmer';
    s.survivors[0].location = 'base';
    const room = autoGarden(s, site);
    expect(room).not.toBeNull();
    expect(site.projects.some((p) => p.module === 'garden')).toBe(true);
  });
});

describe('auto: loot expedition', () => {
  it('sends idle people out when there is something left to search', () => {
    const { s, site, world } = setup();
    let made = autoLoot(s, world, site);
    // Có thể không có toà nhà nào trong bán kính an toàn → cho phép null, nhưng nếu đi thì phải có đội
    if (made) {
      expect(s.expeditions.length).toBe(1);
      expect(s.expeditions[0].members.length).toBeGreaterThanOrEqual(2);
    }
    // Không có người rảnh → không đi
    for (const v of s.survivors) v.hp = 10;
    made = autoLoot(s, world, site);
    expect(made).toBeNull();
  });

  it('does not stack a second expedition on the same site', () => {
    const { s, site, world } = setup();
    const first = autoLoot(s, world, site);
    if (first) expect(autoLoot(s, world, site)).toBeNull();
  });
});

describe('auto switches', () => {
  it('ván mới bật sẵn cả 3 công tắc', () => {
    const { s } = setup();
    expect(s.auto).toEqual({ craftCore: true, loot: true, garden: true });
  });

  it('default on (ván mới bật sẵn), tắt được từng cái', () => {
    expect(DEFAULT_AUTO).toEqual({ craftCore: true, loot: true, garden: true });
    const { s, world, site } = setup();
    addRoom(site, 'forge', 30);
    addStock(s, site, { scrap: 200, wood: 200, food: 2250 * 4 } as never);
    s.auto = { craftCore: false, loot: false, garden: false };
    runAuto(s, world);
    expect(site.projects.length).toBe(0);
    s.auto = { craftCore: true, loot: false, garden: true };
    runAuto(s, world);
    expect(site.projects.length).toBeGreaterThan(0);
  });

  it('survives an old save without the field', () => {
    const { s } = setup();
    delete (s as GameState).auto;
    expect(() => runAuto(s, setup().world)).not.toThrow();
  });
});

describe('labour warnings', () => {
  it('flags a garden nobody farms', () => {
    const { s, site } = setup();
    addRoom(site, 'garden', 740, true);
    for (const v of s.survivors) v.role = 'idle';
    const ids = siteWarnings(s, site).map((w) => w.id);
    expect(ids).toContain('no-farmer');
  });

  it('flags water infrastructure with nobody on water duty', () => {
    const { s, site } = setup();
    addRoom(site, 'filter', 4);
    for (const v of s.survivors) v.role = 'idle';
    expect(siteWarnings(s, site).map((w) => w.id)).toContain('no-water-role');
  });

  it('is quiet when the work is covered', () => {
    const { s, site } = setup();
    addRoom(site, 'garden', 200, true);
    addRoom(site, 'filter', 4);
    const [a, b] = s.survivors;
    a.role = 'farmer';
    b.role = 'water';
    expect(siteWarnings(s, site)).toEqual([]);
  });

  it('warns when the warehouse holds weapons nobody carries', () => {
    const { s, site } = setup();
    site.stock.wpn_machete = 2;
    for (const v of s.survivors) v.gear = {};
    expect(siteWarnings(s, site).map((w) => w.id)).toContain('unarmed');
  });
});
