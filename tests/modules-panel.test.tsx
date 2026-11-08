import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { moduleRows, ModulesPanel } from '../src/ui/ModulesPanel';
import { newGame, mainSite, addStock } from '../src/sim/state';
import { queueModule } from '../src/sim/build';
import { makeTestWorld } from '../scripts/headless';
import type { Room } from '../src/base/interior';

function setup() {
  const world = makeTestWorld();
  const b = world.buildings.find((x) => x.area > 250 && x.area < 900)!;
  const s = newGame(world, b.id, 42, new Date(2026, 5, 1));
  return { s, site: mainSite(s) };
}
const add = (site: ReturnType<typeof mainSite>, module: NonNullable<Room['module']>, area: number, outdoor = false, level = 1) => {
  const room: Room = { id: `r${site.interior.rooms.length}`, floor: 0, outdoor, cells: [site.interior.rooms.length], area, module, walled: true, moduleLevel: level };
  site.interior.rooms.push(room);
  if (module === 'garden') site.plots[room.id] = { roomId: room.id, crop: null, growth: 0, tendedToday: 0, plantedDay: 0 };
  return room;
};

describe('bảng công trình', () => {
  it('liệt kê mỗi module đã xây đúng một dòng, kèm cấp và hiệu quả', () => {
    const { s, site } = setup();
    add(site, 'garden', 740, true);
    add(site, 'garden', 200, true);
    add(site, 'filter', 4);
    add(site, 'bedroom', 30, false, 2);
    const rows = moduleRows(s, site);
    const byId = Object.fromEntries(rows.map((r) => [r.module, r]));
    expect(byId.garden.count).toBe(2);
    expect(byId.garden.effect).toContain('940 m²');
    expect(byId.filter.level).toBe(1);
    expect(byId.bedroom.level).toBe(2);
    expect(rows.map((r) => r.label)).toEqual([...rows.map((r) => r.label)].sort((a, b) => a.localeCompare(b, 'vi')));
  });

  it('đánh dấu module đang có hạng mục xây', () => {
    const { s, site } = setup();
    const room: Room = { id: 'x', floor: 0, outdoor: false, cells: [1], area: 40, walled: true };
    site.interior.rooms.push(room);
    addStock(s, site, { wood: 500, scrap: 500 });
    expect(queueModule(s, site, 'x', 'workshop')).toBeNull();
    const row = moduleRows(s, site).find((r) => r.module === 'workshop');
    expect(row).toBeDefined();
    expect(row!.pending).toBe(true);
    expect(row!.effect).toBe('đang xây');
  });

  it('hiện bầy gia súc theo loài và số con', () => {
    const { s, site } = setup();
    const room = add(site, 'barn', 40, true);
    room.herd = 'bo';
    room.herdState = { kind: 'bo', adults: 3, males: 1, young: 1, youngIn: 0, pregnant: 0, dueIn: 0, lactating: 1, lactationIn: 100, eggDebt: 0, estrusIn: 5 };
    expect(moduleRows(s, site).find((r) => r.module === 'barn')!.effect).toContain('Bò 4 con');
  });

  it('render được màn hình (không cần click)', () => {
    const { s, site } = setup();
    add(site, 'garden', 400, true);
    const html = renderToStaticMarkup(<ModulesPanel s={s} site={site} refresh={() => {}} />);
    expect(html).toContain('Công trình');
    expect(html).toContain('Vườn rau');
  });
});
