import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/items';
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

  it('renders the warehouse grouped by category, showing what is actually in stock', () => {
    const { s, site } = setup();
    const html = renderToStaticMarkup(<KhoDrawer s={s} site={site} />);

    // Tab nhóm + mọi item đang có hàng của nhóm đang chọn (mặc định: Vật liệu).
    expect(html).toContain('Vật liệu');
    const held = Object.entries(site.stock).filter(([, n]) => (n ?? 0) > 0.01);
    expect(held.length).toBeGreaterThan(3);
    expect(html).toContain(`${held.length} loại`);
    expect(html).toContain(ITEMS.wood.label);
    // Đồ ăn nằm ở nhóm khác nên không hiện khi đang xem Vật liệu.
    expect(html).not.toContain(ITEMS.meals.label);
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
