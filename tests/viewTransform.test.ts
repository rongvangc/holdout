import { describe, expect, it } from 'vitest';
import {
  IDENTITY,
  MAX_SCALE,
  fitTransform,
  pan,
  screenToCell,
  zoomAt,
} from '../src/ui/useViewTransform';

describe('view transform', () => {
  it('zooms at the origin without moving the transform', () => {
    expect(zoomAt(IDENTITY, 2, 0, 0)).toEqual({ scale: 2, tx: 0, ty: 0 });
  });

  it('keeps the cursor point fixed while zooming', () => {
    expect(zoomAt(IDENTITY, 2, 100, 100)).toEqual({ scale: 2, tx: -100, ty: -100 });
  });

  it('maps screen coordinates to cells at base scale and under zoom', () => {
    expect(screenToCell(IDENTITY, 24, 5, 5, 10, 10)).toBe(0);
    expect(screenToCell(IDENTITY, 24, 25, 25, 10, 10)).toBe(11);
    expect(screenToCell({ scale: 2, tx: 0, ty: 0 }, 24, 48, 48, 10, 10)).toBe(11);
  });

  it('returns null for screen coordinates outside the grid', () => {
    expect(screenToCell(IDENTITY, 24, -1, 0, 10, 10)).toBeNull();
    expect(screenToCell(IDENTITY, 24, 240, 0, 10, 10)).toBeNull();
  });

  it('returns the same cell after zooming and panning its screen coordinate', () => {
    const transform = pan(zoomAt(IDENTITY, 1.5, 120, 80), 35, -20);
    const cellX = 3;
    const cellY = 4;
    const screenX = transform.tx + (cellX + 0.5) * transform.scale * 24;
    const screenY = transform.ty + (cellY + 0.5) * transform.scale * 24;

    expect(screenToCell(transform, 24, screenX, screenY, 10, 10)).toBe(43);
  });

  it('fits the grid in the viewport and centers it', () => {
    expect(fitTransform(10, 10, 24, 1000, 600)).toEqual({ scale: 2.5, tx: 200, ty: 0 });
  });

  it('clamps zoom at the maximum scale', () => {
    expect(zoomAt({ scale: MAX_SCALE, tx: 0, ty: 0 }, 2, 100, 100).scale).toBe(MAX_SCALE);
  });
});
