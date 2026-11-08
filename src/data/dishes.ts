import type { ItemDef } from './items';

/**
 * Ingredients and dishes.
 *
 * The 76 items mined from innawoods are *loot*: generic calories. These are the
 * cooking layer on top — fresh ingredients that spoil fast, and dishes that turn
 * bulk calories (rawFood) plus one ingredient into something with morale value.
 * That is what makes "bored of the same meal" a real decision instead of flavour
 * text on a single `meals` bucket.
 */
const P = 'icons/innawoods/';

const ing = (label: string, unit: string, kg: number, kcal: number, rot: number, icon: string, desc: string): ItemDef => ({
  label,
  unit,
  kgPerUnit: kg,
  category: 'food',
  mechanic: 'food',
  tier: 0,
  icon,
  kcal,
  rotPerDay: rot,
  desc,
});

const dish = (
  label: string,
  kg: number,
  kcal: number,
  rot: number,
  morale: number,
  desc: string,
  fx?: ItemDef['fx'],
): ItemDef => ({
  label,
  unit: 'phần',
  kgPerUnit: kg,
  category: 'food',
  mechanic: 'food',
  tier: 0,
  kcal,
  rotPerDay: rot,
  morale,
  fx,
  dish: true,
  desc,
});

/** Fresh ingredients: spoil in days, but make every dish worth eating. */
export const INGREDIENTS: Record<string, ItemDef> = {
  rau: ing('Rau tươi', 'kg', 1, 200, 0.35, P + 'items/nutrition/buckwheat__723.png', 'Rau muống, cải, mồng tơi. Hỏng trong 3 ngày.'),
  thit: ing('Thịt tươi', 'kg', 1, 1900, 0.5, P + 'items/nutrition/tinned-meat__266.png', 'Thịt gà/thú bẫy được. Hỏng trong 2 ngày nếu không ướp.'),
  ca: ing('Cá tươi', 'kg', 1, 1300, 0.55, P + 'items/nutrition/soup-stock__263.png', 'Cá sông/ao. Hỏng nhanh, phải kho hoặc hun ngay.'),
  trung: ing('Trứng', 'quả', 0.06, 78, 0.01, P + 'items/nutrition/rice__285.png', 'Trứng gà từ chuồng. Để được lâu hơn thịt.'),
  dau: ing('Đậu hạt', 'kg', 1, 1450, 0.01, P + 'items/nutrition/buckwheat__723.png', 'Đậu nành/đậu phộng. Khô nên để được lâu.'),
  bot: ing('Bột mì/gạo', 'kg', 1, 3500, 0.02, P + 'items/nutrition/rice__285.png', 'Xay từ gạo. Làm bánh, nấu cháo nhanh.'),
  sua: ing('Sữa tươi', 'L', 1, 640, 0.12, P + 'items/nutrition/water-bottle__293.png', 'Sữa dê/bò từ trại chăn nuôi. Hỏng trong 3 ngày nếu không làm phô mai.'),
  pho_mai: ing('Phô mai', 'kg', 1, 3200, 0.004, P + 'items/nutrition/rice__285.png', 'Sữa đặc lại: giữ được hàng tháng, đạm cao.'),
};

/** Dishes: `meals` stays the plain staple; these are what people actually want. */
export const DISHES: Record<string, ItemDef> = {
  mon_com: dish('Cơm trắng', 0.6, 810, 0.4, 0, 'Món nền. No bụng, không có gì để chê nhưng cũng không ai vui.', {
    heal: 2,
  }),
  mon_com_rau: dish('Cơm + rau', 0.8, 880, 0.35, 4, 'Cơm với rau xào. Bữa ăn bình thường của người Việt.', {
    heal: 4,
    vitamin: true,
  }),
  mon_chao: dish('Cháo', 0.9, 500, 0.25, 6, 'Dễ ăn, ấm bụng — món cho người bệnh. Nhanh khỏi, đỡ mệt.', {
    heal: 8,
    fatigue: 15,
    cureDays: 1,
    water: 200,
  }),
  mon_khoai: dish('Khoai luộc', 0.8, 660, 0.15, 0, 'Rẻ, để được lâu, ăn chán nhưng không bao giờ hỏng nhanh.', {
    heal: 1,
  }),
  mon_canh: dish('Canh rau', 0.8, 120, 0.35, 3, 'Bù nước và vitamin. Ăn canh là uống nước.', {
    water: 400,
    vitamin: true,
  }),
  mon_rau_xao: dish('Rau xào', 0.5, 90, 0.3, 4, 'Cần dầu mỡ. Giữ được vitamin.', {
    vitamin: true,
    heal: 3,
  }),
  mon_ca_kho: dish('Cá kho', 0.8, 765, 0.22, 8, 'Món ngon nhất thường ngày. Đạm và canxi.', {
    heal: 6,
    vitamin: true,
  }),
  mon_thit_kho: dish('Thịt kho', 0.9, 1035, 0.22, 10, 'Đám cưới trong nhà tận thế. Hồi sức rõ rệt.', {
    heal: 12,
    fatigue: 10,
  }),
  mon_trung_chien: dish('Trứng chiên', 0.25, 210, 0.18, 6, 'Nhanh, thơm, nhiều đạm — tốt cho người đang lành vết thương.', {
    heal: 10,
  }),
  mon_dau_hu: dish('Đậu hũ', 0.6, 433, 0.3, 3, 'Đạm rẻ từ đậu. Không ngon nhưng bổ và rẻ.', {
    heal: 5,
  }),
  mon_banh_mi: dish('Bánh mì', 0.2, 525, 0.18, 2, 'Cần lò nung. Nhẹ, để được lâu, mang đi viễn chinh được.', {
    travel: true,
    heal: 1,
  }),
  mon_dua_muoi: dish('Dưa muối', 0.3, 60, 0.04, 3, 'Chua, giòn, để được hàng tháng, đủ vitamin C cho cả mùa đông.', {
    vitamin: true,
    cureDays: 1,
  }),
};

/** Everything the cooking layer adds. */
export const FOOD_ITEMS: Record<string, ItemDef> = { ...INGREDIENTS, ...DISHES };
