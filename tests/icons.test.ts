import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { MODULE_ICONS, SITE_IMG, STRUCT_IMG, TAB_IMG } from '../src/ui/icons';
import manifest from '../tools/pixelout/smanifest.json';

// Pixel sheets: batch 1 — module/site/structure icons phải thật sự tồn tại trên disk.
const PUBLIC = join(process.cwd(), 'public');
describe('pixel icon sheets (batch 1 + tabs)', () => {
  for (const [name, reg] of Object.entries({ MODULE_ICONS, SITE_IMG, STRUCT_IMG, TAB_IMG })) {
    it(`${name} ├── every file exists`, () => {
      for (const [k, src] of Object.entries(reg)) {
        expect(existsSync(join(PUBLIC, src)), `${name}.${k} → ${src}`).toBe(true);
      }
    });
  }
  it('smanifest sheet is complete: ≥25 entries (de 5 tab sheet-03), paths exist', () => {
    expect(manifest.length).toBeGreaterThanOrEqual(30);
    for (const e of manifest as Array<{ file: string }>) {
      expect(existsSync(join(process.cwd(), e.file)), e.file).toBe(true);
    }
  });
});
