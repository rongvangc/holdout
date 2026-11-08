import type { JSX } from 'react';
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

// Status icons: hình khối phẳng 16x16, một màu currentColor, góc 0/45 độ, tối đa 3 khối.
export const STATUS_ICONS: Record<string, string> = {
  // Bát cơm: mound gạo + bát vát đáy
  food: '<path d="M5 8 L7 5 H9 L11 8 Z"/><path d="M2 8 H14 V11 L12 13 H4 L2 11 Z"/>',
  // Giọt nước vát 45 độ
  water: '<path d="M8 2 L12 7 V11 L10 14 H6 L4 11 V7 Z"/>',
  // Giường: đầu giường + nệm, gối là lỗ xuyên
  beds: '<path fill-rule="evenodd" d="M2 4 H4 V13 H2 Z M4 8 H14 V13 H4 Z M5 9 H8 V11 H5 Z"/>',
  // Mặt khối: mắt/miệng là lỗ xuyên
  morale: '<path fill-rule="evenodd" d="M3 2 H13 V14 H3 Z M5 6 H7 V8 H5 Z M9 6 H11 V8 H9 Z M5 10 H11 V12 H5 Z"/>',
  // Khiên khối
  defense: '<path d="M8 2 L13 4 V9 L8 14 L3 9 V4 Z"/>',
  // Sóng nhiệt bậc: 3 cột dâng
  heat: '<path d="M2 12 H5 V14 H2 Z M6 8 H9 V14 H6 Z M10 2 H13 V14 H10 Z"/>',
  // Vết bẩn + chấm lỗ
  filth: '<path fill-rule="evenodd" d="M4 3 H11 L13 6 V11 L10 13 H5 L2 10 V6 Z M9 8 H11 V10 H9 Z"/>',
  // Thân người nằm: đầu + thân
  corpses: '<path d="M6 2 H10 V5 H6 Z"/><path d="M4 6 H12 V13 H4 Z"/><path d="M2 13 H14 V14 H2 Z"/>',
  // Nắng: khối giữa + 4 tia
  sun: '<path d="M5 5 H11 V11 H5 Z"/><path d="M7 1 H9 V4 H7 Z M7 12 H9 V15 H7 Z M1 7 H4 V9 H1 Z M12 7 H15 V9 H12 Z"/>',
  // Mưa: mây + 3 giọt
  rain: '<path d="M2 7 H4 V5 H11 V7 H13 V10 H2 Z"/><path d="M4 12 H6 V14 H4 Z M8 12 H10 V14 H8 Z M12 12 H14 V14 H12 Z"/>',
  // Bão: mây + tia chớp khối
  storm: '<path d="M2 7 H4 V5 H11 V7 H13 V10 H2 Z"/><path d="M8 8 H11 V10 H9 V12 H12 V14 H7 V11 H9 Z"/>',
  // Bầy zombie: 3 mũi tên xông tới
  horde: '<path d="M1 3 L6 8 L1 13 V10 L3 8 L1 6 Z M6 3 L11 8 L6 13 V10 L8 8 L6 6 Z M11 3 L16 8 L11 13 V10 L13 8 L11 6 Z"/>',
  // Nhà vệ sinh: bồn + két nước
  latrine: '<path d="M3 6 H13 V9 H11 V11 H5 V9 H3 Z"/><path d="M11 2 H14 V6 H11 Z"/>',
  // Tường có chỏm
  fortify: '<path d="M2 3 H5 V5 H7 V3 H10 V5 H12 V3 H14 V14 H2 Z"/>',
  // Rào: cột + thanh ngang
  fence: '<path d="M3 3 H4 V14 H3 Z M8 3 H9 V14 H8 Z M13 3 H14 V14 H13 Z"/><path d="M2 6 H15 V8 H2 Z M2 10 H15 V12 H2 Z"/>',
  // Viễn chinh: mũi tên hành quân
  expedition: '<path d="M2 6 H10 V3 L14 7 V9 L10 13 V10 H2 Z"/>',
};

export function StatusIcon({ name, size = 16 }: { name: string; size?: number }): JSX.Element {
  return (
    <svg className="statusicon" viewBox="0 0 16 16" width={size} height={size} fill="currentColor" aria-hidden="true" dangerouslySetInnerHTML={{ __html: STATUS_ICONS[name] ?? '' }} />
  );
}
