import { baseStats, present } from '../sim/state';
import type { GameState, Site } from '../sim/types';

// Ngưỡng cảnh báo — đúng ngưỡng UI cũ đang dùng (xem docs/GAMEPLAY.md).
export const FOOD_BAD = 3;
export const FOOD_WARN = 6;
export const WATER_BAD = 2;
export const WATER_WARN = 4;
export const HEAT_BAD = 45;
export const FILTH_BAD = 40;
export const MORALE_BAD = 15;
export const MORALE_WARN = 25;

export type Tone = 'ok' | 'warn' | 'bad';

export interface Readout {
  id: 'food' | 'water' | 'beds' | 'morale' | 'defense';
  icon: string;
  label: string;
  text: string;
  ratio: number | null;
  tone: Tone;
  hint: string;
}

export interface Chip {
  id: 'heat' | 'filth' | 'corpses' | 'latrine' | 'fortify' | 'fence' | 'expeditions';
  icon: string;
  text: string;
  tone: Tone;
  hint: string;
}

function tone(value: number, bad: number, warn: number): Tone {
  if (value < bad) return 'bad';
  if (value < warn) return 'warn';
  return 'ok';
}

export function readouts(s: GameState, site: Site): Readout[] {
  const st = baseStats(s, site);
  const pop = Math.max(1, st.population);
  const here = st.population;
  const stock = site.stock;

  const foodDays = (stock.food + stock.meals + stock.rawFood) / (pop * 2250);
  const waterDays = stock.water / (pop * 3.3);

  const people = present(s, site);
  const morale = people.length ? people.reduce((n, v) => n + v.morale, 0) / people.length : 0;
  const def = Math.round(st.defenseStatic);

  return [
    {
      id: 'food',
      icon: 'food',
      label: 'Ăn',
      text: `${foodDays.toFixed(1)} ngày`,
      ratio: Math.min(1, foodDays / 10),
      tone: tone(foodDays, FOOD_BAD, FOOD_WARN),
      hint: `Ăn: đủ ${foodDays.toFixed(1)} ngày cho ${pop} người`,
    },
    {
      id: 'water',
      icon: 'water',
      label: 'Uống',
      text: `${waterDays.toFixed(1)} ngày`,
      ratio: Math.min(1, waterDays / 7),
      tone: tone(waterDays, WATER_BAD, WATER_WARN),
      hint: `Uống: đủ ${waterDays.toFixed(1)} ngày cho ${pop} người`,
    },
    {
      id: 'beds',
      icon: 'beds',
      label: 'Giường',
      text: `${here}/${st.beds}`,
      ratio: st.beds > 0 ? Math.min(1, here / st.beds) : 1,
      tone: st.beds < here ? 'warn' : 'ok',
      hint: `Giường: ${here} người / ${st.beds} giường`,
    },
    {
      id: 'morale',
      icon: 'morale',
      label: 'Tinh thần',
      text: people.length ? String(Math.round(morale)) : '—',
      ratio: people.length ? morale / 100 : 0,
      tone: people.length ? tone(morale, MORALE_BAD, MORALE_WARN) : 'ok',
      hint: people.length ? `Tinh thần TB ${Math.round(morale)}/100` : 'Không có ai ở đây',
    },
    {
      id: 'defense',
      icon: 'defense',
      label: 'Phòng thủ',
      text: String(def),
      ratio: null,
      tone: 'ok',
      hint: `Phòng thủ tĩnh ${def}`,
    },
  ];
}

export function siteChips(_s: GameState, site: Site): Chip[] {
  const heat = Math.round(site.heat);
  const filth = Math.round(site.filth);
  const corpses = Math.round(site.corpses);
  return [
    { id: 'heat', icon: 'heat', text: String(heat), tone: heat > HEAT_BAD ? 'bad' : 'ok', hint: `Độ ồn ${heat}/100` },
    { id: 'filth', icon: 'filth', text: String(filth), tone: filth > FILTH_BAD ? 'bad' : 'ok', hint: `Độ bẩn ${filth}/100` },
    { id: 'corpses', icon: 'corpses', text: String(corpses), tone: corpses > 0 ? 'bad' : 'ok', hint: `Xác chưa xử lý ${corpses}` },
  ];
}

export function facilityChips(s: GameState, site: Site): Chip[] {
  const st = baseStats(s, site);
  const fortHp = Math.round(site.fortify.hp);
  const fenceHp = Math.round(site.fence.hp);
  return [
    {
      id: 'latrine',
      icon: 'latrine',
      text: String(st.latrines),
      tone: st.latrines * 20 < st.population ? 'warn' : 'ok',
      hint: `Nhà vệ sinh: ${st.latrines} (đủ cho ${st.latrines * 20} người)`,
    },
    {
      id: 'fortify',
      icon: 'fortify',
      text: `cấp ${site.fortify.level} · ${fortHp}%`,
      tone: 'ok',
      hint: `Gia cố: cấp ${site.fortify.level} · ${fortHp}% HP`,
    },
    {
      id: 'fence',
      icon: 'fence',
      text: `cấp ${site.fence.level} · ${fenceHp}%`,
      tone: 'ok',
      hint: `Rào: cấp ${site.fence.level} · ${fenceHp}% HP`,
    },
    {
      id: 'expeditions',
      icon: 'expedition',
      text: `${s.expeditions.length} đội`,
      tone: 'ok',
      hint: `${s.expeditions.length} đội đang ngoài`,
    },
  ];
}
