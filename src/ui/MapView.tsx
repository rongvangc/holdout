import * as maplibregl from 'maplibre-gl';
// maplibre v6 resolves its worker from its own module URL, which a bundler
// rewrites. Shipping the worker as an asset and pointing at it explicitly is the
// documented fix: without it `vite build` ships a map that throws
// "Worker failed to load" while `vite dev` works.
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

maplibregl.setWorkerUrl(mapWorkerUrl);
import { useEffect, useMemo, useRef, useState } from 'react';
import { dayOf, fmtClock, fmtDuration } from '../core/time';
import { CATS } from '../data/categories';
import { ITEMS, STOCK_ORDER, stockWeight, type ItemId } from '../data/items';
import { expeditionEta, kindFor, launchExpedition, planExpedition, type Mode, type TargetRef } from '../sim/expedition';
import { startDecoy } from '../sim/daily';
import { log, newId, siteOfSource } from '../sim/state';
import { skill } from '../sim/survivors';
import type { StockDelta } from '../sim/types';
import { unproject } from '../world/geo';
import { fmtNum, MAX_RADIUS, type ViewProps } from './Game';
import { Icon, ITEM_ICONS } from './icons';
import { buildingsGeoJSON, cellsGeoJSON, greensGeoJSON, mapDataCellPos, waterGeoJSON } from './mapData';
import { setGeo, useMap } from './useMap';

const MODES: [Mode, string, string][] = [
  ['walk', 'Đi bộ', '1.35 m/s · ồn vừa'],
  ['sneak', 'Lén', '0.7 m/s · rất ít gặp'],
  ['car', 'Ô tô', '11 m/s · ồn 560 m · tốn xăng'],
];

const KIND_LABEL = { loot: 'Lục soát', water: 'Lấy nước', claim: 'Chiếm làm điểm mới', convoy: 'Vận chuyển', patrol: 'Đi tuần' } as const;
type Action = 'default' | 'claim' | 'patrol';

