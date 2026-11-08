# Icon Spec — HOLDOUT mono-line tactical set

Generator runs (Codex CLI) MUST follow this exactly. Validator tools/validate_icons.mjs is the source of truth.

Style: **mono-line tactical** — nét đơn 2px, không fill đặc, âm trên nền tối `#0a0a0a`. Ngôn ngữ hình: khối nguyên, góc vuông/nghiêng 45°, chỉ dùng line + lỗ.

## Canvas rules

- `viewBox="0 0 24 24"`, mọi toạ độ nguyên (integers), art trong 2..22.
- Stroke: `stroke-width="2"` duy nhất, `stroke-linecap="square"`, `stroke-linejoin="miter"`, `fill="none"` mặc định cho bất kỳ element nào có stroke.
- Chỉ 2–5 element mỗi icon. Một icon luôn có một element "thân" chính đọc được ở 14px.
- Elements cho phép: `<svg> <g> <rect> <path> <polygon>` ( concreto: KHÔNG có `<circle>`/`<ellipse>`; chi tiết tròn tách bằng polygon亯).
- path chỉ dùng `M L H V Z`, mỗi cạnh axis-aligned hoặc đúng 45°.
- Không: `<defs>`, gradient, `<filter>`, `<mask>`, `<text>`, `<image>`, `opacity < 1`, `rx`.
- Bắt tặng: `xmlns="http://www.w3.org/2000/svg"`.
- Background trong suốt.

## Palette (CHỈ hex dưới đây)

Base UI: `#eaeae6` (fg), `#8f8f88` (dim), `#ff2a2a`, `#c41f1f`, `#e0a030`, `#7fbf6a`, `#5a9ad0`
Module/structure accents: `#2f6fa0 #3f7fbf #4fa77a #5aa0d0 #5b6fa8 #5f9a3a #6a6a50 #6a7a50 #8a6a40 #8a7a50 #8a8a80 #9a6ab0 #9a8a7a #a05040 #a05a5a #b09060 #c06050 #c0703a #c0a83a`

Quy tắc chọn màu:
- Bảng (`ui/`, `roles/`, `skills/`, `sites/`): network một màu `#eaeae6` cho nét chính; accents tối đa 1>1 element màu đỏ `#ff2a2a` hoặc màu danh hiệu `#e0a030` cho điểm nhấn tương ứng nghĩa (vd: raid = đỏ).
- `modules/<x>.svg`: nét chính = `MODULES[x].color` (bảng dưới), 0–1 accent phụ `#eaeae6` hoặc `#8f8f88`.
- `structures/...`: nét chính `STRUCTS[x].color`.

Module accent map: bedroom `#5b6fa8`, kitchen `#c0703a`, storage `#8a7a50`, workshop `#9a8a7a`, infirmary `#4fa77a`, latrine `#6a6a50`, water_tank `#3f7fbf`, filter `#5aa0d0`, garden `#5f9a3a`, herb_garden `#4fa77a`, well `#2f6fa0`, watchtower `#a05a5a`, rec_room `#9a6ab0`, bookshelf `#b09060`, garage `#8a8a80`, generator `#c0a83a`, shelter `#6a7a50`.
Struct accent map: wall `#8a8a80`, barricade `#8a6a40`, spikes `#a05040`, gate `#b09060`, tower `#c06050`.

## Manifest + design ý

| File | Shape ý (vẽ CÓ ý tưởng theo ý này, không "trông như cái gì cũng được") |
|---|---|
| modules/bedroom | Khoe giường: đệm ngang + đầu giường 2 cột, gói gối là lỗ xuyên |
| modules/kitchen | Bếp củi: cradle + thân chống + ngọn lửa 45° trên nóc |
| modules/storage | Thùng đôi: 2 rect chồng + thanh khoá chéo 45° giữa |
| modules/workshop | Bàn + chữ V công cụ: đế bàn ngang + chân 2 bên + cỏ dashes vít nêm |
| modules/infirmary | Thập hồng trong khung + 4 góc()];
| modules/latrine | Bồn + đuôi ống dẫn xuống |
| modules/water_tank | Trống nằm + 2 chân + ống từ nóc |
| modules/filter | Giọt nước xuyên 3 thanh lọc nghiêng 45° |
| modules/garden | Luống 3 đường song song + 1 mầm 45° |
| modules/herb_garden | Chậu lá + lá 45° + dấu ✚ nhỏ trên lá (thuốc) |
| modules/well | Vành giếng + cần gạt 45° + thùng treo |
| modules/watchtower | giàn 3 chân + nóc có màn |
| modules/rec_room | Bảng + 2 ghế đối xứng + chấm đèn |
| modules/bookshelf | Tủ 3 ngăn + sách đứng lệch |
| modules/garage | Mái vát + của lẫy 45° |
| modules/generator | Motor hộp + tia 3 nhánh + thanh kožuch dẫn | thnał địęk |
| modules/shelter | Lán A-frame: 2 mái 45° + nền ngang |
| roles/idle | Người ngồi xõa: đầu + thân nghi 45° |
| roles/builder | Búa đầu choẳng + cán 45° |
| roles/cook | Nồi + quai 2 bên + ống hút nghiêng |
| roles/water | Xô + giọt rơi 45° |
| roles/farmer | Liềm + cán |
| roles/guard | Khiên + gai (chappoint 45°) |
| roles/medic | Thập + cẳng 45° |
| roles/sanitation | Xẻng đối xứng + thân |
| roles/gatherer | Rìu + khúc gỗ ngang |
| skills/stealth | Mũi lén nghiêng 45° chấm chân mờ |
| skills/scavenging | Kẹp/nhíp kéo mở 45° |
| skills/cooking | Thìa lệch trên nồi nhỏ |
| skills/construction | Bản vẽ + thước vuông 45° |
| skills/crafting | Cờ lê U + đai ốc vuông |
| skills/medical | Băng cuộn + đuôi vải nghiregn 45° |
| skills/mechanics | Bánh răng vuông hoá (8 răng là khối rect) |
| skills/melee | Kiếm 45° với chuôi trước |
| skills/fitness | Tạ song song 2 đĩa |
| skills/farming | Cây mầm 3 lá 45° |
| ui/tab_base | Nhà căn cứ: mái 45° + cửa lỗ |
| ui/tab_people | 2 người đứng cách nhau |
| ui/tab_map | Bản đồ gấp + đường 45° |
| ui/tab_laws | Cột + bảng cân bằng |
| ui/tab_log | Bookmark + dòng chữ rút gọn |
| ui/speed_pause | Dحرstores 2 khối dọc |
| ui/speed_1 | Mũi tên + số vạch 1 tinha |
| ui/speed_10 | Mũi tên + 2 vạch |
| ui/speed_60 | Mũi tên + 3 vạch |
| ui/speed_240 | Mũi tên + 4 vạch |
| sites/site_base | Nhà lớn + cửa + nóc chóp 45° |
| sites/site_outpost | Cờている + cột nghiêng |
| sites/site_field | 3.sleep luống + hàng rào nhỏ |
| structures/struct_wall | 2 tảng – vỉa chặt |
| structures/struct_gate | Khung cổ + thanh ngang |
| structures/struct_spikes | 3 đinh nhọn 45° |
| structures/struct_barricade | 2 thanh xếp X 45° |
| structures/struct_tower | Chòi tháp + hộp trên nóc |

## File naming

`public/icons/custom/<group>/<name>.svg` — lower_snake_case.
