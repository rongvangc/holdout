import { describe, expect, it } from 'vitest';
import { baseStats, mainSite, newGame } from '../src/sim/state';
import { facilityChips, readouts, siteChips } from '../src/ui/readout';
import { makeTestWorld } from '../scripts/headless';

function setup() {
  const world = makeTestWorld();
  const baseB = world.buildings.filter((b) => b.area > 250 && b.area < 900)[0];
  const s = newGame(world, baseB.id, 42, new Date(2026, 5, 1));
  const site = mainSite(s);
  return { world, s, site };
}

/** Reset kho về 0 rồi nạp đúng số ngày ăn/uống muốn kiểm. */
function setDays(s: ReturnType<typeof setup>['s'], site: ReturnType<typeof setup>['site'], opts: { foodDays?: number; waterDays?: number }) {
  const pop = Math.max(1, baseStats(s, site).population);
  site.stock.food = 0;
  site.stock.meals = 0;
  site.stock.rawFood = 0;
  site.stock.water = 0;
  if (opts.foodDays !== undefined) site.stock.food = pop * 2250 * opts.foodDays;
  if (opts.waterDays !== undefined) site.stock.water = pop * 3.3 * opts.waterDays;
}

describe('readouts', () => {
  it('food 4 ngày → warn, text/ratio/hint đúng y bảng', () => {
    const { s, site } = setup();
    setDays(s, site, { foodDays: 4 });
    const pop = Math.max(1, baseStats(s, site).population);
    const food = readouts(s, site)[0];
    expect(food.id).toBe('food');
    expect(food.icon).toBe('food');
    expect(food.text).toBe('4.0 ngày');
    expect(food.tone).toBe('warn');
    expect(food.ratio).toBeCloseTo(0.4);
    expect(food.hint).toBe(`Ăn: đủ 4.0 ngày cho ${pop} người`);
  });

  it('thứ tự readout là food, water, beds, morale, defense', () => {
    const { s, site } = setup();
    expect(readouts(s, site).map((r) => r.id)).toEqual(['food', 'water', 'beds', 'morale', 'defense']);
  });

  it('biên ăn: 2.9 bad, 3.0 warn, 5.9 warn, 6.0 ok', () => {
    const { s, site } = setup();
    setDays(s, site, { foodDays: 2.9 });
    expect(readouts(s, site)[0].tone).toBe('bad');
    expect(readouts(s, site)[0].text).toBe('2.9 ngày');
    setDays(s, site, { foodDays: 3 });
    expect(readouts(s, site)[0].tone).toBe('warn');
    setDays(s, site, { foodDays: 5.9 });
    expect(readouts(s, site)[0].tone).toBe('warn');
    setDays(s, site, { foodDays: 6 });
    expect(readouts(s, site)[0].tone).toBe('ok');
  });

  it('biên uống: 1.9 bad, 2.0 warn, 3.9 warn, 4.0 ok', () => {
    const { s, site } = setup();
    setDays(s, site, { waterDays: 1.9 });
    const w = readouts(s, site)[1];
    expect(w.tone).toBe('bad');
    expect(w.text).toBe('1.9 ngày');
    expect(w.ratio).toBeCloseTo(Math.min(1, 1.9 / 7));
    expect(w.hint).toBe(`Uống: đủ 1.9 ngày cho ${Math.max(1, baseStats(s, site).population)} người`);
    setDays(s, site, { waterDays: 2 });
    expect(readouts(s, site)[1].tone).toBe('warn');
    setDays(s, site, { waterDays: 3.9 });
    expect(readouts(s, site)[1].tone).toBe('warn');
    setDays(s, site, { waterDays: 4 });
    expect(readouts(s, site)[1].tone).toBe('ok');
  });

  it('beds: text here/beds, warn khi thiếu giường, ratio theo giường', () => {
    const { s, site } = setup();
    const st = baseStats(s, site);
    const here = st.population;
    const beds = readouts(s, site)[2];
    expect(beds.text).toBe(`${here}/${st.beds}`);
    expect(beds.tone).toBe(st.beds < here ? 'warn' : 'ok');
    expect(beds.ratio).toBe(st.beds > 0 ? Math.min(1, here / st.beds) : 1);
    expect(beds.hint).toBe(`Giường: ${here} người / ${st.beds} giường`);
  });

  it('morale: TB làm tròn, ngưỡng 25/15', () => {
    const { s, site } = setup();
    for (const v of s.survivors) v.morale = 50;
    const m = readouts(s, site)[3];
    expect(m.text).toBe('50');
    expect(m.tone).toBe('ok');
    expect(m.ratio).toBeCloseTo(0.5);
    expect(m.hint).toBe('Tinh thần TB 50/100');
    for (const v of s.survivors) v.morale = 20;
    expect(readouts(s, site)[3].tone).toBe('warn');
    for (const v of s.survivors) v.morale = 10;
    expect(readouts(s, site)[3].tone).toBe('bad');
  });

  it('defense: số nguyên, luôn ok, ratio null', () => {
    const { s, site } = setup();
    const st = baseStats(s, site);
    const d = readouts(s, site)[4];
    const n = String(Math.round(st.defenseStatic));
    expect(d.text).toBe(n);
    expect(d.tone).toBe('ok');
    expect(d.ratio).toBeNull();
    expect(d.hint).toBe(`Phòng thủ tĩnh ${n}`);
  });

  it('site không người: không NaN, morale "—", không crash', () => {
    const { s, site } = setup();
    s.survivors = [];
    const rs = readouts(s, site);
    expect(rs[3].text).toBe('—');
    expect(rs[3].ratio).toBe(0);
    expect(rs[3].hint).toBe('Không có ai ở đây');
    for (const r of rs) {
      expect(r.text).not.toContain('NaN');
      expect(r.hint).not.toContain('NaN');
      if (r.ratio !== null) expect(Number.isFinite(r.ratio)).toBe(true);
    }
  });
});

