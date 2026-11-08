import { gridDisk } from 'h3-js';
import { push } from '../core/eventQueue';
import { chance, int, pick, range, weighted } from '../core/rng';
import { dayOf, isNight, MIN } from '../core/time';
import { CATS } from '../data/categories';
import { ITEMS, stockWeight, type ItemId, type Stock } from '../data/items';
import { shortestPath } from '../world/graph';
import type { World } from '../world/types';
import { ZOMBIES } from './data';
import { describeWeapon, wearWeapon } from './equipment';
import { contactOf, killShare } from './combat';
import { bestArmed, packCapacity } from './gear';
import { applyFoodFx } from './diet';
import { bleedOf, PART_LABEL, rollWound } from './medical';
import { applyBiteLaw, handleStrangers, killSurvivor, noteBite } from './lifecycle';
import { addStock, alert, baseStats, log, makeSite, newId, siteById, siteOfSource, take } from './state';
import { gainXp, hasTrait, makeSurvivor, skill } from './survivors';
import { interrupt } from './tasks';
import type { Expedition, GameState, Site, StockDelta, Survivor } from './types';
import { densityMult, effectiveDanger, encounterRate, lootFactor, meanBite, poisson, zombieType } from './zombies';

export type Mode = Expedition['mode'];

const SPEED: Record<Mode, number> = { walk: 1.35, sneak: 0.7, car: 11 };
const FRICTION: Record<Mode, number> = { walk: 1.3, sneak: 1.35, car: 1.6 };
const NOISE_HEAT: Record<Mode, number> = { walk: 0.3, sneak: 0.05, car: 6 };
const FUEL_L_PER_KM = 0.1;
const CONTAINER_SEC = 120;
const CLAIM_LOOT_CAP = 60;

export interface TargetRef {
  type: 'building' | 'water' | 'green' | 'site';
  id: string;
}

export interface ExpeditionOrder {
  fromSite: string;
  members: string[];
  target: TargetRef;
  mode: Mode;
  containers?: number;
  cargo?: StockDelta; // supplies carried out (convoy, or starter kit for a claim)
  relocate?: boolean; // convoy: members move to the destination
  claim?: boolean; // building target: take it as an outpost instead of looting
  patrol?: boolean; // sweep the target's area to thin out zombies
}

export interface ExpeditionPlan {
  ok: boolean;
  reason?: string;
  kind?: Expedition['kind'];
  target?: Expedition['target'];
  pathLen: number;
  travelSec: number;
  searchSec: number;
  totalSec: number;
  oneWay: boolean;
  fuelL: number;
  containers: number;
  remaining: number;
  capacityKg: number;
  cargoKg: number;
  expectedEncounters: number;
  expectedFights: number;
  biteRisk: number;
  avoidChance: number;
}

const cellDanger = (s: GameState, world: World, cell: string) => effectiveDanger(s, world, cell);
const PATROL_SEC = 2 * 3600;

/** What kind of trip a target implies from the player's point of view. */
export function kindFor(s: GameState, ref: TargetRef, claim = false, patrol = false): Expedition['kind'] {
  if (ref.type === 'water') return 'water';
  if (patrol) return 'patrol';
  if (ref.type === 'site') return 'convoy';
  if (ref.type === 'green') return siteOfSource(s, ref.id) ? 'convoy' : 'claim';
  return siteOfSource(s, ref.id) ? 'convoy' : claim ? 'claim' : 'loot';
}

function resolveTarget(s: GameState, world: World, ref: TargetRef): Expedition['target'] | null {
  // Owned buildings / fields are addressed as sites.
  const owned = ref.type === 'site' ? siteById(s, ref.id) : ref.type !== 'water' ? siteOfSource(s, ref.id) : undefined;
  if (owned) return { type: 'site', id: owned.id, name: owned.name, cell: owned.cell, node: owned.node, danger: cellDanger(s, world, owned.cell) };
  if (ref.type === 'building') {
    const b = world.buildings.find((x) => x.id === ref.id);
    if (!b) return null;
    return { type: 'building', id: b.id, name: b.name ?? CATS[b.cat].label, cell: b.cell, node: b.node, danger: cellDanger(s, world, b.cell) * CATS[b.cat].danger };
  }
  if (ref.type === 'green') {
    const g = (world.greens ?? []).find((x) => x.id === ref.id);
    if (!g) return null;
    return { type: 'green', id: g.id, name: g.name ?? 'Bãi đất', cell: g.cell, node: g.node, danger: cellDanger(s, world, g.cell) };
  }
  const w = world.waterPoints.find((x) => x.id === ref.id);
  if (!w) return null;
  return { type: 'water', id: w.id, name: w.name ?? 'Sông/hồ', cell: '', node: w.node, danger: 2 };
}

