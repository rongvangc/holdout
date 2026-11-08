import type { BuildingCat } from '../world/types';
import type { ItemId } from './items';

/** [item, weight, min, max] per loot roll. */
export type LootEntry = readonly [ItemId, number, number, number];

export interface CatDef {
  label: string;
  color: string;
  per100: number; // containers per 100 m² of floor
  danger: number; // multiplier on cell danger while inside
  loot: readonly LootEntry[];
}

const HOME: LootEntry[] = [
  ['food', 30, 300, 1500],
  ['rawFood', 26, 1500, 8000], // Vietnamese homes keep a sack of rice
  ['water', 18, 1, 4],
  ['cloth', 10, 0.5, 2],
  ['wood', 8, 1, 4],
  ['medicine', 4, 1, 2],
  ['bandage', 4, 1, 2],
  ['tools', 2, 1, 1],
  ['books', 3, 1, 2],
  ['seeds', 1, 1, 2],
];

export const CATS: Record<BuildingCat, CatDef> = {
  house: { label: 'Nhà dân', color: '#8a7f6a', per100: 3, danger: 1, loot: HOME },
  apartment: { label: 'Chung cư', color: '#9a8d72', per100: 2.5, danger: 1.2, loot: HOME },
  shop: {
    label: 'Cửa hàng tiện lợi',
    color: '#c99a3a',
    per100: 5,
    danger: 1.1,
    loot: [
      ['food', 40, 400, 2000],
      ['water', 35, 2, 8],
      ['medicine', 4, 1, 2],
      ['bandage', 4, 1, 3],
      ['cloth', 5, 0.5, 2],
    ],
  },
  supermarket: {
    label: 'Siêu thị',
    color: '#e0b040',
    per100: 3,
    danger: 1.4,
    loot: [
      ['food', 35, 1000, 5000],
      ['rawFood', 25, 2000, 8000],
      ['water', 30, 3, 12],
      ['seeds', 3, 1, 4],
      ['cloth', 4, 1, 3],
      ['tools', 2, 1, 1],
    ],
  },
  market: {
    label: 'Chợ',
    color: '#d08a30',
    per100: 4,
    danger: 1.3,
    loot: [
      ['rawFood', 35, 1500, 6000],
      ['food', 15, 400, 1500],
      ['seeds', 12, 1, 4],
      ['cloth', 15, 1, 4],
      ['tools', 4, 1, 1],
    ],
  },
  pharmacy: {
    label: 'Hiệu thuốc',
    color: '#4fbf8a',
    per100: 6,
    danger: 1.2,
    loot: [
      ['medicine', 50, 2, 8],
      ['bandage', 35, 2, 8],
      ['water', 10, 1, 3],
    ],
  },
  clinic: {
    label: 'Phòng khám',
    color: '#3fa77a',
    per100: 4,
    danger: 1.3,
    loot: [
      ['medicine', 40, 1, 5],
      ['bandage', 40, 2, 6],
      ['cloth', 10, 0.5, 2],
    ],
  },
  hospital: {
    label: 'Bệnh viện',
    color: '#2f8f6a',
    per100: 2,
    danger: 2,
    loot: [
      ['medicine', 35, 1, 6],
      ['bandage', 35, 2, 10],
      ['cloth', 15, 1, 3],
      ['water', 10, 1, 4],
      ['food', 5, 300, 1000],
    ],
  },
  school: {
    label: 'Trường học',
    color: '#6a8fc9',
    per100: 1.5,
    danger: 1.4,
    loot: [
      ['books', 35, 1, 4],
      ['wood', 25, 2, 8],
      ['food', 15, 300, 1500],
      ['water', 15, 1, 4],
      ['bandage', 5, 1, 3],
      ['cloth', 5, 0.5, 2],
    ],
  },
  police: {
    label: 'Đồn công an',
    color: '#4a6fd0',
    per100: 2,
    danger: 1.8,
    loot: [
      ['tools', 25, 1, 2],
      ['scrap', 20, 1, 4],
      ['bandage', 20, 1, 4],
      ['medicine', 15, 1, 3],
      ['food', 15, 400, 1500],
      ['fuel', 5, 1, 4],
    ],
  },
  fuel: {
    label: 'Trạm xăng',
    color: '#c05050',
    per100: 4,
    danger: 1.3,
    loot: [
      ['fuel', 45, 2, 10],
      ['food', 20, 400, 1500],
      ['water', 20, 1, 4],
      ['parts', 15, 1, 3],
    ],
  },
  hardware: {
    label: 'Cửa hàng vật liệu',
    color: '#a06a40',
    per100: 4,
    danger: 1.2,
    loot: [
      ['wood', 25, 3, 10],
      ['scrap', 25, 2, 8],
      ['tools', 20, 1, 2],
      ['parts', 15, 1, 3],
      ['seeds', 15, 1, 3],
    ],
  },
  car_repair: {
    label: 'Gara sửa xe',
    color: '#905050',
    per100: 2.5,
    danger: 1.4,
    loot: [
      ['parts', 35, 1, 4],
      ['scrap', 30, 2, 8],
      ['fuel', 20, 1, 5],
      ['tools', 14, 1, 1],
      ['vehicle', 1, 1, 1],
    ],
  },
  industrial: {
    label: 'Nhà xưởng/kho',
    color: '#707070',
    per100: 1,
    danger: 1.2,
    loot: [
      ['scrap', 35, 4, 12],
      ['wood', 30, 2, 8],
      ['parts', 15, 1, 3],
      ['cloth', 15, 1, 4],
      ['fuel', 5, 1, 4],
    ],
  },
  office: {
    label: 'Văn phòng',
    color: '#7a7a90',
    per100: 1.5,
    danger: 1.1,
    loot: [
      ['water', 30, 1, 3],
      ['food', 20, 200, 800],
      ['books', 20, 1, 3],
      ['cloth', 15, 0.5, 2],
      ['bandage', 15, 1, 2],
    ],
  },
  religious: {
    label: 'Chùa/nhà thờ',
    color: '#b080c0',
    per100: 1,
    danger: 0.9,
    loot: [
      ['food', 35, 300, 1500],
      ['rawFood', 25, 1000, 3000],
      ['cloth', 20, 1, 3],
      ['water', 20, 1, 4],
    ],
  },
  food_place: {
    label: 'Quán ăn',
    color: '#d07040',
    per100: 4,
    danger: 1.1,
    loot: [
      ['rawFood', 40, 1000, 4000],
      ['food', 25, 300, 1200],
      ['water', 25, 1, 6],
      ['wood', 10, 1, 4],
    ],
  },
  generic: { label: 'Toà nhà', color: '#666058', per100: 2, danger: 1, loot: HOME },
};
