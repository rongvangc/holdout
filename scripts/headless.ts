import { buildWorld, expectedPerContainer } from '../src/world/generate';
import { syntheticOsm } from '../src/world/synthetic';
import type { World } from '../src/world/types';
import { DAY, HOUR, dayOf, timeOfDay } from '../src/core/time';
import { dist } from '../src/world/geo';
import { newGame, autoAssign, baseStats, mainSite, present } from '../src/sim/state';
import { advanceTo } from '../src/sim/engine';
import { maxStationLevel, queueCraft, queueModule, queueDefense, upgradeModule } from '../src/sim/build';
import { paintRoom } from '../src/sim/design';
import { DESIGN_LIMITS } from '../src/data/structures';
import { canAfford } from '../src/sim/state';
import { canPlace } from '../src/base/interior';
import { MODULES } from '../src/data/modules';
import { RECIPE_BY_ID, RECIPES } from '../src/data/recipes';
import { ITEMS } from '../src/data/items';
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
const WANT_FIELD: ModuleId[] = ['garden', 'garden', 'shelter', 'latrine'];


/**
 * Ruộng: gom các khoảnh trống nhỏ thành MỘT khoảnh lớn (tối đa 5.000 m²) trước khi trồng.
 * Ở năng suất thật, vườn 70 m² nuôi chưa nổi nửa người; phải làm vườn lớn thì trồng
 * trọt mới có nghĩa. Chỉ chạy khi ruộng chưa có vườn nào.
 */
function consolidateField(s: GameState, site: Site): boolean {
  const it = site.interior;
  const freeYard = it.rooms.filter((r) => !r.module && r.outdoor && r.walled !== false);
  if (freeYard.length <= 1) return false;
  if (freeYard.some((r) => r.area >= 1000)) return false; // đã có khoảnh lớn, khỏi gom lại
  const perCell = it.cellSize * it.cellSize;
  // Mỗi khoảnh ~1.200 m² là một người chăm vừa (1.200 × 0,003 = 3,6 h/ngày);
  // gộp 5.000 m² vào một khoảnh thì gieo/chăm không kịp và vườn bỏ hoang.
  const maxCells = Math.floor(Math.min(DESIGN_LIMITS.maxRoomField, 1200) / perCell);
  const cells = freeYard.flatMap((r) => r.cells).slice(0, maxCells);
  if (cells.length < 2) return false;
  return !paintRoom(s, site, { floor: 0, outdoor: true }, cells, 'Khoảnh lớn');
}

function buildNext(s: GameState, site: Site, want: ModuleId[]): void {
  // Ruộng: hạng mục vườn không bị chặn bởi một hạng mục khác đang chờ thợ.
  if (site.projects.length && site.kind !== 'field') return;
  if (site.projects.filter((p) => p.kind === 'module' && p.module === 'garden').length > 2) return;
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
  // Vườn cần khoảnh LỚN (năng suất thật), trạm khác thì vừa là đủ → xếp ngược lại.
  const free = site.interior.rooms
    .filter((r) => !r.module)
    .sort((a, b) => (next === 'garden' ? b.area - a.area : a.area - b.area));
  for (const r of free) if (!queueModule(s, site, r.id, next)) break;
}

function sendLoot(s: GameState, world: World, from: Site, team: string[]): void {
  const st = baseStats(s, from);
  const needWater = from.stock.water + from.stock.dirtyWater < st.population * 10;
  const foodLow = from.stock.food + from.stock.rawFood + from.stock.meals < st.population * 2250 * 14;
  const matsLow = from.stock.wood < 60 || from.stock.scrap < 30;
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
  const fields = s.sites.filter((x) => x.kind === 'field').length;
  const wantFields = s.survivors.filter((v) => v.status === 'alive').length >= 9 ? 3 : 1;
  if (!useFields || fields >= wantFields || dayOf(s.t) < 8 || idle.length < 6) return false;
  // Đừng mở ruộng mới khi ruộng hiện tại còn chưa ai chăm.
  for (const f of s.sites.filter((x) => x.kind === 'field')) if (present(s, f).length < 2) return false;
  if (!baseStats(s, base).workshop || s.expeditions.some((e) => e.kind === 'claim')) return false;
  const g = [...world.greens].filter((x) => x.area >= 1500).sort((a, b) => dist(a.centroid, base.centroid) - dist(b.centroid, base.centroid))[0];
  if (!g) return false;
  const cargo: StockDelta = {
    seeds: Math.min(40, Math.floor(base.stock.seeds)),
    wood: Math.min(80, Math.floor(base.stock.wood)),
    cloth: Math.min(6, Math.floor(base.stock.cloth)),
    scrap: Math.min(20, Math.floor(base.stock.scrap)),
    tools: Math.min(1, Math.floor(base.stock.tools)),
    water: Math.min(30, Math.floor(base.stock.water)),
    rawFood: Math.min(30000, Math.floor(base.stock.rawFood)),
  };
  if (cargo.tools! < 1 || cargo.scrap! < 20 || cargo.wood! < 40) return false;
  const team = idle.slice(0, 4);
  return launchExpedition(s, world, { fromSite: base.id, members: team, target: { type: 'green', id: g.id }, mode: 'walk', cargo }) === null;
}

