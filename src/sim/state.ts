import { push, makeQueue } from '../core/eventQueue';
import { makeRng, range } from '../core/rng';
import { DAY, HOUR, dayOf, nextClock } from '../core/time';
import { generateInterior, roomsWith } from '../base/interior';
import { CATS } from '../data/categories';
import { emptyStock, normalizeStock, type ItemId } from '../data/items';
import { FENCE_DEFENSE_PER_LEVEL, FORTIFY_DEFENSE_PER_LEVEL } from '../data/modules';
import { structureEffects } from '../data/structures';
import { dist } from '../world/geo';
import type { World } from '../world/types';
import { PEOPLE_PER_LATRINE, ROLES, TEND_H_PER_M2_DAY, type Role } from './data';
import { issueGear } from './gear';
import { isActive, makeSurvivor, skill } from './survivors';
import type { GameState, LogEntry, Site, StockDelta, Survivor } from './types';

export const START_SURVIVORS = 5;
const LOG_MAX = 500;

/** Build a held location from a World building (base/outpost) or green polygon (field). */
export function makeSite(s: GameState, world: World, kind: Site['kind'], sourceId: string): Site {
  const seed = (s.seed ^ (s.nextId * 2654435761)) >>> 0;
  if (kind === 'field') {
    const g = world.greens.find((x) => x.id === sourceId);
    if (!g) throw new Error('Không tìm thấy khu đất');
    return blankSite(s, kind, g.name ?? 'Ruộng', sourceId, g.cell, g.node, g.centroid, generateInterior({ id: g.id, poly: g.poly, levels: 1 }, [], seed, true));
  }
  const b = world.buildings.find((x) => x.id === sourceId);
  if (!b) throw new Error('Không tìm thấy toà nhà');
  const near = world.buildings.filter((o) => dist(o.centroid, b.centroid) < Math.sqrt(b.area) + 80);
  const interior = generateInterior(b, near, seed);
  const site = blankSite(s, kind, b.name ?? CATS[b.cat].label, sourceId, b.cell, b.node, b.centroid, interior);
  site.salvageLeft = {
    wood: Math.round(interior.footprintArea * interior.floors * 0.05),
    scrap: Math.round(interior.footprintArea * interior.floors * 0.02),
  };
  return site;
}

function blankSite(
  s: GameState,
  kind: Site['kind'],
  name: string,
  sourceId: string,
  cell: string,
  node: number,
  centroid: Site['centroid'],
  interior: Site['interior'],
): Site {
  return {
    id: newId(s, 'site'),
    kind,
    name,
    sourceId,
    cell,
    node,
    centroid,
    interior,
    stock: emptyStock(),
    fuelBatches: [],
    projects: [],
    fortify: { level: 0, hp: 100 },
    fence: { level: 0, hp: 100 },
    plots: {},
    salvageLeft: { wood: 0, scrap: 0 },
    heat: 0,
    filth: 0,
    corpses: 0,
    wellDrawnToday: 0,
    claimedDay: dayOf(s.t),
  };
}

