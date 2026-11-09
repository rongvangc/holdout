import { ITEMS, type ItemId } from './items';

/**
 * Các nhóm người sống sót khác — nguồn hàng, nguồn tin, và cái giá của lòng tin.
 *
 * Trước đây "người lạ" chỉ là một sự kiện tức thời: gặp, thử, hoặc nhận hoặc đuổi.
 * Nhóm buôn thì tồn tại lâu: họ có giá, có mặt hàng, có ký ức về cách mình đối xử với
 * họ — và họ là cách duy nhất để đổi vật tư dư lấy thứ không chế được (đạn, thuốc).
 */
export interface FactionDef {
  id: string;
  label: string;
  desc: string;
  /** Họ bán đắt hơn giá trị thật bao nhiêu lần. 1 = sòng phẳng. */
  markup: number;
  /** Ngày sớm nhất họ xuất hiện. */
  minDay: number;
  /** Trọng số xuất hiện. */
  weight: number;
  sells: ItemId[];
  buys: ItemId[];
}

const FOOD = ['rawFood', 'meals', 'gao', 'lua_mi', 'khoai_tay', 'ngo', 'rau', 'thit', 'ca', 'trung', 'bot'] as const;
const FUEL = ['fuel', 'wood', 'oil'] as const;
const MATS = ['scrap', 'plate', 'plank', 'nail', 'cloth', 'rope', 'wire', 'gear'] as const;

export const FACTIONS: FactionDef[] = [
  {
    id: 'caravan',
    label: 'Đoàn xe lam',
    desc: 'Dân buôn đường dài, sòng phẳng nhưng không cho nợ. Đổi lương thực và vật tư lấy đạn, thuốc.',
    markup: 1.15,
    minDay: 4,
    weight: 3,
    sells: ['ammo_9x18-ammo', 'ammo_30-06-ammo', 'bandage', 'medicine', 'khang_sinh', 'battery', 'books'],
    buys: [...FOOD, ...FUEL],
  },
  {
    id: 'militia',
    label: 'Dân quân khu phố',
    desc: 'Có súng, có kỷ luật, ghét kẻ cướp. Bán vũ khí và giáp, chỉ lấy vật tư nặng.',
    markup: 1.35,
    minDay: 8,
    weight: 2,
    sells: ['wpn_machete', 'wpn_crowbar', 'arm_s3', 'helm_m1', 'ammo_7-62x39-ammo'],
    buys: [...MATS, ...FUEL],
  },
  {
    id: 'scavs',
    label: 'Nhóm nhặt xác',
    desc: 'Đói và liều. Bán rẻ bất cứ thứ gì vừa vét được, nhưng đòi giá cắt cổ bằng thuốc.',
    markup: 1.8,
    minDay: 3,
    weight: 3,
    sells: ['filter_core', 'tool_shovel', 'wpn_spear', 'cloth', 'rope', 'pack_backpack'],
    buys: ['medicine', 'bandage', 'khang_sinh', 'ammo_9x18-ammo', ...FOOD],
  },
  {
    id: 'farmers',
    label: 'Hợp tác xã ven sông',
    desc: 'Người trồng trọt còn trụ được. Đổi lương thực lấy dụng cụ và thuốc thú y.',
    markup: 1.1,
    minDay: 6,
    weight: 2,
    sells: ['gao', 'lua_mi', 'khoai_tay', 'ngo', 'rau', 'trung', 'bot', 'cam', 'seeds'],
    buys: ['tool_shovel', 'tool_axe', 'rope', 'nail', 'medicine', 'plate'],
  },
];

export const FACTION_BY_ID: Record<string, FactionDef> = Object.fromEntries(FACTIONS.map((f) => [f.id, f]));

/**
 * Giá trị trao đổi quy về "đơn vị hàng" — không phải tiền, chỉ để cân hai bên.
 * Tính từ dữ liệu item (calo, sát thương, giáp, độ hiếm) chứ không bịa bảng giá tay,
 * nên thêm item mới là tự có giá.
 */
export function tradeValue(id: ItemId): number {
  const d = ITEMS[id];
  if (!d) return 1;
  const tier = 1 + 0.35 * Math.max(0, (d.tier ?? 1) - 1);
  const kg = Math.max(0.05, d.kgPerUnit);
  switch (d.category) {
    case 'food':
    case 'drink':
      return Math.max(0.3, ((d.kcal ?? 0) / 2200) * 3 + kg * 0.2);
    case 'medicine':
      return 6 * tier;
    case 'ammo':
      return 1.6 * tier;
    case 'weapon':
      return (4 + (d.dmg ?? 0) * 0.35 + (d.pierce ?? 0) * 2) * tier;
    case 'armor':
      return (5 + (d.mitigation ?? 0) * 20) * tier;
    case 'clothing':
      return (2.5 + (d.insulation ?? 0) * 0.4) * tier;
    case 'electronic':
      return 5 * tier;
    case 'tool':
      return 3.5 * tier;
    case 'component':
    case 'material':
      return 1.5 * tier + kg * 0.15;
    case 'container':
      return 2 + kg * 0.3;
    default:
      return 1 + kg * 0.2;
  }
}

export const stackValue = (stack: [ItemId, number][]): number =>
  stack.reduce((sum, [id, n]) => sum + tradeValue(id) * n, 0);
