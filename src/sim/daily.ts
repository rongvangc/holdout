import { push } from '../core/eventQueue';
import { chance, int, range } from '../core/rng';
import { DAY, dayOf, dayOfYear, HOUR, monthOf, nextClock } from '../core/time';
import { gridDistance, gridDisk } from 'h3-js';
import type { World } from '../world/types';
import { dist } from '../world/geo';
import { CROPS, HYGIENE_L_PER_DAY, TEND_H_PER_M2_DAY, ZOMBIES, type ZombieType } from './data';
import { describeWeapon, weaponDefense, wearWeapon } from './equipment';
import { armourAgainst, killShare } from './combat';
import { survivorWeapon } from './gear';
import { ITEMS } from '../data/items';
import { PERISHABLE_STAPLES, STAPLE_IDS, stapleKcal } from '../data/staples';
import { FEATURES } from './config';
import { chargeBatteries, planPower } from './power';
import { raidBudget } from './scale';

/** Đêm phát tín hiệu liên tục cần để được cứu. */
export const RESCUE_DAYS = 7;
import { HERDS, herdCapacity, herdFor, herdNeeds, startingHerd, tickHerd } from './livestock';
import { isMonotone, MONOTONY_MORALE, rotFactor, SCURVY_DAYS, SCURVY_HP } from './diet';
import { bleedOf, CLEAN_SEPSIS_CHANCE, rollWound, WOUND_SEPSIS_CHANCE } from './medical';
import { applyBiteLaw, desert, handleStrangers, killSurvivor } from './lifecycle';
import { addStock, alert, baseStats, latrineShortfall, log, newId, present, siteById, take, takeStapleKcal } from './state';
import { hasTrait, makeSurvivor, skill } from './survivors';
import type { GameState, Site, Survivor, Weather } from './types';
import { densityMult, effectiveDanger, hordeSize, nextHordeCell, siegeStrengthCap, zombieType } from './zombies';
import { structureEffects } from '../data/structures';

// Vietnam monthly climate: [rain probability, mean mm on a rainy day, temp North, temp South, storm probability].
const CLIMATE: [number, number, number, number, number][] = [
  [0.05, 5, 17, 27, 0],
  [0.07, 5, 18, 28, 0],
  [0.1, 10, 21, 29, 0],
  [0.2, 15, 25, 30, 0],
  [0.45, 20, 28, 30, 0.01],
  [0.6, 22, 30, 29, 0.02],
  [0.65, 24, 30, 28, 0.03],
  [0.7, 26, 29, 28, 0.05],
  [0.7, 28, 28, 28, 0.07],
  [0.55, 25, 26, 27, 0.06],
  [0.3, 15, 22, 27, 0.03],
  [0.12, 8, 19, 26, 0.01],
];

export function rollWeather(s: GameState, day: number): Weather {
  const m = monthOf(dayOfYear(s.startDoy, day));
  const [pRain, mm, tN, tS, pStorm] = CLIMATE[m - 1];
  const k = Math.max(0, Math.min(1, (s.latitude - 11) / 9)); // 0 = South, 1 = North
  const tempC = Math.round((tS + (tN - tS) * k + range(s.rng, -2.5, 2.5)) * 10) / 10;
  const storm = chance(s.rng, pStorm);
  const rain = storm || chance(s.rng, pRain);
  const rainMm = rain ? Math.round(-Math.log(1 - range(s.rng, 0, 0.98)) * mm * (storm ? 3 : 1)) : 0;
  const hot = tempC >= 32;
  const label = storm ? 'Bão' : rainMm > 40 ? 'Mưa lớn' : rainMm > 0 ? 'Mưa' : hot ? 'Nắng nóng' : tempC < 18 ? 'Rét' : 'Nắng';
  return { day, label, rainMm, tempC, storm, hot };
}

const UNGUARDED_LOSS = 0.03;

