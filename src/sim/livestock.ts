import type { Green, WaterPoint, World } from '../world/types';
import type { Rng } from '../core/rng';
import { chance, range } from '../core/rng';
import type { Site } from './types';

/**
 * Gia súc/gia cầm theo vùng, mô phỏng theo nhịp sinh học thật.
 *
 * Mỗi chuồng/trại giữ một bầy (`HerdState`), không phải một con số sản lượng:
 * gà đẻ theo nhịp trứng/ngày, con cái động dục → mang thai → đẻ → nuôi con (cho sữa)
 * → con non lớn thành con trưởng thành. Mổ thịt thì mất một con và được thịt theo
 * khối lượng thật của loài.
 *
 * Đơn vị thời gian là NGÀY trong game.
 */
export type HerdKind = 'ga' | 'vit' | 'de' | 'lon' | 'bo' | 'trau';

export type HerdModule = 'coop' | 'barn';

export interface HerdBiology {
  label: string;
  module: HerdModule;
  /** Giống cái trưởng thành cho trứng: 1 quả mỗi X ngày. 0 = không đẻ trứng. */
  eggEvery: number;
  /** Sữa mỗi con đang cho bú, mỗi ngày (L). */
  milkPerDay: number;
  /** Số ngày cho sữa sau khi đẻ. */
  lactationDays: number;
  /** Bao lâu thì động dục lại (ngày). */
  estrusDays: number;
  /** Mang thai bao nhiêu ngày. */
  gestationDays: number;
  /** Số con mỗi lứa (trung bình). */
  litter: number;
  /** Con non lớn thành trưởng thành sau bao nhiêu ngày. */
  maturityDays: number;
  /** Tỷ lệ con non sống tới trưởng thành (không bệnh tật, chỉ là hao hụt tự nhiên). */
  weanSurvival: number;
  /** Khối lượng trưởng thành (kg) và tỷ lệ thịt/thân. */
  adultKg: number;
  dressing: number;
  /** Diện tích cần cho mỗi con (m²). */
  m2PerHead: number;
  /** Ăn bao nhiêu kg cám/cỏ mỗi con mỗi ngày (con non = 40%). */
  feedPerDay: number;
  /** Nước uống mỗi con mỗi ngày (L). */
  waterPerDay: number;
  /** Ồn mỗi ngày. */
  heat: number;
  desc: string;
}

/**
 * Nhịp sinh học lấy từ chăn nuôi thật (Vịt/gà: nhịp đẻ trứng; dê/lợn/bò: động dục
 * 21 ngày, thời gian mang thai và thời gian bú theo loài).
 */
