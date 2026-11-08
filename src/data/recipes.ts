import type { SkillId } from '../sim/data';
import { ITEMS, type ItemId } from './items';
import { MODULES, type ModuleId } from './modules';

export interface Recipe {
  id: string;
  out: ItemId;
  qty: number;
  /** Station that must stand at the site, at `level` or better. */
  station: ModuleId;
  level: number;
  in: [ItemId, number][];
  workSec: number;
  skill: SkillId;
  /** When set, the recipe consumes this item instead of producing a fresh one. */
  upgradeFrom?: ItemId;
  note?: string;
}

const MIN = 60;
const HOUR = 3600;

/** Hand-authored rungs: raw → processed → component. Everything else hangs off these. */
const MATERIAL_RECIPES: Recipe[] = [
  { id: 'r_plank', out: 'plank', qty: 2, station: 'carpentry', level: 1, in: [['wood', 3]], workSec: 20 * MIN, skill: 'construction' },
  { id: 'r_nail', out: 'nail', qty: 8, station: 'forge', level: 1, in: [['scrap', 1]], workSec: 15 * MIN, skill: 'crafting' },
  { id: 'r_lime', out: 'lime', qty: 1, station: 'kiln', level: 1, in: [['stone', 3]], workSec: 3 * HOUR, skill: 'crafting' },
  { id: 'r_thread', out: 'thread', qty: 5, station: 'tailor', level: 1, in: [['cloth', 1]], workSec: 20 * MIN, skill: 'crafting' },
  { id: 'r_rope', out: 'rope', qty: 2, station: 'tailor', level: 1, in: [['cloth', 1]], workSec: 15 * MIN, skill: 'crafting' },
  { id: 'r_blade', out: 'blade', qty: 1, station: 'forge', level: 1, in: [['scrap', 2], ['wood', 1]], workSec: 90 * MIN, skill: 'crafting' },
  { id: 'r_tool_head', out: 'tool_head', qty: 1, station: 'forge', level: 1, in: [['scrap', 1.5], ['wood', 1]], workSec: HOUR, skill: 'crafting' },
  { id: 'r_handle', out: 'handle', qty: 2, station: 'carpentry', level: 1, in: [['plank', 1]], workSec: 20 * MIN, skill: 'construction' },
  { id: 'r_hinge', out: 'hinge', qty: 3, station: 'forge', level: 1, in: [['scrap', 0.5]], workSec: 15 * MIN, skill: 'crafting' },
  { id: 'r_gear', out: 'gear', qty: 1, station: 'workshop', level: 1, in: [['scrap', 1], ['parts', 1]], workSec: HOUR, skill: 'mechanics' },
  { id: 'r_wire', out: 'wire', qty: 4, station: 'workshop', level: 1, in: [['scrap', 1]], workSec: 30 * MIN, skill: 'mechanics' },
  { id: 'r_plate', out: 'plate', qty: 1, station: 'forge', level: 2, in: [['scrap', 3], ['wood', 2]], workSec: 2 * HOUR, skill: 'crafting', note: 'Cần lò rèn cấp 2' },
  { id: 'r_filter_core', out: 'filter_core', qty: 1, station: 'workshop', level: 1, in: [['wood', 1], ['sand', 1], ['cloth', 1]], workSec: HOUR, skill: 'crafting' },
  { id: 'r_battery', out: 'battery', qty: 1, station: 'workshop', level: 2, in: [['scrap', 6], ['parts', 2], ['wire', 2]], workSec: 4 * HOUR, skill: 'mechanics', note: 'Cần bàn thợ cấp 2' },
  { id: 'r_solar_panel', out: 'solar_panel', qty: 1, station: 'workshop', level: 3, in: [['plate', 1], ['wire', 3], ['scrap', 4]], workSec: 6 * HOUR, skill: 'mechanics', note: 'Cần bàn thợ cấp 3' },
];

