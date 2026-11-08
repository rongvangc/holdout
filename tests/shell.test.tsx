import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ITEMS, STOCK_ORDER } from '../src/data/items';
import { KhoDrawer } from '../src/ui/shell/KhoDrawer';
import { OverlayShell } from '../src/ui/shell/OverlayShell';
import { overlayReducer } from '../src/ui/shell/useOverlay';
import { newGame } from '../src/sim/state';
import { makeTestWorld } from '../scripts/headless';

function setup() {
  const world = makeTestWorld();
  const base = world.buildings.find((building) => building.area > 250 && building.area < 900)!;
  const s = newGame(world, base.id, 42, new Date(2026, 5, 1));
  return { s, world, site: s.sites[0] };
}

describe('overlay shell', () => {
  it('renders the day and resource labels in its top strip', () => {
    const { s, world, site } = setup();
    const html = renderToStaticMarkup(
      <OverlayShell s={s} world={world} site={site} setSite={() => {}} tab="base" setTab={() => {}}>
        <main>Stage</main>
      </OverlayShell>,
    );

    expect(html).toContain('Ngày');
    expect(html).toContain('Đồ ăn');
    expect(html).toContain('Nước sạch');
  });

  it('renders every stock item in the warehouse drawer', () => {
    const { s, site } = setup();
    const html = renderToStaticMarkup(<KhoDrawer s={s} site={site} />);

    expect(STOCK_ORDER).toHaveLength(16);
    for (const item of STOCK_ORDER) expect(html).toContain(ITEMS[item].label);
  });

  it('opens kho as the active sheet after another sheet', () => {
    const toolsOpen = overlayReducer({ khoOpen: false, sheet: null }, { type: 'open', id: 'tools' });
    const khoOpen = overlayReducer(toolsOpen, { type: 'open', id: 'kho' });

    expect(khoOpen).toEqual({ khoOpen: true, sheet: 'kho' });
  });

  it('renders all five primary tabs', () => {
    const { s, world, site } = setup();
    const html = renderToStaticMarkup(
      <OverlayShell s={s} world={world} site={site} setSite={() => {}} tab="base" setTab={() => {}}>
        <main>Stage</main>
      </OverlayShell>,
    );

    const tabbar = html.match(/<nav class="tabbar"[^>]*>(.*?)<\/nav>/)?.[1] ?? '';
    expect((tabbar.match(/<button/g) ?? [])).toHaveLength(5);
  });
});
