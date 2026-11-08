# Map-first Redesign — Căn cứ & Bản đồ — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đảo Căn cứ + Bản đồ thành stage tràn toàn màn với overlay shell + zoom/pan, mobile-first, giữ nguyên mọi chức năng và theme.

**Architecture:** Overlay shell dùng chung (TopStrip + KhoDrawer + tab bar) thay topbar/stockpanel/sitesbar/tabs. Toán transform cho canvas căn cứ tách thành module thuần `useViewTransform` (test được). `BaseView`/`MapView` render stage full-screen + context sheet. CSS theo breakpoint mobile-first.

**Tech Stack:** TypeScript, React 19, HTML canvas (BaseView), maplibre-gl (MapView), vitest. Không thêm dependency.

**Spec:** `docs/superpowers/specs/2026-11-08-map-first-redesign-design.md`

## Global Constraints

- Giữ theme Tactical Telemetry (dark mono, hazard red, `border-radius:0`, không gradient/shadow mềm). Không thêm dependency.
- **Không mất bất kỳ chức năng tương tác nào**: vẽ phòng, gộp/tách, đặt module, phòng thủ (gia cố/rào), hàng đợi xây, claim, tuần, tuyến, mở rộng bản đồ. Logic sim/save không đổi.
- `npm run typecheck`, `npm test`, `npm run build` xanh sau mỗi task.
- **Working tree có session song song** đang sửa `Game.tsx`, `styles.css`, `PeopleView.tsx`, sim/…: sửa phẫu thuật, không `git add -A`, chỉ commit file task tự sửa mà trước đó sạch; verify bằng test/build để khỏi phá việc họ; không hoàn nguyên thay đổi có sẵn. Commit kèm trailer `Assisted-by: Cindy (https://cindy.app)`.
- Touch target ≥44px; giữ khả năng dùng được ở 320px chiều rộng.

## Review Focus

1. **Hit-test dưới zoom/pan**: bấm vào một ô khi scale/translate tuỳ ý phải trúng đúng ô (test transform nghịch đảo). — Task 1 test.
2. **Nhận diện pan vs vẽ trên touch**: kéo để pan khi ở chế độ Xem, kéo để vẽ khi ở chế độ Sửa; không được vẽ nhầm khi người chơi muốn pan (công tắc Xem/Sửa). — Task 3 code + Task 5 manual.
3. **Các tab khác không vỡ layout**: Người/Luật/Nhật ký vẫn render đủ nội dung sau khi topbar/Kho dock → overlay. — Task 2 render test + Task 6 manual.
4. **Chức năng cũ còn nguyên**: mỗi hành động (vẽ phòng, đặt module, claim…) vẫn gọi đúng handler sim. — Task 3/4 code giữ nguyên handler; Task 6 regression.
5. **Mobile 320px**: top strip + legend + nút zoom không đè nhau, sheet mở được, pinch-zoom hoạt động. — Task 5 manual.

## File Structure

- **Create** `src/ui/useViewTransform.ts` — transform `{scale,tx,ty}` + `screenToCell` (nghịch đảo) + `zoomAt`/`pan`/`clamp`. Thuần, test được.
- **Create** `src/ui/shell/TopStrip.tsx` — thanh nổi: ngày · tài nguyên · tốc độ + nút mở Kho + công tắc tab.
- **Create** `src/ui/shell/KhoDrawer.tsx` — drawer inventory (nội dung từ `.stockpanel` cũ).
- **Create** `src/ui/shell/OverlayShell.tsx` + `useOverlay.ts` — khung overlay + state (đang mở sheet/drawer nào).
- **Create** `src/ui/sheet/Sheet.tsx` — bottom-sheet (mobile) / drawer (desktop) dùng chung.
- **Modify** `src/ui/BaseView.tsx` — stage full-screen + zoom/pan + chế độ Xem/Sửa + tools overlay + context sheet.
- **Modify** `src/ui/MapView.tsx` — map full-screen + NavigationControl + context sheet + legend/lớp lên trên.
- **Modify** `src/ui/Game.tsx` — bọc OverlayShell, bỏ topbar/stockpanel/sitesbar/tabs cũ.
- **Modify** `src/ui/styles.css` — overlay shell, sheet, breakpoint mobile-first.
- **Test** `tests/viewTransform.test.ts`, `tests/shell.test.tsx`.

