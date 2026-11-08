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
  bedroom: P + 'items/other/sleeping-bag__512.png',
  kitchen: P + 'items/other/portable-gas-stove__476.png',
  storage: P + 'items/other/container__1734.png',
  workshop: P + 'items/other/leatherman-multitool__448.png',
  infirmary: P + 'items/medicine/medkit__414.png',
  latrine: P + 'items/medicine/toilet-paper__498.png',
  water_tank: P + 'items/other/gas-cylinder__517.png',
  filter: P + 'items/other/water-filter__rt3iuxkakdlsyyk3zhv5o.png',
  garden: P + 'items/medicine/plantain__2354.png',
  herb_garden: P + 'items/nutrition/the-long-dark-sweet-dreams-herbal-tea__1798.png',
  well: P + 'items/other/folding-shovel__503.png',
  watchtower: P + 'items/other/binoculars__495.png',
  rec_room: P + 'items/other/deck-of-cards__450.png',
  bookshelf: P + 'items/other/book__480.png',
  garage: P + 'items/other/key__520.png',
  generator: P + 'items/other/jerrycan__451.png',
  shelter: P + 'items/other/tent__454.png',
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
