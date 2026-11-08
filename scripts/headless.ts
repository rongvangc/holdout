import { buildWorld, expectedPerContainer } from '../src/world/generate';
import { syntheticOsm } from '../src/world/synthetic';
import type { World } from '../src/world/types';
import { DAY, HOUR, dayOf, timeOfDay } from '../src/core/time';
import { dist } from '../src/world/geo';
import { newGame, autoAssign, baseStats, mainSite, present } from '../src/sim/state';
import { advanceTo } from '../src/sim/engine';
import { queueModule, queueDefense } from '../src/sim/build';
import { launchExpedition, planExpedition } from '../src/sim/expedition';
import { setCommute } from '../src/sim/commute';
import { TEND_H_PER_M2_DAY } from '../src/sim/data';
import type { ModuleId } from '../src/data/modules';
import type { GameState, Site, StockDelta } from '../src/sim/types';

export function makeTestWorld(): World {
  const center: [number, number] = [106.7, 10.78];
  const w = buildWorld(syntheticOsm(center, 1000, 3), center, 1000, 'synthetic');
  w.key = 'test';
  return w;
}

const WANT_BASE: ModuleId[] = ['bedroom', 'kitchen', 'latrine', 'water_tank', 'workshop', 'storage', 'bedroom', 'filter', 'garden', 'infirmary', 'herb_garden', 'garden', 'well', 'watchtower', 'herb_garden', 'rec_room', 'bookshelf', 'bedroom', 'latrine'];
const WANT_FIELD: ModuleId[] = ['well', 'filter', 'garden', 'garden', 'kitchen', 'garden', 'garden', 'latrine', 'shelter'];

function buildNext(s: GameState, site: Site, want: ModuleId[]): void {
  if (site.projects.length) return;
  const have = site.interior.rooms.filter((r) => r.module).map((r) => r.module!);
  const counts: Record<string, number> = {};
  let next = want.find((m) => {
    counts[m] = (counts[m] ?? 0) + 1;
    return have.filter((h) => h === m).length < counts[m];
  });
  // Fields keep adding gardens while there are hands to tend them.
  if (!next && site.kind === 'field') {
    const farmers = present(s, site).length + s.survivors.filter((v) => v.status === 'alive' && v.commute?.work === site.id).length + 2;
    if (baseStats(s, site).gardenArea < farmers * (6 / TEND_H_PER_M2_DAY) * 0.8) next = 'garden';
  }
  if (!next) return;
  const free = site.interior.rooms.filter((r) => !r.module).sort((a, b) => a.area - b.area);
  for (const r of free) if (!queueModule(s, site, r.id, next)) break;
}

