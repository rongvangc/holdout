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
  const { khoOpen, toggleKho, sheet, closeSheet } = useOverlay();
  const title = sheet === 'kho' || khoOpen ? `Kho · ${site.name}` : sheet ?? '';

  return (
    <div className="overlay-shell">
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
        onKho={toggleKho}
      />
      <main className="overlay-stage">{children}</main>
      <Sheet open={khoOpen || sheet !== null} onClose={closeSheet} title={title}>
        {khoOpen ? <KhoDrawer s={s} site={site} /> : null}
      </Sheet>
    </div>
  );
}
