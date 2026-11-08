# Dashboard Readout Board — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đảo dashboard chữ của HOLDOUT thành bảng readout (icon + số + bar) đọc bằng mắt, giữ nguyên sim và ngôn ngữ "Tactical Telemetry".

**Architecture:** Tách phần tính toán readout thành module thuần `src/ui/readout.ts` (test được bằng vitest), component `ReadoutBar` render gauge/chip, `Game.tsx` chỉ lắp ráp. Icon trạng thái vẽ inline SVG một màu (`currentColor`) trong `icons.tsx`. CSS mới trong `styles.css`, không thêm dependency.

**Tech Stack:** TypeScript, React 19, Vite, vitest (tests thuần logic, không có test DOM).

**Spec:** `docs/superpowers/specs/2026-11-08-dashboard-readout-board-design.md`

## Global Constraints

- Không sửa logic sim, save format, `docs/GAMEPLAY.md`; không đổi theme (dark mono, hazard red, `border-radius: 0`, không gradient/shadow mềm).
- Không thêm dependency mới.
- Ngưỡng cảnh báo dùng đúng ngưỡng hiện có: ăn < 3 ngày đỏ, uống < 2 ngày đỏ (warn = gấp đôi ngưỡng), thiếu giường (`beds < here`), heat > 45 đỏ, filth > 40 đỏ, morale < 25 (chậm việc) / < 15 (bỏ trốn).
- `npm run typecheck` và `npm test` phải xanh sau mỗi task.
- **Working tree đang dirty** (`Game.tsx`, `styles.css`, `BaseView.tsx`, `MapView.tsx`, `daily.ts`, `build.ts`, `modules.ts`, `docs/GAMEPLAY.md` có thay đổi chưa commit của người khác): chỉ `git add` đúng file task tự tạo/sửa mà trước đó sạch; KHÔNG `git add -A`; không hoàn nguyên thay đổi có sẵn. Commit kèm trailer `Assisted-by: Cindy (https://cindy.app)`.

## Review Focus

1. **Site không có người** (điểm mới chiếm, `present()` rỗng): mọi readout phải là số/ký hiệu hợp lệ, không NaN (chia cho `max(1, population)`, morale của list rỗng = 0 với text `—`). — Task 1 test.
2. **Ngưỡng biên**: 2.9/3.0/3.1 ngày ăn; 1.9/2.0/2.1 ngày uống; heat 45/46; filth 40/41 — đúng `bad` khi strictly vượt. — Task 1 test.
3. **Thông tin bị cắt khỏi UI phải nằm trong hint/tooltip** — câu đầy đủ cũ của từng ô được pin trong test hint. — Task 1 test.
4. **Số lớn trong lưới kho** (kcal hàng chục nghìn): dùng `fmtNum` sẵn có (`Game.tsx` export), không viết lại định dạng mới. — Task 4 code dùng `fmtNum`, kiểm bằng build.
5. **Working tree không bị commit lẫn/lộn**: sau cùng `git status` chỉ còn đúng các file dirty ban đầu. — Task 5 bước kiểm.

---

### Task 1: Readout model — `src/ui/readout.ts`

**Files:**
- Create: `src/ui/readout.ts`
- Test: `tests/readout.test.ts`

**Interfaces:**
- Consumes: `GameState`, `Site` (`src/sim/types.ts`), `baseStats`, `present` (`src/sim/state.ts`), `makeTestWorld` (`scripts/headless.ts`), `newGame` (`src/sim/state.ts`).
- Produces (Task 3, 4 dùng đúng các tên này):
  - `export type Tone = 'ok' | 'warn' | 'bad'`
  - `export interface Readout { id: 'food' | 'water' | 'beds' | 'morale' | 'defense'; icon: string; label: string; text: string; ratio: number | null; tone: Tone; hint: string }`
  - `export interface Chip { id: 'heat' | 'filth' | 'corpses' | 'latrine' | 'fortify' | 'fence' | 'expeditions'; icon: string; text: string; tone: Tone; hint: string }`
  - `export function readouts(s: GameState, site: Site): Readout[]` — trả đúng 5 readout theo thứ tự food, water, beds, morale, defense.
  - `export function siteChips(s: GameState, site: Site): Chip[]` — heat, filth, corpses.
  - `export function facilityChips(s: GameState, site: Site): Chip[]` — latrine, fortify, fence, expeditions.

Công thức và text (đúng y hệt, test sẽ pin):

| id | text | tone | ratio | hint |
|---|---|---|---|---|
| food | `X.X ngày` (1 số lẻ) | bad < 3, warn < 6, else ok | `min(1, days/10)` | `Ăn: đủ X.X ngày cho N người` |
| water | `X.X ngày` | bad < 2, warn < 4, else ok | `min(1, days/7)` | `Uống: đủ X.X ngày cho N người` |
| beds | `here/beds` | warn nếu `beds < here`, else ok | `beds>0 ? min(1, here/beds) : 1` | `Giường: here người / beds giường` |
| morale | `NN` (làm tròn) hoặc `—` khi không có ai | bad < 15, warn < 25, else ok | `avg/100` (0 khi rỗng) | `Tinh thần TB NN/100` hoặc `Không có ai ở đây` |
| defense | `NN` (làm tròn) | luôn `'ok'` | `null` | `Phòng thủ tĩnh NN` |