function siteDay(s: GameState, world: World, site: Site, day: number): void {
  const st = baseStats(s, site);
  const home = present(s, site);

  for (const plot of Object.values(site.plots)) {
    if (!plot.crop) continue;
    const room = site.interior.rooms.find((r) => r.id === plot.roomId);
    if (!room) continue;
    const need = room.area * TEND_H_PER_M2_DAY;
    const care = need > 0 ? Math.min(1, plot.tendedToday / need) : 1;
    const cold = s.weather.tempC < 18 ? 0.6 : 1;
    const before = plot.growth;
    const fertilised = st.barn > 0 ? 1.25 : 1; // phân từ trại chăn nuôi
    plot.growth = Math.min(1, plot.growth + ((0.45 + 0.55 * care) / CROPS[plot.crop].days) * cold * fertilised);
    if (s.weather.storm && room.outdoor) plot.growth = Math.max(0, plot.growth - 0.15);
    plot.tendedToday = 0;
    if (before < 1 && plot.growth >= 1) log(s, `${site.name}: ${CROPS[plot.crop].label} đã chín.`, 'good');
  }

  // Chăn nuôi: mỗi chuồng/trại giữ một bầy có vòng sinh sản thật (xem sim/livestock.ts).
  for (const room of site.interior.rooms) {
    if (room.module !== 'coop' && room.module !== 'barn') continue;
    if (!room.herd) room.herd = herdFor(world, site, room.module);
    const bio = HERDS[room.herd];
    const cap = herdCapacity(room.area * (1 + 0.25 * ((room.moduleLevel ?? 1) - 1)), room.herd);
    if (!room.herdState) room.herdState = startingHerd(room.herd, cap);
    const h = room.herdState;

    // Chăn thả thật: chỉ có cỏ khi quanh điểm có bãi cỏ/ruộng đủ rộng (≥5.000 m² trong 1 km).
    const pasture = site.kind === 'field' ? 1 : world.greens.some(
      (g) => g.area >= 5000 && Math.hypot(g.centroid[0] - site.centroid[0], g.centroid[1] - site.centroid[1]) <= 1000,
    ) ? 1 : 0.3;
    const need = herdNeeds(h, pasture);
    const pop = Math.max(1, home.length);
    // Giữ lại nước bẩn cho trạm lọc (3 ngày/người) — bầy không được uống hết phần đó,
    // nếu không trạm lọc không có gì để lọc và cả nhóm chết khát (đã xảy ra ở test 60 ngày).
    const dirtyReserve = pop * 3 * 3;
    const dirtyAvailable = Math.max(0, site.stock.dirtyWater - dirtyReserve);
    const fromDirty = take(site, 'dirtyWater', Math.min(need.water, dirtyAvailable));
    const cleanReserve = site.stock.water - pop * 3.3 * 3;
    const fromClean = take(site, 'water', Math.max(0, Math.min(need.water - fromDirty, cleanReserve)));
    const drank = fromDirty + fromClean;
    // Không bao giờ lấy từ khẩu phần ăn của người: chỉ cho ăn phần dư trên 10 ngày lương.
    const humanReserve = pop * 2250 * 10;
    const surplus = Math.max(0, stapleKcal(site.stock) - humanReserve);
    const fed = Math.min(need.feed, surplus);
    if (fed > 0) takeStapleKcal(site, fed);
    // Người chăm có skill Chăn nuôi thì bầy khoẻ hơn.
    const husbandry = home.reduce((a, m) => a + skill(m, 'husbandry'), 0) / pop;
    // Một người chăm ~10 con; thiếu người thì bầy kém đi dù đủ ăn.
    const heads = h.adults + h.young * 0.4;
    const herdersNeeded = Math.max(1, Math.ceil(heads / 10));
    const herders = home.filter((m) => m.role === 'farmer').length;
    const labour = Math.min(1, 0.4 + 0.6 * (herders / herdersNeeded));
    const care = Math.max(
      0,
      Math.min(1, (0.55 * Math.min(1, fed / Math.max(0.01, need.feed)) + 0.45 * Math.min(1, drank / Math.max(0.01, need.water))) * (1 + 0.1 * ((room.moduleLevel ?? 1) - 1)) * (1 + 0.05 * husbandry) * labour),
    );

    // Mổ thịt khi bầy vượt sức chứa hoặc khi kho lương thực cạn (giữ lại 2 con giống).
    const crowded = h.adults + h.young > cap;
    const hungryCamp = stapleKcal(site.stock) + site.stock.food + site.stock.meals < pop * 2250 * 3;
    const slaughter = crowded ? 1 : hungryCamp && h.adults > 2 ? 1 : 0;

    const tick = tickHerd(h, cap, care, s.rng, slaughter);
    // Hao hụt tự nhiên: 0,3%/ngày, tăng khi chăm kém (thay cho hệ dịch bệnh đã bỏ).
    if (h.adults > 2 && chance(s.rng, care < 0.3 ? 0.015 : 0.003)) {
      h.adults -= 1;
      h.males = Math.min(h.males, h.adults);
      log(s, `${site.name}: một con ${bio.label.toLowerCase()} chết vì kiệt sức.`, 'warn');
    }
    if (tick.eggs) addStock(s, site, { trung: tick.eggs });
    if (tick.milk) addStock(s, site, { sua: Math.round(tick.milk * 10) / 10 });
    if (tick.meat) addStock(s, site, { thit: tick.meat });
    site.heat = Math.min(100, site.heat + bio.heat * (h.adults + h.young));
    for (const e of tick.events) log(s, `${site.name}: ${e}`, 'info');
    if (care < 0.3) log(s, `${site.name}: ${bio.label.toLowerCase()} thiếu ăn/uống, bầy gầy đi.`, 'warn');
  }
  if (st.pond > 0) {
    const lvl = Math.max(1, st.pondLevel);
    const murky = site.filth > 55;
    const bite = st.pond * (lvl >= 3 ? 1.5 : lvl === 2 ? 1.2 : 1) * (murky ? 0.4 : 1);
    if (chance(s.rng, murky ? 0.3 : 0.65)) addStock(s, site, { ca: Math.round(bite * 10) / 10 });
    if (murky) log(s, `${site.name}: ao cá bẩn, cá chết dần.`, 'warn');
  }

  // Spoilage. Heat speeds everything up.
  const hot = s.weather.hot ? 1.5 : 1;
  site.stock.meals *= s.weather.hot ? 0.4 : 0.6;
  site.stock.rawFood *= 1 - (st.storage ? 0.005 : 0.02) * hot;
  for (const id of PERISHABLE_STAPLES) {
    if ((site.stock[id] ?? 0) <= 0) continue;
    const keep = 1 - (st.storage ? 0.005 : 0.02) * hot * 1.5;
    site.stock[id] *= keep;
  }
  // Catalogued food (MRE, tins, dried goods) rots per item; a locked store halves it too.
  // Tủ lạnh mạnh hơn hầm đất, nhưng chỉ khi có điện.
  const cellarMul = rotFactor(st.cellar, st.storage) * st.fridgeRot;
  for (const [id, def] of Object.entries(ITEMS)) {
    if (!(site.stock[id] > 0) || !def.rotPerDay) continue;
    const rate = def.rotPerDay * (def.rotPerDay < 0.01 ? 1 : hot) * cellarMul;
    site.stock[id] = Math.max(0, site.stock[id] * (1 - rate));
  }
  const staleBefore = site.fuelBatches.reduce((a, b) => a + b.liters, 0);
  site.fuelBatches = site.fuelBatches.filter((b) => day - b.day <= 180);
  site.stock.fuel = site.fuelBatches.reduce((a, b) => a + b.liters, 0);
  if (staleBefore - site.stock.fuel > 0.5) alert(s, `${site.name}: ${(staleBefore - site.stock.fuel).toFixed(1)} L xăng đã biến chất (quá 6 tháng).`, 'warn');

  if (!home.length && site.kind !== 'base') {
    // Nobody home: other scavengers and animals help themselves.
    for (const k of ['food', ...STAPLE_IDS, 'water', 'medicine', 'fuel'] as const) take(site, k, site.stock[k] * UNGUARDED_LOSS);
  }

  // Hygiene water (Sphere ~15 L/person/day) — grey water is fine for washing,
  // but a drinking reserve of dirty water is kept back for boiling/filtering.
  const needL = home.length * HYGIENE_L_PER_DAY;
  const spare = Math.max(0, site.stock.dirtyWater - home.length * 5);
  const gotL = take(site, 'dirtyWater', Math.min(needL, spare));
  const shortage = needL > 0 ? 1 - gotL / needL : 0;
  site.filth = Math.min(100, site.filth + home.length * 0.6 + latrineShortfall(st) * 1.0 + site.corpses * 2 + shortage * 12);
  if (s.weather.rainMm > 80 && world.waterPoints.some((w) => dist(w.pos, site.centroid) < 300)) {
    site.filth = Math.min(100, site.filth + 8);
    alert(s, `${site.name}: nước sông dâng, ngập — vệ sinh xuống cấp.`, 'warn');
  }

  for (const v of home) {
    if (v.sickDays > 0) {
      v.hp -= 3;
      v.sickDays--;
      if (v.sickDays === 0) log(s, `${v.name} đã khỏi bệnh.`, 'good');
      if (v.hp <= 0) killSurvivor(s, v, 'bệnh tật');
    } else {
      const p = (0.002 + (site.filth / 100) * 0.06 + (site.corpses > 3 ? 0.01 : 0)) * (hasTrait(v, 'hardy') ? 0.6 : 1);
      if (chance(s.rng, p)) {
        v.sickDays = int(s.rng, 3, 7);
        log(s, `${v.name} bị tiêu chảy/sốt (${v.sickDays} ngày).`, 'warn');
      }
    }
    v.treatedToday = false;
  }
  // Vết thương hở không được rửa thì dễ nhiễm trùng; rửa bằng cồn/iodine thì hiếm hơn nhiều.
  for (const v of home) {
    if (!v.woundPart) continue;
    const cleaned = v.woundCleanedDay === day;
    const p = cleaned ? CLEAN_SEPSIS_CHANCE : WOUND_SEPSIS_CHANCE;
    if (!v.infected && chance(s.rng, p)) {
      v.infected = true;
      v.infection = Math.max(v.infection ?? 0, 10);
      v.biteKnown = v.biteKnown || false;
      log(s, `${v.name}: vết thương ở ${v.woundPart === 'arm' ? 'tay' : v.woundPart === 'leg' ? 'chân' : v.woundPart === 'head' ? 'đầu' : 'thân'} bị nhiễm trùng.`, 'bad');
    }
    // Máu tự cầm dần: cơ thể đông máu, nên không băng ngay cũng không chết chắc.
    if ((v.bleed ?? 0) > 0 && v.hp > 35 && chance(s.rng, 0.45)) v.bleed = (v.bleed ?? 0) - 1;
    // Vết thương lành thì hết trạng thái vết thương.
    if ((v.bleed ?? 0) === 0 && v.hp > 75 && chance(s.rng, 0.25)) {
      v.woundPart = undefined;
      v.woundCleanedDay = undefined;
    }
  }

  // Thiếu rau quả lâu ngày: scorbut (thiếu vitamin C) — HP tụt dần cho tới khi ăn rau.
  const noVegDays = day - (site.lastVegDay ?? 1);
  if (noVegDays > SCURVY_DAYS) {
    for (const v of home) v.hp = Math.max(1, v.hp - SCURVY_HP);
    if (noVegDays === SCURVY_DAYS + 1) alert(s, `${site.name}: cả điểm đã ${noVegDays} ngày không có rau quả — thiếu vitamin C, mọi người yếu dần.`, 'bad');
  }

  updateMorale(s, site, home, st.beds, st.recRoom, st.recMorale + st.radioMorale);

  // Điện: pin mặt trời sạc ban ngày, tối nay cấp cho các thiết bị theo thứ tự ưu tiên.
  chargeBatteries(s, site);
  const power = planPower(s, site, st.generator ? st.generatorLevel : 0, st.generatorFuel);
  site.powerOn = power.on as string[];
  site.powered = power.on.includes('lighting');
  if (power.shed.length) {
    log(s, `${site.name}: thiếu điện (${power.demand.toFixed(1)}/${power.supply.toFixed(1)} kW) — tắt ${power.shed.length} thiết bị.`, 'warn');
  } else if (power.on.length) {
    log(s, `${site.name}: ${power.on.length} thiết bị chạy bằng ${power.source === 'solar' ? 'pin mặt trời' : 'máy phát'}.`, 'info');
  }
  // Sưởi: bếp củi vốn đã đốt lửa, nên giữ lửa qua đêm lạnh là cùng một việc — không
  // cần thêm một lò sưởi riêng. Tốn ít củi hơn vì bếp có sẵn than nóng.
  const kitchenLvl = (site.interior.rooms.find((r) => r.module === 'kitchen')?.moduleLevel ?? 0) as number;
  if (kitchenLvl > 0 && s.weather.tempC < 18) {
    const woodPerNight = [3, 4, 5][Math.min(2, kitchenLvl - 1)];
    if ((site.stock.wood ?? 0) >= woodPerNight) {
      take(site, 'wood', woodPerNight);
      site.warmthActive = true;
    } else {
      site.warmthActive = false;
      log(s, `${site.name}: hết củi — bếp tắt, đêm nay lạnh.`, 'warn');
    }
  } else {
    site.warmthActive = false;
  }

  // Radio cấp 3 phát tín hiệu cứu hộ — tạm tắt bằng cờ FEATURES.rescue.
  if (!FEATURES.rescue) {
    s.rescueDays = 0;
    s.won = false;
  } else if (st.rescueSignal && (st.population ?? 0) >= 4) {
    s.rescueDays = (s.rescueDays ?? 0) + 1;
    if (s.rescueDays === 1) alert(s, `${site.name}: radio cấp 3 bắt đầu phát tín hiệu cầu cứu.`, 'good');
    if (s.rescueDays >= RESCUE_DAYS && !s.won) {
      s.won = true;
      s.gameOver = true;
      alert(s, `Ngày ${day}: tín hiệu được trả lời. Cộng đồng ${site.name} được cứu — bạn thắng.`, 'good');
      log(s, 'MÁY BAY ĐÃ ĐẾN. Bạn sống sót qua tận thế.', 'good');
    }
  } else if (s.rescueDays) {
    s.rescueDays = Math.max(0, s.rescueDays - 1);
  }
  site.heat = Math.max(0, site.heat - 12);
  // Slow wear: walls and fences rot without upkeep, repair work tops them back up.
  if (site.fortify.level) site.fortify.hp = Math.max(0, site.fortify.hp - 0.25);
  if (site.fence.level) site.fence.hp = Math.max(0, site.fence.hp - 0.4);
  site.wellDrawnToday = 0;
}

