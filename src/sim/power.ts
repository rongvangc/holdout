import type { ModuleId } from '../data/modules';
import { take } from './state';
import type { GameState, Site } from './types';

/**
 * Electricity.
 *
 * Before this file, "powered" was a boolean that removed the night work penalty —
 * a generator had exactly one use. Power is now a budget: sources supply kW,
 * appliances demand kW, and when supply falls short the load is shed in priority
 * order instead of everything dying at once.
 */

export const KW_PER_SOLAR_PANEL = 1.5;
/** Litres a diesel set burns per kWh delivered (small genset, partial load). */
export const FUEL_L_PER_KWH = 0.25;
/** Hours the generator runs each night. */
export const NIGHT_HOURS = 12;
export const KWH_PER_BATTERY = 3;
/** Hours of usable daylight a panel gets, before weather. */
export const SOLAR_HOURS = 5;
/** kW a generator of each level puts out. */
export const GENERATOR_KW = [4, 6, 8];

export interface Appliance {
  module: ModuleId;
  label: string;
  /** kW drawn while it runs. */
  kw: number;
  /** Lower runs first when the budget is short. */
  priority: number;
}

/**
 * What electricity is for. Priority is deliberately not the same as usefulness:
 * defence and light keep people alive; the grow light is a luxury you earn.
 */
export const APPLIANCES: Appliance[] = [
  { module: 'electric_fence', label: 'Hàng rào điện', kw: 3, priority: 1 },
  { module: 'lighting', label: 'Đèn điện', kw: 0.3, priority: 2 },
  { module: 'fridge', label: 'Tủ lạnh', kw: 1.5, priority: 3 },
  { module: 'water_pump', label: 'Bơm nước', kw: 1, priority: 4 },
  { module: 'power_tools', label: 'Máy móc điện', kw: 2, priority: 5 },
  { module: 'radio', label: 'Radio', kw: 0.3, priority: 6 },
  { module: 'grow_light', label: 'Đèn trồng cây', kw: 2, priority: 7 },
];

export interface PowerState {
  /** kW available tonight. */
  supply: number;
  /** kW wanted by every appliance that is built. */
  demand: number;
  /** Appliances that actually got power, in priority order. */
  on: ModuleId[];
  /** Appliances that were built but had to be shed. */
  shed: ModuleId[];
  source: 'solar' | 'generator' | 'none';
}

const built = (site: Site, m: ModuleId): boolean => site.interior.rooms.some((r) => r.module === m);

/** Charge batteries from the sun: panels × kW × usable hours, capped by capacity. */
export function chargeBatteries(s: GameState, site: Site): number {
  const panels = site.stock.solar_panel ?? 0;
  const batteries = site.stock.battery ?? 0;
  if (panels < 1 || batteries < 1) return 0;
  const weatherFactor = s.weather.storm ? 0.15 : s.weather.rainMm > 0 ? 0.5 : 1;
  const gain = panels * KW_PER_SOLAR_PANEL * SOLAR_HOURS * weatherFactor;
  const cap = batteries * KWH_PER_BATTERY;
  site.batteryKwh = Math.min(cap, (site.batteryKwh ?? 0) + gain);
  return gain;
}

/**
 * Work out tonight's power, spend fuel if a generator has to run, and shed load
 * by priority. Called once per day, at dusk.
 */
/** Fuel a night costs at a given served load. Paying for capacity you do not use is waste. */
export const fuelForLoad = (kw: number): number => Math.ceil(kw * FUEL_L_PER_KWH * NIGHT_HOURS * 10) / 10;

export function planPower(_s: GameState, site: Site, generatorLevel: number, _generatorFuel = 0): PowerState {
  const solarKwh = Math.min(site.batteryKwh ?? 0, (site.stock.battery ?? 0) * KWH_PER_BATTERY);
  let supply = 0;
  let source: PowerState['source'] = 'none';

  // Batteries first: free, silent, already paid for.
  if (solarKwh > 0) {
    supply = solarKwh;
    source = 'solar';
  }
  const wanted = APPLIANCES.filter((a) => built(site, a.module)).sort((a, b) => a.priority - b.priority);
  const demand = wanted.reduce((sum, a) => sum + a.kw, 0);

  // Generator capacity is a ceiling; fuel is paid per kWh actually delivered, and
  // it only runs for the load it can afford.
  const genKw = generatorLevel > 0 ? GENERATOR_KW[Math.max(0, Math.min(2, generatorLevel - 1))] : 0;
  const fuel = site.stock.fuel ?? 0;
  const affordableKw = Math.min(genKw, Math.floor((fuel / (FUEL_L_PER_KWH * NIGHT_HOURS)) * 10) / 10);

  let left = supply + affordableKw;
  const on: ModuleId[] = [];
  const shed: ModuleId[] = [];
  for (const a of wanted) {
    if (left >= a.kw) {
      left -= a.kw;
      on.push(a.module);
    } else shed.push(a.module);
  }

  const servedKw = on.reduce((sum, m) => sum + (APPLIANCES.find((a) => a.module === m)?.kw ?? 0), 0);
  // Solar covers its share first; the generator bills only the remainder.
  const batteryUsed = Math.min(supply, servedKw);
  const genServed = Math.max(0, servedKw - batteryUsed);
  if (genServed > 0) {
    supply = batteryUsed + genKw;
    if (source === 'none') source = 'generator';
    take(site, 'fuel', fuelForLoad(genServed));
    site.heat = Math.min(100, site.heat + Math.min(6, genServed));
  }
  // Solar draws down the battery for what it delivered.
  if (source === 'solar') site.batteryKwh = Math.max(0, (site.batteryKwh ?? 0) - Math.min(site.batteryKwh ?? 0, supply));

  return { supply, demand, on, shed, source };
}