const avoidChance = (members: Survivor[], mode: Mode) =>
  Math.min(
    0.9,
    0.55 + 0.03 * Math.max(0, ...members.map((m) => skill(m, 'stealth'))) + (mode === 'sneak' ? 0.1 : 0) +
      (members.some((m) => hasTrait(m, 'coward')) ? 0.05 : 0),
  );

/** Clearing a place to hold it: zombies inside, no way to sneak past them. */
function clearSec(world: World, t: Expedition['target'], n: number): number {
  if (t.type === 'green') {
    const g = world.greens.find((x) => x.id === t.id)!;
    return (300 + Math.sqrt(g.area) * 10) / Math.sqrt(n);
  }
  const b = world.buildings.find((x) => x.id === t.id)!;
  return (600 + Math.sqrt(b.area * Math.min(b.levels, 6)) * 25) / Math.sqrt(n);
}

function searchRates(kind: Expedition['kind']) {
  if (kind === 'claim') return { rate: 2, avoid: 0.5 };
  if (kind === 'patrol') return { rate: 1.6, avoid: 0.3 }; // seeking fights on purpose
  return { rate: 1, avoid: 1 };
}

/** The design's preview(): exact time, risk and fuel before the player commits. */
export function planExpedition(s: GameState, world: World, o: ExpeditionOrder): ExpeditionPlan {
  const members = s.survivors.filter((v) => o.members.includes(v.id));
  const from = siteById(s, o.fromSite);
  const kind = kindFor(s, o.target, o.claim, o.patrol);
  const none: ExpeditionPlan = {
    ok: false,
    kind,
    pathLen: 0,
    travelSec: 0,
    searchSec: 0,
    totalSec: 0,
    oneWay: false,
    fuelL: 0,
    containers: 0,
    remaining: 0,
    capacityKg: 0,
    cargoKg: 0,
    expectedEncounters: 0,
    expectedFights: 0,
    biteRisk: 0,
    avoidChance: 0,
  };
  const target = resolveTarget(s, world, o.target);
  if (!target) return { ...none, reason: 'Chưa chọn mục tiêu' };
  if (target.type === 'site' && target.id === from.id && kind !== 'patrol') return { ...none, target, reason: 'Đây là điểm xuất phát' };
  const b = target.type === 'building' ? world.buildings.find((x) => x.id === target.id)! : null;
  const remaining = b ? Math.max(0, b.containers - (s.looted[b.id] ?? 0)) : 0;
  if (!members.length) return { ...none, target, remaining, reason: 'Chưa chọn người' };
  if (members.some((m) => m.status !== 'alive' || m.location !== 'base' || m.siteId !== from.id || m.task?.kind === 'commute'))
    return { ...none, target, remaining, reason: `Có người không ở ${from.name}` };
  const { length } = shortestPath(world.graph, from.node, target.node);
  if (!isFinite(length)) return { ...none, target, remaining, reason: 'Không có đường tới đó' };

  const pathLen = length + 30;
  const travelSec = (pathLen * FRICTION[o.mode]) / SPEED[o.mode];
  const bestScav = Math.max(...members.map((m) => skill(m, 'scavenging')));
  const night = isNight(s.t);
  const nCont = kind === 'loot' ? Math.max(0, Math.min(o.containers ?? 0, remaining)) : 0;
  const searchSec =
    kind === 'loot'
      ? (nCont * CONTAINER_SEC * (1 - 0.04 * bestScav) * (night ? 1.35 : 1)) / members.length
      : kind === 'water'
        ? 10 * MIN + members.length * 2 * MIN
        : kind === 'claim'
          ? clearSec(world, target, members.length)
          : kind === 'patrol'
            ? PATROL_SEC
            : 10 * MIN;
  const oneWay = kind === 'claim' || (kind === 'convoy' && !!o.relocate);
  const legs = oneWay ? 1 : 2;
  const garageAtFrom = baseStats(s, from).garage;
  const fuelPerKm = o.mode === 'car' && garageAtFrom ? 0.08 : FUEL_L_PER_KM;
  const fuelL = o.mode === 'car' ? ((pathLen * legs) / 1000) * fuelPerKm : 0;
  const capacityKg =
    members.reduce((a, m) => a + 22 + 2 * skill(m, 'fitness') + packCapacity(m), 0) +
    (o.mode === 'car' ? (garageAtFrom ? 330 : 250) : 0);
  const cargoKg = stockWeight(o.cargo ?? {});

  const day = dayOf(s.t);
  const dens = densityMult(day, day <= s.hordeUntilDay, s.weather.tempC);
  const tHeat = s.cellHeat[target.cell] ?? 0;
  const common = { density: dens, night, members: members.length, mode: o.mode };
  const rTravel = encounterRate({ ...common, danger: (cellDanger(s, world, from.cell) + target.danger) / 2, heat: (from.heat + tHeat) / 2, travelling: true });
  const sr = searchRates(kind);
  const rSearch = encounterRate({ ...common, danger: target.danger, heat: tHeat, travelling: false }) * sr.rate;
  const expectedEncounters = rTravel * ((legs * travelSec) / MIN) + (kind === 'convoy' ? 0 : rSearch * (searchSec / MIN));
  const avoid = avoidChance(members, o.mode);
  const expectedFights =
    rTravel * ((legs * travelSec) / MIN) * (1 - avoid) + (kind === 'convoy' ? 0 : rSearch * (searchSec / MIN) * (1 - avoid * sr.avoid));
  const biteRisk = 1 - Math.exp((-expectedFights * meanBite(day)) / Math.sqrt(members.length));

  let reason: string | undefined;
  if (s.weather.storm) reason = 'Đang có bão — không thể ra ngoài';
  else if (s.laws.curfew && night) reason = 'Luật giới nghiêm cấm đi đêm';
  else if (o.mode === 'car' && from.stock.vehicle < 1) reason = `Không có xe ở ${from.name}`;
  else if (o.mode === 'car' && from.stock.fuel < fuelL) reason = `Thiếu xăng (cần ${fuelL.toFixed(1)} L)`;
  else if (kind === 'loot' && nCont === 0) reason = 'Toà nhà đã bị vét sạch';
  else if (cargoKg > capacityKg) reason = `Quá tải: ${Math.round(cargoKg)}/${Math.round(capacityKg)} kg`;
  else if (Object.entries(o.cargo ?? {}).some(([k, v]) => from.stock[k as ItemId] + 1e-6 < (v ?? 0))) reason = 'Kho không đủ hàng';
  else if (kind === 'claim' && b && b.area < 30) reason = 'Toà nhà quá nhỏ';

  return {
    ok: !reason,
    reason,
    kind,
    target,
    pathLen,
    travelSec,
    searchSec,
    totalSec: legs * travelSec + searchSec,
    oneWay,
    fuelL,
    containers: nCont,
    remaining,
    capacityKg,
    cargoKg,
    expectedEncounters,
    expectedFights,
    biteRisk,
    avoidChance: avoid,
  };
}

