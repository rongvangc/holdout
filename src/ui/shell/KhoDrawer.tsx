import { useState } from 'react';
import { FEATURES } from '../../sim/config';
import { dayOf } from '../../core/time';
import { ITEMS, stockWeight, type ItemId } from '../../data/items';
import { stapleKcal } from '../../data/staples';
import { ammoFor } from '../../sim/equipment';
import { queueRepair, repairableWeapons, stationLevel } from '../../sim/build';
import { canRepair, refuel, repairVehicle, syncVehicleStock } from '../../sim/vehicles';
import { baseStats, present } from '../../sim/state';
import { GEAR_SLOTS } from '../../sim/gear';
import { HERDS, herdCapacity, herdBudget, type HerdState } from '../../sim/livestock';
import { siteCapacity } from '../../sim/scale';
import type { GameState, Site } from '../../sim/types';
import { fmtNum } from '../Game';
import { Icon, ITEM_ICONS } from '../icons';

/** Nhóm hiển thị trong kho — tách theo `mechanic` để module mới (súng/đạn/giáp/mũ/balo…) có tab riêng. */
const GROUPS: { id: string; label: string; keys: string[] }[] = [
  { id: 'firearm', label: 'Súng', keys: ['firearm'] },
  { id: 'ammo', label: 'Đạn dược', keys: ['ammo'] },
  { id: 'melee', label: 'Vũ khí cận chiến', keys: ['weapon_blade', 'weapon_blunt'] },
  { id: 'armor', label: 'Giáp', keys: ['armor_plate', 'armor_soft', 'vest'] },
  { id: 'headgear', label: 'Mũ & bảo hộ', keys: ['helmet', 'mask'] },
  { id: 'clothing', label: 'Quần áo & giày', keys: ['clothes', 'boots', 'gloves'] },
  { id: 'gear', label: 'Ba lô & túi', keys: ['backpack', 'container'] },
  { id: 'electronic', label: 'Đồ điện tử', keys: ['electronic'] },
  { id: 'food', label: 'Đồ ăn', keys: ['food'] },
  { id: 'drink', label: 'Nước uống', keys: ['drink'] },
  { id: 'medicine', label: 'Thuốc & băng', keys: ['medicine', 'bandage', 'medkit', 'injection'] },
  { id: 'tool', label: 'Dụng cụ', keys: ['tool', 'cookware', 'camping', 'fire', 'hygiene'] },
  { id: 'material', label: 'Vật liệu', keys: ['material', 'component', 'fuel', 'seed'] },
  { id: 'other', label: 'Khác', keys: ['misc', 'none', 'vehicle'] },
];

/** Ưu tiên `mechanic` (chi tiết), sau đó `category`; không khớp thì 'other'. */
const groupOf = (id: ItemId): string => {
  const def = ITEMS[id];
  const mech = def?.mechanic;
  const cat = def?.category;
  return GROUPS.find((g) => (mech && g.keys.includes(mech)) || (cat && g.keys.includes(cat)))?.id ?? 'other';
};

