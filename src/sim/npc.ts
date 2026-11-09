import { FACTION_BY_ID, FACTIONS, stackValue, tradeValue, type FactionDef } from '../data/factions';
import { ITEMS, type ItemId } from '../data/items';
import type { Caravan, CaravanOffer, GameState, Site, StockDelta } from './types';
import { log, take, addStock, present } from './state';
import { dayOf } from '../core/time';
import { chance, int, next, pick } from '../core/rng';

/**
 * Đoàn buôn: đến, đứng ở cổng 2 ngày, rồi đi.
 *
 * Không phải "cửa hàng": họ chỉ ghé khi có lý do (đường xa, ngày đủ yên), họ bán thứ
 * mình có chứ không bán thứ mình cần, và nhớ cách mình bị đối xử. Đây là chỗ tiêu vật
 * tư dư để lấy thứ không chế được — đạn, thuốc, sách — nên nó là **quyết định**: bán
 * lương thực lấy đạn hay giữ lương để sống qua tuần.
 */

export const caravans = (s: GameState): Caravan[] => s.caravan?.list ?? [];
export const repOf = (s: GameState, faction: string): number => s.caravan?.rep[faction] ?? 0;

/** Giá thực tế sau khi tính uy tín: mỗi điểm uy tín bớt 5% phụ phí, sàn 0,85×. */
export function markupFor(s: GameState, faction: string): number {
  const f = FACTION_BY_ID[faction];
  if (!f) return 1;
  const rep = repOf(s, faction);
  return Math.max(0.85, f.markup * (1 - 0.05 * rep));
}

const SPAWN_EVERY = 9; // ngày giữa hai lần có khách
const STAY = 2;

const rngPick = <T>(s: GameState, arr: readonly T[]): T => pick(s.rng, arr);

function qtyFor(id: ItemId, want: number): number {
  const unit = tradeValue(id);
  const n = Math.max(1, Math.round(want / Math.max(0.2, unit)));
  // Bán theo lô nhỏ: không ai chở 400 kg gạo trên lưng.
  const cap = ITEMS[id]?.kgPerUnit && ITEMS[id]!.kgPerUnit > 2 ? 3 : 40;
  return Math.min(cap, Math.max(1, Math.min(n, 40)));
}

function makeOffer(s: GameState, f: FactionDef, id: string): CaravanOffer {
  const sells = [...f.sells].filter((x) => ITEMS[x]);
  const buys = [...f.buys].filter((x) => ITEMS[x]);
  const giveId = rngPick(s, sells);
  const giveQty = pick(s.rng, [1, 1, 2, 2, 3, 4]);
  const giveValue = stackValue([[giveId, giveQty]]);

  const wantIds = buys.filter((x) => x !== giveId);
  const takeId = rngPick(s, wantIds.length ? wantIds : buys);
  const takeQty = qtyFor(takeId, (giveValue / markupFor(s, f.id)) * 1.05);
  return { id, give: [[giveId, giveQty]], take: [[takeId, takeQty]] };
}

/** Mỗi ngày: khách cũ rời đi, và thỉnh thoảng có đoàn mới tới cổng. */
export function tickCaravans(s: GameState, site: Site): void {
  s.caravan ??= { list: [], rep: {} };
  const day = dayOf(s.t);

  // Rời đi
  const gone = s.caravan.list.filter((c) => day > c.leaveDay);
  if (gone.length) {
    for (const c of gone) {
      const f = FACTION_BY_ID[c.faction];
      s.caravan.rep[c.faction] = repOf(s, c.faction) - 0.5; // bỏ lỡ khách = mất uy tín nhẹ
      log(s, `${f?.label ?? c.faction} rời đi vì không ai ra tiếp.`, 'info');
    }
    s.caravan.list = s.caravan.list.filter((c) => day <= c.leaveDay);
  }

  if (s.caravan.list.length) return;
  const pop = present(s, site).length;
  if (pop < 2) return;
  // Nhịp không đều: có tuần hai đoàn, có tháng không ai.
  const gap = SPAWN_EVERY + int(s.rng, -3, 4);
  if (day < 4 || day % Math.max(5, gap) !== 0) return;

  const pool = FACTIONS.filter((f) => day >= f.minDay);
  if (!pool.length) return;
  const total = pool.reduce((a, f) => a + f.weight, 0);
  let roll = next(s.rng) * total;
  let chosen = pool[0];
  for (const f of pool) {
    roll -= f.weight;
    if (roll <= 0) {
      chosen = f;
      break;
    }
  }
  const cell = site.cell;
  const offers = [makeOffer(s, chosen, 'o1'), makeOffer(s, chosen, 'o2')];
  if (chance(s.rng, 0.5)) offers.push(makeOffer(s, chosen, 'o3'));
  s.caravan.list.push({ id: `cv${s.nextId++}`, faction: chosen.id, cell, arriveDay: day, leaveDay: day + STAY, offers });
  log(s, `${chosen.label} dừng ở cổng căn cứ (${STAY} ngày). ${chosen.desc}`, 'good');
}

export function acceptOffer(s: GameState, site: Site, caravanId: string, offerId: string): string | null {
  const c = caravans(s).find((x) => x.id === caravanId);
  if (!c) return 'Đoàn buôn đã đi';
  const offer = c.offers.find((o) => o.id === offerId);
  if (!offer) return 'Không có món này';
  const lack = offer.take.filter(([id, n]) => (site.stock[id] ?? 0) < n);
  if (lack.length) {
    return `Không đủ để đổi: ${lack.map(([id, n]) => `${ITEMS[id]?.label ?? id} ${n}`).join(', ')}`;
  }
  const delta: StockDelta = {};
  for (const [id, n] of offer.take) take(site, id, n);
  for (const [id, n] of offer.give) {
    delta[id] = n;
    addStock(s, site, { [id]: n });
  }
  c.offers = c.offers.filter((o) => o.id !== offerId);
  s.caravan!.rep[c.faction] = repOf(s, c.faction) + 1;
  log(s, `Đổi với ${FACTION_BY_ID[c.faction]?.label ?? c.faction}: ${offer.take.map(([id, n]) => `${ITEMS[id]?.label ?? id} ×${n}`).join(', ')} → ${offer.give.map(([id, n]) => `${ITEMS[id]?.label ?? id} ×${n}`).join(', ')}.`, 'good', delta);
  return null;
}

/** Đuổi khách: không mất gì hôm nay, nhưng nhóm đó nhớ. */
export function sendAway(s: GameState, caravanId: string): void {
  const c = caravans(s).find((x) => x.id === caravanId);
  if (!c || !s.caravan) return;
  s.caravan.list = s.caravan.list.filter((x) => x.id !== caravanId);
  s.caravan.rep[c.faction] = repOf(s, c.faction) - 2;
  log(s, `${FACTION_BY_ID[c.faction]?.label ?? c.faction} bị đuổi về — uy tín giảm.`, 'bad');
}
