import type { Site } from './types';
import { FARM_M2_PER_WORKER, TEND_H_PER_M2_DAY, CROPS } from './data';
import { HERDS, herdBudget, type HerdState } from './livestock';

/**
 * Một nguồn sự thật cho mọi con số quy mô.
 *
 * Trước đây mỗi hệ tự đặt hằng số riêng (TEND 0,003 hay 0,008; 1 nông dân 750 hay
 * 1.200 hay 6.000 m²; raid 0,6+0,4 hay 0,25+0,75…), nên sửa chỗ này là vỡ chỗ kia.
 * Nguyên tắc: T0 (sinh học) và T1 (năng suất) được ĐỊNH NGHĨA, mọi thứ khác SUY RA.
 */

// --- T0: sinh học (không sửa khi cân bằng) ----------------------------------
export const KCAL_PER_PERSON_DAY = 2250;
export const WATER_PER_PERSON_DAY = 3.3;
/** Ngày công thực tế của một người. */
export const WORK_HOURS_PER_DAY = 10;

// --- T1: năng suất đơn vị (lấy từ dữ liệu thực) ----------------------------
export const RAU_KCAL_PER_M2_DAY = CROPS.rau.kcalPerM2 / CROPS.rau.days;
export const KHOAI_KCAL_PER_M2_DAY = CROPS.khoai.kcalPerM2 / CROPS.khoai.days;

// --- T2: năng lực một người (suy ra, không đặt tay) ------------------------
/** Nông dân chăm được bao nhiêu m² (đã khớp với TEND và ngày công). */
export const FARM_M2_ONE_WORKER = FARM_M2_PER_WORKER;
/** Số m² cần để nuôi một người bằng khoai (cây calo). */
export const M2_PER_PERSON = KCAL_PER_PERSON_DAY / KHOAI_KCAL_PER_M2_DAY;
/** Kiểm tra ràng buộc: một người chăm FARM_M2_ONE_WORKER mất bao nhiêu giờ. */
export const FARM_HOURS_PER_WORKER = FARM_M2_ONE_WORKER * TEND_H_PER_M2_DAY;
/** Một nông dân nuôi được bao nhiêu người (kcal). */
export const PEOPLE_PER_FARMER = FARM_M2_ONE_WORKER / M2_PER_PERSON;

// --- T3: trần của một điểm -------------------------------------------------
export interface SiteCapacity {
  /** m² vườn hiện có. */
  gardenM2: number;
  /** Số người vườn hiện tại nuôi được (kcal). */
  fromCrops: number;
  /** Số người phần đạm của bầy tương đương (chỉ tính phần có lãi). */
  fromHerds: number;
  /** Trần dân số của điểm = cây trồng + đạm gia súc. */
  ceiling: number;
}

/**
 * Trần dân số theo lãnh thổ: vườn nuôi bao nhiêu người, cộng phần đạm của bầy.
 *
 * Gia súc gần như luôn lỗ calo (xem herdBudget) nên chỉ cộng phần **đạm**: mỗi
 * 5 con dê chăn thả ≈ 1 người ăn; bầy lỗ nặng (lợn/bò nuôi bằng cám) không cộng gì.
 */
export function siteCapacity(site: Site, herds: { state: HerdState; graze: number }[] = []): SiteCapacity {
  const gardenM2 = site.interior.rooms
    .filter((r) => r.module === 'garden' || r.module === 'herb_garden')
    .reduce((a, r) => a + r.area, 0);
  const crops = gardenM2 * KHOAI_KCAL_PER_M2_DAY;
  const fromCrops = crops / KCAL_PER_PERSON_DAY;
  const fromHerds = herds.reduce((a, { state, graze }) => {
    const b = herdBudget(state, graze);
    // Chỉ tính bầy không lỗ: phần đạm/ngày quy ra "một người ăn" (≈ 0,2 phần đạm/người).
    if (b.net < 0) return a;
    return a + b.proteinServings / 5;
  }, 0);
  return { gardenM2, fromCrops, fromHerds, ceiling: Math.max(0, fromCrops + fromHerds) };
}

/** Số nông dân cần cho diện tích vườn hiện có. */
export const farmersFor = (gardenM2: number): number => (gardenM2 >= 20 ? Math.ceil(gardenM2 / FARM_M2_ONE_WORKER) : 0);

/** Sức chứa nước uống của điểm (bể + 300 L nền). */
export const waterStockDays = (litres: number, population: number): number => litres / Math.max(1, population) / WATER_PER_PERSON_DAY;

/**
 * Ngân sách tập kích một đêm: tối đa bằng 0,9 lần "sức lao động" của điểm.
 * Trước đây sức tập kích tính theo NGÀY tuyệt đối nên nhóm 2 người vẫn phải chịu
 * đợt dành cho 10 người → thua 28–38 trận/ván và bị quét sạch.
 */
export const raidBudget = (defenders: number, heat = 0): number => {
  const labour = Math.max(1, defenders);
  return labour * 0.9 * (1 + Math.min(0.6, heat / 150));
};

/** Đạm/ngày của tất cả bầy ở điểm (phần ăn có đạm). */
export const proteinPerDay = (herds: { state: HerdState; graze: number }[]): number =>
  herds.reduce((a, { state, graze }) => a + Math.max(0, herdBudget(state, graze).proteinServings), 0);

export { HERDS };