function siteWeather(s: GameState, site: Site): void {
  const st = baseStats(s, site);
  if (s.weather.rainMm > 0 && st.tanks > 0) {
    // Fields have no roof: tanks there catch only their own footprint.
    const catchment = site.interior.footprintArea || st.tanks * 20;
    const got = Math.min(s.weather.rainMm * catchment * 0.8, Math.max(0, st.waterCapacity - site.stock.dirtyWater));
    addStock(s, site, { dirtyWater: got });
    if (got > 50) log(s, `${site.name}: mưa ${s.weather.rainMm} mm, hứng được ${Math.round(got)} L.`, 'good', { dirtyWater: got });
  }
  if (s.weather.storm) {
    site.fortify.hp = Math.max(0, site.fortify.hp - 5);
    site.fence.hp = Math.max(0, site.fence.hp - 10);
    // Open-air shelters are the first thing a storm tears apart.
    for (const r of site.interior.rooms) {
      if (r.module === 'shelter' && chance(s.rng, st.shelterStormLoss)) {
        r.module = undefined;
        log(s, `${site.name}: bão xoé một lán trại.`, 'warn');
      }
    }
  }
}

export function dayEvent(s: GameState, world: World): void {
  const day = dayOf(s.t);
  for (const site of s.sites) siteDay(s, world, site, day);

  for (const [k, h] of Object.entries(s.cellHeat)) {
    if (h <= 12) delete s.cellHeat[k];
    else s.cellHeat[k] = h - 12;
  }
  const drift = day <= s.hordeUntilDay ? 0.15 : 0.03;
  for (const [k, c] of Object.entries(s.cellClear)) {
    if (c <= drift) delete s.cellClear[k];
    else s.cellClear[k] = c - drift;
  }
  s.recentDeaths *= 0.6;

  s.weather = rollWeather(s, day);
  for (const site of s.sites) siteWeather(s, site);
  if (s.weather.storm) alert(s, 'Bão! Không thể ra ngoài hôm nay.', 'warn');

  if (day >= 12 && day > s.hordeUntilDay && chance(s.rng, 1 / 15)) {
    s.hordeUntilDay = day + 2;
    alert(s, 'Một bầy zombie lớn đang đi qua khu vực (2 ngày). Mật độ x2.', 'bad');
  }

  // Living hordes: bầy zombie trườn trên bản đồ về phía điểm của người chơi (hoặc mồi ồn).
  s.hordes ??= [];
  if (FEATURES.hordes && day >= 10 && s.hordes.length < 2 && chance(s.rng, 1 / 20)) {
    const candidates = Object.keys(world.cells).filter((c) => s.sites.every((x) => gridDistance(c, x.cell) >= 3));
    if (candidates.length) {
      const cell = candidates[int(s.rng, 0, candidates.length - 1)];
      const size = hordeSize(s.rng, day, world.cells[cell]?.danger ?? 2);
      s.hordes.push({ id: `h${day}-${s.hordes.length}`, cell, size });
      log(s, `Tin đồn: một bầy đông khoảng ${size} con trườn vào khu vực.`, 'warn');
    }
  }

  for (const site of s.sites) {
    const n = present(s, site).length;
    if (!n) continue;
    // Fewer people = less noise and smell; a crew of 3 draws far fewer night visits than 20.
    const size = Math.min(1, (n + 2) / 10);
    const pRaid = Math.min(0.85, (0.03 + 0.004 * day + site.heat / 200 + n / 200) * size * (day <= s.hordeUntilDay ? 1.5 : 1));
    if (chance(s.rng, pRaid)) push(s.queue, nextClock(s.t, 21 * HOUR) + range(s.rng, 0, 7) * HOUR, { k: 'raid', site: site.id });
  }
  if (chance(s.rng, Math.max(0.06, 0.16 - day * 0.001))) push(s.queue, s.t + range(s.rng, 8, 17) * HOUR, { k: 'strangers' });

  push(s.queue, s.t + 7 * HOUR, { k: 'routes' });
  push(s.queue, s.t + DAY, { k: 'day' });
  const alive = s.survivors.filter((v) => v.status === 'alive').length;
  log(s, `— Ngày ${day} · ${s.weather.label} ${s.weather.tempC}°C · ${alive} người · ${s.sites.length} điểm —`, 'info');
}

