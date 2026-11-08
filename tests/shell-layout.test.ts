import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync('src/ui/styles.css', 'utf8');

/** Block khai báo cuối cùng của một selector (thắng theo cascade). */
function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(?:^|\\})\\s*' + escaped + '\\s*\\{([^}]*)\\}', 'g');
  let last = '';
  for (const m of css.matchAll(re)) last = m[1];
  return last;
}

describe('overlay shell layout', () => {
  // Hồi quy: TopStrip và stage từng bị position:absolute cùng gốc toạ độ
  // => hàng tab đè lên nội dung. Chúng phải xếp dọc trong grid.
  it('overlay-main stacks strip and stage in a grid', () => {
    const main = rule('.overlay-main');
    expect(main).toMatch(/display:\s*grid/);
    expect(main).toMatch(/grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)/);
    expect(main).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  });

  it('top strip is in normal flow, not absolutely positioned', () => {
    const strip = rule('.topstrip');
    expect(strip).not.toMatch(/position:\s*absolute/);
    expect(strip).not.toMatch(/inset:/);
  });

  it('stage is in normal flow so it sits below the strip', () => {
    const stage = rule('.overlay-stage');
    expect(stage).not.toMatch(/position:\s*absolute/);
    expect(stage).toMatch(/min-height:\s*0/);
  });
});
