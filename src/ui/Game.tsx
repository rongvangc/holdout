import { useEffect, useReducer, useRef, useState } from 'react';
import { dayOf } from '../core/time';
import { advanceTo } from '../sim/engine';
import { log, rebindWorld, siteById } from '../sim/state';
import type { GameState, LogEntry, Site } from '../sim/types';
import { loadWorld } from '../world/loader';
import type { World } from '../world/types';
import { BaseView } from './BaseView';
import { LawsView } from './LawsView';
import { LogView } from './LogView';
import { MapView } from './MapView';
import { PeopleView } from './PeopleView';
import { saveGame } from './save';
import { OverlayShell } from './shell/OverlayShell';
import type { TabId } from './shell/TopStrip';

const SPEEDS = [0, 60, 600, 3600, 4 * 3600];
type Tab = TabId;

export interface ViewProps {
  s: GameState;
  world: World;
  site: Site;
  setSite: (id: string) => void;
  refresh: () => void;
  expandWorld: (onProgress: (msg: string) => void) => Promise<string | null>;
  /** Section a 'Cần quyết định' row asked to open (see ui/alerts.ts). */
  focusPanel?: string | null;
}

const EXPAND_STEP = 800;
export const MAX_RADIUS = 3200;

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
  // R1: a decision row jumps to the tab *and* the section that can fix it.
  const [focusPanel, setFocusPanel] = useState<string | null>(null);
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
  const props: ViewProps = { s, world, site, setSite: setSiteId, refresh, expandWorld, focusPanel };

  return (
    <div className="game">
      <OverlayShell
        s={s}
        world={world}
        site={site}
        setSite={setSiteId}
        tab={tab}
        setTab={setTab}
        onDecision={(d) => {
          setTab(d.tab);
          setFocusPanel(d.panel ?? null);
          refresh();
        }}
        speed={speed}
        setSpeed={setSpeed}
        saved={saved}
        onSave={doSave}
        onExit={() => {
          saveGame(s).finally(onExit);
        }}
      >
        {tab === 'base' && <BaseView key={site.id} {...props} />}
        {tab === 'people' && <PeopleView {...props} />}
        {tab === 'map' && <MapView key={world.key} {...props} />}
        {tab === 'laws' && <LawsView {...props} />}
        {tab === 'log' && <LogView {...props} />}
      </OverlayShell>
      {toast && (
        <div className="toast" onClick={() => setToast(null)}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
