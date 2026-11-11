import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { KitchenPanel } from '../src/ui/KitchenPanel';
import { newGame } from '../src/sim/state';
import { makeTestWorld } from '../scripts/headless';

function setup() {
  const world = makeTestWorld();
  const b = world.buildings.filter((x) => x.area > 250 && x.area < 900)[0];
  const s = newGame(world, b.id, 7, new Date(2026, 5, 1));
  const site = s.sites[0];
  const room = site.interior.rooms[0];
  room.module = 'kitchen';
  room.moduleLevel = 1;
  return { s, site };
}

const html = (p: ReturnType<typeof setup>) => renderToStaticMarkup(<KitchenPanel s={p.s} site={p.site} refresh={() => undefined} />);

describe('kitchen panel', () => {
  it('offers at least one cookable dish with the colony food at hand', () => {
    const out = html(setup());
    // 'Nu' buttons without the disabled attribute = affordable after resolving @staple.
    const enabled = (out.match(/<button(?![^>]*disabled)[^>]*>Nấu/gi) ?? []).length;
    expect(enabled).toBeGreaterThan(0);
  });

  it('says so when nobody is on kitchen duty', () => {
    const p = setup();
    for (const v of p.s.survivors) v.role = 'builder';
    expect(html(p)).toContain('Chưa ai giữ vai');
    p.s.survivors[0].role = 'cook';
    expect(html(p)).not.toContain('Chưa ai giữ vai');
  });
});
