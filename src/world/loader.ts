import { get, set } from 'idb-keyval';
import { snapForPrivacy } from './overpass';
import type { World } from './types';
import type { WorldRequest } from './worker';

// Bump when the World shape changes so stale caches are regenerated.
const WORLD_VERSION = 2;

function worldKey(lat: number, lon: number, radius: number, synthetic: boolean): string {
  return `v${WORLD_VERSION}:${synthetic ? 'syn' : 'osm'}:${lat.toFixed(3)},${lon.toFixed(3)}:${radius}`;
}

export async function loadWorld(
  lat: number,
  lon: number,
  radius: number,
  synthetic: boolean,
  onProgress: (msg: string) => void,
): Promise<World> {
  if (!synthetic) [lat, lon] = snapForPrivacy(lat, lon);
  const key = worldKey(lat, lon, radius, synthetic);
  const cached = await get<World>(key).catch(() => undefined);
  if (cached) {
    onProgress('Dùng bản đồ đã lưu trên máy.');
    return cached;
  }
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  try {
    const world = await new Promise<World>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent) => {
        const d = e.data as { type: string; msg?: string; world?: World; message?: string };
        if (d.type === 'progress') onProgress(d.msg!);
        else if (d.type === 'done') resolve(d.world!);
        else reject(new Error(d.message));
      };
      worker.onerror = (e) => reject(new Error(e.message));
      const req: WorldRequest = { key, lat, lon, radius, synthetic };
      worker.postMessage(req);
    });
    await set(key, world).catch(() => undefined);
    return world;
  } finally {
    worker.terminate();
  }
}

export const getCachedWorld = (key: string) => get<World>(key);
