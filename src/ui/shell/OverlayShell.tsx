import type { ReactNode } from 'react';
import type { GameState, Site } from '../../sim/types';
import type { World } from '../../world/types';
import { decide, type Decision } from '../alerts';
import { Sheet } from '../sheet/Sheet';
import { KhoDrawer } from './KhoDrawer';
import { TopStrip, type TabId } from './TopStrip';
import { useOverlay } from './useOverlay';

export function OverlayShell({
  s,
  world: _world,
  site,
  setSite,
  tab,
  setTab,
  children,
  speed,
  setSpeed,
  saved,
  onSave,
  onExit,
  onDecision,
}: {
  s: GameState;
  world: World;
  site: Site;
  setSite: (id: string) => void;
  tab: TabId;
  setTab: (tab: TabId) => void;
  children: ReactNode;
  speed?: number;
  setSpeed?: (speed: number) => void;
  saved?: string;
  onSave?: () => void;
  onExit?: () => void;
  /** Called when a 'Cần quyết định' row is used (R1: it must lead to the fix). */
  onDecision?: (d: Decision) => void;
}) {
  void _world;
  const { sheet, closeSheet } = useOverlay();
  const decisions = decide(s, site);

  return (
    <div className="overlay-shell">
      <aside className="kho-sidebar">
        <KhoDrawer s={s} site={site} />
      </aside>
      <div className="overlay-main">
        <TopStrip
          s={s}
          site={site}
          setSite={setSite}
          tab={tab}
          setTab={setTab}
          speed={speed}
          setSpeed={setSpeed}
          saved={saved}
          onSave={onSave}
          onExit={onExit}
        />
        {decisions.length > 0 && (
          <div className="decisions" role="status" aria-live="polite">
            <span className="decisions-label">Cần quyết định</span>
            <div className="decisions-rows">
              {decisions.map((d) => (
                <div key={d.id} className={`decision ${d.level}`}>
                  <i className="dot" />
                  <span className="decision-text">{d.text}</span>
                  <button className={d.level === 'bad' ? 'mini pri' : 'mini'} onClick={() => onDecision?.(d)}>
                    {d.action}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        <main className="overlay-stage">{children}</main>
      </div>
      <Sheet open={sheet !== null && sheet !== 'kho'} onClose={closeSheet} title={sheet ?? ''}>
        {null}
      </Sheet>
    </div>
  );
}