/** kcal a party needs for a trip of `sec` seconds, with a 30% cushion. */
const rationKcal = (n: number, sec: number) => n * 70 * (sec / 3600) * 1.3;

/**
 * Pack rations for a trip: light travel food first (it is what it is for), then
 * anything edible, then water. Taken from the site stock so the cost is visible.
 */
function packRations(_s: GameState, from: Site, n: number, sec: number): StockDelta {
  const out: StockDelta = {};
  let need = rationKcal(n, sec);
  const takeFood = (id: ItemId) => {
    const kcal = ITEMS[id]?.kcal ?? 0;
    if (kcal <= 0) return;
    const units = Math.min(from.stock[id] ?? 0, Math.ceil(need / kcal));
    const got = take(from, id, units);
    if (got > 0) {
      out[id] = (out[id] ?? 0) + got;
      need -= got * kcal;
    }
  };
  // Travel rations first, then the tastiest things (they would spoil anyway).
  const foods = (Object.entries(ITEMS) as [string, (typeof ITEMS)[string]][])
    .filter(([id, d]) => (d.kcal ?? 0) > 0 && (d.mechanic === 'food') && (from.stock[id] ?? 0) > 0)
    .sort(([, a], [, b]) => Number(!!b.fx?.travel) - Number(!!a.fx?.travel) || (b.kcal ?? 0) - (a.kcal ?? 0));
  for (const [id] of foods) {
    if (need <= 0) break;
    takeFood(id);
  }
  // Legacy calorie buckets, if that is all there is.
  for (const id of ['meals', 'food', 'rawFood'] as ItemId[]) {
    if (need <= 0) break;
    const units = Math.min(from.stock[id] ?? 0, Math.ceil(need));
    const got = take(from, id, units);
    if (got > 0) {
      out[id] = (out[id] ?? 0) + got;
      need -= got;
    }
  }
  const water = take(from, 'water', Math.min(from.stock.water, n * 3 * (sec / 86400) + 1));
  if (water > 0) out.water = water;
  return out;
}

