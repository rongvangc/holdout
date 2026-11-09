import { describe, expect, it } from 'vitest';
import {
  FARM_HOURS_PER_WORKER,
  FARM_M2_ONE_WORKER,
  KCAL_PER_PERSON_DAY,
  M2_PER_PERSON,
  PEOPLE_PER_FARMER,
  farmersFor,
  raidBudget,
  siteCapacity,
  WORK_HOURS_PER_DAY,
} from '../src/sim/scale';
import { startingHerd } from '../src/sim/livestock';
import { newGame, mainSite } from '../src/sim/state';
import { makeTestWorld } from '../scripts/headless';
import type { Room } from '../src/base/interior';

describe('một nguồn sự thật', () => {
  it('một nông dân vừa một ngày công và nuôi được vài người', () => {
    expect(FARM_HOURS_PER_WORKER).toBeLessThanOrEqual(WORK_HOURS_PER_DAY);
    expect(PEOPLE_PER_FARMER).toBeGreaterThan(3);
    expect(PEOPLE_PER_FARMER).toBeLessThan(10);
  });

  it('m² cần cho một người khớp với năng suất khoai', () => {
    expect(M2_PER_PERSON).toBeCloseTo(KCAL_PER_PERSON_DAY / (1080 / 90), 5);
  });

  it('số nông dân cần = diện tích / năng lực một người', () => {
    expect(farmersFor(0)).toBe(0);
    expect(farmersFor(1200)).toBe(1);
    expect(farmersFor(1201)).toBe(2);
    expect(farmersFor(FARM_M2_ONE_WORKER * 2)).toBe(2);
  });
});

describe('trần dân số theo lãnh thổ', () => {
  const setup = () => {
    const world = makeTestWorld();
    const b = world.buildings.find((x) => x.area > 250 && x.area < 900)!;
    const s = newGame(world, b.id, 42, new Date(2026, 5, 1));
    return { s, site: mainSite(s) };
  };

  it('vườn 1.200 m² khoai nuôi được ~6-7 người', () => {
    const { site } = setup();
    const room: Room = { id: 'g', floor: 0, outdoor: true, cells: [1], area: 1200, module: 'garden', walled: true, moduleLevel: 1 };
    site.interior.rooms.push(room);
    const cap = siteCapacity(site);
    expect(cap.fromCrops).toBeGreaterThan(5);
    expect(cap.fromCrops).toBeLessThan(9);
  });

  it('dê chăn thả cộng thêm đạm; bầy lỗ calo thì không cộng', () => {
    const { site } = setup();
    const goat = startingHerd('de', 40);
    const withGoats = siteCapacity(site, [{ state: goat, graze: 1 }]);
    const pig = startingHerd('lon', 40);
    const withPigs = siteCapacity(site, [{ state: pig, graze: 1 }]);
    expect(withGoats.fromHerds).toBeGreaterThan(0);
    expect(withPigs.fromHerds).toBe(0);
  });
});

describe('ngân sách tập kích theo lao động', () => {
  it('nhóm 3 người không phải chịu đợt dành cho 10 người', () => {
    expect(raidBudget(3)).toBeLessThan(raidBudget(10));
    expect(raidBudget(3)).toBeLessThanOrEqual(3 * 0.9);
  });

  it('ồn cao làm đợt mạnh hơn nhưng có trần', () => {
    expect(raidBudget(5, 100)).toBeGreaterThan(raidBudget(5, 0));
    expect(raidBudget(5, 100)).toBeLessThanOrEqual(5 * 0.9 * 1.6);
  });
});