describe('siteChips', () => {
  it('heat biên 45/46, filth biên 40/41, corpses > 0 bad', () => {
    const { s, site } = setup();
    site.heat = 46;
    site.filth = 41;
    site.corpses = 3;
    const chips = siteChips(s, site);
    expect(chips.map((c) => c.id)).toEqual(['heat', 'filth', 'corpses']);
    expect(chips[0].text).toBe('46');
    expect(chips[0].tone).toBe('bad');
    expect(chips[0].hint).toBe('Độ ồn 46/100');
    expect(chips[1].text).toBe('41');
    expect(chips[1].tone).toBe('bad');
    expect(chips[1].hint).toBe('Độ bẩn 41/100');
    expect(chips[2].text).toBe('3');
    expect(chips[2].tone).toBe('bad');
    expect(chips[2].hint).toBe('Xác chưa xử lý 3');
    site.heat = 45;
    site.filth = 40;
    site.corpses = 0;
    const c2 = siteChips(s, site);
    expect(c2[0].tone).toBe('ok');
    expect(c2[1].tone).toBe('ok');
    expect(c2[2].tone).toBe('ok');
    expect(c2[2].hint).toBe('Xác chưa xử lý 0');
  });

  it('xét ngưỡng trên giá trị gốc, chỉ làm tròn khi hiển thị', () => {
    const { s, site } = setup();
    site.heat = 45.4;
    site.filth = 40.4;
    site.corpses = 0;
    const chips = siteChips(s, site);
    expect(chips[0].text).toBe('45');
    expect(chips[0].tone).toBe('bad');
    expect(chips[1].text).toBe('40');
    expect(chips[1].tone).toBe('bad');
  });
});

describe('facilityChips', () => {
  it('latrine warn khi thiếu, fortify/fence đúng text, expeditions "0 đội", salvage củi gom', () => {
    const { s, site } = setup();
    site.fortify = { level: 2, hp: 78.4 };
    site.fence = { level: 1, hp: 100 };
    site.salvageLeft.wood = 120;
    const chips = facilityChips(s, site);
    expect(chips.map((c) => c.id)).toEqual(['latrine', 'fortify', 'fence', 'expeditions', 'salvage']);
    const st = baseStats(s, site);
    expect(chips[0].text).toBe(String(st.latrines));
    expect(chips[0].tone).toBe(st.latrines * 20 < st.population ? 'warn' : 'ok');
    expect(chips[0].hint).toBe(`Nhà vệ sinh: ${st.latrines} (đủ cho ${st.latrines * 20} người)`);
    expect(chips[1].text).toBe('cấp 2 · 78%');
    expect(chips[1].hint).toBe('Gia cố: cấp 2 · 78% HP');
    expect(chips[2].text).toBe('cấp 1 · 100%');
    expect(chips[2].hint).toBe('Rào: cấp 1 · 100% HP');
    expect(chips[3].text).toBe('0 đội');
    expect(chips[3].hint).toBe('0 đội đang ngoài');
    expect(chips[4].text).toBe('120 kg');
    expect(chips[4].tone).toBe('ok');
    expect(chips[4].hint).toBe('Củi gom tại điểm: 120 kg còn');
    site.salvageLeft.wood = 0;
    const c2 = facilityChips(s, site);
    expect(c2[4].text).toBe('hết');
    expect(c2[4].tone).toBe('warn');
    expect(c2[4].hint).toBe('Củi gom tại điểm: hết (đi xa hơn)');
  });
});
