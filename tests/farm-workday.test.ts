import { describe, expect, it } from 'vitest';
import { CROPS } from '../src/sim/data';

/**
 * Gieo/thu là một nhiệm vụ có thời lượng = m² × hệ số. Nếu nó dài hơn một ngày
 * công của người đi làm thuê (06:30–17:00) thì việc không bao giờ hoàn thành:
 * người về nhà giữa lúc làm và khoảnh đó vĩnh viễn trống.
 */
const PLANT_SEC_PER_M2 = 40;
const HARVEST_SEC_PER_M2 = 30;
const WORKDAY_SEC = 10.5 * 3600;

describe('khoảnh vườn phải làm xong trong một ngày công', () => {
  for (const limit of [180, 300]) {
    it(`khoảnh ${limit} m² gieo/thu vừa một ngày`, () => {
      expect(limit * PLANT_SEC_PER_M2).toBeLessThan(WORKDAY_SEC);
      expect(limit * HARVEST_SEC_PER_M2).toBeLessThan(WORKDAY_SEC);
      // và phải để lại thời gian chăm cây trong ngày
      expect(limit * PLANT_SEC_PER_M2 + limit * HARVEST_SEC_PER_M2 * 0.5).toBeLessThan(WORKDAY_SEC);
    });
  }

  it('khoai cho nhiều calo hơn rau trên cùng diện tích (chọn cây phải phản ánh điều đó)', () => {
    const rau = CROPS.rau.kcalPerM2 / CROPS.rau.days;
    const khoai = CROPS.khoai.kcalPerM2 / CROPS.khoai.days;
    expect(khoai).toBeGreaterThan(rau * 2);
  });
});