- `foodDays = (stock.food + stock.meals + stock.rawFood) / (max(1, st.population) * 2250)`; `waterDays = stock.water / (max(1, st.population) * 3.3)`; `morale = avg(morale của present(s, site))`, list rỗng → text `—`.
- `siteChips`: heat text `NN`, bad khi `> 45`, hint `Độ ồn NN/100`; filth text `NN`, bad khi `> 40`, hint `Độ bẩn NN/100`; corpses text `NN`, tone `'bad'` khi `> 0` else `'ok'`, hint `Xác chưa xử lý NN`.
- `facilityChips`: latrine text `N`, warn khi `latrines * 20 < st.population`, hint `Nhà vệ sinh: N (đủ cho N*20 người)`; fortify text `cấp L · H%`, hint `Gia cố: cấp L · H% HP`; fence text `cấp L · H%`, hint `Rào: cấp L · H% HP`; expeditions text `N đội`, hint `N đội đang ngoài`.
- `icon` = key cho `STATUS_ICONS` (Task 2): food/water/beds/morale/defense/heat/filth/corpses/latrine/fortify/fence/expedition.

- [ ] **Step 1: Viết test fail** — `tests/readout.test.ts`: setup theo mẫu `tests/design.test.ts` (`makeTestWorld()` → `newGame(world, id, 42, new Date(2026,5,1))`), set thẳng `site.stock`/`site.heat`… rồi assert:

```ts
// đủ ăn 4 ngày cho population hiện có → warn (4 < 6)
site.stock.food = st.population * 2250 * 4;
const food = readouts(s, site)[0];
expect(food.text).toBe('4.0 ngày');
expect(food.tone).toBe('warn');
expect(food.ratio).toBeCloseTo(0.4);

// biên: 3.0 ngày là 'ok', 2.9 là 'bad'
// heat 46 → bad, 45 → ok; filth 41 → bad, 40 → ok
// site không người (đưa mọi người sang chỗ khác hoặc site mới): không NaN, morale.text === '—'
// hint khớp đúng chuỗi: expect(food.hint).toBe(`Ăn: đủ 4.0 ngày cho ${pop} người`)
```

- [ ] **Step 2: Chạy `npx vitest run tests/readout.test.ts`** — FAIL (module chưa tồn tại).
- [ ] **Step 3: Viết `src/ui/readout.ts`** — thuần TypeScript, không import React; các hằng số ngưỡng đặt ở đầu file (`FOOD_BAD = 3`, `FOOD_WARN = 6`, `WATER_BAD = 2`, `WATER_WARN = 4`, `HEAT_BAD = 45`, `FILTH_BAD = 40`, `MORALE_BAD = 15`, `MORALE_WARN = 25`).
- [ ] **Step 4: Chạy lại test** — PASS.
- [ ] **Step 5: Commit** — `git add src/ui/readout.ts tests/readout.test.ts` (2 file mới, sạch) + commit `feat(ui): readout model cho dashboard` + trailer Assisted-by.

---

### Task 2: Status icons inline SVG — `src/ui/icons.tsx`

**Files:**
- Modify: `src/ui/icons.tsx` (file hiện đang sạch — commit được)

**Interfaces:**
- Produces: `export const STATUS_ICONS: Record<string, string>` (id → SVG inner markup, hình khối phẳng 16×16, dùng `currentColor`) và `export function StatusIcon({ name, size = 16 }: { name: string; size?: number }): JSX.Element` render `<svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" aria-hidden>` bọc inner markup. Đủ key: `food, water, beds, morale, defense, heat, filth, corpses, sun, rain, storm, horde, latrine, fortify, fence, expedition`.

- [ ] **Step 1: Vẽ 16 icon** — mỗi icon ≤ 3 khối `path`/`rect`, góc 0°/45°, không gradient, không text; `horde` là sóng ba mũi tên đặc, `heat` là sóng nhiệt dạng bậc, `defense` là khiên khối, `morale` là mặt đơn giản dạng khối (2 mắt + miệng, không nét mảnh).
- [ ] **Step 2: `npm run typecheck`** — PASS.
- [ ] **Step 3: Commit** — `git add src/ui/icons.tsx` + `feat(ui): status icons inline SVG` + trailer.

---

### Task 3: Topbar → readout bar — `src/ui/Game.tsx` + `src/ui/ReadoutBar.tsx`

**Files:**
- Create: `src/ui/ReadoutBar.tsx`
- Modify: `src/ui/Game.tsx` (đang dirty — KHÔNG commit)
- Modify: `src/ui/styles.css` (đang dirty — KHÔNG commit)