export function KhoDrawer({ s, site }: { s: GameState; site: Site }) {
  const st = baseStats(s, site);
  const here = present(s, site).length;
  const pop = Math.max(1, st.population);
  const stock = site.stock;
  const [group, setGroup] = useState<string>('all');
  const [, bump] = useState(0);
  const vehicles = site.vehicles ?? [];

  // Mọi thứ đang thực sự có trong kho, kể cả 647 món catalog (trước đây bị ẩn).
  const held = Object.entries(stock)
    .filter(([, n]) => (n ?? 0) > 0.01)
    .map(([id, n]) => ({ id, n }))
    .sort((a, b) => b.n * (ITEMS[b.id]?.kgPerUnit ?? 0) - a.n * (ITEMS[a.id]?.kgPerUnit ?? 0));

  const counts: Record<string, number> = {};
  for (const h of held) counts[groupOf(h.id)] = (counts[groupOf(h.id)] ?? 0) + 1;
  const rows = group === 'all' ? held : held.filter((h) => groupOf(h.id) === group);
  const issued = s.survivors.reduce(
    (n, v) => n + (v.status === 'alive' ? GEAR_SLOTS.filter((sl) => v.gear?.[sl]).length : 0),
    0,
  );

  return (
    <div className="khodrawer">
      <div className="label">Kho · {site.name}</div>
      <div className="khotabs">
        <button className={group === 'all' ? 'on' : ''} onClick={() => setGroup('all')}>
          Tất cả <span className="faint">{held.length}</span>
        </button>
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
              <td className="faint">{group === 'all' ? 'Kho trống.' : 'Không có gì trong nhóm này.'}</td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="faint" style={{ marginTop: 4 }}>
        {held.length} loại · {fmtNum(stockWeight(stock))} kg · {issued} món đang cấp phát cho người
      </div>

      {/* Bảo trì thuộc về kho: đồ mòn và súng thiếu đạn là chuyện của người giữ kho,
          không phải của bảng cấp phát (tab Người) hay của màn xây dựng. */}
      {(() => {
        const worn = repairableWeapons(site);
        const dry = Object.entries(ITEMS)
          .filter(([id, d]) => d.mechanic === 'firearm' && (stock[id] ?? 0) >= 1)
          .map(([id]) => ({ id, ammo: ammoFor(id), have: ammoFor(id) ? (stock[ammoFor(id)!] ?? 0) : 0 }))
          .filter((g) => g.have <= 0);
        if (!worn.length && !dry.length) return null;
        const forgeLvl = stationLevel(site, 'forge');
        return (
          <>
            <div className="dither" />
            <div className="label">Cần bảo trì</div>
            <div className="col" style={{ gap: 3 }}>
              {worn.map((w) => (
                <div key={w.id} className="row" style={{ gap: 6 }}>
                  <span className="grow">{ITEMS[w.id]?.label ?? w.id}</span>
                  <span className="amber">mòn {Math.round((1 - w.condition) * 100)}%</span>
                  <button
                    disabled={forgeLvl < 2}
                    title={forgeLvl < 2 ? 'Cần Lò rèn cấp 2' : 'Sửa ở lò rèn'}
                    onClick={() => {
                      queueRepair(s, site, w.id);
                    }}
                  >
                    Sửa
                  </button>
                </div>
              ))}
              {dry.map((g) => (
                <div key={g.id} className="row" style={{ gap: 6 }}>
                  <span className="grow">{ITEMS[g.id]?.label ?? g.id}</span>
                  <span className="red">không có đạn</span>
                </div>
              ))}
            </div>
          </>
        );
      })()}

      {/* Xe là vật thể: mỗi chiếc có bình xăng và độ mòn riêng, nên phải hiện ra
          đúng như vậy thay vì một con số trong kho. */}
      {vehicles.length > 0 && (
        <>
          <div className="dither" />
          <div className="label">Xe trong sân</div>
          <div className="col" style={{ gap: 4 }}>
            {vehicles.map((v) => (
              <div key={v.id} className="col" style={{ gap: 2 }}>
                <div className="row" style={{ gap: 6 }}>
                  <span className="grow">{v.label}</span>
                  <span className={v.condition < 35 ? 'red' : 'amber'}>máy {Math.round(v.condition)}%</span>
                  <span className="dim">
                    {v.fuelL.toFixed(0)}/{v.tankL} L
                  </span>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button
                    disabled={stock.fuel < 1 || v.fuelL >= v.tankL}
                    title={stock.fuel < 1 ? 'Kho không còn xăng' : `Đổ từ kho (còn ${Math.round(stock.fuel)} L)`}
                    onClick={() => {
                      refuel(site, v, Math.min(20, v.tankL - v.fuelL));
                      syncVehicleStock(site);
                      bump((n) => n + 1);
                    }}
                  >
                    Đổ 20 L
                  </button>
                  <button
                    disabled={!canRepair(site, v)}
                    title={canRepair(site, v) ? 'Sửa: 4 sắt + 2 linh kiện, hồi 35%' : 'Cần 4 sắt + 2 linh kiện'}
                    onClick={() => {
                      repairVehicle(site, v);
                      bump((n) => n + 1);
                    }}
                  >
                    Sửa xe
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="dither" />
      <div className="label" title={'Số ngày trụ được với mức tiêu thụ của ' + here + ' người ở đây'}>
        Trụ được bao lâu ({here} người)
      </div>
      <div className="kv">
        <span title="Đồ hộp + bữa nấu chín + gạo/khoai sống, tính theo kcal">Đồ ăn</span>
        <span className={(stock.food + stock.meals + stapleKcal(stock)) / (pop * 2250) < 3 ? 'red' : ''}>
          {((stock.food + stock.meals + stapleKcal(stock)) / (pop * 2250)).toFixed(1)} ngày
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
      {(() => {
        const herds: { state: HerdState; graze: number }[] = site.interior.rooms
          .filter((r) => r.herdState)
          .map((r) => ({ state: r.herdState as HerdState, graze: site.kind === 'field' ? 1 : 0.4 }));
        const cap = siteCapacity(site, herds);
        const over = here > cap.ceiling + 0.5;
        return (
          <>
            <div className="dither" />
            <div className="label" title="Số người lãnh thổ này nuôi nổi: vườn (kcal) + đạm từ bầy có lãi">
              Sức chứa của điểm
            </div>
            <div className="kv">
              <span>Vườn {Math.round(cap.gardenM2)} m² nuôi</span>
              <span>{cap.fromCrops.toFixed(1)} người</span>
              <span title="Chỉ bầy không lỗ calo mới cộng phần đạm">Đạm từ chăn nuôi</span>
              <span>{cap.fromHerds.toFixed(1)} người</span>
              <span>Tổng</span>
              <span className={over ? 'red' : 'ok'}>
                {here}/{cap.ceiling.toFixed(1)} người{over ? ' — quá tải' : ''}
              </span>
            </div>
          </>
        );
      })()}
      <div className="dither" />
      <div className="label">Chăn nuôi</div>
      <div className="kv">
        {site.interior.rooms.filter((r) => r.module === 'coop' || r.module === 'barn').length === 0 && (
          <span className="faint">Chưa có chuồng/trại.</span>
        )}
        {site.interior.rooms
          .filter((r) => r.module === 'coop' || r.module === 'barn')
          .map((r) => {
            const h = r.herdState;
            const bio = r.herd ? HERDS[r.herd] : null;
            const cap = r.herd ? herdCapacity(r.area * (1 + 0.25 * ((r.moduleLevel ?? 1) - 1)), r.herd) : 0;
            if (!bio) return null;
            const bits: string[] = [`${h?.adults ?? 0} lớn`];
            if (h?.young) bits.push(`${h.young} non`);
            if (h?.pregnant) bits.push(`chửa ${h.pregnant} (${h.dueIn} ngày)`);
            if (h?.lactating) bits.push(`sữa ${h.lactating} (${h.lactationIn} ngày)`);
            if (h) {
              // Chăn nuôi gần như luôn lỗ calo — hiện rõ để người chơi biết mình đang
              // đổi calo lấy đạm/tinh thần, chứ không phải nguồn lương.
              const b = herdBudget(h, site.kind === 'field' ? 1 : 0.4);
              bits.push(`${b.net >= 0 ? '+' : ''}${Math.round(b.net)} kcal/ngày`);
            }
            return (
              <span key={r.id} title={bio.desc}>
                {bio.label} · {bits.join(' · ')} / {cap}
              </span>
            );
          })}
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
