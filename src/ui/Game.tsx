import { useEffect, useReducer, useRef, useState } from 'react';
import { dayOf, fmtClock } from '../core/time';
import { ITEMS, STOCK_ORDER } from '../data/items';
import { advanceTo } from '../sim/engine';
import { baseStats, log, present, rebindWorld, siteById } from '../sim/state';
import type { GameState, LogEntry, Site } from '../sim/types';
import { loadWorld } from '../world/loader';
import type { World } from '../world/types';
import { BaseView } from './BaseView';
import { Icon, ITEM_ICONS } from './icons';
import { LawsView } from './LawsView';
import { LogView } from './LogView';
import { MapView } from './MapView';
import { PeopleView } from './PeopleView';
import { saveGame } from './save';

// Game seconds per real second.
const SPEEDS = [0, 60, 600, 3600, 4 * 3600];
const SPEED_LABEL = ['❚❚', '1×', '10×', '60×', '240×'];
type Tab = 'base' | 'people' | 'map' | 'laws' | 'log';

export interface ViewProps {
  s: GameState;
  world: World;
  site: Site;
  setSite: (id: string) => void;
  refresh: () => void;
  expandWorld: (onProgress: (msg: string) => void) => Promise<string | null>;
}

const EXPAND_STEP = 800;
export const MAX_RADIUS = 3200;

const SITE_ICON: Record<Site['kind'], string> = { base: '■', outpost: '▪', field: '❦' };

export function fmtNum(v: number): string {
  if (v >= 10000) return `${(v / 1000).toFixed(0)}k`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  if (v >= 100) return Math.round(v).toString();
  return v.toFixed(v >= 10 ? 0 : 1);
}