function updateMorale(s: GameState, site: Site, home: Survivor[], beds: number, rec: boolean, recMorale = 8): void {
  const lawMood =
    (s.laws.rations === 'reduced' ? -8 : s.laws.rations === 'work' ? -4 : 0) +
    (s.laws.curfew ? -3 : 0) +
    (s.laws.corpses === 'bury' ? 2 : -1);
  const bedOk = beds >= home.length;
  const monotone = isMonotone(site.dietLog);
  for (const v of home) {
    let target =
      55 +
      (v.kcal > 800 ? 8 : -15) +
      (v.water > 800 ? 4 : -12) +
      (bedOk ? 6 : -8) +
      (rec ? recMorale : 0) +
      (hasTrait(v, 'optimist') ? 8 : 0) -
      (hasTrait(v, 'coward') ? 5 : 0) -
      site.filth / 8 -
      s.recentDeaths * 4 +
      lawMood -
      (monotone ? MONOTONY_MORALE : 0) -
      (v.sickDays > 0 ? 10 : 0);
    if (hasTrait(v, 'brave')) target = Math.max(target, 30);
    v.morale = Math.max(0, Math.min(100, v.morale + (target - v.morale) * 0.3));
    if (v.morale < 15 && v.location === 'base' && chance(s.rng, 0.08)) desert(s, v);
  }
}