---

### Task 1: `useViewTransform` — toán zoom/pan + hit-test

**Files:**
- Create: `src/ui/useViewTransform.ts`
- Test: `tests/viewTransform.test.ts`

**Interfaces (Task 3 dùng đúng tên này):**
- `export interface ViewTransform { scale: number; tx: number; ty: number }`
- `export const IDENTITY: ViewTransform` (= `{scale:1,tx:0,ty:0}`)
- `export function zoomAt(t: ViewTransform, factor: number, cx: number, cy: number): ViewTransform` — zoom quanh điểm `(cx,cy)` toạ độ màn hình, clamp scale về `[MIN_SCALE, MAX_SCALE]`.
- `export function pan(t: ViewTransform, dx: number, dy: number): ViewTransform`
- `export function screenToCell(t: ViewTransform, cellPx: number, sx: number, sy: number): number | null` — toạ độ màn hình `(sx,sy)` → index ô (theo `it.w`) hoặc `null` nếu ngoài lưới (cần `gridW`, `gridH`: thêm tham số `gridW`,`gridH`).
- `export function fitTransform(gridW: number, gridH: number, cellPx: number, viewW: number, viewH: number): ViewTransform` — scale để vừa khung, giữa màn.
- Hằng: `MIN_SCALE = 0.4`, `MAX_SCALE = 4`, `CELL_BASE = 24` (px/ô gốc).

- [ ] **Step 1: Viết test fail** `tests/viewTransform.test.ts`:
  - `zoomAt(IDENTITY, 2, 0, 0)` → `{scale:2,tx:0,ty:0}`; `zoomAt({scale:1,tx:0,ty:0},2,100,100)` → tx/ty giữ điểm (100,100) đứng yên: `tx=100*(1-2)`.
  - Quy ước hit-test (bắt buộc): `cx = floor((sx - tx) / (scale * cellPx))`, `cy = floor((sy - ty) / (scale * cellPx))`, `index = cy * gridW + cx`; trả `null` nếu `cx<0 || cx>=gridW || cy<0 || cy>=gridH`.
  - `screenToCell({scale:1,tx:0,ty:0},24, 5, 5, gridW=10, gridH=10)` → `0` (ô 0,0; vì floor(5/24)=0); `screenToCell({scale:1,tx:0,ty:0},24, 25, 25, 10, 10)` → `11` (ô 1,1; vì floor(25/24)=1); `screenToCell({scale:2,tx:0,ty:0},24, 48,48,10,10)` → `11` (ô 1,1; vì floor(48/48)=1); ngoài lưới → `null`.
  - `screenToCell` chính xác sau `zoomAt`+`pan` (round-trip): chọn ô, zoom/pan, bấm lại toạ độ màn hình tương ứng → vẫn ra ô đó.
  - `fitTransform(10,10,24,1000,600)` → scale ≤ MAX, tx/ty căn giữa.
  - Clamp: `zoomAt({scale:MAX_SCALE,…},2,…)` không vượt `MAX_SCALE`.
- [ ] **Step 2:** `npx vitest run tests/viewTransform.test.ts` → FAIL (module chưa có).
- [ ] **Step 3:** Viết `src/ui/useViewTransform.ts` (thuần TS, không React). Hit-test: `cell = screenToCell` = inverse `(sx-tx)/(scale*cellPx)`, floor, chặn lưới.
- [ ] **Step 4:** test PASS.
- [ ] **Step 5:** Commit `git add src/ui/useViewTransform.ts tests/viewTransform.test.ts` + `feat(ui): view transform + hit-test cho canvas căn cứ` + trailer.