/** Feed one member from the party's rations. Returns kcal actually eaten. */
export function feedOnRoad(_s: GameState, e: Expedition, v: Survivor, deficit: number): number {
  const r = e.rations ?? {};
  let got = 0;
  let morale = 0;
  let fx: import('../data/items').FoodFx | undefined;
  const ids = Object.keys(r).filter((id) => id !== 'water' && (r[id] ?? 0) > 0);
  // Eat the tastiest first: a hot dish on the road is worth more than dry rice.
  ids.sort((a, b) => ((ITEMS[b]?.morale ?? 0) - (ITEMS[a]?.morale ?? 0)) || ((ITEMS[b]?.kcal ?? 0) - (ITEMS[a]?.kcal ?? 0)));
  for (const id of ids) {
    if (got >= deficit) break;
    const def = ITEMS[id];
    const per = def?.kcal ?? 0;
    if (per <= 0) continue;
    const want = Math.min(r[id] ?? 0, Math.ceil((deficit - got) / per));
    const used = takeStock(r, id, want);
    if (used <= 0) continue;
    got += used * per;
    morale += used * (def?.morale ?? 0);
    if (def?.fx) {
      fx ??= {};
      for (const k of ['heal', 'fatigue', 'water', 'cureDays'] as const) {
        const val = def.fx[k];
        if (typeof val === 'number') fx[k] = (fx[k] ?? 0) + val * used;
      }
      if (def.fx.vitamin) fx.vitamin = true;
    }
  }
  if (got > 0) {
    v.kcal += got;
    if (morale) v.morale = Math.min(100, v.morale + Math.min(12, morale));
    applyFoodFx(v, fx);
    const w = takeStock(r, 'water', Math.min((r.water ?? 0), 0.75));
    if (w > 0) v.water = Math.min(3200, v.water + w * 1000);
  }
  return got;
}

/** Local take() over a partial stock record. */
function takeStock(rec: Partial<Stock>, id: string, amount: number): number {
  const have = rec[id] ?? 0;
  const got = Math.max(0, Math.min(have, amount));
  if (got > 0) rec[id] = have - got;
  return got;
}

export function launchExpedition(s: GameState, world: World, o: ExpeditionOrder): string | null {
  const plan = planExpedition(s, world, o);
  if (!plan.ok || !plan.target || !plan.kind) return plan.reason ?? 'Không thể khởi hành';
  const from = siteById(s, o.fromSite);
  if (o.mode === 'car') take(from, 'fuel', plan.fuelL);
  const carried: StockDelta = {};
  for (const [k, v] of Object.entries(o.cargo ?? {})) if (v) carried[k as ItemId] = take(from, k as ItemId, v);
  // Khẩu phần: tự đóng gói từ kho, đủ cho cả chuyến (đi + lục + về) và thêm dự phòng.
  const rations = packRations(s, from, o.members.length, plan.totalSec);
  const exp: Expedition = {
    id: newId(s, 'e'),
    kind: plan.kind,
    fromSite: from.id,
    relocate: plan.oneWay,
    members: [...o.members],
    target: plan.target,
    mode: o.mode,
    plannedContainers: plan.containers,
    phase: 'out',
    phaseStart: s.t,
    pathLen: plan.pathLen,
    travelSec: plan.travelSec,
    searchSec: plan.searchSec,
    carried,
    rations,
    capacityKg: plan.capacityKg,
    report: [],
    recruits: [],
    fights: 0,
    avoided: 0,
  };
  for (const v of members(s, exp)) {
    interrupt(s, v);
    v.location = 'expedition';
    v.task = { kind: 'expedition', intensity: o.mode === 'car' ? 'rest' : 'moderate', start: s.t, end: Number.MAX_SAFE_INTEGER };
  }
  s.expeditions.push(exp);
  s.stats.expeditions++;
  push(s.queue, s.t + exp.travelSec, { k: 'exp', eid: exp.id });
  const verb = { loot: 'lục soát', water: 'lấy nước ở', claim: 'chiếm', convoy: 'vận chuyển tới', patrol: 'đi tuần quanh' }[exp.kind];
  log(s, `Đội ${members(s, exp).map((m) => m.name).join(', ')} rời ${from.name} để ${verb} ${exp.target.name}.`);
  return null;
}

