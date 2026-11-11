import { push } from '../core/eventQueue';
import { chance, int } from '../core/rng';
import { DAY, dayOf } from '../core/time';
import { stapleKcal } from '../data/staples';
import { forfeitGear, returnGear } from './gear';
import { addSurvivor, alert, log, mainSite, siteById, siteOf, take } from './state';
import type { GameState, Survivor } from './types';
import { researchBonus } from './research';

export function killSurvivor(s: GameState, v: Survivor, cause: string): void {
  if (v.status !== 'alive') return;
  v.status = 'dead';
  v.task = null;
  if (v.location !== 'expedition') siteOf(s, v).corpses += 1;
  // Đồ trên người được đồng đội nhặt lại, trừ khi chết ngoài đường.
  if (v.gear && Object.keys(v.gear).length) {
    const back = v.location === 'expedition' ? forfeitGear(v) : returnGear(siteOf(s, v), v);
    if (back.length) log(s, `${v.name}: nhặt lại ${back.length} món trang bị.`, 'info');
  }
  s.stats.deaths++;
  s.recentDeaths++;
  for (const o of s.survivors) if (o.status === 'alive') o.morale = Math.max(0, o.morale - 8);
  alert(s, `${v.name} đã chết (${cause}).`, 'bad');
  checkGameOver(s);
}

function removeSurvivor(s: GameState, v: Survivor, why: string): void {
  forfeitGear(v); // bỏ đi thì mang theo đồ
  if (v.status !== 'alive') return;
  v.status = 'gone';
  v.task = null;
  alert(s, `${v.name} rời nhóm: ${why}.`, 'warn');
  checkGameOver(s);
}

function checkGameOver(s: GameState): void {
  if (s.survivors.some((v) => v.status === 'alive')) return;
  s.gameOver = true;
  alert(s, `Không còn ai sống sót. Cộng đồng tồn tại ${dayOf(s.t)} ngày.`, 'bad');
}

export function noteBite(s: GameState, v: Survivor, witnessed: boolean): void {
  v.bitten = true;
  // "Sơ cứu" (t_firstaid) hạ tỉ lệ nhiễm sau khi bị cắn 30%.
  if (chance(s.rng, 0.65 * researchBonus(s, 'infection'))) v.infected = true;
  v.biteKnown = witnessed;
  if (witnessed) alert(s, `${v.name} bị cắn!`, 'bad');
}

/** Infection reached 100. Where it happens decides how bad it is. */
export function turnSurvivor(s: GameState, v: Survivor): void {
  if (v.location === 'quarantine') {
    killSurvivor(s, v, 'biến đổi trong phòng cách ly');
    return;
  }
  const around = s.survivors.filter(
    (o) => o !== v && o.status === 'alive' && o.location === v.location && (v.location === 'expedition' || o.siteId === v.siteId),
  );
  alert(s, `${v.name} biến thành zombie ${v.location === 'base' ? 'ngay trong căn cứ' : 'giữa chuyến đi'}!`, 'bad');
  for (const o of around.slice(0, int(s.rng, 1, 2))) {
    o.hp -= int(s.rng, 8, 25);
    if (chance(s.rng, 0.35)) {
      o.bitten = true;
      o.biteKnown = true;
      if (chance(s.rng, 0.65 * researchBonus(s, 'infection'))) o.infected = true;
      alert(s, `${o.name} bị ${v.name} cắn.`, 'bad');
    }
  }
  if (v.location === 'base') {
    const site = siteOf(s, v);
    site.heat = Math.min(100, site.heat + 10);
  }
  killSurvivor(s, v, 'nhiễm trùng');
}

/** Bitten-person policy (law) applied once the bite is known and the person is home. */
export function applyBiteLaw(s: GameState, v: Survivor): void {
  if (!v.biteKnown || v.status !== 'alive' || v.location !== 'base') return;
  switch (s.laws.bitten) {
    case 'quarantine':
      v.task = null;
      v.location = 'quarantine';
      v.quarantineUntil = s.t + 4 * DAY;
      log(s, `${v.name} bị cách ly 4 ngày theo luật.`, 'warn');
      push(s.queue, s.t, { k: 'task', sid: v.id });
      break;
    case 'exile':
      for (const o of s.survivors) if (o.status === 'alive') o.morale = Math.max(0, o.morale - 4);
      removeSurvivor(s, v, 'bị trục xuất vì vết cắn');
      break;
    case 'execute':
      for (const o of s.survivors) if (o !== v && o.status === 'alive') o.morale = Math.max(0, o.morale - 4);
      killSurvivor(s, v, 'bị xử lý vì vết cắn');
      break;
  }
}

export function releaseFromQuarantine(s: GameState, v: Survivor): void {
  if (v.infected) {
    removeSurvivor(s, v, 'phát hiện nhiễm trùng khi cách ly, bị đưa đi');
    return;
  }
  v.location = 'base';
  v.bitten = false;
  v.biteKnown = false;
  v.quarantineUntil = undefined;
  log(s, `${v.name} hết cách ly, khoẻ mạnh.`, 'good');
}

/** New people at the gate or met outside; the Strangers law decides. */
export function handleStrangers(s: GameState, group: Survivor[], where: string, siteId = mainSite(s).id): void {
  const names = group.map((g) => g.name).join(', ');
  // Nhận người là nhận thêm miệng ăn: mọi luật đều phải qua cổng "còn ≥ 18 ngày lương".
  const home = siteById(s, siteId);
  const pop = Math.max(1, s.survivors.filter((v) => v.status === 'alive' && v.siteId === siteId).length);
  const days = (home.stock.food + stapleKcal(home.stock) + home.stock.meals) / (pop * 2250);
  const room = Math.max(0, Math.floor((days - 18) / 2));
  const admitted = group.slice(0, room);

  if (s.laws.strangers === 'reject') {
    for (const o of s.survivors) if (o.status === 'alive') o.morale = Math.max(0, o.morale - 2);
    log(s, `Từ chối ${group.length} người lạ ${where} (${names}).`, 'warn');
    return;
  }
  if (!admitted.length) {
    log(
      s,
      `Không nhận người lạ ${where}: kho còn ${days.toFixed(1)} ngày lương cho ${pop} người (${names}).`,
      'warn',
    );
    return;
  }
  if (s.laws.strangers === 'screen') {
    for (const g of admitted) {
      g.location = 'quarantine';
      g.quarantineUntil = s.t + 2 * DAY;
      addSurvivor(s, g, siteId);
    }
  } else {
    for (const g of admitted) addSurvivor(s, g, siteId);
  }
  s.stats.recruited += admitted.length;
  if (admitted.length < group.length) {
    log(s, `Chỉ nhận ${admitted.length}/${group.length} người lạ ${where} — kho còn ${days.toFixed(1)} ngày lương.`, 'warn');
    for (const o of s.survivors) if (o.status === 'alive') o.morale = Math.max(0, o.morale - 1);
  } else {
    alert(s, `${admitted.length} người mới gia nhập ${where}: ${names}.`, 'good');
  }
}

export function desert(s: GameState, v: Survivor): void {
  take(siteOf(s, v), 'food', 2000);
  removeSurvivor(s, v, 'bỏ trốn vì tuyệt vọng, mang theo ít đồ ăn');
}