/** Cooking and preserving. Outputs feed the existing eat logic (meals / food). */
const FOOD_RECIPES: Recipe[] = [
  { id: 'r_meals', out: 'meals', qty: 3000, station: 'kitchen', level: 1, in: [['rawFood', 3000], ['water', 2], ['wood', 0.5]], workSec: 25 * MIN, skill: 'cooking', note: 'Nấu một mẻ cơm cho cả điểm' },
  { id: 'r_meals_big', out: 'meals', qty: 8000, station: 'kitchen', level: 2, in: [['rawFood', 8000], ['water', 5], ['wood', 1]], workSec: 45 * MIN, skill: 'cooking', note: 'Bếp cấp 2: nấu mẻ lớn bằng than' },
  { id: 'r_dry', out: 'food', qty: 4000, station: 'smokehouse', level: 1, in: [['rawFood', 4000], ['salt', 1], ['wood', 2]], workSec: 3 * HOUR, skill: 'cooking', note: 'Hun khói: để được hàng chục ngày' },
  { id: 'r_pickle', out: 'food', qty: 3500, station: 'crock', level: 1, in: [['rawFood', 3500], ['salt', 1], ['dirtyWater', 2]], workSec: 6 * HOUR, skill: 'cooking', note: 'Muối chua: không cần lửa, cần muối' },
  { id: 'r_pickle_meat', out: 'food', qty: 3000, station: 'crock', level: 2, in: [['rawFood', 3000], ['salt', 2], ['oil', 0.5]], workSec: 8 * HOUR, skill: 'cooking', note: 'Chum cấp 2: ủ mặn' },
];

/** Cooking: rawFood is the bulk, one fresh ingredient is what makes it a meal. */
const DISH_RECIPES: Recipe[] = [
  { id: 'rd_com', out: 'mon_com', qty: 4, station: 'kitchen', level: 1, in: [['rawFood', 3600], ['water', 2]], workSec: 20 * MIN, skill: 'cooking' },
  { id: 'rd_com_rau', out: 'mon_com_rau', qty: 3, station: 'kitchen', level: 1, in: [['rawFood', 2800], ['rau', 0.7], ['water', 2]], workSec: 25 * MIN, skill: 'cooking' },
  { id: 'rd_chao', out: 'mon_chao', qty: 2, station: 'kitchen', level: 1, in: [['rawFood', 1100], ['water', 5]], workSec: 20 * MIN, skill: 'cooking' },
  { id: 'rd_khoai', out: 'mon_khoai', qty: 3, station: 'kitchen', level: 1, in: [['rawFood', 2200], ['water', 2]], workSec: 15 * MIN, skill: 'cooking' },
  { id: 'rd_canh', out: 'mon_canh', qty: 3, station: 'kitchen', level: 1, in: [['rau', 1], ['rawFood', 250], ['water', 4], ['salt', 0.1]], workSec: 15 * MIN, skill: 'cooking' },
  { id: 'rd_rau_xao', out: 'mon_rau_xao', qty: 2, station: 'kitchen', level: 1, in: [['rau', 1], ['oil', 0.2]], workSec: 15 * MIN, skill: 'cooking' },
  { id: 'rd_trung', out: 'mon_trung_chien', qty: 2, station: 'kitchen', level: 1, in: [['trung', 6], ['oil', 0.1]], workSec: 10 * MIN, skill: 'cooking' },
  { id: 'rd_dau_hu', out: 'mon_dau_hu', qty: 3, station: 'kitchen', level: 1, in: [['dau', 1], ['water', 3], ['salt', 0.1]], workSec: 40 * MIN, skill: 'cooking' },
  { id: 'rd_ca_kho', out: 'mon_ca_kho', qty: 3, station: 'kitchen', level: 2, in: [['ca', 1.5], ['rawFood', 600], ['salt', 0.3]], workSec: 90 * MIN, skill: 'cooking', note: 'Kho lâu, cần bếp cấp 2' },
  { id: 'rd_thit_kho', out: 'mon_thit_kho', qty: 3, station: 'kitchen', level: 2, in: [['thit', 1.5], ['rawFood', 600], ['salt', 0.4]], workSec: 2 * HOUR, skill: 'cooking', note: 'Món đám cưới. Cần bếp cấp 2' },
  { id: 'rd_banh_mi', out: 'mon_banh_mi', qty: 6, station: 'kiln', level: 2, in: [['bot', 1], ['water', 2]], workSec: 2 * HOUR, skill: 'cooking', note: 'Cần lò nung cấp 2' },
  { id: 'r_pho_mai', out: 'pho_mai', qty: 2, station: 'crock', level: 1, in: [['sua', 4], ['salt', 0.2]], workSec: 90 * MIN, skill: 'cooking', note: 'Sữa để được lâu: phô mai giữ hàng tháng' },
  { id: 'rd_dua_muoi', out: 'mon_dua_muoi', qty: 6, station: 'crock', level: 1, in: [['rau', 2], ['salt', 0.4], ['dirtyWater', 2]], workSec: 4 * HOUR, skill: 'cooking', note: 'Ủ chua: để được hàng tháng, có vitamin' },
];