const members = (s: GameState, e: Expedition) =>
  e.members.map((id) => s.survivors.find((v) => v.id === id)!).filter((v) => v && v.status === 'alive');

function resolveEncounters(s: GameState, world: World, e: Expedition, sec: number, travelling: boolean): void {
  const team = members(s, e);
  if (!team.length || sec <= 0) return;
  if (!travelling && e.kind === 'convoy') return;
  const day = dayOf(s.t);
  const night = isNight(s.t);
  const from = siteById(s, e.fromSite);
  const tHeat = s.cellHeat[e.target.cell] ?? 0;
  const sr = travelling ? { rate: 1, avoid: 1 } : searchRates(e.kind);
  const rate =
    encounterRate({
      danger: travelling ? (cellDanger(s, world, from.cell) + e.target.danger) / 2 : e.target.danger,
      density: densityMult(day, day <= s.hordeUntilDay, s.weather.tempC),
      heat: travelling ? (from.heat + tHeat) / 2 : tHeat,
      night,
      members: team.length,
      mode: e.mode,
      travelling,
    }) * sr.rate;
  const n = poisson(s.rng, rate * (sec / MIN));
  const avoid = avoidChance(team, e.mode) * sr.avoid;
  for (let i = 0; i < n; i++) {
    const alive = members(s, e);
    if (!alive.length) return;
    if (chance(s.rng, avoid)) {
      e.avoided++;
      for (const m of alive) gainXp(m, 'stealth', 4);
      continue;
    }
    e.fights++;
    const z = zombieType(s.rng, day, night);
    const def = ZOMBIES[z];
    const armed = bestArmed(from, alive);
    const weapon = armed?.weapon ?? null;
    // Pha 1 — hạ trước khi nó áp sát: vũ khí (dmg) × xuyên giáp của nó.
    const share = killShare(from, alive, z);
    for (const m of alive) gainXp(m, 'melee', 3);
    if (weapon && armed) {
      const w = wearWeapon(s, from, weapon, 1);
      if (w.broke) log(s, `${from.name}: ${describeWeapon(weapon)} của ${armed.owner.name} gãy sau trận.`, 'warn');
    }
    if (weapon?.isFirearm && weapon.noise) {
      // A gunshot at night pulls the whole cell toward you.
      from.heat = Math.min(100, from.heat + weapon.noise);
      if (e.target.cell) s.cellHeat[e.target.cell] = Math.min(100, (s.cellHeat[e.target.cell] ?? 0) + weapon.noise);
    }
    if (e.target.cell) s.cellHeat[e.target.cell] = Math.min(100, (s.cellHeat[e.target.cell] ?? 0) + 2);
    if (chance(s.rng, share)) {
      // Hạ được trước khi nó chạm tới: không sát thương, không bị cắn.
      e.kills = (e.kills ?? 0) + 1;
      for (const m of alive) gainXp(m, 'melee', 3);
      if (chance(s.rng, 0.35)) e.report.push(`Hạ một ${def.label}${armed ? ` bằng ${describeWeapon(weapon)}` : ' bằng tay không'}.`);
      continue;
    }
    // Pha 2 — nó vào được: giáp của chính nạn nhân, bị `bypass` của loại zombie bào mòn.
    const victim = pick(s.rng, alive);
    const meleeAvg = alive.reduce((a, m) => a + skill(m, 'melee'), 0) / alive.length;
    const contact = contactOf(from, victim, z, range(s.rng, 0.5, 1.5) * def.dmg);
    const dmg = (contact.dmg * (1 - 0.04 * meleeAvg) * (alive.some((m) => hasTrait(m, 'brave')) ? 0.8 : 1)) / Math.sqrt(alive.length);
    victim.hp -= dmg;
    if (dmg >= 12 && chance(s.rng, Math.min(0.75, dmg / 40))) {
      const w = rollWound(dmg, (arr) => pick(s.rng, arr));
      victim.bleed = Math.min(3, Math.max(bleedOf(victim), w.bleed));
      victim.woundPart = w.part;
      e.report.push(`${victim.name} bị rách ${PART_LABEL[w.part]} (−${Math.round(dmg)} HP, chảy máu).`);
    }
    for (const m of alive) gainXp(m, 'melee', 3);
    if (e.target.cell) s.cellHeat[e.target.cell] = Math.min(100, (s.cellHeat[e.target.cell] ?? 0) + contact.heat);
    if (chance(s.rng, contact.biteChance / Math.sqrt(alive.length))) {
      const seen = chance(s.rng, 0.7);
      noteBite(s, victim, seen);
      e.report.push(`${victim.name} bị ${def.label} cắn${seen ? '' : ' (không ai thấy)'}.`);
    } else if (dmg > 12) {
      e.report.push(`${victim.name} bị ${def.label} đánh trọng thương (−${Math.round(dmg)} HP).`);
    }
    if (victim.hp <= 0) {
      killSurvivor(s, victim, `bị ${def.label} giết ngoài đường`);
      e.report.push(`${victim.name} đã hi sinh.`);
    }
  }
}