export const HERDS: Record<HerdKind, HerdBiology> = {
  ga: {
    label: 'Gà',
    module: 'coop',
    eggEvery: 1.6, // gà ta: ~1 quả/1,5–2 ngày (gà công nghiệp mới đẻ hằng ngày)
    milkPerDay: 0,
    lactationDays: 0,
    estrusDays: 21,
    gestationDays: 21, // ấp trứng
    litter: 6,
    maturityDays: 150,
    weanSurvival: 0.7,
    adultKg: 1.8,
    dressing: 0.7,
    m2PerHead: 0.25,
    feedPerDay: 0.09,
    waterPerDay: 0.3,
    heat: 0.02,
    desc: 'Gà ta: 1 quả trứng mỗi ~1,6 ngày/con mái. Ấp 21 ngày, 6 con/lứa, 5 tháng mới lớn.',
  },
  vit: {
    label: 'Vịt',
    module: 'coop',
    eggEvery: 1.4,
    milkPerDay: 0,
    lactationDays: 0,
    estrusDays: 21,
    gestationDays: 28, // ấp
    litter: 8,
    maturityDays: 180,
    weanSurvival: 0.65,
    adultKg: 2.5,
    dressing: 0.68,
    m2PerHead: 0.35,
    feedPerDay: 0.12,
    waterPerDay: 0.9,
    heat: 0.03,
    desc: 'Vịt: ~1 quả/1,4 ngày/con mái, cần nước. Ấp 28 ngày, 8 con/lứa.',
  },
  de: {
    label: 'Dê',
    module: 'barn',
    eggEvery: 0,
    milkPerDay: 2.0,
    lactationDays: 240,
    estrusDays: 21,
    gestationDays: 150,
    litter: 1.7,
    maturityDays: 300,
    weanSurvival: 0.8,
    adultKg: 35,
    dressing: 0.48,
    m2PerHead: 1.5,
    feedPerDay: 0.9,
    waterPerDay: 4,
    heat: 0.05,
    desc: 'Dê: động dục 21 ngày, mang thai 150 ngày, 1–2 con/lứa, cho sữa 240 ngày sau khi đẻ.',
  },
  lon: {
    label: 'Lợn',
    module: 'barn',
    eggEvery: 0,
    milkPerDay: 0.4,
    lactationDays: 45,
    estrusDays: 21,
    gestationDays: 114,
    litter: 8,
    maturityDays: 210,
    weanSurvival: 0.75,
    adultKg: 90,
    dressing: 0.72,
    m2PerHead: 1.2,
    feedPerDay: 2.4,
    waterPerDay: 8,
    heat: 0.1,
    desc: 'Lợn: mang thai 114 ngày, 8–10 con/lứa, 7 tháng xuất chuồng (~65 kg thịt).',
  },
  bo: {
    label: 'Bò',
    module: 'barn',
    eggEvery: 0,
    milkPerDay: 8,
    lactationDays: 300,
    estrusDays: 21,
    gestationDays: 283,
    litter: 1,
    maturityDays: 540,
    weanSurvival: 0.85,
    adultKg: 350,
    dressing: 0.55,
    m2PerHead: 4,
    feedPerDay: 8,
    waterPerDay: 35,
    heat: 0.15,
    desc: 'Bò sữa: mang thai 283 ngày, 1 con/lứa, cho 8 L sữa/ngày trong 300 ngày sau khi đẻ.',
  },
  trau: {
    label: 'Trâu',
    module: 'barn',
    eggEvery: 0,
    milkPerDay: 2.2,
    lactationDays: 240,
    estrusDays: 21,
    gestationDays: 330,
    litter: 1,
    maturityDays: 600,
    weanSurvival: 0.85,
    adultKg: 400,
    dressing: 0.5,
    m2PerHead: 4.5,
    feedPerDay: 9,
    waterPerDay: 40,
    heat: 0.15,
    desc: 'Trâu: mang thai 330 ngày, 1 con/lứa, sữa ít nhưng thịt nhiều, kéo cày khoẻ.',
  },
};

/** Bầy trong một chuồng/trại. Tất cả là số đếm, thời gian tính bằng ngày. */
export interface HerdState {
  kind: HerdKind;
  /** Con trưởng thành (đực + cái). */
  adults: number;
  /** Con đực trưởng thành — cần có để sinh sản. */
  males: number;
  /** Con non chưa lớn. */
  young: number;
  /** Số ngày còn lại tới khi lứa non hiện tại lớn. */
  youngIn: number;
  /** Con cái đang mang thai. */
  pregnant: number;
  /** Ngày còn lại tới khi đẻ (lứa gần nhất). */
  dueIn: number;
  /** Con cái đang cho sữa. */
  lactating: number;
  /** Ngày còn lại của kỳ cho sữa. */
  lactationIn: number;
  /** Trứng tích luỹ (phần lẻ) — gà đẻ theo nhịp, không phải số nguyên mỗi ngày. */
  eggDebt: number;
  /** Ngày tích luỹ cho tới lần động dục tiếp theo. */
  estrusIn: number;
}

const females = (h: HerdState) => Math.max(0, h.adults - h.males);