export function raidEvent(s: GameState, world: World, siteId: string): void {
  if (s.weather.storm) return;
  const site = siteById(s, siteId);
  const day = dayOf(s.t);
  const danger = effectiveDanger(s, world, site.cell);
  const horde = day <= s.hordeUntilDay;
  const home = s.survivors.filter((v) => v.status === 'alive' && v.siteId === site.id && v.location === 'base');
  if (!home.length) return;
  // Nhóm 1–2 người không thành "điểm" đáng tập kích: đêm đó chỉ có lẻ tẻ, không phải cả bầy.
  // (Với năng suất nông nghiệp thực tế, cộng đồng thường chỉ 2–4 người — đợt tập kích
  //  dành cho 10 người sẽ quét sạch họ trong vài đêm.)
  if (home.length < 3) return;
  // Calibrated so 2 guards + fortify L1 hold early nights, and late game needs real walls.
  const raw =
    (8 + 1.5 * day ** 0.75) *
    (danger / 3) *
    (densityMult(day, horde, s.weather.tempC) / 1.5) *
    (1 + site.heat / 100) *
    range(s.rng, 0.7, 1.3);
  // Trần theo LAO ĐỘNG của điểm (sim/scale.ts): nhóm 3 người không phải chịu đợt dành
  // cho 10 người. Trước đây sức tập kích tính theo ngày tuyệt đối nên nhóm nhỏ bị quét sạch.
  const budget = raidBudget(home.length, site.heat);
  const gated = Math.min(raw, budget);
  // Traps thin the wave first, but can never stop more than 70% of it.
  // Sàn tối thiểu 12 + 0.5×day: khu đã dọn sạch vẫn có lẻ tẻ trườn về — không có đêm an toàn tuyệt đối.
  const strength = Math.max(gated * 0.3, gated - structureEffects(site.interior.structures).spikes, 12 + 0.5 * day);
  // Đợt tập kích là hỗn hợp loại zombie của đêm đó (tiến hoá theo vùng) — loại quyết định sát thương & cắn.
  const waveTypes = Array.from({ length: 5 }, () => zombieType(s.rng, day, true, danger, s.cellClear[site.cell] ?? 0));
  defendAssault(s, site, strength, waveTypes, 'một đợt tập kích đêm');
}

