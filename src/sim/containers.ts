import { ITEMS, type ItemId, type Stock } from '../data/items';

/**
 * Chất lỏng phải có can chứa.
 *
 * Trước đây nước và xăng chỉ bị chặn bằng kg: một người "mang" 20 L nước mà không
 * cần bình nào. Thực tế thì trọng tải là một chuyện, còn đổ được vào đâu là chuyện
 * khác — và đó chính là lý do phải đi tìm can trước khi tính chuyện hút xăng.
 *
 * Một can 20 L nặng 0,43 kg khi rỗng nhưng chở được 15 kg xăng, nên chuyến đi
 * nhiên liệu bị giới hạn bởi số can chứ không bởi sức người.
 */
export const CONTAINER_L: Record<string, number> = {
  can_20l: 20, // can nhựa 20 L, chế được từ sắt vụn
  misc_jerrycan: 20, // Jerrycan (innawoods)
  drink_canteen: 1,
  drink_flask: 1,
  misc_bucket: 10,
  misc_barrel: 200,
};

/** Tổng thể tích chứa của một kho/hành lý, tính bằng lít. */
export function liquidRoom(stock: Partial<Stock> & Record<string, number | undefined>): number {
  let liters = 0;
  for (const [id, n] of Object.entries(stock)) {
    const cap = CONTAINER_L[id];
    if (cap && n) liters += cap * n;
  }
  return liters;
}

/**
 * Bao nhiêu lít đang chiếm can. Nước bẩn KHÔNG tính: nó nằm trong bể hứng mưa
 * (dung tích của module Bể nước), không nằm trong can uống. Tính nó vào đây thì
 * một trận mưa to là hết sạch can và cả đội chết khát dù bể đầy.
 */
export function liquidUsed(stock: Partial<Stock> & Record<string, number | undefined>): number {
  return (stock.water ?? 0) + (stock.fuel ?? 0);
}

/** Còn đổ thêm được bao nhiêu lít. */
export function liquidFree(stock: Partial<Stock> & Record<string, number | undefined>): number {
  return Math.max(0, liquidRoom(stock) - liquidUsed(stock));
}

/** Có ít nhất một can không? Không có can thì không hút được gì. */
export function hasContainer(stock: Partial<Stock> & Record<string, number | undefined>): boolean {
  return liquidRoom(stock) > 0;
}

export function containerLabel(id: ItemId): string {
  return ITEMS[id]?.label ?? id;
}