/** Bầy khởi đầu khi xây xong: đủ con giống, có con đang mang thai/cho sữa để dùng được ngay. */
export function startingHerd(kind: HerdKind, capacity: number): HerdState {
  const bio = HERDS[kind];
  const heads = Math.max(2, Math.min(capacity, kind === 'ga' || kind === 'vit' ? 8 : 3));
  const males = Math.max(1, Math.round(heads * (bio.litter > 1 ? 0.2 : 0.34)));
  const lactating = bio.milkPerDay > 0 ? Math.max(1, Math.floor((heads - males) / 2)) : 0;
  return {
    kind,
    adults: heads,
    males: Math.min(males, heads - 1),
    young: 0,
    youngIn: 0,
    pregnant: bio.litter > 1 ? 1 : 0,
    dueIn: bio.litter > 1 ? Math.round(bio.gestationDays * 0.6) : 0,
    lactating,
    lactationIn: lactating ? Math.round(bio.lactationDays * 0.7) : 0,
    eggDebt: 0,
    estrusIn: bio.estrusDays,
  };
}

export interface HerdTick {
  eggs: number;
  milk: number;
  births: number;
  grown: number;
  /** Con chết vì thiếu ăn/nước (hao hụt, không phải dịch bệnh). */
  lost: number;
  /** Thịt thu được nếu mổ (0 nếu không mổ). */
  meat: number;
  /** Con bị mổ. */
  slaughtered: number;
  events: string[];
}

/**
 * Một ngày của bầy. `care` = 0..1 mức chăm (đủ ăn/uống, có người trông);
 * `cap` = số con tối đa theo diện tích chuồng.
 */
export function tickHerd(h: HerdState, cap: number, care: number, rng: Rng, slaughter = 0): HerdTick {
  const bio = HERDS[h.kind];
  const out: HerdTick = { eggs: 0, milk: 0, births: 0, grown: 0, lost: 0, meat: 0, slaughtered: 0, events: [] };
  const hens = females(h);

  // 1) Trứng: mỗi con mái đẻ 1 quả mỗi `eggEvery` ngày. Phần lẻ tích lại.
  if (bio.eggEvery > 0 && hens > 0) {
    h.eggDebt += (hens / bio.eggEvery) * (0.5 + 0.5 * care);
    const whole = Math.floor(h.eggDebt);
    if (whole > 0) {
      out.eggs = whole;
      h.eggDebt -= whole;
    }
  }

  // 2) Sữa: chỉ con đang trong kỳ cho sữa (sau khi đẻ).
  if (bio.milkPerDay > 0 && h.lactating > 0) {
    out.milk = h.lactating * bio.milkPerDay * (0.35 + 0.65 * care);
    h.lactationIn -= 1;
    if (h.lactationIn <= 0) {
      out.events.push(`${bio.label}: hết kỳ cho sữa, cần phối lại mới có sữa.`);
      h.lactating = 0;
    }
  }

  // 3) Sinh sản: con cái động dục → mang thai → đẻ. Cần con đực.
  const room = Math.max(0, cap - (h.adults + h.young));
  h.estrusIn -= 1;
  if (h.estrusIn <= 0) {
    h.estrusIn = bio.estrusDays;
    const free = females(h) - h.pregnant;
    if (h.males >= 1 && free > 0 && h.pregnant < Math.max(1, Math.floor(free * 0.5)) && care > 0.35) {
      h.pregnant += 1;
      if (h.pregnant === 1 || h.dueIn <= 0) h.dueIn = bio.gestationDays;
    }
  }
  if (h.pregnant > 0 && h.dueIn > 0) {
    h.dueIn -= 1;
    if (h.dueIn <= 0) {
      const litter = Math.max(1, Math.round(bio.litter * range(rng, 0.75, 1.25)));
      const born = Math.min(litter, Math.max(1, room + h.pregnant));
      h.young += born;
      h.youngIn = h.youngIn > 0 ? Math.min(h.youngIn, bio.maturityDays) : bio.maturityDays;
      h.pregnant -= 1;
      out.births = born;
      if (bio.milkPerDay > 0) {
        h.lactating += 1;
        h.lactationIn = bio.lactationDays;
      }
      out.events.push(`${bio.label}: đẻ ${born} con.`);
      h.dueIn = h.pregnant > 0 ? bio.gestationDays : 0;
    }
  }

  // 4) Con non lớn: tới tuổi trưởng thành thì vào đàn sinh sản (hao hụt tự nhiên).
  if (h.young > 0 && h.youngIn > 0) {
    h.youngIn -= 1;
    if (h.youngIn <= 0) {
      const survivors = Math.min(h.young, Math.round(h.young * bio.weanSurvival));
      out.grown = survivors;
      h.adults += survivors;
      h.males += Math.round(survivors * (h.adults > 0 ? h.males / Math.max(1, h.adults) : 0.2));
      h.males = Math.min(h.males, h.adults - 1);
      h.young = Math.max(0, h.young - survivors);
      h.youngIn = h.young > 0 ? bio.maturityDays : 0;
      if (survivors > 0) out.events.push(`${bio.label}: ${survivors} con non đã lớn.`);
    }
  }

  // 5) Mổ thịt: mất một con trưởng thành, thịt theo khối lượng thật.
  const want = Math.min(slaughter, Math.max(0, h.adults - 2)); // giữ lại giống
  if (want > 0) {
    // Mổ con đực trước (giữ con cái sinh sản), chỉ khi hết đực mới mổ cái.
    for (let i = 0; i < want; i++) {
      if (h.males > 1) h.males -= 1;
      h.adults -= 1;
    }
    h.males = Math.min(h.males, h.adults);
    const kg = bio.adultKg * bio.dressing * range(rng, 0.85, 1.05) * want;
    out.meat = Math.round(kg * 10) / 10;
    out.slaughtered = want;
    out.events.push(`${bio.label}: mổ ${want} con được ${out.meat} kg thịt.`);
  }

  // 6) Thiếu chăm: bầy gầy và có thể hao hụt (không có dịch bệnh, chỉ là đói/khát).
  if (care < 0.25 && h.adults > 1 && chance(rng, 0.25)) {
    h.adults -= 1;
    h.males = Math.min(h.males, h.adults);
    out.lost = 1;
    out.events.push(`${bio.label}: một con chết vì đói/khát.`);
  }

  // Trần diện tích: bầy quá đông thì hao hụt.
  while (h.adults + h.young > cap && h.adults > 1) {
    h.adults -= 1;
    h.males = Math.min(h.males, h.adults);
    out.lost += 1;
    if (out.lost === 1) out.events.push(`${bio.label}: chuồng chật, một con bị loại.`);
  }
  return out;
}