export function Game({ initial, world: initialWorld, onExit }: { initial: GameState; world: World; onExit: () => void }) {
  const sRef = useRef(initial);
  const s = sRef.current;
  const [world, setWorld] = useState(initialWorld);
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const [speed, setSpeed] = useState(1);
  const [tab, setTab] = useState<Tab>('base');
  const [toast, setToast] = useState<LogEntry | null>(null);
  const [saved, setSaved] = useState('');
  const [siteId, setSiteId] = useState(s.sites[0].id);
  const lastDay = useRef(dayOf(s.t));

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      const sp = SPEEDS[speed];
      if (sp > 0 && !s.gameOver) {
        advanceTo(s, world, s.t + dt * sp);
        if (s.alerts.length) {
          const bad = s.alerts.find((a) => a.level === 'bad');
          setToast(s.alerts[s.alerts.length - 1]);
          if (bad) setSpeed(0);
          s.alerts = [];
        }
        const d = dayOf(s.t);
        if (d !== lastDay.current) {
          lastDay.current = d;
          saveGame(s).catch(() => undefined);
        }
      }
      acc += dt;
      if (acc > 0.1) {
        acc = 0;
        bump();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [speed, s, world]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        setSpeed((x) => (x === 0 ? 1 : 0));
      }
      const n = Number(e.key);
      if (n >= 1 && n <= 4) setSpeed(n);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const site = siteById(s, siteId);
  const st = baseStats(s, site);
  const here = present(s, site).length;
  const alive = s.survivors.filter((v) => v.status === 'alive');
  const refresh = () => bump();
  const expandWorld = async (onProgress: (msg: string) => void): Promise<string | null> => {
    if (s.expeditions.length) return 'Chờ mọi đội về hết rồi mới mở rộng được';
    if (world.radius >= MAX_RADIUS) return 'Đã tối đa';
    setSpeed(0);
    try {
      const w = await loadWorld(world.center[1], world.center[0], Math.min(MAX_RADIUS, world.radius + EXPAND_STEP), world.source === 'synthetic', onProgress);
      w.greens ??= [];
      const lost = rebindWorld(s, w);
      if (lost.length) return `Không khớp được: ${lost.join(', ')}`;
      setWorld(w);
      log(s, `Bản đồ mở rộng tới bán kính ${w.radius} m (${w.buildings.length.toLocaleString('vi')} toà nhà).`, 'good');
      await saveGame(s);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  };
  const doSave = async () => {
    await saveGame(s);
    setSaved('Đã lưu');
    setTimeout(() => setSaved(''), 1500);
  };
  const props: ViewProps = { s, world, site, setSite: setSiteId, refresh, expandWorld };
  const pop = Math.max(1, st.population);
  const stock = site.stock;

  return (
    <div className="game">
      <div className="topbar">
        <div className="stat">
          <span className="label">Ngày</span>
          <div className="row" style={{ gap: 10 }}>
            <span className="clock">{dayOf(s.t)}</span>
            <span className="clock dim">{fmtClock(s.t)}</span>
          </div>
        </div>
        <div className="speed">
          {SPEED_LABEL.map((l, i) => (
            <button key={l} className={speed === i ? 'on' : ''} onClick={() => setSpeed(i)} title="Space / 1-4">
              {l}
            </button>
          ))}
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
            <b>{alive.length}</b> người
            <span className="faint">/</span>
            <b>{here}</b> ở đây
            <span className="faint">/</span>
            <b className={st.beds < here ? 'amber' : ''}>{st.beds}</b> giường
          </span>
        </div>
        <div className="stat">
          <span className="label">Điểm này</span>
          <span className="v">
            <span className={site.heat > 45 ? 'red' : ''}> Nhiệt {Math.round(site.heat)}</span>
            <span className="faint">/</span>
            <span className={site.filth > 40 ? 'red' : ''}>Bẩn {Math.round(site.filth)}</span>
            <span className="faint">/</span>
            <span>Xác {Math.round(site.corpses)}</span>
          </span>
        </div>
        <div className="stat">
          <span className="label">Phòng thủ</span>
          <span className="v">{Math.round(st.defenseStatic)}</span>
        </div>
        <div className="grow" style={{ justifyContent: 'flex-end' }}>
          <span className="ok">{saved}</span>
          <button onClick={doSave}>Lưu</button>
          <button
            onClick={() => {
              saveGame(s).finally(onExit);
            }}
          >
            Thoát
          </button>
        </div>
      </div>

      <div className="stockpanel">
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
        <div className="label">Đủ dùng ({here} người)</div>
        <div className="kv">
          <span>Ăn</span>
          <span className={(stock.food + stock.meals + stock.rawFood) / (pop * 2250) < 3 ? 'red' : ''}>
            {((stock.food + stock.meals + stock.rawFood) / (pop * 2250)).toFixed(1)} ngày
          </span>
          <span>Uống</span>
          <span className={stock.water / (pop * 3.3) < 2 ? 'red' : ''}>{(stock.water / (pop * 3.3)).toFixed(1)} ngày</span>
          <span>Nước bẩn</span>
          <span>
            {Math.round(stock.dirtyWater)}/{st.waterCapacity} L
          </span>
          <span>Củi gom</span>
          <span>{site.salvageLeft.wood > 0 ? `${Math.round(site.salvageLeft.wood)} kg còn` : 'hết (đi xa hơn)'}</span>
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

      <div className="center">
        <div className="sitesbar">
          {s.sites.map((x) => {
            const n = present(s, x).length;
            const xs = x.stock;
            const days = Math.min((xs.food + xs.meals + xs.rawFood) / (Math.max(1, n) * 2250), xs.water / (Math.max(1, n) * 3.3));
            return (
              <button key={x.id} className={x.id === site.id ? 'on' : ''} onClick={() => setSiteId(x.id)}>
                {SITE_ICON[x.kind]} {x.name} · {n}
                {n > 0 && days < 2 && <span className="red"> !</span>}
              </button>
            );
          })}
        </div>
        <div className="tabs">
          {(
            [
              ['base', 'Căn cứ'],
              ['people', `Người (${alive.length})`],
              ['map', 'Bản đồ & viễn chinh'],
              ['laws', 'Luật'],
              ['log', 'Nhật ký'],
            ] as [Tab, string][]
          ).map(([k, l]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
              {l}
            </button>
          ))}
        </div>
        <div className="content">
          {tab === 'base' && <BaseView key={site.id} {...props} />}
          {tab === 'people' && <PeopleView {...props} />}
          {tab === 'map' && <MapView key={world.key} {...props} />}
          {tab === 'laws' && <LawsView {...props} />}
          {tab === 'log' && <LogView {...props} />}
        </div>
      </div>

      {toast && (
        <div className="toast" onClick={() => setToast(null)}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