/** Chu vi dàn mỏng: công trình tĩnh chỉ trù được một phần tường khi chu vi dài. */
export function periStretch(site: Site, st: { watchtowers: number }): number {
  const it = site.interior;
  const perimM = Math.max(30, (it.perimeter ?? 60) + 0.5 * (it.yardPerimeter ?? 0));
  const coverM = site.fortify.level * 45 + site.fence.level * 30 + st.watchtowers * 20;
  return 0.55 + 0.45 * Math.min(1, coverM / perimM);
}

/** Đích của bầy: mồi ồn còn hiệu lực (≤6 ô), else điểm đang giữ gần nhất. */
export function hordeTargetCell(s: GameState, fromCell: string): string | null {
  if (s.decoy && s.decoy.until > s.t && gridDistance(fromCell, s.decoy.cell) <= 6) return s.decoy.cell;
  let best: string | null = null;
  let bestD = Infinity;
  for (const x of s.sites) {
    const d = gridDistance(fromCell, x.cell);
    if (d < bestD) {
      bestD = d;
      best = x.cell;
    }
  }
  return best;
}

/** Người chơi phát ồn 6h ở một ô (tốn 2L xăng) — bầy lân cận trườn về đó thay vì các điểm. */
export function startDecoy(s: GameState, fromSiteId: string, cell: string): string | null {
  s.decoy ??= null;
  const site = siteById(s, fromSiteId);
  if (site.stock.fuel < 2) return 'Cần 2L xăng để phát ồn 6 giờ';
  take(site, 'fuel', 2);
  s.decoy = { cell, until: s.t + 6 * HOUR };
  log(s, `${site.name}: phát ồn 6 giờ (tốn 2L xăng) — bầy lân cận sẽ hướng về ô đó.`, 'info');
  return null;
}