/** Cám/cỏ quy ra kcal: 1 kg thức ăn khô ≈ 3.000 kcal (gạo, ngô, cỏ khô). */
export const FEED_KCAL_PER_KG = 3000;

/**
 * Tổng nhu cầu ăn/uống của bầy trong ngày.
 *
 * `feed` trả về **kcal** (khớp đơn vị của kho `rawFood`); trước đây trả kg nên bầy
 * chỉ "ăn" vài kcal mỗi ngày — gia súc gần như miễn phí.
 *
 * `graze` = 0..1: phần ăn tự kiếm được (cỏ ở ruộng). Động vật nhai lại (dê/bò/trâu)
 * sống gần như hoàn toàn bằng cỏ; lợn/gia cầm vẫn cần cám.
 */
const GRAZE_EFFICIENCY: Record<HerdKind, number> = {
  ga: 0.35,
  vit: 0.4,
  de: 0.85,
  lon: 0.45,
  bo: 0.8,
  trau: 0.8,
};

export const herdNeeds = (h: HerdState, graze = 0): { feed: number; feedKg: number; water: number } => {
  const bio = HERDS[h.kind];
  const heads = h.adults + h.young * 0.4;
  const feedKg = heads * bio.feedPerDay;
  const covered = Math.min(1, Math.max(0, graze)) * GRAZE_EFFICIENCY[h.kind];
  return {
    feed: feedKg * FEED_KCAL_PER_KG * (1 - covered),
    feedKg: feedKg * (1 - covered),
    water: heads * bio.waterPerDay,
  };
};

/** Số con tối đa một chuồng/trại chứa được theo diện tích. */
export const herdCapacity = (area: number, kind: HerdKind): number =>
  Math.max(2, Math.floor(area / HERDS[kind].m2PerHead));

