import { describe, expect, it } from 'vitest';
import { CONTAINER_L, hasContainer, liquidFree, liquidRoom, liquidUsed } from '../src/sim/containers';
import { siphon, siphonRoom, makeVehicle } from '../src/sim/vehicles';
import { newGame } from '../src/sim/state';
import { makeTestWorld } from '../scripts/headless';

function setup() {
  const world = makeTestWorld();
  const b = world.buildings.filter((x) => x.area > 250 && x.area < 900)[0];
  const s = newGame(world, b.id, 7, new Date(2026, 5, 1));
  return { s, site: s.sites[0] };
}

describe('liquids need a container', () => {
  it('counts litres from the cans in stock', () => {
    const { site } = setup();
    site.stock = { can_20l: 3, misc_jerrycan: 1 } as typeof site.stock;
    expect(liquidRoom(site.stock)).toBe(CONTAINER_L.can_20l * 3 + CONTAINER_L.misc_jerrycan);
    expect(hasContainer(site.stock)).toBe(true);
  });

  it('does not let dirty water eat the drinking cans', () => {
    const { site } = setup();
    site.stock = { can_20l: 5, water: 20, fuel: 10, dirtyWater: 900 } as typeof site.stock;
    // Nước bẩn nằm trong bể, không trong can.
    expect(liquidUsed(site.stock)).toBe(30);
    expect(liquidFree(site.stock)).toBe(100 - 30);
  });

  it('a colony with no cans can carry nothing', () => {
    const { site } = setup();
    site.stock = {} as typeof site.stock;
    expect(liquidRoom(site.stock)).toBe(0);
    expect(liquidFree(site.stock)).toBe(0);
    expect(hasContainer(site.stock)).toBe(false);
  });

  it('starts with enough cans for the water it already stores', () => {
    const { site } = setup();
    const used = liquidUsed(site.stock);
    expect(used).toBe(80); // 80 L nước uống; 40 L nước bẩn nằm trong bể, không tính
    expect(liquidFree(site.stock)).toBeGreaterThan(0);
  });
});

describe('siphoning petrol out of a car', () => {
  it('moves the tank into the cans, never more than they hold', () => {
    const { site } = setup();
    site.stock = { can_20l: 1, water: 0 } as typeof site.stock;
    const v = makeVehicle('car', site.id, 'v1');
    v.fuelL = 40; // bình 50 L
    site.vehicles = [v];
    const moved = siphon(site, v);
    expect(moved).toBe(20); // chỉ có một can
    expect(v.fuelL).toBe(20);
    expect(site.stock.fuel).toBe(20);
  });

  it('refuses when there is no can, and when the tank is dry', () => {
    const { site } = setup();
    site.stock = {} as typeof site.stock;
    const v = makeVehicle('car', site.id, 'v1');
    v.fuelL = 30;
    site.vehicles = [v];
    expect(siphonRoom(site)).toBe(0);
    expect(siphon(site, v)).toBe(0);
    expect(v.fuelL).toBe(30);
    site.stock = { can_20l: 2 } as typeof site.stock;
    v.fuelL = 0;
    expect(siphon(site, v)).toBe(0);
  });

  it('a wrecked car still has petrol worth taking', () => {
    const { site } = setup();
    site.stock = { can_20l: 2, water: 0 } as typeof site.stock;
    const v = makeVehicle('van', site.id, 'v1');
    v.condition = 0; // không nổ máy được
    v.fuelL = 30;
    site.vehicles = [v];
    expect(siphon(site, v)).toBe(30);
    expect(site.stock.fuel).toBe(30);
  });
});
