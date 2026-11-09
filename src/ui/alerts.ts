import { dayOf } from '../core/time';
import { stapleKcal } from '../data/staples';
import { baseStats, present } from '../sim/state';
import { siteCapacity } from '../sim/scale';
import type { GameState, Site } from '../sim/types';
import type { TabId } from './shell/TopStrip';

/**
 * "Cần quyết định" — the H2 list from design/ux/hud.md.
 *
 * The HUD spec caps this at three rows, one action each, and requires that a row
 * leads to the place where it can be fixed (requirement R1 in design/ux/base.md).
 * That is why every decision carries a `tab` plus an optional `panel`: the caller
 * switches tab and opens the matching section.
 */
export type DecisionLevel = 'bad' | 'warn';
export type PanelId = 'kitchen' | 'gear' | 'power' | 'craft' | 'defence';

export interface Decision {
  id: string;
  level: DecisionLevel;
  text: string;
  /** Short verb for the row's single button. */
  action: string;
  tab: TabId;
  panel?: PanelId;
}

export const MAX_DECISIONS = 3;

const days = (site: Site, population: number) => {
  const pop = Math.max(1, population);
  return {
    food: (site.stock.food + site.stock.meals + stapleKcal(site.stock)) / (pop * 2250),
    water: site.stock.water / (pop * 3.3),
  };
};

/**
 * Rank by "how soon this kills someone", then take the top three.
 * Pure: no mutation, no RNG, so the HUD list never drifts from the sim.
 */
export function decide(s: GameState, site: Site): Decision[] {
  const st = baseStats(s, site);
  const here = present(s, site);
  const pop = here.length;
  const { food, water } = days(site, pop);
  const out: Decision[] = [];

  const bleeding = here.filter((v) => (v.bleed ?? 0) > 0).length;
  const septic = here.filter((v) => v.infected).length;
  const sick = here.filter((v) => v.sickDays > 0).length;

  if (pop === 0) {
    return [
      {
        id: 'empty',
        level: 'warn',
        text: 'Không có ai ở điểm này — không thể làm gì',
        action: 'Xem người',
        tab: 'people',
      },
    ];
  }

  if (septic > 0) {
    out.push({
      id: 'sepsis',
      level: 'bad',
      text: `${septic} người bị nhiễm trùng`,
      action: 'Chữa',
      tab: 'people',
    });
  }
  if (bleeding > 0) {
    out.push({
      id: 'bleed',
      level: 'bad',
      text: `${bleeding} người đang chảy máu`,
      action: 'Cầm máu',
      tab: 'people',
    });
  }
  if (food < 3) {
    out.push({
      id: 'food',
      level: 'bad',
      text: `Lương thực còn ${food.toFixed(1)} ngày`,
      action: 'Nấu',
      tab: 'base',
      panel: 'kitchen',
    });
  }
  if (water < 2) {
    out.push({
      id: 'water',
      level: 'bad',
      text: `Nước uống còn ${water.toFixed(1)} ngày`,
      action: 'Lấy nước',
      tab: 'map',
    });
  }
  // An empty defence on a night the game is willing to raid is the classic silent death.
  const hordeTonight = dayOf(s.t) <= s.hordeUntilDay;
  if (st.defenseStatic < 15 && (hordeTonight || s.t / 86400 > 6)) {
    out.push({
      id: 'defence',
      level: st.defenseStatic <= 0 ? 'bad' : 'warn',
      text:
        st.defenseStatic <= 0
          ? 'Không có phòng thủ nào — tập kích đêm sẽ vào nhà'
          : `Phòng thủ mỏng (${Math.round(st.defenseStatic)})`,
      action: 'Gia cố',
      tab: 'base',
      panel: 'defence',
    });
  }
  const unpaid = site.projects.filter((p) => !p.paid).length;
  if (unpaid > 0) {
    out.push({
      id: 'queue',
      level: 'warn',
      text: `${unpaid} hạng mục chờ vật tư`,
      action: 'Xem',
      tab: 'base',
      panel: 'craft',
    });
  }
  if (st.beds < pop) {
    out.push({
      id: 'beds',
      level: 'warn',
      text: `Thiếu ${pop - st.beds} giường — ngủ sàn, hồi mệt chậm`,
      action: 'Xem',
      tab: 'base',
      panel: 'craft',
    });
  }
  if (sick > 0) {
    out.push({
      id: 'sick',
      level: 'warn',
      text: `${sick} người đang bệnh`,
      action: 'Chữa',
      tab: 'people',
    });
  }
  if (st.powerOn.length === 0 && site.projects.length === 0) {
    const hasAppliances = site.interior.rooms.some((r) =>
      ['lighting', 'fridge', 'water_pump', 'power_tools', 'electric_fence', 'radio', 'grow_light', 'electric_heater'].includes(r.module ?? ''),
    );
    if (hasAppliances) {
      out.push({
        id: 'power',
        level: 'warn',
        text: 'Thiết bị đang mất điện',
        action: 'Xem điện',
        tab: 'base',
        panel: 'power',
      });
    }
  }

  // Việc bị bỏ trống mà người chơi khó thấy: vườn không có nông dân, có trạm nước
  // mà không ai phụ trách. Đây là các lỗi "im lặng" từng làm cả nền trồng trọt chết.
  const staff = here.filter((v) => v.location === 'base' && !v.commute);
  const noFarmer = st.gardenArea > 0 && !staff.some((v) => v.role === 'farmer');
  if (noFarmer) {
    out.push({
      id: 'no-farmer',
      level: 'bad',
      text: `Vườn ${Math.round(st.gardenArea)} m² nhưng không có nông dân`,
      action: 'Xem người',
      tab: 'people',
    });
  }
  const noWaterRole = (st.filter || st.well) && !staff.some((v) => v.role === 'water');
  if (noWaterRole) {
    out.push({
      id: 'no-water-role',
      level: 'bad',
      text: 'Có trạm nước nhưng không ai phụ trách nước',
      action: 'Xem người',
      tab: 'people',
    });
  }

  // Vượt sức chứa của lãnh thổ: thêm người mà không thêm đất thì chỉ ăn mòn dự trữ.
  const herds = site.interior.rooms.filter((r) => r.herdState).map((r) => ({ state: r.herdState!, graze: site.kind === 'field' ? 1 : 0.4 }));
  const cap = siteCapacity(site, herds);
  if (pop > cap.ceiling + 0.5) {
    out.push({
      id: 'over-capacity',
      level: 'warn',
      text: `Dân ${pop} nhưng lãnh thổ chỉ nuôi ${cap.ceiling.toFixed(0)} — mở thêm ruộng`,
      action: 'Xem',
      tab: 'base',
      panel: 'modules',
    });
  }

  // Stable order: bad before warn, then insertion order (which is severity order).
  out.sort((a, b) => (a.level === b.level ? 0 : a.level === 'bad' ? -1 : 1));
  return out.slice(0, MAX_DECISIONS);
}
