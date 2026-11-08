import { push } from '../core/eventQueue';
import { chance, pick } from '../core/rng';
import { HOUR, isNight } from '../core/time';
import { CROPS, ROLES, SKILLS, SLEEP_BED_PER_HOUR, SLEEP_FLOOR_PER_HOUR, TEND_H_PER_M2_DAY, type Intensity, type SkillId } from './data';
import { activeProject, applyBuildWork } from './build';
import { releaseFromQuarantine } from './lifecycle';
import { arrive, commuteIntent } from './commute';
import { addStock, baseStats, log, siteOf, take, type BaseStats } from './state';
import { gainXp, hasTrait, skill, speed } from './survivors';
import type { GameState, Site, Survivor, Task, TaskKind } from './types';

const KCAL_MAX = 2800;
const WATER_MAX = 3200;

export function workMult(s: GameState, v: Survivor, sk?: SkillId): number {
  let m = speed(v, sk);
  if (isNight(s.t)) m *= 0.75; // no electric light
  if (s.laws.noise) m *= 0.85;
  return m;
}

function start(s: GameState, v: Survivor, kind: TaskKind, intensity: Intensity, dur: number, extra: Partial<Task> = {}): void {
  v.task = { kind, intensity, start: s.t, end: s.t + Math.max(30, dur), ...extra };
  push(s.queue, v.task.end, { k: 'task', sid: v.id });
}

export const sleepRate = (inBed: boolean) => (inBed ? SLEEP_BED_PER_HOUR : SLEEP_FLOOR_PER_HOUR);

function addHeat(s: GameState, site: Site, perHour: number, hours: number): void {
  site.heat = Math.min(100, site.heat + perHour * hours * (s.laws.noise ? 0.6 : 1));
}

function xp(s: GameState, v: Survivor, sk: SkillId, hours: number): void {
  if (gainXp(v, sk, 10 * hours)) log(s, `${v.name} lên cấp ${SKILLS[sk]}.`, 'good');
}

