import { describe, expect, it } from 'vitest';
import type { ModuleId } from '../src/data/modules';
import {
  APPLIANCES,
  chargeBatteries,
  fuelForLoad,
  GENERATOR_KW,
  KWH_PER_BATTERY,
  planPower,
} from '../src/sim/power';
import { baseStats, newGame } from '../src/sim/state';
import { makeTestWorld } from '../scripts/headless';

function setup() {
  const world = makeTestWorld();
  const b = world.buildings.filter((x) => x.area > 250 && x.area < 900)[0];
  const s = newGame(world, b.id, 13, new Date(2026, 5, 1));
  const site = s.sites[0];
  site.stock.fuel = 200;
  site.stock.solar_panel = 0;
  site.stock.battery = 0;
  site.batteryKwh = 0;
  return { s, site };
}

const put = (site: ReturnType<typeof setup>['site'], m: ModuleId, level = 1) => {
  const room = site.interior.rooms.find((r) => !r.module) ?? site.interior.rooms[0];
  room.module = m;
  room.moduleLevel = level;
  return room;
};

describe('power budget', () => {
  it('no source, no power', () => {
    const { s, site } = setup();
    put(site, 'lighting');
    const p = planPower(s, site, 0, 24);
    expect(p.supply).toBe(0);
    expect(p.on).toEqual([]);
    expect(p.shed).toEqual(['lighting']);
  });

  it('a generator only burns fuel when it actually carries load', () => {
    const { s, site } = setup();
    const before = site.stock.fuel;
    const p = planPower(s, site, 1);
    expect(p.supply).toBe(0);
    expect(p.on).toEqual([]);
    expect(site.stock.fuel).toBe(before); // nothing to power, nothing to burn

    put(site, 'lighting'); // 0.3 kW for 12 h = 0.9 L, not 24
    const p2 = planPower(s, site, 1);
    expect(p2.on).toContain('lighting');
    expect(before - site.stock.fuel).toBeCloseTo(fuelForLoad(0.3), 1);
    expect(before - site.stock.fuel).toBeLessThan(2);
  });

  it('fuel is charged per kWh served, so a light night is cheap', () => {
    expect(fuelForLoad(0.3)).toBeLessThan(fuelForLoad(3));
    expect(fuelForLoad(4)).toBeCloseTo(12, 1); // 4 kW x 12 h x 0.25 L/kWh
  });

  it('sheds load by priority when the budget is short', () => {
    const { s, site } = setup();
    put(site, 'lighting');
    put(site, 'fridge');
    put(site, 'electric_fence');
    const p = planPower(s, site, 1, 24); // 4 kW
    // fence 3 kW runs first, then light 0.3, then the fridge cannot fit.
    expect(p.on).toEqual(['electric_fence', 'lighting']);
    expect(p.shed).toEqual(['fridge']);
    expect(p.demand).toBeCloseTo(4.8);
  });

  it('more generator levels give more kW', () => {
    expect(GENERATOR_KW[2]).toBeGreaterThan(GENERATOR_KW[0]);
    const { s, site } = setup();
    put(site, 'lighting');
    put(site, 'fridge');
    put(site, 'electric_fence');
    const small = planPower(s, site, 1, 24);
    const big = planPower(s, site, 3, 24);
    expect(big.on.length).toBeGreaterThan(small.on.length);
  });

  it('solar charges the battery and the battery carries the night', () => {
    const { s, site } = setup();
    site.stock.solar_panel = 2;
    site.stock.battery = 2;
    const gain = chargeBatteries(s, site);
    expect(gain).toBeGreaterThan(0);
    expect(site.batteryKwh).toBeGreaterThan(0);
    expect(site.batteryKwh).toBeLessThanOrEqual(2 * KWH_PER_BATTERY);

    put(site, 'lighting');
    const p = planPower(s, site, 0, 24);
    expect(p.source).toBe('solar');
    expect(p.on).toContain('lighting');
    expect(site.batteryKwh).toBeLessThan(gain); // the night spent it
  });

  it('storms barely charge and rain halves it', () => {
    const { s, site } = setup();
    site.stock.solar_panel = 2;
    site.stock.battery = 3;
    s.weather.storm = true;
    site.batteryKwh = 0;
    const storm = chargeBatteries(s, site);
    s.weather.storm = false;
    s.weather.rainMm = 5;
    site.batteryKwh = 0;
    const rain = chargeBatteries(s, site);
    s.weather.rainMm = 0;
    site.batteryKwh = 0;
    const sun = chargeBatteries(s, site);
    expect(storm).toBeLessThan(rain);
    expect(rain).toBeLessThan(sun);
  });
});

describe('appliances do something', () => {
  function poweredWith(module: ModuleId, level = 1) {
    const { s, site } = setup();
    put(site, module, level);
    put(site, 'generator', 3);
    const p = planPower(s, site, 3, 24);
    site.powerOn = p.on as string[];
    site.powered = p.on.includes('lighting');
    return { s, site, st: baseStats(s, site) };
  }

  it('fridge keeps food much longer', () => {
    const { st } = poweredWith('fridge', 1);
    expect(st.fridgeRot).toBeLessThan(0.5);
    const { st: top } = poweredWith('fridge', 3);
    expect(top.fridgeRot).toBeLessThan(st.fridgeRot);
  });

  it('pump raises well output, tools speed up work, fence adds defence', () => {
    expect(poweredWith('water_pump').st.pumpYield).toBeGreaterThan(1);
    expect(poweredWith('power_tools').st.toolsSpeed).toBeGreaterThan(1);
    expect(poweredWith('electric_fence').st.fenceDefense).toBeGreaterThan(20);
  });

  it('radio and grow light need power to count', () => {
    const { s, site } = setup();
    put(site, 'radio');
    put(site, 'grow_light');
    site.powerOn = [];
    const off = baseStats(s, site);
    expect(off.radioMorale).toBe(0);
    expect(off.growYield).toBe(1);
    site.powerOn = ['radio', 'grow_light'];
    const on = baseStats(s, site);
    expect(on.radioMorale).toBeGreaterThan(0);
    expect(on.growYield).toBeGreaterThan(1);
  });

  it('every appliance is wired to something that reads it', () => {
    expect(APPLIANCES.length).toBeGreaterThanOrEqual(7);
    for (const a of APPLIANCES) {
      expect(a.kw).toBeGreaterThan(0);
      expect(a.priority).toBeGreaterThan(0);
    }
    // Priorities must be unique, or load shedding is not deterministic.
    const prios = APPLIANCES.map((a) => a.priority);
    expect(new Set(prios).size).toBe(prios.length);
  });
});
