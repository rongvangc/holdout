import { useState } from 'react';
import { FEATURES } from '../../sim/config';
import { dayOf } from '../../core/time';
import { ITEMS, stockWeight, type ItemId } from '../../data/items';
import { baseStats, present } from '../../sim/state';
import { GEAR_SLOTS } from '../../sim/gear';
import type { GameState, Site } from '../../sim/types';
import { fmtNum } from '../Game';
import { Icon, ITEM_ICONS } from '../icons';

/** Nhóm hiển thị trong kho. Mọi item có `stock > 0` đều rơi vào một nhóm. */
const GROUPS: { id: string; label: string; cats: string[] }[] = [
  { id: 'material', label: 'Vật liệu', cats: ['material', 'component'] },
  { id: 'weapon', label: 'Vũ khí', cats: ['weapon', 'ammo'] },
  { id: 'armor', label: 'Giáp & đồ mặc', cats: ['armor', 'clothing'] },
  { id: 'gear', label: 'Ba lô & túi', cats: ['container'] },
  { id: 'food', label: 'Đồ ăn', cats: ['food', 'drink'] },
  { id: 'medicine', label: 'Thuốc', cats: ['medicine'] },
  { id: 'tool', label: 'Dụng cụ', cats: ['tool', 'cookware', 'camping', 'fire', 'electronic'] },
  { id: 'other', label: 'Khác', cats: ['misc', 'none'] },
];

const groupOf = (id: ItemId): string => {
  const cat = ITEMS[id]?.category ?? 'none';
  return GROUPS.find((g) => g.cats.includes(cat))?.id ?? 'other';
};

export function KhoDrawer({ s, site }: { s: GameState; site: Site }) {
  const st = baseStats(s, site);
  const here = present(s, site).length;
  const pop = Math.max(1, st.population);
  const stock = site.stock;
  const [group, setGroup] = useState<string>('material');

  // Mọi thứ đang thực sự có trong kho, kể cả 647 món catalog (trước đây bị ẩn).
  const held = Object.entries(stock)
    .filter(([, n]) => (n ?? 0) > 0.01)
    .map(([id, n]) => ({ id, n }))
    .sort((a, b) => b.n * (ITEMS[b.id]?.kgPerUnit ?? 0) - a.n * (ITEMS[a.id]?.kgPerUnit ?? 0));

  const counts: Record<string, number> = {};
  for (const h of held) counts[groupOf(h.id)] = (counts[groupOf(h.id)] ?? 0) + 1;
  const rows = held.filter((h) => groupOf(h.id) === group);
  const issued = s.survivors.reduce(
    (n, v) => n + (v.status === 'alive' ? GEAR_SLOTS.filter((sl) => v.gear?.[sl]).length : 0),
    0,
  );

  return (
    <div className="khodrawer">
      <div className="label">Kho · {site.name}</div>
      <div className="khotabs">
        {GROUPS.filter((g) => counts[g.id]).map((g) => (
          <button key={g.id} className={group === g.id ? 'on' : ''} onClick={() => setGroup(g.id)}>
            {g.label} <span className="faint">{counts[g.id]}</span>
          </button>
        ))}
      </div>
      {/* Bảng kho: mỗi loại một dòng, sắp theo tổng khối lượng để thấy ngay thứ nặng. */}
      <table>
        <tbody>
          {rows.map(({ id, n }) => {
            const def = ITEMS[id];
            const src = def?.icon ?? ITEM_ICONS[id];
            const kg = n * (def?.kgPerUnit ?? 0);
            return (
              <tr key={id}>
                <td title={def?.desc ?? def?.subtype ?? id}>
                  {src ? <Icon src={src} size={20} /> : null} {def?.label ?? id}
                  {def?.subtype && <span className="faint"> · {def.subtype}</span>}
                </td>
                <td>
                  {fmtNum(n)} <span className="faint">{def?.unit ?? ''}</span>
                  {kg >= 0.1 && <div className="faint">{fmtNum(kg)} kg</div>}
                </td>
              </tr>
            );
          })}
          {!rows.length && (
            <tr>
              <td className="faint">Không có gì trong nhóm này.</td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="faint" style={{ marginTop: 4 }}>
        {held.length} loại · {fmtNum(stockWeight(stock))} kg · {issued} món đang cấp phát cho người
      </div>

      <div className="dither" />
      <div className="label" title={'Số ngày trụ được với mức tiêu thụ của ' + here + ' người ở đây'}>
        Trụ được bao lâu ({here} người)
      </div>
      <div className="kv">
        <span title="Đồ hộp + bữa nấu chín + gạo/khoai sống, tính theo kcal">Đồ ăn</span>
        <span className={(stock.food + stock.meals + stock.rawFood) / (pop * 2250) < 3 ? 'red' : ''}>
          {((stock.food + stock.meals + stock.rawFood) / (pop * 2250)).toFixed(1)} ngày
        </span>
        <span title="Nước sạch trong kho, 3.3 L/người/ngày">Nước uống</span>
        <span className={stock.water / (pop * 3.3) < 2 ? 'red' : ''}>{(stock.water / (pop * 3.3)).toFixed(1)} ngày</span>
        <span title="Nước bẩn/mưa thu được — cần đun sôi hoặc lọc mới uống được">Nước bẩn</span>
        <span>
          {Math.round(stock.dirtyWater)}/{st.waterCapacity} L
        </span>
        <span title="Gỗ sẵn trong toà nhà này — người kiếm củi lấy nhanh hơn; hết thì đi xa, chậm gấp đôi và ồn hơn">Củi sẵn trong nhà</span>
        <span>{site.salvageLeft.wood > 0 ? `${Math.round(site.salvageLeft.wood)} kg còn` : 'hết — phải đi xa'}</span>
      </div>
      <div className="dither" />
      <div className="label">Điểm này</div>
      <div className="kv">
        <span>Nhà vệ sinh</span>
        <span className={st.latrines * 20 < st.population ? 'amber' : ''}>
          {st.latrines} ({st.latrines * 20} người)
        </span>
        <span>Gia cố</span>
        <span>
          cấp {site.fortify.level} · {Math.round(site.fortify.hp)}%
        </span>
        <span>Rào</span>
        <span>
          cấp {site.fence.level} · {Math.round(site.fence.hp)}%
        </span>
        <span>Viễn chinh</span>
        <span>{s.expeditions.length} đội</span>
      </div>
      {s.gameOver && (
        <>
          <div className="dither" />
          {s.won ? (
            <div className="ok">
              <b>ĐƯỢC CỨU.</b> Tín hiệu cầu cứu được trả lời sau {dayOf(s.t)} ngày. {s.survivors.filter((v) => v.status === 'alive').length} người
              rời khỏi đây còn sống.
            </div>
          ) : (
            <div className="red">
              <b>KẾT THÚC.</b> Cộng đồng tồn tại {dayOf(s.t)} ngày. {s.stats.recruited} người đã gia nhập, {s.stats.deaths} người chết.
            </div>
          )}
        </>
      )}
      {FEATURES.rescue && !s.gameOver && (s.rescueDays ?? 0) > 0 && (
        <div className="ok">
          Tín hiệu cầu cứu: {s.rescueDays}/7 đêm
        </div>
      )}
    </div>
  );
}
