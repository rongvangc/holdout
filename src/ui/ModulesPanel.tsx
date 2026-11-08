import { MODULES, type ModuleId } from '../data/modules';
import { MODULE_ICONS, Icon } from './icons';
import { maxStationLevel, stationLevel } from '../sim/build';
import { baseStats } from '../sim/state';
import { HERDS } from '../sim/livestock';
import type { PanelProps } from './KitchenPanel';
import type { GameState, Site } from '../sim/types';

/**
 * Danh sách công trình của một điểm trên một màn hình.
 *
 * Trước đây muốn biết "điểm này có gì, cấp mấy, cái nào đang chạy" thì phải click
 * từng phòng trên bản đồ. Bảng này gom lại: mỗi module một dòng, kèm cấp, số lượng
 * và một chỉ số hiệu quả thật (sản lượng/lợi ích) để thấy cái nào đang vô dụng.
 */
export interface ModuleRow {
  module: ModuleId;
  label: string;
  count: number;
  level: number;
  maxLevel: number;
  /** Một dòng hiệu quả thật của module tại điểm này. */
  effect: string;
  /** Đang có hạng mục xây/nâng cấp cho module này. */
  pending: boolean;
}

const percent = (v: number) => `${Math.round(v * 100)}%`;

/** Pure: dựng bảng từ trạng thái điểm. Dùng cho cả UI và test. */
export function moduleRows(s: GameState, site: Site): ModuleRow[] {
  const st = baseStats(s, site);
  const rooms = site.interior.rooms;
  const rows: ModuleRow[] = [];
  const seen = new Set<ModuleId>();

  for (const room of rooms) {
    const id = room.module;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const def = MODULES[id];
    const same = rooms.filter((r) => r.module === id);
    const level = Math.max(...same.map((r) => r.moduleLevel ?? 1));
    const pending = site.projects.some((p) => p.kind === 'module' && p.module === id);
    rows.push({
      module: id,
      label: def.label,
      count: same.length,
      level,
      maxLevel: maxStationLevel(id),
      effect: effectOf(id, site, st, same),
      pending,
    });
  }
  // Hạng mục đang xây (chưa thành phòng) cũng phải hiện, nếu không người chơi
  // không thấy mình đang xây gì.
  for (const p of site.projects) {
    if (p.kind !== 'module' || !p.module || seen.has(p.module)) continue;
    seen.add(p.module);
    const def = MODULES[p.module];
    rows.push({
      module: p.module,
      label: def.label,
      count: 0,
      level: p.level ?? 1,
      maxLevel: maxStationLevel(p.module),
      effect: p.paid ? 'đang xây' : 'chờ vật tư',
      pending: true,
    });
  }

  return rows.sort((a, b) => a.label.localeCompare(b.label, 'vi'));
}

function effectOf(id: ModuleId, site: Site, st: ReturnType<typeof baseStats>, rooms: { area: number; herd?: string; herdState?: unknown }[]): string {
  switch (id) {
    case 'garden':
      return `${Math.round(st.gardenArea)} m² · ${Object.values(site.plots).filter((p) => p.crop).length} khoảnh đang trồng`;
    case 'herb_garden':
      return `${Math.round(st.herbArea)} m² dược liệu`;
    case 'bedroom':
      return `${st.beds} giường`;
    case 'shelter':
      return `${Math.round(rooms.reduce((a, r) => a + r.area, 0))} m² chỗ ngủ ngoài trời`;
    case 'latrine':
      return `${st.latrines} nhà · chịu ${st.latrines * 20} người`;
    case 'water_tank':
      return `chứa ${st.waterCapacity} L`;
    case 'coop':
    case 'barn': {
      const list = rooms
        .filter((r) => (r as { herd?: string }).herd)
        .map((r) => {
          const herd = (r as { herd?: keyof typeof HERDS }).herd!;
          const h = (r as { herdState?: { adults: number; young: number } }).herdState;
          return `${HERDS[herd].label} ${h ? h.adults + h.young : 0} con`;
        });
      return list.length ? list.join(' · ') : 'chưa có con giống';
    }
    case 'pond':
      return `${st.pond} ao`;
    case 'watchtower':
      return `${st.watchtowers} tháp · phòng thủ ${Math.round(st.defenseStatic)}`;
    case 'infirmary':
      return `hồi HP ×${st.healMult.toFixed(1)}`;
    case 'storage':
      return 'đồ sống hỏng 0.5%/ngày, mất ít khi bị cướp';
    case 'kitchen':
      return st.kitchen ? 'nấu ăn + đun nước' : 'chưa hoạt động';
    case 'filter':
      return st.filter ? `lọc 12 L/h` : 'chưa hoạt động';
    case 'well':
      return st.well ? 'giếng: tối đa 1.500 L/ngày' : 'chưa có';
    case 'cellar':
    case 'fridge':
      return `giảm hỏng thức ăn (${percent(1 - st.fridgeRot)} tốt hơn)`;
    case 'generator':
      return site.powered ? 'đang cấp điện đêm nay' : 'chưa chạy (thiếu xăng/ban ngày)';
    case 'forge':
    case 'carpentry':
    case 'kiln':
    case 'tailor':
    case 'smokehouse':
    case 'crock':
      return `trạm chế tạo cấp ${stationLevel(site, id)}`;
    default:
      return `${rooms.length} phòng`;
  }
}

/** Bảng công trình: mỗi module một dòng, bấm để chọn phòng đó trên mặt bằng. */
export function ModulesPanel({ s, site, refresh }: PanelProps) {
  const rows = moduleRows(s, site);
  const select = (module: ModuleId) => {
    const room = site.interior.rooms.find((r) => r.module === module);
    if (room) {
      window.dispatchEvent(new CustomEvent('holdout:select-room', { detail: { roomId: room.id, floor: room.floor } }));
      refresh();
    }
  };
  return (
    <div className="col" style={{ gap: 6 }}>
      <div className="label" title="Mọi công trình đang có ở điểm này, kèm hiệu quả thật">
        Công trình ({rows.length})
      </div>
      {!rows.length && <div className="faint">Chưa xây gì. Chọn một phòng trên mặt bằng để đặt công trình.</div>}
      <table className="grid">
        <thead>
          <tr>
            <th>Công trình</th>
            <th>Số</th>
            <th>Cấp</th>
            <th>Hiệu quả</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.module} onClick={() => select(r.module)} style={{ cursor: 'pointer' }}>
              <td>
                <Icon src={MODULE_ICONS[r.module]} size={18} /> {r.label}
              </td>
              <td>{r.count}</td>
              <td className={r.level < r.maxLevel ? 'dim' : ''}>
                {r.level}/{r.maxLevel}
              </td>
              <td className="dim">{r.effect}</td>
              <td className="faint">{r.pending ? 'đang xây…' : 'xem'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="faint">
        Bấm một dòng để nhảy tới phòng đó trên mặt bằng (để nâng cấp / đổi công trình).
      </div>
    </div>
  );
}
