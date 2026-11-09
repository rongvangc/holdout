import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PausedBanner } from '../src/ui/PausedBanner';

describe('paused banner', () => {
  it('says why the clock stopped and offers one way out', () => {
    const html = renderToStaticMarkup(<PausedBanner reason="Bầy ~40 zombie đang tới" onResume={() => undefined} />);
    expect(html).toContain('Tạm dừng');
    expect(html).toContain('Bầy ~40 zombie đang tới');
    expect(html).toContain('Chạy tiếp');
    // Announced, not just drawn.
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="assertive"');
  });
});
