import type { ItemId } from '../data/items';
import type { ModuleId } from '../data/modules';

// Pixel-art icons from the innawoods.net content bundle (see scripts/fetch-innawoods-icons.mjs).
const P = '/icons/innawoods/';

/** Bộ mono-line tactical (spec: tools/icons-spec.md; validator: tools/validate_icons.mjs; sinh bằng Codex CLI). */
const CUSTOM = '/icons/custom/';

export const ITEM_ICONS: Record<ItemId, string> = {
  food: P + 'items/nutrition/tinned-meat__266.png',
  rawFood: P + 'items/nutrition/rice__285.png',
  meals: P + 'items/nutrition/soup-stock__263.png',
  water: P + 'items/nutrition/water-bottle__293.png',
  dirtyWater: P + 'items/nutrition/water-canister__281.png',
  wood: P + 'items/other/branch__440.png',
  scrap: P + 'items/other/ingot__920.png',
  cloth: P + 'items/other/eft-cordura-polyamide-fabric__1990.png',
  medicine: P + 'items/medicine/pills__411.png',
  bandage: P + 'items/medicine/bandages__413.png',
  fuel: P + 'items/other/jerrycan__451.png',
  parts: P + 'items/other/bolts__457.png',
  seeds: P + 'items/nutrition/buckwheat__723.png',
  tools: P + 'items/other/toolkit__449.png',
  books: P + 'items/other/book__480.png',
  vehicle: P + 'items/other/key__520.png',
};

export const MODULE_ICONS: Record<ModuleId, string> = {
  bedroom: CUSTOM + 'modules/bedroom.svg',
  kitchen: CUSTOM + 'modules/kitchen.svg',
  storage: CUSTOM + 'modules/storage.svg',
  workshop: CUSTOM + 'modules/workshop.svg',
  infirmary: CUSTOM + 'modules/infirmary.svg',
  latrine: CUSTOM + 'modules/latrine.svg',
  water_tank: CUSTOM + 'modules/water_tank.svg',
  filter: CUSTOM + 'modules/filter.svg',
  garden: CUSTOM + 'modules/garden.svg',
  herb_garden: CUSTOM + 'modules/herb_garden.svg',
  well: CUSTOM + 'modules/well.svg',
  watchtower: CUSTOM + 'modules/watchtower.svg',
  rec_room: CUSTOM + 'modules/rec_room.svg',
  bookshelf: CUSTOM + 'modules/bookshelf.svg',
  garage: CUSTOM + 'modules/garage.svg',
  generator: CUSTOM + 'modules/generator.svg',
  shelter: CUSTOM + 'modules/shelter.svg',
};

export const ROLE_ICONS: Record<string, string> = {
  idle: CUSTOM + 'roles/idle.svg',
  builder: CUSTOM + 'roles/builder.svg',
  cook: CUSTOM + 'roles/cook.svg',
  water: CUSTOM + 'roles/water.svg',
  farmer: CUSTOM + 'roles/farmer.svg',
  guard: CUSTOM + 'roles/guard.svg',
  medic: CUSTOM + 'roles/medic.svg',
  sanitation: CUSTOM + 'roles/sanitation.svg',
  gatherer: CUSTOM + 'roles/gatherer.svg',
};

export const SKILL_ICONS: Record<string, string> = {
  stealth: CUSTOM + 'skills/stealth.svg',
  scavenging: CUSTOM + 'skills/scavenging.svg',
  cooking: CUSTOM + 'skills/cooking.svg',
  construction: CUSTOM + 'skills/construction.svg',
  crafting: CUSTOM + 'skills/crafting.svg',
  medical: CUSTOM + 'skills/medical.svg',
  mechanics: CUSTOM + 'skills/mechanics.svg',
  melee: CUSTOM + 'skills/melee.svg',
  fitness: CUSTOM + 'skills/fitness.svg',
  farming: CUSTOM + 'skills/farming.svg',
};

export const UI_ICONS: Record<string, string> = {
  tab_base: CUSTOM + 'ui/tab_base.svg',
  tab_people: CUSTOM + 'ui/tab_people.svg',
  tab_map: CUSTOM + 'ui/tab_map.svg',
  tab_laws: CUSTOM + 'ui/tab_laws.svg',
  tab_log: CUSTOM + 'ui/tab_log.svg',
  speed_pause: CUSTOM + 'ui/speed_pause.svg',
  speed_1: CUSTOM + 'ui/speed_1.svg',
  speed_10: CUSTOM + 'ui/speed_10.svg',
  speed_60: CUSTOM + 'ui/speed_60.svg',
  speed_240: CUSTOM + 'ui/speed_240.svg',
};

export const SITE_IMG: Record<string, string> = {
  base: CUSTOM + 'sites/site_base.svg',
  outpost: CUSTOM + 'sites/site_outpost.svg',
  field: CUSTOM + 'sites/site_field.svg',
};

export const STRUCT_IMG: Record<string, string> = {
  wall: CUSTOM + 'structures/struct_wall.svg',
  barricade: CUSTOM + 'structures/struct_barricade.svg',
  spikes: CUSTOM + 'structures/struct_spikes.svg',
  gate: CUSTOM + 'structures/struct_gate.svg',
  tower: CUSTOM + 'structures/struct_tower.svg',
};

/** Decoded-image cache so the base-plan canvas can draw icons synchronously. */
const cache = new Map<string, HTMLImageElement>();

export function iconImage(src: string, onReady?: () => void): HTMLImageElement {
  let img = cache.get(src);
  if (!img) {
    img = new Image();
    if (onReady) img.onload = onReady;
    img.src = src;
    cache.set(src, img);
  } else if (onReady && !img.complete) {
    img.addEventListener('load', onReady, { once: true });
  }
  return img;
}

export function Icon({ src, size = 20 }: { src: string; size?: number }) {
  return <img className="ico" src={src} width={size} height={size} alt="" loading="lazy" />;
}
