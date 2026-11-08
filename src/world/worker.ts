/// <reference lib="webworker" />
import { buildWorld } from './generate';
import { fetchOsm } from './overpass';
import { syntheticOsm } from './synthetic';

export interface WorldRequest {
  key: string;
  lat: number;
  lon: number;
  radius: number;
  synthetic: boolean;
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (e: MessageEvent<WorldRequest>) => {
  const { key, lat, lon, radius, synthetic } = e.data;
  const progress = (msg: string) => ctx.postMessage({ type: 'progress', msg });
  try {
    progress(synthetic ? 'Sinh thành phố mô phỏng…' : 'Tải dữ liệu OpenStreetMap…');
    const els = synthetic ? syntheticOsm([lon, lat], radius) : await fetchOsm(lat, lon, radius);
    progress(`Nhận ${els.length.toLocaleString('vi')} phần tử, đang dựng thế giới…`);
    const world = buildWorld(els, [lon, lat], radius, synthetic ? 'synthetic' : 'osm', progress);
    world.key = key;
    ctx.postMessage({ type: 'done', world });
  } catch (err) {
    ctx.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
