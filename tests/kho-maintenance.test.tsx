import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/items';
import { KhoDrawer } from '../src/ui/shell/KhoDrawer';
import { ammoFor } from '../src/sim/equipment';
import { newGame } from '../src/sim/state';
import { makeTestWorld } from '../scripts/headless';

function setup() {
  const world = makeTestWorld();
  const b = world.buildings.filter((x) => x.area > 250 && x.area < 900)[0];
  const s = newGame(world, b.id, 41, new Date(2026, 5, 1));
  return { s, site: s.sites[0] };
}

const render = (s: ReturnType<typeof setup>['s'], site: ReturnType<typeof setup>['site']) =>
  renderToStaticMarkup(<KhoDrawer s={s} site={site} />);

const firstBlade = () =>
  Object.entries(ITEMS).find(([, d]) => (d.mechanic ?? '') === 'weapon_blade' && (d.durability ?? 0) > 0)![0];

describe('Kho owns maintenance', () => {
  it('shows nothing to maintain when the store is fresh', () => {
    const { s, site } = setup();
    expect(render(s, site)).not.toContain('Cần bảo trì');
  });

  it('lists a worn weapon with a repair action', () => {
    const { s, site } = setup();
    const blade = firstBlade();
    site.stock[blade] = 2;
    site.condition = { [blade]: 0.4 };
    const html = render(s, site);
    expect(html).toContain('Cần bảo trì');
    expect(html).toContain('mòn 60%');
    expect(html).toContain('Sửa');
  });

  it('warns about a gun with no cartridges of its calibre', () => {
    const { s, site } = setup();
    const gun = Object.entries(ITEMS).find(([, d]) => d.mechanic === 'firearm')![0];
    const ammo = ammoFor(gun)!;
    site.stock[gun] = 1;
    site.stock[ammo] = 0;
    expect(render(s, site)).toContain('không có đạn');
  });

  it('does not warn when the cartridges are in the store', () => {
    const { s, site } = setup();
    const gun = Object.entries(ITEMS).find(([, d]) => d.mechanic === 'firearm')![0];
    const ammo = ammoFor(gun)!;
    site.stock[gun] = 1;
    site.stock[ammo] = 12;
    expect(render(s, site)).not.toContain('không có đạn');
  });
});