/** Form → bill of materials. This is the rule set that scales to every weapon in the catalog. */
const WEAPON_RULES: Record<string, { in: [ItemId, number][]; station: ModuleId; level: number; workSec: number }> = {
  short_blade: { in: [['blade', 1], ['handle', 1], ['nail', 2]], station: 'forge', level: 1, workSec: HOUR },
  long_blade: { in: [['blade', 2], ['handle', 1], ['nail', 4]], station: 'forge', level: 2, workSec: 2 * HOUR },
  sword: { in: [['blade', 2], ['handle', 1], ['hinge', 2]], station: 'forge', level: 2, workSec: 2.5 * HOUR },
  axe: { in: [['tool_head', 1], ['handle', 1], ['nail', 3]], station: 'forge', level: 2, workSec: 2 * HOUR },
  reach: { in: [['blade', 1], ['handle', 2], ['rope', 3]], station: 'carpentry', level: 1, workSec: 90 * MIN },
  crowbar: { in: [['scrap', 3]], station: 'forge', level: 1, workSec: HOUR },
  blunt: { in: [['scrap', 3], ['handle', 1], ['rope', 1]], station: 'carpentry', level: 2, workSec: 90 * MIN },
  heavy: { in: [['plate', 2], ['handle', 2], ['nail', 6]], station: 'forge', level: 3, workSec: 4 * HOUR },
  fist: { in: [['scrap', 2], ['cloth', 0.5]], station: 'forge', level: 1, workSec: 40 * MIN },
};

/** Mechanic → bill of materials for everything that is not a weapon. */
const WEAR_RULES: Record<string, { in: [ItemId, number][]; station: ModuleId; level: number; workSec: number }> = {
  armor_soft: { in: [['cloth', 6], ['thread', 4]], station: 'tailor', level: 1, workSec: 2 * HOUR },
  armor_plate: { in: [['plate', 1], ['cloth', 8], ['thread', 6], ['hinge', 4]], station: 'tailor', level: 3, workSec: 4 * HOUR },
  helmet: { in: [['scrap', 2], ['cloth', 1], ['thread', 1]], station: 'tailor', level: 2, workSec: 90 * MIN },
  mask: { in: [['cloth', 1], ['thread', 1]], station: 'tailor', level: 1, workSec: 30 * MIN },
  clothes: { in: [['cloth', 4], ['thread', 2]], station: 'tailor', level: 1, workSec: 90 * MIN },
  gloves: { in: [['cloth', 1], ['thread', 1]], station: 'tailor', level: 1, workSec: 20 * MIN },
  boots: { in: [['cloth', 2], ['rubber', 2], ['thread', 2]], station: 'tailor', level: 2, workSec: HOUR },
  vest: { in: [['cloth', 3], ['plate', 2], ['hinge', 4]], station: 'tailor', level: 3, workSec: 3 * HOUR },
  backpack: { in: [['cloth', 4], ['thread', 3], ['hinge', 2]], station: 'tailor', level: 2, workSec: 2 * HOUR },
  container: { in: [['cloth', 2], ['thread', 1]], station: 'tailor', level: 1, workSec: 30 * MIN },
  tool: { in: [['tool_head', 1], ['handle', 1], ['nail', 2]], station: 'carpentry', level: 1, workSec: HOUR },
  cookware: { in: [['scrap', 2], ['handle', 1]], station: 'forge', level: 1, workSec: 45 * MIN },
  camping: { in: [['cloth', 6], ['rope', 3], ['wood', 2]], station: 'tailor', level: 2, workSec: 2 * HOUR },
  medicine: { in: [['rawFood', 0], ['cloth', 0.2]], station: 'workshop', level: 999, workSec: HOUR }, // not craftable: loot only
};

