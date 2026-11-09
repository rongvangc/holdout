import { describe, expect, it } from 'vitest';
import { DISHES, INGREDIENTS } from '../src/data/dishes';
import { RECIPES } from '../src/data/recipes';
import { ITEMS } from '../src/data/items';

const dishRecipes = RECIPES.filter((r) => DISHES[r.out]);

/** Từ ngữ gắn vùng miền — tên món phải trung tính để vùng nào trên bản đồ cũng hợp. */
const REGIONAL_WORDS = ['phở', 'bún', 'bánh mì', 'dưa muối', 'đậu hũ', 'cơm tấm', 'chả', 'giò', 'nem', 'xôi', 'mì quảng', 'bánh xèo'];

describe('đa dạng món ăn', () => {
  it('có ít nhất 24 món và món nào cũng có công thức', () => {
    expect(Object.keys(DISHES).length).toBeGreaterThanOrEqual(24);
    const missing = Object.keys(DISHES).filter((id) => !dishRecipes.some((r) => r.out === id));
    expect(missing, `món thiếu công thức: ${missing.join(', ')}`).toEqual([]);
  });

  it('mỗi nguyên liệu sản xuất được phải dùng ở ≥2 món (không có nguyên liệu chết)', () => {
    const used = new Map<string, number>();
    for (const r of dishRecipes) for (const [i] of r.in) if (!i.startsWith('@')) used.set(i, (used.get(i) ?? 0) + 1);
    const dead = Object.keys(INGREDIENTS).filter((i) => (used.get(i) ?? 0) < 2);
    expect(dead, `nguyên liệu chỉ dùng 1 lần hoặc không dùng: ${dead.join(', ')}`).toEqual([]);
  });

  it('có đồ uống nấu được và món mang đi được', () => {
    const wet = Object.values(DISHES).filter((d) => (d.fx?.water ?? 0) > 0);
    const travel = Object.values(DISHES).filter((d) => d.fx?.travel);
    expect(wet.length).toBeGreaterThanOrEqual(3);
    expect(travel.length).toBeGreaterThanOrEqual(3); // chỉ món bảo quản mới đi đường được
  });

  it('có ít nhất 5 món bảo quản được ≥20 ngày', () => {
    const kept = Object.values(DISHES).filter((d) => (d.rotPerDay ?? 1) <= 0.05);
    expect(kept.length).toBeGreaterThanOrEqual(5);
  });

  it('tên món trung tính, không gắn vùng miền', () => {
    for (const d of Object.values(DISHES)) {
      for (const w of REGIONAL_WORDS) expect(d.label.toLowerCase()).not.toContain(w);
    }
  });

  it('bột và dầu chế được từ nguyên liệu trong game (không phải chỉ đi lục)', () => {
    expect(RECIPES.some((r) => r.out === 'bot')).toBe(true);
    expect(RECIPES.some((r) => r.out === 'oil')).toBe(true);
  });

  it('mỗi món có hiệu ứng thật, không chỉ calo', () => {
    const plain = Object.entries(DISHES).filter(([, d]) => !d.fx && !(d.morale ?? 0));
    expect(plain.map(([id]) => id)).toEqual([]);
  });
});
