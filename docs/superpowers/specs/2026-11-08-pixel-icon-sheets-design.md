# Pixel-art icon sheets — spec (mô phỏng tông innawoods)

Mục tiêu: bộ icon **pixel-art** đồng bộ với assets innawoods hiện có, sinh bằng Codex CLI,
theo yêu cầu: **mỗi batch ~25 icon gộp vào 1 file PNG (sprite sheet)** + crop ra từng file riêng để map.

## Style (đối chiếu từ assets thật)

- Canvas icon `48×48` (lưới logic 24×24, scale ×2), nền transparent.
- **Viền tối dày 2–3px** quanh silhouette (màu `#202020`/đen).
- Mỗi màu chỉ **1 tone + 1 tone bóng** (≤3 giá trị/màu), highlight nhẹ góc trên-trái (chỉ 1–2 hàng pixel).
- Giới hóa đối tượng, không gradient, không anti-alias — ranh giới pixel cứng.
- Màu bự rõ; vật nhắm giữa, chiếm ≥ 70% canvas.

## Đệm palette (tính từ sampling 6 icon innawoods)

Base: `#202020 #602020 #404020 #a08080 #202000 #a0a0a0 #204020 #406020 #404040 #804040 #606060 #604040 #808080 #204000 #000000`
+ tông tươi sáng dùng cho items nổi bật (bếp/điện/v lengths nước): `#3f7fbf #5aa0d0 #4fa77a #5f9a3a #c0703a #8a6a40 #9a8a7a #5b6fa8 #9a6ab0 #b09060 #c0a83a #8a8a80 #c06050`

## Batch 1 — 25 icons (1 sheet `tools/pixelout/sheet-01.png`)

modules (17): bedroom, kitchen, storage, workshop, infirmary, latrine, water_tank, filter, garden,
herb_garden, well, watchtower, rec_room, bookshelf, garage, generator, shelter
sites (3): site_base, site_outpost, site_field
structures (5): struct_wall, struct_barricade, struct_spikes, struct_gate, struct_tower

## Deliverables mỗi batch

- `tools/pixelout/sheet-XX.png` — grid 5×5 icon 48px (1 file)
- `public/icons/pixel/<name>.png` — crop 48×48 riêng từng icon
- `tools/pixelout/smanifest.json` — name → file, row/col
- Icon không thể vẽ được bằng规划建设 rõ ràng thì bỏ khỏi manifest và ghi vào report, không nhét icon rác.

## Map vào game (sau khi user duyệt sheet)

- `MODULE_ICONS` 17 module → `public/icons/pixel/<name>.png` (React `<Icon>` + canvas `iconImage`)
- `SITE_ICON`, `STRUCT_IMG`… dùng khi người chơi duyệt.

## Quy trình build (Codex CLI)

1. Codex viết pixel matryx (mỗi icon một const 24×24 char grid) + renderer thuần node
   (PNG encoder bằng `zlib.deflateSync`, không dependency) → sheet + crops + manifest.
2. Preview sheet cho user duyệt → rồi mới map `icons.tsx`.
