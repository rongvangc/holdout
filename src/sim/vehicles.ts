import type { Site, Vehicle } from './types';
import { liquidFree, liquidRoom } from './containers';
import type { ItemId } from '../data/items';

/**
 * Vehicles as objects, not a tally.
 *
 * Until now `stock.vehicle` was just a number: any car in the yard was identical,
 * burnt fuel out of the shared stock, and never broke. Now each car has its own
 * tank, its own wear and its own kilometres per litre, so choosing which one to
 * send — and whether to spend fuel fixing it — is a decision.
 *
 * `stock.vehicle` is kept in sync as "how many roadworthy cars are here" so the
 * existing UI and saves keep working.
 */

export interface VehicleTemplate {
  label: string;
  tankL: number;
  kmPerL: number;
  seats: number;
  cargoKg: number;
}

export const VEHICLE_KINDS: Record<string, VehicleTemplate> = {
  car: { label: 'Ô tô con', tankL: 50, kmPerL: 12, seats: 4, cargoKg: 180 },
  van: { label: 'Xe van', tankL: 65, kmPerL: 9, seats: 6, cargoKg: 420 },
  pickup: { label: 'Bán tải', tankL: 70, kmPerL: 8, seats: 5, cargoKg: 520 },
  truck: { label: 'Xe tải nhỏ', tankL: 90, kmPerL: 6, seats: 3, cargoKg: 900 },
};

/** Cần ít nhất chừng này mới dám nổ máy. */
export const MIN_CONDITION = 15;
/** Mòn theo km: 1 điểm mỗi 500 km, nhân thêm khi đường xấu. */
const WEAR_PER_KM = 0.002;

export function makeVehicle(kind: keyof typeof VEHICLE_KINDS, siteId: string, id: string): Vehicle {
  const t = VEHICLE_KINDS[kind];
  return { id, siteId, kind: kind as Vehicle['kind'], label: t.label, fuelL: t.tankL * 0.4, tankL: t.tankL, condition: 70, seats: t.seats, cargoKg: t.cargoKg, kmPerL: t.kmPerL };
}

/** Tạo xe cho save cũ có `stock.vehicle` nhưng chưa có danh sách xe. */
export function migrateVehicles(site: Site): Vehicle[] {
  if (site.vehicles) return site.vehicles;
  const n = Math.max(0, Math.floor(site.stock.vehicle ?? 0));
  const out: Vehicle[] = [];
  for (let i = 0; i < n; i++) out.push(makeVehicle('car', site.id, `${site.id}-v${i}`));
  site.vehicles = out;
  return out;
}

/** Số xe còn chạy được — con số mà UI và save cũ dùng. */
export function usableCount(site: Site): number {
  return (site.vehicles ?? []).filter((v) => v.condition >= MIN_CONDITION).length;
}

export function syncVehicleStock(site: Site): void {
  site.stock.vehicle = usableCount(site);
}

/**
 * Lượng xăng cần cho `km`, tính cả hao hụt do máy yếu.
 * `eff` < 1 là hiệu suất của ga-ra: cùng một chiếc xe, sửa đúng thì tốn ít hơn.
 */
export function fuelFor(v: Vehicle, km: number, eff = 1): number {
  const wear = 1 + (100 - v.condition) / 150;
  return (km / Math.max(1, v.kmPerL)) * wear * eff;
}

/** Chọn xe tốt nhất còn dùng được cho chuyến đi. */
export function pickVehicle(site: Site, km: number, eff = 1): { vehicle: Vehicle | null; why?: string } {
  // Save cũ (hoặc state dựng tay trong test) chỉ có con số `stock.vehicle`.
  if (!site.vehicles) migrateVehicles(site);
  const list = (site.vehicles ?? []).filter((v) => v.condition >= MIN_CONDITION);
  if (!list.length) return { vehicle: null, why: 'Không còn xe nào chạy được' };
  const withFuel = list.filter((v) => v.fuelL >= fuelFor(v, km, eff));
  if (!withFuel.length) return { vehicle: null, why: 'Không xe nào đủ xăng cho chuyến này' };
  // Ưu tiên xe chở được nhiều nhất trên mỗi lít xăng.
  withFuel.sort((a, b) => b.cargoKg / fuelFor(b, km, eff) - a.cargoKg / fuelFor(a, km, eff));
  return { vehicle: withFuel[0] };
}

export function burnFuel(v: Vehicle, km: number, eff = 1): void {
  v.fuelL = Math.max(0, v.fuelL - fuelFor(v, km, eff));
  v.condition = Math.max(0, v.condition - km * WEAR_PER_KM);
}

