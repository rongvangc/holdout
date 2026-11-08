import { dayOf, fmtClock } from '../../core/time';
import { baseStats, present } from '../../sim/state';
import type { GameState, Site } from '../../sim/types';
import { Icon, SITE_IMG, TAB_IMG } from '../icons';
import { toggleHints, useHints } from '../hints';

export type TabId = 'base' | 'people' | 'map' | 'laws' | 'log';

const SPEED_LABEL = ['❚❚', '1×', '10×', '60×', '240×'];
const TABS: [TabId, string][] = [
  ['base', 'Căn cứ'],
  ['people', 'Người'],
  ['map', 'Bản đồ & viễn chinh'],
  ['laws', 'Luật'],
  ['log', 'Nhật ký'],
];

/** "4.4" / "—" — the HUD shows a number, not a sentence (design/ux/hud.md E1–E5). */
const num = (v: number) => (Number.isFinite(v) && v > 0 ? (v >= 10 ? String(Math.round(v)) : v.toFixed(1)) : '—');

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
}) {
  const hintsOn = useHints();
  const st = baseStats(s, site);
  const here = present(s, site).length;
  const alive = s.survivors.filter((v) => v.status === 'alive');
  const stock = site.stock;
  const foodDays = (stock.food + stock.meals + stock.rawFood) / (Math.max(1, st.population) * 2250);
  const waterDays = stock.water / (Math.max(1, st.population) * 3.3);

  return (
    <header className="topstrip">
      <div className="topstrip-main">
        <div className="stat" title={`Ngày ${dayOf(s.t)} · ${fmtClock(s.t)}`}>
          <span className="label">Ngày</span>
          <span className="v">
            <b className="clock">{dayOf(s.t)}</b>
            <span className="clock dim">{fmtClock(s.t)}</span>
          </span>
        </div>
        <div className={foodDays < 3 ? 'stat bad' : foodDays < 6 ? 'stat warn' : 'stat'} title={`Lương thực còn ${foodDays.toFixed(1)} ngày cho ${st.population} người`}>
          <span className="label">Lương</span>
          <span className="v">
            {num(foodDays)}
            <small>n</small>
          </span>
        </div>
        <div className={waterDays < 2 ? 'stat bad' : waterDays < 4 ? 'stat warn' : 'stat'} title={`Nước uống còn ${waterDays.toFixed(1)} ngày`}>
          <span className="label">Nước</span>
          <span className="v">
            {num(waterDays)}
            <small>n</small>
          </span>
        </div>
        <div className={st.beds < here ? 'stat warn' : 'stat'} title={`${alive.length} người sống · ${here} ở đây · ${st.beds} giường`}>
          <span className="label">Người</span>
          <span className="v">
            {alive.length}
            <span className="faint">/</span>
            {here}
          </span>
        </div>
        <div className={st.defenseStatic <= 0 ? 'stat bad' : st.defenseStatic < 15 ? 'stat warn' : 'stat'} title="Điểm phòng thủ khi bị tập kích đêm: gia cố + rào + tháp canh + công trình">
          <span className="label">Thủ</span>
          <span className="v">{Math.round(st.defenseStatic)}</span>
        </div>
        <div className="speed">
          {SPEED_LABEL.map((label, index) => (
            <button key={label} className={speed === index ? 'on' : ''} onClick={() => setSpeed(index)} title="Space / 1-4">
              {label}
            </button>
          ))}
        </div>
        <div className="grow topstrip-actions">
          <span className="ok">{saved}</span>
          <button
            className={hintsOn ? 'on' : ''}
            aria-pressed={hintsOn}
            title="Hiện giải thích dưới mỗi mục (dùng được trên điện thoại, không cần hover)"
            onClick={toggleHints}
          >
            ? Giải thích
          </button>
          <button onClick={onSave}>Lưu</button>
          <button onClick={onExit}>Thoát</button>
        </div>
      </div>
      <div className="topstrip-nav">
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
