# Design — Bộ icon tactical mono-line cho HOLDOUT

Ngày: 2026-11-08 · Trạng thái: chốt — scope đã hỏi (Full), user go.

## Bối cảnh

- UI "Tactical Telemetry": nền `#0a0a0a`, mono font, accent đỏ `#ff2a2a`, không bo góc.
- Phiên song song đã ship **STATUS_ICONS inline-SVG** (readout bar, weather, chips) — vùng đó **không đụng nữa**.
- Các nhóm còn thiếu → sinh bằng **Codex CLI** theo spec validator, output `public/icons/custom/<group>/<name>.svg`, vector trực tiếp (không PNG).

##анными Generated sets (`public/icons/custom/`)

| Group | Icons | Usage>"+
|---|---|---|
| `modules/` (17) | bedroom→shelter, kể cả 4 module mới | `MODULE_ICONS` (bảng module + canvas căn cứ qua `iconImage`) |
| `roles/` (9) | idle, builder, cook, water, farmer, guard, medic, sanitation, gatherer | cột Vai trò trong PeopleView + BaseView worker dots |
| `skills/` (10) | stealth, scavenging, cooking, construction, crafting, medical, mechanics, melee, fitness, farming | chip Kỹ năng PeopleView |
| `ui/` (10) | tab_base, tab_people, tab_map, tab_laws, tab_log, speed_pause, speed_1, speed_10, speed_60, speed_240 | tabs + Speed pills trong Game.tsx |
| `sites/` (3) | site_base, site_outpost, site_field | sitesbar (thay `■ ▪ ❦`) |
| `structures/` (5) | struct_wall, struct_barricade, struct_spikes, struct_gate, struct_tower | canvas căn cứ (thay `█▚⋀▥⌂` cho từng ô) + thanh công cụ thiết kế |

Cộng 54 icons. **Item/stock icons giữ innawoods** (pixel-art, đúng tông pixel Silkscreen — không đụng).

## Style rules (element + palette)

- `viewBox="0 0 24 24"`, stroke-width **2** (mono-line), không fill đặc, `stroke-linecap="square"`, toạ độ số nguyên.
- Elements cho phép: `<svg> <g> <rect> <path> <polygon>`; path chỉ `M L H V Z` cả 45°/axis; 2–5 shapes.
- Palette = UI vars (+0–1 màu accent mỗi icon): `#eaeae6`, `#8f8f88`, `#ff2a2a`, `#c41f1f`, `#e0a030`, `#7fbf6a`, `#5a9ad0` + 17 mã `MODULES[*].color` + 5 mã `STRUCTS[*].color`.
- Không văn bản, không defs/gradient, fill default none.

## Đ wiring (Integration)

1. `icons.tsx`: `MODULE_ICONS` (17) sang custom; thêm `UI_ICONS`, `ROLE_ICONS`, `SKILL_ICONS`, `SITE_ICONS`, `STRUCT_IMG` registry.
2. `Game.tsx`: tabs prepend icon, speed pills icon flourishes, sitesbar thay SITE_ICON → `<Icon>`.
3. `PeopleView.tsx`: cột Vai trò + khối Kỹ năng mở icon nhỏ.
4. `BaseView.tsx`: struct 영역 drawImage thay fillText (màu baked từng structure), thanh công cụ prepend icon.
5. `styles.css`: gap trong tabs/speed (CSS cuối file, ít đụng chạm với phiên song song).
6. Test `tests/icons.test.ts`: registry path tồn tại under `public/`, và STATus icons untouched-ví đúng keys cũ.

## Cam kết cân bằng

Icons chỉ là mặt фрон, không thay đổi sim. Tests vẫn phải pass: `npm test`, `typecheck`, `vite build`.
