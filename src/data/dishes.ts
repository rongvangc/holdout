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
  mon_com: dish('Cơm nấu', 0.6, 810, 0.4, 0, 'Món nền. No bụng, không có gì để chê nhưng cũng không ai vui.', {
    heal: 2,
  }),
  mon_com_rau: dish('Cơm trộn rau', 0.8, 880, 0.35, 4, 'Cơm với rau xào. Bữa ăn bình thường của người Việt.', {
    heal: 4,
    vitamin: true,
  }),
  mon_chao: dish('Cháo', 0.9, 500, 0.25, 6, 'Dễ ăn, ấm bụng — món cho người bệnh. Nhanh khỏi, đỡ mệt.', {
    heal: 8,
    fatigue: 15,
    cureDays: 1,
    water: 200,
  }),
  mon_khoai: dish('Củ/hạt luộc', 0.8, 660, 0.15, 0, 'Rẻ, để được lâu, ăn chán nhưng không bao giờ hỏng nhanh.', {
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
  mon_dau_hu: dish('Đậu nấu', 0.6, 433, 0.3, 3, 'Đạm rẻ từ đậu. Không ngon nhưng bổ và rẻ.', {
    heal: 5,
  }),
  mon_banh_mi: dish('Bánh bột nướng', 0.2, 525, 0.04, 2, 'Bánh bột nướng khô: nhẹ, để được lâu, mang đi viễn chinh được.', {
    travel: true,
    heal: 1,
  }),
  mon_dua_muoi: dish('Rau muối chua', 0.3, 60, 0.04, 3, 'Chua, giòn, để được hàng tháng, đủ vitamin C cho cả mùa đông.', {
    vitamin: true,
    cureDays: 1,
  }),
  // --- Đạm rẻ, nướng/kho nhanh: dùng nguyên liệu săn bắt, ao, chuồng ---
  mon_thit_nuong: dish('Thịt nướng', 0.35, 700, 0.25, 6, 'Thịt nướng muối — ăn nóng trong ngày, không mang đi xa được.', {
    heal: 6,
  }),
  mon_ca_nuong: dish('Cá nướng', 0.35, 500, 0.3, 4, 'Cá nướng trên than. Ăn nóng là ngon nhất.', {
    heal: 5,
  }),
  mon_trung_kho: dish('Trứng kho', 0.5, 250, 0.2, 3, 'Trứng kho mặn: giữ được vài ngày trong nhà.', {
    heal: 5,
  }),

  // --- Sữa: bầy cho sữa mỗi ngày, phải có món để dùng ---
  mon_chao_sua: dish('Cháo sữa', 1.0, 690, 0.2, 5, 'Cháo nấu sữa — món cho người mệt, dễ ăn.', {
    heal: 9,
    fatigue: 12,
  }),
  mon_sua_len_men: dish('Sữa lên men', 1.0, 540, 0.03, 5, 'Sữa để lên men: giữ được lâu, tốt cho người đang bệnh.', {
    heal: 5,
    vitamin: true,
  }),
  mon_pho_mai_nuong: dish('Phô mai nướng', 0.35, 430, 0.08, 7, 'Phô mai nướng giòn — món hiếm, ai cũng thích.', {
    heal: 4,
  }),
  mon_banh_pho_mai: dish('Bánh bột phô mai', 0.5, 560, 0.15, 6, 'Bánh bột kẹp phô mai: ăn trong ngày, đạm và béo.', {
    heal: 5,
  }),

  mon_dau_ham: dish('Đậu hầm', 0.9, 620, 0.18, 4, 'Đậu hầm nhừ với lương thực: rẻ, đạm thực vật, no lâu.', {
    heal: 4,
    vitamin: true,
  }),

  // --- Bảo quản: mổ một con là phải giữ được thịt ---
  mon_thit_phoi: dish('Thịt khô', 0.5, 900, 0.015, 4, 'Thịt phơi/hun khô với muối: để được hàng tháng, mang theo được.', {
    heal: 4,
    travel: true,
  }),
  mon_ca_phoi: dish('Cá khô', 0.45, 600, 0.015, 3, 'Cá khô mặn: bảo quản lâu, đạm cao.', {
    heal: 3,
    travel: true,
  }),
  mon_thit_hun: dish('Thịt hun khói', 0.6, 900, 0.03, 8, 'Hun khói bằng củi: thơm, để lâu, tinh thần tốt.', {
    heal: 6,
    travel: true,
  }),

  // --- Đồ uống nấu được (trước đây 62 loại đồ uống đều phải đi lục) ---
  mon_tra_la: dish('Trà lá', 0.6, 10, 0.05, 4, 'Nước lá nóng: ấm bụng, tỉnh người, có nước.', {
    water: 450,
    fatigue: 6,
  }),
  mon_nuoc_dung: dish('Nước dùng', 0.9, 160, 0.12, 5, 'Nước hầm xương/thịt: bù nước và muối, hồi sức nhẹ.', {
    water: 500,
    heal: 4,
  }),
};
/** Icon cho từng món: món nấu lấy icon nguyên liệu gần nhất trong bộ innawoods. */
const DISH_ICONS: Record<string, string> = {
  mon_com: 'items/nutrition/rice__285.png',
  mon_com_rau: 'items/nutrition/soup-stock__263.png',
  mon_chao: 'items/nutrition/soup-stock__263.png',
  mon_khoai: 'items/nutrition/potatoes__456.png',
  mon_canh: 'items/nutrition/soup-stock__263.png',
  mon_rau_xao: 'items/nutrition/buckwheat__723.png',
  mon_ca_kho: 'items/nutrition/soup-stock__263.png',
  mon_thit_kho: 'items/nutrition/tinned-meat__266.png',
  mon_trung_chien: 'items/nutrition/rice__285.png',
  mon_dau_hu: 'items/nutrition/buckwheat__723.png',
  mon_banh_mi: 'items/nutrition/loaf-of-white-bread__2460.png',
  mon_dua_muoi: 'items/nutrition/buckwheat__723.png',
  mon_thit_nuong: 'items/nutrition/tinned-meat__266.png',
  mon_ca_nuong: 'items/nutrition/soup-stock__263.png',
  mon_trung_kho: 'items/nutrition/rice__285.png',
  mon_chao_sua: 'items/nutrition/soup-stock__263.png',
  mon_sua_len_men: 'items/nutrition/water-bottle__293.png',
  mon_pho_mai_nuong: 'items/nutrition/tinned-meat__266.png',
  mon_banh_pho_mai: 'items/nutrition/loaf-of-white-bread__2460.png',
  mon_thit_phoi: 'items/nutrition/tinned-meat__266.png',
  mon_ca_phoi: 'items/nutrition/soup-stock__263.png',
  mon_thit_hun: 'items/nutrition/tinned-meat__266.png',
  mon_tra_la: 'items/nutrition/the-long-dark-sweet-dreams-herbal-tea__1798.png',
  mon_nuoc_dung: 'items/nutrition/soup-stock__263.png',
  mon_dau_ham: 'items/nutrition/buckwheat__723.png',
};
for (const [id, icon] of Object.entries(DISH_ICONS)) if (DISHES[id]) DISHES[id].icon = P + icon;


/** Everything the cooking layer adds. */
export const FOOD_ITEMS: Record<string, ItemDef> = { ...INGREDIENTS, ...DISHES };