export function newGame(world: World, baseId: string, seed: number, startDate = new Date()): GameState {
  const base = world.buildings.find((b) => b.id === baseId);
  if (!base) throw new Error('Không tìm thấy toà nhà làm base');
  const rng = makeRng(seed);
  const t0 = 6 * HOUR;
  const startDoy = Math.floor((startDate.getTime() - new Date(startDate.getFullYear(), 0, 0).getTime()) / 864e5);
  const s: GameState = {
    version: 2,
    seed,
    rng,
    t: t0,
    startDoy: Math.max(1, Math.min(365, startDoy)),
    latitude: world.center[1],
    worldKey: world.key,
    sites: [],
    survivors: [],
    cellHeat: {},
    cellClear: {},
    routes: [],
    looted: { [baseId]: base.containers },
    hordeUntilDay: 0,
    weather: { day: 1, label: 'Nắng', rainMm: 0, tempC: 28, storm: false, hot: false },
    laws: { rations: 'normal', bitten: 'quarantine', strangers: 'screen', curfew: false, noise: false, corpses: 'burn' },
    lawChangedDay: {},
    expeditions: [],
    log: [],
    alerts: [],
    recentDeaths: 0,
    stats: { deaths: 0, recruited: 0, raidsRepelled: 0, raidsLost: 0, expeditions: 0, harvestedKcal: 0 },
    queue: makeQueue(),
    nextId: 1,
    autoRoles: true,
    gameOver: false,
  };
  const home = makeSite(s, world, 'base', baseId);
  s.sites.push(home);
  Object.assign(home.stock, {
    food: 30000,
    rawFood: 20000,
    water: 80,
    dirtyWater: 40,
    wood: 40,
    scrap: 20,
    cloth: 14,
    medicine: 6,
    bandage: 10,
    seeds: 12,
    tools: 2,
    books: 2,
  } satisfies StockDelta);
  for (let i = 0; i < START_SURVIVORS; i++) addSurvivor(s, makeSurvivor(rng, newId(s, 's'), 1), home.id);
  autoAssign(s);
  push(s.queue, nextClock(t0, 0), { k: 'day' });
  push(s.queue, t0 + range(rng, 3, 9) * HOUR, { k: 'strangers' });
  log(s, `Nhóm ${START_SURVIVORS} người chiếm ${home.name} làm căn cứ. Ngày 1 bắt đầu.`, 'info');
  return s;
}

/** Saves from before multi-site (v1) kept base fields at the top level. */
export function migrate(raw: unknown): GameState {
  const o = raw as GameState & Record<string, unknown>;
  o.cellClear ??= {};
  o.routes ??= [];
  if (o.version === 2) {
    // Saves made before the item registry grew are missing every new id.
    for (const site of o.sites ?? []) site.stock = normalizeStock(site.stock);
    return o;
  }
  const site: Site = {
    id: 'site0',
    kind: 'base',
    name: 'Căn cứ',
    sourceId: o.baseId as string,
    cell: '',
    node: 0,
    centroid: [0, 0],
    interior: o.interior as Site['interior'],
    stock: normalizeStock(o.stock as Site['stock']),
    condition: (o.condition as Site['condition']) ?? {},
    fuelBatches: (o.fuelBatches as Site['fuelBatches']) ?? [],
    projects: (o.projects as Site['projects']) ?? [],
    fortify: o.fortify as Site['fortify'],
    fence: o.fence as Site['fence'],
    plots: (o.plots as Site['plots']) ?? {},
    salvageLeft: o.salvageLeft as Site['salvageLeft'],
    heat: (o.heat as number) ?? 0,
    filth: (o.filth as number) ?? 0,
    corpses: (o.corpses as number) ?? 0,
    wellDrawnToday: (o.wellDrawnToday as number) ?? 0,
    claimedDay: 1,
  };
  for (const k of ['baseId', 'interior', 'stock', 'fuelBatches', 'projects', 'fortify', 'fence', 'plots', 'salvageLeft', 'heat', 'filth', 'corpses', 'wellDrawnToday']) {
    delete o[k];
  }
  o.sites = [site];
  o.version = 2;
  o.autoRoles ??= true;
  for (const v of o.survivors) v.siteId ??= site.id;
  for (const e of o.expeditions) {
    e.kind ??= e.target.type === 'water' ? 'water' : 'loot';
    e.fromSite ??= site.id;
    e.relocate ??= false;
  }
  for (const q of o.queue.heap) if (q.ev.k === 'raid') q.ev.site ??= site.id;
  return o;
}

/** Fill world-derived fields a migrated v1 site is missing. */
export function hydrateSites(s: GameState, world: World): void {
  for (const site of s.sites) {
    if (site.cell) continue;
    const b = world.buildings.find((x) => x.id === site.sourceId);
    if (!b) continue;
    site.cell = b.cell;
    site.node = b.node;
    site.centroid = b.centroid;
    site.name = b.name ?? CATS[b.cat].label;
  }
}

