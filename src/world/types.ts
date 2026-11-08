export type Vec = [number, number]; // local metres: x east, y north
export type LonLat = [number, number];

export type BuildingCat =
  | 'house'
  | 'apartment'
  | 'shop'
  | 'supermarket'
  | 'market'
  | 'pharmacy'
  | 'clinic'
  | 'hospital'
  | 'school'
  | 'police'
  | 'fuel'
  | 'hardware'
  | 'car_repair'
  | 'industrial'
  | 'office'
  | 'religious'
  | 'food_place'
  | 'generic';

export interface Building {
  id: string;
  cat: BuildingCat;
  name?: string;
  poly: Vec[];
  centroid: Vec;
  area: number;
  levels: number;
  containers: number;
  node: number; // nearest road-graph node
  cell: string; // H3 res-9 cell
}

export interface WaterPoint {
  id: string;
  pos: Vec;
  node: number;
  name?: string;
}

export interface RoadGraph {
  nodes: Vec[];
  adj: number[][];
  w: number[][];
}

/** Park / grass / farmland polygon that can be claimed as a field. */
export interface Green {
  id: string;
  name?: string;
  poly: Vec[];
  area: number;
  centroid: Vec;
  node: number;
  cell: string;
}

export interface ZoneCell {
  id: string;
  pop: number;
  danger: number; // 1..6, from estimated pre-outbreak population
}

export interface WorldScore {
  difficulty: number; // 0..100
  label: string;
  food: number; // 0..1 relative abundance
  water: number;
  medical: number;
  materials: number;
  danger: number; // mean cell danger 1..6
  notes: string[];
}

export interface World {
  key: string;
  source: 'osm' | 'synthetic';
  center: LonLat;
  radius: number;
  buildings: Building[];
  waterPoints: WaterPoint[];
  greens: Green[];
  graph: RoadGraph;
  cells: Record<string, ZoneCell>;
  greenArea: number;
  score: WorldScore;
}
