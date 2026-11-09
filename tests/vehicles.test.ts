import { describe, expect, it } from 'vitest';
import {
  MAX_FLEET,
  MIN_CONDITION,
  addVehicle,
  vehicleOdds,
  vehicleValue,
  burnFuel,
  canRepair,
  fuelFor,
  makeVehicle,
  migrateVehicles,
  pickVehicle,
  refuel,
  repairVehicle,
  syncVehicleStock,
  usableCount,
  VEHICLE_KINDS,
} from '../src/sim/vehicles';
import { newGame } from '../src/sim/state';
import { makeTestWorld } from '../scripts/headless';

function setup() {
  const world = makeTestWorld();
  const b = world.buildings.filter((x) => x.area > 250 && x.area < 900)[0];
  const s = newGame(world, b.id, 7, new Date(2026, 5, 1));
  return { s, site: s.sites[0] };
}

describe('vehicles', () => {
  it('starts with a part-full tank, not an empty or a magic full one', () => {
    const v = makeVehicle('van', 'site0', 'v1');
    expect(v.tankL).toBe(VEHICLE_KINDS.van.tankL);
    expect(v.fuelL).toBeGreaterThan(0);
    expect(v.fuelL).toBeLessThan(v.tankL);
    expect(v.condition).toBeGreaterThan(MIN_CONDITION);
  });

  it('migrates an old save that only counted `stock.vehicle`', () => {
    const { site } = setup();
    site.stock.vehicle = 2;
    delete site.vehicles;
    const list = migrateVehicles(site);
    expect(list).toHaveLength(2);
    expect(list.every((v) => v.siteId === site.id)).toBe(true);
    // Migrating twice must not duplicate the fleet.
    expect(migrateVehicles(site)).toHaveLength(2);
  });

  it('keeps stock.vehicle equal to the number of roadworthy cars', () => {
    const { site } = setup();
    site.vehicles = [makeVehicle('car', site.id, 'a'), makeVehicle('car', site.id, 'b')];
    site.vehicles[1].condition = MIN_CONDITION - 1;
    syncVehicleStock(site);
    expect(usableCount(site)).toBe(1);
    expect(site.stock.vehicle).toBe(1);
  });

  it('refuses a car with no fuel for the trip instead of burning the stock', () => {
    const { site } = setup();
    const v = makeVehicle('car', site.id, 'a');
    v.fuelL = 1;
    site.vehicles = [v];
    const pick = pickVehicle(site, 200);
    expect(pick.vehicle).toBeNull();
    expect(pick.why).toMatch(/xăng/);
  });

  it('prefers the car that carries the most per litre', () => {
    const { site } = setup();
    const car = makeVehicle('car', site.id, 'car');
    const truck = makeVehicle('truck', site.id, 'truck');
    // Both full; the car goes further on a litre, the truck carries more per litre.
    car.fuelL = car.tankL;
    truck.fuelL = truck.tankL;
    site.vehicles = [car, truck];
    expect(pickVehicle(site, 100).vehicle?.kind).toBe('truck');
  });

  it('burns fuel and wears the machine over real kilometres', () => {
    const { site } = setup();
    const v = makeVehicle('pickup', site.id, 'a');
    v.fuelL = v.tankL;
    const before = { fuel: v.fuelL, cond: v.condition };
    const km = 120;
    burnFuel(v, km);
    expect(v.fuelL).toBeCloseTo(before.fuel - fuelFor(v, km), 1);
    expect(v.condition).toBeLessThan(before.cond);
    expect(v.fuelL).toBeGreaterThanOrEqual(0);
  });

  it('a worn engine drinks more for the same distance', () => {
    const fresh = makeVehicle('car', 's', 'a');
    const worn = { ...fresh, condition: 20 };
    expect(fuelFor(worn, 100)).toBeGreaterThan(fuelFor(fresh, 100));
  });

  it('refuels from stock and never overfills the tank', () => {
    const { site } = setup();
    const v = makeVehicle('car', site.id, 'a');
    v.fuelL = 0;
    site.stock.fuel = 100;
    expect(refuel(site, v, 500)).toBeCloseTo(v.tankL, 5);
    expect(v.fuelL).toBeCloseTo(v.tankL, 5);
    expect(site.stock.fuel).toBeCloseTo(100 - v.tankL, 5);
    // Tank full: nothing moves.
    expect(refuel(site, v, 10)).toBe(0);
  });

  it('repairs with scrap and parts, and a dead car comes back to usable', () => {
    const { site } = setup();
    const v = makeVehicle('car', site.id, 'a');
    v.condition = 5;
    site.vehicles = [v];
    syncVehicleStock(site);
    expect(site.stock.vehicle).toBe(0);
    site.stock.scrap = 10;
    site.stock.parts = 5;
    expect(canRepair(site, v)).toBe(true);
    expect(repairVehicle(site, v)).toBe(true);
    expect(v.condition).toBe(40);
    expect(site.stock.scrap).toBe(6);
    expect(site.stock.parts).toBe(3);
    expect(site.stock.vehicle).toBe(1);
  });

  it('starts the colony with the car they arrived in', () => {
    const { site } = setup();
    expect(site.vehicles).toHaveLength(1);
    const v = site.vehicles![0];
    expect(v.fuelL).toBeGreaterThan(0);
    expect(v.condition).toBeGreaterThanOrEqual(MIN_CONDITION);
    expect(site.stock.vehicle).toBe(1);
  });

  it('finds cars far more often early, and almost never after months', () => {
    expect(vehicleOdds('fuel', 1)).toBeGreaterThan(vehicleOdds('fuel', 90));
    expect(vehicleOdds('fuel', 90)).toBeGreaterThan(vehicleOdds('fuel', 400));
    // Một trạm xăng có xe nhiều hơn một nhà dân.
    expect(vehicleOdds('fuel', 10)).toBeGreaterThan(vehicleOdds('houselabel', 10));
    expect(vehicleOdds('generic', 400)).toBeGreaterThan(0);
  });

  it('keeps the yard to MAX_FLEET cars and drops the worst one', () => {
    const { site } = setup();
    site.vehicles = [];
    const added: ReturnType<typeof makeVehicle>[] = [];
    for (let i = 0; i < MAX_FLEET + 2; i++) {
      const v = makeVehicle('car', site.id, `v${i}`);
      v.condition = 40 + i * 5;
      added.push(v);
      addVehicle(site, v);
    }
    expect(site.vehicles).toHaveLength(MAX_FLEET);
    // Chiếc tệ nhất bị bỏ lại phải là chiếc mòn nhất.
    expect(site.vehicles!.some((v) => v.id === added[0].id)).toBe(false);
    expect(Math.min(...site.vehicles!.map(vehicleValue))).toBeGreaterThan(vehicleValue(added[0]));
  });

  it('cannot repair past 100 or without materials', () => {
    const { site } = setup();
    const v = makeVehicle('car', site.id, 'a');
    v.condition = 96;
    site.vehicles = [v];
    site.stock.scrap = 0;
    site.stock.parts = 0;
    expect(canRepair(site, v)).toBe(false);
    expect(repairVehicle(site, v)).toBe(false);
    v.condition = 90;
    site.stock.scrap = 99;
    site.stock.parts = 99;
    repairVehicle(site, v);
    expect(v.condition).toBe(100);
  });
});
