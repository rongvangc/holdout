import { dayOf } from '../core/time';
import { stapleKcal } from '../data/staples';
import { baseStats, present } from '../sim/state';
import type { GameState, Site } from '../sim/types';

/**
 * Onboarding as a checklist, not a slideshow.
 *
 * Twenty systems now greet a new player, and the game explained none of them. A
 * fixed tutorial would teach the UI and miss the point, so these goals are read
 * from real state: each one is "done" when the colony has actually done it, and
 * each line says why it matters. They disappear once the basics stand.
 */
export interface Goal {
  id: string;
  text: string;
  why: string;
  done: boolean;
}

export const GOAL_COUNT = 7;

export function firstDayGoals(s: GameState, site: Site): Goal[] {
  const st = baseStats(s, site);
  const here = present(s, site);
  const pop = Math.max(1, here.length);
  const food = (site.stock.food + site.stock.meals + stapleKcal(site.stock)) / (pop * 2250);
  const water = site.stock.water / (pop * 3.3);
  const day = dayOf(s.t);
  const hasExpedition = s.expeditions.length > 0 || s.sites.length > 1;

  return [
    {
      id: 'look',
      text: 'Mở tab Căn cứ, chọn một phòng trên mặt bằng',
      why: 'Mọi thứ được xây trong phòng, không phải bằng menu.',
      done: site.interior.rooms.some((r) => r.module),
    },
    {
      id: 'kitchen',
      text: 'Dựng Bếp',
      why: 'Không có bếp, gạo sống chỉ ăn được một nửa năng lượng.',
      done: st.kitchen,
    },
    {
      id: 'water',
      text: 'Có nguồn nước: giếng, bể hứng mưa, hoặc trạm lọc',
      why: 'Ba ngày không có nước là chết; mỗi người cần ~3,3 L/ngày.',
      done: (st.well || st.tanks > 0 || st.filter) && water >= 2,
    },
    {
      id: 'beds',
      text: `Đủ giường cho ${here.length} người`,
      why: 'Ngủ sàn hồi mệt chậm hơn 40% và mất tinh thần.',
      done: st.beds >= here.length,
    },
    {
      id: 'food',
      text: 'Trữ được 10 ngày lương thực',
      why: 'Bão và mùa đông chặn viễn chinh; dự trữ là bảo hiểm.',
      done: food >= 10,
    },
    {
      id: 'defence',
      text: 'Gia cố hoặc rào ít nhất cấp 1',
      why: 'Đêm thứ 7 trở đi, tập kích bắt đầu có người bị thương.',
      done: site.fortify.level >= 1 || site.fence.level >= 1,
    },
    {
      id: 'trip',
      text: 'Gửi một đội ra ngoài (lục soát hoặc lấy nước)',
      why: 'Trong nhà không sinh ra vật tư; phải ra ngoài mới có.',
      done: hasExpedition,
    },
  ].filter((g) => !g.done || day <= 10);
}

/** Progress for the HUD: how many of the opening goals are met. */
export function goalProgress(goals: Goal[]): { done: number; total: number } {
  return { done: goals.filter((g) => g.done).length, total: goals.length };
}

/** Có nên hiện bảng hướng dẫn không: chỉ khi còn mục chưa xong và chưa quá ngày 10. */
export function showOnboarding(s: GameState, site: Site): boolean {
  if (dayOf(s.t) > 10) return false;
  return firstDayGoals(s, site).some((g) => !g.done);
}
