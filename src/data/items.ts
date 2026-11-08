import { GENERATED_ITEMS } from './items.generated';
import { MATERIALS } from './materials';

/**
 * Item ids are plain strings on purpose: the registry grows from data files
 * (materials here, innawoods output in items.generated.ts), so a closed union
 * would need editing on every content pass.
 */
export type ItemId = string;

export interface ItemDef {
  label: string;
  unit: string;
  kgPerUnit: number;
  /** UI grouping. */
  category?: string;
  tier?: number;
  /** Which simulation mechanic consumes it (weapon/food/medicine/tool/...). */
  mechanic?: string;
  icon?: string;
  desc?: string;
  subtype?: string;

  // --- equipment ---
  mitigation?: number; // share of incoming damage the item removes
  durability?: number; // fights before it breaks
  biteMult?: number; // <1 means reach: teeth can't get to you
  cls?: string; // heavy | reach | long_blade | sword | axe | short_blade | crowbar | blunt | fist
  noise?: number; // heat added per fight when used
  rare?: boolean;
  capacity?: number; // kg carried (backpack/container)

  // --- consumable ---
  kcal?: number;
  rotPerDay?: number;
  heal?: number;
  cures?: boolean;

  // --- firearm / power ---
  caliber?: string;
  power?: string; // source | store | load
}

/** The 16 items the simulation already understands by name. */
const CORE: Record<string, ItemDef> = {
  food: { label: 'Đồ hộp/khô', unit: 'kcal', kgPerUnit: 1 / 1500, category: 'food', mechanic: 'food', tier: 0 },
  rawFood: { label: 'Gạo/khoai sống', unit: 'kcal', kgPerUnit: 1 / 3000, category: 'food', mechanic: 'food', tier: 0 },
  meals: { label: 'Bữa nấu chín', unit: 'kcal', kgPerUnit: 0, category: 'food', mechanic: 'food', tier: 0 },
  water: { label: 'Nước sạch', unit: 'L', kgPerUnit: 1, category: 'drink', mechanic: 'drink', tier: 0 },
  dirtyWater: { label: 'Nước bẩn/mưa', unit: 'L', kgPerUnit: 1, category: 'drink', mechanic: 'drink', tier: 0 },
  wood: { label: 'Gỗ', unit: 'kg', kgPerUnit: 1, category: 'material', mechanic: 'material', tier: 0 },
  scrap: { label: 'Sắt vụn', unit: 'kg', kgPerUnit: 1, category: 'material', mechanic: 'material', tier: 0 },
  cloth: { label: 'Vải', unit: 'kg', kgPerUnit: 1, category: 'material', mechanic: 'material', tier: 0 },
  medicine: { label: 'Thuốc', unit: 'liều', kgPerUnit: 0.05, category: 'medicine', mechanic: 'medicine', tier: 0 },
  bandage: { label: 'Băng gạc', unit: 'cuộn', kgPerUnit: 0.05, category: 'medicine', mechanic: 'bandage', tier: 0 },
  fuel: { label: 'Xăng', unit: 'L', kgPerUnit: 0.75, category: 'material', mechanic: 'fuel', tier: 0 },
  parts: { label: 'Phụ tùng', unit: 'kg', kgPerUnit: 1, category: 'material', mechanic: 'component', tier: 1 },
  seeds: { label: 'Hạt giống', unit: 'gói', kgPerUnit: 0.05, category: 'material', mechanic: 'seed', tier: 0 },
  tools: { label: 'Dụng cụ', unit: 'bộ', kgPerUnit: 1.5, category: 'tool', mechanic: 'tool', tier: 1 },
  books: { label: 'Sách', unit: 'cuốn', kgPerUnit: 0.5, category: 'misc', mechanic: 'misc', tier: 0 },
  vehicle: { label: 'Xe chạy được', unit: 'chiếc', kgPerUnit: 0, category: 'misc', mechanic: 'vehicle', tier: 1 },
};

/**
 * Everything the game knows about. Order matters: core ids win over generated
 * ones so a catalog item can never shadow `wood` or `water`.
 */
export const ITEMS: Record<string, ItemDef> = { ...GENERATED_ITEMS, ...MATERIALS, ...CORE };

/** Lookup that never throws — UI falls back to the id when a def is missing. */
export const itemDef = (id: string): ItemDef | undefined => ITEMS[id];

export const itemLabel = (id: string): string => ITEMS[id]?.label ?? id;

export const itemKg = (id: string): number => ITEMS[id]?.kgPerUnit ?? 0;

/** Curated order for the existing stock panel; new categories render by `category`. */
export const STOCK_ORDER: ItemId[] = [
  'water',
  'dirtyWater',
  'meals',
  'food',
  'rawFood',
  'wood',
  'scrap',
  'cloth',
  'medicine',
  'bandage',
  'fuel',
  'parts',
  'seeds',
  'tools',
  'books',
  'vehicle',
];

/** Ids that always appear in a fresh stock record. */
export const STOCK_KEYS: string[] = Object.keys(ITEMS);

export type Stock = Record<ItemId, number>;

export const emptyStock = (): Stock => Object.fromEntries(STOCK_KEYS.map((k) => [k, 0])) as Stock;

/**
 * Bring a stock record in line with the current registry: fill missing ids with 0,
 * drop ids the game no longer knows, clamp negatives. Old saves and newly added
 * content both pass through here, so `stock[id]` is always a number afterwards.
 */
export function normalizeStock(stock: Partial<Stock> | undefined): Stock {
  const out = emptyStock();
  for (const [k, v] of Object.entries(stock ?? {})) {
    if (!(k in ITEMS)) continue;
    const n = Number(v);
    out[k] = Number.isFinite(n) && n > 0 ? n : 0;
  }
  return out;
}

export const stockWeight = (s: Partial<Stock>) =>
  Object.entries(s).reduce((w, [k, v]) => w + (v ?? 0) * itemKg(k), 0);
