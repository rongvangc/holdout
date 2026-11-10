import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Mobile layout is a CSS fact, so it can be tested without a browser.
 *
 * Measured before the fixes, at 390x844: the base screen stacked the floor plan over
 * the room panel into 1552 px of content inside a 490 px stage with overflow hidden,
 * so the module list could not be reached at all. The HUD row scrolled sideways by
 * 556 px, hiding the speed controls, and the room-name input was 13 px, which makes
 * iOS zoom the whole page on focus.
 */
const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');
const mobile = css.slice(css.indexOf('@media (max-width: 720px)', css.indexOf('Mobile specifics')));

describe('phone layout', () => {
  it('lets the stage scroll so the room panel is reachable', () => {
    expect(mobile).toMatch(/\.overlay-main\s*\{[^}]*overflow-y:\s*auto/);
    expect(mobile).toMatch(/\.baseview\s*\{[^}]*display:\s*block/);
    expect(mobile).toMatch(/\.baseview \.canvaswrap\s*\{[^}]*height:\s*42vh/);
  });

  it('keeps text fields at 16 px so iOS does not zoom the page on focus', () => {
    expect(mobile).toMatch(/input\s*\{[^}]*font-size:\s*16px/);
  });

  it('keeps help labels readable and touch targets large', () => {
    expect(mobile).toMatch(/\.label\s*\{[^}]*font-size:\s*11px/);
    expect(mobile).toMatch(/\.onboarding \.mini\s*\{[^}]*min-height:\s*44px/);
    // The HUD label rule lives in the earlier 720px block; assert it wherever it is.
    expect(css).toMatch(/\.topstrip \.stat \.label\s*\{[^}]*font-size:\s*10px/);
  });

  it('drops the words, not the buttons, on a 320 px phone', () => {
    // Measured at 320: the action row overflowed and pushed THOAT off screen even
    // after the stats were pinned, so the glyphs stay and the labels go.
    expect(css).toMatch(/@media \(max-width: 380px\)[\s\S]{0,400}\.topstrip-actions button \.lbl[\s\S]{0,80}display:\s*none/);
    // Icon-only buttons still need a thumb-sized box, and the last 9 px label grew.
    expect(css).toMatch(/@media \(max-width: 380px\)[\s\S]{0,600}min-width:\s*44px/);
    expect(css).toMatch(/@media \(max-width: 380px\)[\s\S]{0,900}\.decisions-label\s*\{[^}]*font-size:\s*10px/);
    const tsx = readFileSync(new URL('../src/ui/shell/TopStrip.tsx', import.meta.url), 'utf8');
    expect(tsx.match(/className="lbl"/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('pins the HUD controls instead of scrolling them off screen', () => {
    expect(css).toMatch(/\.topstrip-main > \.topstrip-stats\s*\{[^}]*overflow-x:\s*auto/);
    expect(css).toMatch(/\.topstrip-main > \.topstrip-actions\s*\{[^}]*flex:\s*0 0 auto/);
    const tsx = readFileSync(new URL('../src/ui/shell/TopStrip.tsx', import.meta.url), 'utf8');
    expect(tsx).toContain('topstrip-stats');
    expect(tsx).toContain('topstrip-actions');
  });
});