/** Roll loot for n containers of a building. `capKg` limits what fits in bags. */
function rollContainers(s: GameState, world: World, buildingId: string, n: number, scav: number, out: StockDelta, capKg: number): { searched: number; full: boolean; vehicle: boolean } {
  const b = world.buildings.find((x) => x.id === buildingId)!;
  const lf = lootFactor(dayOf(s.t));
  let searched = 0;
  let full = false;
  let vehicle = false;
  for (let i = 0; i < n && !full; i++) {
    searched++;
    const rolls = 1 + (chance(s.rng, 0.35 + 0.03 * scav) ? 1 : 0);
    for (let r = 0; r < rolls; r++) {
      if (!chance(s.rng, 0.35 + 0.65 * lf)) continue;
      const [item, , lo, hi] = weighted(
        s.rng,
        CATS[b.cat].loot.map((e2) => [e2, e2[1]] as const),
      );
      if (item === 'vehicle') {
        if (chance(s.rng, 0.5)) vehicle = true;
        continue;
      }
      const amount = range(s.rng, lo, hi) * (0.5 + 0.5 * lf);
      const room = capKg - stockWeight(out);
      const fit = Math.min(amount, room / Math.max(1e-6, ITEMS[item as ItemId].kgPerUnit));
      if (fit <= 0) {
        full = true;
        break;
      }
      out[item] = (out[item] ?? 0) + fit;
    }
  }
  s.looted[b.id] = (s.looted[b.id] ?? 0) + searched;
  return { searched, full, vehicle };
}

function searchBuilding(s: GameState, world: World, e: Expedition): void {
  const b = world.buildings.find((x) => x.id === e.target.id);
  if (!b) return;
  const team = members(s, e);
  const remaining = Math.max(0, b.containers - (s.looted[b.id] ?? 0));
  const scav = Math.max(0, ...team.map((m) => skill(m, 'scavenging')));
  const r = rollContainers(s, world, b.id, Math.min(e.plannedContainers, remaining), scav, e.carried, e.capacityKg);
  if (r.vehicle && siteById(s, e.fromSite).stock.vehicle < 1) {
    addStock(s, siteById(s, e.fromSite), { vehicle: 1 });
    e.report.push('Tìm được một chiếc xe còn nổ máy!');
  }
  s.cellHeat[e.target.cell] = Math.min(100, (s.cellHeat[e.target.cell] ?? 0) + r.searched * 0.15 * (e.mode === 'sneak' ? 0.5 : 1));
  for (const m of team) gainXp(m, 'scavenging', (8 * r.searched) / team.length);
  e.report.push(`Lục ${r.searched}/${remaining} chỗ${r.full ? ' (đầy túi)' : ''}.`);
  const residential = b.cat === 'house' || b.cat === 'apartment' || b.cat === 'religious' || b.cat === 'generic';
  if (chance(s.rng, residential ? 0.1 : 0.04)) {
    const k = chance(s.rng, 0.2) ? int(s.rng, 2, 4) : 1;
    for (let i = 0; i < k; i++) {
      const v = makeSurvivor(s.rng, newId(s, 's'), dayOf(s.t));
      if (chance(s.rng, 0.12)) {
        v.bitten = true;
        v.infected = true;
        v.infection = range(s.rng, 5, 50);
      }
      e.recruits.push(v);
    }
    e.report.push(`Gặp ${k} người sống sót trốn trong ${b.name ?? CATS[b.cat].label}.`);
  }
}

/** Members (and anything carried) settle at `site`; their trip ends there. */
function settle(s: GameState, e: Expedition, site: Site, keep = 1): void {
  addStock(s, site, e.carried, keep);
  for (const m of members(s, e)) {
    m.location = 'base';
    m.siteId = site.id;
    m.task = null;
    push(s.queue, s.t, { k: 'task', sid: m.id });
  }
  s.expeditions = s.expeditions.filter((x) => x !== e);
  for (const m of members(s, e)) applyBiteLaw(s, m);
  if (e.recruits.length) handleStrangers(s, e.recruits, `gặp ở ${e.target.name}`, site.id);
}