/** Bầy trườn mỗi 10h về đích; chạm sát đích → lập lịch tập kích bầy (siege). */
export function hordesTick(s: GameState, world: World): void {
  s.hordes ??= [];
  for (const h of [...s.hordes]) {
    const target = hordeTargetCell(s, h.cell);
    if (!target) continue;
    if (gridDistance(h.cell, target) <= 1) {
      s.hordes = s.hordes.filter((x) => x.id !== h.id);
      let site = s.sites[0];
      let bestD = Infinity;
      for (const x of s.sites) {
        const d = gridDistance(h.cell, x.cell);
        if (d < bestD) {
          bestD = d;
          site = x;
        }
      }
      const inH = Math.round(range(s.rng, 2, 5));
      push(s.queue, s.t + inH * HOUR, { k: 'siege', sid: site.id, size: h.size });
      alert(s, `${site.name}: bầy ~${h.size} zombie còn cách 1 ô — đánh vào sau ~${inH} giờ nữa. Chuẩn bị!`, 'warn');
      continue;
    }
    const opts = gridDisk(h.cell, 1).filter((c) => c !== h.cell && world.cells[c]);
    h.cell = nextHordeCell(h.cell, target, opts, s.rng);
  }
  push(s.queue, s.t + 10 * HOUR, { k: 'hordes' });
}

/**
 * Tập kích bầy: sức theo kích thước bầy, loại zombie tiến hoá theo vùng.
 * Phần giải quyết (phòng thủ → thắng/thua, thương tích, mất mát) dùng chung defendAssault.
 */
export function siegeEvent(s: GameState, world: World, sid: string, size: number): void {
  if (s.weather.storm) return;
  const site = siteById(s, sid);
  const day = dayOf(s.t);
  const home = s.survivors.filter((v) => v.status === 'alive' && v.siteId === site.id && v.location === 'base');
  if (home.length < 3) {
    // Không đủ người gác — bầy quét qua điểm: mất mức vật tư nhưng không có trận đánh tổng lực.
    s.cellClear[site.cell] = Math.max(0, (s.cellClear[site.cell] ?? 0) - 0.3);
    const loss = Math.min(0.15, 0.05 + day * 0.001);
    for (const k of ['food', 'rawFood', 'meals', 'water', 'medicine'] as const) take(site, k, site.stock[k] * loss);
    alert(s, `${site.name}: bầy ~${size} zombie quét qua điểm trống — lấy mất ${Math.round(loss * 100)}% vật tư.`, 'warn');
    return;
  }
  const strength = Math.min(
    siegeStrengthCap(day),
    size * (8 + 1.5 * day ** 0.75) * (0.6 + 0.4 * Math.min(1, home.length / 10)) * (1 + site.heat / 100) * range(s.rng, 0.85, 1.15) * 0.75,
  );
  const danger = effectiveDanger(s, world, site.cell);
  const cleared = s.cellClear[site.cell] ?? 0;
  const waveTypes = Array.from({ length: 5 }, () => zombieType(s.rng, day, true, danger, cleared));
  defendAssault(s, site, strength, waveTypes, 'một bầy zombie đông đảo');
  s.cellClear[site.cell] = Math.max(0, cleared - 0.3);
}

