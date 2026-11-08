import type { ReactNode } from 'react';
import type { GameState, Site } from '../../sim/types';
import type { World } from '../../world/types';
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
}) {
  void _world;
  const { sheet, closeSheet } = useOverlay();

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
        <main className="overlay-stage">{children}</main>
      </div>
      <Sheet open={sheet !== null && sheet !== 'kho'} onClose={closeSheet} title={sheet ?? ''}>
        {null}
      </Sheet>
    </div>
  );
}
