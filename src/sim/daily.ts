import { push } from '../core/eventQueue';
import { chance, int, range } from '../core/rng';
import { DAY, dayOf, dayOfYear, HOUR, monthOf, nextClock } from '../core/time';
import type { World } from '../world/types';
import { dist } from '../world/geo';
import { CROPS, HYGIENE_L_PER_DAY, TEND_H_PER_M2_DAY } from './data';
import { armorMitigation, bestWeapon, describeWeapon, weaponDefense, wearWeapon } from './equipment';
import { ITEMS } from '../data/items';
import { isMonotone, MONOTONY_MORALE, rotFactor, SCURVY_DAYS, SCURVY_HP } from './diet';
import { applyBiteLaw, desert, handleStrangers, killSurvivor } from './lifecycle';
import { addStock, alert, baseStats, latrineShortfall, log, newId, present, siteById, take } from './state';
import { hasTrait, makeSurvivor, skill } from './survivors';
import type { GameState, Site, Survivor, Weather } from './types';
import { densityMult, effectiveDanger } from './zombies';
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
    plot.growth = Math.min(1, plot.growth + ((0.3 + 0.7 * care) / CROPS[plot.crop].days) * cold);
    if (s.weather.storm && room.outdoor) plot.growth = Math.max(0, plot.growth - 0.15);
    plot.tendedToday = 0;
    if (before < 1 && plot.growth >= 1) log(s, `${site.name}: ${CROPS[plot.crop].label} đã chín.`, 'good');
  }

  // Spoilage. Heat speeds everything up.
  const hot = s.weather.hot ? 1.5 : 1;
  site.stock.meals *= s.weather.hot ? 0.4 : 0.6;
  site.stock.rawFood *= 1 - (st.storage ? 0.005 : 0.02) * hot;
  // Catalogued food (MRE, tins, dried goods) rots per item; a locked store halves it too.
  const cellarMul = rotFactor(st.cellar, st.storage);
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
    for (const k of ['food', 'rawFood', 'water', 'medicine', 'fuel'] as const) take(site, k, site.stock[k] * UNGUARDED_LOSS);
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
  // Thiếu rau quả lâu ngày: scorbut (thiếu vitamin C) — HP tụt dần cho tới khi ăn rau.
  const noVegDays = day - (site.lastVegDay ?? 1);
  if (noVegDays > SCURVY_DAYS) {
    for (const v of home) v.hp = Math.max(1, v.hp - SCURVY_HP);
    if (noVegDays === SCURVY_DAYS + 1) alert(s, `${site.name}: cả điểm đã ${noVegDays} ngày không có rau quả — thiếu vitamin C, mọi người yếu dần.`, 'bad');
  }

  updateMorale(s, site, home, st.beds, st.recRoom);

  // Máy phát điện: đốt 24 L (2 L/h × 12 h đêm) để đêm hôm đó không còn ×0.75 tăng thêm ở tasks.workMult.
  // Nguồn điện cho ban đêm: pin mặt trời + ắc quy chạy im, không tốn xăng.
  // Một tấm pin sạc được một ắc quy mỗi ngày; bão thì không sạc được.
  const solar = (site.stock.solar_panel ?? 0) >= 1 && (site.stock.battery ?? 0) >= 1 && !s.weather.storm;
  if (solar) {
    site.powered = true;
    log(s, `${site.name}: pin mặt trời nạp ắc quy, đêm có điện.`, 'good');
  } else if (st.generator && site.stock.fuel >= 24) {
    take(site, 'fuel', 24);
    site.powered = true;
    site.heat = Math.min(100, site.heat + 6);
    log(s, `${site.name}: máy phát chạy đêm, tiêu 24 L xăng.`, 'info');
  } else {
    site.powered = false;
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
      if (r.module === 'shelter' && chance(s.rng, 0.5)) {
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

function updateMorale(s: GameState, site: Site, home: Survivor[], beds: number, rec: boolean): void {
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
      (rec ? 8 : 0) +
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
  const st = baseStats(s, site);
  const danger = effectiveDanger(s, world, site.cell);
  const horde = day <= s.hordeUntilDay;
  const home = s.survivors.filter((v) => v.status === 'alive' && v.siteId === site.id && v.location === 'base');
  if (!home.length) return;
  // Calibrated so 2 guards + fortify L1 hold early nights, and late game needs real walls.
  const raw =
    (8 + 1.5 * day ** 0.75) *
    (danger / 3) *
    (densityMult(day, horde, s.weather.tempC) / 1.5) *
    (1 + site.heat / 100) *
    (0.6 + 0.4 * Math.min(1, home.length / 10)) *
    range(s.rng, 0.7, 1.3);
  // Traps thin the wave first, but can never stop more than 70% of it.
  const strength = Math.max(raw * 0.3, raw - structureEffects(site.interior.structures).spikes);
  const guards = home.filter((v) => v.task?.kind === 'guard');
  // Better weapons make every guard matter more; a gun also makes noise.
  const weapon = bestWeapon(site);
  const wDef = weaponDefense(weapon);
  let defense = st.defenseStatic;
  for (const g of guards) {
    defense += (8 + 2 * skill(g, 'melee') + wDef) * (1 - g.fatigue / 200) * (hasTrait(g, 'brave') ? 1.25 : 1) * (s.laws.curfew ? 1.2 : 1);
  }
  if (weapon && guards.length) {
    const w = wearWeapon(s, site, weapon, 1);
    if (w.broke) log(s, `${site.name}: ${describeWeapon(weapon)} gãy trong đêm.`, 'warn');
  }
  defense += (home.length - guards.length) * 1.5;
  if (guards.length || st.watchtowers) defense *= 1.15;

  site.corpses += Math.round(Math.min(strength, defense) / 12);
  site.heat = Math.min(100, site.heat + 5);
  const vs = `sức ${Math.round(strength)} vs phòng thủ ${Math.round(defense)}`;
  if (defense >= strength) {
    s.stats.raidsRepelled++;
    for (const g of guards) if (chance(s.rng, 0.25)) g.hp -= range(s.rng, 3, 12);
    alert(s, `${site.name}: đẩy lùi một đợt tập kích đêm (${vs}).`, 'good');
    return;
  }
  s.stats.raidsLost++;
  const ratio = (strength - defense) / strength;
  site.fortify.hp = Math.max(0, site.fortify.hp - ratio * 60);
  site.fence.hp = Math.max(0, site.fence.hp - ratio * 80);
  // A lost raid also tears down outdoor works: walls, barricades, traps, stands.
  const structKeys = Object.keys(site.interior.structures ?? {});
  const frac = structKeys.length * ratio;
  const brokenStructs = Math.floor(frac) + (chance(s.rng, frac % 1) ? 1 : 0);
  if (brokenStructs > 0) {
    const order = [...structKeys].sort(() => range(s.rng, -1, 1));
    for (const c of order.slice(0, brokenStructs)) delete site.interior.structures![Number(c)];
  }
  const hurt = Math.max(1, Math.ceil(ratio * home.length * 0.4));
  const shuffled = [...home].sort(() => range(s.rng, -1, 1));
  // Armour turns a mauling into bruises: less HP lost, fewer bites get through.
  const armour = armorMitigation(site);
  for (const v of shuffled.slice(0, hurt)) {
    v.hp -= range(s.rng, 10, 40) * (1 - armour);
    if (chance(s.rng, 0.2 * (1 - armour))) {
      v.bitten = true;
      v.biteKnown = true;
      if (chance(s.rng, 0.65)) v.infected = true;
    }
  }
  const loss = ratio * (st.storage ? 0.08 : 0.25);
  for (const k of ['food', 'rawFood', 'meals', 'water', 'medicine'] as const) take(site, k, site.stock[k] * loss);
  alert(
    s,
    `${site.name}: zombie phá vào! (${vs}) ${hurt} người bị thương, mất ${Math.round(loss * 100)}% vật tư${brokenStructs ? `, ${brokenStructs} ô công trình bị phá` : ''}.`,
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
