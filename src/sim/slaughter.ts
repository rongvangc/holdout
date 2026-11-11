import { ITEMS } from '../data/items';
import { HERDS, slaughterYield, type HerdKind } from './livestock';
import { addStock, log } from './state';
import { stationLevel } from './build';
import type { Room } from '../base/interior';
import type { GameState, Site } from './types';

/**
 * Mổ một con theo ý người chơi (khác với mổ tự động khi bầy quá tải).
 *
 * Cần Lò mổ; cấp của lò quyết định giữ được gì: cấp 1 chỉ thịt, cấp 2 thêm da + mỡ,
 * cấp 3 thêm xương và +20% thịt. Giữ lại ít nhất một con giống.
 */
export function slaughterOne(s: GameState, site: Site, roomId: string): string | null {
  const room = site.interior.rooms.find((r) => r.id === roomId) as Room | undefined;
  const h = room?.herdState;
  if (!room || !h) return 'Chuồng này không có bầy';
  if (h.adults + h.young < 2) return 'Còn một con — giữ lại làm giống';
  if (stationLevel(site, 'butcher') < 1) return 'Cần Lò mổ để mổ theo ý muốn';

  const level = stationLevel(site, 'butcher');
  const y = slaughterYield(h.kind as HerdKind, level);
  // Con non mổ ra ít hơn: 40% khối lượng.
  const useYoung = h.young > 0;
  const scale = useYoung ? 0.4 : 1;
  if (useYoung) h.young -= 1;
  else {
    h.adults -= 1;
    h.males = Math.min(h.males, h.adults);
  }

  const give = {
    thit: Math.round(y.meat * scale * 10) / 10,
    da: Math.round(y.hide * scale * 10) / 10,
    mo: Math.round(y.fat * scale * 10) / 10,
    xuong: Math.round(y.bone * scale * 10) / 10,
  };
  const delta = Object.fromEntries(Object.entries(give).filter(([, n]) => n > 0));
  addStock(s, site, delta);
  const parts = Object.entries(give)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => `${ITEMS[id]?.label ?? id} ${n}`);
  log(s, `${site.name}: mổ một con ${HERDS[h.kind as HerdKind].label.toLowerCase()} — ${parts.join(', ')}.`, 'good', delta);
  return null;
}