/** Apply the outcome of a task that ran from task.start to s.t (may be cut short). */
export function finishTask(s: GameState, v: Survivor): void {
  const task = v.task;
  if (!task) return;
  v.task = null;
  const site = siteOf(s, v);
  const sec = Math.max(0, Math.min(s.t, task.end) - task.start);
  const h = sec / HOUR;
  const f = task.end > task.start ? Math.min(1, sec / (task.end - task.start)) : 1;
  const role = ROLES[v.role].skill;
  switch (task.kind) {
    case 'build': {
      const p = site.projects.find((x) => x.id === task.target);
      if (p) applyBuildWork(s, site, p, sec * workMult(s, v, 'construction'));
      xp(s, v, 'construction', h);
      addHeat(s, site, 0.3, h);
      break;
    }
    case 'cook': {
      const bonus = 1 + 0.08 * skill(v, 'cooking');
      addStock(s, site, { meals: (task.amount ?? 0) * f * bonus });
      if (f < 1) addStock(s, site, { rawFood: (task.amount ?? 0) * (1 - f) });
      xp(s, v, 'cooking', h);
      break;
    }
    case 'boil':
    case 'filter':
      addStock(s, site, { water: (task.amount ?? 0) * f, dirtyWater: (task.amount ?? 0) * (1 - f) });
      xp(s, v, 'crafting', h);
      break;
    case 'draw': {
      const st = baseStats(s, site);
      const amt = Math.max(0, Math.min(task.amount ?? 0, st.waterCapacity - site.stock.dirtyWater) * f);
      addStock(s, site, { dirtyWater: amt });
      site.wellDrawnToday += amt;
      xp(s, v, 'fitness', h);
      break;
    }
    case 'plant': {
      const plot = site.plots[task.target ?? ''];
      if (plot && f >= 0.99) {
        plot.crop = (task.amount ?? 0) > 0 ? 'khoai' : 'rau';
        plot.growth = 0;
        plot.plantedDay = Math.floor(s.t / 86400) + 1;
        log(s, `${v.name} gieo ${CROPS[plot.crop].label} ở ${site.name}.`);
      } else {
        addStock(s, site, { seeds: 1 });
      }
      xp(s, v, 'farming', h);
      break;
    }
    case 'tend': {
      const plot = site.plots[task.target ?? ''];
      if (plot) plot.tendedToday += h * workMult(s, v, 'farming');
      xp(s, v, 'farming', h);
      break;
    }
    case 'harvest': {
      const plot = site.plots[task.target ?? ''];
      if (plot?.crop && f >= 0.99) {
        const room = site.interior.rooms.find((r) => r.id === plot.roomId);
        const kcal = CROPS[plot.crop].kcalPerM2 * (room?.area ?? 0);
        const seeds = Math.max(1, Math.round((room?.area ?? 0) / 100));
        addStock(s, site, { rawFood: kcal, seeds });
        s.stats.harvestedKcal += kcal;
        log(s, `${site.name}: thu hoạch ${CROPS[plot.crop].label} +${Math.round(kcal).toLocaleString('vi')} kcal (giữ lại ngọn/dây để trồng tiếp).`, 'good', {
          rawFood: kcal,
          seeds,
        });
        plot.crop = null;
        plot.growth = 0;
      }
      xp(s, v, 'farming', h);
      break;
    }
    case 'guard':
      xp(s, v, 'melee', h * 0.3);
      break;
    case 'commute':
      if (f >= 0.99 && task.target) arrive(s, v, task.target, sec);
      break;
    case 'treat': {
      const p = s.survivors.find((x) => x.id === task.target);
      if (p && p.status === 'alive' && f >= 0.99) {
        if (task.amount === 1 && p.sickDays > 0 && chance(s.rng, 0.7)) {
          p.sickDays = 0;
          log(s, `${v.name} chữa khỏi bệnh cho ${p.name}.`, 'good');
        }
        if (task.amount === 2) p.hp = Math.min(100, p.hp + 15 * workMult(s, v, 'medical'));
        p.treatedToday = true;
      }
      xp(s, v, 'medical', h);
      break;
    }
    case 'clean':
      site.filth = Math.max(0, site.filth - 10 * h * workMult(s, v, 'fitness'));
      xp(s, v, 'fitness', h * 0.5);
      break;
    case 'corpses': {
      const n = Math.min(site.corpses, (task.amount ?? 0) * f);
      site.corpses = Math.max(0, site.corpses - n);
      xp(s, v, 'fitness', h * 0.5);
      break;
    }
    case 'gather': {
      const m = workMult(s, v, 'fitness') * h;
      const fromBase = site.salvageLeft.wood > 0;
      const k = fromBase ? 1 : 0.5;
      const wood = Math.min(fromBase ? site.salvageLeft.wood : Infinity, 4 * m * k);
      const scrapLeft = site.salvageLeft.scrap > 0;
      const scrap = scrapLeft ? Math.min(site.salvageLeft.scrap, 1.2 * m) : 0.6 * m;
      if (fromBase) site.salvageLeft.wood -= wood;
      if (scrapLeft) site.salvageLeft.scrap = Math.max(0, site.salvageLeft.scrap - scrap);
      addStock(s, site, { wood, scrap });
      addHeat(s, site, fromBase ? 0.8 : 1.4, h);
      xp(s, v, 'fitness', h);
      break;
    }
    case 'read':
      if (f >= 0.99) {
        const sk = pick(s.rng, Object.keys(SKILLS) as SkillId[]);
        if (gainXp(v, sk, 30 * h)) log(s, `${v.name} đọc sách, lên cấp ${SKILLS[sk]}.`, 'good');
      }
      v.morale = Math.min(100, v.morale + 1 * h);
      break;
    case 'leisure':
      v.morale = Math.min(100, v.morale + (baseStats(s, site).recRoom ? 3 : 1.5) * h);
      break;
    default:
      if (role && task.kind !== 'sleep' && task.kind !== 'eat' && task.kind !== 'drink') xp(s, v, role, h * 0.2);
  }
}

/** Interrupt the current task, applying partial progress. */
export function interrupt(s: GameState, v: Survivor): void {
  if (v.task && v.task.kind !== 'expedition') finishTask(s, v);
}

