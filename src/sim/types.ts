import type { EventQueue } from '../core/eventQueue';
import type { Rng } from '../core/rng';
import type { Interior } from '../base/interior';
import type { ItemId, Stock } from '../data/items';
import type { ModuleId } from '../data/modules';
import type { StructId } from '../data/structures';
import type { Vec } from '../world/types';
import type { CropId, Intensity, LawId, Laws, Role, SkillId, TraitId } from './data';

export type TaskKind =
  | 'sleep'
  | 'eat'
  | 'drink'
  | 'rest'
  | 'leisure'
  | 'read'
  | 'build'
  | 'cook'
  | 'boil'
  | 'filter'
  | 'draw'
  | 'plant'
  | 'tend'
  | 'harvest'
  | 'guard'
  | 'treat'
  | 'clean'
  | 'corpses'
  | 'gather'
  | 'expedition'
  | 'quarantine'
  | 'commute';

export interface Task {
  kind: TaskKind;
  intensity: Intensity;
  start: number;
  end: number;
  target?: string;
  amount?: number;
  inBed?: boolean;
}

export interface Survivor {
  id: string;
  name: string;
  age: number;
  background: string;
  traits: TraitId[];
  xp: Record<SkillId, number>;
  /** Chosen self-study skill (Kệ sách); null = đọc ngẫu nhiên. */
  study?: SkillId | null;
  role: Role;
  hp: number;
  kcal: number;
  water: number; // ml
  fatigue: number;
  morale: number;
  infection: number; // 0..100, only rises when infected
  infected: boolean;
  bitten: boolean;
  biteKnown: boolean;
  sickDays: number;
  treatedToday: boolean;
  status: 'alive' | 'dead' | 'gone';
  siteId: string; // home site; 'base' location means "at that site"
  location: 'base' | 'expedition' | 'quarantine';
  commute?: Commute;
  quarantineUntil?: number;
  task: Task | null;
  joinedDay: number;
}

export type ProjectKind = 'module' | 'fortify' | 'fence' | 'partition' | 'structure' | 'craft' | 'repair';

/** Daily walk between where someone sleeps (home) and where they work. */
export interface Commute {
  home: string;
  work: string | null; // null = finishing the last trip home
  sec: number;
  danger: number;
}

export interface Route {
  id: string;
  from: string;
  to: string;
  cargo: Partial<Stock>;
  crew: number;
  everyDays: number;
  nextDay: number;
}

export interface Project {
  id: string;
  kind: ProjectKind;
  roomId?: string;
  module?: ModuleId;
  level?: number;
  /** For kind === 'craft': the recipe being worked. */
  recipe?: string;
  cells?: number[];
  struct?: StructId;
  label: string;
  workTotal: number;
  progress: number;
  cost: Partial<Stock>;
  paid: boolean;
}

export interface Plot {
  roomId: string;
  crop: CropId | null;
  growth: number;
  tendedToday: number;
  plantedDay: number;
}

export interface Weather {
  day: number;
  label: string;
  rainMm: number;
  tempC: number;
  storm: boolean;
  hot: boolean;
}

export interface Expedition {
  id: string;
  kind: 'loot' | 'water' | 'claim' | 'convoy' | 'patrol';
  fromSite: string;
  relocate: boolean; // members stay at the destination instead of returning
  members: string[];
  target: { type: 'building' | 'water' | 'green' | 'site'; id: string; name: string; cell: string; node: number; danger: number };
  mode: 'walk' | 'sneak' | 'car';
  plannedContainers: number;
  phase: 'out' | 'search' | 'back';
  phaseStart: number;
  pathLen: number;
  travelSec: number;
  searchSec: number;
  carried: Partial<Stock>;
  capacityKg: number;
  report: string[];
  recruits: Survivor[];
  fights: number;
  avoided: number;
}

export interface LogEntry {
  t: number;
  msg: string;
  level: 'info' | 'good' | 'warn' | 'bad';
  items?: StockDelta; // materials gained/lost with this entry, shown as icons in the journal
}

export type GameEvent =
  | { k: 'task'; sid: string }
  | { k: 'day' }
  | { k: 'raid'; site: string }
  | { k: 'strangers' }
  | { k: 'routes' }
  | { k: 'exp'; eid: string };

/** One held location: main base, outpost building, or field. Each has its own stockpile. */
export interface Site {
  id: string;
  kind: 'base' | 'outpost' | 'field';
  name: string;
  sourceId: string; // building id or green id in the World
  cell: string;
  node: number;
  centroid: Vec;
  interior: Interior;
  stock: Stock;
  fuelBatches: { liters: number; day: number }[];
  projects: Project[];
  fortify: { level: number; hp: number };
  fence: { level: number; hp: number };
  plots: Record<string, Plot>;
  salvageLeft: { wood: number; scrap: number };
  /** Last few things eaten, newest last — drives monotony. */
  dietLog?: string[];
  /** Day a vegetable/fruit was last eaten; old value = scurvy risk. */
  lastVegDay?: number;
  /** Weapon/armour wear, 0..1 per item stack (absent = new). */
  condition?: Record<ItemId, number>;
  heat: number;
  filth: number;
  corpses: number;
  wellDrawnToday: number;
  /** Đêm có máy phát chạy (đặt ở nhịp ngày, tốn 24 L xăng). */
  powered?: boolean;
  claimedDay: number;
}

export interface GameState {
  version: 2;
  seed: number;
  rng: Rng;
  t: number;
  startDoy: number;
  latitude: number;
  worldKey: string;
  sites: Site[];
  survivors: Survivor[];
  cellHeat: Record<string, number>;
  cellClear: Record<string, number>; // 0..1, how thoroughly patrols have thinned zombies
  routes: Route[];
  looted: Record<string, number>;
  hordeUntilDay: number;
  weather: Weather;
  laws: Laws;
  lawChangedDay: Partial<Record<LawId, number>>;
  expeditions: Expedition[];
  log: LogEntry[];
  alerts: LogEntry[];
  recentDeaths: number;
  stats: { deaths: number; recruited: number; raidsRepelled: number; raidsLost: number; expeditions: number; harvestedKcal: number };
  queue: EventQueue<GameEvent>;
  nextId: number;
  autoRoles: boolean;
  gameOver: boolean;
}

export type StockDelta = Partial<Record<ItemId, number>>;