**Interfaces:**
- Consumes: `readouts`, `siteChips`, `Readout`, `Chip` (Task 1), `StatusIcon` (Task 2).
- Produces: `export function ReadoutBar({ s, site }: { s: GameState; site: Site })` render: 5 ô gauge (icon + `text` + bar ngang `ratio` nếu khác null, class `tone-{tone}`, attr `title={hint}`) + 3 chip site (icon + text, `title={hint}`).

- [ ] **Step 1: Viết `src/ui/ReadoutBar.tsx`** — class `readout` bọc `.gauge` × 5 + `.chips` × 3; bar là `div.bar > div.fill` style width `ratio*100%`; `ratio === null` thì không render bar.
- [ ] **Step 2: Sửa topbar trong `Game.tsx`** — giữ: ô Ngày/đồng hồ, speed buttons, Lưu/Thoát. Xóa 4 stat block cũ (Thời tiết, Nhân lực, Điểm này, Phòng thủ). Thêm: badge thời tiết (`StatusIcon`: `s.weather.storm` → `storm`, else `s.weather.rainMm > 0` → `rain`, else `sun`; text `{tempC}°C`, `title` = `{label} · {tempC}°C · {rainMm} mm`), chip bầy zombie khi `dayOf(s.t) <= s.hordeUntilDay` (`horde` icon + chữ `Bầy` đỏ, `title` = `Bầy zombie đi qua`); khi không có bầy thì không render chip, rồi `<ReadoutBar s={s} site={site} />`.
- [ ] **Step 3: CSS trong `styles.css`** — thêm `.readout`, `.gauge`, `.gauge .bar/.fill`, `.tone-ok/--warn/--bad`, `.badge`, `.chips/.chip`; giữ nguyên biến `--red/--amber/--ok` hiện có; wrap topbar bằng flex-wrap có sẵn.
- [ ] **Step 4: `npm run typecheck && npm test`** — PASS.
- [ ] **Step 5: `npm run build`** — PASS (không commit 3 file dirty này; ghi chú vào báo cáo cuối).

---

### Task 4: Kho → lưới icon, feed rút gọn

**Files:**
- Modify: `src/ui/Game.tsx` (đang dirty — KHÔNG commit)
- Modify: `src/ui/styles.css` (đang dirty — KHÔNG commit)

**Interfaces:**
- Consumes: `facilityChips` (Task 1), `STATUS_ICONS` (Task 2), `fmtNum` (export sẵn trong `Game.tsx`), `ITEM_ICONS`, `STOCK_ORDER`.

- [ ] **Step 1: Đảo `.stockpanel`** — thay `<table>` 16 dòng bằng lưới `.stockgrid`: mỗi ô `<div class="stockcell" title={label}>` chứa `<Icon src={ITEM_ICONS[k]} size={24} />`, số `fmtNum(stock[k])`, đơn vị `ITEMS[k].unit` nhỏ mờ; `stock[k] < 0.5` → thêm class `faint`. Giữ nhãn `Kho · {site.name}`.
- [ ] **Step 2: Xóa 2 block chữ** — block `Đủ dùng (n người)` (đã lên readout bar) và block `Điểm này` (kv nhà vệ sinh/gia cố/rào/viễn chinh) → thay bằng hàng `facilityChips` (icon + text + title). Giữ nguyên block game-over.
- [ ] **Step 3: Feed rút còn 6 dòng + nút** — `s.log.slice(-6)` thay `slice(-60)`, thêm `<button className="feedmore">Nhật ký →</button>` gọi `setTab('log')` (tab state đã có sẵn trong component).
- [ ] **Step 4: CSS + dọn CSS chết** — thêm `.stockgrid/.stockcell/.facility/.feedmore`; grep `.kv`, `.stockpanel table`, `.stockpanel td` trước khi xóa — chỉ xóa rule không còn được dùng ở file nào khác.
- [ ] **Step 5: `npm run typecheck && npm test && npm run build`** — PASS. Không commit.

---

### Task 5: Verify & bàn giao

- [ ] **Step 1: Chạy trọn bộ** — `npm run typecheck && npm test && npm run build` — PASS, không test nào fail từ trước.
- [ ] **Step 2: Kiểm working tree** — `git status --short` phải cho đúng danh sách dirty ban đầu (8 mục) + file mới của task; mọi commit chỉ chứa file sạch được liệt kê ở task.
- [ ] **Step 3: Chạy `npm run dev`** — mở `http://localhost:5173`, kiểm bằng mắt: readout bar đủ 5 ô có bar/màu, lưới kho 16 ô icon, feed ≤ 6 dòng, nút "Nhật ký →" chuyển tab, game-over vẫn hiện. (Không có test DOM nên đây là bước kiểm thị giác — báo lại kết quả.)
- [ ] **Step 4: Báo cáo** — liệt kê file đã commit, file để nguyên trong working tree, và các call đã tự chốt.
