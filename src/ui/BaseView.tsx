import { useEffect, useMemo, useRef, useState } from 'react';
import { fmtDuration } from '../core/time';
import { canPlace, CELL_FLOOR, CELL_YARD, type Room } from '../base/interior';
import { ITEMS, type ItemId, type Stock } from '../data/items';
import { MODULES, type ModuleId } from '../data/modules';
import { DESIGN_LIMITS, STRUCTS, structureEffects, type StructId } from '../data/structures';
import { cancelProject, demolish, hasWorkshop, queueDefense, queueModule } from '../sim/build';
import { CROPS, TEND_H_PER_M2_DAY } from '../sim/data';
import { clearCells, mergeRooms, paintRoom, placeStructures, removeStructures, renameRoom, roomName, structCapacity, type Layer } from '../sim/design';
import { baseStats, canAfford } from '../sim/state';
import type { ViewProps } from './Game';

const fmtCost = (c: Partial<Stock>) =>
  Object.entries(c)
    .filter(([, v]) => v)
    .map(([k, v]) => `${Math.round(v! * 10) / 10} ${ITEMS[k as ItemId].label.toLowerCase()}`)
    .join(', ');

type Tool = 'select' | 'room' | 'erase' | 'merge' | 'demolish' | StructId;
type Shape = 'fill' | 'outline';

const TOOLS: [Tool, string, string][] = [
  ['select', '↖ Chọn', 'Bấm phòng/khoảnh để xem và đặt công trình'],
  ['room', '▭ Vẽ phòng', 'Kéo chọn vùng để tạo phòng mới (trong nhà) hoặc khoảnh đất (ngoài sân)'],
  ['merge', '⊞ Gộp', 'Bấm phòng thứ nhất rồi phòng thứ hai sát bên'],
  ['erase', '⌫ Bỏ khỏi phòng', 'Kéo chọn ô để tách khỏi phòng (thành hành lang/đất trống)'],
];