function finishClaim(s: GameState, world: World, e: Expedition): void {
  const kind = e.target.type === 'green' ? 'field' : 'outpost';
  const site = makeSite(s, world, kind, e.target.id);
  s.sites.push(site);
  const gained: StockDelta = {};
  if (kind === 'outpost') {
    const b = world.buildings.find((x) => x.id === e.target.id)!;
    const remaining = Math.max(0, b.containers - (s.looted[b.id] ?? 0));
    const scav = Math.max(0, ...members(s, e).map((m) => skill(m, 'scavenging')));
    // Holding the building means time to search it all, no bag limit.
    const found: StockDelta = {};
    const r = rollContainers(s, world, b.id, Math.min(remaining, CLAIM_LOOT_CAP), scav, found, Infinity);
    s.looted[b.id] = b.containers;
    addStock(s, site, found);
    if (r.vehicle) addStock(s, site, { vehicle: 1 });
    Object.assign(gained, found);
    if (r.vehicle) gained.vehicle = 1;
    e.report.push(`Lục toàn bộ ${r.searched} chỗ còn lại.`);
  }
  settle(s, e, site);
  alert(s, `Đã chiếm ${site.name} làm ${kind === 'field' ? 'ruộng' : 'tiền đồn'}. ${e.report.join(' ')}`, 'good', gained);
}

export function onExpeditionEvent(s: GameState, world: World, eid: string): void {
  const e = s.expeditions.find((x) => x.id === eid);
  if (!e) return;
  const elapsed = s.t - e.phaseStart;
  if (e.phase === 'out') {
    resolveEncounters(s, world, e, elapsed, true);
    if (!members(s, e).length) return lost(s, e);
    e.phase = 'search';
    e.phaseStart = s.t;
    if (e.target.cell) s.cellHeat[e.target.cell] = Math.min(100, (s.cellHeat[e.target.cell] ?? 0) + NOISE_HEAT[e.mode]);
    for (const m of members(s, e)) if (m.task) m.task.intensity = e.kind === 'claim' ? 'heavy' : 'light';
    push(s.queue, s.t + e.searchSec, { k: 'exp', eid });
    return;
  }
  if (e.phase === 'search') {
    resolveEncounters(s, world, e, elapsed, false);
    if (!members(s, e).length) return lost(s, e);
    if (e.kind === 'claim') return finishClaim(s, world, e);
    if (e.kind === 'convoy') {
      const dest = siteById(s, e.target.id);
      const delivered = Object.fromEntries(Object.entries(e.carried).filter(([, v]) => (v ?? 0) >= 0.5)) as StockDelta;
      const cargo = Object.entries(delivered)
        .map(([k, v]) => `${ITEMS[k as ItemId].label} ${fmtAmt(v ?? 0)}`)
        .join(', ');
      if (e.relocate) {
        settle(s, e, dest);
        alert(s, `Đội tới ${dest.name} và ở lại.${cargo ? ` Giao: ${cargo}.` : ''} ${e.report.join(' ')}`, 'good', delivered);
        return;
      }
      addStock(s, dest, e.carried);
      e.carried = {};
      log(s, `Đoàn vận chuyển đã giao tới ${dest.name}${cargo ? `: ${cargo}` : ''}.`, 'good', delivered);
    } else if (e.kind === 'loot') searchBuilding(s, world, e);
    else if (e.kind === 'patrol') sweep(s, e);
    else {
      const team = members(s, e);
      const liters = Math.min(team.length * 20, e.capacityKg - stockWeight(e.carried));
      e.carried.dirtyWater = (e.carried.dirtyWater ?? 0) + liters;
      e.report.push(`Gánh về ${Math.round(liters)} L nước sông.`);
    }
    e.phase = 'back';
    e.phaseStart = s.t;
    for (const m of members(s, e)) if (m.task) m.task.intensity = e.mode === 'car' ? 'rest' : 'moderate';
    push(s.queue, s.t + e.travelSec, { k: 'exp', eid });
    return;
  }
  resolveEncounters(s, world, e, elapsed, true);
  const team = members(s, e);
  if (!team.length) return lost(s, e);
  const home = siteById(s, e.fromSite);
  // Khẩu phần chưa ăn hết thì mang về kho, không bỏ đi.
  if (e.rations) {
    for (const [k, v] of Object.entries(e.rations)) if ((v ?? 0) > 0.01) addStock(s, home, { [k]: v } as StockDelta);
    e.rations = {};
  }
  // Survivors drop loot proportionally if teammates died on the way back.
  const keep = team.length / e.members.length;
  home.heat = Math.min(100, home.heat + NOISE_HEAT[e.mode]);
  const brought = Object.fromEntries(
    Object.entries(e.carried)
      .filter(([, v]) => (v ?? 0) * keep >= 0.5)
      .map(([k, v]) => [k, (v ?? 0) * keep]),
  ) as StockDelta;
  const got = Object.entries(brought)
    .map(([k, v]) => `${ITEMS[k as ItemId].label} ${fmtAmt(v ?? 0)}`)
    .join(', ');
  const report = e.report.join(' ');
  const name = e.target.name;
  const fights = e.fights;
  settle(s, e, home, keep);
  if (e.kind === 'convoy') log(s, `Đoàn vận chuyển đã về ${home.name}. ${report}`, 'info');
  else alert(s, `Đội về ${home.name} từ ${name}: ${got || 'tay trắng'}. ${report}`, fights > 2 ? 'warn' : 'good', brought);
}