---

### Task 2: Overlay shell (TopStrip + KhoDrawer + tab bar)

**Files:**
- Create: `src/ui/shell/TopStrip.tsx`, `src/ui/shell/KhoDrawer.tsx`, `src/ui/shell/OverlayShell.tsx`, `src/ui/shell/useOverlay.ts`
- Modify: `src/ui/Game.tsx` (đang dirty — chỉ thêm import + thay khung)
- Modify: `src/ui/styles.css`
- Test: `tests/shell.test.tsx`

**Interfaces:**
- Consumes: `baseStats`, `present`, `fmtNum` (Game.tsx export), `ITEMS`/`STOCK_ORDER`/`ITEM_ICONS`.
- Produces:
  - `useOverlay(): { khoOpen: boolean; toggleKho(): void; sheet: SheetId | null; openSheet(id): void; closeSheet(): void }` với `SheetId = 'kho' | 'tools' | 'room' | 'projects' | 'stats' | 'expedition' | 'target'`.
  - `OverlayShell({ s, world, site, setSite, tab, setTab, children })` — render TopStrip + KhoDrawer + `{children}` (stage) + Sheet host.
  - `TopStrip({ … })`: ngày · tốc độ (SPEED_LABEL) · tài nguyên (gold? không — game có kcal/nước…) · nút Kho + tab switcher. **Giữ nguyên** tín hiệu speed/Space/phím 1-4 hiện có.
  - `KhoDrawer({ s, site })`: nguyên nội dung `.stockpanel` cũ (bảng kho + Đủ dùng + Điểm này + game-over).

- [ ] **Step 1: test fail** `tests/shell.test.tsx` (renderToStaticMarkup): `OverlayShell` render ra TopStrip có ngày + nhãn tài nguyên; `KhoDrawer` render đủ 16 mục `STOCK_ORDER`; tab switcher có đủ 5 tab.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** viết `useOverlay.ts`, `TopStrip.tsx`, `KhoDrawer.tsx`, `OverlayShell.tsx`. Nội dung KhoDrawer copy từ `.stockpanel` trong `Game.tsx` (không đổi logic `fmtNum`/tính ngày). `Game.tsx`: thay `<div className="topbar">…` + `.stockpanel` + `.sitesbar` + `.tabs` bằng `<OverlayShell …>{stage}</OverlayShell>`; render `BaseView`/`MapView`/… trong `children` theo `tab`.
- [ ] **Step 4:** CSS: `.topstrip`, `.khodrawer`, `.tabbar`, overlay nổi; breakpoint mobile-first.
- [ ] **Step 5:** `npm run typecheck && npm test` → PASS (các tab khác render bình thường — Review Focus 3).
- [ ] **Step 6:** Commit các file shell mới + `Game.tsx` + `styles.css` (nếu sạch) + `feat(ui): overlay shell (TopStrip + KhoDrawer + tab bar)` + trailer.

---

### Task 3: `BaseView` map-first (stage full + zoom/pan + edit/pan + tools overlay + context sheet)

**Files:**
- Modify: `src/ui/BaseView.tsx`, `src/ui/styles.css`
- Create: `src/ui/sheet/Sheet.tsx`
- Test: mở rộng `tests/shell.test.tsx` hoặc `tests/baseView.test.tsx` (render smoke)

**Interfaces:**
- Consumes: `useViewTransform` (Task 1), `Sheet` (nội bộ), `useOverlay` (Task 2).
- Produces: `Sheet({ open, onClose, title, children })` — bottom-sheet (≤900px) / drawer (≥901px), kéo-thả 2 mức.

