import { dayOf, fmtClock } from '../../core/time';
import { baseStats, present } from '../../sim/state';
import type { GameState, Site } from '../../sim/types';
import { Icon, SITE_IMG, TAB_IMG } from '../icons';

export type TabId = 'base' | 'people' | 'map' | 'laws' | 'log';

const SPEED_LABEL = ['❚❚', '1×', '10×', '60×', '240×'];
const TABS: [TabId, string][] = [
  ['base', 'Căn cứ'],
  ['people', 'Người'],
  ['map', 'Bản đồ & viễn chinh'],
  ['laws', 'Luật'],
  ['log', 'Nhật ký'],
];

export function TopStrip({
  s,
  site,
  setSite,
  tab,
  setTab,
  speed = 1,
  setSpeed = () => {},
  saved = '',
  onSave = () => {},
  onExit = () => {},
  onKho,
}: {
  s: GameState;
  site: Site;
  setSite: (id: string) => void;
  tab: TabId;
  setTab: (tab: TabId) => void;
  speed?: number;
  setSpeed?: (speed: number) => void;
  saved?: string;
  onSave?: () => void;
  onExit?: () => void;
  onKho: () => void;
}) {
  const st = baseStats(s, site);
  const here = present(s, site).length;
  const alive = s.survivors.filter((v) => v.status === 'alive');
  const stock = site.stock;
  const foodDays = (stock.food + stock.meals + stock.rawFood) / (Math.max(1, st.population) * 2250);
  const waterDays = stock.water / (Math.max(1, st.population) * 3.3);

  return (
    <header className="topstrip">
      <div className="topstrip-main">
        <div className="stat">
          <span className="label">Ngày</span>
          <div className="row" style={{ gap: 10 }}>
            <span className="clock">{dayOf(s.t)}</span>
            <span className="clock dim">{fmtClock(s.t)}</span>
          </div>
        </div>
        <div className="speed">
          {SPEED_LABEL.map((label, index) => (
            <button key={label} className={speed === index ? 'on' : ''} onClick={() => setSpeed(index)} title="Space / 1-4">
              {label}
            </button>
          ))}
        </div>
        <div className="stat topstrip-resource">
          <span className="label">Tài nguyên</span>
          <span className="v">
            <span className={foodDays < 3 ? 'red' : ''}>Đồ ăn {foodDays.toFixed(1)} ngày</span>
            <span className={waterDays < 2 ? 'red' : ''}>Nước sạch {waterDays.toFixed(1)} ngày</span>
          </span>
        </div>
        <div className="stat">
          <span className="label">Thời tiết</span>
          <span className="v">
            {s.weather.label} · {s.weather.tempC}°C{s.weather.rainMm ? ` · ${s.weather.rainMm} mm` : ''}
          </span>
          <span style={{ fontSize: 11 }}>{dayOf(s.t) <= s.hordeUntilDay ? <span className="red">■ Bầy zombie đi qua</span> : <span className="faint">□ Không có bầy</span>}</span>
        </div>
        <div className="stat">
          <span className="label">Nhân lực</span>
          <span className="v">
            <b>{alive.length}</b> người<span className="faint">/</span><b>{here}</b> ở đây<span className="faint">/</span><b className={st.beds < here ? 'amber' : ''}>{st.beds}</b> giường
          </span>
        </div>
        <div className="stat" title="Tình trạng điểm này: độ ồn, độ bẩn, xác chưa dọn">
          <span className="label">Tình trạng điểm</span>
          <span className="v">
            <span className={site.heat > 45 ? 'red' : ''} title="Độ ồn — công việc ồn tăng nó lên; càng cao, đám zombie càng dễ chú ý tới điểm này">Ồn {Math.round(site.heat)}</span>
            <span className="faint">/</span><span className={site.filth > 40 ? 'red' : ''} title="Độ bẩn — tăng nguy cơ bệnh cho người ở đây">Độ bẩn {Math.round(site.filth)}</span>
            <span className="faint">/</span><span title="Xác người chết chưa xử lý — mỗi xác làm độ bẩn tăng mỗi ngày; worker làm Vệ sinh sẽ đốt (tốn gỗ) hoặc chôn">Xác chết {Math.round(site.corpses)}</span>
          </span>
        </div>
        <div className="stat" title="Điểm phòng thủ của điểm này khi tập kích đêm: gia cố + rào + tháp canh + công trình">
          <span className="label">Điểm phòng thủ</span>
          <span className="v">{Math.round(st.defenseStatic)}</span>
        </div>
        <div className="grow topstrip-actions">
          <span className="ok">{saved}</span>
          <button onClick={onSave}>Lưu</button>
          <button onClick={onExit}>Thoát</button>
        </div>
      </div>
      <div className="topstrip-nav">
        <button className="kho-toggle" onClick={onKho} aria-label="Mở kho của điểm đang chọn">
          Kho
        </button>
        <div className="sitesbar">
          {s.sites.map((candidate) => {
            const people = present(s, candidate).length;
            const candidateStock = candidate.stock;
            const days = Math.min(
              (candidateStock.food + candidateStock.meals + candidateStock.rawFood) / (Math.max(1, people) * 2250),
              candidateStock.water / (Math.max(1, people) * 3.3),
            );
            return (
              <button key={candidate.id} className={candidate.id === site.id ? 'on' : ''} onClick={() => setSite(candidate.id)}>
                <Icon src={SITE_IMG[candidate.kind]} size={14} /> {candidate.name} · {people}
                {people > 0 && days < 2 && <span className="red"> !</span>}
              </button>
            );
          })}
        </div>
        <nav className="tabbar" aria-label="Khu vực chính">
          {TABS.map(([id, label]) => (
            <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
              <Icon src={TAB_IMG[id]} size={14} /> {id === 'people' ? `${label} (${alive.length})` : label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