export const newId = (s: GameState, prefix: string) => `${prefix}${s.nextId++}`;

/** After the map grows, graph indices change: re-resolve every site by its stable OSM id. */
export function rebindWorld(s: GameState, world: World): string[] {
  const lost: string[] = [];
  for (const site of s.sites) {
    const src = site.kind === 'field' ? world.greens.find((g) => g.id === site.sourceId) : world.buildings.find((b) => b.id === site.sourceId);
    if (!src) {
      lost.push(site.name);
      continue;
    }
    site.node = src.node;
    site.cell = src.cell;
    site.centroid = src.centroid;
  }
  s.worldKey = world.key;
  return lost;
}

export const siteById = (s: GameState, id: string): Site => s.sites.find((x) => x.id === id) ?? s.sites[0];
export const mainSite = (s: GameState): Site => s.sites[0];
export const siteOf = (s: GameState, v: Survivor): Site => siteById(s, v.siteId);
export const siteOfSource = (s: GameState, sourceId: string) => s.sites.find((x) => x.sourceId === sourceId);

/** People physically at a site (including quarantine), not out on an expedition. */
export const present = (s: GameState, site: Site) =>
  s.survivors.filter((v) => v.status === 'alive' && v.siteId === site.id && v.location !== 'expedition');

export function addSurvivor(s: GameState, v: Survivor, siteId = mainSite(s).id): void {
  v.siteId = siteId;
  s.survivors.push(v);
  push(s.queue, s.t, { k: 'task', sid: v.id });
}

export function log(s: GameState, msg: string, level: LogEntry['level'] = 'info', items?: StockDelta): void {
  s.log.push({ t: s.t, msg, level, items });
  if (s.log.length > LOG_MAX) s.log.splice(0, s.log.length - LOG_MAX);
}

/** Important events: logged and surfaced so the UI can auto-pause. */
export function alert(s: GameState, msg: string, level: LogEntry['level'] = 'warn', items?: StockDelta): void {
  log(s, msg, level, items);
  s.alerts.push({ t: s.t, msg, level, items });
}

export function addStock(s: GameState, site: Site, d: StockDelta, mult = 1): void {
  for (const [k, v] of Object.entries(d)) {
    const id = k as ItemId;
    const delta = (v ?? 0) * mult;
    if (!delta) continue;
    if (id === 'fuel' && delta > 0) {
      site.fuelBatches.push({ liters: delta, day: Math.floor(s.t / DAY) + 1 });
    }
    site.stock[id] = Math.max(0, (site.stock[id] ?? 0) + delta);
  }
}

/** Whether the site has every id in `d`, in the asked amount or more. */
export function canAfford(site: Site, d: StockDelta): boolean {
  return Object.entries(d).every(([k, v]) => (site.stock[k as ItemId] ?? 0) + 1e-9 >= (v ?? 0));
}

export function take(site: Site, id: ItemId, amount: number): number {
  const got = Math.max(0, Math.min(site.stock[id] ?? 0, amount));
  site.stock[id] = (site.stock[id] ?? 0) - got;
  if (id === 'fuel') consumeFuel(site, got);
  return got;
}

function consumeFuel(site: Site, liters: number): void {
  // Oldest fuel first — it is closest to going stale.
  for (const b of site.fuelBatches) {
    const use = Math.min(b.liters, liters);
    b.liters -= use;
    liters -= use;
    if (liters <= 0) break;
  }
  site.fuelBatches = site.fuelBatches.filter((b) => b.liters > 0.01);
}