function lost(s: GameState, e: Expedition): void {
  s.expeditions = s.expeditions.filter((x) => x !== e);
  alert(s, `Mất liên lạc với đội tới ${e.target.name}. Không ai trở về.`, 'bad');
}

/** Each kill thins the area; neighbours get half. Zombies drift back daily (see dayEvent). */
function sweep(s: GameState, e: Expedition): void {
  if (!e.target.cell) return;
  const gain = Math.min(0.5, 0.12 + 0.04 * e.fights);
  for (const c of gridDisk(e.target.cell, 1)) {
    const g = c === e.target.cell ? gain : gain / 2;
    s.cellClear[c] = Math.min(1, (s.cellClear[c] ?? 0) + g);
  }
  s.cellHeat[e.target.cell] = Math.max(0, (s.cellHeat[e.target.cell] ?? 0) - 10);
  e.report.push(`Hạ ${e.fights} con, khu vực sạch ${Math.round(s.cellClear[e.target.cell] * 100)}%.`);
}

/** Recurring convoys: launched at 07:00 when due and enough hands are free. */
export function runRoutes(s: GameState, world: World): void {
  const day = dayOf(s.t);
  for (const r of s.routes) {
    if (day < r.nextDay) continue;
    const from = s.sites.find((x) => x.id === r.from);
    const to = s.sites.find((x) => x.id === r.to);
    if (!from || !to) continue;
    const crew = s.survivors
      .filter((v) => v.status === 'alive' && v.siteId === from.id && v.location === 'base' && !v.commute && v.role !== 'guard' && v.hp > 60 && v.sickDays === 0)
      .sort((a, b) => skill(b, 'fitness') - skill(a, 'fitness'))
      .slice(0, r.crew)
      .map((v) => v.id);
    if (crew.length < r.crew) {
      log(s, `Tuyến ${from.name} → ${to.name}: không đủ người rảnh, hoãn sang mai.`, 'warn');
      continue;
    }
    const cargo: StockDelta = {};
    for (const [k, v] of Object.entries(r.cargo)) {
      const amt = Math.floor(Math.min(v ?? 0, from.stock[k as ItemId]));
      if (amt > 0) cargo[k as ItemId] = amt;
    }
    r.nextDay = day + r.everyDays;
    if (!Object.keys(cargo).length) {
      log(s, `Tuyến ${from.name} → ${to.name}: kho trống, bỏ chuyến này.`, 'warn');
      continue;
    }
    const why = launchExpedition(s, world, { fromSite: from.id, members: crew, target: { type: 'site', id: to.id }, mode: 'walk', cargo });
    if (why) log(s, `Tuyến ${from.name} → ${to.name}: ${why}.`, 'warn');
  }
}

const fmtAmt = (v: number) => (v >= 100 ? Math.round(v).toLocaleString('vi') : v.toFixed(1));

export const expeditionEta = (e: Expedition) => {
  const back = e.relocate ? 0 : e.travelSec;
  if (e.phase === 'out') return e.phaseStart + e.travelSec + e.searchSec + back;
  if (e.phase === 'search') return e.phaseStart + e.searchSec + back;
  return e.phaseStart + e.travelSec;
};
