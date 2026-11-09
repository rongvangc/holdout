import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CrashScreen } from '../src/ui/ErrorBoundary';

describe('crash screen', () => {
  it('says the save is safe and offers one way out', () => {
    const html = renderToStaticMarkup(<CrashScreen message="Cannot read properties of undefined" onReload={() => undefined} />);
    expect(html).toContain('Giao diện gặp lỗi');
    expect(html).toContain('Tiếp tục');
    expect(html).toContain('Tải lại trang');
    expect(html).toContain('Cannot read properties of undefined');
    expect(html).toContain('role="alert"');
  });
});
