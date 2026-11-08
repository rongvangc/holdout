export type ItemId =
  | 'food'
  | 'rawFood'
  | 'meals'
  | 'water'
  | 'dirtyWater'
  | 'wood'
  | 'scrap'
  | 'cloth'
  | 'medicine'
  | 'bandage'
  | 'fuel'
  | 'parts'
  | 'seeds'
  | 'tools'
  | 'books'
  | 'vehicle';

export interface ItemDef {
  label: string;
  unit: string;
  kgPerUnit: number;
}

// Food stocks are counted in kcal so the economy maps 1:1 to the vitals model.
export const ITEMS: Record<ItemId, ItemDef> = {
  food: { label: 'Đồ hộp/khô', unit: 'kcal', kgPerUnit: 1 / 1500 },
  rawFood: { label: 'Gạo/khoai sống', unit: 'kcal', kgPerUnit: 1 / 3000 },
  meals: { label: 'Bữa nấu chín', unit: 'kcal', kgPerUnit: 0 },
  water: { label: 'Nước sạch', unit: 'L', kgPerUnit: 1 },
  dirtyWater: { label: 'Nước bẩn/mưa', unit: 'L', kgPerUnit: 1 },
  wood: { label: 'Gỗ', unit: 'kg', kgPerUnit: 1 },
  scrap: { label: 'Sắt vụn', unit: 'kg', kgPerUnit: 1 },
  cloth: { label: 'Vải', unit: 'kg', kgPerUnit: 1 },
  medicine: { label: 'Thuốc', unit: 'liều', kgPerUnit: 0.05 },
  bandage: { label: 'Băng gạc', unit: 'cuộn', kgPerUnit: 0.05 },
  fuel: { label: 'Xăng', unit: 'L', kgPerUnit: 0.75 },
  parts: { label: 'Phụ tùng', unit: 'kg', kgPerUnit: 1 },
  seeds: { label: 'Hạt giống', unit: 'gói', kgPerUnit: 0.05 },
  tools: { label: 'Dụng cụ', unit: 'bộ', kgPerUnit: 1.5 },
  books: { label: 'Sách', unit: 'cuốn', kgPerUnit: 0.5 },
  vehicle: { label: 'Xe chạy được', unit: 'chiếc', kgPerUnit: 0 },
};

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

export type Stock = Record<ItemId, number>;

export const emptyStock = (): Stock =>
  Object.fromEntries(Object.keys(ITEMS).map((k) => [k, 0])) as Stock;

export const stockWeight = (s: Partial<Stock>) =>
  Object.entries(s).reduce((w, [k, v]) => w + (v ?? 0) * ITEMS[k as ItemId].kgPerUnit, 0);
