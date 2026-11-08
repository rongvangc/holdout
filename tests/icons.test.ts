import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { MODULE_ICONS, ROLE_ICONS, SKILL_ICONS, SITE_IMG, STRUCT_IMG, UI_ICONS } from '../src/ui/icons';

// UI registries mới — mỗi path phải thật sự tồn tại dưới public/.
const PUBLIC = join(process.cwd(), 'public');
describe('icon registries', () => {
  for (const [name, reg] of Object.entries({ MODULE_ICONS, ROLE_ICONS, SKILL_ICONS, SITE_IMG, STRUCT_IMG, UI_ICONS })) {
    it(`${name} resolves to existing files`, () => {
      expect(Object.keys(reg).length).toBeGreaterThan(0);
      for (const [k, src] of Object.entries(reg)) {
        expect(existsSync(join(PUBLIC, src)), `${name}.${k} → ${src}`).toBe(true);
      }
    });
  }
  it('module icons all use the custom mono-line set', () => {
    for (const [k, src] of Object.entries(MODULE_ICONS)) expect(src.includes('/icons/custom/'), `${k} → ${src}`).toBe(true);
  });
});
