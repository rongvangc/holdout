import { useEffect, useMemo, useRef, useState } from 'react';
import { fmtDuration, isNight } from '../core/time';
import { canPlace, CELL_FLOOR, CELL_YARD, type Room } from '../base/interior';
import { ITEMS, type ItemId, type Stock } from '../data/items';
import { MODULES, type ModuleId } from '../data/modules';
import { DESIGN_LIMITS, STRUCTS, structureEffects, type StructId } from '../data/structures';
import { cancelProject, demolish, hasWorkshop, moveProject, queueDefense, queueModule } from '../sim/build';
import { CROPS, TEND_H_PER_M2_DAY } from '../sim/data';
import { clearCells, mergeRooms, paintRoom, placeStructures, removeStructures, renameRoom, roomName, structCapacity, type Layer } from '../sim/design';
import { baseStats, canAfford, present } from '../sim/state';
import type { Survivor } from '../sim/types';
import type { ViewProps } from './Game';
import { Icon, MODULE_ICONS, STRUCT_IMG, iconImage } from './icons';

const strHash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

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
  const [, setTick] = useState(0);
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
  const people = present(s, site);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    cv.width = it.w * px;
    cv.height = it.h * px;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, cv.width, cv.height);
    // Grid is stored south-up (y north); draw with north at top.
    const Y = (y: number) => (it.h - 1 - y) * px;
    const st = it.structures ?? {};
    for (let y = 0; y < it.h; y++) {
      for (let x = 0; x < it.w; x++) {
        const i = y * it.w + x;
        const k = it.kinds[i];
        const r = roomAt.get(i);
        let color = '#0a0a0a';
        if (k === CELL_FLOOR) color = '#1c1c19';
        if (k === CELL_YARD) color = floor === 0 ? '#141810' : '#0f100d';
        if (r?.module) color = MODULES[r.module].color;
        else if (r?.walled === false) color = '#26263a';
        else if (r && building.has(r.id)) color = '#3a2a2a';
        ctx.fillStyle = color;
        ctx.fillRect(x * px, Y(y), px, px);
      }
    }
    if (px >= 6) {
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let gx = 1; gx < it.w; gx++) {
        ctx.moveTo(gx * px + 0.5, 0);
        ctx.lineTo(gx * px + 0.5, cv.height);
      }
      for (let gy = 1; gy < it.h; gy++) {
        ctx.moveTo(0, gy * px + 0.5);
        ctx.lineTo(cv.width, gy * px + 0.5);
      }
      ctx.stroke();
    }
    // Walls: 2px along room boundaries — indoor concrete, outdoor earth.
    const nb = (x: number, y: number, dx: number, dy: number) => roomAt.get((y + dy) * it.w + (x + dx));
    for (let y = 0; y < it.h; y++) {
      for (let x = 0; x < it.w; x++) {
        const r = roomAt.get(y * it.w + x);
        if (!r) continue;
        ctx.fillStyle = r.outdoor ? '#3d4a32' : '#6f6f66';
        if (x === it.w - 1 || nb(x, y, 1, 0) !== r) ctx.fillRect(x * px + px - 2, Y(y), 2, px);
        if (x === 0 || nb(x, y, -1, 0) !== r) ctx.fillRect(x * px, Y(y), 2, px);
        if (y === it.h - 1 || nb(x, y, 0, 1) !== r) ctx.fillRect(x * px, Y(y), px, 2);
        if (y === 0 || nb(x, y, 0, -1) !== r) ctx.fillRect(x * px, Y(y) + px - 2, px, 2);
      }
    }
    for (let y = 0; y < it.h; y++) {
      for (let x = 0; x < it.w; x++) {
        const i = y * it.w + x;
        if (floor === 0 && (st[i] || plannedStruct.has(i))) {
          const id = st[i] ?? plannedStruct.get(i)!;
          ctx.globalAlpha = st[i] ? 1 : 0.4;
          ctx.fillStyle = STRUCTS[id].color;
          ctx.fillRect(x * px + 1, Y(y) + 1, px - 2, px - 2);
          ctx.globalAlpha = 1;
        }
        if (preview.has(i)) {
          const del = tool === 'erase' || tool === 'demolish';
          ctx.fillStyle = del ? 'rgba(255,42,42,0.26)' : 'rgba(234,234,230,0.2)';
          ctx.fillRect(x * px, Y(y), px, px);
          ctx.strokeStyle = del ? 'rgba(255,42,42,0.8)' : 'rgba(234,234,230,0.55)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x * px, Y(y) + px);
          ctx.lineTo(x * px + px, Y(y));
          ctx.stroke();
        }
      }
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const r of new Set(roomAt.values())) {
      let sx = 0;
      let sy = 0;
      let x0 = it.w;
      let x1 = 0;
      let y0 = it.h;
      let y1 = 0;
      for (const c of r.cells) {
        const cx0 = c % it.w;
        const cy0 = Math.floor(c / it.w);
        sx += cx0;
        sy += cy0;
        if (cx0 < x0) x0 = cx0;
        if (cx0 > x1) x1 = cx0;
        if (cy0 < y0) y0 = cy0;
        if (cy0 > y1) y1 = cy0;
      }
      const cx = (sx / r.cells.length + 0.5) * px;
      const cy = Y(sy / r.cells.length) + px / 2;
      if (r.module) {
        const img = iconImage(MODULE_ICONS[r.module], () => setTick((t) => t + 1));
        if (img.complete && img.naturalWidth) {
          const s = Math.max(12, px * 1.15);
          ctx.drawImage(img, cx - s / 2, cy - s / 2, s, s);
        } else {
          ctx.font = `${Math.max(12, px)}px sans-serif`;
          ctx.fillStyle = '#f2f2ee';
          ctx.fillText(MODULES[r.module].icon, cx, cy);
        }
      } else if (building.has(r.id)) {
        const p = site.projects.find((x) => x.roomId === r.id)!;
        ctx.font = `${Math.max(10, px * 0.6)}px monospace`;
        ctx.fillStyle = '#ff8080';
        ctx.fillText(`${Math.round((p.progress / p.workTotal) * 100)}%`, cx, cy);
      } else if (r.name && px >= 11) {
        ctx.font = `${Math.max(9, Math.floor(px * 0.55))}px monospace`;
        ctx.fillStyle = 'rgba(255,255,255,0.38)';
        ctx.fillText(r.name.toUpperCase(), cx, cy);
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
          if (!n(0, 1)) (ctx.moveTo(x * px + px, Y(y)), ctx.lineTo(x * px, Y(y)));
          if (!n(0, -1)) (ctx.moveTo(x * px, Y(y) + px), ctx.lineTo(x * px + px, Y(y) + px));
          ctx.stroke();
        }
        // Registration crosshairs at the room's corners.
        const tick = Math.max(3, px * 0.4);
        for (const [gx, gy] of [
          [x0 * px, Y(y0)],
          [(x1 + 1) * px, Y(y0)],
          [x0 * px, Y(y1) + px],
          [(x1 + 1) * px, Y(y1) + px],
        ]) {
          ctx.beginPath();
          ctx.moveTo(gx - tick, gy);
          ctx.lineTo(gx + tick, gy);
          ctx.moveTo(gx, gy - tick);
          ctx.lineTo(gx, gy + tick);
          ctx.stroke();
        }
      }
    }
    if (floor === 0 && px >= 12) {
      for (const [c, id] of Object.entries(st)) {
        const i = Number(c);
        const img = iconImage(STRUCT_IMG[id], () => setTick((t) => t + 1));
        if (img.complete && img.naturalWidth > 0) {
          const size = Math.floor(px * 0.8);
          ctx.drawImage(img, (i % it.w) * px + (px - size) / 2, Y(Math.floor(i / it.w)) + (px - size) / 2, size, size);
        } else {
          ctx.fillStyle = '#0e0e0e';
          ctx.font = `${Math.floor(px * 0.75)}px sans-serif`;
          ctx.fillText(STRUCTS[id].icon, (i % it.w) * px + px / 2, Y(Math.floor(i / it.w)) + px / 2);
        }
      }
    }
    if (isNight(s.t)) {
      ctx.fillStyle = 'rgba(10,18,40,0.35)';
      ctx.fillRect(0, 0, cv.width, cv.height);
    }
    // Survivors as tiny pixel figures, standing where their current task happens.
    const vis = [...new Set(roomAt.values())];
    const yardCells: number[] = [];
    if (floor === 0) {
      for (let i = 0; i < it.kinds.length; i++) {
        if (it.kinds[i] === CELL_YARD && roomAt.get(i)?.outdoor) yardCells.push(i);
      }
    }
    const outdoorKinds = new Set(['guard', 'gather', 'clean', 'corpses']);
    const moduleRoom = (m: ModuleId) => vis.find((r) => r.module === m);
    const placeCell = (v: Survivor): number | null => {
      const t = v.task;
      let room: Room | undefined;
      if (t?.kind === 'build' && t.target) {
        const p = site.projects.find((x) => x.id === t.target);
        room = vis.find((r) => r.id === p?.roomId);
      } else if (t?.kind === 'plant' || t?.kind === 'tend' || t?.kind === 'harvest') {
        room = vis.find((r) => r.id === t?.target);
      } else if (t && outdoorKinds.has(t.kind) && floor === 0 && yardCells.length) {
        return yardCells[strHash(v.id) % yardCells.length];
      } else if (t?.kind === 'cook' || t?.kind === 'boil') room = moduleRoom('kitchen');
      else if (t?.kind === 'filter') room = moduleRoom('filter');
      else if (t?.kind === 'draw') room = moduleRoom('well');
      else if (t?.kind === 'treat') room = moduleRoom('infirmary');
      else if (t?.kind === 'sleep') room = moduleRoom('bedroom') ?? moduleRoom('shelter');
      if (!room) room = vis[strHash(v.id) % Math.max(1, vis.length)];
      if (!room?.cells.length) return null;
      return room.cells[strHash(`${v.id}#`) % room.cells.length];
    };
    for (const v of people) {
      const cell = placeCell(v);
      if (cell === null) continue;
      const u = Math.max(1, Math.round(px / 8));
      const cx = (cell % it.w + 0.5) * px + ((strHash(v.id) % 3) - 1) * u;
      const cy = Y(Math.floor(cell / it.w)) + px / 2;
      const col = v.infected || v.bitten ? '#ff5a4a' : v.sickDays > 0 ? '#e0a030' : v.hp < 40 ? '#ff9a6a' : '#e8e6df';
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(cx - u - 1, cy - 4 * u - 1, 2 * u + 2, 5 * u + 2);
      ctx.fillStyle = '#d9b38c';
      ctx.fillRect(cx - u, cy - 4 * u, 2 * u, 2 * u);
      ctx.fillStyle = col;
      ctx.fillRect(cx - u, cy - 2 * u, 2 * u, 3 * u);
    }
    // North arrow and 5 m scale bar.
    ctx.fillStyle = 'rgba(234,234,230,0.9)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `${Math.max(10, Math.floor(px * 0.65))}px monospace`;
    ctx.fillText('N', 7, 14);
    ctx.beginPath();
    ctx.moveTo(10, 18);
    ctx.lineTo(6, 27);
    ctx.lineTo(14, 27);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(9, 27, 2, 7);
    const bar = Math.round((5 * px) / it.cellSize);
    const by = cv.height - 10;
    ctx.fillRect(6, by, bar, 2);
    ctx.fillRect(6, by - 2, 2, 6);
    ctx.fillRect(4 + bar, by - 2, 2, 6);
    ctx.fillText('5 m', 9 + bar, by + 7);
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
              <Icon src={STRUCT_IMG[t]} size={13} /> {STRUCTS[t].label}
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
        <div className="row dim legend" style={{ marginTop: 6 }}>
          <span>
            <i style={{ background: '#1c1c19' }} />Sàn nhà
          </span>
          <span>
            <i style={{ background: '#141810' }} />Sân
          </span>
          <span>
            <i style={{ background: '#3a2a2a' }} />Đang xây
          </span>
          <span>
            <i style={{ background: '#e8e6df' }} />Người
          </span>
          <span>
            <i style={{ background: '#ff5a4a' }} />Bị cắn/nhiễm
          </span>
          <span>
            <i style={{ background: '#e0a030' }} />Bệnh
          </span>
          <span className="faint">
            Phía trên = hướng Bắc · Kéo chuột để chọn vùng{roomTool && ' · Bắt đầu trong nhà = sửa phòng; ngoài sân = sửa khoảnh đất'}
          </span>
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
                      <Icon src={MODULE_ICONS[m]} size={22} />
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
              <button title="Ưu tiên lên trước" onClick={() => (moveProject(site, p.id, -1), refresh())}>▲</button>
              <button title="Hạ xuống" onClick={() => (moveProject(site, p.id, 1), refresh())}>▼</button>
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
