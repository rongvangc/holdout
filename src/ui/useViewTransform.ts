export interface ViewTransform {
  scale: number;
  tx: number;
  ty: number;
}

const MIN_SCALE = 0.4;
export const MAX_SCALE = 4;

export const IDENTITY: ViewTransform = { scale: 1, tx: 0, ty: 0 };

function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

export function zoomAt(t: ViewTransform, factor: number, cx: number, cy: number): ViewTransform {
  const scale = clampScale(t.scale * factor);
  const ratio = scale / t.scale;

  return {
    scale,
    tx: cx - (cx - t.tx) * ratio,
    ty: cy - (cy - t.ty) * ratio,
  };
}

export function pan(t: ViewTransform, dx: number, dy: number): ViewTransform {
  return { ...t, tx: t.tx + dx, ty: t.ty + dy };
}

export function screenToCell(
  t: ViewTransform,
  cellPx: number,
  sx: number,
  sy: number,
  gridW: number,
  gridH: number,
): number | null {
  const scaledCellPx = t.scale * cellPx;
  const cx = Math.floor((sx - t.tx) / scaledCellPx);
  const cy = Math.floor((sy - t.ty) / scaledCellPx);

  if (cx < 0 || cx >= gridW || cy < 0 || cy >= gridH) return null;
  return cy * gridW + cx;
}

export function fitTransform(
  gridW: number,
  gridH: number,
  cellPx: number,
  viewW: number,
  viewH: number,
): ViewTransform {
  const scale = clampScale(Math.min(viewW / (gridW * cellPx), viewH / (gridH * cellPx)));
  const width = gridW * cellPx * scale;
  const height = gridH * cellPx * scale;

  return {
    scale,
    tx: (viewW - width) / 2,
    ty: (viewH - height) / 2,
  };
}
