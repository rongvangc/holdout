import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { KhoDrawer } from '../src/ui/shell/KhoDrawer';
import { makeVehicle } from '../src/sim/vehicles';
import { newGame } from '../src/sim/state';
import { makeTestWorld } from '../scripts/headless';

function setup() {
  const world = makeTestWorld();
  const b = world.buildings.filter((x) => x.area > 250 && x.area < 900)[0];
  const s = newGame(world, b.id, 7, new Date(2026, 5, 1));
  return { s, site: s.sites[0] };
}

describe('fleet panel in the store drawer', () => {
  it('shows each car with its own tank and wear', () => {
    const { s, site } = setup();
    const v = makeVehicle('van', site.id, 'v1');
    v.fuelL = 12;
    v.condition = 48;
    site.vehicles = [v];
    const html = renderToStaticMarkup(<KhoDrawer s={s} site={site} />);
    expect(html).toContain('Xe trong sân');
    expect(html).toContain('van'.length ? v.label : '');
    expect(html).toContain('48');
    expect(html).toContain('12/65');
  });

  it('has no fleet section when the yard is empty', () => {
    const { s, site } = setup();
    site.vehicles = [];
    const html = renderToStaticMarkup(<KhoDrawer s={s} site={site} />);
    expect(html).not.toContain('Xe trong sân');
  });
});
