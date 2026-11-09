import { HERDS, herdCapacity, herdNeeds, herdSummary, localHerds, pastureYield } from '../sim/livestock';
import type { GameState, Site } from '../sim/types';
import type { World } from '../world/types';
import type { Room } from '../base/interior';

/**
 * Bảng chăn nuôi.
 *
 * Ba cơ chế ẩn trước đây gói trong một dòng "Gà 8 con": bầy ăn cám bao nhiêu, ban
 * đêm có mất con không, mùa đông cỏ còn bao nhiêu. Người chơi không thể quản lý
 * thứ mình không nhìn thấy, nên bảng này nói thẳng bằng số.
 */
function Bar({ value, warn }: { value: number; warn: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const level = value < warn ? 'red' : value < warn + 0.2 ? 'amber' : 'ok';
  return (
    <span className="meter herd-meter">
      <i className={`fill-${level}`} style={{ width: `${pct}%` }} />
    </span>
  );
}

export function HerdPanel({ s, world, site, room }: { s: GameState; world: World; site: Site; room: Room }) {
  const h = room.herdState;
  if (!h) return null;
  const level = room.moduleLevel ?? 1;
  // Chăn thả: ruộng (1.0) hoặc có bãi cỏ lớn quanh đây (0.3).
  const graze = site.kind === 'field' ? 1 : 0.3;
  const sum = herdSummary(h, room.area, level, graze);
  const need = herdNeeds(h, graze);
  const cap = herdCapacity(room.area * (1 + 0.25 * (level - 1)), h.kind);
  const fed = room.herdFed ?? 1;
  const drunk = room.herdWater ?? 1;
  const care = room.herdCare ?? 1;
  const fodder = site.stock.cam ?? 0;
  const pastures = site.interior.rooms.filter((r) => r.module === 'pasture');
  const pastureArea = pastures.reduce((a, r) => a + r.area, 0);
  // Sản lượng thật của từng ruộng cỏ, đúng cấp và đúng thời tiết hôm nay.
  const pastureKg = pastures.reduce((a, r) => a + pastureYield(r.area, r.moduleLevel ?? 1, s.weather.tempC, s.weather.storm), 0);
  const winter = s.weather.tempC < 18;
  const daysFodder = need.feedKg > 0 ? fodder / need.feedKg : 0;
  const wants = localHerds(world, site);

  return (
    <div className="herd card col" style={{ gap: 5 }}>
      <div className="row">
        <b className="grow">
          {sum.label} · {sum.adults} lớn{sum.young > 0 ? ` + ${sum.young} non` : ''}
        </b>
        <span className={sum.fill > 1 ? 'amber' : 'faint'}>
          {sum.heads}/{Math.max(1, cap)} chỗ
        </span>
      </div>

      <div className="herd-rows">
        <div className="herd-line">
          <span className="herd-key">Thức ăn</span>
          <Bar value={fed} warn={0.6} />
          <span className="herd-val">
            {need.feedKg.toFixed(1)} kg/ngày
          </span>
        </div>
        <div className="herd-line">
          <span className="herd-key">Nước</span>
          <Bar value={drunk} warn={0.6} />
          <span className="herd-val">{need.water.toFixed(0)} L/ngày</span>
        </div>
        <div className="herd-line">
          <span className="herd-key">Chăm sóc</span>
          <Bar value={care} warn={0.5} />
          <span className="herd-val">{Math.round(care * 100)}%</span>
        </div>
      </div>

      <div className="kv">
        <span>Trứng</span>
        <span>{sum.eggsPerDay >= 0.05 ? `${sum.eggsPerDay.toFixed(1)} quả/ngày` : '—'}</span>
        <span>Sữa</span>
        <span>{sum.milkPerDay >= 0.05 ? `${sum.milkPerDay.toFixed(1)} L/ngày` : h.lactating ? 'đang cạn' : '—'}</span>
        <span>Thịt một con</span>
        <span>{sum.meatPerAdult} kg</span>
        <span>Cám trong kho</span>
        <span className={fodder < need.feedKg ? 'amber' : 'ok'}>
          {fodder.toFixed(0)} kg{daysFodder > 0.05 ? ` · ${daysFodder.toFixed(0)} ngày` : ''}
        </span>
      </div>

      {/* Cảnh báo chỉ hiện khi có chuyện: bảng im lặng là bảng khoẻ. */}
      <div className="col" style={{ gap: 2 }}>
        {sum.fill > 1 && (
          <div className="amber">
            Quá chỗ: {sum.heads}/{Math.max(1, cap)} · thêm {sum.m2PerHead} m² mỗi con, hoặc nâng cấp chuồng
          </div>
        )}
        {fed < 0.6 && (
          <div className="amber">
            Đang đói ({Math.round(fed * 100)}% nhu cầu): {pastureArea ? `ruộng cỏ ${Math.round(pastureArea)} m² cho ${pastureKg.toFixed(1)} kg/ngày` : 'chưa có ruộng cỏ'} · bầy sẽ hao hụt
          </div>
        )}
        {drunk < 0.6 && <div className="amber">Thiếu nước uống cho bầy — giếng/bể đang cạn.</div>}
        {!sum.fx.shelter && (
          <div className="dim">
            Đêm: chưa có chuồng kín, mỗi đêm có thể mất một con (cấp 3 chặn hẳn).
          </div>
        )}
        {winter && level < 3 && (
          <div className="dim">Mùa lạnh: cỏ chỉ còn {level >= 2 ? '65%' : '50%'} năng suất (cấp 3 không giảm).</div>
        )}
        {h.pregnant > 0 && <div className="faint">{h.pregnant} con đang mang thai.</div>}
      </div>

      <div className="faint">
        Vùng này phù hợp: {HERDS[wants.coop].label.toLowerCase()} (chuồng), {HERDS[wants.barn].label.toLowerCase()} (trại)
      </div>
    </div>
  );
}
