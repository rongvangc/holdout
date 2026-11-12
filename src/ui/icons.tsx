import type { ItemId } from '../data/items';
import type { ModuleId } from '../data/modules';

// Pixel-art icons from the innawoods.net content bundle (see scripts/fetch-innawoods-icons.mjs).
const P = '/icons/innawoods/';

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
  bedroom: "/icons/pixel/bedroom.png",
  kitchen: "/icons/pixel/kitchen.png",
  storage: "/icons/pixel/storage.png",
  workshop: "/icons/pixel/workshop.png",
  infirmary: "/icons/pixel/infirmary.png",
  latrine: "/icons/pixel/latrine.png",
  water_tank: "/icons/pixel/water_tank.png",
  filter: "/icons/pixel/filter.png",
  pasture: "/icons/pixel/garden.png",
  butcher: "/icons/pixel/workshop.png",
  garden: "/icons/pixel/garden.png",
  herb_garden: "/icons/pixel/herb_garden.png",
  well: "/icons/pixel/well.png",
  watchtower: "/icons/pixel/watchtower.png",
  rec_room: "/icons/pixel/rec_room.png",
  bookshelf: "/icons/pixel/bookshelf.png",
  garage: "/icons/pixel/garage.png",
  generator: "/icons/pixel/generator.png",
  shelter: "/icons/pixel/shelter.png",
  // Crafting stations reuse the closest pixel sprite until they get their own art.
  forge: "/icons/pixel/workshop.png",
  carpentry: "/icons/pixel/workshop.png",
  kiln: "/icons/pixel/filter.png",
  tailor: "/icons/pixel/storage.png",
  smokehouse: "/icons/pixel/kitchen.png",
  cellar: "/icons/pixel/storage.png",
  lighting: "/icons/pixel/rec_room.png",
  fridge: "/icons/pixel/storage.png",
  water_pump: "/icons/pixel/well.png",
  power_tools: "/icons/pixel/workshop.png",
  electric_fence: "/icons/pixel/struct_wall.png",
  radio: "/icons/pixel/rec_room.png",
  grow_light: "/icons/pixel/garden.png",
  stove: "/icons/pixel/kitchen.png",
  electric_heater: "/icons/pixel/generator.png",
  coop: "/icons/pixel/garden.png",
  pond: "/icons/pixel/water_tank.png",
  barn: "/icons/pixel/shelter.png",
};



/** Pixel-art sheets: batch 1 (spec: docs/superpowers/specs/2026-11-08-pixel-icon-sheets-design.md). */
export const SITE_IMG: Record<string, string> = {
  base: '/icons/pixel/site_base.png',
  outpost: '/icons/pixel/site_outpost.png',
  field: '/icons/pixel/site_field.png',
};
export const STRUCT_IMG: Record<string, string> = {
  wall: '/icons/pixel/struct_wall.png',
  barricade: '/icons/pixel/struct_barricade.png',
  spikes: '/icons/pixel/struct_spikes.png',
  gate: '/icons/pixel/struct_gate.png',
  tower: '/icons/pixel/struct_tower.png',
};


export const TAB_IMG: Record<string, string> = {
  base: '/icons/pixel/tab_base.png',
  people: '/icons/pixel/tab_people.png',
  map: '/icons/pixel/tab_map.png',
  laws: '/icons/pixel/tab_laws.png',
  log: '/icons/pixel/tab_log.png',
};

/** Decoded-image cache so the base-plan canvas can draw icons synchronously. */
const cache = new Map<string, HTMLImageElement>();

/**
 * Icon paths in the data files are written as '/icons/...' — absolute from the domain
 * root. That works when the game is hosted at '/', and 404s for every one of the ten
 * thousand icons when it is hosted at '/holdout/'. Stripping the leading slash makes
 * them relative to the document, which is what a relative build needs.
 */
const assetUrl = (src: string | undefined | null): string => (!src ? '' : src.startsWith('/') ? `.${src}` : src);

export function iconImage(src: string, onReady?: () => void): HTMLImageElement {
  let img = cache.get(src);
  if (!img) {
    img = new Image();
    if (onReady) img.onload = onReady;
    img.src = assetUrl(src);
    cache.set(src, img);
  } else if (onReady && !img.complete) {
    img.addEventListener('load', onReady, { once: true });
  }
  return img;
}

/**
 * Icon paths in the data files are written as '/icons/...' — an absolute path from the
 * domain root. That works when the game is hosted at '/', and 404s for every one of the
 * ten thousand icons when it is hosted at '/holdout/'. Stripping the leading slash makes
 * them relative to the document, which is what a relative build needs.
 */
export function Icon({ src, size = 20 }: { src?: string; size?: number }) {
  // Không có đường dẫn thì đừng render thẻ img rỗng (nó tạo một ảnh "hỏng" trong DOM).
  if (!src) return null;
  return <img className="ico" src={assetUrl(src)} width={size} height={size} alt="" loading="lazy" />;
}