export interface BaseStats {
  population: number;
  beds: number;
  latrines: number;
  tanks: number;
  waterCapacity: number;
  kitchen: boolean;
  filter: boolean;
  workshop: boolean;
  infirmary: boolean;
  storage: boolean;
  well: boolean;
  watchtowers: number;
  recRoom: boolean;
  gardenArea: number;
  herbArea: number;
  generator: boolean;
  garage: boolean;
  bookshelf: boolean;
  /** Cellar level 0..3 — slowest rot at 3. */
  cellar: number;
  /** Level-aware derived numbers: the module ladders must change real digits. */
  filterRate: number; // L/hour
  wellDaily: number; // L/day
  gardenYield: number; // multiplier
  latrineCapacity: number; // people
  healMult: number; // HP/day multiplier while resting
  generatorFuel: number; // litres per night
  towerDefense: number; // defence per watchtower
  storeLoss: number; // share of stores lost to an unguarded raid
  bedQuality: number; // multiplier on sleep recovery
  shelterBedsPerM2: number; // people per m² of shelter
  shelterStormLoss: number; // share of shelters a storm destroys
  recMorale: number; // morale target bonus from a rec room
  studyRate: number; // reading speed multiplier
  herbYield: number; // herb-garden output multiplier
  garageFuel: number; // L per km when leaving a garage site
  garageCargo: number; // extra kg a car can carry from a garage site
  generatorLevel: number;
  /** Appliances that actually have power tonight (site.powerOn). */
  powerOn: string[];
  fridgeRot: number; // multiplier on stored-food rot while the fridge runs
  pumpYield: number; // well/filter multiplier while the pump runs
  toolsSpeed: number; // build/craft multiplier while power tools run
  fenceDefense: number; // flat defence added at night by the electric fence
  growYield: number; // garden multiplier from grow lights
  radioMorale: number; // morale target bonus from the radio
  /** Cold reduction from a burning stove (0 when it had no wood). */
  stoveWarmth: number;
  /** Cold reduction from the electric heater while it has power. */
  heaterWarmth: number;
  /** True when a level-3 radio is on the air and can call rescue. */
  rescueSignal: boolean;
  /** Number of coop rooms, and their best level. */
  coop: number;
  coopLevel: number;
  pond: number;
  pondLevel: number;
  /** Trại chăn nuôi (dê/lợn/bò) và cấp cao nhất. */
  barn: number;
  barnLevel: number;
  defenseStatic: number;
}