function eat(s: GameState, v: Survivor, site: Site, st: BaseStats): boolean {
  let portion = 1000;
  if (s.laws.rations === 'reduced') portion = 750;
  if (s.laws.rations === 'work' && (v.role === 'idle' || v.task?.kind === 'leisure')) portion = 700;
  let got = take(site, 'meals', portion);
  got += take(site, 'food', portion - got);
  if (got < portion * 0.5 && site.stock.rawFood > 0) {
    // Raw rice/potato without a kitchen: half the energy, upset stomach risk.
    const raw = take(site, 'rawFood', (portion - got) * 2);
    got += raw * 0.5;
    if (!st.kitchen && chance(s.rng, 0.03)) v.sickDays = Math.max(v.sickDays, 2);
  }
  if (got <= 0) return false;
  v.kcal = Math.min(KCAL_MAX, v.kcal + got);
  start(s, v, 'eat', 'rest', 900);
  return true;
}

function drink(s: GameState, v: Survivor, site: Site): boolean {
  let got = take(site, 'water', 0.75) * 1000;
  if (got < 300 && site.stock.dirtyWater > 0) {
    got += take(site, 'dirtyWater', 0.75) * 1000;
    if (chance(s.rng, hasTrait(v, 'hardy') ? 0.07 : 0.12)) {
      v.sickDays = Math.max(v.sickDays, 3);
      log(s, `${v.name} uống nước bẩn và đổ bệnh.`, 'warn');
    }
  }
  if (got <= 0) return false;
  v.water = Math.min(WATER_MAX, v.water + got);
  start(s, v, 'drink', 'rest', 60);
  return true;
}

function sleep(s: GameState, v: Survivor, site: Site, st: BaseStats): void {
  const inBedCount = s.survivors.filter((x) => x.siteId === site.id && x.task?.kind === 'sleep' && x.task.inBed).length;
  const inBed = inBedCount < st.beds;
  const hours = v.fatigue / sleepRate(inBed) + 0.25;
  start(s, v, 'sleep', 'sleep', Math.max(1, hours) * HOUR, { inBed });
}

function roleTask(s: GameState, v: Survivor, site: Site, st: BaseStats, night: boolean): boolean {
  const pop = Math.max(1, st.population);
  const stock = site.stock;
  switch (v.role) {
    case 'builder': {
      const p = activeProject(site);
      if (!p) {
        // Unpaid projects are usually waiting on wood/scrap: go get some.
        if (site.projects.length && !night) {
          start(s, v, 'gather', 'heavy', HOUR);
          return true;
        }
        return false;
      }
      start(s, v, 'build', 'moderate', HOUR, { target: p.id });
      return true;
    }
    case 'cook': {
      if (st.kitchen && stock.rawFood >= 300 && stock.wood >= 0.5 && stock.meals < pop * 2200) {
        const amount = take(site, 'rawFood', 3000 * workMult(s, v, 'cooking'));
        take(site, 'wood', 0.5);
        start(s, v, 'cook', 'light', 1500, { amount });
        return true;
      }
      return waterWork(s, v, site, st, pop);
    }
    case 'water':
      return waterWork(s, v, site, st, pop);
    case 'farmer': {
      for (const plot of Object.values(site.plots)) {
        const room = site.interior.rooms.find((r) => r.id === plot.roomId);
        if (!room) continue;
        if (plot.crop && plot.growth >= 1) {
          start(s, v, 'harvest', 'moderate', (room.area * 30) / workMult(s, v, 'farming'), { target: plot.roomId });
          return true;
        }
        if (!plot.crop && stock.seeds >= 1 && !night) {
          take(site, 'seeds', 1);
          // Same kcal/m²/day either way: fast greens when hungry, storable potato otherwise.
          const hungry = stock.food + stock.rawFood + stock.meals < pop * 2250 * 30;
          start(s, v, 'plant', 'light', (room.area * 40) / workMult(s, v, 'farming'), {
            target: plot.roomId,
            amount: hungry ? 0 : 1,
          });
          return true;
        }
        if (plot.crop && plot.tendedToday < room.area * TEND_H_PER_M2_DAY && !night) {
          start(s, v, 'tend', 'moderate', HOUR, { target: plot.roomId });
          return true;
        }
      }
      return false;
    }
    case 'guard':
      if (!night) return false;
      start(s, v, 'guard', 'rest', HOUR);
      return true;
    case 'medic': {
      const patients = s.survivors.filter(
        (p) => p.status === 'alive' && p.siteId === site.id && p.location !== 'expedition' && !p.treatedToday,
      );
      const sick = patients.find((p) => p.sickDays > 0 && stock.medicine >= 1);
      if (sick) {
        take(site, 'medicine', 1);
        start(s, v, 'treat', 'light', 1800, { target: sick.id, amount: 1 });
        return true;
      }
      const hurt = patients.find((p) => p.hp < 70 && stock.bandage >= 1);
      if (hurt) {
        take(site, 'bandage', 1);
        start(s, v, 'treat', 'light', 1800, { target: hurt.id, amount: 2 });
        return true;
      }
      return false;
    }
    case 'sanitation': {
      if (site.corpses >= 0.5) {
        const burn = s.laws.corpses === 'burn';
        let n = Math.min(site.corpses, burn ? 3 : 1.5);
        if (burn) n = Math.min(n, stock.wood);
        if (n >= 0.5) {
          if (burn) take(site, 'wood', n);
          start(s, v, 'corpses', 'heavy', HOUR, { amount: n });
          return true;
        }
      }
      if (site.filth > 3) {
        start(s, v, 'clean', 'moderate', HOUR);
        return true;
      }
      return false;
    }
    case 'gatherer':
      if (night) return false; // sawing at night carries far and draws raids
      start(s, v, 'gather', 'heavy', HOUR);
      return true;
    default:
      return false;
  }
}

