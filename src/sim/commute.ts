import { chance, range } from '../core/rng';
import { dayOf, HOUR, isNight, MIN, timeOfDay } from '../core/time';
import { gridDistance } from 'h3-js';
import { shortestPath } from '../world/graph';
import type { World } from '../world/types';
import { ZOMBIES } from './data';
import { killShare } from './combat';
import { MITIGATION_CAP, armorMitigation, describeWeapon, wearWeapon } from './equipment';
import { survivorWeapon } from './gear';
import { killSurvivor, noteBite } from './lifecycle';
import { log, siteById } from './state';
import { gainXp, hasTrait, skill } from './survivors';
import type { GameState, Survivor } from './types';
import { densityMult, effectiveDanger, encounterRate, poisson, zombieType } from './zombies';

const WALK = 1.35 / 1.3; // m/s including friction
const LEAVE_FROM = 6.5 * HOUR;
const LEAVE_UNTIL = 14 * HOUR;
const HEAD_HOME = 17 * HOUR;

/** Assign someone to sleep at home and work at another site by day (or stop: work = null). */
export function setCommute(s: GameState, world: World, sid: string, work: string | null): string | null {
  const v = s.survivors.find((x) => x.id === sid);
  if (!v || v.status !== 'alive') return 'Không có người này';
  const home = v.commute?.home ?? v.siteId;
  if (!work || work === home) {
    if (v.commute) v.commute.work = null; // walks home on the next decision if away
    if (!v.commute || v.siteId === home) v.commute = undefined;
    return null;
  }
  const a = siteById(s, home);
  const b = siteById(s, work);
  const { length } = shortestPath(world.graph, a.node, b.node);
  if (!isFinite(length)) return 'Không có đường đi';
  v.commute = {
    home,
    work,
    sec: (length + 30) / WALK,
    danger: (effectiveDanger(s, world, a.cell) + effectiveDanger(s, world, b.cell)) / 2,
  };
  if (b.kind === 'field') v.role = 'farmer';
  log(s, `${v.name} sẽ đi làm ở ${b.name} ban ngày, tối về ${a.name} (${Math.round(v.commute.sec / MIN)} phút mỗi lượt).`);
  return null;
}

/** Bầy đang ở sát điểm này chưa (trong 2 ô)? Người đi làm phải quay về. */
export function hordeNear(s: GameState, siteId: string): boolean {
  if (!s.hordes?.length) return false;
  const cell = siteById(s, siteId).cell;
  return s.hordes.some((h) => gridDistance(h.cell, cell) <= 2);
}

/** Destination if the person should set off now, else null. */
export function commuteIntent(s: GameState, v: Survivor): string | null {
  const c = v.commute;
  if (!c || v.location !== 'base') return null;
  const tod = timeOfDay(s.t);
  // Bầy tới gần: ở ngoài đường một mình lúc này là chết. Về nhà, không cần đợi 17h.
  if (v.siteId !== c.home && hordeNear(s, c.home)) return c.home;
  if (v.siteId === c.home && hordeNear(s, c.home)) return null;
  if (v.siteId === c.home) {
    if (!c.work) {
      v.commute = undefined;
      return null;
    }
    const goodTime = tod >= LEAVE_FROM && tod < LEAVE_UNTIL && !s.weather.storm && v.fatigue < 50 && v.sickDays === 0;
    return goodTime ? c.work : null;
  }
  return !c.work || tod >= HEAD_HOME || isNight(s.t) ? c.home : null;
}

/** One person walking alone: same encounter model as expeditions, no group help. */
export function arrive(s: GameState, v: Survivor, dest: string, sec: number): void {
  const c = v.commute;
  if (!c) return;
  const day = dayOf(s.t);
  const night = isNight(s.t);
  const rate = encounterRate({
    danger: c.danger,
    density: densityMult(day, day <= s.hordeUntilDay, s.weather.tempC),
    heat: 0,
    night,
    members: 1,
    mode: 'walk',
    travelling: true,
  });
  const avoid = Math.min(0.9, 0.55 + 0.03 * skill(v, 'stealth') + (hasTrait(v, 'coward') ? 0.05 : 0));
  for (let i = poisson(s.rng, rate * (sec / MIN)); i > 0 && v.status === 'alive'; i--) {
    if (chance(s.rng, avoid)) {
      gainXp(v, 'stealth', 4);
      continue;
    }
    const z = ZOMBIES[zombieType(s.rng, day, night)];
    // Người đi làm cũng có vũ khí và áo giáp như khi đi viễn chinh. Trước đây họ
    // đi tay không: một người được cấp súng vẫn chết y như người không có gì, nên
    // cái chết trên đường đi làm không phải hậu quả của quyết định nào.
    const home = siteById(s, c.home);
    const weapon = survivorWeapon(home, v);
    const share = killShare(home, [v], zombieType(s.rng, day, night));
    gainXp(v, 'melee', 3);
    if (weapon) {
      const w = wearWeapon(s, home, weapon, 1);
      if (w.broke) log(s, `${v.name}: ${describeWeapon(weapon)} gãy trên đường đi làm.`, 'warn');
    }
    if (chance(s.rng, share)) {
      // Hạ được trước khi nó chạm tới.
      gainXp(v, 'melee', 5);
      continue;
    }
    const armour = Math.min(MITIGATION_CAP, armorMitigation(home));
    v.hp -= z.dmg * range(s.rng, 0.5, 1.5) * (1 - armour) * (1 - 0.04 * skill(v, 'melee'));
    gainXp(v, 'melee', 6);
    if (chance(s.rng, z.bite)) noteBite(s, v, chance(s.rng, 0.5));
    if (v.hp <= 0) killSurvivor(s, v, `bị ${z.label} giết trên đường đi làm`);
  }
  if (v.status !== 'alive') return;
  v.siteId = dest;
  if (dest === c.home && !c.work) v.commute = undefined;
}
