import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Contrast is a CSS fact, so it can be tested without a browser.
 *
 * The audit found three places where text was unreadable: `--faint` at 2.7:1, the
 * selected map layer (dark text on a dark chip, 1:1) and white-on-red chips at
 * 3.7:1. This locks the numbers down.
 */
const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');
const token = (name: string): string => {
  const m = css.match(new RegExp(String.raw`--${name}:[ ]*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token --${name} not found`);
  return m[1];
};
const lum = (hex: string): number => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string): number => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('text contrast (WCAG AA for body text)', () => {
  it('every text tone clears 4.5:1 on every panel tone', () => {
    const bgs = ['bg', 'panel', 'panel-2'].map(token);
    for (const fg of ['fg', 'dim', 'faint'].map(token)) {
      for (const bg of bgs) {
        expect(contrast(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('selected chips invert both colours, never one', () => {
    // A light chip needs dark text; the map layer control and site bar prove it.
    expect(css).toMatch(/\.map-layer-ctrl button\.on\s*\{[^}]*background:\s*var\(--fg\)/);
    expect(css).toMatch(/\.map-layer-ctrl button\.on\s*\{[^}]*color:\s*var\(--bg\)/);
    // White on --red is only 3.7:1, so chips that use white must use the deep red.
    const white = '#ffffff';
    expect(contrast(white, token('red-deep'))).toBeGreaterThanOrEqual(4.5);
    expect(css).not.toMatch(/\.sitesbar button\.on\s*\{[^}]*background:\s*var\(--red\)/);
    expect(css).not.toMatch(/\.map-marker\.on\s*\{[^}]*background:\s*var\(--red\)/);
  });

  it('respects prefers-reduced-motion and notch insets', () => {
    expect(css).toContain('prefers-reduced-motion');
    expect(css).toContain('env(safe-area-inset-bottom)');
  });
});
