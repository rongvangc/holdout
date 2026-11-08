import { dayOf } from '../../core/time';
import { ITEMS, STOCK_ORDER } from '../../data/items';
import { baseStats, present } from '../../sim/state';
import type { GameState, Site } from '../../sim/types';
import { fmtNum } from '../Game';
import { Icon, ITEM_ICONS } from '../icons';

export function KhoDrawer({ s, site }: { s: GameState; site: Site }) {
  const st = baseStats(s, site);
  const here = present(s, site).length;
  const pop = Math.max(1, st.population);
  const stock = site.stock;

  return (
    <div className="khodrawer">
      <div className="label">Kho · {site.name}</div>
      <table>
        <tbody>
          {STOCK_ORDER.map((k) => (
            <tr key={k}>
              <td className={stock[k] < 0.5 ? 'faint' : ''}>
                <Icon src={ITEM_ICONS[k]} size={20} /> {ITEMS[k].label}
              </td>
              <td>
                {fmtNum(stock[k])} <span className="faint">{ITEMS[k].unit}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
          <div className="red">
            <b>KẾT THÚC.</b> Cộng đồng tồn tại {dayOf(s.t)} ngày. {s.stats.recruited} người đã gia nhập, {s.stats.deaths} người chết.
          </div>
        </>
      )}
    </div>
  );
}