export function BaseView({ s, site, refresh }: ViewProps) {
  const it = site.interior;
  const [floor, setFloor] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('select');
  const [shape, setShape] = useState<Shape>('outline');
  const [drag, setDragState] = useState<{ a: number; b: number } | null>(null);
  const dragRef = useRef<{ a: number; b: number } | null>(null);
  const setDrag = (d: { a: number; b: number } | null) => {
    dragRef.current = d;
    setDragState(d);
  };
  const [pending, setPending] = useState<number[] | null>(null);
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);
  const px = Math.max(8, Math.min(22, Math.floor(620 / Math.max(it.w, it.h))));
  const isStruct = tool in STRUCTS;
  const roomTool = tool === 'room' || tool === 'erase';

  const roomAt = useMemo(() => {
    const map = new Map<number, Room>();
    for (const r of it.rooms) {
      if (r.floor !== floor && !(r.outdoor && floor === 0)) continue;
      for (const c of r.cells) map.set(c, r);
    }
    return map;
    // Rooms mutate in place; the project count changes whenever layout does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [it, floor, it.rooms.length, it.rooms.map((r) => r.cells.length).join(',')]);

  const building = new Set(site.projects.map((p) => p.roomId));
  const plannedStruct = new Map<number, StructId>();
  for (const p of site.projects) if (p.kind === 'structure') for (const c of p.cells ?? []) plannedStruct.set(c, p.struct!);
  const room = it.rooms.find((r) => r.id === sel) ?? null;

  const rectCells = (a: number, b: number): number[] => {
    const [ax, ay, bx, by] = [a % it.w, Math.floor(a / it.w), b % it.w, Math.floor(b / it.w)];
    const [x0, x1, y0, y1] = [Math.min(ax, bx), Math.max(ax, bx), Math.min(ay, by), Math.max(ay, by)];
    const out: number[] = [];
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        if (isStruct && shape === 'outline' && x !== x0 && x !== x1 && y !== y0 && y !== y1) continue;
        out.push(y * it.w + x);
      }
    return out;
  };
  const preview = new Set(drag ? rectCells(drag.a, drag.b) : (pending ?? []));

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    cv.width = it.w * px;
    cv.height = it.h * px;
    ctx.fillStyle = '#0b0b0b';
    ctx.fillRect(0, 0, cv.width, cv.height);
    // Grid is stored south-up (y north); draw with north at top.
    const Y = (y: number) => (it.h - 1 - y) * px;
    const st = it.structures ?? {};
    for (let y = 0; y < it.h; y++) {
      for (let x = 0; x < it.w; x++) {
        const i = y * it.w + x;
        const k = it.kinds[i];
        const r = roomAt.get(i);
        let color = '#0b0b0b';
        if (k === CELL_FLOOR) color = '#1d1d1b';
        if (k === CELL_YARD) color = floor === 0 ? '#161a12' : '#0f100d';
        if (r?.module) color = MODULES[r.module].color;
        else if (r?.walled === false) color = '#26263a';
        else if (r && building.has(r.id)) color = '#3a2a2a';
        ctx.fillStyle = color;
        ctx.fillRect(x * px, Y(y), px, px);
        ctx.fillStyle = r?.outdoor ? '#2c3326' : '#5a5a55';
        const nb = (dx: number, dy: number) => roomAt.get((y + dy) * it.w + (x + dx));
        if (r) {
          if (x === it.w - 1 || nb(1, 0) !== r) ctx.fillRect(x * px + px - 1, Y(y), 1, px);
          if (x === 0 || nb(-1, 0) !== r) ctx.fillRect(x * px, Y(y), 1, px);
          if (y === it.h - 1 || nb(0, 1) !== r) ctx.fillRect(x * px, Y(y), px, 1);
          if (y === 0 || nb(0, -1) !== r) ctx.fillRect(x * px, Y(y) + px - 1, px, 1);
        }
        if (floor === 0 && (st[i] || plannedStruct.has(i))) {
          const id = st[i] ?? plannedStruct.get(i)!;
          ctx.globalAlpha = st[i] ? 1 : 0.4;
          ctx.fillStyle = STRUCTS[id].color;
          ctx.fillRect(x * px + 1, Y(y) + 1, px - 2, px - 2);
          ctx.globalAlpha = 1;
        }
        if (preview.has(i)) {
          ctx.fillStyle = tool === 'erase' || tool === 'demolish' ? 'rgba(255,42,42,0.45)' : 'rgba(230,230,227,0.35)';
          ctx.fillRect(x * px, Y(y), px, px);
        }
      }
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const r of new Set(roomAt.values())) {
      let sx = 0;
      let sy = 0;
      for (const c of r.cells) {
        sx += c % it.w;
        sy += Math.floor(c / it.w);
      }
      const cx = (sx / r.cells.length + 0.5) * px;
      const cy = Y(sy / r.cells.length) + px / 2;
      if (r.module) {
        ctx.font = `${Math.max(12, px)}px sans-serif`;
        ctx.fillStyle = '#f2f2ee';
        ctx.fillText(MODULES[r.module].icon, cx, cy);
      } else if (building.has(r.id)) {
        const p = site.projects.find((x) => x.roomId === r.id)!;
        ctx.font = `${Math.max(10, px * 0.6)}px monospace`;
        ctx.fillStyle = '#ff8080';
        ctx.fillText(`${Math.round((p.progress / p.workTotal) * 100)}%`, cx, cy);
      }
      if (r.id === sel) {
        ctx.strokeStyle = '#ff2a2a';
        ctx.lineWidth = 2;
        for (const c of r.cells) {
          const x = c % it.w;
          const y = Math.floor(c / it.w);
          const n = (dx: number, dy: number) => roomAt.get((y + dy) * it.w + (x + dx)) === r;
          ctx.beginPath();
          if (!n(1, 0)) (ctx.moveTo(x * px + px, Y(y)), ctx.lineTo(x * px + px, Y(y) + px));
          if (!n(-1, 0)) (ctx.moveTo(x * px, Y(y)), ctx.lineTo(x * px, Y(y) + px));
          if (!n(0, 1)) (ctx.moveTo(x * px, Y(y)), ctx.lineTo(x * px + px, Y(y)));
          if (!n(0, -1)) (ctx.moveTo(x * px, Y(y) + px), ctx.lineTo(x * px + px, Y(y) + px));
          ctx.stroke();
        }
      }
    }
    if (floor === 0 && px >= 12) {
      ctx.font = `${Math.floor(px * 0.75)}px sans-serif`;
      ctx.fillStyle = '#0e0e0e';
      for (const [c, id] of Object.entries(st)) {
        const i = Number(c);
        ctx.fillText(STRUCTS[id].icon, (i % it.w) * px + px / 2, Y(Math.floor(i / it.w)) + px / 2);
      }
    }
  });

  const cellAt = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(it.w - 1, Math.max(0, Math.floor((e.clientX - rect.left) / px)));
    const y = it.h - 1 - Math.min(it.h - 1, Math.max(0, Math.floor((e.clientY - rect.top) / px)));
    return y * it.w + x;
  };

  const act = (fn: () => string | null) => {
    setErr(fn() ?? '');
    refresh();
  };

  const onDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = cellAt(e);
    setErr('');
    if (tool === 'select') {
      setSel(roomAt.get(c)?.id ?? null);
      return;
    }
    if (tool === 'merge') {
      const r = roomAt.get(c);
      if (!r) return;
      if (!sel || sel === r.id) return setSel(r.id);
      act(() => mergeRooms(s, site, sel, r.id));
      setSel(sel);
      return;
    }
    setPending(null);
    setDrag({ a: c, b: c });
  };
  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragRef.current) setDrag({ ...dragRef.current, b: cellAt(e) });
  };
  const onUp = () => {
    const d = dragRef.current;
    if (!d) return;
    setPending(rectCells(d.a, d.b));
    setDrag(null);
  };

  // Layer for room tools: inferred from where the stroke started.
  const layerOf = (cells: number[]): Layer => {
    const indoor = cells.some((c) => it.kinds[c] === CELL_FLOOR);
    return indoor ? { floor, outdoor: false } : { floor: 0, outdoor: true };
  };

  const apply = () => {
    if (!pending) return;
    const cells = pending;
    if (tool === 'room') {
      const l = layerOf(cells);
      act(() => paintRoom(s, site, l, cells.filter((c) => it.kinds[c] === (l.outdoor ? CELL_YARD : CELL_FLOOR)), name || undefined));
    } else if (tool === 'erase') act(() => clearCells(s, site, layerOf(cells), cells));
    else if (tool === 'demolish') act(() => removeStructures(s, site, cells));
    else if (isStruct) act(() => placeStructures(s, site, tool as StructId, cells));
    setPending(null);
  };

  const st = baseStats(s, site);
  const workshop = hasWorkshop(s);
  const field = site.kind === 'field';
  const plot = room ? site.plots[room.id] : undefined;
  const cap = structCapacity(site);
  const fx = structureEffects(it.structures);
  const pendingCells = pending?.length ?? 0;
  const yardPending = pending?.filter((c) => it.kinds[c] === CELL_YARD).length ?? 0;
  const structCost = isStruct && yardPending ? Object.fromEntries(Object.entries(STRUCTS[tool as StructId].cost).map(([k, v]) => [k, (v ?? 0) * yardPending])) : null;

  return (
    <div className="baseview">
      <div className="canvaswrap">
        <div className="row" style={{ marginBottom: 6 }}>
          {Array.from({ length: it.floors }, (_, f) => (
            <button key={f} className={f === floor ? 'on' : ''} onClick={() => setFloor(f)}>
              {field ? 'Ruộng' : f === 0 ? 'Tầng trệt + sân' : `Tầng ${f + 1}`}
            </button>
          ))}
          <span className="dim">
            {field
              ? `Ô = ${it.cellSize} m · đất ${it.yardArea} m² · chu vi ${it.yardPerimeter} m`
              : `Ô = ${it.cellSize} m · mặt bằng ${it.footprintArea} m² · sân ${it.yardArea} m² · chu vi ${it.perimeter} m`}
          </span>
        </div>
        <div className="row toolbar" style={{ marginBottom: 6, gap: 4 }}>
          {TOOLS.map(([t, l, d]) => (
            <button key={t} className={tool === t ? 'on' : ''} title={d} onClick={() => (setTool(t), setPending(null))}>
              {l}
            </button>
          ))}
          <span className="faint">|</span>
          {(Object.keys(STRUCTS) as StructId[]).map((t) => (
            <button
              key={t}
              className={tool === t ? 'on' : ''}
              disabled={floor !== 0}
              title={`${STRUCTS[t].desc} · mỗi ô: ${fmtCost(STRUCTS[t].cost)}, ${fmtDuration(STRUCTS[t].workSec)}`}
              onClick={() => (setTool(t), setPending(null))}
            >
              {STRUCTS[t].icon} {STRUCTS[t].label}
            </button>
          ))}
          <button className={tool === 'demolish' ? 'on' : ''} disabled={floor !== 0} onClick={() => (setTool('demolish'), setPending(null))}>
            ✕ Dỡ
          </button>
          {isStruct && (
            <>
              <span className="faint">|</span>
              <button className={shape === 'outline' ? 'on' : ''} onClick={() => setShape('outline')}>
                Viền
              </button>
              <button className={shape === 'fill' ? 'on' : ''} onClick={() => setShape('fill')}>
                Kín
              </button>
            </>
          )}
        </div>
        <canvas ref={canvas} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp} />
        <div className="row dim" style={{ marginTop: 6 }}>
          Phía trên = hướng Bắc. Kéo chuột để chọn vùng.
          {roomTool && ' Bắt đầu trong nhà = sửa phòng tầng đang xem; bắt đầu ngoài sân = sửa khoảnh đất.'}
        </div>
      </div>
      <div className="side-panel">
        {pending && pendingCells > 0 && (
          <div className="card col">
            <b>
              {tool === 'room' ? 'Tạo phòng mới' : tool === 'erase' ? 'Tách ô khỏi phòng' : tool === 'demolish' ? 'Dỡ công trình' : `Xây ${STRUCTS[tool as StructId].label}`} ·{' '}
              {pendingCells} ô ({pendingCells * it.cellSize * it.cellSize} m²)
            </b>
            {tool === 'room' && (
              <>
                <input placeholder="Tên phòng (tuỳ chọn)" value={name} maxLength={32} onChange={(e) => setName(e.target.value)} />
                <div className="dim">
                  Phòng trong nhà cần dựng vách: {Math.ceil(pendingCells * DESIGN_LIMITS.partitionWoodPerCell)} gỗ,{' '}
                  {fmtDuration(600 + pendingCells * DESIGN_LIMITS.partitionSecPerCell)}. Tối đa {DESIGN_LIMITS.maxRoomIndoor} m² trong nhà, {DESIGN_LIMITS.maxRoomOutdoor} m² ngoài sân.
                </div>
              </>
            )}
            {structCost && (
              <div className="dim">
                {yardPending} ô đất trống · {fmtCost(structCost)} · {fmtDuration(STRUCTS[tool as StructId].workSec * yardPending)} công
              </div>
            )}
            <div className="row">
              <button className="primary" onClick={apply}>
                Áp dụng
              </button>
              <button onClick={() => setPending(null)}>Huỷ</button>
            </div>
          </div>
        )}
        {err && <div className="red">{err}</div>}

        {tool === 'select' && !room && <div className="dim">Bấm vào một phòng hoặc khoảnh sân để xây. Dùng công cụ phía trên để tự vẽ lại bố cục.</div>}
        {tool === 'merge' && <div className="dim">{sel ? `Đã chọn ${room ? roomName(room) : ''}. Bấm phòng sát bên để gộp.` : 'Bấm phòng thứ nhất.'}</div>}
        {room && tool === 'select' && (
          <div className="card col">
            <div className="row">
              <input
                className="grow"
                value={room.name ?? ''}
                placeholder={`${room.outdoor ? 'Sân' : `Tầng ${room.floor + 1}`} · ${Math.round(room.area)} m²`}
                maxLength={32}
                onChange={(e) => (renameRoom(site, room.id, e.target.value), refresh())}
              />
              {room.module && <span className="tag">{MODULES[room.module].label}</span>}
            </div>
            <div className="dim">
              {room.outdoor ? 'Ngoài sân' : `Tầng ${room.floor + 1}`} · {Math.round(room.area)} m²
              {room.walled === false && <span className="amber"> · đang chờ dựng vách</span>}
            </div>
            {room.module && <div className="dim">{MODULES[room.module].desc}</div>}
            {plot && (
              <div className="kv">
                <span>Cây</span>
                <span>{plot.crop ? CROPS[plot.crop].label : 'chưa gieo (cần hạt giống)'}</span>
                <span>Lớn</span>
                <span>{Math.round(plot.growth * 100)}%</span>
                <span>Chăm hôm nay</span>
                <span>
                  {plot.tendedToday.toFixed(1)}/{(room.area * TEND_H_PER_M2_DAY).toFixed(1)} h
                </span>
              </div>
            )}
            {room.module && <button onClick={() => act(() => (demolish(s, site, room.id), null))}>Tháo dỡ (hoàn 40%)</button>}
            {!room.module && !building.has(room.id) && room.walled !== false && (
              <div className="modlist col" style={{ gap: 4 }}>
                {(Object.keys(MODULES) as ModuleId[]).map((m) => {
                  const def = MODULES[m];
                  const why = canPlace(it, room, def) ?? (def.needsWorkshop && !workshop ? 'Cần Bàn thợ' : null);
                  if (why && why.startsWith('Phải')) return null;
                  const cost = def.cost(room.area);
                  return (
                    <button key={m} disabled={!!why} onClick={() => act(() => queueModule(s, site, room.id, m))} title={def.desc}>
                      <span>{def.icon}</span>
                      <span>
                        {def.label}
                        <br />
                        <span className={canAfford(site, cost) ? 'faint' : 'amber'}>{why ?? fmtCost(cost)}</span>
                      </span>
                      <span className="dim">{fmtDuration(def.workSec(room.area))}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="label">Phòng thủ</div>
        <div className="row">
          <button disabled={!it.perimeter} onClick={() => act(() => queueDefense(s, site, 'fortify'))}>
            {site.fortify.level && site.fortify.hp < 100 ? 'Sửa gia cố' : `Gia cố cấp ${site.fortify.level + 1}`}
          </button>
          <button disabled={!it.yardPerimeter} onClick={() => act(() => queueDefense(s, site, 'fence'))}>
            {site.fence.level && site.fence.hp < 100 ? 'Sửa rào' : `Rào cấp ${site.fence.level + 1}`}
          </button>
        </div>
        <div className="kv">
          <span>Ô công trình</span>
          <span className={cap.used >= cap.max ? 'amber' : ''}>
            {cap.used}/{cap.max}
          </span>
          <span>Phòng thủ từ công trình</span>
          <span>
            +{fx.defense.toFixed(1)} (tối đa {DESIGN_LIMITS.structDefenseCap})
          </span>
          <span>Bẫy làm yếu tập kích</span>
          <span>
            −{fx.spikes.toFixed(1)} (tối đa {DESIGN_LIMITS.spikesCap})
          </span>
        </div>

        <div className="label">Hạng mục ({site.projects.length})</div>
        {!site.projects.length && <div className="faint">Không có gì đang xây.</div>}
        {site.projects.map((p) => (
          <div key={p.id} className="card">
            <div className="row">
              <span className="grow">{p.label}</span>
              <button onClick={() => (cancelProject(s, site, p.id), refresh())}>✕</button>
            </div>
            <div className="dim">
              {p.paid ? `${fmtDuration(p.workTotal - p.progress)} công còn lại` : <span className="amber">Chờ vật tư: {fmtCost(p.cost)}</span>}
            </div>
            <div className="progress">
              <i style={{ width: `${(p.progress / p.workTotal) * 100}%` }} />
            </div>
          </div>
        ))}

        <div className="label">Chỉ số</div>
        <div className="kv">
          <span>Giường</span>
          <span>{st.beds}</span>
          <span>Bể nước</span>
          <span>
            {st.tanks} · mái hứng {it.footprintArea} m²
          </span>
          <span>Vườn</span>
          <span>{st.gardenArea} m²</span>
          <span>Bếp/Lọc/Giếng</span>
          <span>
            {st.kitchen ? '✓' : '✗'} / {st.filter ? '✓' : '✗'} / {st.well ? '✓' : '✗'}
          </span>
          <span>Bàn thợ/Y tế/Kho</span>
          <span>
            {st.workshop ? '✓' : '✗'} / {st.infirmary ? '✓' : '✗'} / {st.storage ? '✓' : '✗'}
          </span>
        </div>
      </div>
    </div>
  );
}
