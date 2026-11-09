import { dayOf } from '../core/time';
import { stapleKcal } from '../data/staples';
import { baseStats, present } from '../sim/state';
import { siteCapacity } from '../sim/scale';
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

/**
 * Tầng hai: sau khi 7 việc đầu xong, game không còn nói gì về phía trước — và một
 * sandbox không có đích thì rất dễ thành "chờ số". Đây là các mốc tự chủ, cùng
 * cách đọc từ state thật, để lúc nào người chơi cũng thấy việc kế tiếp.
 */
export function nextTierGoals(s: GameState, site: Site): Goal[] {
  const st = baseStats(s, site);
  const here = present(s, site);
  const pop = Math.max(1, here.length);
  const cap = siteCapacity(site, site.interior.rooms.filter((r) => r.herdState).map((r) => ({ state: r.herdState!, graze: site.kind === 'field' ? 1 : 0.4 })));
  const cleanDays = site.stock.water / (pop * 3.3);
  const alive = s.survivors.filter((v) => v.status === 'alive').length;
  // "Người của điểm này" chứ không phải "người đang có mặt": đội đi lục không được
  // làm mục tiêu nhảy số.
  const residents = Math.max(
    1,
    s.survivors.filter((v) => v.status === 'alive' && (v.commute?.home ?? v.siteId) === site.id).length,
  );
  const techs = (s.techs ?? []).length;
  const tower = st.watchtowers ?? 0;

  return [
    {
      // Dùng số người của cả căn cứ, không phải số đang có mặt: người đi lục về thì
      // mục tiêu không được nhảy số.
      id: 'self-food',
      text: `Đất tự nuôi được ${residents} người`,
      why: `Vườn + bầy hiện nuôi ${cap.ceiling.toFixed(1)} người; phần còn lại vẫn phải đi lục.`,
      done: cap.ceiling >= residents,
    },
    {
      id: 'water-buffer',
      text: 'Trữ 10 ngày nước sạch',
      why: 'Một trận bão hoặc bầy chặn đường là mất 2 ngày lấy nước.',
      done: cleanDays >= 10,
    },
    {
      id: 'first-tech',
      text: 'Nghiên cứu xong một đề tài',
      why: 'Công thức bị khoá bởi kiến thức, không phải bởi vật tư.',
      done: techs >= 1,
    },
    {
      id: 'fortified',
      text: 'Gia cố cấp 2 và một tháp canh',
      why: 'Từ ngày 12 bầy bắt đầu kéo tới theo đợt; hàng rào là thứ giữ người.',
      done: site.fortify.level >= 2 && tower >= 1,
    },
    {
      id: 'ten-people',
      text: 'Mười người sống',
      why: 'Đủ tay để vừa giữ nhà vừa mở ruộng thứ hai.',
      done: alive >= 10,
    },
    {
      id: 'second-site',
      text: 'Mở điểm thứ hai (ruộng hoặc tiền đồn)',
      why: 'Sân nhà có hạn; đất rộng là thứ duy nhất nuôi được thêm người.',
      done: s.sites.length >= 2,
    },
  ];
}

/** Tầng nào đang hiện: mở đầu (mục tiêu 7 ngày đầu) hay tự chủ (sau đó). */
export function currentGoals(s: GameState, site: Site): { tier: 1 | 2; goals: Goal[] } {
  // Tuần đầu là danh sách việc mở màn; sau đó chuyển sang các mốc tự chủ. Mục nào
  // còn thiếu ở tầng một thì tab "Cần quyết định" đã nhắc (giường, nước, lương).
  if (dayOf(s.t) <= 10) return { tier: 1, goals: firstDayGoals(s, site) };
  return { tier: 2, goals: nextTierGoals(s, site) };
}

/** Progress for the HUD: how many of the opening goals are met. */
export function goalProgress(goals: Goal[]): { done: number; total: number } {
  return { done: goals.filter((g) => g.done).length, total: goals.length };
}

/** Có nên hiện bảng hướng dẫn không: còn mục chưa xong ở tầng đang mở. */
export function showOnboarding(s: GameState, site: Site): boolean {
  return currentGoals(s, site).goals.some((g) => !g.done);
}