export function baseStats(s: GameState, site: Site): BaseStats {
  const it = site.interior;
  const count = (m: Parameters<typeof roomsWith>[1]) => roomsWith(it, m).length;
  const tanks = count('water_tank');
  const watchtowers = count('watchtower');
  // One pass over the rooms: this runs on every simulation tick, so no per-module scans.
  const bestLevelRaw: Partial<Record<string, number>> = {};
  for (const r of it.rooms) {
    if (!r.module) continue;
    const lv = r.moduleLevel ?? 1;
    if (lv > (bestLevelRaw[r.module] ?? 0)) bestLevelRaw[r.module] = lv;
  }
  const lvlOf = (m: string) => Math.max(1, bestLevelRaw[m] ?? 1);
  const powered = site.powerOn ?? [];
  const on = (m: string) => powered.includes(m);
  // Beds: a better bedroom packs more people per m², a better shelter too.
  const bedPerM2 = lvlOf('bedroom') >= 2 ? 4 : 5;
  const shelterPerM2 = lvlOf('shelter') >= 3 ? 4 : lvlOf('shelter') >= 2 ? 5 : 6;
  const beds =
    roomsWith(it, 'bedroom').reduce((n, r) => n + Math.max(1, Math.floor(r.area / bedPerM2)), 0) +
    roomsWith(it, 'shelter').reduce((n, r) => n + Math.max(1, Math.floor(r.area / shelterPerM2)), 0);
  const tankLvl = lvlOf('water_tank');
  const filterLvl = lvlOf('filter');
  const wellLvl = lvlOf('well');
  const gardenLvl = lvlOf('garden');
  const latrineLvl = lvlOf('latrine');
  const infLvl = lvlOf('infirmary');
  const genLvl = lvlOf('generator');
  const towerLvl = lvlOf('watchtower');
  const storeLvl = lvlOf('storage');
  return {
    population: present(s, site).length,
    beds,
    latrines: count('latrine'),
    tanks,
    waterCapacity: Math.round(300 + tanks * 1000 * (1 + 0.4 * (tankLvl - 1))),
    kitchen: count('kitchen') > 0,
    filter: count('filter') > 0,
    workshop: count('workshop') > 0,
    infirmary: count('infirmary') > 0,
    storage: count('storage') > 0,
    well: count('well') > 0,
    watchtowers,
    recRoom: count('rec_room') > 0,
    gardenArea: roomsWith(it, 'garden').reduce((a, r) => a + r.area, 0),
    herbArea: roomsWith(it, 'herb_garden').reduce((a, r) => a + r.area, 0),
    generator: count('generator') > 0,
    garage: count('garage') > 0,
    bookshelf: count('bookshelf') > 0,
    cellar: roomsWith(it, 'cellar').reduce((n, r) => Math.max(n, r.moduleLevel ?? 1), count('cellar') ? 1 : 0),
    coop: count('coop'),
    coopLevel: roomsWith(it, 'coop').reduce((n, r) => Math.max(n, r.moduleLevel ?? 1), 0),
    pond: count('pond'),
    pondLevel: roomsWith(it, 'pond').reduce((n, r) => Math.max(n, r.moduleLevel ?? 1), 0),
    barn: count('barn'),
    barnLevel: roomsWith(it, 'barn').reduce((n, r) => Math.max(n, r.moduleLevel ?? 1), 0),
    filterRate: 12 * (1 + 0.5 * (filterLvl - 1)),
    wellDaily: 1500 * (1 + 0.35 * (wellLvl - 1)),
    gardenYield: 1 + 0.1 * (gardenLvl - 1),
    latrineCapacity: Math.round(PEOPLE_PER_LATRINE * (1 + 0.25 * (latrineLvl - 1))),
    healMult: 2.5 + 0.5 * (infLvl - 1),
    generatorFuel: Math.max(8, 24 - 4 * (genLvl - 1)),
    towerDefense: 12 * (1 + 0.3 * (towerLvl - 1)),
    // Level 1 keeps the original 8%; each level halves the loss.
    storeLoss: Math.max(0.02, 0.08 - 0.03 * (storeLvl - 1)),
    bedQuality: 1 + 0.1 * (lvlOf('bedroom') - 1) + 0.1 * (lvlOf('shelter') - 1),
    shelterBedsPerM2: shelterPerM2,
    shelterStormLoss: Math.max(0.15, 0.5 - 0.175 * (lvlOf('shelter') - 1)),
    recMorale: 8 + 4 * (lvlOf('rec_room') - 1),
    studyRate: 1 + 0.3 * (lvlOf('bookshelf') - 1),
    herbYield: 1 + 0.25 * (lvlOf('herb_garden') - 1),
    garageFuel: Math.max(0.05, 0.1 - 0.02 * lvlOf('garage')),
    garageCargo: lvlOf('garage') >= 3 ? 140 : lvlOf('garage') >= 2 ? 100 : 80,
    generatorLevel: lvlOf('generator'),
    powerOn: site.powerOn ?? [],
    // Thiết bị chỉ có tác dụng khi tối nay nó thực sự được cấp điện.
    fridgeRot: on('fridge') ? [0.25, 0.15, 0.08][Math.min(2, lvlOf('fridge') - 1)] : 1,
    pumpYield: on('water_pump') ? [1.5, 1.8, 2.0][Math.min(2, lvlOf('water_pump') - 1)] : 1,
    toolsSpeed: on('power_tools') ? [1.3, 1.45, 1.6][Math.min(2, lvlOf('power_tools') - 1)] : 1,
    fenceDefense: on('electric_fence') ? [25, 35, 45][Math.min(2, lvlOf('electric_fence') - 1)] : 0,
    growYield: on('grow_light') ? [1.1, 1.25, 1.4][Math.min(2, lvlOf('grow_light') - 1)] : 1,
    radioMorale: on('radio') ? [4, 6, 8][Math.min(2, lvlOf('radio') - 1)] : 0,
    // Sưởi: lò củi (đốt gỗ, không cần điện) và máy sưởi điện (cần điện).
    stoveWarmth: (bestLevelRaw.stove ?? 0) > 0 ? [0.5, 0.7, 0.85][Math.min(2, lvlOf('stove') - 1)] : 0,
    heaterWarmth: on('electric_heater') ? [0.6, 0.75, 0.9][Math.min(2, lvlOf('electric_heater') - 1)] : 0,
    rescueSignal: on('radio') && lvlOf('radio') >= 3,
    defenseStatic:
      site.fortify.level * FORTIFY_DEFENSE_PER_LEVEL * (site.fortify.hp / 100) +
      site.fence.level * FENCE_DEFENSE_PER_LEVEL * (site.fence.hp / 100) +
      watchtowers * (12 * (1 + 0.3 * (towerLvl - 1))) +
      structureEffects(it.structures).defense,
  };
}