function waterWork(s: GameState, v: Survivor, site: Site, st: BaseStats, pop: number): boolean {
  const stock = site.stock;
  if (stock.water < pop * 8 && stock.dirtyWater >= 2) {
    if (st.filter) {
      const amount = take(site, 'dirtyWater', 12 * workMult(s, v, 'crafting'));
      start(s, v, 'filter', 'light', HOUR, { amount });
      return true;
    }
    if (st.kitchen && stock.wood >= 1) {
      const amount = take(site, 'dirtyWater', 8 * workMult(s, v, 'crafting'));
      take(site, 'wood', 1);
      start(s, v, 'boil', 'light', HOUR, { amount });
      return true;
    }
  }
  if (st.well && stock.dirtyWater < st.waterCapacity - 50 && site.wellDrawnToday < 1500) {
    start(s, v, 'draw', 'moderate', HOUR, { amount: 120 * workMult(s, v, 'fitness') });
    return true;
  }
  return false;
}

/** Utility-style decision: urgent needs → sleep schedule → role work → fallback. */
export function chooseTask(s: GameState, v: Survivor): void {
  if (v.status !== 'alive') return;
  const site = siteOf(s, v);
  if (v.location === 'quarantine') {
    if (v.quarantineUntil !== undefined && s.t >= v.quarantineUntil) releaseFromQuarantine(s, v);
  }
  if (v.location === 'quarantine' && v.status === 'alive') {
    const until = Math.min(v.quarantineUntil ?? s.t + 6 * HOUR, s.t + 6 * HOUR);
    if (v.water < 1300) drink(s, v, site);
    if (v.kcal < 1100) eat(s, v, site, baseStats(s, site));
    start(s, v, 'quarantine', 'rest', until - s.t);
    return;
  }
  if (v.location !== 'base' || v.status !== 'alive') return;
  const st = baseStats(s, site);
  const night = isNight(s.t);
  if (v.water < 1300 && drink(s, v, site)) return;
  if (v.kcal < 1100 && eat(s, v, site, st)) return;
  if (v.sickDays > 0 && v.role !== 'medic') {
    start(s, v, 'rest', 'rest', 2 * HOUR);
    return;
  }
  const dest = commuteIntent(s, v);
  if (dest && v.commute) {
    start(s, v, 'commute', 'moderate', v.commute.sec, { target: dest });
    return;
  }
  const guard = v.role === 'guard';
  if (v.fatigue > 88 || (!guard && night && v.fatigue > 25) || (guard && !night && v.fatigue > 35)) {
    sleep(s, v, site, st);
    return;
  }
  if (roleTask(s, v, site, st, night)) return;
  const p = activeProject(site);
  if (p && v.role !== 'guard' && !night) {
    start(s, v, 'build', 'moderate', HOUR, { target: p.id });
    return;
  }
  if (site.stock.books >= 1 && chance(s.rng, 0.4)) {
    start(s, v, 'read', 'rest', HOUR);
    return;
  }
  start(s, v, 'leisure', 'rest', HOUR);
}
