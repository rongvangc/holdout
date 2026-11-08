import { peek, pop } from '../core/eventQueue';
import { dayOf, HOUR } from '../core/time';
import type { World } from '../world/types';
import { payProjects } from './build';
import { dayEvent, raidEvent, strangersEvent } from './daily';
import { FATIGUE_PER_HOUR, INTENSITY, KCAL_PER_HOUR, LAW_COOLDOWN_DAYS, LAW_DEFS, WATER_ML_PER_HOUR, type LawId, type Laws, type Role, type SkillId } from './data';
import { onExpeditionEvent, runRoutes } from './expedition';
import { killSurvivor, turnSurvivor } from './lifecycle';
import { autoAssign, baseStats, log } from './state';
import { hasTrait } from './survivors';
import { chooseTask, finishTask, interrupt, sleepRate } from './tasks';
import type { GameEvent, GameState } from './types';

const INFECTION_PER_HOUR = 100 / (3.5 * 24);

function integrate(s: GameState, dt: number): void {
  if (dt <= 0) return;
  const h = dt / HOUR;
  const hotMult = s.weather.hot ? 1.2 : 1;
  const infirmary = new Set(s.sites.filter((x) => baseStats(s, x).infirmary).map((x) => x.id));
  for (const v of s.survivors) {
    if (v.status !== 'alive') continue;
    const kind = v.task?.kind;
    const I = INTENSITY[v.task?.intensity ?? 'rest'];
    v.kcal -= KCAL_PER_HOUR * I.kcal * h * (hasTrait(v, 'glutton') ? 1.2 : 1) * (v.sickDays > 0 ? 1.15 : 1);
    v.water -= WATER_ML_PER_HOUR * I.water * h * hotMult;
    if (kind === 'sleep') v.fatigue -= sleepRate(!!v.task?.inBed) * h;
    else v.fatigue += FATIGUE_PER_HOUR * I.fatigue * h * (hasTrait(v, 'light_sleeper') ? 0.8 : 1);
    v.fatigue = Math.max(0, Math.min(100, v.fatigue));
    if (v.kcal <= 0) v.hp -= 1.5 * h;
    if (v.water <= 0) v.hp -= 5 * h;
    v.kcal = Math.max(0, v.kcal);
    v.water = Math.max(0, v.water);
    if (v.kcal > 0 && v.water > 0 && v.sickDays === 0 && !v.infected) {
      const resting = kind === 'sleep' || kind === 'rest' || kind === 'quarantine';
      v.hp = Math.min(100, v.hp + (1.5 / 24) * h * (resting && v.location !== 'expedition' && infirmary.has(v.siteId) ? 2.5 : 1));
    }
    if (v.infected) v.infection = Math.min(100, v.infection + INFECTION_PER_HOUR * h);
  }
}

function checkVitals(s: GameState): void {
  for (const v of s.survivors) {
    if (v.status !== 'alive') continue;
    if (v.infected && v.infection >= 100) turnSurvivor(s, v);
    else if (v.hp <= 0) killSurvivor(s, v, v.water <= 0 ? 'mất nước' : v.kcal <= 0 ? 'chết đói' : 'vết thương');
  }
}

function dispatch(s: GameState, world: World, ev: GameEvent, t: number): void {
  switch (ev.k) {
    case 'task': {
      const v = s.survivors.find((x) => x.id === ev.sid);
      if (!v || v.status !== 'alive') return;
      if (v.task && v.task.end > t + 1e-6) return; // superseded by a newer task
      if (v.task) finishTask(s, v);
      chooseTask(s, v);
      return;
    }
    case 'day':
      dayEvent(s, world);
      for (const site of s.sites) payProjects(s, site);
      if (s.autoRoles) autoAssign(s);
      return;
    case 'raid':
      raidEvent(s, world, ev.site);
      return;
    case 'strangers':
      strangersEvent(s);
      return;
    case 'routes':
      runRoutes(s, world);
      return;
    case 'exp':
      onExpeditionEvent(s, world, ev.eid);
  }
}

/** Discrete-event simulation: integrate vitals between events, then process the next one. */
export function advanceTo(s: GameState, world: World, target: number): void {
  let guard = 0;
  while (!s.gameOver) {
    const nx = peek(s.queue);
    const tNext = nx && nx.t <= target ? nx.t : target;
    integrate(s, tNext - s.t);
    s.t = Math.max(s.t, tNext);
    checkVitals(s);
    if (!nx || nx.t > target) break;
    pop(s.queue);
    dispatch(s, world, nx.ev, nx.t);
    if (++guard > 200000) throw new Error('Simulation runaway');
  }
}

export function setStudy(s: GameState, sid: string, sk: SkillId | null): void {
  const v = s.survivors.find((x) => x.id === sid);
  if (!v || v.study === sk) return;
  v.study = sk;
}

export function setRole(s: GameState, sid: string, role: Role): void {
  const v = s.survivors.find((x) => x.id === sid);
  if (!v || v.role === role) return;
  v.role = role;
  if (v.location === 'base' && v.task && v.task.kind !== 'sleep' && v.task.kind !== 'eat' && v.task.kind !== 'drink' && v.task.kind !== 'commute') {
    interrupt(s, v);
    chooseTask(s, v);
  }
}

export function setLaw<K extends LawId>(s: GameState, id: K, value: Laws[K]): string | null {
  const day = dayOf(s.t);
  const last = s.lawChangedDay[id];
  if (last !== undefined && day - last < LAW_COOLDOWN_DAYS) return `Phải chờ ${LAW_COOLDOWN_DAYS - (day - last)} ngày nữa mới đổi được luật này`;
  if (s.laws[id] === value) return null;
  s.laws[id] = value;
  s.lawChangedDay[id] = day;
  const def = LAW_DEFS.find((d) => d.id === id);
  const opt = def?.options.find((o) => o.value === value);
  log(s, `Ban hành luật: ${def?.label ?? String(id)} → ${opt?.label ?? String(value)}.`, 'info');
  return null;
}