export const latrineShortfall = (st: BaseStats) => Math.max(0, st.population - st.latrines * st.latrineCapacity);

/** Greedy role assignment per site by need and best matching skill — the "manager" default. */
export function autoAssign(s: GameState, only?: Site): void {
  for (const site of only ? [only] : s.sites) {
    const people = s.survivors.filter((v) => isActive(v) && v.siteId === site.id && v.location === 'base' && !v.commute);
    const n = people.length;
    if (!n) continue;
    const st = baseStats(s, site);
    const paid = site.projects.some((p) => p.paid);
    const lowMaterials = (site.stock.wood < 40 || site.projects.some((p) => !p.paid)) && (site.heat < 40 || site.stock.wood < 15);
    const field = site.kind === 'field';
    const farmArea = st.gardenArea + st.herbArea;
    // Thứ tự ưu tiên: gác → NÔNG DÂN → phần còn lại. Trước đây nông dân bị đẩy xuống
    // cuối nên sau khi chia gác/bếp/nước/y tá/thợ xây thì không còn ai ra vườn, và cả
    // nền kinh tế trồng trọt (kể cả 740 m² sân nhà) không có người làm.
    const want: [Role, number][] = [
      ['guard', Math.max(1, Math.round(n * 0.15))],
      ['farmer', farmArea ? Math.max(1, Math.ceil((farmArea * TEND_H_PER_M2_DAY) / 6)) : 0],
      ['cook', st.kitchen ? Math.max(1, Math.round(n / 8)) : 0],
      ['water', st.filter || st.kitchen || st.well ? Math.max(1, Math.round(n / 8)) : 0],
      ['medic', n >= 4 ? 1 + Math.floor(n / 14) : 0],
      ['sanitation', n >= 6 ? Math.max(1, Math.round(n / 12)) : 0],
      ['gatherer', lowMaterials ? 1 + Math.floor(n * 0.12) : 0],
      ['builder', paid ? Math.max(1, Math.round(n * 0.3)) : 0],
    ];
    if (field) want.unshift(want.splice(1, 1)[0]); // ruộng thì nông dân lên đầu
    const free = new Set(people);
    for (const [role, k] of want) {
      const sk = ROLES[role].skill;
      const ranked = [...free].sort((a, b) => (sk ? skill(b, sk) - skill(a, sk) : 0));
      for (const v of ranked.slice(0, Math.min(k, role === 'farmer' && field ? free.size : Math.max(0, free.size - 1)))) {
        v.role = role;
        free.delete(v);
      }
    }
    // Spare hands only gather when materials are short — gathering is noisy and draws raids.
    for (const v of free) v.role = paid ? 'builder' : site.stock.wood < 60 && site.heat < 40 ? 'gatherer' : 'idle';
    // Trang bị là của từng người: cấp món tốt nhất trong kho cho người dùng được nó.
    issueGear(site, people);
  }
}