export function MapView({ s, world, site: from, setSite, refresh, expandWorld }: ViewProps) {
  const { ref, map } = useMap(unproject(world.center, from.centroid), 16);
  const [target, setTarget] = useState<TargetRef | null>(null);
  const [team, setTeam] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>('walk');
  const [containers, setContainers] = useState(20);
  const [action, setAction] = useState<Action>('default');
  const [relocate, setRelocate] = useState(false);
  const [repeat, setRepeat] = useState(0);
  const [cargo, setCargo] = useState<StockDelta>({});
  const [err, setErr] = useState('');
  const [expandMsg, setExpandMsg] = useState('');
  const [layer, setLayer] = useState<'heat' | 'danger'>('danger');
  const idx = useMemo(() => new Map(world.buildings.map((b, i) => [b.id, i])), [world]);
  const lootedSig = Object.values(s.looted).reduce((a, b) => a + b, 0);
  const heatSig = Math.round(Object.values(s.cellHeat).reduce((a, b) => a + b, 0) + Object.values(s.cellClear).reduce((a, b) => a + b, 0) * 100);
  const ownedSig = s.sites.map((x) => x.sourceId).join(',');
  const markers = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    if (!map) return;
    setGeo(map, 'cells', cellsGeoJSON(world, s.cellHeat, s.cellClear));
    setGeo(map, 'greens', greensGeoJSON(world, new Set(s.sites.map((x) => x.sourceId))));
    setGeo(map, 'bld', buildingsGeoJSON(world));
    setGeo(map, 'water', waterGeoJSON(world));
    map.addLayer({
      id: 'cells',
      type: 'fill',
      source: 'cells',
      paint: { 'fill-color': '#ff2a2a', 'fill-opacity': ['/', ['get', 'danger'], 30], 'fill-outline-color': 'rgba(255,42,42,0.3)' },
    });
    map.addLayer({
      id: 'greens',
      type: 'fill',
      source: 'greens',
      paint: { 'fill-color': ['case', ['get', 'owned'], '#9fe070', '#3f6a2a'], 'fill-opacity': ['case', ['get', 'owned'], 0.75, 0.45] },
    });
    map.addLayer({
      id: 'bld-fill',
      type: 'fill',
      source: 'bld',
      paint: {
        'fill-color': ['case', ['boolean', ['feature-state', 'owned'], false], '#ffffff', ['get', 'color']],
        'fill-opacity': ['case', ['boolean', ['feature-state', 'owned'], false], 1, ['-', 0.9, ['*', 0.75, ['coalesce', ['feature-state', 'looted'], 0]]]],
      },
    });
    map.addLayer({ id: 'bld-line', type: 'line', source: 'bld', paint: { 'line-color': '#0a0a0a', 'line-width': 0.8, 'line-opacity': 0.85 } });
    map.addLayer({ id: 'bld-sel-glow', type: 'line', source: 'bld', paint: { 'line-color': '#ff2a2a', 'line-width': 9, 'line-opacity': 0.22 }, filter: ['==', ['get', 'id'], ''] });
    map.addLayer({ id: 'bld-sel', type: 'line', source: 'bld', paint: { 'line-color': '#ff2a2a', 'line-width': 2.5 }, filter: ['==', ['get', 'id'], ''] });
    map.addLayer({ id: 'green-sel', type: 'line', source: 'greens', paint: { 'line-color': '#ff2a2a', 'line-width': 2.5 }, filter: ['==', ['get', 'id'], ''] });
    map.addLayer({
      id: 'water-pt',
      type: 'circle',
      source: 'water',
      paint: { 'circle-radius': 5, 'circle-color': '#5a9ad0', 'circle-stroke-width': 1.5, 'circle-stroke-color': '#cfe6ff' },
    });
    const click = (e: maplibregl.MapMouseEvent) => {
      const w = map.queryRenderedFeatures(e.point, { layers: ['water-pt'] })[0];
      if (w) return setTarget({ type: 'water', id: String(w.properties?.id) });
      const f = map.queryRenderedFeatures(e.point, { layers: ['bld-fill'] })[0];
      if (f) return setTarget({ type: 'building', id: String(f.properties?.id) });
      const g = map.queryRenderedFeatures(e.point, { layers: ['greens'] })[0];
      if (g) setTarget({ type: 'green', id: String(g.properties?.id) });
    };
    map.on('click', click);
    return () => {
      map.off('click', click);
    };
    // Layers are created once per map instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    if (!map?.getSource('bld')) return;
    for (const [id, n] of Object.entries(s.looted)) {
      const i = idx.get(id);
      const b = world.buildings[i ?? -1];
      if (b) map.setFeatureState({ source: 'bld', id: i! }, { looted: Math.min(1, n / b.containers) });
    }
    for (const x of s.sites) {
      const i = idx.get(x.sourceId);
      if (i !== undefined) map.setFeatureState({ source: 'bld', id: i }, { owned: true });
    }
    setGeo(map, 'greens', greensGeoJSON(world, new Set(s.sites.map((x) => x.sourceId))));
  }, [map, lootedSig, ownedSig, idx, s.looted, s.sites, world]);

  useEffect(() => {
    if (!map?.getLayer('cells')) return;
    setGeo(map, 'cells', cellsGeoJSON(world, s.cellHeat, s.cellClear));
    map.setPaintProperty('cells', 'fill-opacity', layer === 'danger' ? ['/', ['get', 'danger'], 30] : ['min', 0.6, ['/', ['get', 'heat'], 120]]);
  }, [map, layer, heatSig, world, s.cellHeat, s.cellClear]);

  useEffect(() => {
    if (!map?.getLayer('bld-sel')) return;
    const bldFilter: maplibregl.FilterSpecification = ['==', ['get', 'id'], target?.type === 'building' ? target.id : ''];
    map.setFilter('bld-sel', bldFilter);
    map.setFilter('bld-sel-glow', bldFilter);
    map.setFilter('green-sel', ['==', ['get', 'id'], target?.type === 'green' ? target.id : '']);
  }, [map, target]);

  useEffect(() => {
    if (!map) return;
    for (const m of markers.current) m.remove();
    const mk = (pos: [number, number], cls: string, title: string) => {
      const el = document.createElement('div');
      el.className = cls;
      el.title = title;
      return new maplibregl.Marker({ element: el }).setLngLat(unproject(world.center, pos)).addTo(map);
    };
    markers.current = [
      ...s.sites.map((x) => mk(x.centroid, `map-marker${x.id === from.id ? ' on' : ''}`, x.name)),
      ...s.expeditions.map((e) => {
        const b = world.buildings.find((x) => x.id === e.target.id);
        const g = world.greens.find((x) => x.id === e.target.id);
        const w = world.waterPoints.find((x) => x.id === e.target.id);
        const site = s.sites.find((x) => x.id === e.target.id);
        const pos = b?.centroid ?? g?.centroid ?? w?.pos ?? site?.centroid ?? from.centroid;
        return mk(pos, 'map-marker exp', e.target.name);
      }),
      ...(s.hordes ?? []).map((h) => {
        const pos = mapDataCellPos(world, h.cell);
        return mk(pos, 'map-marker horde', `Bầy ~${h.size} zombie`);
      }),
    ];
    for (const m of markers.current.slice(0, s.sites.length)) {
      m.getElement().textContent = m.getElement().title;
    }
  }, [map, s.expeditions.length, s.sites.length, s.expeditions, s.sites, from, world, s.hordes]);

  const available = s.survivors.filter((v) => v.status === 'alive' && v.location === 'base' && v.siteId === from.id && v.task?.kind !== 'commute');
  const validTeam = team.filter((id) => available.some((v) => v.id === id));
  const kind = target ? kindFor(s, target, action === 'claim', action === 'patrol') : null;
  const usesCargo = kind === 'convoy' || kind === 'claim';
  const order = target
    ? {
        fromSite: from.id,
        members: validTeam,
        target,
        mode,
        containers,
        claim: action === 'claim',
        patrol: action === 'patrol',
        relocate,
        cargo: usesCargo ? cargo : undefined,
      }
    : null;
  const tick = Math.floor(s.t / 300);
  const plan = useMemo(
    () => (order ? planExpedition(s, world, order) : null),
    // Re-plan every 5 game-minutes; inputs are otherwise explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(order), tick, lootedSig, ownedSig],
  );
  const tb = target?.type === 'building' ? world.buildings.find((b) => b.id === target.id) : undefined;
  const tg = target?.type === 'green' ? world.greens.find((g) => g.id === target.id) : undefined;
  const ownedTarget = target && target.type !== 'water' ? siteOfSource(s, target.id) : undefined;

  const launch = () => {
    if (!order) return;
    const why = launchExpedition(s, world, order);
    setErr(why ?? '');
    if (!why) {
      if (kind === 'convoy' && !relocate && repeat > 0 && ownedTarget) {
        s.routes.push({
          id: newId(s, 'r'),
          from: from.id,
          to: ownedTarget.id,
          cargo: { ...cargo },
          crew: validTeam.length,
          everyDays: repeat,
          nextDay: dayOf(s.t) + repeat,
        });
        log(s, `Lập tuyến vận chuyển ${from.name} → ${ownedTarget.name} mỗi ${repeat} ngày.`, 'info');
      }
      setTeam([]);
      setCargo({});
    }
    refresh();
  };

  const expand = async () => {
    setExpandMsg('Đang tải thêm khu vực…');
    const why = await expandWorld(setExpandMsg);
    setExpandMsg(why ?? '');
    refresh();
  };
  const siteName = (id: string) => s.sites.find((x) => x.id === id)?.name ?? '?';

  const cargoItems = STOCK_ORDER.filter((k) => k !== 'meals' && k !== 'vehicle' && from.stock[k] >= 0.5);

  return (
    <div className="mapview">
      <div className="map">
        <div ref={ref} />
        <div className="map-layer-ctrl">
          <button className={layer === 'danger' ? 'on' : ''} onClick={() => setLayer('danger')}>
            Mật độ
          </button>
          <button className={layer === 'heat' ? 'on' : ''} onClick={() => setLayer('heat')}>
            Heat
          </button>
        </div>
      </div>
      <div className="side-panel">
        <div className="label">Đội đang ngoài ({s.expeditions.length})</div>
        {s.expeditions.map((e) => (
          <div key={e.id} className="card">
            <b>
              {KIND_LABEL[e.kind]} · {e.target.name}
            </b>
            <div className="dim">
              {{ out: 'Đang đi', search: e.kind === 'claim' ? 'Đang dọn sạch' : e.kind === 'convoy' ? 'Đang dỡ hàng' : 'Đang làm việc', back: 'Đang về' }[e.phase]} ·{' '}
              {e.relocate ? 'tới nơi' : 'về'} lúc {fmtClock(expeditionEta(e))}
            </div>
            <div className="faint">{e.members.map((id) => s.survivors.find((v) => v.id === id)?.name).join(', ')}</div>
          </div>
        ))}
        <hr />
        {s.routes.length > 0 && (
          <>
            <div className="label">Tuyến định kỳ ({s.routes.length})</div>
            {s.routes.map((r) => (
              <div key={r.id} className="row">
                <span className="grow">
                  {siteName(r.from)} → {siteName(r.to)} · {r.crew} người · mỗi {r.everyDays} ngày · lần tới N{r.nextDay}
                </span>
                <button
                  onClick={() => {
                    s.routes = s.routes.filter((x) => x !== r);
                    refresh();
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
            <hr />
          </>
        )}
        <div className="row">
          <span className="label grow">Xuất phát từ</span>
          <b>{from.name}</b>
        </div>
        {!target && (
          <div className="dim">
            Bấm toà nhà để lục soát hoặc chiếm làm tiền đồn, bấm vùng xanh (công viên, bãi cỏ) để chiếm làm ruộng, chấm xanh dương để lấy nước, hoặc
            bấm một điểm của mình (màu trắng / xanh sáng) để vận chuyển hàng và người. Đổi điểm xuất phát ở thanh trên cùng.
            <hr />
            <button disabled={world.radius >= MAX_RADIUS} onClick={expand}>
              Mở rộng bản đồ (hiện {world.radius} m → {Math.min(MAX_RADIUS, world.radius + 800)} m)
            </button>
            {expandMsg && <div className="dim">{expandMsg}</div>}
          </div>
        )}
        {target && (
          <>
            <div className="step">{ownedTarget?.name ?? (tb ? tb.name ?? CATS[tb.cat].label : tg ? tg.name ?? 'Bãi đất' : 'Sông/hồ')}</div>
            {ownedTarget && ownedTarget.id !== from.id && (
              <button onClick={() => setSite(ownedTarget.id)}>Chuyển sang quản lý {ownedTarget.name}</button>
            )}
            {tb && !ownedTarget && (
              <>
                <div className="kv">
                  <span>Loại</span>
                  <span>{CATS[tb.cat].label}</span>
                  <span>Sàn</span>
                  <span>
                    {tb.area} m² × {tb.levels} tầng
                  </span>
                  <span>Còn lục được</span>
                  <span>
                    {plan?.remaining ?? 0}/{tb.containers} chỗ
                  </span>
                  <span>Mật độ zombie</span>
                  <span>{plan?.target?.danger.toFixed(1)}</span>
                </div>
                <div className="row">
                  <button className={action === 'default' ? 'on' : ''} onClick={() => setAction('default')}>
                    Lục soát
                  </button>
                  <button className={action === 'claim' ? 'on' : ''} onClick={() => setAction('claim')}>
                    Chiếm làm tiền đồn
                  </button>
                  <button className={action === 'patrol' ? 'on' : ''} onClick={() => setAction('patrol')}>
                    Đi tuần
                  </button>
                </div>
                <div className="row">
                  <button
                    disabled={from.stock.fuel < 2}
                    title={from.stock.fuel < 2 ? 'Cần 2L xăng' : 'Phát ồn ở khu này 6 giờ — bầy zombie lân cận sẽ trườn về đây thay vì các điểm của bạn (tốn 2L xăng từ điểm xuất phát)'}
                    onClick={() => {
                      if (target?.type === 'water') return;
                      const cell = tb?.cell ?? tg?.cell ?? '';
                      if (!cell) return;
                      setErr(startDecoy(s, from.id, cell) ?? '');
                      refresh();
                    }}
                  >
                    Phát ồn 6h (2L xăng)
                  </button>
                </div>
              </>
            )}
            {tg && !ownedTarget && (
              <div className="kv">
                <span>Diện tích</span>
                <span>{tg.area.toLocaleString('vi')} m²</span>
                <span>Nuôi được</span>
                <span>~{Math.round((tg.area * 15.7) / 2250)} người (nếu trồng kín)</span>
              </div>
            )}
            {target.type !== 'water' && (!tb || ownedTarget) && (
              <div className="row">
                <button className={action !== 'patrol' ? 'on' : ''} onClick={() => setAction('default')}>
                  {ownedTarget ? 'Vận chuyển' : 'Chiếm làm ruộng'}
                </button>
                <button className={action === 'patrol' ? 'on' : ''} onClick={() => setAction('patrol')}>
                  Đi tuần
                </button>
              </div>
            )}
            {kind === 'patrol' && plan?.target && (
              <div className="dim">
                Đi tuần 2 giờ, chủ động tìm và hạ zombie quanh khu này (khu hiện sạch {Math.round((s.cellClear[plan.target.cell] ?? 0) * 100)}%).
                Khu sạch thì đi lại, làm ruộng và giữ điểm an toàn hơn, nhưng zombie sẽ tràn về dần mỗi ngày.
              </div>
            )}
            {kind === 'claim' && (
              <div className="dim">
                Phải dọn sạch zombie bên trong (khó né hơn). Đội sẽ ở lại giữ điểm mới. Mang theo đồ khởi đầu: nước, gạo, gỗ, hạt giống, dụng cụ.
              </div>
            )}
            {target.type === 'water' && <div className="dim">Nước sông/hồ là nước bẩn — phải lọc hoặc đun trước khi uống.</div>}

            <div className="label">
              {KIND_LABEL[kind!]} · Đội ({validTeam.length}/{available.length} ở {from.name})
            </div>
            <div className="col" style={{ gap: 2, maxHeight: 160, overflow: 'auto' }}>
              {available.map((v) => (
                <label key={v.id} className="row" style={{ gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={validTeam.includes(v.id)}
                    onChange={(e) => setTeam(e.target.checked ? [...validTeam, v.id] : validTeam.filter((x) => x !== v.id))}
                  />
                  <span className="grow">{v.name}</span>
                  <span className={v.hp < 50 ? 'red' : 'faint'}>HP {Math.round(v.hp)}</span>
                  <span className="faint">
                    Lén {skill(v, 'stealth')} · Lục {skill(v, 'scavenging')} · Đánh {skill(v, 'melee')}
                  </span>
                </label>
              ))}
              {!available.length && <span className="faint">Không có ai rảnh ở {from.name}.</span>}
            </div>
            <div className="row">
              {MODES.map(([m, l, d]) => (
                <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)} title={d}>
                  {l}
                </button>
              ))}
            </div>
            {kind === 'loot' && (
              <div className="col" style={{ gap: 2 }}>
                <span className="label">Số chỗ lục: {Math.min(containers, plan?.remaining ?? containers)}</span>
                <input type="range" min={1} max={Math.max(1, plan?.remaining ?? 1)} value={containers} onChange={(e) => setContainers(Number(e.target.value))} />
              </div>
            )}
            {kind === 'convoy' && (
              <label className="row" style={{ gap: 6 }}>
                <input type="checkbox" checked={relocate} onChange={(e) => setRelocate(e.target.checked)} />
                Đội ở lại {ownedTarget?.name} (chuyển người)
              </label>
            )}
            {kind === 'convoy' && !relocate && (
              <label className="row" style={{ gap: 6 }}>
                <input type="checkbox" checked={repeat > 0} onChange={(e) => setRepeat(e.target.checked ? 3 : 0)} />
                Lặp lại mỗi
                <input type="number" min={1} max={30} value={repeat || 3} disabled={!repeat} style={{ width: 56 }} onChange={(e) => setRepeat(Math.max(1, Number(e.target.value)))} />
                ngày
              </label>
            )}
            {usesCargo && (
              <div className="card col" style={{ gap: 3 }}>
                <div className="row">
                  <span className="label grow">Hàng mang theo</span>
                  <span className={plan && plan.cargoKg > plan.capacityKg ? 'red' : 'dim'}>
                    {Math.round(stockWeight(cargo))}/{Math.round(plan?.capacityKg ?? 0)} kg
                  </span>
                </div>
                {cargoItems.map((k: ItemId) => (
                  <label key={k} className="row" style={{ gap: 6 }}>
                    <Icon src={ITEM_ICONS[k]} size={16} />
                    <span className="grow">{ITEMS[k].label}</span>
                    <span className="faint">/{fmtNum(from.stock[k])}</span>
                    <input
                      type="number"
                      min={0}
                      max={Math.floor(from.stock[k])}
                      step={ITEMS[k].unit === 'kcal' ? 1000 : 1}
                      value={cargo[k] ?? 0}
                      style={{ width: 90 }}
                      onChange={(e) => setCargo({ ...cargo, [k]: Math.max(0, Math.min(Math.floor(from.stock[k]), Number(e.target.value))) })}
                    />
                  </label>
                ))}
              </div>
            )}
            {plan && plan.target && validTeam.length > 0 && (
              <div className="card kv">
                <span>Quãng đường</span>
                <span>{(plan.pathLen / 1000).toFixed(2)} km (đường thật)</span>
                <span>{plan.oneWay ? 'Đi (một chiều)' : 'Đi + về'}</span>
                <span>{fmtDuration(plan.travelSec * (plan.oneWay ? 1 : 2))}</span>
                <span>{{ loot: 'Lục soát', water: 'Lấy nước', claim: 'Dọn sạch', convoy: 'Dỡ hàng', patrol: 'Đi tuần' }[plan.kind!]}</span>
                <span>{fmtDuration(plan.searchSec)}</span>
                <span>Tổng</span>
                <b>
                  {fmtDuration(plan.totalSec)} → {fmtClock(s.t + plan.totalSec)}
                </b>
                <span>Mang được</span>
                <span>{Math.round(plan.capacityKg)} kg</span>
                <span>Gặp zombie</span>
                <span>~{plan.expectedEncounters.toFixed(1)} lần</span>
                <span>Né được</span>
                <span>{Math.round(plan.avoidChance * 100)}%</span>
                <span>Phải đánh</span>
                <span className={plan.expectedFights > 2 ? 'amber' : ''}>~{plan.expectedFights.toFixed(1)} trận</span>
                <span>Rủi ro bị cắn</span>
                <b className={plan.biteRisk > 0.15 ? 'red' : ''}>{(plan.biteRisk * 100).toFixed(1)}%</b>
                {plan.fuelL > 0 && (
                  <>
                    <span>Xăng</span>
                    <span>
                      {plan.fuelL.toFixed(1)} / {from.stock.fuel.toFixed(1)} L
                    </span>
                  </>
                )}
              </div>
            )}
            {plan?.reason && validTeam.length > 0 && <div className="red">{plan.reason}</div>}
            {err && <div className="red">{err}</div>}
            <button className="primary" disabled={!plan?.ok || !validTeam.length} onClick={launch}>
              Xuất phát
            </button>
            <button onClick={() => setTarget(null)}>Bỏ chọn</button>
          </>
        )}
      </div>
    </div>
  );
}
