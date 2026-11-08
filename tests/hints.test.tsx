import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { MODULES } from '../src/data/modules';
import { STRUCTS } from '../src/data/structures';
import { Hint, hintsEnabled, toggleHints } from '../src/ui/hints';

const render = (text: string) => renderToStaticMarkup(<Hint text={text} />);

describe('inline help for touch', () => {
  afterEach(() => {
    if (hintsEnabled()) toggleHints();
  });

  it('renders nothing while the switch is off', () => {
    expect(hintsEnabled()).toBe(false);
    expect(render('ngủ trên giường hồi mệt nhanh hơn')).toBe('');
  });

  it('renders the text when switched on — no hover needed', () => {
    toggleHints();
    expect(hintsEnabled()).toBe(true);
    const html = render('ngủ trên giường hồi mệt nhanh hơn');
    expect(html).toContain('ngủ trên giường hồi mệt nhanh hơn');
    expect(html).toContain('hint-line');
  });

  it('renders nothing for an empty text even when on', () => {
    toggleHints();
    expect(render('')).toBe('');
  });

  it('every building and structure has a description to show', () => {
    // The point of the switch is that nothing is hover-only: if a description is
    // missing, the hint has nothing to reveal.
    for (const [id, def] of Object.entries(MODULES)) {
      expect((def.desc ?? '').length, `module ${id}`).toBeGreaterThan(20);
    }
    for (const [id, def] of Object.entries(STRUCTS)) {
      expect((def.desc ?? '').length, `struct ${id}`).toBeGreaterThan(10);
    }
  });
});
