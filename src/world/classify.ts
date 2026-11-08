import type { BuildingCat } from './types';

export type LanduseKind = 'residential' | 'industrial' | 'commercial' | 'green' | 'other';

export function landuseKind(tags: Record<string, string>): LanduseKind {
  const l = tags.landuse ?? tags.leisure ?? '';
  if (l === 'residential') return 'residential';
  if (l === 'industrial') return 'industrial';
  if (l === 'commercial' || l === 'retail') return 'commercial';
  if (/^(grass|meadow|farmland|orchard|allotments|park|garden|pitch|village_green|recreation_ground)$/.test(l))
    return 'green';
  return 'other';
}

/** Category from POI / building tags; null when the tags say nothing useful. */
export function catFromTags(t: Record<string, string>): BuildingCat | null {
  const a = t.amenity;
  if (a) {
    if (a === 'hospital') return 'hospital';
    if (/^(clinic|doctors|dentist)$/.test(a)) return 'clinic';
    if (a === 'pharmacy') return 'pharmacy';
    if (/^(school|kindergarten|college|university)$/.test(a)) return 'school';
    if (a === 'police') return 'police';
    if (a === 'fuel') return 'fuel';
    if (a === 'marketplace') return 'market';
    if (/^(restaurant|cafe|fast_food|bar|pub|food_court)$/.test(a)) return 'food_place';
    if (a === 'place_of_worship') return 'religious';
  }
  const s = t.shop;
  if (s) {
    if (s === 'supermarket' || s === 'wholesale') return 'supermarket';
    if (/^(convenience|grocery|kiosk|general|beverages|bakery|greengrocer|butcher)$/.test(s)) return 'shop';
    if (/^(hardware|doityourself|trade|building_materials|garden_centre)$/.test(s)) return 'hardware';
    if (/^(car_repair|car|car_parts|tyres|motorcycle|motorcycle_repair)$/.test(s)) return 'car_repair';
    if (s === 'chemist' || s === 'medical_supply') return 'pharmacy';
    return 'shop';
  }
  const b = t.building;
  if (b) {
    if (/^(house|detached|semidetached_house|terrace|bungalow|residential|hut)$/.test(b)) return 'house';
    if (b === 'apartments' || b === 'dormitory') return 'apartment';
    if (/^(industrial|warehouse|factory|manufacture|storage_tank|hangar)$/.test(b)) return 'industrial';
    if (b === 'retail' || b === 'supermarket') return 'shop';
    if (b === 'commercial' || b === 'office' || b === 'government' || b === 'public') return 'office';
    if (/^(school|kindergarten|university|college)$/.test(b)) return 'school';
    if (b === 'hospital') return 'hospital';
    if (/^(church|temple|pagoda|mosque|shrine|cathedral|chapel)$/.test(b)) return 'religious';
  }
  return null;
}

/** Fallback when OSM only says building=yes — very common in Vietnam. */
export function inferCat(area: number, levels: number, landuse: LanduseKind): BuildingCat {
  if (landuse === 'industrial') return area > 300 ? 'industrial' : 'house';
  if (area > 1500) return landuse === 'commercial' ? 'office' : levels >= 5 ? 'apartment' : 'industrial';
  if (area > 400 && levels >= 5) return 'apartment';
  if (area < 250) return 'house';
  return 'generic';
}

export function defaultLevels(cat: BuildingCat, area: number): number {
  switch (cat) {
    case 'house':
      return area < 120 ? 3 : 2; // Vietnamese tube houses are narrow and tall
    case 'apartment':
      return 8;
    case 'hospital':
    case 'office':
      return 5;
    case 'school':
      return 3;
    case 'industrial':
    case 'supermarket':
    case 'market':
    case 'fuel':
    case 'religious':
      return 1;
    default:
      return 2;
  }
}

/** Residents per building before the outbreak; drives zombie density. */
export function residents(cat: BuildingCat, area: number, levels: number): number {
  const floor = area * Math.min(levels, 30);
  if (cat === 'house' || cat === 'apartment' || cat === 'generic') return floor / 30;
  if (cat === 'shop' || cat === 'food_place' || cat === 'pharmacy') return (area * Math.max(0, levels - 1)) / 30;
  return 0;
}