- [ ] **Step 1:** viết `Sheet.tsx` (dùng chung) + test render smoke (mở/đóng).
- [ ] **Step 2:** `BaseView`: canvas trong transform `{scale,tx,ty}` (CSS transform) + hit-test bằng `screenToCell`. Wheel zoom (`zoomAt` theo con trỏ), pinch 2 ngón, kéo = pan khi `mode==='view'`; kéo = vẽ khi `mode==='edit'`. Thêm **công tắc Xem/Sửa**. Nút +/−/fit.
- [ ] **Step 3:** Tools (select/room/merge/erase/demolish/StructId) → toolbar overlay nổi dưới/dưới-trái. Panel nội dung (sửa phòng, module, phòng thủ, Hạng mục, chỉ số) → `Sheet` mở khi bấm phòng/sân hoặc nút "Xây/Nâng cấp". **Giữ nguyên** mọi handler (`paintRoom`,`queueModule`,`queueDefense`,`moveProject`,…).
- [ ] **Step 4:** Legend → top (cùng TopStrip hoặc bar dưới TopStrip).
- [ ] **Step 5:** `npm run typecheck && npm test && npx vite build` → PASS.
- [ ] **Step 6:** Commit `BaseView.tsx`, `sheet/Sheet.tsx`, `styles.css` + `feat(ui): căn cứ map-first (zoom/pan + edit mode + context sheet)` + trailer.

---

### Task 4: `MapView` map-first (full map + NavigationControl + context sheet + legend top)

**Files:**
- Modify: `src/ui/MapView.tsx`, `src/ui/styles.css`

**Interfaces:**
- Consumes: `Sheet`, `useOverlay`, maplibre `NavigationControl`.
- Produces: map full-screen; `map.addControl(new maplibregl.NavigationControl())`; lớp (Nguy hiểm/Nhiệt) + legend → top bar overlay; panel (đội/tuyến/mục tiêu/mở rộng) → `Sheet`. **Giữ nguyên** handler (claim/patrol/route/expand…).

- [ ] **Step 1:** `MapView`: bỏ `.side-panel`, map full stage; thêm `NavigationControl` (+/−/compass).
- [ ] **Step 2:** Lớp `danger`/`heat` + legend → overlay top; bấm mục tiêu → `Sheet` với claim/tuần; đội/tuyến → `Sheet`; "Mở rộng" → trong Sheet/top action.
- [ ] **Step 3:** `npm run typecheck && npm test && npx vite build` → PASS.
- [ ] **Step 4:** Commit `MapView.tsx`, `styles.css` + `feat(ui): bản đồ map-first (NavigationControl + context sheet)` + trailer.

---

### Task 5: Mobile-first polish (bottom-sheet, touch, pinch, responsive)

**Files:**
- Modify: `src/ui/styles.css`, `src/ui/sheet/Sheet.tsx`, `src/ui/BaseView.tsx`, `src/ui/shell/*`

- [ ] **Step 1:** bottom-sheet 2 mức (nửa/gần full) kéo-thả; touch target ≥44px; top strip + legend + zoom không đè ở 320px.
- [ ] **Step 2:** pinch-zoom 2 ngón cả BaseView (đã) + MapView (native); pan mượt; tránh scroll ngang thân trang.
- [ ] **Step 3:** `npm run typecheck && npm test && npx vite build` → PASS.
- [ ] **Step 4:** Commit + `feat(ui): mobile-first polish (bottom-sheet, touch, pinch)` + trailer.

---

### Task 6: Verify & bàn giao

- [ ] **Step 1:** `npm run typecheck && npm test && npm run build` → PASS, không test nào fail từ trước.
- [ ] **Step 2:** Regression thủ công các chức năng: vẽ phòng, gộp/tách, đặt module, phòng thủ, hàng đợi, claim, tuần, tuyến, mở rộng bản đồ. (Review Focus 4.)
- [ ] **Step 3:** Kiểm 320px + mobile (bottom-sheet, pinch, touch). (Review Focus 5.)
- [ ] **Step 4:** Kiểm tab Người/Luật/Nhật ký không vỡ. (Review Focus 3.)
- [ ] **Step 5:** `git status` chỉ còn file của session song song; báo cáo file đã commit + các call.
