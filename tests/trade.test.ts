import { describe, expect, it } from 'vitest';
import { FACTIONS, stackValue, tradeValue } from '../src/data/factions';
import { acceptOffer, caravans, markupFor, repOf, sendAway, tickCaravans } from '../src/sim/npc';
import { addStock, mainSite, newGame } from '../src/sim/state';
import { makeTestWorld } from '../scripts/headless';
import { ITEMS } from '../src/data/items';

function setup(seed = 11) {
  const world = makeTestWorld();
  const b = world.buildings.find((x) => x.area > 250 && x.area < 900)!;
  const s = newGame(world, b.id, seed, new Date(2026, 5, 1));
  s.auto = { craftCore: false, loot: false, garden: false };
  s.autoRoles = false;
  return { s, site: mainSite(s), world };
}

describe('trade data', () => {
  it('mọi món một nhóm buôn bán/đòi đều có thật trong catalog', () => {
    for (const f of FACTIONS) {
      expect(f.sells.length).toBeGreaterThan(0);
      expect(f.buys.length).toBeGreaterThan(0);
      for (const id of [...f.sells, ...f.buys]) expect(ITEMS[id], `${f.id}: ${id}`).toBeTruthy();
      expect(f.markup).toBeGreaterThanOrEqual(1);
    }
  });

  it('giá suy ra từ dữ liệu item: thuốc đắt hơn lương, súng đắt hơn đạn', () => {
    expect(tradeValue('medicine')).toBeGreaterThan(tradeValue('gao'));
    expect(tradeValue('wpn_machete')).toBeGreaterThan(tradeValue('ammo_9x18-ammo'));
    expect(stackValue([['gao', 10]])).toBeCloseTo(10 * tradeValue('gao'));
  });
});

describe('caravan visits', () => {
  it('trong 30 ngày phải có ít nhất một đoàn ghé, mỗi đoàn 2–3 lời đổi', () => {
    const { s, site } = setup();
    let seen = 0;
    for (let d = 0; d < 30; d++) {
      tickCaravans(s, site);
      for (const c of caravans(s)) {
        seen++;
        expect(c.offers.length).toBeGreaterThanOrEqual(2);
        for (const o of c.offers) {
          expect(o.give.length).toBeGreaterThan(0);
          expect(o.take.length).toBeGreaterThan(0);
          // Không đổi chính món mình đang đưa.
          expect(o.give.some(([g]) => o.take.some(([t]) => t === g))).toBe(false);
        }
      }
      // Sang ngày: giả lập bằng cách đẩy thời gian.
      s.t += 86400;
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('đổi được: trừ hàng mình, cộng hàng họ, uy tín lên, lời đổi biến mất', () => {
    const { s, site } = setup();
    for (let d = 0; d < 30 && !caravans(s).length; d++) {
      tickCaravans(s, site);
      if (!caravans(s).length) s.t += 86400;
    }
    const c = caravans(s)[0];
    expect(c).toBeTruthy();
    const offer = c.offers[0];
    for (const [id, n] of offer.take) addStock(s, site, { [id]: n } as never);
    const before = repOf(s, c.faction);
    expect(acceptOffer(s, site, c.id, offer.id)).toBeNull();
    expect(c.offers.some((o) => o.id === offer.id)).toBe(false);
    expect(repOf(s, c.faction)).toBeGreaterThan(before);
    for (const [id, n] of offer.give) expect(site.stock[id] ?? 0).toBeGreaterThanOrEqual(n);
  });

  it('thiếu hàng thì không đổi được và không mất gì', () => {
    const { s, site } = setup();
    for (let d = 0; d < 30 && !caravans(s).length; d++) {
      tickCaravans(s, site);
      if (!caravans(s).length) s.t += 86400;
    }
    const c = caravans(s)[0];
    const offer = c.offers[0];
    for (const [id] of offer.take) site.stock[id] = 0;
    const before = Object.fromEntries(offer.give.map(([id]) => [id, site.stock[id] ?? 0]));
    const err = acceptOffer(s, site, c.id, offer.id);
    expect(err).toContain('Không đủ');
    expect(c.offers.some((o) => o.id === offer.id)).toBe(true);
    for (const [id] of offer.give) expect(site.stock[id] ?? 0).toBe(before[id]);
  });

  it('đuổi khách thì mất uy tín, và uy tín cao thì giá rẻ hơn', () => {
    const { s, site } = setup();
    for (let d = 0; d < 30 && !caravans(s).length; d++) {
      tickCaravans(s, site);
      if (!caravans(s).length) s.t += 86400;
    }
    const c = caravans(s)[0];
    const before = markupFor(s, c.faction);
    sendAway(s, c.id);
    expect(caravans(s).length).toBe(0);
    expect(repOf(s, c.faction)).toBeLessThan(0);
    expect(markupFor(s, c.faction)).toBeGreaterThan(before);
    s.caravan!.rep[c.faction] = 6;
    expect(markupFor(s, c.faction)).toBeLessThan(before);
  });
});