/** Field crews haul harvests home; the base ships seeds and food out. */
function convoys(s: GameState, world: World, base: Site): void {
  for (const f of s.sites.filter((x) => x.kind === 'field')) {
    if (s.expeditions.some((e) => e.fromSite === f.id || (e.kind === 'convoy' && e.target.id === f.id))) continue;
    const crew = present(s, f).filter((v) => v.location === 'base' && v.hp > 50);
    const keepKcal = present(s, f).length * 2250 * 20;
    if (f.stock.rawFood > keepKcal + 10000 && crew.length >= 3) {
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
/**
 * The bot cooks like a player would: keep a buffer of raw calories, prefer the
 * tastiest dish the kitchen can actually make right now.
 */
/**
 * Station upgrades, in the order a real manager would spend on them: water first
 * (thirst kills fastest), then medicine, then food, then comfort.
 */
const UPGRADE_ORDER: ModuleId[] = ['filter', 'well', 'water_tank', 'infirmary', 'garden', 'storage', 'latrine', 'watchtower', 'bedroom', 'cellar', 'kitchen'];

function upgradeStations(s: GameState, base: Site): void {
  if (base.projects.length) return;
  // Keep a material reserve: upgrades must not starve the next module.
  if (base.stock.wood < 80 || base.stock.scrap < 40) return;
  for (const id of UPGRADE_ORDER) {
    const room = base.interior.rooms.find((r) => r.module === id && (r.moduleLevel ?? 1) < maxStationLevel(id));
    if (!room) continue;
    const next = MODULES[id].levels?.[(room.moduleLevel ?? 1) - 1];
    if (!next || !canAfford(base, next.cost)) continue;
    if (upgradeModule(s, base, room.id) === null) return;
  }
}

/** Crafting stations are opt-in: only queue what the pantry can pay for today. */
const STATION_ORDER: ModuleId[] = ['forge', 'tailor', 'cellar', 'crock', 'smokehouse', 'kiln', 'carpentry', 'generator', 'lighting', 'fridge', 'water_pump', 'power_tools', 'electric_fence', 'radio'];
/** Queue a craft for the first input the site is short of, if a recipe exists. */
function craftMissing(s: GameState, base: Site, cost: Partial<Record<string, number>>): boolean {
  if (base.stock.wood < 160 || base.stock.scrap < 80) return false;
  for (const [item, need] of Object.entries(cost)) {
    if ((base.stock[item] ?? 0) >= (need ?? 0)) continue;
    const r = RECIPES.find((x) => x.out === item && canAfford(base, Object.fromEntries(x.in) as never));
    if (!r) continue;
    if (queueCraft(s, base, r.id) === null) return true;
  }
  return false;
}

const APPLIANCE_IDS = new Set<string>(['lighting', 'fridge', 'water_pump', 'power_tools', 'electric_fence', 'radio', 'grow_light']);

function buildStations(s: GameState, base: Site): void {
  if (base.projects.length > 1) return;
  const pop = present(s, base).length;
  const food = base.stock.rawFood + base.stock.meals + base.stock.food;
  // Chăn nuôi chỉ đáng làm khi đã có nước sạch và đủ người: trước đây ưu tiên trại sớm
  // khiến cả nhóm chết khát vì chưa có trạm lọc/giếng.
  const waterReady = baseStats(s, base).filter || baseStats(s, base).well;
  // Chưa có vườn ruộng thì chăn nuôi chỉ là ăn lỗ: ưu tiên trồng trước.
  const hasFarm = baseStats(s, base).gardenArea >= 100 || s.sites.some((x) => x.kind === 'field');
  const supplyFirst = waterReady && pop >= 6 && food < pop * 2250 * 25;
  const woodGate = supplyFirst ? 55 : 120;
  if (base.stock.wood < woodGate || base.stock.scrap < (supplyFirst ? 25 : 60)) return;
  const stable = pop > 0 && food > pop * 2250 * 10;
  const have = new Set(base.interior.rooms.filter((r) => r.module).map((r) => r.module!));
  const SUPPLY: ModuleId[] = ['barn', 'coop', 'pond', 'smokehouse', 'cellar', 'crock'];
  const order = supplyFirst ? [...SUPPLY, ...STATION_ORDER.filter((x) => !SUPPLY.includes(x))] : STATION_ORDER;
  for (const id of order) {
    if (have.has(id)) continue;
    // Appliances are comforts: they wait until the colony is fed and the grid exists.
    if (APPLIANCE_IDS.has(id) && (!stable || !have.has('generator'))) continue;
    if ((id === 'barn' || id === 'coop' || id === 'pond') && !hasFarm) continue;
    const def = MODULES[id];
    const room = base.interior.rooms.find((r) => !r.module && !r.walled === false);
    if (room) {
      const cost = def.cost(room.area);
      if (!canAfford(base, cost)) {
        // Make the parts rather than waiting for them to appear.
        if (craftMissing(s, base, cost as Record<string, number>)) return;
        continue; // do not wedge the queue on a module we cannot pay
      }
    }
    // Phải chọn phòng khớp vị trí (chuồng/ao/trại cần sân): chọn bừa là queueModule từ chối.
    const fit = base.interior.rooms.find((r) => !r.module && canPlace(base.interior, r, def) === null);
    if (!fit) continue; // hết chỗ phù hợp — thử trạm khác
    if (!queueModule(s, base, fit.id, id)) return;
  }
}

/**
 * Cooking gives morale and health, not calories — so the bot only cooks when it
 * has an ingredient that would otherwise rot, and only when people are unhappy
 * enough for the morale to matter. Plain rice dishes are skipped: pure overhead.
 */
function cookForTheDay(s: GameState, base: Site): void {
  if (base.projects.length > 2) return;
  const st = baseStats(s, base);
  if (!st.kitchen) return;
  const pop = present(s, base).length;
  if (!pop) return;
  const buffer = base.stock.rawFood + base.stock.meals + base.stock.food;
  if (buffer < pop * 2250 * 4) return;
  const home = s.survivors.filter((v) => v.status === 'alive' && v.siteId === base.id);
  const morale = home.length ? home.reduce((a, v) => a + v.morale, 0) / home.length : 100;
  const perishable = ['rau', 'thit', 'ca', 'trung', 'dau'].filter((id) => (base.stock[id] ?? 0) > 0.5);
  if (!perishable.length) return;
  if (morale > 62 && (base.stock.rau ?? 0) < 4) return; // nothing to fix, nothing to save
  const want = ['rd_thit_kho', 'rd_ca_kho', 'rd_com_rau', 'rd_canh', 'rd_dua_muoi', 'rd_trung'];
  for (const id of want) {
    const r = RECIPE_BY_ID[id];
    if (!r) continue;
    if ((base.stock[r.out] ?? 0) > 8) continue;
    if (!r.in.some(([i]) => perishable.includes(i))) continue;
    const why = queueCraft(s, base, id);
    if (!why) return;
  }
}


/** Vật tư lõi phải có sẵn trước khi chế được bất cứ thứ gì. */
const CORE_MATERIALS: [string, number][] = [
  ['charcoal', 4],
  ['thread', 8],
  ['handle', 3],
  ['nail', 10],
  ['blade', 2],
  ['tool_head', 2],
  ['hinge', 4],
  ['plate', 2],
];

/**
 * Bot chế đồ: vật tư lõi trước, rồi vũ khí/giáp cho người chưa có.
 * Trước đây bot chỉ loot nên toàn bộ nhánh chế tạo không hề được mô phỏng.
 */
function craftGear(s: GameState, base: Site): void {
  const people = present(s, base).filter((v) => v.status === 'alive');
  if (!people.length) return;

  for (const [id, want] of CORE_MATERIALS) {
    if ((base.stock[id] ?? 0) >= want) continue;
    const r = RECIPES.find((x) => x.out === id);
    if (!r || !canAfford(base, Object.fromEntries(r.in) as StockDelta)) continue;
    if (!queueCraft(s, base, r.id)) return;
  }

  const share = (pick: (v: (typeof people)[number]) => boolean) => people.filter(pick).length / people.length;
  const needWeapon = share((v) => !!v.gear?.weapon) < 0.6;
  const needBody = share((v) => !!v.gear?.body) < 0.5;
  const needHead = share((v) => !!v.gear?.head) < 0.5;
  if (!needWeapon && !needBody && !needHead) return;

  const score = (id: string) => (ITEMS[id]?.mitigation ?? 0) + (ITEMS[id]?.dmg ?? 0) / 12;
  const pool = RECIPES.filter((r) => {
    const d = ITEMS[r.out];
    if (!d) return false;
    const mech = d.mechanic ?? '';
    if (needWeapon && d.category === 'weapon') return true;
    if (needBody && ['armor_soft', 'armor_plate', 'vest'].includes(mech)) return true;
    if (needHead && ['helmet', 'mask'].includes(mech)) return true;
    return false;
  }).sort((a, b) => score(b.out) - score(a.out));

  for (const r of pool) {
    if (!canAfford(base, Object.fromEntries(r.in) as StockDelta)) continue;
    if (!queueCraft(s, base, r.id)) return; // đã vào hàng đợi, để dành lượt sau
  }
}

/** The bot invests in solar once it has something worth running. */
function solarKit(s: GameState, base: Site): void {
  const st = baseStats(s, base);
  if (!st.generator) return; // power only matters if we are building the grid anyway
  if ((base.stock.solar_panel ?? 0) >= 2 && (base.stock.battery ?? 0) >= 2) return;
  if ((base.stock.plate ?? 0) < 4 || (base.stock.scrap ?? 0) < 40) return;
  if (base.projects.length > 1) return;
  if ((base.stock.solar_panel ?? 0) < 2) queueCraft(s, base, 'r_solar_panel');
  else if ((base.stock.battery ?? 0) < 2) queueCraft(s, base, 'r_battery');
}

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
  buildStations(s, base);
  buildNext(s, base, WANT_BASE);
  for (const f of s.sites.filter((x) => x.kind === 'field')) {
    // Ruộng: chưa có vườn thì gom khoảnh lớn trước, rồi mới đặt vườn lên đó.
    if (!baseStats(s, f).gardenArea && consolidateField(s, f)) continue;
    buildNext(s, f, WANT_FIELD);
    if (!f.projects.length && f.fence.level < 1) queueDefense(s, f, 'fence');
  }
  upgradeStations(s, base);
  cookForTheDay(s, base);
  craftGear(s, base);
  solarKit(s, base);
  autoAssign(s);
  convoys(s, world, base);

  const idle = s.survivors
    .filter((v) => v.status === 'alive' && v.siteId === base.id && v.location === 'base' && !v.commute && v.hp > 50 && v.sickDays === 0)
    .sort((a, b) => b.hp - a.hp)
    .map((v) => v.id);
  if (maybeClaimField(s, world, base, idle)) return;

  // Once a field can water its workers, send day labourers from the base instead of living there.
  const readyPlot = (site: Site) => site.interior.rooms.some((r) => !r.module && r.outdoor && r.area >= 200);
  for (const f of s.sites.filter((x) => x.kind === 'field' && (baseStats(s, x).gardenArea > 0 || x.projects.length > 0 || readyPlot(x)))) {
    const want = Math.max(2, Math.ceil(baseStats(s, f).gardenArea / 700));
    const have = s.survivors.filter((v) => v.status === 'alive' && v.commute?.work === f.id).length;
    for (const id of idle.slice(0, Math.max(0, Math.min(want - have, idle.length - 4)))) {
      setCommute(s, world, id, f.id);
      // Vai trò tại điểm làm: đang có hạng mục cần xây thì xây, xong thì làm nông.
      const v = s.survivors.find((x) => x.id === id);
      if (v) v.role = f.projects.length ? 'builder' : 'farmer';
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
