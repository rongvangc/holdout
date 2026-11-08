import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PeopleView } from '../src/ui/PeopleView';
import { newGame } from '../src/sim/state';
import { makeTestWorld } from '../scripts/headless';

function render() {
  const world = makeTestWorld();
  const base = world.buildings.find((b) => b.area > 250 && b.area < 900)!;
  const s = newGame(world, base.id, 42, new Date(2026, 5, 1));
  return renderToStaticMarkup(
    <PeopleView s={s} world={world} site={s.sites[0]} setSite={() => {}} refresh={() => {}} expandWorld={async () => null} />,
  );
}

describe('people table', () => {
  it('header and body rows carry the same number of cells', () => {
    const html = render();
    const thead = html.match(/<thead>([\s\S]*?)<\/thead>/)?.[1] ?? '';
    const body = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? '';
    const ths = [...thead.matchAll(/<th[^>]*>/g)].length;
    const firstRow = body.match(/<tr[^>]*>([\s\S]*?)<\/tr>/)?.[1] ?? '';
    const tds = [...firstRow.matchAll(/<td[^>]*>/g)].length;
    expect(ths).toBe(13);
    expect(tds).toBe(ths);
  });

  // .label::before chèn '▸ ' — trong <tr> trình duyệt biến nó thành một ô ảo,
  // đẩy toàn bộ tiêu đề lệch sang phải một cột. Hàng tiêu đề không được mang class label.
  it('header row does not carry the label class (phantom ::before cell)', () => {
    const html = render();
    const headerRow = html.match(/<thead>\s*(<tr[^>]*>)/)?.[1] ?? '';
    expect(headerRow).not.toMatch(/class="[^"]*\blabel\b/);
  });

  it('stylesheet guards table rows against .label::before', () => {
    const css = readFileSync('src/ui/styles.css', 'utf8');
    expect(css).toMatch(/table\s+(tr\.label|thead\s+tr)::before\s*\{\s*content:\s*none/);
  });
});