function sendLoot(s: GameState, world: World, from: Site, team: string[]): void {
  const st = baseStats(s, from);
  const needWater = from.stock.water + from.stock.dirtyWater < st.population * 10;
  const foodLow = from.stock.food + from.stock.rawFood + from.stock.meals < st.population * 2250 * 14;
  const matsLow = from.stock.wood < 60 || from.stock.scrap < 30 || from.projects.some((p) => !p.paid);
  if (needWater && world.waterPoints.length) {
    const wp = [...world.waterPoints].sort((a, b) => dist(a.pos, from.centroid) - dist(b.pos, from.centroid))[0];
    launchExpedition(s, world, { fromSite: from.id, members: team, target: { type: 'water', id: wp.id }, mode: 'walk' });
    return;
  }
  const owned = new Set(s.sites.map((x) => x.sourceId));
  const targets = world.buildings
    .filter((b) => !owned.has(b.id) && b.containers - (s.looted[b.id] ?? 0) > 3)
    .map((b) => {
      const ev = expectedPerContainer(b.cat);
      const value =
        (((ev.food ?? 0) + (ev.rawFood ?? 0)) * (foodLow ? 10 : 1)) / 1000 +
        ((ev.scrap ?? 0) + (ev.wood ?? 0) + (ev.tools ?? 0) * 5) * (matsLow && !foodLow ? 3 : 0.5) +
        (ev.medicine ?? 0) * (from.stock.medicine < 5 ? 4 : 0.5) +
        (ev.seeds ?? 0) * (from.stock.seeds < 6 ? 4 : 0.2);
      return { b, score: value / (300 + dist(b.centroid, from.centroid)) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((x) => x.b);
  for (const t of targets) {
    const order = { fromSite: from.id, members: team, target: { type: 'building' as const, id: t.id }, mode: 'walk' as const, containers: 40 };
    const plan = planExpedition(s, world, order);
    if (plan.ok && plan.biteRisk < 0.25) {
      launchExpedition(s, world, order);
      return;
    }
  }
}

/** Claim the nearest decent green as a field once the base can spare a crew. */
function maybeClaimField(s: GameState, world: World, base: Site, idle: string[]): boolean {
  if (!useFields || s.sites.some((x) => x.kind === 'field') || dayOf(s.t) < 8 || idle.length < 6) return false;
  if (!baseStats(s, base).workshop || s.expeditions.some((e) => e.kind === 'claim')) return false;
  const g = [...world.greens].filter((x) => x.area >= 1500).sort((a, b) => dist(a.centroid, base.centroid) - dist(b.centroid, base.centroid))[0];
  if (!g) return false;
  const cargo: StockDelta = {
    seeds: Math.min(3, Math.floor(base.stock.seeds)),
    wood: Math.min(18, Math.floor(base.stock.wood)),
    cloth: Math.min(6, Math.floor(base.stock.cloth)),
    scrap: Math.min(20, Math.floor(base.stock.scrap)),
    tools: Math.min(1, Math.floor(base.stock.tools)),
    water: Math.min(30, Math.floor(base.stock.water)),
    rawFood: Math.min(30000, Math.floor(base.stock.rawFood)),
  };
  if (cargo.tools! < 1 || cargo.scrap! < 20) return false;
  const team = idle.slice(0, 4);
  return launchExpedition(s, world, { fromSite: base.id, members: team, target: { type: 'green', id: g.id }, mode: 'walk', cargo }) === null;
}

/** Field crews haul harvests home; the base ships seeds and food out. */
function convoys(s: GameState, world: World, base: Site): void {
  for (const f of s.sites.filter((x) => x.kind === 'field')) {
    if (s.expeditions.some((e) => e.fromSite === f.id || (e.kind === 'convoy' && e.target.id === f.id))) continue;
    const crew = present(s, f).filter((v) => v.location === 'base' && v.hp > 50);
    const keepKcal = present(s, f).length * 2250 * 20;
    if (f.stock.rawFood > keepKcal + 30000 && crew.length >= 3) {
      const team = crew.slice(0, 2).map((v) => v.id);
      const cargo: StockDelta = { rawFood: Math.min(f.stock.rawFood - keepKcal, 2 * 22 * 3000) };
      launchExpedition(s, world, { fromSite: f.id, members: team, target: { type: 'site', id: base.id }, mode: 'walk', cargo });
      continue;
    }
    const pop = present(s, f).length;
    const needSeeds = f.stock.seeds < 2 && base.stock.seeds >= 3;
    const needFood = f.stock.food + f.stock.rawFood + f.stock.meals < pop * 2250 * 4;
    const needWater = f.stock.water < pop * 3.3 * 3 && !baseStats(s, f).well;
    const runners = present(s, base).filter((v) => v.location === 'base' && v.hp > 60 && v.role !== 'guard');
    if ((needSeeds || needFood || needWater) && runners.length >= 4) {
      const cargo: StockDelta = {
        seeds: needSeeds ? Math.floor(base.stock.seeds / 2) : 0,
        food: needFood ? Math.min(base.stock.food, 15000) : 0,
        rawFood: needFood ? Math.min(base.stock.rawFood, 30000) : 0,
        water: Math.min(Math.floor(base.stock.water / 3), 30),
      };
      launchExpedition(s, world, { fromSite: base.id, members: runners.slice(0, 2).map((v) => v.id), target: { type: 'site', id: f.id }, mode: 'walk', cargo });
    }
  }
}

let useFields = true;

/** Simple "player" bot used by tests and `npm run sim` to sanity-check balance. */
export function botDay(s: GameState, world: World): void {
  const base = mainSite(s);
  const st = baseStats(s, base);
  if (!base.projects.length) {
    const wantFort = Math.min(3, 1 + Math.floor(dayOf(s.t) / 25));
    const basics = base.interior.rooms.filter((r) => r.module).length >= 4;
    if ((basics && base.fortify.level < wantFort && (base.fortify.level < 1 || st.workshop)) || (base.fortify.level && base.fortify.hp < 60)) {
      queueDefense(s, base, 'fortify');
    }
  }
  buildNext(s, base, WANT_BASE);
  for (const f of s.sites.filter((x) => x.kind === 'field')) {
    buildNext(s, f, WANT_FIELD);
    if (!f.projects.length && f.fence.level < 1) queueDefense(s, f, 'fence');
  }
  autoAssign(s);
  convoys(s, world, base);

  const idle = s.survivors
    .filter((v) => v.status === 'alive' && v.siteId === base.id && v.location === 'base' && !v.commute && v.hp > 50 && v.sickDays === 0)
    .sort((a, b) => b.hp - a.hp)
    .map((v) => v.id);
  if (maybeClaimField(s, world, base, idle)) return;

  // Once a field can water its workers, send day labourers from the base instead of living there.
  for (const f of s.sites.filter((x) => x.kind === 'field' && baseStats(s, x).filter)) {
    const want = Math.ceil(baseStats(s, f).gardenArea / 1200);
    const have = s.survivors.filter((v) => v.status === 'alive' && v.commute?.work === f.id).length;
    for (const id of idle.slice(0, Math.max(0, Math.min(want - have, idle.length - 6)))) {
      setCommute(s, world, id, f.id);
      idle.splice(idle.indexOf(id), 1);
    }
  }

  if (idle.length < 4 || s.expeditions.some((e) => e.fromSite === base.id && e.kind !== 'convoy')) return;
  // Sweep the home block every few days so night raids stay small.
  if (dayOf(s.t) % 4 === 0 && (s.cellClear[base.cell] ?? 0) < 0.5 && idle.length >= 6) {
    launchExpedition(s, world, { fromSite: base.id, members: idle.slice(0, 3), target: { type: 'site', id: base.id }, mode: 'walk', patrol: true });
    return;
  }
  sendLoot(s, world, base, idle.slice(0, Math.min(4, Math.floor(idle.length / 3) + 1)));
}

export function runBot(days: number, seed = 11, verbose = false, fields = true): GameState {
  useFields = fields;
  const world = makeTestWorld();
  const baseB = world.buildings
    .filter((b) => b.area > 250 && b.area < 900)
    .sort((a, b) => a.centroid[0] ** 2 + a.centroid[1] ** 2 - (b.centroid[0] ** 2 + b.centroid[1] ** 2))[0];
  const s = newGame(world, baseB.id, seed, new Date(2026, 5, 1));
  let t = s.t;
  while (dayOf(t) <= days && !s.gameOver) {
    // Bot plays at 07:00 and 13:00 each day.
    const tod = timeOfDay(t);
    const day0 = Math.floor(t / DAY) * DAY;
    const next = tod < 7 * HOUR ? day0 + 7 * HOUR : tod < 13 * HOUR ? day0 + 13 * HOUR : day0 + DAY + 7 * HOUR;
    advanceTo(s, world, next);
    t = next;
    botDay(s, world);
    if (verbose && dayOf(t) % 10 === 0 && timeOfDay(t) === 7 * HOUR) {
      const alive = s.survivors.filter((v) => v.status === 'alive');
      const food = s.sites.reduce((a, x) => a + x.stock.food + x.stock.rawFood + x.stock.meals, 0);
      const sites = s.sites.map((x) => `${x.kind[0]}${present(s, x).length}`).join('/');
      console.log(
        `D${dayOf(t)} pop=${alive.length} sites=${sites} food=${Math.round(food)} heat=${Math.round(mainSite(s).heat)} fort=${mainSite(s).fortify.level} ` +
          `deaths=${s.stats.deaths} raids +${s.stats.raidsRepelled}/-${s.stats.raidsLost} exp=${s.stats.expeditions} harvest=${Math.round(s.stats.harvestedKcal)}`,
      );
    }
  }
  return s;
}
