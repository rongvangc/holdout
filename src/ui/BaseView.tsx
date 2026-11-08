import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { fmtDuration, isNight } from '../core/time';
import { canPlace, CELL_FLOOR, CELL_YARD, type Room } from '../base/interior';
import { ITEMS, type ItemId, type Stock } from '../data/items';
import { MODULES, type ModuleId } from '../data/modules';
import { DESIGN_LIMITS, STRUCTS, structureEffects, type StructId } from '../data/structures';
import { availableRecipes } from '../data/recipes';
import { KitchenPanel } from './KitchenPanel';
import { ModulesPanel } from './ModulesPanel';
import { GearPanel } from './GearPanel';
import { APPLIANCES } from '../sim/power';
import { foodFxLabel } from '../sim/diet';
import {
  cancelProject,
  demolish,
  hasWorkshop,
  maxStationLevel,
  moveProject,
  queueCraft,
  queueRepair,
  repairableWeapons,
  queueDefense,
  queueModule,
  stationLevel,
  upgradeModule,
} from '../sim/build';
import { CROPS, TEND_H_PER_M2_DAY } from '../sim/data';
import { clearCells, mergeRooms, paintRoom, placeStructures, removeStructures, renameRoom, roomName, structCapacity, type Layer } from '../sim/design';
import { baseStats, canAfford, present } from '../sim/state';
import type { Survivor } from '../sim/types';
import type { ViewProps } from './Game';
import { Icon, ITEM_ICONS, MODULE_ICONS, STRUCT_IMG, iconImage } from './icons';

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