/** Phần giải quyết chung của raid (ambient) và siege (bầy): phòng thủ → thắng/thua. */
function defendAssault(s: GameState, site: Site, strength: number, waveTypes: ZombieType[], atkLabel: string): void {
  const st = baseStats(s, site);
  const zombies = waveTypes.map((t) => ZOMBIES[t]);
  const waveDmg = zombies.reduce((a, z) => a + z.dmg, 0) / zombies.length;
  const waveBite = zombies.reduce((a, z) => a + z.bite, 0) / zombies.length;
  const home = s.survivors.filter((v) => v.status === 'alive' && v.siteId === site.id && v.location === 'base');
  // Ai cầm gì thì đánh bằng món đó — trang bị là của từng người, không phải của kho.
  // Chu vi dàn mỏng: công trình tĩnh chỉ trù được một phần tường khi chu vi dài.
  let defense = st.defenseStatic * periStretch(site, st);
  const guards = home.filter((v) => v.task?.kind === 'guard');
  for (const g of guards) {
    const w = survivorWeapon(site, g);
    defense += (8 + 2 * skill(g, 'melee') + weaponDefense(w)) * (1 - g.fatigue / 200) * (hasTrait(g, 'brave') ? 1.25 : 1) * (s.laws.curfew ? 1.2 : 1);
    if (w) {
      const worn = wearWeapon(s, site, w, 1);
      if (worn.broke) log(s, `${site.name}: ${describeWeapon(w)} của ${g.name} gãy trong đêm.`, 'warn');
      if (w.noise) site.heat = Math.min(100, site.heat + Math.round(w.noise / 4));
    }
  }
  defense += (home.length - guards.length) * 1.5;
  defense += st.fenceDefense;
  if (guards.length || st.watchtowers) defense *= 1.15;
  // Pha 1: người gác hạ được bao nhiêu trước khi bầy vào tới tường.
  const hardest = waveTypes.reduce((a, b) => (ZOMBIES[b].hp * (1 - ZOMBIES[b].armor) > ZOMBIES[a].hp * (1 - ZOMBIES[a].armor) ? b : a), waveTypes[0]);
  const preKill = guards.length ? killShare(site, guards, hardest) : 0;
  defense *= 1 + 0.5 * preKill;

  site.corpses += Math.round(Math.min(strength, defense) / 12);
  site.heat = Math.min(100, site.heat + 5);
  const vs = `sức ${Math.round(strength)} vs phòng thủ ${Math.round(defense)}`;
  if (defense >= strength) {
    s.stats.raidsRepelled++;
    for (const g of guards) if (chance(s.rng, 0.25)) g.hp -= range(s.rng, 3, 12);
    alert(s, `${site.name}: đẩy lùi ${atkLabel} (${vs}).`, 'good');
    return;
  }
  s.stats.raidsLost++;
  const ratio = (strength - defense) / strength;
  site.fortify.hp = Math.max(0, site.fortify.hp - ratio * 60);
  site.fence.hp = Math.max(0, site.fence.hp - ratio * 80);
  // Thua cũng dỡ các công trình ngoài trời: tường, chướng ngại, bẫy, chòi.
  const structKeys = Object.keys(site.interior.structures ?? {});
  const frac = structKeys.length * ratio;
  const brokenStructs = Math.floor(frac) + (chance(s.rng, frac % 1) ? 1 : 0);
  if (brokenStructs > 0) {
    const order = [...structKeys].sort(() => range(s.rng, -1, 1));
    for (const c of order.slice(0, brokenStructs)) delete site.interior.structures![Number(c)];
  }
  const hurt = Math.max(1, Math.ceil(ratio * home.length * 0.4));
  const shuffled = [...home].sort(() => range(s.rng, -1, 1));
  // Giáp của từng người biến trận đòn thành vết bầm: mất ít HP hơn, ít bị cắn hơn.
  for (const v of shuffled.slice(0, hurt)) {
    const zType = waveTypes[int(s.rng, 0, waveTypes.length - 1)];
    const armour = armourAgainst(v, zType);
    const hit = (range(s.rng, 0.5, 1.5) * waveDmg) / 2 * (1 - armour);
    v.hp -= hit;
    // A hard hit tears something open: bleeding starts and needs a medic.
    if (hit >= 12) {
      const w = rollWound(hit, (arr) => arr[int(s.rng, 0, arr.length - 1)]);
      v.bleed = Math.min(3, Math.max(bleedOf(v), w.bleed));
      v.woundPart = w.part;
    }
    if (chance(s.rng, (waveBite * (1 - armour)) / 0.5)) {
      v.bitten = true;
      v.biteKnown = true;
      if (chance(s.rng, 0.65)) v.infected = true;
    }
  }
  const loss = ratio * (st.storage ? st.storeLoss : 0.25);
  for (const k of ['food', ...STAPLE_IDS, 'meals', 'water', 'medicine'] as const) take(site, k, site.stock[k] * loss);
  alert(
    s,
    `${site.name}: zombie phá vào trong ${atkLabel}! (${vs}) ${hurt} người bị thương, mất ${Math.round(loss * 100)}% vật tư${brokenStructs ? `, ${brokenStructs} ô công trình bị phá` : ''}.`,
    'bad',
  );
  for (const v of shuffled.slice(0, hurt)) {
    if (v.hp <= 0) killSurvivor(s, v, 'tập kích đêm');
    else if (v.bitten) {
      alert(s, `${v.name} bị cắn trong trận tập kích.`, 'bad');
      applyBiteLaw(s, v);
    }
  }
}
export function strangersEvent(s: GameState): void {
  const day = dayOf(s.t);
  const k = chance(s.rng, 0.1) ? int(s.rng, 3, 4) : int(s.rng, 1, 2);
  const group: Survivor[] = [];
  for (let i = 0; i < k; i++) {
    const v = makeSurvivor(s.rng, newId(s, 's'), day);
    if (chance(s.rng, 0.12)) {
      v.bitten = true;
      v.infected = true;
      v.infection = range(s.rng, 5, 60);
    }
    group.push(v);
  }
  handleStrangers(s, group, 'ở cổng');
}