/** Đổ xăng từ kho vào bình. Trả về số lít thực sự đổ được. */
export function refuel(site: Site, v: Vehicle, liters: number): number {
  const room = Math.max(0, v.tankL - v.fuelL);
  const moved = Math.min(room, Math.max(0, liters), site.stock.fuel);
  if (moved <= 0) return 0;
  site.stock.fuel -= moved;
  v.fuelL += moved;
  return moved;
}

/** Sửa xe bằng sắt và linh kiện; mỗi lượt hồi 35 điểm. */
function repairCost(): Partial<Record<ItemId, number>> {
  return { scrap: 4, parts: 2 };
}

export function canRepair(site: Site, v: Vehicle): boolean {
  const c = repairCost();
  return v.condition < 100 && (site.stock.scrap ?? 0) >= (c.scrap ?? 0) && (site.stock.parts ?? 0) >= (c.parts ?? 0);
}

export function repairVehicle(site: Site, v: Vehicle): boolean {
  if (!canRepair(site, v)) return false;
  const c = repairCost();
  site.stock.scrap = (site.stock.scrap ?? 0) - (c.scrap ?? 0);
  site.stock.parts = (site.stock.parts ?? 0) - (c.parts ?? 0);
  v.condition = Math.min(100, v.condition + 35);
  syncVehicleStock(site);
  return true;
}

/**
 * Cơ hội tìm được xe khi lục một toà nhà, theo loại toà và theo ngày.
 *
 * Ngay sau bạo loạn thì xe còn đầy đường; càng về sau càng bị lấy, bị vét, bị
 * hỏng. Đây là lý do người chơi phải lo chuyện xe trong tuần đầu chứ không phải
 * tháng thứ ba.
 */
export function vehicleOdds(cat: string, day: number): number {
  const byCat: Record<string, number> = {
    fuel: 0.25,
    car_repair: 0.22,
    industrial: 0.12,
    market: 0.1,
    supermarket: 0.1,
    hardware: 0.08,
    houselabel: 0.07,
    apartment: 0.05,
    office: 0.04,
    school: 0.03,
    hospital: 0.03,
    police: 0.06,
    generic: 0.04,
  };
  const base = byCat[cat] ?? 0.1;
  // Xe bị lấy mất dần: mạnh nhất trong tháng đầu, còn 20% sau nửa năm.
  const decay = Math.max(0.2, 1 - day / 150);
  return base * decay;
}

/** Bãi xe có hạn: giữ chiếc tốt nhất, thay chiếc tệ nhất khi tìm được chiếc hơn. */
export const MAX_FLEET = 4;

/** Điểm xếp hạng một chiếc xe: chở nhiều, còn tốt, còn xăng. */
export function vehicleValue(v: Vehicle): number {
  return v.cargoKg * 0.4 * (v.condition / 100) + v.fuelL * 2 + v.condition;
}

/**
 * Thêm xe vào sân, tôn trọng trần bãi xe. Trả về chiếc bị thay (nếu có).
 * Một cộng đồng 13 người không thể giữ 18 chiếc xe — họ kéo về chiếc tốt nhất.
 */
export function addVehicle(site: Site, v: Vehicle): Vehicle | null {
  const fleet = [...(site.vehicles ?? [])];
  fleet.push(v);
  if (fleet.length <= MAX_FLEET) {
    site.vehicles = fleet;
    syncVehicleStock(site);
    return null;
  }
  fleet.sort((a, b) => vehicleValue(b) - vehicleValue(a));
  const dropped = fleet.pop()!;
  site.vehicles = fleet;
  syncVehicleStock(site);
  return dropped.id === v.id ? v : dropped;
}

/** Can còn trống bao nhiêu lít ở sân này (nước + xăng dùng chung chỗ). */
export function siphonRoom(site: Site): number {
  return liquidFree(site.stock) + (site.stock.fuel ?? 0);
}

/**
 * Hút xăng từ một chiếc xe sang kho. Đây là cách kiếm nhiên liệu chính: xe bỏ lại
 * đầy bình, chỉ là không nổ máy. Cần can, và bình xe phải còn xăng.
 */
export function siphon(site: Site, v: Vehicle): number {
  const room = Math.max(0, liquidRoom(site.stock) - ((site.stock.water ?? 0) + (site.stock.dirtyWater ?? 0)));
  const moved = Math.min(v.fuelL, room);
  if (moved <= 0.01) return 0;
  v.fuelL -= moved;
  site.stock.fuel = (site.stock.fuel ?? 0) + moved;
  return moved;
}

/** Xe chở được bao nhiêu kg, cộng thêm khoang của ga-ra nếu có. */
export function vehicleCargo(v: Vehicle, garageBonus = 0): number {
  return v.cargoKg + garageBonus;
}