export function BaseView({ s, site, refresh, focusPanel }: ViewProps) {
  const it = site.interior;
  const [floor, setFloor] = useState(0);
  const [sel, setSel] = useState<string | null>(null);

  // Bảng công trình (tab "Công trình") bấm một dòng sẽ nhảy về phòng đó trên mặt bằng.
  useEffect(() => {
    const jump = (e: Event) => {
      const d = (e as CustomEvent<{ roomId: string; floor: number }>).detail;
      if (!d) return;
      setFloor(d.floor ?? 0);
      setSel(d.roomId);
      setSection('plan');
    };
    window.addEventListener('holdout:select-room', jump as EventListener);
    return () => window.removeEventListener('holdout:select-room', jump as EventListener);
  }, []);
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
  // One section visible at a time: the sidebar used to stack seven jobs at once.
  const [section, setSection] = useState<'plan' | 'modules' | 'craft' | 'kitchen' | 'gear' | 'power'>('plan');
  const [buildOpen, setBuildOpen] = useState(false);
  const [showAllModules, setShowAllModules] = useState(false);
  const [err, setErr] = useState('');
  const [, setTick] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  // 1 = vừa khung; lăn chuột (giữ Shift) hoặc nút ± để phóng thêm, canvas cuộn được khi lớn hơn khung.
  const [zoom, setZoom] = useState(1);

  // Mặt bằng phải chiếm hết vùng trống: đo khung chứa rồi chia ô cho vừa.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setBox((prev) => (Math.abs(prev.w - rect.width) < 1 && Math.abs(prev.h - rect.height) < 1 ? prev : { w: rect.width, h: rect.height }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Cỡ ô mặc định: vừa cả khung, nhưng ít nhất 32px/ô khi bề ngang còn chỗ — mặt bằng dọc
  // (nhà + sân kéo dài) nhờ vậy vẫn đọc được, phần dư thì cuộn dọc.
  const fitPx = useMemo(() => {
    const availW = Math.max(160, (box.w || 720) - 28);
    const availH = Math.max(160, (box.h || 720) - 104);
    const fitBoth = Math.floor(Math.min(availW / it.w, availH / it.h));
    const readable = Math.floor(Math.min(availW / it.w, 40));
    return Math.max(6, Math.min(56, Math.max(fitBoth, readable)));
  }, [box.w, box.h, it.w, it.h]);
  const px = Math.max(4, Math.min(160, Math.round(fitPx * zoom)));
  const zoomBy = (factor: number) => setZoom((z) => Math.max(0.5, Math.min(5, +(z * factor).toFixed(3))));

  const pxRef = useRef(px);
  pxRef.current = px;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  // Giữ đúng ô nằm dưới con trỏ khi zoom.
  const zoomAnchor = useRef<{ cx: number; cy: number; sx: number; sy: number; px: number } | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const zoomAt = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      zoomAnchor.current = { cx: sx + el.scrollLeft, cy: sy + el.scrollTop, sx, sy, px: pxRef.current };
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      setZoom((z) => Math.max(0.5, Math.min(5, +(z * factor).toFixed(3))));
    };
    el.addEventListener('wheel', zoomAt, { passive: false });
    return () => el.removeEventListener('wheel', zoomAt);
  }, []);

  useLayoutEffect(() => {
    const anchor = zoomAnchor.current;
    const el = wrap.current;
    if (!anchor || !el) return;
    zoomAnchor.current = null;
    const k = px / anchor.px;
    el.scrollLeft = anchor.cx * k - anchor.sx;
    el.scrollTop = anchor.cy * k - anchor.sy;
  }, [px]);

  // Giữ phím Space để kéo mặt bằng (giống các trình vẽ); Alt + kéo cũng được.
  const [spaceDown, setSpaceDown] = useState(false);
  useEffect(() => {
    const isTyping = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      return !!el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
    };
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isTyping(e.target)) setSpaceDown(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const panRef = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);
  const [panning, setPanning] = useState(false);
  const wantsPan = (e: React.MouseEvent) => e.button === 1 || (e.button === 0 && (e.altKey || spaceDown));

  const onWrapMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = wrap.current;
    if (!el || !wantsPan(e)) return;
    e.preventDefault();
    panRef.current = { x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop };
    setPanning(true);
  };

  const onWrapMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = wrap.current;
    const panning = panRef.current;
    if (!el || !panning) return;
    el.scrollLeft = panning.sl - (e.clientX - panning.x);
    el.scrollTop = panning.st - (e.clientY - panning.y);
  };

  const endPan = () => {
    if (!panRef.current) return;
    panRef.current = null;
    setPanning(false);
  };
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
          const sizePx = Math.floor(px * 0.8);
          ctx.drawImage(img, (i % it.w) * px + (px - sizePx) / 2, Y(Math.floor(i / it.w)) + (px - sizePx) / 2, sizePx, sizePx);
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
    if (e.button !== 0 || e.altKey || spaceDown) return; // đang kéo mặt bằng
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

  const stationLevels: Partial<Record<string, number>> = {};
  for (const m of Object.keys(MODULES)) stationLevels[m] = stationLevel(site, m as ModuleId);
  const recipes = availableRecipes(stationLevels as never);
  const st = baseStats(s, site);
  // R1: a decision row can ask for a specific section; open it once.
  useEffect(() => {
    if (!focusPanel) return;
    if (focusPanel === 'kitchen') setSection('kitchen');
    else if (focusPanel === 'gear') setSection('gear');
    else if (focusPanel === 'craft' || focusPanel === 'defence') setSection('craft');
    else if (focusPanel === 'power') setSection('power');
  }, [focusPanel]);
  // Điện: nguồn nào đang cấp, thiết bị nào được bật, thiết bị nào bị cắt.
  const onSet = new Set(st.powerOn);
  const appliances = APPLIANCES.map((a) => ({ ...a, built: (stationLevels[a.module] ?? 0) > 0, on: onSet.has(a.module) }));
  const builtAppliances = appliances.filter((a) => a.built);
  const powerDemand = builtAppliances.reduce((n, a) => n + a.kw, 0);
  const powerServed = builtAppliances.filter((a) => a.on).reduce((n, a) => n + a.kw, 0);
  const worn = repairableWeapons(site);
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
      <div
        className={`canvaswrap${panning ? ' panning' : ''}${spaceDown ? ' panspace' : ''}`}
        ref={wrap}
        onMouseDown={onWrapMouseDown}
        onMouseMove={onWrapMouseMove}
        onMouseUp={endPan}
        onMouseLeave={endPan}
      >
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
          <span className="grow" />
          <button onClick={() => zoomBy(1 / 1.25)} title="Thu nhỏ (lăn chuột xuống)" aria-label="Thu nhỏ">
            −
          </button>
          <span className="dim" style={{ minWidth: 46, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(px)}px/ô
          </span>
          <button onClick={() => zoomBy(1.25)} title="Phóng to (lăn chuột lên)" aria-label="Phóng to">
            +
          </button>
          <button onClick={() => setZoom(1)} title="Vừa khung" disabled={zoom === 1}>
            Vừa
          </button>
        </div>
        <div className="row toolbar" style={{ marginBottom: 6, gap: 4 }}>
          {TOOLS.map(([t, l, d]) => (
            <button key={t} className={tool === t ? 'on' : ''} title={d} onClick={() => (setTool(t), setPending(null))}>
              {l}
            </button>
          ))}
          <span className="faint">|</span>
          <button className={buildOpen ? 'on' : ''} onClick={() => setBuildOpen((v) => !v)} title="Công trình ngoài sân">
            {buildOpen ? '▾' : '▸'} Xây
          </button>
          {buildOpen && (Object.keys(STRUCTS) as StructId[]).map((t) => (
            <button
              key={t}
              className={tool === t ? 'on' : ''}
              disabled={floor !== 0}
              title={`${STRUCTS[t].desc} · mỗi ô: ${fmtCost(STRUCTS[t].cost)}, ${fmtDuration(STRUCTS[t].workSec)}`}
              onClick={() => (setTool(t), setPending(null))}
            >
              <Icon src={STRUCT_IMG[t]} size={14} /> {STRUCTS[t].label}
            </button>
          ))}
          {buildOpen && (
            <button className={tool === 'demolish' ? 'on' : ''} disabled={floor !== 0} onClick={() => (setTool('demolish'), setPending(null))}>
              ✕ Dỡ
            </button>
          )}
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
            Phía trên = hướng Bắc · Kéo chuột để chọn vùng{roomTool && ' · Bắt đầu trong nhà = sửa phòng; ngoài sân = sửa khoảnh đất'} · Lăn chuột = zoom · Giữ Space (hoặc Alt) + kéo, hay kéo chuột giữa = di chuyển
          </span>
        </div>
      </div>
      <div className="side-panel">
        <div className="seg" role="tablist" aria-label="Ngăn của căn cứ">
          {([
            ['plan', 'Mặt bằng'],
            ['modules', 'Công trình'],
            ['craft', 'Chế tạo'],
            ['kitchen', 'Bếp'],
            ['gear', 'Trang bị'],
            ['power', 'Điện'],
          ] as const).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={section === id} className={section === id ? 'on' : ''} onClick={() => setSection(id)}>
              {label}
            </button>
          ))}
        </div>
        {section === 'plan' && (
          <>
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
              {room.module && (
                <span className="tag" title="Cấp của công trình — nâng cấp để tăng hiệu quả">
                  {MODULES[room.module].label}
                  {(MODULES[room.module].levels?.length ?? 0) > 0 ? ` · cấp ${room.moduleLevel ?? 1}/${maxStationLevel(room.module)}` : ''}
                </span>
              )}
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
            {room.module && (() => {
              const def = MODULES[room.module];
              const lvl = room.moduleLevel ?? 1;
              const max = maxStationLevel(room.module);
              if (!def.levels?.length) return null;
              if (lvl >= max) return <div className="faint">{def.label} đã ở cấp tối đa ({max}).</div>;
              const next = def.levels[lvl - 1];
              const afford = canAfford(site, next.cost);
              return (
                <button className={afford ? 'primary' : ''} title={next.note} onClick={() => act(() => upgradeModule(s, site, room.id))}>
                  Nâng cấp lên cấp {lvl + 1} · {fmtCost(next.cost)} · {fmtDuration(next.workSec)}
                </button>
              );
            })()}
            {room.module && <button onClick={() => act(() => (demolish(s, site, room.id), null))}>Tháo dỡ (hoàn 40%)</button>}
            {!room.module && !building.has(room.id) && room.walled !== false && (
              <div className="modlist col" style={{ gap: 4 }}>
                {(Object.keys(MODULES) as ModuleId[]).map((m) => {
                  const def = MODULES[m];
                  const why = canPlace(it, room, def) ?? (def.needsWorkshop && !workshop ? 'Cần Bàn thợ' : null);
                  if (why && why.startsWith('Phải')) return null;
                  // Mặc định chỉ hiện mục đặt được; phần còn lại nằm sau một nút.
                  if (why && !showAllModules) return null;
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
                {(() => {
                  const blocked = (Object.keys(MODULES) as ModuleId[]).filter((m) => {
                    const why = canPlace(it, room, MODULES[m]) ?? (MODULES[m].needsWorkshop && !workshop ? 'Cần Bàn thợ' : null);
                    return !!why && !why.startsWith('Phải');
                  }).length;
                  if (!blocked) return null;
                  return (
                    <button className="faint" onClick={() => setShowAllModules((v) => !v)}>
                      {showAllModules ? 'Ẩn mục chưa đặt được' : `+ ${blocked} mục chưa đặt được`}
                    </button>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        <div className="label" title="Sức chắn của điểm này khi bị tập kích đêm — tăng bằng gia cố, rào, tháp canh, công trình">Phòng thủ</div>
        <div className="row">
          <button disabled={!it.perimeter} title="Gia cố chu vi toà nhà: từng cấp cộng điểm phòng thủ, cấp 2+ cần Bàn thợ" onClick={() => act(() => queueDefense(s, site, 'fortify'))}>
            {site.fortify.level && site.fortify.hp < 100 ? 'Sửa gia cố' : `Gia cố cấp ${site.fortify.level + 1}`}
          </button>
          <button disabled={!it.yardPerimeter} onClick={() => act(() => queueDefense(s, site, 'fence'))}>
            {site.fence.level && site.fence.hp < 100 ? 'Sửa rào' : `Rào cấp ${site.fence.level + 1}`}
          </button>
        </div>
        <div className="kv">
          <span title="Số ô đất được phép đặt công trình ngoài sân tại điểm này">Ô công trình</span>
          <span className={cap.used >= cap.max ? 'amber' : ''}>
            {cap.used}/{cap.max}
          </span>
          <span title="Điểm cộng thêm vào phòng thủ từ tường, chướng ngại, bẫy, chòi">Phòng thủ từ công trình</span>
          <span>
            +{fx.defense.toFixed(1)} (tối đa {DESIGN_LIMITS.structDefenseCap})
          </span>
          <span title="Bẫy chông trừ thẳng vào sức của đám zombie khi tập kích">Bẫy làm yếu tập kích</span>
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

          </>
        )}
        {section === 'craft' && (
          <>
            <div className="label">Chế tạo ({recipes.length})</div>
            {true && (
          <div className="col" style={{ gap: 4 }}>
            {!recipes.length && <div className="faint">Chưa có trạm nào. Xây Lò rèn / Xưởng mộc / Lò nung / Xưởng may trước.</div>}
            {worn.map((w) => (
              <button
                key={`repair-${w.id}`}
                disabled={(stationLevels.forge ?? 0) < 2}
                onClick={() => act(() => queueRepair(s, site, w.id))}
                title={(stationLevels.forge ?? 0) < 2 ? 'Cần lò rèn cấp 2' : `Sửa ${ITEMS[w.id]?.label ?? w.id}`}
              >
                <Icon src={ITEM_ICONS[w.id] ?? MODULE_ICONS.forge} size={20} />
                <span>
                  Sửa {ITEMS[w.id]?.label ?? w.id}
                  <br />
                  <span className="amber">mòn {Math.round((1 - w.condition) * 100)}%</span>
                </span>
                <span className="dim">sửa</span>
              </button>
            ))}
            {recipes.map((r) => {
              const afford = canAfford(site, Object.fromEntries(r.in));
              const outKg = (ITEMS[r.out]?.kgPerUnit ?? 0) * r.qty;
              return (
                <button
                  key={r.id}
                  disabled={!afford}
                  onClick={() => act(() => queueCraft(s, site, r.id))}
                  title={[
                    `${MODULES[r.station].label} cấp ${r.level} · ${fmtDuration(r.workSec)}`,
                    ITEMS[r.out]?.morale ? `+${ITEMS[r.out].morale} tinh thần` : '',
                    foodFxLabel(ITEMS[r.out]?.fx),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                >
                  <Icon src={ITEM_ICONS[r.out] ?? MODULE_ICONS[r.station]} size={20} />
                  <span>
                    {ITEMS[r.out]?.label ?? r.out} ×{r.qty}
                    <br />
                    <span className={afford ? 'faint' : 'amber'}>{fmtCost(Object.fromEntries(r.in))}</span>
                  </span>
                  <span className="dim">{outKg ? `${outKg.toFixed(1)} kg` : ''}</span>
                </button>
              );
            })}
          </div>
        )}

          </>
        )}
        {section === 'modules' && <ModulesPanel s={s} site={site} refresh={refresh} />}
        {section === 'kitchen' && <KitchenPanel s={s} site={site} refresh={refresh} />}

        {section === 'gear' && <GearPanel s={s} site={site} refresh={refresh} />}

        {section === 'power' && (<>
        <div className="label">Điện &amp; sưởi</div>
        <div className="kv">
          <span title="Tổng công suất các thiết bị đã xây">Cần</span>
          <span className={powerDemand > powerServed ? 'amber' : ''}>{powerServed.toFixed(1)}/{powerDemand.toFixed(1)} kW</span>
          <span title="Pin mặt trời sạc ắc quy ban ngày; máy phát đốt xăng ban đêm">Nguồn</span>
          <span>
            {st.generator ? `máy phát ${st.generatorLevel}` : 'không máy phát'}
            {` · ${Math.round(site.batteryKwh ?? 0)} kWh`}
          </span>
          <span title="Lò củi chỉ đốt gỗ vào đêm dưới 18°C">Sưởi</span>
          <span className={site.warmthActive || st.heaterWarmth > 0 ? 'ok' : s.weather.tempC < 18 ? 'amber' : 'faint'}>
            {site.warmthActive
              ? `lò củi −${Math.round(st.stoveWarmth * 100)}% rét`
              : st.heaterWarmth > 0
                ? `máy sưởi −${Math.round(st.heaterWarmth * 100)}% rét`
                : s.weather.tempC < 18
                  ? 'đang lạnh, không sưởi'
                  : 'không cần'}
          </span>
        </div>
        {builtAppliances.length > 0 && (
          <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
            {builtAppliances.map((a) => (
              <span
                key={a.module}
                className={`tag ${a.on ? '' : 'red'}`}
                title={a.on ? `${MODULES[a.module].label} đang chạy · ${a.kw} kW` : `${MODULES[a.module].label} bị cắt vì thiếu điện`}
              >
                {MODULES[a.module].label} {a.kw}kW {a.on ? '●' : '○'}
              </span>
            ))}
          </div>
        )}
        {powerDemand > powerServed && (
          <div className="amber">
            Thiếu {(powerDemand - powerServed).toFixed(1)} kW — cắt tải theo ưu tiên: hàng rào → đèn → tủ lạnh → bơm → máy móc → radio → đèn cây → sưởi.
          </div>
        )}

          </>
        )}

        {section === 'plan' && (<>
        <div className="label" title="Tổng quan thiết bị khả dụng của điểm này">Chỉ số</div>
        <div className="kv">
          <span title="Số giường ngủ — thiếu giường, người ngủ sàn, hồi mệt chậm hơn">Giường</span>
          <span>{st.beds}</span>
          <span title="Số bể chứa nước mưa hứng từ mái — mái càng rộng hứng càng nhiều">Bể nước</span>
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
        </>
        )}
      </div>
    </div>
  );
}