/** Thịt thu được nếu mổ `n` con (dùng cho preview UI). */
export const estimateMeat = (kind: HerdKind, n: number): number =>
  Math.round(HERDS[kind].adultKg * HERDS[kind].dressing * n * 10) / 10;

// --- Vùng: loài nào sống được ở đâu -----------------------------------------

const nearWater = (world: World, site: Site, metres = 400): boolean => {
  const [x, y] = site.centroid;
  return world.waterPoints.some((w: WaterPoint) => Math.hypot(w.pos[0] - x, w.pos[1] - y) <= metres);
};

const farmlandNearby = (world: World, site: Site, metres = 1200): number => {
  const [x, y] = site.centroid;
  return world.greens.reduce((sum, g: Green) => {
    const d = Math.hypot(g.centroid[0] - x, g.centroid[1] - y);
    return d <= metres ? sum + g.area : sum;
  }, 0);
};

const northern = (world: World): boolean => (world.center?.[0] ?? 16) > 16;

/**
 * Vùng quyết định loài: vịt ở gần nước, trâu ở đồng bằng miền Bắc, bò ở đồng bằng
 * miền Nam, lợn ở vùng ruộng vừa, dê/gà trong phố.
 */
export function localHerds(world: World, site: Site): { coop: HerdKind; barn: HerdKind } {
  const water = nearWater(world, site);
  const farmland = farmlandNearby(world, site);
  const open = farmland > 20_000;
  const coop: HerdKind = water ? 'vit' : 'ga';
  let barn: HerdKind;
  if (open) barn = northern(world) && water ? 'trau' : 'bo';
  else if (farmland > 6_000) barn = 'lon';
  else barn = 'de';
  return { coop, barn };
}

export function herdFor(world: World, site: Site, module: HerdModule, stored?: HerdKind): HerdKind {
  if (stored) return stored;
  return localHerds(world, site)[module];
}

/**
 * Ngân sách của một bầy trong một ngày: thu (trứng/sữa/thịt khấu hao) − chi (cám/cỏ).
 *
 * Chăn nuôi **không phải nguồn calo**: gà lỗ ~950 kcal/ngày, lợn lỗ ~19.000, bò lỗ
 * ~13.000 ngay cả khi có cỏ. Nó là nguồn **đạm + tinh thần** và là "bảo hiểm" khi đói.
 * Chỉ dê/bò/trâu chăn thả trên ruộng mới dương, vì cỏ không tranh với người.
 */
export interface HerdBudget {
  /** kcal thu được mỗi ngày (trứng, sữa, thịt khấu hao theo thời gian lớn). */
  gain: number;
  /** kcal cám/cỏ phải bỏ ra mỗi ngày. */
  feed: number;
  /** gain − feed. Âm là bình thường. */
  net: number;
  water: number;
  m2: number;
  /** Số phần ăn có đạm mỗi ngày (trứng/sữa/thịt) — thứ chăn nuôi thực sự mang lại. */
  proteinServings: number;
}

const KCAL = { trung: 78, sua: 640, thit: 1900 };

export function herdBudget(h: HerdState, graze = 0): HerdBudget {
  const bio = HERDS[h.kind];
  const hens = Math.max(0, h.adults - h.males);
  const eggs = bio.eggEvery > 0 ? (hens / bio.eggEvery) * KCAL.trung : 0;
  const milk = h.lactating * bio.milkPerDay * KCAL.sua;
  const meat = (h.adults * bio.adultKg * bio.dressing * KCAL.thit) / Math.max(1, bio.maturityDays);
  const gain = eggs + milk + meat;
  const need = herdNeeds(h, graze);
  const heads = h.adults + h.young * 0.4;
  const proteinServings =
    (bio.eggEvery > 0 ? hens / bio.eggEvery : 0) + h.lactating * (bio.milkPerDay / 0.25) * 0.2 + (h.adults * 0.2) / Math.max(1, bio.maturityDays / 30);
  return {
    gain,
    feed: need.feed,
    net: gain - need.feed,
    water: need.water,
    m2: heads * bio.m2PerHead,
    proteinServings: Math.round(proteinServings * 10) / 10,
  };
}