const slug = (s: string) =>
  s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 40);

/**
 * A survival sim needs "you can build a helmet", not sixty helmet blueprints.
 * So: one craftable representative per form (mechanic + class + tier); every other
 * variant in the catalog is loot-only — you find a specific brand, you can't forge it.
 */
function derivedRecipes(): Recipe[] {
  const groups = new Map<string, { id: string; def: (typeof ITEMS)[string] }[]>();
  for (const [itemId, def] of Object.entries(ITEMS)) {
    const mech = def.mechanic ?? '';
    const rule = mech.startsWith('weapon_')
      ? (def.cls ? WEAPON_RULES[def.cls] : undefined)
      : WEAR_RULES[mech];
    if (!rule || rule.level > 900) continue;
    const key = `${mech}|${def.cls ?? ''}|${def.tier ?? 1}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ id: itemId, def });
  }

  const out: Recipe[] = [];
  for (const [key, members] of groups) {
    // Generic names first: "Helmet" before "6B47 Ratnik-BSh helmet cover".
    members.sort((a, b) => a.def.label.length - b.def.label.length || a.id.localeCompare(b.id));
    for (const { id: itemId, def } of members.slice(0, 2)) {
      const mech = def.mechanic ?? '';
      const rule = mech.startsWith('weapon_') ? WEAPON_RULES[def.cls!] : WEAR_RULES[mech];
      const inputs = rule.in.filter(([, n]) => n > 0) as [ItemId, number][];
      if (!inputs.length || !inputs.every(([i]) => i in ITEMS)) continue;
      out.push({
        id: `r_${slug(itemId)}`,
        out: itemId,
        qty: 1,
        station: rule.station,
        level: rule.level,
        in: inputs,
        workSec: Math.round(rule.workSec * (0.75 + (def.tier ?? 1) * 0.15)),
        skill: 'crafting' as SkillId,
        note: key.endsWith('|1') ? undefined : undefined,
      });
    }
  }
  return out;
}

/**
 * Real upgrade steps: the new item is the old one plus parts, not a fresh build.
 * These are the pairs the innawoods catalog already implies.
 */
const UPGRADES: { from: ItemId; to: ItemId; add: [ItemId, number][]; station: ModuleId; level: number; workSec: number }[] = [
  { from: 'tool_folding-shovel', to: 'tool_shovel', add: [['handle', 1], ['nail', 2]], station: 'carpentry', level: 1, workSec: 40 * MIN },
  { from: 'wpn_combat-knife', to: 'wpn_machete', add: [['blade', 1], ['nail', 2]], station: 'forge', level: 1, workSec: HOUR },
];

function upgradeRecipes(): Recipe[] {
  return UPGRADES.filter((u) => u.from in ITEMS && u.to in ITEMS).map((u) => ({
    id: `ru_${slug(u.to)}`,
    out: u.to,
    qty: 1,
    station: u.station,
    level: u.level,
    in: u.add,
    workSec: u.workSec,
    skill: 'crafting' as SkillId,
    upgradeFrom: u.from,
  }));
}

export const RECIPES: Recipe[] = [...MATERIAL_RECIPES, ...FOOD_RECIPES, ...DISH_RECIPES, ...upgradeRecipes(), ...derivedRecipes()];

export const RECIPE_BY_ID: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

/** Recipes a station can produce at a given level. */
export function recipesFor(station: ModuleId, level: number): Recipe[] {
  return RECIPES.filter((r) => r.station === station && r.level <= level);
}

/** Everything this site could queue right now, given the stations it has. */
export function availableRecipes(stationLevels: Partial<Record<ModuleId, number>>): Recipe[] {
  return RECIPES.filter((r) => (stationLevels[r.station] ?? 0) >= r.level);
}

export const STATION_LABEL = (id: ModuleId) => MODULES[id]?.label ?? id;
