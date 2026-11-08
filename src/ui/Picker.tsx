import * as maplibregl from 'maplibre-gl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CATS } from '../data/categories';
import { newGame } from '../sim/state';
import type { GameState } from '../sim/types';
import { unproject } from '../world/geo';
import { loadWorld } from '../world/loader';
import type { World } from '../world/types';
import { buildingsGeoJSON, waterGeoJSON } from './mapData';
import { setGeo, useMap } from './useMap';

const RADII = [800, 1200, 1600];
const MIN_BASE_AREA = 40;

export function Picker({ onStart, onBack }: { onStart: (s: GameState, w: World) => void; onBack: () => void }) {
  const { ref, map } = useMap([105.852, 21.028], 14);
  const [point, setPoint] = useState<[number, number] | null>(null);
  const [radius, setRadius] = useState(1200);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  const [world, setWorld] = useState<World | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);
  const worldRef = useRef<World | null>(null);
  worldRef.current = world;

  useEffect(() => {
    if (!map) return;
    const onClick = (e: maplibregl.MapMouseEvent) => {
      if (worldRef.current) {
        const f = map.queryRenderedFeatures(e.point, { layers: ['bld-fill'] })[0];
        if (f) setSel(String(f.properties?.id));
        return;
      }
      setPoint([e.lngLat.lat, e.lngLat.lng]);
    };
    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;
    marker.current?.remove();
    if (point && !world) {
      marker.current = new maplibregl.Marker({ color: '#ff2a2a' }).setLngLat([point[1], point[0]]).addTo(map);
    }
  }, [map, point, world]);

  useEffect(() => {
    if (!map || !world) return;
    setGeo(map, 'bld', buildingsGeoJSON(world));
    setGeo(map, 'water', waterGeoJSON(world));
    if (!map.getLayer('bld-fill')) {
      map.addLayer({ id: 'bld-fill', type: 'fill', source: 'bld', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.75 } });
      map.addLayer({
        id: 'bld-sel',
        type: 'line',
        source: 'bld',
        paint: { 'line-color': '#ff2a2a', 'line-width': 3 },
        filter: ['==', ['get', 'id'], ''],
      });
      map.addLayer({ id: 'water-pt', type: 'circle', source: 'water', paint: { 'circle-radius': 5, 'circle-color': '#5a9ad0', 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' } });
    }
    map.flyTo({ center: world.center, zoom: 15 });
  }, [map, world]);

  useEffect(() => {
    if (map?.getLayer('bld-sel')) map.setFilter('bld-sel', ['==', ['get', 'id'], sel ?? '']);
  }, [map, sel]);

  const scan = async (synthetic: boolean) => {
    const p = point ?? (map ? ([map.getCenter().lat, map.getCenter().lng] as [number, number]) : null);
    if (!p) return;
    setStatus('loading');
    setSel(null);
    try {
      const w = await loadWorld(p[0], p[1], radius, synthetic, setMsg);
      setWorld(w);
      setStatus('ready');
    } catch (e) {
      setStatus('error');
      setMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const reset = () => {
    setWorld(null);
    setSel(null);
    setStatus('idle');
    for (const id of ['bld-fill', 'bld-sel', 'water-pt']) if (map?.getLayer(id)) map.removeLayer(id);
    for (const id of ['bld', 'water']) if (map?.getSource(id)) map.removeSource(id);
  };

  const b = useMemo(() => world?.buildings.find((x) => x.id === sel), [world, sel]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const x of world?.buildings ?? []) c[x.cat] = (c[x.cat] ?? 0) + 1;
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }, [world]);

  const start = () => {
    if (!world || !b) return;
    const seed = (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0;
    onStart(newGame(world, b.id, seed), world);
  };

  return (
    <div className="picker">
      <div className="map">
        <div ref={ref} />
      </div>
      <div className="side-panel">
        <div className="row">
          <button onClick={onBack}>← Thoát</button>
          <span className="label grow" style={{ textAlign: 'right' }}>
            Bước {world ? 2 : 1}/2
          </span>
        </div>
        {!world && (
          <>
            <div className="step">Chọn khu vực</div>
            <div className="dim">Bấm vào bất kỳ đâu trên bản đồ. Game sẽ dựng thế giới từ dữ liệu OpenStreetMap thật của khu đó.</div>
            <div className="label">Bán kính</div>
            <div className="row">
              {RADII.map((r) => (
                <button key={r} className={r === radius ? 'on' : ''} onClick={() => setRadius(r)}>
                  {r} m
                </button>
              ))}
            </div>
            <div className="kv">
              <span>Vị trí</span>
              <span>{point ? `${point[0].toFixed(4)}, ${point[1].toFixed(4)}` : 'tâm bản đồ'}</span>
            </div>
            <button className="primary" disabled={status === 'loading'} onClick={() => scan(false)}>
              Quét khu vực (OSM)
            </button>
            <button disabled={status === 'loading'} onClick={() => scan(true)}>
              Dùng thành phố mô phỏng (offline)
            </button>
            {status !== 'idle' && <div className={status === 'error' ? 'red' : 'dim'}>{msg}</div>}
            {status === 'error' && <div className="dim">Overpass có thể đang quá tải. Thử lại, giảm bán kính, hoặc dùng thành phố mô phỏng.</div>}
          </>
        )}
        {world && (
          <>
            <div className="step">Chọn căn cứ</div>
            <div className="card col">
              <div className="row">
                <span className="label grow">Độ khó khu vực</span>
                <b className={world.score.difficulty >= 50 ? 'red' : ''}>
                  {world.score.label} · {world.score.difficulty}
                </b>
              </div>
              {(['food', 'water', 'medical', 'materials'] as const).map((k) => (
                <div key={k}>
                  <div className="row">
                    <span className="dim grow">{{ food: 'Lương thực', water: 'Nước', medical: 'Thuốc men', materials: 'Vật liệu' }[k]}</span>
                    <span>{Math.round(world.score[k] * 100)}%</span>
                  </div>
                  <div className="meter">
                    <i style={{ width: `${world.score[k] * 100}%` }} />
                  </div>
                </div>
              ))}
              <div className="row">
                <span className="dim grow">Mật độ zombie TB</span>
                <span>{world.score.danger} / 6</span>
              </div>
              {world.score.notes.map((n) => (
                <div key={n} className="dim">
                  › {n}
                </div>
              ))}
            </div>
            <div className="dim">
              {world.buildings.length.toLocaleString('vi')} toà nhà · {world.graph.nodes.length.toLocaleString('vi')} nút đường ·{' '}
              {world.source === 'osm' ? 'OpenStreetMap' : 'mô phỏng'}
            </div>
            <div className="row" style={{ gap: 4 }}>
              {counts.slice(0, 10).map(([c, n]) => (
                <span key={c} className="tag" style={{ borderColor: CATS[c as keyof typeof CATS].color }}>
                  {CATS[c as keyof typeof CATS].label} {n}
                </span>
              ))}
            </div>
            <hr />
            {!b && <div className="dim">Bấm một toà nhà trên bản đồ để chọn làm căn cứ.</div>}
            {b && (
              <div className="card col">
                <b>{b.name ?? CATS[b.cat].label}</b>
                <div className="kv">
                  <span>Loại</span>
                  <span>{CATS[b.cat].label}</span>
                  <span>Diện tích sàn</span>
                  <span>{b.area} m²</span>
                  <span>Số tầng</span>
                  <span>{b.levels}</span>
                  <span>Chỗ lục soát</span>
                  <span>{b.containers}</span>
                  <span>Mật độ zombie</span>
                  <span>{world.cells[b.cell]?.danger ?? '?'} / 6</span>
                  <span>Toạ độ</span>
                  <span>{unproject(world.center, b.centroid).map((x) => x.toFixed(4)).join(', ')}</span>
                </div>
                {b.area < MIN_BASE_AREA && <div className="red">Quá nhỏ để làm căn cứ.</div>}
                <div className="dim">
                  Toà to: nhiều phòng nhưng chu vi dài, gia cố đắt. Nhà ống: rẻ để giữ nhưng chật. Mái càng rộng càng hứng nhiều nước mưa.
                </div>
              </div>
            )}
            <button className="primary" disabled={!b || b.area < MIN_BASE_AREA} onClick={start}>
              Bắt đầu
            </button>
            <button onClick={reset}>Chọn khu khác</button>
          </>
        )}
      </div>
    </div>
  );
}
