import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { mainSite, newGame } from '../src/sim/state';
import { ReadoutBar } from '../src/ui/ReadoutBar';
import { makeTestWorld } from '../scripts/headless';

function setup() {
  const world = makeTestWorld();
  const baseB = world.buildings.filter((b) => b.area > 250 && b.area < 900)[0];
  const s = newGame(world, baseB.id, 42, new Date(2026, 5, 1));
  const site = mainSite(s);
  return { world, s, site };
}

describe('ReadoutBar render', () => {
  it('mỗi gauge có nhãn nhìn thấy được (không chỉ tooltip)', () => {
    const { s, site } = setup();
    const html = renderToStaticMarkup(createElement(ReadoutBar, { s, site }));
    for (const label of ['Ăn', 'Uống', 'Giường', 'Tinh thần', 'Phòng thủ']) {
      expect(html).toContain(`<span class="rlabel">${label}</span>`);
    }
    // 5 gauge + 3 chip site vẫn render
    expect(html.match(/class="gauge /g)?.length).toBe(5);
    expect(html.match(/class="chip tone-/g)?.length).toBe(3);
  });
});

describe('styles.css specificity', () => {
  const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');

  it('thanh bar phải đổi màu theo tone đè được rule .gauge .bar .fill gốc', () => {
    expect(css).toContain('.gauge.tone-warn .bar .fill');
    expect(css).toContain('.gauge.tone-bad .bar .fill');
  });

  it('chip phải đổi màu chữ theo tone đè được rule .chip gốc', () => {
    expect(css).toMatch(/\.chip\.tone-warn[^{]*\{[^}]*(?:^|[;{\s])color:/m);
    expect(css).toMatch(/\.chip\.tone-bad[^{]*\{[^}]*(?:^|[;{\s])color:/m);
  });
});
